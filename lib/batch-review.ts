import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/database.types";

// Loaders for the shareable batch review (curated set of candidates sent to a
// reviewer). The public /rb/<token> page reads via the SERVICE role (token-gated,
// bypasses RLS); the internal results panel reads via the RLS client.

const SIGNED_TTL = 60 * 60;

export type BatchItem = {
  generationId: string;
  kind: string; // 'video' | 'image'
  mediaUrl: string | null;
  model: string | null;
  platform: string | null;
  prompt: string | null;
};
export type BatchComment = {
  id: string;
  generationId: string;
  reviewerName: string;
  body: string;
  timecode: number | null;
  createdAt: string;
};
export type BatchMark = {
  generationId: string;
  reviewerName: string;
  starred: boolean;
  isPick: boolean;
};
export type BatchReviewData = {
  batchId: string;
  studioId: string;
  projectId: string;
  shotId: string | null;
  title: string;
  shotTitle: string | null;
  items: BatchItem[];
  comments: BatchComment[];
  marks: BatchMark[];
};

function renderable(external: string | null, signed: string | null): string | null {
  if (signed) return signed;
  const u = external ?? "";
  if (/\.(png|jpe?g|gif|webp|avif|mp4|webm|mov)(\?|$)/i.test(u)) return u;
  return null;
}

// Public: everything the reviewer needs, gated by the token. Returns null for an
// unknown / revoked link.
export async function loadBatchByToken(token: string): Promise<BatchReviewData | null> {
  const service = createServiceClient();
  const { data: batch } = await service
    .from("ai_batch_reviews")
    .select("id, studio_id, project_id, shot_id, title, revoked")
    .eq("token", token)
    .maybeSingle();
  if (!batch || batch.revoked) return null;

  const { data: items } = await service
    .from("ai_batch_review_items")
    .select("generation_id, position")
    .eq("batch_id", batch.id)
    .order("position", { ascending: true });
  const genIds = (items ?? []).map((i) => i.generation_id);

  let gens: {
    id: string;
    kind: string;
    file_path: string | null;
    external_url: string | null;
    model: string | null;
    platform: string | null;
    prompt: string | null;
  }[] = [];
  if (genIds.length) {
    const { data } = await service
      .from("ai_generations")
      .select("id, kind, file_path, external_url, model, platform, prompt")
      .in("id", genIds);
    gens = data ?? [];
  }
  const byId = new Map(gens.map((g) => [g.id, g]));

  const paths = gens.map((g) => g.file_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await service.storage.from("assets").createSignedUrls(paths, SIGNED_TTL);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }

  const shotTitle = batch.shot_id
    ? (await service.from("ai_shots").select("title").eq("id", batch.shot_id).maybeSingle()).data?.title ?? null
    : null;

  const orderedItems: BatchItem[] = (items ?? [])
    .map((i) => byId.get(i.generation_id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g))
    .map((g) => ({
      generationId: g.id,
      kind: g.kind,
      mediaUrl: renderable(g.external_url, g.file_path ? signed.get(g.file_path) ?? null : null),
      model: g.model,
      platform: g.platform,
      prompt: g.prompt,
    }));

  const [{ data: comments }, { data: marks }] = await Promise.all([
    service
      .from("ai_batch_review_comments")
      .select("id, generation_id, reviewer_name, body, timecode, created_at")
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: true }),
    service
      .from("ai_batch_review_marks")
      .select("generation_id, reviewer_name, starred, is_pick")
      .eq("batch_id", batch.id),
  ]);

  return {
    batchId: batch.id,
    studioId: batch.studio_id,
    projectId: batch.project_id,
    shotId: batch.shot_id,
    title: batch.title,
    shotTitle,
    items: orderedItems,
    comments: (comments ?? []).map((c) => ({
      id: c.id,
      generationId: c.generation_id,
      reviewerName: c.reviewer_name,
      body: c.body,
      timecode: c.timecode,
      createdAt: c.created_at,
    })),
    marks: (marks ?? []).map((m) => ({
      generationId: m.generation_id,
      reviewerName: m.reviewer_name,
      starred: m.starred,
      isPick: m.is_pick,
    })),
  };
}

