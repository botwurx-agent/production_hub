"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import type { Json } from "@/lib/database.types";

export type PipelineState = { error?: string; id?: string } | null;

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/pipeline`);
  revalidatePath(`/projects/${projectId}`);
}

// ---- Script ----------------------------------------------------------------

export async function saveScript(projectId: string, content: string): Promise<void> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  await supabase.from("ai_scripts").upsert(
    {
      studio_id: ctx.studio.id,
      project_id: projectId,
      content,
      created_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );
  rp(projectId);
}

// ---- Shots -----------------------------------------------------------------

export async function addShot(
  projectId: string,
  method: "generated" | "live" = "generated",
): Promise<PipelineState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("ai_shots")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("ai_shots")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      position: (last?.position ?? -1) + 1,
      method,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add shot." };
  rp(projectId);
  return { id: data.id };
}

export async function updateShot(
  projectId: string,
  id: string,
  patch: {
    title?: string;
    beat?: string | null;
    method?: string;
    stage?: string;
    status?: string;
    duration_sec?: number | null;
    input_mode?: string | null;
  },
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("ai_shots").update(patch).eq("id", id);
  rp(projectId);
}

export async function deleteShot(projectId: string, id: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("ai_shots").delete().eq("id", id);
  rp(projectId);
}

export async function reorderShots(projectId: string, ids: string[]): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await Promise.all(
    ids.map((id, i) =>
      supabase.from("ai_shots").update({ position: i }).eq("id", id),
    ),
  );
  rp(projectId);
}

// ---- Prompts (one current row per shot + stage; versioned column) ----------

export async function savePrompt(
  projectId: string,
  shotId: string,
  stage: "image" | "video",
  patch: { text?: string; target_model?: string | null; params?: Json | null },
): Promise<PipelineState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("ai_prompts")
    .select("id")
    .eq("shot_id", shotId)
    .eq("stage", stage)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    await supabase.from("ai_prompts").update(patch).eq("id", existing.id);
    rp(projectId);
    return { id: existing.id };
  }
  const { data, error } = await supabase
    .from("ai_prompts")
    .insert({
      studio_id: ctx.studio.id,
      shot_id: shotId,
      stage,
      version: 1,
      text: patch.text ?? "",
      target_model: patch.target_model ?? null,
      params: patch.params ?? null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not save prompt." };
  rp(projectId);
  return { id: data.id };
}

// ---- Generations (image candidates + video takes) --------------------------

export async function addGeneration(
  projectId: string,
  input: {
    shotId: string;
    stage: "image" | "video";
    promptId?: string | null;
    prompt?: string | null;
    file_path?: string | null;
    external_url?: string | null;
    thumb_url?: string | null;
    platform?: string | null;
    model?: string | null;
    model_version?: string | null;
    seed?: string | null;
    aspect?: string | null;
    resolution?: string | null;
    fps?: number | null;
    duration_sec?: number | null;
    guidance?: number | null;
    cost?: number | null;
    params?: Json | null;
    parent_start_id?: string | null;
    parent_end_id?: string | null;
    generated_by_name?: string | null;
    // A reference input (v2v driving/style/character clip) rather than a
    // candidate/take: pass a role + status='reference' to keep it out of the pool.
    role?: string | null;
    status?: string | null;
    kind?: string | null;
  },
): Promise<PipelineState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ai_generations")
    .insert({
      studio_id: ctx.studio.id,
      shot_id: input.shotId,
      stage: input.stage,
      kind: input.kind ?? (input.stage === "video" ? "video" : "image"),
      role: input.role ?? null,
      status: input.status ?? undefined,
      prompt_id: input.promptId ?? null,
      prompt: input.prompt ?? null,
      file_path: input.file_path ?? null,
      external_url: input.external_url ?? null,
      thumb_url: input.thumb_url ?? input.external_url ?? null,
      platform: input.platform ?? null,
      model: input.model ?? null,
      model_version: input.model_version ?? null,
      seed: input.seed ?? null,
      aspect: input.aspect ?? null,
      resolution: input.resolution ?? null,
      fps: input.fps ?? null,
      duration_sec: input.duration_sec ?? null,
      guidance: input.guidance ?? null,
      cost: input.cost ?? null,
      params: input.params ?? null,
      parent_start_id: input.parent_start_id ?? null,
      parent_end_id: input.parent_end_id ?? null,
      generated_by: ctx.userId,
      generated_by_name: input.generated_by_name ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add generation." };
  rp(projectId);
  return { id: data.id };
}

// Bulk: many files (already uploaded client-side) -> one candidate each,
// sharing the provenance entered once. Inserts all rows + revalidates once.
export async function addGenerationsBulk(
  projectId: string,
  input: {
    shotId: string;
    stage: "image" | "video";
    promptId?: string | null;
    prompt?: string | null;
    filePaths: string[];
    platform?: string | null;
    model?: string | null;
    model_version?: string | null;
    seed?: string | null;
    aspect?: string | null;
    resolution?: string | null;
    fps?: number | null;
    duration_sec?: number | null;
    guidance?: number | null;
    cost?: number | null;
    params?: Json | null;
    parent_start_id?: string | null;
    parent_end_id?: string | null;
    generated_by_name?: string | null;
  },
): Promise<PipelineState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  if (!input.filePaths.length) return { error: "No files to add." };
  const rows = input.filePaths.map((fp) => ({
    studio_id: ctx.studio.id,
    shot_id: input.shotId,
    stage: input.stage,
    kind: input.stage === "video" ? "video" : "image",
    prompt_id: input.promptId ?? null,
    prompt: input.prompt ?? null,
    file_path: fp,
    platform: input.platform ?? null,
    model: input.model ?? null,
    model_version: input.model_version ?? null,
    seed: input.seed ?? null,
    aspect: input.aspect ?? null,
    resolution: input.resolution ?? null,
    fps: input.fps ?? null,
    duration_sec: input.duration_sec ?? null,
    guidance: input.guidance ?? null,
    cost: input.cost ?? null,
    params: input.params ?? null,
    parent_start_id: input.stage === "video" ? input.parent_start_id ?? null : null,
    parent_end_id: input.stage === "video" ? input.parent_end_id ?? null : null,
    generated_by: ctx.userId,
    generated_by_name: input.generated_by_name ?? null,
  }));
  const { error } = await supabase.from("ai_generations").insert(rows);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function setGenerationStatus(
  projectId: string,
  id: string,
  status: "candidate" | "approved" | "rejected",
): Promise<void> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("ai_generations")
    .update({
      status,
      approved_by: status === "approved" ? ctx.userId : null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  rp(projectId);
}

// Tag start/end (image) or take/final (video). start+end are unique per shot.
export async function setGenerationRole(
  projectId: string,
  shotId: string,
  id: string,
  role: "start" | "end" | "take" | "final" | null,
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  if (role === "start" || role === "end" || role === "final") {
    // Only one of this role per shot; clear any other holder first.
    await supabase
      .from("ai_generations")
      .update({ role: null })
      .eq("shot_id", shotId)
      .eq("role", role);
  }
  await supabase
    .from("ai_generations")
    .update({
      role,
      ...(role ? { status: "approved" } : {}),
    })
    .eq("id", id);
  rp(projectId);
}

export async function updateGeneration(
  projectId: string,
  id: string,
  patch: {
    prompt?: string | null;
    platform?: string | null;
    model?: string | null;
    model_version?: string | null;
    seed?: string | null;
    aspect?: string | null;
    resolution?: string | null;
    fps?: number | null;
    duration_sec?: number | null;
    guidance?: number | null;
    cost?: number | null;
    params?: Json | null;
    external_url?: string | null;
  },
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("ai_generations").update(patch).eq("id", id);
  rp(projectId);
}

export async function deleteGeneration(projectId: string, id: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("ai_generations").delete().eq("id", id);
  rp(projectId);
}

// ---- Flexible references (polymorphic image|video, roled) ------------------
// A generation (an output) references any number of other generations (inputs),
// each an image or video, with a role: start | end | motion | style | character
// | ref. This is what makes video-to-video / motion-driven / multi-ref flows
// first-class, while every input stays lineage-tracked.

export async function addGenerationRef(
  projectId: string,
  generationId: string,
  refGenerationId: string,
  role = "ref",
): Promise<PipelineState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("ai_generation_refs")
    .select("position")
    .eq("generation_id", generationId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("ai_generation_refs")
    .insert({
      studio_id: ctx.studio.id,
      generation_id: generationId,
      ref_generation_id: refGenerationId,
      role,
      position: (last?.position ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add reference." };
  rp(projectId);
  return { id: data.id };
}

export async function removeGenerationRef(
  projectId: string,
  id: string,
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("ai_generation_refs").delete().eq("id", id);
  rp(projectId);
}

// Replace a generation's whole reference set in one call (used when a take is
// created from the shot's assembled inputs).
export async function setGenerationRefs(
  projectId: string,
  generationId: string,
  refs: { refGenerationId: string; role: string }[],
): Promise<void> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("ai_generation_refs")
    .delete()
    .eq("generation_id", generationId);
  if (refs.length) {
    await supabase.from("ai_generation_refs").insert(
      refs.map((r, i) => ({
        studio_id: ctx.studio.id,
        generation_id: generationId,
        ref_generation_id: r.refGenerationId,
        role: r.role,
        position: i,
      })),
    );
  }
  rp(projectId);
}
