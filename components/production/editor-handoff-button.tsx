"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/toast";
import {
  getOrCreateHandoff,
  revokeHandoff,
} from "@/app/(app)/projects/[id]/handoff-actions";

/**
 * "Send to editor": mint (or reuse) the live link that serves this project's
 * picked takes in cut order, and copy it.
 *
 * Sits next to Share for review because the two are the same gesture aimed at
 * different people, and separate because they are different jobs: the client
 * link collects a decision, this one collects nothing and hands over files.
 */
export function EditorHandoffButton({ projectId }: { projectId: string }) {
  const [busy, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);

  function make() {
    start(async () => {
      const res = await getOrCreateHandoff(projectId);
      if ("error" in res && res.error) {
        toast(res.error, "error");
        return;
      }
      if (!("token" in res) || !res.token) return;
      const link = `${window.location.origin}/h/${res.token}`;
      setUrl(link);
      try {
        await navigator.clipboard.writeText(link);
        toast("Editor link copied.", "success");
      } catch {
        toast("Link ready. Copy it below.", "info");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        onClick={make}
        disabled={busy}
        title="A no-login link that serves the picked takes, numbered in cut order"
        className="rounded-[8px] border border-border-strong px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {busy ? "Working..." : "Send to editor"}
      </button>

      {url && (
        <>
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-[210px] rounded-[8px] border border-border bg-surface px-2 py-1 font-mono text-[11px] text-text-muted outline-none"
          />
          <button
            onClick={() =>
              start(async () => {
                const res = await revokeHandoff(projectId);
                if (res?.error) toast(res.error, "error");
                else {
                  setUrl(null);
                  toast("Editor link turned off.", "success");
                }
              })
            }
            disabled={busy}
            className="text-[11px] font-semibold text-text-faint transition hover:text-red"
          >
            Turn off
          </button>
        </>
      )}
    </span>
  );
}
