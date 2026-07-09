"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { PinCanvas } from "@/components/review/pin-canvas";
import { DocSurfaceView } from "@/components/review/doc-surface";
import {
  AiShotReviewCanvas,
  type ShotAnchor,
} from "@/components/review/ai-shot-review-canvas";
import {
  getDocReviewDetail,
  addDocReviewCommentAt,
  resolveDocReviewComment,
  setDocApproval,
} from "@/app/(app)/projects/[id]/doc-review-actions";
import type { DocReviewDetail } from "@/lib/doc-review-data";
import type { ApprovalStatus } from "@/lib/database.types";

type DocKind = "shot_list" | "storyboard" | "moodboard" | "ai_shot";

// In-app internal review of a doc: the same pin canvas the client sees, plus a
// team sign-off (the greenlight before sharing with the client).
export function DocReviewModal({
  open,
  onClose,
  projectId,
  kind,
  targetId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  kind: DocKind;
  targetId: string;
  title: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<DocReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, start] = useTransition();

  const reload = useCallback(async () => {
    const d = await getDocReviewDetail(kind, targetId);
    setDetail(d);
  }, [kind, targetId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getDocReviewDetail(kind, targetId).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [open, kind, targetId]);

  async function post(text: string, anchor: ShotAnchor): Promise<boolean> {
    const res = await addDocReviewCommentAt(
      projectId,
      kind,
      targetId,
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
      await setDocApproval(projectId, kind, targetId, status);
      await reload();
      router.refresh();
    });
  }

  const decided = detail?.myDecision ?? null;

  return (
    <Modal open={open} onClose={onClose} title={`Review · ${title}`} size="xl">
      {loading || !detail ? (
        <p className="py-16 text-center text-sm text-text-faint">Loading…</p>
      ) : (
        <div className="space-y-4">
          {detail.surface.kind === "ai_shot" ? (
            <AiShotReviewCanvas
              surface={detail.surface}
              comments={detail.comments}
              onPost={post}
              onResolve={resolve}
            />
          ) : (
            <PinCanvas
              stage={<DocSurfaceView surface={detail.surface} />}
              stageBg="var(--surface-2)"
              fit="full"
              comments={detail.comments}
              emptyHint="Click anywhere on the document to drop a pin and start."
              onPost={(text, pin) => post(text, { pin })}
              onResolve={resolve}
            />
          )}

          <div className="rounded-[12px] border border-border bg-surface-2/40 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-faint">
              Your internal sign-off
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => signOff(decided === "approved" ? "pending" : "approved")}
                disabled={busy}
                className={`flex-1 rounded-[11px] border px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
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
                className={`flex-1 rounded-[11px] border px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
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
      )}
    </Modal>
  );
}
