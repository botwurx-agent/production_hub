"use server";

// Location stills (migration 0116): frames taken through the phone viewfinder.
// The bytes go straight from the phone to Storage on a ticket minted by
// lib/upload-ticket.ts (scope "location_still"); this file confirms what
// landed and writes the row, which is the commit point.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { assetStorage } from "@/lib/asset-storage";
import { discardUpload, finalizeUpload } from "@/lib/upload-ticket";
import { BODIES, ASPECTS } from "@/lib/previz/optics";
import { reportError } from "@/lib/log";

const rp = (projectId: string) => {
  revalidatePath(`/projects/${projectId}/stills`);
  revalidatePath(`/projects/${projectId}`);
};

export type NewStill = {
  projectId: string;
  path: string;
  width: number;
  height: number;
  bodyId: string;
  focalMm: number;
  aspectId: string;
  tiltDeg: number | null;
  rollDeg: number | null;
  phoneCamera: string | null;
  note: string | null;
};

const fin = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null;

export async function saveLocationStill(input: NewStill): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const scope = { kind: "location_still" as const, projectId: input.projectId };

  // The path came back from the browser, so it is checked like anything else
  // from the browser: same authorization as the ticket, exact folder shape,
  // and the object's real size.
  const landed = await finalizeUpload(scope, input.path);
  if ("error" in landed) return landed;

  const { data: project } = await supabase.from("projects").select("id, studio_id").eq("id", input.projectId).maybeSingle();
  if (!project) {
    await discardUpload(input.path);
    return { error: "Project not found." };
  }

  // Whitelisted rather than trusted: an unknown body or aspect would make the
  // still describe a frame nobody can reproduce.
  const bodyId = BODIES.some((b) => b.id === input.bodyId) ? input.bodyId : "alexamini";
  const aspectId = ASPECTS.some((a) => a.id === input.aspectId) ? input.aspectId : "16x9";
  const focal = fin(input.focalMm, 4, 1000) ?? 35;

  const { data, error } = await supabase
    .from("location_stills")
    .insert({
      studio_id: project.studio_id,
      project_id: project.id,
      storage_path: input.path,
      width: fin(input.width, 1, 20000),
      height: fin(input.height, 1, 20000),
      body_id: bodyId,
      focal_mm: focal,
      aspect_id: aspectId,
      tilt_deg: fin(input.tiltDeg, -90, 90),
      roll_deg: fin(input.rollDeg, -180, 180),
      phone_camera: input.phoneCamera ? input.phoneCamera.slice(0, 80) : null,
      note: input.note ? input.note.replace(/\s+/g, " ").trim().slice(0, 500) || null : null,
      taken_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    reportError("saveLocationStill", error);
    await discardUpload(input.path);
    return { error: "The still could not be saved. You may only have review access to this project." };
  }
  rp(project.id);
  return { id: data.id };
}

export async function updateStillNote(id: string, note: string): Promise<{ ok: true } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const clean = note.replace(/\s+/g, " ").trim().slice(0, 500) || null;
  const { data, error } = await supabase.from("location_stills").update({ note: clean }).eq("id", id).select("project_id");
  if (error || !data?.length) {
    if (error) reportError("updateStillNote", error);
    return { error: "Could not save the note." };
  }
  rp(data[0].project_id);
  return { ok: true };
}

export async function deleteLocationStill(id: string): Promise<{ ok: true } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data, error } = await supabase.from("location_stills").delete().eq("id", id).select("project_id, storage_path");
  if (error || !data?.length) {
    if (error) reportError("deleteLocationStill", error);
    return { error: "Could not delete the still." };
  }
  // Removed only after the row is gone, so a refused delete never leaves a row
  // pointing at a missing file.
  const { error: rmErr } = await assetStorage().remove([data[0].storage_path]);
  if (rmErr) reportError("deleteLocationStill.storage", rmErr);
  rp(data[0].project_id);
  return { ok: true };
}

/**
 * A full-size signed URL for one still, asked for on demand (the grid shows
 * resized copies). The row is read under RLS first, so the path being signed
 * is one the caller is allowed to see.
 */
export async function getStillUrl(id: string): Promise<{ url: string } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: row } = await supabase.from("location_stills").select("storage_path").eq("id", id).maybeSingle();
  if (!row) return { error: "That still could not be found." };
  const { data } = await assetStorage().createSignedUrl(row.storage_path, 60 * 30);
  if (!data?.signedUrl) return { error: "Could not open the still." };
  return { url: data.signedUrl };
}

/** Remember which scene a still was built into, so its tile can link there. */
export async function linkStillToScene(id: string, setupId: string): Promise<{ ok: true } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data, error } = await supabase.from("location_stills").update({ scene_setup_id: setupId }).eq("id", id).select("project_id");
  if (error || !data?.length) return { error: "Could not link the still to its scene." };
  rp(data[0].project_id);
  return { ok: true };
}
