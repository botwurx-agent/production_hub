"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { allowPublic } from "@/lib/rate-limit";
import { getValidLink, isDocKind } from "@/lib/review-links";
import { normalizeDrawing } from "@/lib/review-drawing";
import { REACTIONS } from "@/lib/review-reactions";
import { createNotification } from "@/lib/notifications";
import { syncAssetStatusFromApprovals } from "@/lib/review-status";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReviewLink, ApprovalStatus } from "@/lib/database.types";
import { logWrite } from "@/lib/log";

export type PortalState = { error?: string } | null;

// Confirms a version belongs to the link's asset before any write, so a client
// can only ever act on the asset they were given.
async function versionInLink(
  service: SupabaseClient<Database>,
  link: ReviewLink,
  versionId: string
): Promise<boolean> {
  if (!link.asset_id) return false;
  const { data } = await service
    .from("versions")
    .select("id")
    .eq("id", versionId)
    .eq("asset_id", link.asset_id)
    .maybeSingle();
  return Boolean(data);
}

async function logActivity(
  service: SupabaseClient<Database>,
  link: ReviewLink,
  content: string
) {
  await logWrite(
    "logActivity/activity",
    service.from("activity").insert({
      studio_id: link.studio_id,
      project_id: link.project_id,
      type: "activity",
      content,
    })
  );
}

// When a client leaves feedback on a shared doc that isn't formally in the review
// cycle yet, add it to the pipeline so the feedback surfaces on the Review page.
async function ensureDocReview(service: SupabaseClient<Database>, link: ReviewLink) {
  if (!isDocKind(link.target_type) || !link.target_id || !link.project_id) return;
  const { data: existing } = await service
    .from("doc_reviews")
    .select("id")
    .eq("target_type", link.target_type)
    .eq("target_id", link.target_id)
    .maybeSingle();
  if (existing) return;
  await logWrite(
    "ensureDocReview/doc_reviews",
    service.from("doc_reviews").insert({
      studio_id: link.studio_id,
      project_id: link.project_id,
      target_type: link.target_type,
      target_id: link.target_id,
      status: "in_review",
      created_by: null,
    })
  );
}

