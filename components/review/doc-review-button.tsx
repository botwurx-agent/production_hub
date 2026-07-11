"use client";

import { useState } from "react";
import { DocReviewModal } from "@/components/review/doc-review-modal";

type DocKind = "shot_list" | "storyboard" | "moodboard" | "ai_shot";

// Opens the in-app review modal (pin canvas + reply + resolve + internal sign-off)
// straight from a doc page, so client feedback can be read and replied to inline.
// Shows the client-comment count as a badge when there is any.
export function DocReviewButton({
  projectId,
  kind,
  targetId,
  title,
  count = 0,
}: {
  projectId: string;
  kind: DocKind;
  targetId: string;
  title: string;
  count?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
        title="Review and reply to feedback"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Review &amp; reply
        {count > 0 && (
          <span
            className="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
            style={{ backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }}
          >
            {count}
          </span>
        )}
      </button>
      <DocReviewModal
        open={open}
        onClose={() => setOpen(false)}
        projectId={projectId}
        kind={kind}
        targetId={targetId}
        title={title}
      />
    </>
  );
}
