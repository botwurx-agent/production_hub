"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PinCanvas } from "@/components/review/pin-canvas";
import { DocSurfaceView } from "@/components/review/doc-surface";
import { ShareDocButton } from "@/components/review/share-doc-button";
import {
  getDocReviewDetail,
  addDocReviewCommentAt,
  resolveDocReviewComment,
  setDocApproval,
} from "@/app/(app)/projects/[id]/doc-review-actions";
import type { DocReviewDetail } from "@/lib/doc-review-data";
import type { ApprovalStatus } from "@/lib/database.types";

type DocKind = "shot_list" | "storyboard" | "moodboard";

const HUE: Record<DocKind, string> = {
  shot_list: "purple",
  storyboard: "indigo",
  moodboard: "cyan",
};
const LABEL: Record<DocKind, string> = {
  shot_list: "Shot list",
  storyboard: "Storyboard",
  moodboard: "Moodboard",
};

// Full-page internal review of a doc: the same pin canvas the client sees (large),
// the comment stream, and the team greenlight. Reached from the doc page's
// "Comments" button.
export function DocReviewView({
  projectId,
  projectTitle,
  kind,
  targetId,
  backHref,
  backLabel,
  initialDetail,
}: {
  projectId: string;
  projectTitle: string;
  kind: DocKind;
  targetId: string;
  backHref: string;
  backLabel: string;
  initialDetail: DocReviewDetail;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<DocReviewDetail>(initialDetail);
  const [busy, start] = useTransition();

  const reload = useCallback(async () => {
    const d = await getDocReviewDetail(kind, targetId);
    if (d) setDetail(d);
  }, [kind, targetId]);

  async function post(text: string, pin: { x: number; y: number } | null): Promise<boolean> {
    const res = await addDocReviewCommentAt(projectId, kind, targetId, text, pin, null);
    if (res?.error) return false;
    await reload();
    router.refresh();
    return true;
  }

  function resolve(id: string, resolved: boolean) {
    start(async () => {
      await resolveDocReviewComment(projectId, id, resolved);
      await reload();
      router.refresh();
    });
  }

  function signOff(status: ApprovalStatus) {
    start(async () => {
      await setDocApproval(projectId, kind, targetId, status);
      await reload();
      router.refresh();
    });
  }

  const decided = detail.myDecision;
  const clientCount = detail.comments.filter((c) => c.isClient).length;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted transition hover:text-text"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to {backLabel}
      </Link>

      <div className="mb-5 overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, var(--h-${HUE[kind]}), var(--h-cyan))` }}
        />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              {projectTitle} · {LABEL[kind]} comments
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-text">
              {detail.docTitle}
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {detail.comments.length === 0
                ? "No comments yet. Click the document to drop a pin and start."
                : `${detail.comments.length} ${detail.comments.length === 1 ? "comment" : "comments"}` +
                  (clientCount > 0 ? ` · ${clientCount} from client` : "")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareDocButton projectId={projectId} kind={kind} targetId={targetId} label="Share" />
          </div>
        </div>
      </div>

      <PinCanvas
        stage={<DocSurfaceView surface={detail.surface} />}
        stageBg="var(--surface-2)"
        fit="full"
        comments={detail.comments}
        emptyHint="Click anywhere on the document to drop a pin and start."
        onPost={(text, pin) => post(text, pin)}
        onResolve={resolve}
      />

      <div className="mt-5 rounded-[14px] border border-border bg-surface-2/40 p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">
          Your internal sign-off
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => signOff(decided === "approved" ? "pending" : "approved")}
            disabled={busy}
            className={`flex-1 rounded-[12px] border px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
              decided === "approved"
                ? "border-green bg-green-bg text-green"
                : "border-border-strong text-text-muted hover:border-green hover:text-green"
            }`}
          >
            {decided === "approved" ? "You approved · undo" : "Approve (greenlight)"}
          </button>
          <button
            onClick={() =>
              signOff(decided === "changes_requested" ? "pending" : "changes_requested")
            }
            disabled={busy}
            className={`flex-1 rounded-[12px] border px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
              decided === "changes_requested"
                ? "border-red bg-red-bg text-red"
                : "border-border-strong text-text-muted hover:border-red hover:text-red"
            }`}
          >
            {decided === "changes_requested" ? "You requested changes · undo" : "Request changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
