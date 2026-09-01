"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeDrawing } from "@/lib/review-drawing";
import { REACTIONS } from "@/lib/review-reactions";
import { reportError, logWrite } from "@/lib/log";
import { requireStudioContext } from "@/lib/studio";
import { syncAssetStatusFromApprovals } from "@/lib/review-status";
import { loadMentionRoster } from "@/lib/mention-roster";
import { deliverMentions } from "@/lib/mention-notify";
import { mentionAuthorName, mentionSubjectForVersion } from "@/lib/mention-context";
import type { ApprovalStatus } from "@/lib/database.types";

export type ReviewState = { error?: string } | null;

// Add an internal review comment to a specific version.
export async function addReviewComment(
  projectId: string,
  versionId: string,
  _prev: ReviewState,
  formData: FormData
): Promise<ReviewState> {
  const ctx = await requireStudioContext();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a comment first." };

  const supabase = createClient();
  const { data: inserted, error } = await supabase.from("review_comments").insert({
    studio_id: ctx.studio.id,
    version_id: versionId,
    author_id: ctx.userId,
    body,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return null;
}

// Add an internal review comment with an optional anchor: an image pin
// (percent coords) or a video timecode (seconds). Both get a marker number.
export async function addReviewCommentAt(
  projectId: string,
  versionId: string,
  body: string,
  pin?: { x: number; y: number } | null,
  timecode?: number | null,
  // A reply hangs off a parent comment (inheriting its moment); drawing is a
  // freehand annotation over the frame.
  parentId?: string | null,
  drawing?: unknown,
  // Out-point for a range comment; timecode is the in-point.
  timecodeEnd?: number | null,
  // For a PDF, which page the pin was dropped on.
  pinPage?: number | null,
  // Roster contact ids the author picked. Validated server-side against the
  // project's own roster, so an id from the browser can only ever name someone
  // already on this job.
  mentions?: string[]
): Promise<ReviewState> {
  const ctx = await requireStudioContext();
  const text = body.trim();
  if (!text) return { error: "Write a comment first." };

  const supabase = createClient();

  let parent: string | null = null;
  if (parentId) {
    const { data: p } = await supabase
      .from("review_comments")
      .select("id, version_id, parent_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!p || p.version_id !== versionId) {
      return { error: "That comment is not part of this review." };
    }
    parent = p.parent_id ?? p.id;
  }

  const hasPin = !parent && pin && Number.isFinite(pin.x) && Number.isFinite(pin.y);
  const hasTime = !parent && timecode != null && Number.isFinite(timecode);
  let pinNumber: number | null = null;
  let posX: number | null = null;
  let posY: number | null = null;
  let time: number | null = null;
  let endTime: number | null = null;
  if (hasPin || hasTime) {
    if (hasPin) {
      posX = Math.max(0, Math.min(100, pin!.x));
      posY = Math.max(0, Math.min(100, pin!.y));
    }
    if (hasTime) time = Math.max(0, timecode as number);
    if (
      time != null &&
      timecodeEnd != null &&
      Number.isFinite(timecodeEnd) &&
      timecodeEnd > time
    ) {
      endTime = timecodeEnd;
    }
    const { data: lastPin } = await supabase
      .from("review_comments")
      .select("pin_number")
      .eq("version_id", versionId)
      .not("pin_number", "is", null)
      .order("pin_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    pinNumber = ((lastPin?.pin_number as number | null) ?? 0) + 1;
  }

  const { data: inserted, error } = await supabase.from("review_comments").insert({
    studio_id: ctx.studio.id,
    version_id: versionId,
    author_id: ctx.userId,
    body: text,
    pin_number: pinNumber,
    pin_page:
      posX != null && pinPage != null && Number.isFinite(pinPage)
        ? Math.max(1, Math.min(2000, Math.floor(pinPage)))
        : null,
    pos_x: posX,
    pos_y: posY,
    timecode: time,
    timecode_end: endTime,
    parent_id: parent,
    drawing: parent ? null : normalizeDrawing(drawing),
  })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Mentions are delivered AFTER the comment is safely stored, and never fail
  // it: the note existing is what matters most, and a mail outage must not turn
  // a posted comment into an error the author has to retype.
  if (inserted && mentions?.length) {
    const roster = await loadMentionRoster(projectId);
    const subject = await mentionSubjectForVersion(supabase, versionId);
    await deliverMentions(supabase, inserted.id, mentions, roster, {
      authorName: await mentionAuthorName(supabase, projectId, ctx.userId),
      projectId,
      projectTitle: subject.projectTitle,
      studioId: ctx.studio.id,
      studioName: ctx.studio.name,
      subject: subject.label,
      href: `/projects/${projectId}/review`,
      body: text,
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/assets`);
  return null;
}

// Toggle a review comment's resolved state (RLS scopes it to the studio).
export async function resolveReviewComment(
  projectId: string,
  commentId: string,
  resolved: boolean
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await logWrite(
    "resolveReviewComment/review_comments",
    supabase
      .from("review_comments")
      .update({ resolved_at: resolved ? new Date().toISOString() : null })
      .eq("id", commentId)
  );
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/assets`);
}

// Record (or clear) the current team member's internal sign-off on a version.
// status "pending" retracts an existing decision.
export async function setVersionApproval(
  projectId: string,
  versionId: string,
  status: ApprovalStatus
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("approvals")
    .select("id")
    .eq("target_type", "version")
    .eq("target_id", versionId)
    .eq("reviewer_user_id", ctx.userId)
    .maybeSingle();

  if (status === "pending") {
    if (existing) await supabase.from("approvals").delete().eq("id", existing.id);
  } else if (existing) {
    await logWrite(
      "setVersionApproval/approvals",
      supabase.from("approvals").update({ status }).eq("id", existing.id)
    );
  } else {
    await logWrite(
      "setVersionApproval/approvals",
      supabase.from("approvals").insert({
        studio_id: ctx.studio.id,
        target_type: "version",
        target_id: versionId,
        reviewer_user_id: ctx.userId,
        status,
        created_by: ctx.userId,
      })
    );
  }

  // Move the asset through the review pipeline so the (status-filtered) Review
  // page reflects this decision, not just the hub's approval count.
  await syncAssetStatusFromApprovals(supabase, versionId);

  // Timeline entry (neutral phrasing; the feed prefixes the author).
  if (status !== "pending") {
    const { data: v } = await supabase
      .from("versions")
      .select("version_number, asset:assets!versions_asset_id_fkey(name)")
      .eq("id", versionId)
      .maybeSingle();
    if (v) {
      const assetName =
        (v.asset as { name: string } | null)?.name ?? "an asset";
      const label =
        status === "approved" ? "Approved" : "Requested changes on";
      await logWrite(
        "setVersionApproval/activity",
        supabase.from("activity").insert({
          studio_id: ctx.studio.id,
          project_id: projectId,
          author_id: ctx.userId,
          type: "approval",
          content: `${label} v${v.version_number} of "${assetName}"`,
        })
      );
    }
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/review`);
}

// Edit / delete a comment the signed-in team member wrote. RLS scopes rows to
// the studio; the author check makes it "your own comment" rather than
// "anyone's". Studio admins are not special-cased here on purpose: silently
// rewriting someone else's review note is worse than asking them to.
export async function editReviewComment(
  projectId: string,
  commentId: string,
  body: string
): Promise<ReviewState> {
  const ctx = await requireStudioContext();
  const text = body.trim();
  if (!text) return { error: "Write a comment first." };
  const supabase = createClient();

  const { data: comment } = await supabase
    .from("review_comments")
    .select("id, author_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return { error: "That comment is no longer available." };
  if (comment.author_id !== ctx.userId)
    return { error: "You can only edit your own comment." };

  const { error } = await supabase
    .from("review_comments")
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) {
    reportError("editReviewComment", error);
    return { error: error.message };
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/review`);
  return null;
}

export async function deleteReviewComment(
  projectId: string,
  commentId: string
): Promise<ReviewState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: comment } = await supabase
    .from("review_comments")
    .select("id, author_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return { error: "That comment is no longer available." };
  if (comment.author_id !== ctx.userId)
    return { error: "You can only delete your own comment." };

  // Replies cascade with the parent.
  const { error } = await supabase
    .from("review_comments")
    .delete()
    .eq("id", commentId);
  if (error) {
    reportError("deleteReviewComment", error);
    return { error: error.message };
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/review`);
  return null;
}

// Toggle one emoji reaction as the signed-in team member.
export async function toggleReviewReaction(
  projectId: string,
  commentId: string,
  emoji: string
): Promise<ReviewState> {
  const ctx = await requireStudioContext();
  if (!REACTIONS.includes(emoji)) return { error: "Unknown reaction." };
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("review_comment_reactions")
    .select("id")
    .eq("comment_id", commentId)
    .eq("emoji", emoji)
    .eq("author_id", ctx.userId)
    .maybeSingle();

  if (existing) {
    await logWrite(
      "toggleReviewReaction/review_comment_reactions",
      supabase
        .from("review_comment_reactions")
        .delete()
        .eq("id", existing.id)
    );
  } else {
    const { error } = await supabase
      .from("review_comment_reactions")
      .insert({
        studio_id: ctx.studio.id,
        comment_id: commentId,
        emoji,
        author_id: ctx.userId,
      });
    if (error) {
      reportError("toggleReviewReaction", error);
      return { error: error.message };
    }
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/review`);
  return null;
}
