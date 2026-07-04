"use client";

import { useEffect, useRef, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { StatusTag } from "@/components/status-tag";
import {
  addReviewComment,
  setVersionApproval,
  type ReviewState,
} from "@/app/(app)/projects/[id]/review-actions";
import { summarizeReview, type VersionRow } from "@/components/projects/asset-types";
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
    // Clicking your current decision again retracts it.
    const next = mine === status ? "pending" : status;
    start(() => setVersionApproval(projectId, version.id, next));
  }

  const comments = [...version.comments].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Review v${version.version_number} of ${assetName}`}
    >
      <div className="space-y-5">
        {/* Sign-off */}
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
          {version.approvals.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {version.approvals.map((a) => {
                const isClient = Boolean(a.reviewer_name) && !a.reviewer_user_id;
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-1.5 text-text-muted">
                      {isClient
                        ? a.reviewer_name
                        : a.reviewer_user_id === currentUserId
                          ? "You"
                          : "Team member"}
                      {isClient && (
                        <span className="rounded-pill bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">
                          Client
                        </span>
                      )}
                    </span>
                    <StatusTag
                      hue={a.status === "approved" ? "green" : "red"}
                      dot={false}
                    >
                      {a.status === "approved" ? "Approved" : "Changes requested"}
                    </StatusTag>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Comments */}
        <div className="border-t border-border pt-4">
          <span className="text-xs font-bold uppercase tracking-wide text-text-faint">
            Comments
          </span>
          {comments.length > 0 ? (
            <ol className="mt-3 space-y-3">
              {comments.map((c) => {
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
      </div>
    </Modal>
  );
}
