"use client";

import { useRef, useState } from "react";
import { AnchoredPopover } from "@/components/ui/anchored-popover";

// Small emoji palette for review comments. Deliberately a curated set rather
// than a full picker library: feedback on a cut needs reaction and tone, not
// 3,000 glyphs, and this ships no dependency to the public portal.
const GROUPS: { label: string; emoji: string[] }[] = [
  {
    label: "Reactions",
    emoji: ["👍", "👎", "🙌", "👏", "🔥", "💯", "✅", "❌", "❤️", "🎉"],
  },
  {
    label: "Tone",
    emoji: ["😀", "😅", "😍", "🤔", "😬", "😕", "🙏", "😴", "🤯", "👀"],
  },
  {
    label: "Notes",
    emoji: ["⚠️", "❓", "❗", "⭐", "📌", "✂️", "⏱️", "🔊", "🔇", "🎬"],
  },
];

export function EmojiPicker({
  onPick,
  className = "",
}: {
  onPick: (emoji: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Add an emoji"
        aria-label="Add an emoji"
        className={`inline-flex items-center transition ${
          open ? "text-accent" : "text-text-muted hover:text-text"
        } ${className}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
          <path d="M9 9h.01M15 9h.01" />
        </svg>
      </button>

      <AnchoredPopover
        anchorRef={btnRef}
        open={open}
        onClose={() => setOpen(false)}
        width={248}
      >
        {GROUPS.map((g) => (
          <div key={g.label} className="mb-1.5 last:mb-0">
            <p className="px-0.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">
              {g.label}
            </p>
            <div className="grid grid-cols-10 gap-0.5">
              {g.emoji.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onPick(e);
                    setOpen(false);
                  }}
                  className="grid h-[21px] w-[21px] place-items-center rounded-[6px] text-[14px] leading-none transition hover:bg-surface-2"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </AnchoredPopover>
    </>
  );
}