// Internal: batch reviews for a shot with their feedback, so the producer sees
// each reviewer's pick / stars / comments. Media is not signed here (the shot
// view already renders the candidates); we return ids + feedback to overlay.
export type BatchReviewSummary = {
  id: string;
  title: string;
  token: string;
  revoked: boolean;
  createdAt: string;
  generationIds: string[];
  comments: BatchComment[];
  marks: BatchMark[];
};

// All of a project's batch reviews, grouped by shot id, for the internal
// "send + see feedback" surface. Batches with a null shot_id are skipped.
export async function loadBatchReviewsForProject(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<Record<string, BatchReviewSummary[]>> {
  const { data: batches } = await supabase
    .from("ai_batch_reviews")
    .select("id, shot_id, title, token, revoked, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (!batches || batches.length === 0) return {};
  const ids = batches.map((b) => b.id);

  const [{ data: items }, { data: comments }, { data: marks }] = await Promise.all([
    supabase.from("ai_batch_review_items").select("batch_id, generation_id, position").in("batch_id", ids),
    supabase
      .from("ai_batch_review_comments")
      .select("id, batch_id, generation_id, reviewer_name, body, timecode, created_at")
      .in("batch_id", ids),
    supabase
      .from("ai_batch_review_marks")
      .select("batch_id, generation_id, reviewer_name, starred, is_pick")
      .in("batch_id", ids),
  ]);

  const out: Record<string, BatchReviewSummary[]> = {};
  for (const b of batches) {
    if (!b.shot_id) continue;
    const summary: BatchReviewSummary = {
      id: b.id,
      title: b.title,
      token: b.token,
      revoked: b.revoked,
      createdAt: b.created_at,
      generationIds: (items ?? [])
        .filter((i) => i.batch_id === b.id)
        .sort((a, c) => a.position - c.position)
        .map((i) => i.generation_id),
      comments: (comments ?? [])
        .filter((c) => c.batch_id === b.id)
        .map((c) => ({
          id: c.id,
          generationId: c.generation_id,
          reviewerName: c.reviewer_name,
          body: c.body,
          timecode: c.timecode,
          createdAt: c.created_at,
        })),
      marks: (marks ?? [])
        .filter((m) => m.batch_id === b.id)
        .map((m) => ({
          generationId: m.generation_id,
          reviewerName: m.reviewer_name,
          starred: m.starred,
          isPick: m.is_pick,
        })),
    };
    (out[b.shot_id] ??= []).push(summary);
  }
  return out;
}

export async function loadBatchReviewsForShot(
  supabase: SupabaseClient<Database>,
  shotId: string
): Promise<BatchReviewSummary[]> {
  const { data: batches } = await supabase
    .from("ai_batch_reviews")
    .select("id, title, token, revoked, created_at")
    .eq("shot_id", shotId)
    .order("created_at", { ascending: false });
  if (!batches || batches.length === 0) return [];
  const ids = batches.map((b) => b.id);

  const [{ data: items }, { data: comments }, { data: marks }] = await Promise.all([
    supabase.from("ai_batch_review_items").select("batch_id, generation_id, position").in("batch_id", ids),
    supabase
      .from("ai_batch_review_comments")
      .select("id, batch_id, generation_id, reviewer_name, body, timecode, created_at")
      .in("batch_id", ids),
    supabase
      .from("ai_batch_review_marks")
      .select("batch_id, generation_id, reviewer_name, starred, is_pick")
      .in("batch_id", ids),
  ]);

  return batches.map((b) => ({
    id: b.id,
    title: b.title,
    token: b.token,
    revoked: b.revoked,
    createdAt: b.created_at,
    generationIds: (items ?? [])
      .filter((i) => i.batch_id === b.id)
      .sort((a, c) => a.position - c.position)
      .map((i) => i.generation_id),
    comments: (comments ?? [])
      .filter((c) => c.batch_id === b.id)
      .map((c) => ({
        id: c.id,
        generationId: c.generation_id,
        reviewerName: c.reviewer_name,
        body: c.body,
        timecode: c.timecode,
        createdAt: c.created_at,
      })),
    marks: (marks ?? [])
      .filter((m) => m.batch_id === b.id)
      .map((m) => ({
        generationId: m.generation_id,
        reviewerName: m.reviewer_name,
        starred: m.starred,
        isPick: m.is_pick,
      })),
  }));
}
