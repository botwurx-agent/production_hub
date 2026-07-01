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
