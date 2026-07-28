"use client";

import { useRef, useState } from "react";
import { AnchoredPopover } from "@/components/ui/anchored-popover";
import { REACTIONS, type CommentReaction } from "@/lib/review-reactions";

// Reaction chips under a comment, plus the "add a reaction" picker. A chip
// shows the count and highlights when it is one of yours; clicking toggles.
// Reactions exist so a reviewer can agree with a note without adding another
// note, which is what makes a long review thread readable.
export function CommentReactions({
  reactions,
  onToggle,
  disabled = false,
}: {
  reactions: CommentReaction[];
  onToggle: (emoji: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onToggle(r.emoji);
          }}
          disabled={disabled}
          title={r.names.length ? r.names.join(", ") : undefined}
          className={`inline-flex items-center gap-1 rounded-pill border px-1.5 py-0.5 text-[11px] font-bold transition disabled:opacity-50 ${
            r.mine
              ? "border-accent bg-accent-soft text-accent"
              : "border-border text-text-muted hover:border-border-strong"
          }`}
        >
          <span className="text-[12px] leading-none">{r.emoji}</span>
          {r.count}
        </button>
      ))}

      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((v) => !v);
        }}
        disabled={disabled}
        title="Add a reaction"
        aria-label="Add a reaction"
        className="grid h-[22px] w-[22px] place-items-center rounded-pill border border-border text-text-faint transition hover:border-border-strong hover:text-text disabled:opacity-50"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
          <path d="M9 9h.01M15 9h.01" />
        </svg>
      </button>

      <AnchoredPopover
        anchorRef={btnRef}
        open={open}
        onClose={() => setOpen(false)}
        width={REACTIONS.length * 28 + 16}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex gap-0.5"
        >
          {REACTIONS.map((e) => (
            <button
              key={e}
              onClick={(ev) => {
                ev.stopPropagation();
                onToggle(e);
                setOpen(false);
              }}
              className="grid h-[24px] w-[24px] place-items-center rounded-[6px] text-[14px] leading-none transition hover:bg-surface-2"
            >
              {e}
            </button>
          ))}
        </div>
      </AnchoredPopover>
    </div>
  );
}
