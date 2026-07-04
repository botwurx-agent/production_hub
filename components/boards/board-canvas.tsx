"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardItemView } from "@/app/(app)/boards/actions";
import {
  moveItem,
  resizeItem,
  bringToFront,
  updateNote,
  deleteItem,
} from "@/app/(app)/boards/actions";

const NOTE_HUES = ["yellow", "blue", "green", "pink", "purple", "orange"];
const CANVAS_W = 2400;
const CANVAS_H = 1600;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2;

type DragRef = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
} | null;

function bgStyle(background: string): React.CSSProperties {
  if (background === "grid") {
    return {
      backgroundImage:
        "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
      backgroundSize: "24px 24px",
    };
  }
  if (background === "plain") return {};
  return {
    backgroundImage: "radial-gradient(var(--border) 1.2px, transparent 1.2px)",
    backgroundSize: "24px 24px",
  };
}

export function BoardCanvas({
  boardId,
  items,
  setItems,
  background,
  onDropFiles,
}: {
  boardId: string;
  items: BoardItemView[];
  setItems: React.Dispatch<React.SetStateAction<BoardItemView[]>>;
  background: string;
  onDropFiles: (files: FileList, x: number, y: number) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [dropActive, setDropActive] = useState(false);
  const drag = useRef<DragRef>(null);
  const scaleRef = useRef(1);
  const contentRef = useRef<HTMLDivElement>(null);
  scaleRef.current = scale;

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const s = scaleRef.current;
      const dx = (e.clientX - d.startX) / s;
      const dy = (e.clientY - d.startY) / s;
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== d.id) return it;
          if (d.mode === "move") {
            return { ...it, x: Math.max(0, d.origX + dx), y: Math.max(0, d.origY + dy) };
          }
          return {
            ...it,
            w: Math.max(80, d.origW + dx),
            h: Math.max(60, d.origH + dy),
          };
        })
      );
    }
    function onUp() {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      setItems((prev) => {
        const cur = prev.find((x) => x.id === d.id);
        if (cur) {
          if (d.mode === "move") void moveItem(cur.id, cur.x, cur.y);
          else void resizeItem(cur.id, cur.w, cur.h);
        }
        return prev;
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [setItems]);

  function zoomBy(delta: number) {
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2))));
  }

  function onWheel(e: React.WheelEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoomBy(e.deltaY > 0 ? -0.1 : 0.1);
  }

  function canvasCoords(clientX: number, clientY: number) {
    const rect = contentRef.current?.getBoundingClientRect();
    const s = scaleRef.current;
    if (!rect) return { x: 60, y: 60 };
    return {
      x: Math.max(0, (clientX - rect.left) / s),
      y: Math.max(0, (clientY - rect.top) / s),
    };
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropActive(false);
    if (e.dataTransfer.files?.length) {
      const { x, y } = canvasCoords(e.clientX, e.clientY);
      onDropFiles(e.dataTransfer.files, Math.round(x), Math.round(y));
    }
  }

  function startMove(e: React.PointerEvent, it: BoardItemView) {
    const target = e.target as HTMLElement;
    if (target.dataset.resize || target.tagName === "TEXTAREA") return;
    setSelected(it.id);
    drag.current = {
      id: it.id,
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      origX: it.x,
      origY: it.y,
      origW: it.w,
      origH: it.h,
    };
    setItems((prev) => {
      const maxZ = Math.max(0, ...prev.map((p) => p.z));
      return prev.map((p) => (p.id === it.id ? { ...p, z: maxZ + 1 } : p));
    });
    void bringToFront(it.id, boardId);
  }

  function startResize(e: React.PointerEvent, it: BoardItemView) {
    e.stopPropagation();
    setSelected(it.id);
    drag.current = {
      id: it.id,
      mode: "resize",
      startX: e.clientX,
      startY: e.clientY,
      origX: it.x,
      origY: it.y,
      origW: it.w,
      origH: it.h,
    };
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setSelected(null);
    void deleteItem(id);
  }
  function editNote(id: string, text: string) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));
  }
  function persistNote(it: BoardItemView) {
    void updateNote(it.id, it.text ?? "", it.hue ?? "yellow");
  }
  function setNoteHue(it: BoardItemView, hue: string) {
    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, hue } : p)));
    void updateNote(it.id, it.text ?? "", hue);
  }

  const zoomBtn =
    "grid h-7 w-7 place-items-center rounded-[8px] text-text-muted transition hover:bg-surface-2 hover:text-text";

  return (
    <div className="relative h-full w-full">
      <div
        className={`h-full w-full overflow-auto rounded-[14px] border bg-surface transition-colors ${
          dropActive ? "border-accent" : "border-border"
        }`}
        onWheel={onWheel}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dropActive) setDropActive(true);
        }}
        onDragLeave={(e) => {
          if (e.target === e.currentTarget) setDropActive(false);
        }}
        onDrop={onDrop}
      >
        {/* Sizer drives the scroll area at the current zoom. */}
        <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
          <div
            ref={contentRef}
            className="relative"
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
              ...bgStyle(background),
            }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setSelected(null);
            }}
          >
            {items.map((it) => {
              const isSel = selected === it.id;
              const common: React.CSSProperties = {
                position: "absolute",
                left: it.x,
                top: it.y,
                width: it.w,
                height: it.h,
                zIndex: it.z,
              };
              const ring = isSel
                ? "0 0 0 2px var(--accent)"
                : "0 1px 3px rgba(0,0,0,.12)";

              if (it.kind === "note") {
                const hue = it.hue ?? "yellow";
                return (
                  <div
                    key={it.id}
                    style={{ ...common, backgroundColor: `var(--h-${hue}-bg)`, boxShadow: ring }}
                    className="group flex flex-col overflow-hidden rounded-[10px]"
                  >
                    {/* Drag handle / toolbar (the textarea can't be dragged) */}
                    <div
                      className="flex h-6 shrink-0 cursor-move items-center justify-between px-1.5"
                      style={{ color: `var(--h-${hue})`, touchAction: "none" }}
                      onPointerDown={(e) => startMove(e, it)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden opacity="0.7">
                        <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
                        <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
                        <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
                      </svg>
                      {isSel && (
                        <span className="flex items-center gap-1">
                          {NOTE_HUES.map((h) => (
                            <button
                              key={h}
                              onClick={() => setNoteHue(it, h)}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                              style={{ backgroundColor: `var(--h-${h})` }}
                              aria-label={`Color ${h}`}
                            />
                          ))}
                          <button
                            onClick={() => remove(it.id)}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="ml-0.5 grid h-4 w-4 place-items-center rounded-[5px] text-red hover:bg-red-bg"
                            aria-label="Delete note"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      )}
                    </div>
                    <textarea
                      value={it.text ?? ""}
                      onChange={(e) => editNote(it.id, e.target.value)}
                      onBlur={() => persistNote(it)}
                      onFocus={() => setSelected(it.id)}
                      placeholder="Note..."
                      className="w-full flex-1 resize-none bg-transparent px-2 pb-2 text-sm outline-none"
                      style={{ color: `var(--h-${hue})` }}
                    />
                    <span
                      data-resize="1"
                      onPointerDown={(e) => startResize(e, it)}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                      style={{ touchAction: "none" }}
                    />
                  </div>
                );
              }

              const isImage =
                it.signedUrl &&
                (it.mimeType?.startsWith("image/") ||
                  /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(it.name ?? ""));

              return (
                <div
                  key={it.id}
                  style={{ ...common, boxShadow: ring }}
                  className="group overflow-hidden rounded-[10px] bg-surface"
                  onPointerDown={(e) => startMove(e, it)}
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.signedUrl!}
                      alt={it.name ?? ""}
                      draggable={false}
                      className="h-full w-full select-none object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-text-muted">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                      <span className="line-clamp-2 text-xs font-semibold">
                        {it.name ?? "File"}
                      </span>
                      {it.signedUrl && (
                        <a
                          href={it.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-accent hover:underline"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          Open
                        </a>
                      )}
                    </div>
                  )}
                  {isSel && (
                    <button
                      onClick={() => remove(it.id)}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-[7px] bg-black/55 text-white transition hover:bg-red"
                      aria-label="Delete"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <span
                    data-resize="1"
                    onPointerDown={(e) => startResize(e, it)}
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                    style={{ touchAction: "none" }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-[10px] border border-border bg-surface/95 p-1 shadow-sm backdrop-blur">
        <button className={zoomBtn} onClick={() => zoomBy(-0.1)} aria-label="Zoom out">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button
          className="min-w-[3rem] rounded-[8px] px-1 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
          onClick={() => setScale(1)}
          title="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        <button className={zoomBtn} onClick={() => zoomBy(0.1)} aria-label="Zoom in">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {dropActive && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[14px] bg-accent-soft/40">
          <span className="rounded-pill bg-surface px-4 py-2 text-sm font-semibold text-accent shadow">
            Drop images to add
          </span>
        </div>
      )}
    </div>
  );
}