export async function submitClientComment(
  token: string,
  versionId: string,
  name: string,
  body: string,
  // Optional Frame.io-style anchor: an image pin (percent coords) or, for
  // video, a timecode in seconds. Both get a sequential marker number.
  pin?: { x: number; y: number } | null,
  timecode?: number | null,
  // A reply hangs off a parent comment and inherits its moment (no anchor of
  // its own); drawing is freehand annotation over the frame.
  parentId?: string | null,
  drawing?: unknown,
  // Out-point for a range comment; timecode is the in-point.
  timecodeEnd?: number | null,
  // Random per-browser id, required later to edit or delete this comment.
  authorKey?: string | null
): Promise<PortalState> {
  if (!allowPublic("r-comment"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "Review portal is not configured." };
  const reviewer = name.trim();
  const text = body.trim();
  if (!reviewer) return { error: "Add your name first." };
  if (!text) return { error: "Write a comment first." };

  const service = createServiceClient();
  const link = await getValidLink(service, token);
  if (!link) return { error: "This review link is no longer active." };
  if (!(await versionInLink(service, link, versionId)))
    return { error: "That version is not part of this review." };

  // A reply must belong to this same version, and never nests further.
  let parent: string | null = null;
  if (parentId) {
    const { data: p } = await service
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
    // Assign the next marker number for this version (shared by pins + times).
    const { data: lastPin } = await service
      .from("review_comments")
      .select("pin_number")
      .eq("version_id", versionId)
      .not("pin_number", "is", null)
      .order("pin_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    pinNumber = ((lastPin?.pin_number as number | null) ?? 0) + 1;
  }

  const { error } = await service.from("review_comments").insert({
    studio_id: link.studio_id,
    version_id: versionId,
    review_link_id: link.id,
    reviewer_name: reviewer,
    body: text,
    pin_number: pinNumber,
    pos_x: posX,
    pos_y: posY,
    timecode: time,
    timecode_end: endTime,
    parent_id: parent,
    drawing: parent ? null : normalizeDrawing(drawing),
    author_key: authorKey?.trim() || null,
  });
  if (error) return { error: error.message };

  await logActivity(
    service,
    link,
    `${reviewer} ${parent ? "replied in" : "commented in"} client review`
  );
  await createNotification(service, {
    studio_id: link.studio_id,
    project_id: link.project_id,
    type: "client_comment",
    title: `${reviewer} ${parent ? "replied in" : "commented in"} client review`,
    body: text.slice(0, 140),
    href: `/projects/${link.project_id}`,
  });
  revalidatePath(`/r/${token}`);
  revalidatePath(`/projects/${link.project_id}`);
  return null;
}

// Toggles a comment's resolved state. Token-gated and scoped to the link's asset.
export async function resolveClientComment(
  token: string,
  commentId: string,
  resolved: boolean
): Promise<PortalState> {
  if (!allowPublic("r-resolve"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "Review portal is not configured." };
  const service = createServiceClient();
  const link = await getValidLink(service, token);
  if (!link) return { error: "This review link is no longer active." };

  const { data: comment } = await service
    .from("review_comments")
    .select("id, version_id")
    .eq("id", commentId)
    .maybeSingle();
  if (
    !comment ||
    !comment.version_id ||
    !(await versionInLink(service, link, comment.version_id))
  )
    return { error: "That comment is not part of this review." };

  const { error } = await service
    .from("review_comments")
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", commentId);
  if (error) return { error: error.message };

  revalidatePath(`/r/${token}`);
  return null;
}

export async function submitClientDecision(
  token: string,
  versionId: string,
  name: string,
  status: Extract<ApprovalStatus, "approved" | "changes_requested">
): Promise<PortalState> {
  if (!allowPublic("r-decision"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "Review portal is not configured." };
  const reviewer = name.trim();
  if (!reviewer) return { error: "Add your name first." };

  const service = createServiceClient();
  const link = await getValidLink(service, token);
  if (!link) return { error: "This review link is no longer active." };
  if (!(await versionInLink(service, link, versionId)))
    return { error: "That version is not part of this review." };

  // One decision per link per version: update if it exists, else insert.
  const { data: existing } = await service
    .from("approvals")
    .select("id")
    .eq("target_type", "version")
    .eq("target_id", versionId)
    .eq("review_link_id", link.id)
    .maybeSingle();

  if (existing) {
    const { error } = await service
      .from("approvals")
      .update({ status, reviewer_name: reviewer })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await service.from("approvals").insert({
      studio_id: link.studio_id,
      target_type: "version",
      target_id: versionId,
      review_link_id: link.id,
      reviewer_name: reviewer,
      status,
    });
    if (error) return { error: error.message };
  }

  // Reflect the client's decision in the asset's pipeline status so it shows
  // correctly on the internal Review page.
  await syncAssetStatusFromApprovals(service, versionId);

  const label =
    status === "approved" ? "approved this asset" : "requested changes";
  await logActivity(service, link, `${reviewer} ${label} in client review`);
  await createNotification(service, {
    studio_id: link.studio_id,
    project_id: link.project_id,
    type: status === "approved" ? "client_approved" : "client_changes",
    title: `${reviewer} ${label}`,
    href: `/projects/${link.project_id}`,
  });
  revalidatePath(`/r/${token}`);
  revalidatePath(`/projects/${link.project_id}`);
  revalidatePath(`/projects/${link.project_id}/review`);
  return null;
}

// ---- Doc review (shot list / storyboard / moodboard) ------------------------
// These act on link.target_type / link.target_id instead of an asset version.
// A doc link carries no asset/version, so validation is that the link itself is
// a valid doc link; every write is scoped to that link's target.

const DOC_LABEL: Record<string, string> = {
  shot_list: "shot list",
  storyboard: "storyboard",
  moodboard: "moodboard",
  ai_shot: "shot",
};

export async function submitDocComment(
  token: string,
  name: string,
  body: string,
  pin?: { x: number; y: number } | null,
  timecode?: number | null,
  parentId?: string | null,
  drawing?: unknown,
  // Out-point for a range comment; timecode is the in-point.
  timecodeEnd?: number | null,
  authorKey?: string | null
): Promise<PortalState> {
  if (!allowPublic("r-doc-comment"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "Review portal is not configured." };
  const reviewer = name.trim();
  const text = body.trim();
  if (!reviewer) return { error: "Add your name first." };
  if (!text) return { error: "Write a comment first." };

  const service = createServiceClient();
  const link = await getValidLink(service, token);
  if (!link) return { error: "This review link is no longer active." };
  if (!isDocKind(link.target_type) || !link.target_id)
    return { error: "This is not a document review." };

  // A reply hangs off its parent (same doc target) and never nests further.
  let parent: string | null = null;
  if (parentId) {
    const { data: p } = await service
      .from("review_comments")
      .select("id, target_type, target_id, parent_id")
      .eq("id", parentId)
      .maybeSingle();
    if (
      !p ||
      p.target_type !== link.target_type ||
      p.target_id !== link.target_id
    ) {
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
    // Next marker number for this doc target (shared by pins + timecodes).
    const { data: lastPin } = await service
      .from("review_comments")
      .select("pin_number")
      .eq("target_type", link.target_type)
      .eq("target_id", link.target_id)
      .not("pin_number", "is", null)
      .order("pin_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    pinNumber = ((lastPin?.pin_number as number | null) ?? 0) + 1;
  }

  const { error } = await service.from("review_comments").insert({
    studio_id: link.studio_id,
    review_link_id: link.id,
    reviewer_name: reviewer,
    body: text,
    target_type: link.target_type,
    target_id: link.target_id,
    pin_number: pinNumber,
    pos_x: posX,
    pos_y: posY,
    timecode: time,
    timecode_end: endTime,
    parent_id: parent,
    drawing: parent ? null : normalizeDrawing(drawing),
    author_key: authorKey?.trim() || null,
  });
  if (error) return { error: error.message };

  await ensureDocReview(service, link);
  const noun = DOC_LABEL[link.target_type] ?? "document";
  await logActivity(service, link, `${reviewer} commented on the ${noun}`);
  await createNotification(service, {
    studio_id: link.studio_id,
    project_id: link.project_id,
    type: "client_comment",
    title: `${reviewer} commented on the ${noun}`,
    body: text.slice(0, 140),
    href: `/projects/${link.project_id}`,
  });
  revalidatePath(`/r/${token}`);
  revalidatePath(`/projects/${link.project_id}`);
  return null;
}

export async function resolveDocComment(
  token: string,
  commentId: string,
  resolved: boolean
): Promise<PortalState> {
  if (!allowPublic("r-doc-resolve"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "Review portal is not configured." };
  const service = createServiceClient();
  const link = await getValidLink(service, token);
  if (!link) return { error: "This review link is no longer active." };
  if (!isDocKind(link.target_type) || !link.target_id)
    return { error: "This is not a document review." };

  const { data: comment } = await service
    .from("review_comments")
    .select("id, target_type, target_id")
    .eq("id", commentId)
    .maybeSingle();
  if (
    !comment ||
    comment.target_type !== link.target_type ||
    comment.target_id !== link.target_id
  )
    return { error: "That comment is not part of this review." };

  const { error } = await service
    .from("review_comments")
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", commentId);
  if (error) return { error: error.message };

  revalidatePath(`/r/${token}`);
  return null;
}

export async function submitDocDecision(
  token: string,
  name: string,
  status: Extract<ApprovalStatus, "approved" | "changes_requested">
): Promise<PortalState> {
  if (!allowPublic("r-doc-decision"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "Review portal is not configured." };
  const reviewer = name.trim();
  if (!reviewer) return { error: "Add your name first." };

  const service = createServiceClient();
  const link = await getValidLink(service, token);
  if (!link) return { error: "This review link is no longer active." };
  if (!isDocKind(link.target_type) || !link.target_id)
    return { error: "This is not a document review." };

  const { data: existing } = await service
    .from("approvals")
    .select("id")
    .eq("target_type", link.target_type)
    .eq("target_id", link.target_id)
    .eq("review_link_id", link.id)
    .maybeSingle();

  if (existing) {
    const { error } = await service
      .from("approvals")
      .update({ status, reviewer_name: reviewer })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await service.from("approvals").insert({
      studio_id: link.studio_id,
      target_type: link.target_type,
      target_id: link.target_id,
      review_link_id: link.id,
      reviewer_name: reviewer,
      status,
    });
    if (error) return { error: error.message };
  }

  await ensureDocReview(service, link);
  const noun = DOC_LABEL[link.target_type] ?? "document";
  const label =
    status === "approved" ? `approved the ${noun}` : `requested changes on the ${noun}`;
  await logActivity(service, link, `${reviewer} ${label}`);
  await createNotification(service, {
    studio_id: link.studio_id,
    project_id: link.project_id,
    type: status === "approved" ? "client_approved" : "client_changes",
    title: `${reviewer} ${label}`,
    href: `/projects/${link.project_id}`,
  });
  revalidatePath(`/r/${token}`);
  revalidatePath(`/projects/${link.project_id}`);
  return null;
}

// ---------------------------------------------------------------------------
// Edit / delete / react, for comments made through this link.
//
// The portal has no login, so authorship is proved by `author_key`: a random id
// the visitor's browser generated and stored locally. Requiring it means a
// reviewer can only touch comments their own browser posted, which is strictly
// stronger than trusting the typed name (anyone with the link can type any
// name). Comments from the studio side (author_id set) are never editable here.
async function ownedComment(
  service: ReturnType<typeof createServiceClient>,
  link: { id: string },
  commentId: string,
  authorKey: string
) {
  const { data } = await service
    .from("review_comments")
    .select("id, review_link_id, author_key, author_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!data) return null;
  if (data.review_link_id !== link.id) return null;
  if (data.author_id) return null;
  if (!data.author_key || data.author_key !== authorKey) return null;
  return data;
}

export async function editClientComment(
  token: string,
  commentId: string,
  authorKey: string,
  body: string
): Promise<PortalState> {
  if (!allowPublic("r-edit"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "Review portal is not configured." };
  const text = body.trim();
  if (!text) return { error: "Write a comment first." };
  if (!authorKey?.trim()) return { error: "You can only edit your own comment." };

  const service = createServiceClient();
  const link = await getValidLink(service, token);
  if (!link) return { error: "This review link is no longer active." };
  const owned = await ownedComment(service, link, commentId, authorKey.trim());
  if (!owned) return { error: "You can only edit your own comment." };

  const { error } = await service
    .from("review_comments")
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) return { error: error.message };
  revalidatePath(`/r/${token}`);
  revalidatePath(`/projects/${link.project_id}`);
  return null;
}

export async function deleteClientComment(
  token: string,
  commentId: string,
  authorKey: string
): Promise<PortalState> {
  if (!allowPublic("r-delete"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "Review portal is not configured." };
  if (!authorKey?.trim())
    return { error: "You can only delete your own comment." };

  const service = createServiceClient();
  const link = await getValidLink(service, token);
  if (!link) return { error: "This review link is no longer active." };
  const owned = await ownedComment(service, link, commentId, authorKey.trim());
  if (!owned) return { error: "You can only delete your own comment." };

  // Replies cascade with the parent (FK on delete cascade).
  const { error } = await service
    .from("review_comments")
    .delete()
    .eq("id", commentId);
  if (error) return { error: error.message };
  revalidatePath(`/r/${token}`);
  revalidatePath(`/projects/${link.project_id}`);
  return null;
}

// Toggles one emoji reaction on a comment. Reacting is open to anyone holding
// the link (same trust level as commenting); the key just scopes "mine".
export async function toggleClientReaction(
  token: string,
  commentId: string,
  emoji: string,
  reviewerKey: string,
  reviewerName?: string | null
): Promise<PortalState> {
  if (!allowPublic("r-react"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "Review portal is not configured." };
  if (!REACTIONS.includes(emoji)) return { error: "Unknown reaction." };
  const key = reviewerKey?.trim();
  if (!key) return { error: "Could not identify this browser." };

  const service = createServiceClient();
  const link = await getValidLink(service, token);
  if (!link) return { error: "This review link is no longer active." };

  // The comment has to belong to this review, not just exist.
  const { data: comment } = await service
    .from("review_comments")
    .select("id, version_id, target_type, target_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return { error: "That comment is no longer available." };
  const inThisReview = link.target_type
    ? comment.target_type === link.target_type &&
      comment.target_id === link.target_id
    : Boolean(
        comment.version_id &&
          (await versionInLink(service, link, comment.version_id))
      );
  if (!inThisReview) return { error: "That comment is not part of this review." };

  const { data: existing } = await service
    .from("review_comment_reactions")
    .select("id")
    .eq("comment_id", commentId)
    .eq("emoji", emoji)
    .eq("reviewer_key", key)
    .maybeSingle();

  if (existing) {
    await logWrite(
      "toggleClientReaction/review_comment_reactions",
      service
        .from("review_comment_reactions")
        .delete()
        .eq("id", existing.id)
    );
  } else {
    const { error } = await service.from("review_comment_reactions").insert({
      studio_id: link.studio_id,
      comment_id: commentId,
      emoji,
      reviewer_key: key,
      reviewer_name: reviewerName?.trim() || null,
    });
    if (error) return { error: error.message };
  }
  revalidatePath(`/r/${token}`);
  revalidatePath(`/projects/${link.project_id}`);
  return null;
}
