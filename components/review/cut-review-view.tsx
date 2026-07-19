"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusTag } from "@/components/status-tag";
import { PinReview } from "@/components/review/pin-review";
import { VideoReview } from "@/components/review/video-review";
import { ShareReviewButton } from "@/components/projects/share-review-button";
import { viewerKind } from "@/lib/file-kind";
import { timeAgo } from "@/lib/format";
import {
  addReviewCommentAt,
  resolveReviewComment,
  setVersionApproval,
} from "@/app/(app)/projects/[id]/review-actions";
import {
  summarizeReview,
  type AssetWithVersions,
  type VersionComment,
} from "@/components/projects/asset-types";
import type { PortalComment } from "@/lib/review-links";
import type { ApprovalStatus } from "@/lib/database.types";

// Full-page internal review of one master-cut version: big video with the
// timecode scrubber (or pins for a still), the comment rail beside it with room
// to breathe, the team greenlight, and the client share link. The deliverable
// gets the same treatment as an AI shot, not a cramped modal.
export function CutReviewView({
  projectId,
  projectTitle,
  cut,
  activeVersionId,
  reviewToken,
  reviewLinkId,
  currentUserId,
}: {
  projectId: string;
  projectTitle: string;
  cut: AssetWithVersions;
  activeVersionId: string;
  reviewToken: string | null;
  reviewLinkId: string | null;
  currentUserId: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();

  const version = cut.versions.find((v) => v.id === activeVersionId) ?? cut.versions[0];
  const summary = summarizeReview(version.approvals);
  const mine = version.approvals.find((a) => a.reviewer_user_id === currentUserId)?.status;

  const kind = viewerKind(version.mime_type, cut.name);
  const isImage = kind === "image" && Boolean(version.signedUrl);
  const isVideo = kind === "video" && Boolean(version.signedUrl);

  function toPortal(c: VersionComment): PortalComment {
    const isClient = Boolean(c.reviewer_name) && !c.author_id;
    return {
      id: c.id,
      version_id: version.id,
      body: c.body,
      created_at: c.created_at,
      author: isClient
        ? c.reviewer_name ?? "Client"
        : c.author_id === currentUserId
          ? "You"
          : "Team member",
      isClient,
      pinNumber: c.pin_number,
      x: c.pos_x,
      y: c.pos_y,
      timecode: c.timecode,
      resolved: Boolean(c.resolved_at),
    };
  }
  const portalComments = version.comments.map(toPortal);

  async function postPinned(text: string, pin: { x: number; y: number } | null): Promise<boolean> {
    const res = await addReviewCommentAt(projectId, version.id, text, pin, null);
    if (res?.error) return false;
    router.refresh();
    return true;
  }
  async function postTimed(text: string, timecode: number): Promise<boolean> {
    const res = await addReviewCommentAt(projectId, version.id, text, null, timecode);
    if (res?.error) return false;
    router.refresh();
    return true;
  }
  function resolve(id: string, resolved: boolean) {
    start(async () => {
      await resolveReviewComment(projectId, id, resolved);
      router.refresh();
    });
  }
  function decide(status: ApprovalStatus) {
    const next = mine === status ? "pending" : status;
    start(async () => {
      await setVersionApproval(projectId, version.id, next);
      router.refresh();
    });
  }

  const flatComments = [...version.comments].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/projects/${projectId}/pipeline`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted transition hover:text-text"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to pipeline
      </Link>

      <div className="mb-5 overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, var(--h-green), var(--h-cyan))" }} />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              {projectTitle} · Master cut review
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-text">
                Version {version.version_number}
              </h1>
              <StatusTag hue={summary.hue}>{summary.label}</StatusTag>
            </div>
            <p className="mt-1 text-xs text-text-faint">
              Added {timeAgo(version.created_at)}
              {version.notes ? <span className="text-text-muted"> · {version.notes}</span> : null}
            </p>
            {cut.versions.length > 1 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">Versions:</span>
                {cut.versions.map((v) => (
                  <Link
                    key={v.id}
                    href={`/projects/${projectId}/review/cut/${v.id}`}
                    className={`rounded-[7px] px-2 py-1 text-xs font-bold transition ${
                      v.id === version.id
                        ? "bg-accent text-accent-fg"
                        : "bg-surface-2 text-text-muted hover:text-text"
                    }`}
                  >
                    v{v.version_number}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareReviewButton projectId={projectId} assetId={cut.id} initialToken={reviewToken} linkId={reviewLinkId} />
          </div>
        </div>
      </div>

      {isImage ? (
        <PinReview
          imageUrl={version.signedUrl as string}
          alt={cut.name}
          comments={portalComments}
          onPost={postPinned}
          onResolve={resolve}
        />
      ) : isVideo ? (
        <VideoReview
          videoUrl={version.signedUrl as string}
          comments={portalComments}
          onPost={postTimed}
          onResolve={resolve}
        />
      ) : (
        <div className="rounded-[14px] border border-border bg-surface p-5">
          <span className="text-xs font-bold uppercase tracking-wide text-text-faint">Comments</span>
          {flatComments.length > 0 ? (
            <ol className="mt-3 space-y-3">
              {flatComments.map((c) => {
                const isClient = Boolean(c.reviewer_name) && !c.author_id;
                return (
                  <li key={c.id}>
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-xs font-semibold text-text">
                        {isClient ? c.reviewer_name : c.author_id === currentUserId ? "You" : "Team member"}
                      </span>
                      <span className="text-xs text-text-faint">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-text-muted">{c.body}</p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-text-faint">No preview for this file type. Open the original to review.</p>
          )}
        </div>
      )}

      <div className="mt-5 rounded-[14px] border border-border bg-surface-2/40 p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">Your internal sign-off</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => decide("approved")}
            disabled={busy}
            className={`flex-1 rounded-[12px] border px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
              mine === "approved"
                ? "border-green bg-green-bg text-green"
                : "border-border-strong text-text-muted hover:border-green hover:text-green"
            }`}
          >
            {mine === "approved" ? "You approved · undo" : "Approve (greenlight)"}
          </button>
          <button
            onClick={() => decide("changes_requested")}
            disabled={busy}
            className={`flex-1 rounded-[12px] border px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
              mine === "changes_requested"
                ? "border-red bg-red-bg text-red"
                : "border-border-strong text-text-muted hover:border-red hover:text-red"
            }`}
          >
            {mine === "changes_requested" ? "You requested changes · undo" : "Request changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
