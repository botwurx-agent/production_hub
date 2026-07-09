"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AiShotReviewCanvas,
  type ShotAnchor,
} from "@/components/review/ai-shot-review-canvas";
import { ShareDocButton } from "@/components/review/share-doc-button";
import {
  getDocReviewDetail,
  addDocReviewCommentAt,
  resolveDocReviewComment,
  setDocApproval,
} from "@/app/(app)/projects/[id]/doc-review-actions";
import type { DocReviewDetail } from "@/lib/doc-review-data";
import type { ApprovalStatus } from "@/lib/database.types";
import type { DocSurface } from "@/lib/review-links";

type AiShotSurface = Extract<DocSurface, { kind: "ai_shot" }>;

// Full-page internal review of one AI shot: big media stage (timecode scrubber
// for a take, pins for the frames), a clear "what's in this review" summary, the
// team greenlight, and the client share link. Reached from the Review page and
// the pipeline's "In review" chip.
export function ShotReviewView({
  projectId,
  projectTitle,
  shotId,
  initialDetail,
}: {
  projectId: string;
  projectTitle: string;
  shotId: string;
  initialDetail: DocReviewDetail;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<DocReviewDetail>(initialDetail);
  const [busy, start] = useTransition();

  const reload = useCallback(async () => {
    const d = await getDocReviewDetail("ai_shot", shotId);
    if (d) setDetail(d);
  }, [shotId]);

  async function post(text: string, anchor: ShotAnchor): Promise<boolean> {
    const res = await addDocReviewCommentAt(
      projectId,
      "ai_shot",
      shotId,
      text,
      anchor.pin ?? null,
      anchor.timecode ?? null
    );
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
      await setDocApproval(projectId, "ai_shot", shotId, status);
      await reload();
      router.refresh();
    });
  }

  // The surface for an in-review shot is always ai_shot; narrow it for the summary.
  const surface =
    detail.surface.kind === "ai_shot" ? (detail.surface as AiShotSurface) : null;
  const decided = detail.myDecision;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/projects/${projectId}/review`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted transition hover:text-text"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to review
      </Link>

      <div className="mb-5 overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
        <div
          className="h-1 w-full"
          style={{ background: "linear-gradient(90deg, var(--h-purple), var(--h-cyan))" }}
        />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              {projectTitle} · AI shot review
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-text">
              {detail.docTitle}
            </h1>
            {surface && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">
                  In this review:
                </span>
                <IncludeChip label="Start frame" present={surface.frames.some((f) => f.role === "start")} hue="cyan" />
                <IncludeChip label="End frame" present={surface.frames.some((f) => f.role === "end")} hue="pink" />
                <IncludeChip label="Take" present={Boolean(surface.take)} hue="green" />
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareDocButton projectId={projectId} kind="ai_shot" targetId={shotId} />
          </div>
        </div>
      </div>

      {surface ? (
        <AiShotReviewCanvas
          surface={surface}
          comments={detail.comments}
          onPost={post}
          onResolve={resolve}
        />
      ) : (
        <p className="py-16 text-center text-sm text-text-faint">
          This shot is no longer available for review.
        </p>
      )}

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

function IncludeChip({
  label,
  present,
  hue,
}: {
  label: string;
  present: boolean;
  hue: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-bold"
      style={
        present
          ? { backgroundColor: `var(--h-${hue}-bg)`, color: `var(--h-${hue})` }
          : { backgroundColor: "var(--surface-2)", color: "var(--text-faint)" }
      }
    >
      {present ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <span className="text-[13px] leading-none">·</span>
      )}
      {label}
      {!present && <span className="font-normal opacity-70">not picked</span>}
    </span>
  );
}
