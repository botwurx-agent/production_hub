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

/* ---------- Send to pipeline ---------- */

/** A path the asset upload ticket minted for this project: `<studio>/<project>/<file>`. */
function ownUpload(path: string | null | undefined, studioId: string, projectId: string): string | null {
  if (!path || typeof path !== "string") return null;
  const parts = path.split("/");
  if (parts.length !== 3 || parts[0] !== studioId || parts[1] !== projectId) return null;
  if (!parts[2] || parts[2].startsWith(".") || parts[2].includes("..")) return null;
  return path;
}

const shotLabel = (i: number, title: string | null) => `Shot ${i + 1}${title?.trim() ? `, ${title.trim()}` : ""}`;

/** The project's generated shots, labelled the way the picker shows them. */
async function shotList(supabase: ReturnType<typeof createClient>, projectId: string) {
  const { data } = await supabase
    .from("ai_shots").select("id, title, method").eq("project_id", projectId).order("position", { ascending: true });
  return (data ?? []).map((s, i) => ({ id: s.id, label: shotLabel(i, s.title), method: s.method }));
}

/**
 * Puts a recorded blocking clip on a pipeline shot as a MOTION reference on
 * the video stage, and optionally the first frame as a reference on the
 * image stage. Either an existing generated shot on this project, or a new
 * one made here. Blocking sent earlier from the same scene to the same shot
 * is replaced, unless a take was already built from it (then it stays, since
 * that take's lineage points at it).
 */
export async function sendBlockingToPipeline(
  projectId: string,
  sceneId: string,
  input: {
    shotId: string | null;
    newTitle: string | null;
    clipPath: string;
    framePath: string | null;
    seconds: number;
    width: number;
    height: number;
    fps: number;
    aspect: string;
  },
): Promise<{ shotId: string; label: string; replaced: number; shots: { id: string; label: string }[] } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id, studio_id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "Project not found." };
  const { data: scene } = await supabase
    .from("blocking_scenes").select("id, name").eq("id", sceneId).eq("project_id", projectId).maybeSingle();
  if (!scene) return { error: "This blocking scene is not on the project." };
  const { data: canEdit } = await supabase.rpc("can_edit_project", { p_project_id: projectId });
  if (!canEdit) return { error: "You have review access to this project, so nothing can be added to it." };

  const clipPath = ownUpload(input.clipPath, project.studio_id, projectId);
  if (!clipPath) return { error: "The clip did not upload to this project." };
  const framePath = input.framePath ? ownUpload(input.framePath, project.studio_id, projectId) : null;
  if (input.framePath && !framePath) return { error: "The frame did not upload to this project." };

  // The shot: one of this project's generated shots, or a new one.
  let shotId: string;
  if (input.shotId) {
    const { data: shot } = await supabase
      .from("ai_shots").select("id, method").eq("id", input.shotId).eq("project_id", projectId).maybeSingle();
    if (!shot) return { error: "That shot is not on this project." };
    if (shot.method === "live") return { error: "That shot is filmed live, so it has no generation to feed." };
    shotId = shot.id;
  } else {
    const title = (input.newTitle ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || scene.name;
    const { data: last } = await supabase
      .from("ai_shots").select("position").eq("project_id", projectId)
      .order("position", { ascending: false }).limit(1).maybeSingle();
    const { data: made, error } = await supabase
      .from("ai_shots")
      .insert({
        studio_id: project.studio_id,
        project_id: projectId,
        position: (last?.position ?? -1) + 1,
        method: "generated",
        title,
        // The move comes from the clip, so the shot is driven by video.
        input_mode: "video_to_video",
        created_by: ctx.userId,
      })
      .select("id").single();
    if (error || !made) {
      reportError("sendBlockingToPipeline.shot", error);
      return { error: "Could not make the shot." };
    }
    shotId = made.id;
  }

  // Replace this scene's earlier blocking on the shot, unless something was built from it.
  const { data: earlier } = await supabase
    .from("ai_generations").select("id, params").eq("shot_id", shotId).eq("status", "reference");
  const mine = (earlier ?? []).filter((g) => {
    const p = g.params as { source?: unknown; blocking_scene_id?: unknown } | null;
    return p?.source === "blocking" && p.blocking_scene_id === sceneId;
  }).map((g) => g.id);
  let replaced = 0;
  if (mine.length) {
    const [{ data: refd }, { data: parents }] = await Promise.all([
      supabase.from("ai_generation_refs").select("ref_generation_id").in("ref_generation_id", mine),
      supabase.from("ai_generations").select("parent_start_id, parent_end_id")
        .or(`parent_start_id.in.(${mine.join(",")}),parent_end_id.in.(${mine.join(",")})`),
    ]);
    const used = new Set<string>([
      ...(refd ?? []).map((r) => r.ref_generation_id),
      ...(parents ?? []).flatMap((p) => [p.parent_start_id, p.parent_end_id]).filter((x): x is string => Boolean(x)),
    ]);
    const drop = mine.filter((id) => !used.has(id));
    if (drop.length) {
      const { error } = await supabase.from("ai_generations").delete().in("id", drop);
      if (!error) replaced = drop.length;
    }
  }

  const params = { source: "blocking", blocking_scene_id: sceneId, blocking_scene: scene.name } as unknown as Json;
  const aspect = input.aspect && input.aspect.length <= 8 ? input.aspect : null;
  const w = Math.round(Number(input.width) || 0);
  const h = Math.round(Number(input.height) || 0);
  const secs = Number.isFinite(Number(input.seconds)) && Number(input.seconds) > 0 ? Math.min(600, Number(input.seconds)) : null;
  const fps = [24, 25, 30].includes(Number(input.fps)) ? Number(input.fps) : null;
  const rows = [
    {
      studio_id: project.studio_id,
      shot_id: shotId,
      stage: "video",
      kind: "video",
      status: "reference",
      role: "motion",
      file_path: clipPath,
      prompt: `Blocking clip from "${scene.name}": follow this camera move.`,
      platform: "Studio Flows blocking",
      aspect,
      resolution: w && h ? `${Math.min(w, h)}p` : null,
      duration_sec: secs,
      fps,
      params,
      generated_by: ctx.userId,
    },
    ...(framePath
      ? [{
        studio_id: project.studio_id,
        shot_id: shotId,
        stage: "image",
        kind: "image",
        status: "reference",
        role: "ref",
        file_path: framePath,
        prompt: `First frame of the blocking "${scene.name}". Make it real: keep the camera, framing and positions.`,
        platform: "Studio Flows blocking",
        aspect,
        resolution: w && h ? `${w}x${h}` : null,
        params,
        generated_by: ctx.userId,
      }]
      : []),
  ];
  const { error: insErr } = await supabase.from("ai_generations").insert(rows);
  if (insErr) {
    reportError("sendBlockingToPipeline.insert", insErr);
    return { error: "The clip uploaded but could not be put on the shot." };
  }

  await supabase.from("blocking_scenes").update({ shot_id: shotId }).eq("id", sceneId);
  revalidatePath(`/projects/${projectId}/pipeline`);

  const shots = await shotList(supabase, projectId);
  const generated = shots.filter((s) => s.method !== "live").map(({ id, label }) => ({ id, label }));
  const label = shots.find((s) => s.id === shotId)?.label ?? "the shot";
  return { shotId, label, replaced, shots: generated };
}
