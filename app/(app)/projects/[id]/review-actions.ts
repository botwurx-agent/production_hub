"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
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
  const { error } = await supabase.from("review_comments").insert({
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
  timecode?: number | null
): Promise<ReviewState> {
  const ctx = await requireStudioContext();
  const text = body.trim();
  if (!text) return { error: "Write a comment first." };

  const supabase = createClient();

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

  const { error } = await supabase.from("review_comments").insert({
    studio_id: ctx.studio.id,
    version_id: versionId,
    author_id: ctx.userId,
    body: text,
    pin_number: pinNumber,
    pos_x: posX,
    pos_y: posY,
    timecode: time,
  });
  if (error) return { error: error.message };

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
  await supabase
    .from("review_comments")
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", commentId);
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
    await supabase.from("approvals").update({ status }).eq("id", existing.id);
  } else {
    await supabase.from("approvals").insert({
      studio_id: ctx.studio.id,
      target_type: "version",
      target_id: versionId,
      reviewer_user_id: ctx.userId,
      status,
      created_by: ctx.userId,
    });
  }

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
      await supabase.from("activity").insert({
        studio_id: ctx.studio.id,
        project_id: projectId,
        author_id: ctx.userId,
        type: "approval",
        content: `${label} v${v.version_number} of "${assetName}"`,
      });
    }
  }

  revalidatePath(`/projects/${projectId}`);
}
