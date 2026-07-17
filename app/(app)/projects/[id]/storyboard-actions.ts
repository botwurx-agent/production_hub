"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assetStorage } from "@/lib/asset-storage";
import { requireStudioContext } from "@/lib/studio";
import type { Board } from "@/lib/database.types";

export type StoryboardState = { error?: string } | null;

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/storyboards`);
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "image";
}

// A storyboard is a boards row (kind='storyboard') scoped to the project.
// New ones seed 3 empty frames.
export async function createStoryboard(
  projectId: string,
  name?: string
): Promise<{ board: Board } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("boards")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: board, error } = await supabase
    .from("boards")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      kind: "storyboard",
      name: name?.trim() || "Storyboard",
      position: (last?.position ?? -1) + 1,
      created_by: ctx.userId,
    })
    .select("*")
    .single();
  if (error) return { error: error.message };

  await supabase.from("storyboard_frames").insert(
    [0, 1, 2].map((position) => ({
      studio_id: ctx.studio.id,
      board_id: board.id,
      position,
      created_by: ctx.userId,
    }))
  );
  rp(projectId);
  return { board: board as Board };
}

export async function renameStoryboard(
  projectId: string,
  boardId: string,
  name: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("boards")
    .update({ name: name.trim() || "Storyboard", updated_at: new Date().toISOString() })
    .eq("id", boardId);
  rp(projectId);
}

export async function deleteStoryboard(
  projectId: string,
  boardId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("boards").delete().eq("id", boardId);
  rp(projectId);
}

export async function addFrame(
  projectId: string,
  boardId: string
): Promise<StoryboardState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("storyboard_frames")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("storyboard_frames").insert({
    studio_id: ctx.studio.id,
    board_id: boardId,
    position: (last?.position ?? -1) + 1,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function updateFrame(
  projectId: string,
  frameId: string,
  patch: { scene?: string; description?: string; sound?: string; notes?: string }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("storyboard_frames").update(patch).eq("id", frameId);
  rp(projectId);
}

export async function deleteFrame(
  projectId: string,
  frameId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("storyboard_frames").delete().eq("id", frameId);
  rp(projectId);
}

export async function swapFrames(
  projectId: string,
  a: { id: string; position: number },
  b: { id: string; position: number }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("storyboard_frames").update({ position: b.position }).eq("id", a.id);
  await supabase.from("storyboard_frames").update({ position: a.position }).eq("id", b.id);
  rp(projectId);
}

// Undo/redo: replay a snapshot of one storyboard's frames. Reconciles the DB for
// that board_id: upsert (original ids so images/refs survive), delete extras.
type FrameSnap = {
  id: string;
  board_id: string;
  position: number;
  scene: string | null;
  description: string | null;
  sound: string | null;
  notes: string | null;
  storagePath: string | null;
  mimeType: string | null;
  image_name: string | null;
  asset_id?: string | null;
};

export async function restoreStoryboard(
  projectId: string,
  boardId: string,
  frames: FrameSnap[]
): Promise<StoryboardState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const studioId = ctx.studio.id;

  const rows = frames.map((f) => ({
    id: f.id,
    studio_id: studioId,
    board_id: boardId,
    position: f.position,
    scene: f.scene,
    description: f.description,
    sound: f.sound,
    notes: f.notes,
    storage_path: f.storagePath,
    mime_type: f.mimeType,
    image_name: f.image_name,
    asset_id: f.asset_id ?? null,
  }));
  if (rows.length) {
    const { error } = await supabase
      .from("storyboard_frames")
      .upsert(rows, { onConflict: "id" });
    if (error) return { error: error.message };
  }

  const { data: existing } = await supabase
    .from("storyboard_frames")
    .select("id")
    .eq("board_id", boardId);
  const keep = new Set(rows.map((r) => r.id));
  const del = (existing ?? []).map((r) => r.id).filter((id) => !keep.has(id));
  if (del.length) {
    await supabase.from("storyboard_frames").delete().in("id", del);
  }

  rp(projectId);
  return null;
}

export async function uploadFrameImage(
  formData: FormData
): Promise<StoryboardState> {
  const ctx = await requireStudioContext();
  const projectId = String(formData.get("projectId") ?? "");
  const frameId = String(formData.get("frameId") ?? "");
  const file = formData.get("file");
  if (!projectId || !frameId || !(file instanceof File) || file.size === 0) {
    return { error: "Missing image." };
  }
  const supabase = createClient();
  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${ctx.studio.id}/storyboard/${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await assetStorage()
    .upload(path, bytes, { contentType: file.type || undefined, upsert: false });
  if (upErr) return { error: upErr.message };
  await supabase
    .from("storyboard_frames")
    .update({
      asset_id: null,
      storage_path: path,
      mime_type: file.type || null,
      image_name: file.name,
    })
    .eq("id", frameId);
  rp(projectId);
  return null;
}

// Attach a project asset's current image to a frame.
export async function setFrameAsset(
  projectId: string,
  frameId: string,
  assetId: string
): Promise<StoryboardState> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: asset } = await supabase
    .from("assets")
    .select("name, current_version_id")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) return { error: "That asset is no longer available." };

  let version: { storage_path: string | null; mime_type: string | null } | null = null;
  if (asset.current_version_id) {
    const { data } = await supabase
      .from("versions")
      .select("storage_path, mime_type")
      .eq("id", asset.current_version_id)
      .maybeSingle();
    version = data;
  }
  if (!version) {
    const { data } = await supabase
      .from("versions")
      .select("storage_path, mime_type")
      .eq("asset_id", assetId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    version = data;
  }

  await supabase
    .from("storyboard_frames")
    .update({
      asset_id: assetId,
      storage_path: version?.storage_path ?? null,
      mime_type: version?.mime_type ?? null,
      image_name: asset.name,
    })
    .eq("id", frameId);
  rp(projectId);
  return null;
}

export async function clearFrameImage(
  projectId: string,
  frameId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("storyboard_frames")
    .update({ asset_id: null, storage_path: null, mime_type: null, image_name: null })
    .eq("id", frameId);
  rp(projectId);
}
