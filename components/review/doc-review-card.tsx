"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconTile } from "@/components/ui/icon-tile";
import { ShareDocButton } from "@/components/review/share-doc-button";
import { DocReviewModal } from "@/components/review/doc-review-modal";
import { removeDocFromReview } from "@/app/(app)/projects/[id]/doc-review-actions";
import type { DocReviewSummary } from "@/lib/doc-review-data";

const KIND: Record<
  DocReviewSummary["kind"],
  { label: string; hue: string; href: (p: string) => string; icon: React.ReactNode }
> = {
  shot_list: {
    label: "Shot list",
    hue: "purple",
    href: (p) => `/projects/${p}/shot-list`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 3v18" />
      </svg>
    ),
  },
  storyboard: {
    label: "Storyboard",
    hue: "indigo",
    href: (p) => `/projects/${p}/storyboards`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M2 9h20M8 4v5M16 4v5M8 20v-5M16 20v-5" />
      </svg>
    ),
  },
  moodboard: {
    label: "Moodboard",
    hue: "cyan",
    href: (p) => `/projects/${p}/moodboard`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
      </svg>
    ),
  },
  ai_shot: {
    label: "AI shot",
    hue: "purple",
    href: (p) => `/projects/${p}/pipeline`,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M9 4v16" />
        <circle cx="14.5" cy="14.5" r="2" />
      </svg>
    ),
  },
};

export function DocReviewCard({
  projectId,
  doc,
}: {
  projectId: string;
  doc: DocReviewSummary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const meta = KIND[doc.kind];
  // AI shots review on their own full page (big media); docs open in the modal.
  const isShot = doc.kind === "ai_shot";
  const reviewHref = `/projects/${projectId}/review/shot/${doc.targetId}`;

  const clientBadge =
    doc.clientDecision === "approved"
      ? { text: "Client approved", bg: "var(--green-bg)", fg: "var(--green)" }
      : doc.clientDecision === "changes_requested"
        ? { text: "Client: changes", bg: "var(--red-bg)", fg: "var(--red)" }
        : doc.shareToken
          ? { text: "Awaiting client", bg: "var(--h-amber-bg)", fg: "var(--h-amber)" }
          : null;

  function remove() {
    start(async () => {
      await removeDocFromReview(projectId, doc.kind, doc.targetId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <IconTile hue={meta.hue} size="md">
          {meta.icon}
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
              {meta.label}
            </span>
          </div>
          <Link
            href={meta.href(projectId)}
            className="block truncate font-display text-base font-bold text-text hover:text-accent"
          >
            {doc.title}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
        <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
          {doc.commentCount} {doc.commentCount === 1 ? "comment" : "comments"}
        </span>
        {doc.openCount > 0 && (
          <span
            className="rounded-pill px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }}
          >
            {doc.openCount} open
          </span>
        )}
        {doc.approvedBy > 0 && (
          <span
            className="rounded-pill px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: "var(--green-bg)", color: "var(--green)" }}
          >
            {doc.approvedBy} signed off
          </span>
        )}
        {clientBadge && (
          <span
            className="rounded-pill px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: clientBadge.bg, color: clientBadge.fg }}
          >
            {clientBadge.text}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border p-3">
        {isShot ? (
          <Link
            href={reviewHref}
            className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
          >
            Open review
          </Link>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
          >
            Review
          </button>
        )}
        <ShareDocButton projectId={projectId} kind={doc.kind} targetId={doc.targetId} />
        <button
          onClick={remove}
          disabled={busy}
          className="ml-auto text-xs font-semibold text-text-faint transition hover:text-red disabled:opacity-50"
          title="Remove from the review cycle"
        >
          Remove
        </button>
      </div>

      {!isShot && (
        <DocReviewModal
          open={open}
          onClose={() => setOpen(false)}
          projectId={projectId}
          kind={doc.kind}
          targetId={doc.targetId}
          title={doc.title}
        />
      )}
    </div>
  );
}
