"use server";

// Shot blocking: saving a project's blocking scenes (migration 0128). A scene
// is stored whole as jsonb, so a save is one row update; RLS is the access
// check (read for anyone on the job, write for studio members and editors).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { asBlockScene, type BlockScene } from "@/lib/blocking/scene";
import type { Json } from "@/lib/database.types";

/** A save crosses a Server Action; a scene is a few hundred KB at the very most. */
const MAX_CHARS = 2_000_000;

const rp = (projectId: string) => revalidatePath(`/projects/${projectId}/blocking`);

function clean(raw: unknown): { scene: BlockScene; json: string } | { error: string } {
  const scene = asBlockScene(raw);
  if (!scene) return { error: "That is not a blocking scene this page can save." };
  const json = JSON.stringify(scene);
  if (json.length > MAX_CHARS) return { error: "This scene is too large to save." };
  return { scene, json };
}

const nameOf = (s: BlockScene) => s.name.replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled blocking";

export async function createBlockingScene(projectId: string, raw: unknown, shotId?: string | null): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id, studio_id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "Project not found." };
  const c = clean(raw);
  if ("error" in c) return c;
  // A shot id from the browser is kept only if it is a shot on this project.
  let shot: string | null = null;
  if (shotId) {
    const { data } = await supabase.from("ai_shots").select("id").eq("id", shotId).eq("project_id", projectId).maybeSingle();
    shot = data?.id ?? null;
  }
  const { data: last } = await supabase
    .from("blocking_scenes").select("position").eq("project_id", projectId)
    .order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("blocking_scenes")
    .insert({
      studio_id: project.studio_id,
      project_id: projectId,
      shot_id: shot,
      name: nameOf(c.scene),
      data: c.scene as unknown as Json,
      position: (last?.position ?? 0) + 1,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    reportError("createBlockingScene", error);
    return { error: "Could not create the scene. You may only have review access to this project." };
  }
  rp(projectId);
  return { id: data.id };
}

/**
 * Saves the whole scene. Does NOT revalidate: the editor holds the scene
 * client-side and saves on every pause, and a revalidate per save would
 * refetch the route under somebody dragging a camera.
 */
export async function saveBlockingScene(id: string, raw: unknown): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const c = clean(raw);
  if ("error" in c) return c;
  const { data, error } = await supabase
    .from("blocking_scenes")
    .update({ name: nameOf(c.scene), data: c.scene as unknown as Json, updated_by: ctx.userId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) {
    reportError("saveBlockingScene", error);
    return { error: "Could not save the scene." };
  }
  if (!data?.length) return { error: "This scene could not be saved. It may have been deleted, or you may only have review access." };
  return { ok: true };
}

export async function deleteBlockingScene(id: string): Promise<{ ok: true } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data, error } = await supabase.from("blocking_scenes").delete().eq("id", id).select("project_id");
  if (error || !data?.length) {
    if (error) reportError("deleteBlockingScene", error);
    return { error: "Could not delete the scene." };
  }
  rp(data[0].project_id);
  return { ok: true };
}
