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
import { cleanSceneFiles, sceneFolder } from "@/lib/previz/scene-files";
import { finalizeUpload } from "@/lib/upload-ticket";
import { assetStorage } from "@/lib/asset-storage";
import { pathWithinScope } from "@/lib/upload-limits";
import { reportError } from "@/lib/log";
import type { Json } from "@/lib/database.types";
import { planSend, updatePatch, type ShotRowOut } from "@/lib/previz/shot-export";

/**
 * A saved setup crosses a Server Action, so the ~4.5MB serverless request body
 * is the real ceiling. Storyboard frames uploaded into a shot are the only
 * thing in a setup that can get near it; the builder drops the large ones
 * before saving and says so (setupForStore in components/previz/setup.ts).
 */
const MAX_SETUP_CHARS = 3_500_000;

const rp = (projectId: string) => revalidatePath(`/projects/${projectId}/scene-builder`);

function cleanSetup(raw: unknown, studioId: string, projectId: string): { setup: Setup; json: string } | { error: string } {
  const setup = asSetup(raw);
  if (!setup) return { error: "That is not a scene setup this page can save." };
  // Embedded photos and models never go to the database as bytes: they are
  // uploaded to the project's storage on their own, and the setup carries only
  // where they went, checked to be this project's own folder.
  const { assets: _a, files, ...rest } = setup;
  const clean = cleanSceneFiles(files, studioId, projectId);
  const plain: Setup = Object.keys(clean).length ? { ...rest, files: clean } : rest;
  const json = JSON.stringify(plain);
  if (json.length > MAX_SETUP_CHARS) return { error: "This setup is too large to save. Remove some uploaded storyboard frames and try again." };
  return { setup: plain as Setup, json };
}

const nameOf = (s: Setup) => (s.name || "").replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled setup";

export async function createSceneSetup(projectId: string, raw: unknown): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id, studio_id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "Project not found." };
  const clean = cleanSetup(raw, project.studio_id, project.id);
  if ("error" in clean) return clean;
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
  const { data: row } = await supabase.from("scene_setups").select("studio_id, project_id").eq("id", id).maybeSingle();
  if (!row) return { error: "This setup could not be found. It may have been deleted." };
  const clean = cleanSetup(raw, row.studio_id, row.project_id);
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

/**
 * Confirms a scene file the browser just uploaded straight to Storage (a
 * product photo or a 3D model), before the setup starts pointing at it. The
 * path came back from the browser, so it is re-authorized and size-checked
 * like any other direct upload.
 */
export async function finishSceneFile(projectId: string, path: string): Promise<{ ok: true } | { error: string }> {
  const res = await finalizeUpload({ kind: "scene_file", projectId }, path);
  if ("error" in res) return res;
  return { ok: true };
}

/**
 * Short-lived links to a setup's stored photos and models, for a browser that
 * does not have them. Anyone who can read the project can read them, which is
 * who can open the setup; only paths in this project's own scene folder are
 * signed, so a doctored setup cannot be used to read another job's files.
 */
export async function signSceneFiles(projectId: string, paths: string[]): Promise<Record<string, string> | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id, studio_id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "You do not have access to this project." };
  const ok = Array.from(new Set(paths)).slice(0, 200).filter((p) => pathWithinScope(p, project.studio_id, sceneFolder(project.id)));
  if (!ok.length) return {};
  const { data, error } = await assetStorage().createSignedUrls(ok, 3600);
  if (error) {
    reportError("signSceneFiles", error);
    return { error: "Could not fetch the scene's photos and models." };
  }
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Writes Scene builder cameras into a shot list: a row per camera, matched to
 * an existing row by its code (1A updates 1A) and appended otherwise. What the
 * builder sends is checked here rather than trusted: text is capped, and a
 * picture path is accepted only as a file directly in THIS project's scene
 * folder, which is where the builder uploaded it. RLS on the shot list tables
 * is the access check, so review-only access is refused by the database.
 */
