"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmCard } from "@/app/(app)/agent-actions";
import { toast } from "@/components/ui/toast";

export type ClientCard = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  fields: { label: string; value: string }[];
  payload: Record<string, unknown>;
};

type State = "open" | "saving" | "done" | "cancelled";

/**
 * A proposed write, spelled out before it happens.
 *
 * The reason this is a card and not a sentence: if the assistant simply said
 * "I've logged that", the producer would have to go and check, which is the
 * same work they were trying to skip. Every value that will be written is on
 * screen, so the check takes two seconds and Create means create.
 */
export function ActionCard({ card }: { card: ClientCard }) {
  const router = useRouter();
  const [state, setState] = useState<State>("open");
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setState("saving");
    setError(null);
    const res = await confirmCard({ kind: card.kind, payload: card.payload });
    if ("error" in res) {
      setError(res.error);
      setState("open");
      return;
    }
    setState("done");
    toast(res.message, "success");
    // The page underneath is very often the one that just changed.
    router.refresh();
  }

  if (state === "cancelled") {
    return (
      <div className="rounded-[10px] border border-border px-3 py-2 text-xs text-text-faint">
        {card.title}: cancelled
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-border-strong bg-surface shadow-sm">
      <div className="border-b border-border bg-surface-2 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
          {state === "done" ? "Created" : "Confirm"}
        </p>
        <p className="text-sm font-semibold text-text">{card.title}</p>
        <p className="text-xs text-text-muted">{card.summary}</p>
      </div>

      <dl className="divide-y divide-border">
        {card.fields.map((f) => (
          <div key={f.label} className="flex gap-3 px-3 py-1.5">
            <dt className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-text-faint">
              {f.label}
            </dt>
            <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs text-text">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      {error ? (
        <p className="border-t border-border bg-red-bg px-3 py-2 text-xs text-red">
          {error}
        </p>
      ) : null}

      {state === "done" ? (
        <p className="border-t border-border px-3 py-2 text-xs text-green">
          Saved.
        </p>
      ) : (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={create}
            disabled={state === "saving"}
            className="rounded-[8px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg disabled:opacity-60"
          >
            {state === "saving" ? "Saving..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => setState("cancelled")}
            disabled={state === "saving"}
            className="rounded-[8px] px-2 py-1.5 text-xs font-medium text-text-muted hover:text-text"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
