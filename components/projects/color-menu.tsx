"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { updateProjectColor } from "@/app/(app)/projects/actions";
import { PROJECT_COLORS } from "@/lib/status";

const POP_W = 200;

// Quick per-project color picker on a project card. A small dot that opens a
// swatch popover (portalled to the body so no card/column overflow clips it).
export function ColorMenu({
  projectId,
  color,
}: {
  projectId: string;
  color: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [pending, start] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.right - POP_W, window.innerWidth - POP_W - 8));
    setPos({ top: r.bottom + 6, left });
  }

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onScrollResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open]);

  function pick(next: string | null) {
    setOpen(false);
    start(() => updateProjectColor(projectId, next));
  }

  const swatch =
    "grid h-7 w-7 place-items-center rounded-[8px] ring-1 ring-black/10 transition hover:scale-105";

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Set project color"
        title="Set project color"
        className={`grid h-6 w-6 place-items-center rounded-full border border-border transition hover:scale-110 ${
          pending ? "opacity-50" : ""
        }`}
        style={{ backgroundColor: color ? `var(--h-${color}-bg)` : "var(--surface-2)" }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color ? `var(--h-${color})` : "var(--text-faint)" }}
        />
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: POP_W, zIndex: 60 }}
            className="rounded-[12px] border border-border bg-surface p-2 shadow-lg"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">
              Project color
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {PROJECT_COLORS.map((h) => (
                <button
                  key={h}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pick(h);
                  }}
                  aria-label={h}
                  className={swatch}
                  style={{
                    backgroundColor: `var(--h-${h}-bg)`,
                    boxShadow: color === h ? "0 0 0 2px var(--accent)" : undefined,
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `var(--h-${h})` }} />
                </button>
              ))}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pick(null);
                }}
                aria-label="No color"
                title="No color"
                className={swatch}
                style={{
                  backgroundColor: "var(--surface-2)",
                  boxShadow: !color ? "0 0 0 2px var(--accent)" : undefined,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