export async function sendShotsToList(
  projectId: string,
  input: { listId?: string | null; newTitle?: string | null; rows: unknown },
): Promise<{ listId: string; title: string; added: number; updated: number } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id, studio_id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "Project not found." };

  const raw = Array.isArray(input.rows) ? input.rows.slice(0, 40) : [];
  const rows: ShotRowOut[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const code = clip(o.code, 20);
    if (!code) continue;
    const path = typeof o.path === "string" && pathWithinScope(o.path, project.studio_id, sceneFolder(project.id)) ? o.path : null;
    rows.push({
      code,
      title: clip(o.title, 200),
      shotSize: clip(o.shotSize, 60),
      shotType: clip(o.shotType, 60),
      movement: clip(o.movement, 60),
      notesLine: clip(o.notesLine, 600),
      path,
    });
  }
  if (!rows.length) return { error: "No cameras to send." };

  let group: { id: string; title: string | null } | null = null;
  if (input.listId) {
    const { data } = await supabase
      .from("shot_groups")
      .select("id, title")
      .eq("id", input.listId)
      .eq("project_id", project.id)
      .maybeSingle();
    if (!data) return { error: "That shot list could not be found. It may have been deleted." };
    group = data;
  } else {
    // The cover row the shot list page hangs on, made on first use as the
    // page itself does.
    const { data: board } = await supabase.from("shot_boards").select("id").eq("project_id", project.id).maybeSingle();
    if (!board) {
      const { error } = await supabase
        .from("shot_boards")
        .insert({ studio_id: project.studio_id, project_id: project.id, created_by: ctx.userId });
      if (error) return { error: "The shot list could not be created. You may only have review access to this project." };
    }
    const { data: last } = await supabase
      .from("shot_groups")
      .select("position")
      .eq("project_id", project.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabase
      .from("shot_groups")
      .insert({
        studio_id: project.studio_id,
        project_id: project.id,
        position: (last?.position ?? -1) + 1,
        title: clip(input.newTitle, 120) || "Shot list",
        created_by: ctx.userId,
      })
      .select("id, title")
      .single();
    if (error || !data) return { error: "The shot list could not be created. You may only have review access to this project." };
    group = data;
  }

  const { data: existing } = await supabase
    .from("shot_cards")
    .select("id, code, description, notes, position")
    .eq("group_id", group.id)
    .order("position", { ascending: true });
  const plan = planSend(existing ?? [], rows);

  let updated = 0;
  for (const p of plan) {
    if (!p.update) continue;
    const { data, error } = await supabase
      .from("shot_cards")
      .update(updatePatch(p.update, p.out))
      .eq("id", p.update.id)
      .select("id");
    if (error || !data?.length) {
      if (error) reportError("sendShotsToList update", error);
      return { error: `Shot ${p.out.code} could not be updated. You may only have review access to this project.` };
    }
    updated++;
  }

  let position = Math.max(-1, ...(existing ?? []).map((r) => r.position)) + 1;
  const inserts = plan
    .filter((p) => !p.update)
    .map((p) => ({
      studio_id: project.studio_id,
      group_id: group!.id,
      position: position++,
      code: p.out.code,
      description: p.out.title || null,
      shot_size: p.out.shotSize || null,
      shot_type: p.out.shotType || null,
      movement: p.out.movement || null,
      notes: p.out.notesLine || null,
      storage_path: p.out.path,
      mime_type: p.out.path ? "image/jpeg" : null,
      image_name: p.out.path ? `${p.out.code}_previz.jpg` : null,
      tags: [],
      created_by: ctx.userId,
    }));
  if (inserts.length) {
    const { error } = await supabase.from("shot_cards").insert(inserts);
    if (error) {
      reportError("sendShotsToList insert", error);
      return { error: updated ? `${updated} updated, but the new rows could not be added.` : "The shots could not be added. You may only have review access to this project." };
    }
  }
  revalidatePath(`/projects/${project.id}/shot-list`);
  return { listId: group.id, title: group.title || "Shot list", added: inserts.length, updated };
}
