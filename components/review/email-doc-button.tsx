"use client";

import { useState } from "react";
import { SendDocEmailModal } from "@/components/production/send-doc-email-modal";
import { emailDocReviewLink } from "@/app/(app)/projects/[id]/share-actions";

type DocKind = "shot_list" | "storyboard" | "moodboard" | "ai_shot";

const NOUN: Record<DocKind, string> = {
  shot_list: "shot list",
  storyboard: "storyboard",
  moodboard: "moodboard",
  ai_shot: "shot",
};

// "Email" delivery for a doc surface: emails the client the /r review link,
// reusing the shared send-by-email modal. Renders nothing when email isn't
// configured, so the parent can drop it in unconditionally.
export function EmailDocButton({
  projectId,
  kind,
  targetId,
  studioName,
  enabled,
}: {
  projectId: string;
  kind: DocKind;
  targetId: string;
  studioName: string;
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  const noun = NOUN[kind];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
        title={`Email this ${noun} to the client`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 6L2 7" />
        </svg>
        Email
      </button>
      <SendDocEmailModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Email ${noun}`}
        defaultSubject={`${studioName} shared a ${noun} for review`}
        onSend={(input) => emailDocReviewLink(projectId, kind, targetId, input)}
      />
    </>
  );
}
