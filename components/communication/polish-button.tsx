"use client";

import { useRef, useState, useTransition } from "react";
import { AnchoredPopover } from "@/components/ui/anchored-popover";
import { useAiEnabled } from "@/components/ai/ai-availability";
import { polishDraft } from "@/app/(app)/polish-actions";

// Rewrites whatever the producer has typed in a composer, in place. It is
// entirely opt-in: nothing runs until the button is pressed, and nothing is
// sent. The producer reads the result, edits it if they want, and presses send
// themselves, exactly as they would have without this.
//
// The rewrite is destructive, so the original is kept in state and offered back
// as Undo. Pressing the button should never feel like a gamble.

type Intent = "polish" | "shorten" | "warm" | "firm";

const OPTIONS: { intent: Intent; label: string; hint: string }[] = [
  { intent: "polish", label: "Polish", hint: "Tighten the wording, keep it all" },
  { intent: "shorten", label: "Shorten", hint: "Cut it to the essentials" },
  { intent: "warm", label: "Warm up", hint: "Friendlier, still professional" },
  { intent: "firm", label: "Firm up", hint: "Clearer and more direct" },
];

export function PolishButton({
  value,
  onChange,
  channel = "email",
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  channel?: "email" | "chat";
  className?: string;
}) {
  const aiEnabled = useAiEnabled();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The text before the rewrite, plus the rewrite itself. Undo only offers
  // itself while the box still holds exactly what the rewrite produced, so it
  // can never wipe out edits made afterwards or reappear over a fresh message
  // once the previous one has been sent.
  const [original, setOriginal] = useState<string | null>(null);
  const [polished, setPolished] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // No provider key on this deployment: the capability does not exist here, so
  // the control does not either.
  if (!aiEnabled) return null;

  const empty = !value.trim();

  function run(intent: Intent) {
    setOpen(false);
    setError(null);
    const before = value;
    start(async () => {
      const res = await polishDraft({ text: before, intent, channel });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOriginal(before);
      setPolished(res.text);
      onChange(res.text);
    });
  }

  function undo() {
    if (original === null) return;
    onChange(original);
    setOriginal(null);
    setPolished(null);
    setError(null);
  }

  const canUndo = original !== null && polished !== null && value === polished;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy || empty}
        title={empty ? "Write something first, then polish it" : undefined}
        className="inline-flex items-center gap-1 text-xs font-semibold text-accent transition hover:underline disabled:cursor-not-allowed disabled:text-text-faint disabled:no-underline"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 3.5 13.7 8.3 18.5 10 13.7 11.7 12 16.5 10.3 11.7 5.5 10 10.3 8.3 12 3.5Z" />
          <path d="M18 15.5 18.8 17.7 21 18.5 18.8 19.3 18 21.5 17.2 19.3 15 18.5 17.2 17.7 18 15.5Z" />
        </svg>
        {busy ? "Polishing..." : "Polish"}
      </button>

      {canUndo && !busy && (
        <button
          type="button"
          onClick={undo}
          className="text-xs font-semibold text-text-muted transition hover:text-text hover:underline"
        >
          Undo
        </button>
      )}

      {error && (
        <span className="text-xs font-medium text-red" role="alert">
          {error}
        </span>
      )}

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        width={232}
      >
        <ul className="space-y-0.5">
          {OPTIONS.map((o) => (
            <li key={o.intent}>
              <button
                type="button"
                onClick={() => run(o.intent)}
                className="block w-full rounded-[8px] px-2 py-1.5 text-left transition hover:bg-surface-2"
              >
                <span className="block text-xs font-semibold text-text">
                  {o.label}
                </span>
                <span className="block text-[11px] text-text-faint">
                  {o.hint}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-1 border-t border-border px-2 pt-1.5 text-[11px] text-text-faint">
          Rewrites your text here. Nothing is sent.
        </p>
      </AnchoredPopover>
    </div>
  );
}
