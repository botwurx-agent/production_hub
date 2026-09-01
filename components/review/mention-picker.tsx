"use client";

import { useMemo, useRef, useState } from "react";
import { AnchoredPopover } from "@/components/ui/anchored-popover";
import { IconTile } from "@/components/ui/icon-tile";
import {
  matchMentions,
  mentionSubtitle,
  mentionText,
  type MentionCandidate,
} from "@/lib/mentions";
import { CATEGORY_HUE } from "@/lib/crew-positions";
import { personInitials } from "@/lib/people";

/**
 * Pick someone off the project roster to notify.
 *
 * A PICKER, NOT PARSED TEXT, and that is the whole design. `contacts.role` is
 * free text, so one roster can hold "Prop Stylist", "Props" and "Set Dresser /
 * Props"; if the author typed freely and we matched afterwards, a near miss
 * would quietly notify nobody, which is the worst outcome for a note somebody
 * is relying on. Here the author sees exactly who they picked before they post.
 *
 * You search by ROLE as readily as by name, because on a commercial crew nobody
 * knows everyone's name but everyone knows the functions.
 */
export function MentionPicker({
  roster,
  onPick,
  disabled = false,
}: {
  roster: MentionCandidate[];
  onPick: (c: MentionCandidate) => void;
  disabled?: boolean;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const results = useMemo(() => matchMentions(q, roster), [q, roster]);

  if (roster.length === 0) return null;

  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        onClick={() => {
          setQ("");
          setOpen((v) => !v);
        }}
        title="Mention someone on this job"
        className="grid h-7 w-7 place-items-center rounded-[7px] text-[15px] font-bold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40"
      >
        @
      </button>
      <AnchoredPopover
        anchorRef={btn}
        open={open}
        onClose={() => setOpen(false)}
        width={280}
      >
        <div className="p-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or role, e.g. prop stylist"
            className="w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-text-faint focus:border-accent"
          />
          <div className="mt-1.5 max-h-64 overflow-auto">
            {results.length === 0 ? (
              <p className="px-1 py-3 text-center text-xs text-text-faint">
                Nobody on the roster matches that.
              </p>
            ) : (
              results.map((c) => {
                const sub = mentionSubtitle(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onPick(c);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-[8px] px-1.5 py-1.5 text-left transition hover:bg-surface-2"
                  >
                    <IconTile hue={CATEGORY_HUE[c.type ?? "crew"] ?? "blue"} size="sm">
                      <span className="text-[10px] font-bold">
                        {personInitials(c.name)}
                      </span>
                    </IconTile>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-text">
                        {c.name}
                      </span>
                      {sub && (
                        <span className="block truncate text-[11px] text-text-muted">
                          {sub}
                        </span>
                      )}
                    </span>
                    {/* Says HOW they will be reached, before you commit to it.
                        Someone with no account and no email cannot be told at
                        all, and finding that out after posting is too late. */}
                    <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-wide text-text-faint">
                      {c.userId ? "In app" : c.email ? "Email" : "No contact"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </AnchoredPopover>
    </>
  );
}

/** The chips under a composer showing who this comment will notify. */
export function MentionChips({
  picked,
  onRemove,
}: {
  picked: MentionCandidate[];
  onRemove: (id: string) => void;
}) {
  if (picked.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-text-faint">
        Notifies
      </span>
      {picked.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 rounded-pill border border-accent bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent"
        >
          {c.name}
          <button
            type="button"
            onClick={() => onRemove(c.id)}
            className="opacity-60 transition hover:opacity-100"
            aria-label={`Remove ${c.name}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export { mentionText };
