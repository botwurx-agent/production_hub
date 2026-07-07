"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { isDocKind, type DocKind } from "@/lib/review-links";
import {
  loadDocReviewDetail,
  type DocReviewDetail,
} from "@/lib/doc-review-data";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ApprovalStatus } from "@/lib/database.types";

export type DocReviewState = { error?: string } | null;

const NOUN: Record<DocKind, string> = {
  shot_list: "shot list",
  storyboard: "storyboard",
  moodboard: "moodboard",
};

// Confirms the target belongs to this project (and, via RLS, this studio).
async function targetInProject(
  supabase: SupabaseClient<Database>,
  projectId: string,
  kind: DocKind,
  targetId: string
): Promise<boolean> {
  if (kind === "shot_list") {
    if (targetId !== projectId) return false;
    const { data } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();
    return Boolean(data);
  }
  const { data } = await supabase
    .from("boards")
    .select("id")
    .eq("id", targetId)
    .eq("project_id", projectId)
    .eq("kind", kind)
    .maybeSingle();
  return Boolean(data);
}

// Put a doc into the internal review cycle (idempotent). It then appears on the
// project's Review page under "Awaiting review".
export async function sendDocToReview(
  projectId: string,
  kind: DocKind,
  targetId: string
): Promise<DocReviewState> {
  const ctx = await requireStudioContext();
  if (!isDocKind(kind)) return { error: "Unknown document type." };
  const supabase = createClient();
  if (!(await targetInProject(supabase, projectId, kind, targetId)))
    return { error: "That document was not found." };

  const { data: existing } = await supabase
    .from("doc_reviews")
    .select("id")
    .eq("target_type", kind)
    .eq("target_id", targetId)
    .maybeSingle();
  if (!existing) {
    const { error } = await supabase.from("doc_reviews").insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      target_type: kind,
      target_id: targetId,
      status: "in_review",
      created_by: ctx.userId,
    });
    if (error) return { error: error.message };
    await supabase.from("activity").insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      author_id: ctx.userId,
      type: "activity",
      content: `Sent the ${NOUN[kind]} to review`,
    });
  }
  revalidatePath(`/projects/${projectId}/review`);
  revalidatePath(`/projects/${projectId}`);
  return null;
}

export async function removeDocFromReview(
  projectId: string,
  kind: DocKind,
  targetId: string
): Promise<DocReviewState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("doc_reviews")
    .delete()
    .eq("target_type", kind)
    .eq("target_id", targetId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}/review`);
  revalidatePath(`/projects/${projectId}`);
  return null;
}

// Internal team comment on a doc, with an optional pin (percent coords). Pin
// numbers are shared with client comments on the same doc.
export async function addDocReviewCommentAt(
  projectId: string,
  kind: DocKind,
  targetId: string,
  body: string,
  pin?: { x: number; y: number } | null
): Promise<DocReviewState> {
  const ctx = await requireStudioContext();
  const text = body.trim();
  if (!text) return { error: "Write a comment first." };
  if (!isDocKind(kind)) return { error: "Unknown document type." };
  const supabase = createClient();

  const hasPin = pin && Number.isFinite(pin.x) && Number.isFinite(pin.y);
  let pinNumber: number | null = null;
  let posX: number | null = null;
  let posY: number | null = null;
  if (hasPin) {
    posX = Math.max(0, Math.min(100, pin!.x));
    posY = Math.max(0, Math.min(100, pin!.y));
    const { data: lastPin } = await supabase
      .from("review_comments")
      .select("pin_number")
      .eq("target_type", kind)
      .eq("target_id", targetId)
      .not("pin_number", "is", null)
      .order("pin_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    pinNumber = ((lastPin?.pin_number as number | null) ?? 0) + 1;
  }

  const { error } = await supabase.from("review_comments").insert({
    studio_id: ctx.studio.id,
    author_id: ctx.userId,
    body: text,
    target_type: kind,
    target_id: targetId,
    pin_number: pinNumber,
    pos_x: posX,
    pos_y: posY,
  });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}/review`);
  return null;
}

export async function resolveDocReviewComment(
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
  revalidatePath(`/projects/${projectId}/review`);
}

// Record (or clear) the current team member's internal sign-off on a doc, and
// move the doc's pipeline status to match (the "greenlight" before client send).
export async function setDocApproval(
  projectId: string,
  kind: DocKind,
  targetId: string,
  status: ApprovalStatus
): Promise<DocReviewState> {
  const ctx = await requireStudioContext();
  if (!isDocKind(kind)) return { error: "Unknown document type." };
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("approvals")
    .select("id")
    .eq("target_type", kind)
    .eq("target_id", targetId)
    .eq("reviewer_user_id", ctx.userId)
    .maybeSingle();

  if (status === "pending") {
    if (existing) await supabase.from("approvals").delete().eq("id", existing.id);
  } else if (existing) {
    await supabase.from("approvals").update({ status }).eq("id", existing.id);
  } else {
    const { error } = await supabase.from("approvals").insert({
      studio_id: ctx.studio.id,
      target_type: kind,
      target_id: targetId,
      reviewer_user_id: ctx.userId,
      status,
      created_by: ctx.userId,
    });
    if (error) return { error: error.message };
  }

  // Reflect the latest sign-off in the pipeline bucket.
  const docStatus =
    status === "approved"
      ? "approved"
      : status === "changes_requested"
        ? "needs_changes"
        : "in_review";
  await supabase
    .from("doc_reviews")
    .update({ status: docStatus, updated_at: new Date().toISOString() })
    .eq("target_type", kind)
    .eq("target_id", targetId);

  if (status !== "pending") {
    const label =
      status === "approved" ? "Approved" : "Requested changes on";
    await supabase.from("activity").insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      author_id: ctx.userId,
      type: "approval",
      content: `${label} the ${NOUN[kind]}`,
    });
  }

  revalidatePath(`/projects/${projectId}/review`);
  revalidatePath(`/projects/${projectId}`);
  return null;
}

// Load the live surface + comment stream for the internal review modal.
export async function getDocReviewDetail(
  kind: DocKind,
  targetId: string
): Promise<DocReviewDetail | null> {
  const ctx = await requireStudioContext();
  if (!isDocKind(kind)) return null;
  const supabase = createClient();
  return loadDocReviewDetail(supabase, kind, targetId, ctx.userId);
}
