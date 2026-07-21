"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { generateReviewToken } from "@/lib/review-links";

export type BatchState = { error?: string; token?: string; id?: string } | null;

// Curate a subset of a shot's candidates into a shareable review set. Returns the
// public token so the caller can build the /rb/<token> link.
export async function createBatchReview(
  projectId: string,
  input: { shotId: string; generationIds: string[]; title?: string | null }
): Promise<BatchState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const ids = Array.from(new Set(input.generationIds)).slice(0, 40);
  if (ids.length === 0) return { error: "Pick at least one option to send." };

  const token = generateReviewToken();
  const { data: batch, error } = await supabase
    .from("ai_batch_reviews")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      shot_id: input.shotId,
      title: input.title?.trim() || "Which one?",
      token,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !batch) return { error: error?.message ?? "Could not create the review." };

  const rows = ids.map((generation_id, i) => ({
    studio_id: ctx.studio.id,
    batch_id: batch.id,
    generation_id,
    position: i,
  }));
  const { error: itemErr } = await supabase.from("ai_batch_review_items").insert(rows);
  if (itemErr) return { error: itemErr.message };

  revalidatePath(`/projects/${projectId}/pipeline`);
  return { id: batch.id, token };
}

// Edit which options are in an existing review: add the newly-checked, remove the
// unchecked. Existing options KEEP their position (so a reviewer's "Option 2"
// stays the same clip); new ones are appended at the end.
export async function updateBatchReviewItems(
  projectId: string,
  batchId: string,
  generationIds: string[]
): Promise<BatchState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const ids = Array.from(new Set(generationIds)).slice(0, 40);
  if (ids.length === 0) return { error: "Keep at least one option in the review." };

  const { data: existing } = await supabase
    .from("ai_batch_review_items")
    .select("id, generation_id, position")
    .eq("batch_id", batchId);
  const rows = existing ?? [];
  const existingIds = new Set(rows.map((r) => r.generation_id));
  const keep = new Set(ids);

  const toRemove = rows.filter((r) => !keep.has(r.generation_id)).map((r) => r.id);
  const toAdd = ids.filter((id) => !existingIds.has(id));

  if (toRemove.length) {
    await supabase.from("ai_batch_review_items").delete().in("id", toRemove);
  }
  if (toAdd.length) {
    const maxPos = rows.reduce((m, r) => Math.max(m, r.position), -1);
    const { error } = await supabase.from("ai_batch_review_items").insert(
      toAdd.map((generation_id, i) => ({
        studio_id: ctx.studio.id,
        batch_id: batchId,
        generation_id,
        position: maxPos + 1 + i,
      }))
    );
    if (error) return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}/pipeline`);
  return { id: batchId };
}

export async function revokeBatchReview(projectId: string, batchId: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("ai_batch_reviews").update({ revoked: true }).eq("id", batchId);
  revalidatePath(`/projects/${projectId}/pipeline`);
}

// Hard delete: removes the review and its items / comments / marks (FK cascade).
export async function deleteBatchReview(projectId: string, batchId: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("ai_batch_reviews").delete().eq("id", batchId);
  revalidatePath(`/projects/${projectId}/pipeline`);
}
