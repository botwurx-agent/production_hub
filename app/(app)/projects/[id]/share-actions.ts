"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { generateReviewToken } from "@/lib/review-links";

export type ShareState = { error?: string } | null;

// Creates a client review link for an asset (or returns the existing active
// one, so a studio always shares one stable URL per asset).
export async function createReviewLink(
  projectId: string,
  assetId: string,
  recipient?: string
): Promise<{ token: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  // Confirm the asset belongs to this project (and, via RLS, this studio).
  const { data: asset } = await supabase
    .from("assets")
    .select("id, project_id")
    .eq("id", assetId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!asset) return { error: "Asset not found." };

  const { data: existing } = await supabase
    .from("review_links")
    .select("token")
    .eq("asset_id", assetId)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { token: existing.token };

  const token = generateReviewToken();
  const { error } = await supabase.from("review_links").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    asset_id: assetId,
    token,
    recipient: recipient?.trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { token };
}

// Creates (or returns the existing active) client review link for a doc
// surface: the shot list (target = project), a storyboard, or a moodboard
// (target = boards.id). Verifies the target belongs to this project + studio.
export async function createDocReviewLink(
  projectId: string,
  kind: "shot_list" | "storyboard" | "moodboard" | "ai_shot",
  targetId: string
): Promise<{ token: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  if (kind === "shot_list") {
    if (targetId !== projectId) return { error: "Invalid shot list target." };
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return { error: "Project not found." };
  } else if (kind === "ai_shot") {
    const { data: shot } = await supabase
      .from("ai_shots")
      .select("id")
      .eq("id", targetId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!shot) return { error: "That shot was not found." };
  } else {
    const { data: board } = await supabase
      .from("boards")
      .select("id")
      .eq("id", targetId)
      .eq("project_id", projectId)
      .eq("kind", kind)
      .maybeSingle();
    if (!board) return { error: "That board was not found." };
  }

  const { data: existing } = await supabase
    .from("review_links")
    .select("token")
    .eq("target_type", kind)
    .eq("target_id", targetId)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { token: existing.token };

  const token = generateReviewToken();
  const { error } = await supabase.from("review_links").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    target_type: kind,
    target_id: targetId,
    token,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { token };
}

export async function revokeReviewLink(
  projectId: string,
  linkId: string
): Promise<ShareState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("review_links")
    .update({ revoked: true })
    .eq("id", linkId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return null;
}
