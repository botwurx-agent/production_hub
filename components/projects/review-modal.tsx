"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { StatusTag } from "@/components/status-tag";
import { PinReview } from "@/components/review/pin-review";
import { VideoReview } from "@/components/review/video-review";
import { viewerKind } from "@/lib/file-kind";
import {
  addReviewComment,
  addReviewCommentAt,
  resolveReviewComment,
  setVersionApproval,
  type ReviewState,
} from "@/app/(app)/projects/[id]/review-actions";
import {
  summarizeReview,
  type VersionRow,
  type VersionComment,
} from "@/components/projects/asset-types";
import type { PortalComment } from "@/lib/review-links";
import { timeAgo } from "@/lib/format";

function CommentSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button size="sm" type="submit" disabled={pending}>
      {pending ? "Posting..." : "Comment"}
    </Button>
  );
}

export function ReviewModal({
  open,
  onClose,
  projectId,
  assetName,
  version,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  assetName: string;
  version: VersionRow;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const summary = summarizeReview(version.approvals);
  const mine = version.approvals.find(
    (a) => a.reviewer_user_id === currentUserId
  )?.status;

  const commentAction = addReviewComment.bind(null, projectId, version.id);
  const [state, action] = useFormState<ReviewState, FormData>(
    commentAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state === null) formRef.current?.reset();
  }, [state, version.comments.length]);

  function decide(status: "approved" | "changes_requested") {
    const next = mine === status ? "pending" : status;
    start(() => setVersionApproval(projectId, version.id, next));
  }

  const kind = viewerKind(version.mime_type, assetName);
  const isImage = kind === "image" && Boolean(version.signedUrl);
  const isVideo = kind === "video" && Boolean(version.signedUrl);

  // Map internal comments to the shared review-comment shape.
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

  async function postPinned(
    text: string,
    pin: { x: number; y: number } | null
  ): Promise<boolean> {
    const res = await addReviewCommentAt(projectId, version.id, text, pin, null);
    if (res?.error) return false;
    router.refresh();
    return true;
  }
  async function postTimed(text: string, timecode: number): Promise<boolean> {
    const res = await addReviewCommentAt(
      projectId,
      version.id,
      text,
      null,
      timecode
    );
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

  const flatComments = [...version.comments].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

  const signOff = (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-text-faint">
          Internal sign-off
        </span>
        <StatusTag hue={summary.hue}>{summary.label}</StatusTag>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => decide("approved")}
          disabled={pending}
          className={`flex-1 rounded-[11px] border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
            mine === "approved"
              ? "border-green bg-green-bg text-green"
              : "border-border-strong text-text-muted hover:border-green hover:text-green"
          }`}
        >
          {mine === "approved" ? "You approved" : "Approve"}
        </button>
        <button
          onClick={() => decide("changes_requested")}
          disabled={pending}
          className={`flex-1 rounded-[11px] border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
            mine === "changes_requested"
              ? "border-red bg-red-bg text-red"
              : "border-border-strong text-text-muted hover:border-red hover:text-red"
          }`}
        >
          {mine === "changes_requested" ? "Changes requested" : "Request changes"}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={isImage || isVideo ? "xl" : "md"}
      title={`Review v${version.version_number} of ${assetName}`}
    >
      <div className="space-y-5">
        {signOff}

        {isImage ? (
          <PinReview
            imageUrl={version.signedUrl as string}
            alt={assetName}
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
          <div className="border-t border-border pt-4">
            <span className="text-xs font-bold uppercase tracking-wide text-text-faint">
              Comments
            </span>
            {flatComments.length > 0 ? (
              <ol className="mt-3 space-y-3">
                {flatComments.map((c) => {
                  const isClient = Boolean(c.reviewer_name) && !c.author_id;
                  return (
                    <li key={c.id}>
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="text-xs font-semibold text-text">
                          {isClient
                            ? c.reviewer_name
                            : c.author_id === currentUserId
                              ? "You"
                              : "Team member"}
                        </span>
                        {isClient && (
                          <span className="rounded-pill bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">
                            Client
                          </span>
                        )}
                        <span className="text-xs text-text-faint">
                          {timeAgo(c.created_at)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-text-muted">
                        {c.body}
                      </p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-text-faint">
                No comments yet on this version.
              </p>
            )}

            <form ref={formRef} action={action} className="mt-4">
              <Textarea
                name="body"
                placeholder="Add a review comment..."
                className="min-h-[64px]"
              />
              {state?.error && (
                <p className="mt-1 text-xs font-medium text-red">{state.error}</p>
              )}
              <div className="mt-2 flex justify-end">
                <CommentSubmit />
              </div>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
}
