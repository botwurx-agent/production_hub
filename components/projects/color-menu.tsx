"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateProjectColor } from "@/app/(app)/projects/actions";
import { PROJECT_COLORS } from "@/lib/status";

// Quick per-project color picker on a project card. A small dot that opens a
// swatch popover; the color is a wayfinding accent, kept separate from status.
export function ColorMenu({
  projectId,
  color,
}: {
  projectId: string;
  color: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(next: string | null) {
    setOpen(false);
    start(() => updateProjectColor(projectId, next));
  }

  return (
    <div className="relative" ref={ref}>
      <button
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
      {open && (
        <div
          className="absolute right-0 top-8 z-30 w-[168px] rounded-[12px] border border-border bg-surface p-2 shadow-lg"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">
            Project color
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_COLORS.map((h) => (
              <button
                key={h}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pick(h);
                }}
                aria-label={h}
                className="grid h-7 w-7 place-items-center rounded-[8px] ring-1 ring-black/10 transition hover:scale-105"
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
              className="grid h-7 w-7 place-items-center rounded-[8px] ring-1 ring-black/10 transition hover:scale-105"
              style={{ backgroundColor: "var(--surface-2)", boxShadow: !color ? "0 0 0 2px var(--accent)" : undefined }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
