"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { getValidLink, isDocKind } from "@/lib/review-links";
import { createNotification } from "@/lib/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReviewLink, ApprovalStatus } from "@/lib/database.types";

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
  await service.from("activity").insert({
    studio_id: link.studio_id,
    project_id: link.project_id,
    type: "activity",
    content,
  });
}

export async function submitClientComment(
  token: string,
  versionId: string,
  name: string,
  body: string,
  // Optional Frame.io-style anchor: an image pin (percent coords) or, for
  // video, a timecode in seconds. Both get a sequential marker number.
  pin?: { x: number; y: number } | null,
  timecode?: number | null
): Promise<PortalState> {
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

  const hasPin = pin && Number.isFinite(pin.x) && Number.isFinite(pin.y);
  const hasTime = timecode != null && Number.isFinite(timecode);

  let pinNumber: number | null = null;
  let posX: number | null = null;
  let posY: number | null = null;
  let time: number | null = null;
  if (hasPin || hasTime) {
    if (hasPin) {
      posX = Math.max(0, Math.min(100, pin!.x));
      posY = Math.max(0, Math.min(100, pin!.y));
    }
    if (hasTime) time = Math.max(0, timecode as number);
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
  });
  if (error) return { error: error.message };

  await logActivity(service, link, `${reviewer} commented in client review`);
  await createNotification(service, {
    studio_id: link.studio_id,
    project_id: link.project_id,
    type: "client_comment",
    title: `${reviewer} commented in client review`,
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
};

export async function submitDocComment(
  token: string,
  name: string,
  body: string,
  pin?: { x: number; y: number } | null
): Promise<PortalState> {
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

  const hasPin = pin && Number.isFinite(pin.x) && Number.isFinite(pin.y);
  let pinNumber: number | null = null;
  let posX: number | null = null;
  let posY: number | null = null;
  if (hasPin) {
    posX = Math.max(0, Math.min(100, pin!.x));
    posY = Math.max(0, Math.min(100, pin!.y));
    // Next marker number for this doc target.
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
  });
  if (error) return { error: error.message };

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
