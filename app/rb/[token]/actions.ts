"use server";

import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { allowPublic } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type BatchPortalState = { error?: string } | null;

// Resolve a live batch by token and confirm the generation belongs to it, so a
// reviewer can only ever act on the options they were given.
async function resolve(
  service: SupabaseClient<Database>,
  token: string,
  generationId: string
): Promise<{ id: string; studio_id: string; project_id: string; title: string } | null> {
  const { data: batch } = await service
    .from("ai_batch_reviews")
    .select("id, studio_id, project_id, title, revoked")
    .eq("token", token)
    .maybeSingle();
  if (!batch || batch.revoked) return null;
  const { data: item } = await service
    .from("ai_batch_review_items")
    .select("id")
    .eq("batch_id", batch.id)
    .eq("generation_id", generationId)
    .maybeSingle();
  if (!item) return null;
  return batch;
}

export async function submitBatchComment(
  token: string,
  generationId: string,
  name: string,
  body: string,
  timecode: number | null
): Promise<BatchPortalState> {
  if (!serviceConfigured()) return { error: "Reviews are not available right now." };
  if (!allowPublic("batch_comment", 30)) return { error: "Too many comments, slow down a moment." };
  const reviewer = name.trim();
  const text = body.trim();
  if (!reviewer) return { error: "Add your name first." };
  if (!text) return { error: "Write a comment first." };

  const service = createServiceClient();
  const batch = await resolve(service, token, generationId);
  if (!batch) return { error: "This review link is no longer available." };

  const { error } = await service.from("ai_batch_review_comments").insert({
    studio_id: batch.studio_id,
    batch_id: batch.id,
    generation_id: generationId,
    reviewer_name: reviewer,
    body: text,
    timecode,
  });
  if (error) return { error: error.message };

  await createNotification(service, {
    studio_id: batch.studio_id,
    project_id: batch.project_id,
    type: "review_comment",
    title: `${reviewer} commented on "${batch.title}"`,
    body: text.slice(0, 140),
    href: `/projects/${batch.project_id}/pipeline`,
  });
  return null;
}

export async function setBatchMark(
  token: string,
  generationId: string,
  name: string,
  patch: { starred?: boolean; isPick?: boolean }
): Promise<BatchPortalState> {
  if (!serviceConfigured()) return { error: "Reviews are not available right now." };
  if (!allowPublic("batch_mark", 60)) return { error: "Too many actions, slow down a moment." };
  const reviewer = name.trim();
  if (!reviewer) return { error: "Add your name first." };

  const service = createServiceClient();
  const batch = await resolve(service, token, generationId);
  if (!batch) return { error: "This review link is no longer available." };

  // A pick is exclusive per reviewer: clear their pick on the other options first.
  if (patch.isPick === true) {
    await service
      .from("ai_batch_review_marks")
      .update({ is_pick: false, updated_at: new Date().toISOString() })
      .eq("batch_id", batch.id)
      .eq("reviewer_name", reviewer);
  }

  const { data: existing } = await service
    .from("ai_batch_review_marks")
    .select("id, starred, is_pick")
    .eq("batch_id", batch.id)
    .eq("generation_id", generationId)
    .eq("reviewer_name", reviewer)
    .maybeSingle();

  const next = {
    starred: patch.starred ?? existing?.starred ?? false,
    is_pick: patch.isPick ?? existing?.is_pick ?? false,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await service.from("ai_batch_review_marks").update(next).eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await service.from("ai_batch_review_marks").insert({
      studio_id: batch.studio_id,
      batch_id: batch.id,
      generation_id: generationId,
      reviewer_name: reviewer,
      ...next,
    });
    if (error) return { error: error.message };
    if (patch.isPick) {
      await createNotification(service, {
        studio_id: batch.studio_id,
        project_id: batch.project_id,
        type: "review_comment",
        title: `${reviewer} picked a favorite on "${batch.title}"`,
        href: `/projects/${batch.project_id}/pipeline`,
      });
    }
  }
  return null;
}
