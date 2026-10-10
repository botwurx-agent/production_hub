"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRevisionRounds } from "@/app/(app)/projects/[id]/review-round-actions";
import { actionError } from "@/lib/action-result";
import { toast } from "@/components/ui/toast";
import {
  clientRoundsUsed,
  roundState,
  type RoundApproval,
  type RoundTone,
} from "@/lib/revision-rounds";

const OPTIONS = Array.from({ length: 11 }, (_, i) => i);

/**
 * "Client revision rounds: 2" on the Review page. Set once per job from the
 * SOW; every deliverable on the page is then counted against it.
 */
export function RevisionRoundsControl({
  projectId,
  rounds,
  canEdit,
}: {
  projectId: string;
  rounds: number | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<number | null>(rounds);
  const [busy, start] = useTransition();

  if (!canEdit) {
    if (rounds == null) return null;
    return (
      <p className="text-sm text-text-muted">
        {rounds} client revision {rounds === 1 ? "round" : "rounds"} included
      </p>
    );
  }

  function change(raw: string) {
    const prev = value;
    const next = raw === "" ? null : Number(raw);
    setValue(next);
    start(async () => {
      const res = await setRevisionRounds(projectId, raw);
      const err = actionError(res);
      if (err) {
        setValue(prev);
        toast(err, "error");
        return;
      }
      router.refresh();
    });
  }

  return (
    <label className="flex flex-col gap-1 sm:items-end">
      <span className="flex items-center gap-2">
        <span className="text-sm font-semibold text-text">Client revision rounds</span>
        <select
          value={value == null ? "" : String(value)}
          onChange={(e) => change(e.target.value)}
          disabled={busy}
          className="rounded-[9px] border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-accent disabled:opacity-60"
        >
          <option value="">Not tracked</option>
          {OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} per deliverable
            </option>
          ))}
        </select>
      </span>
      <span className="text-[12px] text-text-muted">
        As the SOW states. Each time the client requests changes uses one.
      </span>
    </label>
  );
}

const TONE_HUE: Record<RoundTone, string> = {
  ok: "var(--h-blue)",
  last: "var(--h-amber)",
  over: "var(--h-red)",
};

/**
 * One line on a deliverable: how many rounds the client has used. The words
 * stay in the text colour and the hue rides on the dot, because the hue's own
 * text on its tint is unreadable (measured, see the read banner).
 */
export function RoundsLine({
  versions,
  included,
}: {
  versions: { approvals: RoundApproval[] }[];
  included: number | null | undefined;
}) {
  const s = roundState(clientRoundsUsed(versions), included);
  if (!s) return null;
  return (
    <p
      className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-text"
      title={
        s.tone === "over"
          ? "The client has asked for more rounds than the SOW includes. Worth a change order."
          : undefined
      }
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: TONE_HUE[s.tone] }}
      />
      {s.label}
    </p>
  );
}
