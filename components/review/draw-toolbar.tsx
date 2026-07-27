"use client";

import { DRAW_COLORS, type Drawing, type DrawTool } from "@/lib/review-drawing";

// The markup palette, shared by the video canvas and the pin canvas so the two
// never drift. Tools are ordered the way a reviewer reaches for them: point at
// it, connect it, box it, circle it, scribble on it.
const TOOLS: { key: DrawTool; label: string; icon: JSX.Element }[] = [
  {
    key: "arrow",
    label: "Arrow",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7" />
        <path d="M9 7h8v8" />
      </svg>
    ),
  },
  {
    key: "line",
    label: "Line",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M5 19 19 5" />
      </svg>
    ),
  },
  {
    key: "rect",
    label: "Rectangle",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <rect x="4" y="6" width="16" height="12" rx="1.5" />
      </svg>
    ),
  },
  {
    key: "ellipse",
    label: "Ellipse",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="12" rx="8" ry="6.5" />
      </svg>
    ),
  },
  {
    key: "pen",
    label: "Freehand",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      </svg>
    ),
  },
];

export function DrawToolbar({
  tool,
  onTool,
  color,
  onColor,
  draft,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onCancel,
  hint,
}: {
  tool: DrawTool;
  onTool: (t: DrawTool) => void;
  color: string;
  onColor: (c: string) => void;
  draft: Drawing | null;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onCancel: () => void;
  hint: string;
}) {
  const iconBtn =
    "grid h-7 w-7 place-items-center rounded-[7px] text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-30";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[12px] border border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-0.5">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTool(t.key)}
            title={t.label}
            aria-label={t.label}
            className={`grid h-7 w-7 place-items-center rounded-[7px] transition ${
              tool === t.key
                ? "bg-accent-soft text-accent"
                : "text-text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <span className="h-5 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        {DRAW_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onColor(c)}
            aria-label={`Pen colour ${c}`}
            className={`h-5 w-5 rounded-full border-2 transition ${
              color === c ? "scale-110 border-text" : "border-border hover:scale-105"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <span className="h-5 w-px bg-border" />

      <button
        onClick={onUndo}
        disabled={!draft?.strokes.length}
        title="Undo"
        aria-label="Undo"
        className={iconBtn}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h11a5 5 0 0 1 0 10H9" />
        </svg>
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo"
        aria-label="Redo"
        className={iconBtn}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9a5 5 0 0 0 0 10h6" />
        </svg>
      </button>

      <span className="flex-1" />

      <button
        onClick={onClear}
        disabled={!draft}
        className="text-xs font-semibold text-text-faint transition hover:text-text disabled:opacity-40"
      >
        Clear
      </button>
      <button
        onClick={onCancel}
        className="text-xs font-semibold text-text-faint transition hover:text-text"
      >
        Cancel
      </button>
      <span className="w-full text-xs text-text-muted sm:w-auto">{hint}</span>
    </div>
  );
}
