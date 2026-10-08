"use server";

// Scene builder: saving a project's 3D setups, and reading a scout photo into
// a rough room. A setup is stored whole as jsonb (migration 0115), so a save
// is one row update; RLS is the access check (read for anyone on the job,
// write for studio members and project editors).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { aiConfigured, extractRoomFromPhoto } from "@/lib/ai";
import { MAX_UPLOAD_BYTES } from "@/lib/attachment-limits";
import { ROOM_KINDS, parseRoomDraft, type RoomDraft } from "@/lib/previz/room-draft";
import { asSetup, type Setup } from "@/components/previz/setup";
import { reportError } from "@/lib/log";
import type { Json } from "@/lib/database.types";

/**
 * A saved setup crosses a Server Action, so the ~4.5MB serverless request body
 * is the real ceiling. Storyboard frames uploaded into a shot are the only
 * thing in a setup that can get near it; the builder drops the large ones
 * before saving and says so (setupForStore in components/previz/setup.ts).
 */
const MAX_SETUP_CHARS = 3_500_000;

const rp = (projectId: string) => revalidatePath(`/projects/${projectId}/scene-builder`);

function cleanSetup(raw: unknown): { setup: Setup; json: string } | { error: string } {
  const setup = asSetup(raw);
  if (!setup) return { error: "That is not a scene setup this page can save." };
  // Embedded photos and models never go to the database: they stay keyed in
  // the browser that added them.
  const { assets: _a, ...plain } = setup;
  const json = JSON.stringify(plain);
  if (json.length > MAX_SETUP_CHARS) return { error: "This setup is too large to save. Remove some uploaded storyboard frames and try again." };
  return { setup: plain as Setup, json };
}

const nameOf = (s: Setup) => (s.name || "").replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled setup";

export async function createSceneSetup(projectId: string, raw: unknown): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const clean = cleanSetup(raw);
  if ("error" in clean) return clean;
  const { data: project } = await supabase.from("projects").select("id, studio_id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "Project not found." };
  const { data: last } = await supabase
    .from("scene_setups")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("scene_setups")
    .insert({
      studio_id: project.studio_id,
      project_id: projectId,
      name: nameOf(clean.setup),
      data: clean.setup as unknown as Json,
      position: (last?.position ?? 0) + 1,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    reportError("createSceneSetup", error);
    return { error: "Could not create the setup. You may only have review access to this project." };
  }
  rp(projectId);
  return { id: data.id };
}

/**
 * Saves the whole scene. Deliberately does NOT revalidate the page: the builder
 * holds the scene client-side and saves on every pause in editing, and a
 * revalidate per save would refetch the route under someone dragging a light
 * (the moodboard's #482 lesson). The name is kept in step for the setup list.
 */
export async function saveSceneSetup(id: string, raw: unknown): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const clean = cleanSetup(raw);
  if ("error" in clean) return clean;
  const { data, error } = await supabase
    .from("scene_setups")
    .update({
      name: nameOf(clean.setup),
      data: clean.setup as unknown as Json,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) {
    reportError("saveSceneSetup", error);
    return { error: "Could not save the setup." };
  }
  if (!data?.length) return { error: "This setup could not be saved. It may have been deleted, or you may only have review access." };
  return { ok: true };
}

export async function deleteSceneSetup(id: string): Promise<{ ok: true } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data, error } = await supabase.from("scene_setups").delete().eq("id", id).select("project_id");
  if (error || !data?.length) {
    if (error) reportError("deleteSceneSetup", error);
    return { error: "Could not delete the setup." };
  }
  rp(data[0].project_id);
  return { ok: true };
}

export async function readScoutPhoto(input: {
  base64: string;
  mediaType: string;
  fileName: string;
  /** Known when the photo came through the phone viewfinder. */
  lens?: { ffFocal: number; hfovDeg: number; tiltDeg: number | null };
}): Promise<{ draft: RoomDraft } | { error: string }> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Only studio members can use this." };
  if (!aiConfigured()) return { error: "No AI provider is set up on this deployment, so the photo cannot be read." };
  if (!/^image\/(jpeg|png|webp)$/.test(input.mediaType)) return { error: "Use a JPEG, PNG or WebP photo." };
  if (input.base64.length * 0.75 > MAX_UPLOAD_BYTES) return { error: "That photo is too large to send. Try a smaller one." };
  try {
    const raw = await extractRoomFromPhoto(
      { base64: input.base64, mediaType: input.mediaType, fileName: input.fileName.slice(0, 120) },
      ROOM_KINDS,
      input.lens && Number.isFinite(input.lens.ffFocal) && Number.isFinite(input.lens.hfovDeg)
        ? {
            ffFocal: Math.max(5, Math.min(800, input.lens.ffFocal)),
            hfovDeg: Math.max(1, Math.min(170, input.lens.hfovDeg)),
            tiltDeg: input.lens.tiltDeg !== null && Number.isFinite(input.lens.tiltDeg) ? Math.max(-90, Math.min(90, input.lens.tiltDeg)) : null,
          }
        : undefined,
    );
    const draft = parseRoomDraft(raw);
    if (!draft) return { error: "The photo could not be read as a room. Try one taken from a corner, showing the floor." };
    return { draft };
  } catch (e) {
    return { error: e instanceof Error ? `Could not read the photo: ${e.message.slice(0, 200)}` : "Could not read the photo." };
  }
}
