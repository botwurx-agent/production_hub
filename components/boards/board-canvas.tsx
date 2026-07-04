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

export function BoardCanvas({
  boardId,
  items,
  setItems,
}: {
  boardId: string;
  items: BoardItemView[];
  setItems: React.Dispatch<React.SetStateAction<BoardItemView[]>>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<DragRef>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
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
      // Persist the latest position/size from current state.
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

  function startMove(e: React.PointerEvent, it: BoardItemView) {
    // Ignore drags that start on the resize handle or a textarea.
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
    // Bring to front locally + persist.
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

  return (
    <div
      className="relative h-full w-full overflow-auto rounded-[14px] border border-border bg-surface-2/40"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setSelected(null);
      }}
      style={{
        backgroundImage:
          "radial-gradient(var(--border) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div className="relative" style={{ width: 2400, height: 1600 }}>
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
          const ring = isSel ? "0 0 0 2px var(--accent)" : "0 1px 3px rgba(0,0,0,.12)";

          if (it.kind === "note") {
            const hue = it.hue ?? "yellow";
            return (
              <div
                key={it.id}
                style={{
                  ...common,
                  backgroundColor: `var(--h-${hue}-bg)`,
                  boxShadow: ring,
                }}
                className="group rounded-[10px] p-2"
                onPointerDown={(e) => startMove(e, it)}
              >
                <textarea
                  value={it.text ?? ""}
                  onChange={(e) => editNote(it.id, e.target.value)}
                  onBlur={() => persistNote(it)}
                  placeholder="Note..."
                  className="h-full w-full resize-none bg-transparent text-sm outline-none"
                  style={{ color: `var(--h-${hue})` }}
                />
                {isSel && (
                  <div className="absolute -top-9 left-0 flex items-center gap-1 rounded-[9px] border border-border bg-surface p-1 shadow-sm">
                    {NOTE_HUES.map((h) => (
                      <button
                        key={h}
                        onClick={() => setNoteHue(it, h)}
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: `var(--h-${h})` }}
                        aria-label={`Color ${h}`}
                      />
                    ))}
                    <button
                      onClick={() => remove(it.id)}
                      className="ml-1 rounded-[6px] px-1.5 text-xs font-semibold text-red hover:bg-red-bg"
                    >
                      Delete
                    </button>
                  </div>
                )}
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
  );
}
