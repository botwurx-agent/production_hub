"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendDocToReview } from "@/app/(app)/projects/[id]/doc-review-actions";

type DocKind = "shot_list" | "storyboard" | "moodboard";

// Puts a doc into the internal review cycle so it shows on the Review page.
// Once in review, becomes a quiet "In review" chip that links there.
export function SendToReviewButton({
  projectId,
  kind,
  targetId,
  inReview,
}: {
  projectId: string;
  kind: DocKind;
  targetId: string;
  inReview: boolean;
}) {
  const router = useRouter();
  const [added, setAdded] = useState(inReview);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function send() {
    setError(null);
    start(async () => {
      const res = await sendDocToReview(projectId, kind, targetId);
      if (res?.error) setError(res.error);
      else {
        setAdded(true);
        router.refresh();
      }
    });
  }

  if (added) {
    return (
      <Link
        href={`/projects/${projectId}/review`}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
        title="Open the Review page"
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--h-pink)" }}
        />
        In review
        <span className="text-text-faint">·</span>
        <span className="text-accent">View</span>
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={send}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold text-accent-fg shadow-sm transition disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)" }}
        title="Send this document to Review & Approval"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3 8-8" />
          <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
        </svg>
        {busy ? "Sending..." : "Send to review"}
      </button>
      {error && <span className="text-xs font-medium text-red">{error}</span>}
    </span>
  );
}
