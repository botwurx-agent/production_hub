"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";

export type BoardActionState = { error?: string } | null;

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/production`);
  revalidatePath(`/projects/${projectId}/production/board`);
  revalidatePath(`/projects/${projectId}/shot-list`);
}

async function ensureBoard(
  projectId: string
): Promise<{ id: string; studioId: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("shot_boards")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing) return { id: existing.id, studioId: ctx.studio.id };
  const { data } = await supabase
    .from("shot_boards")
    .insert({ studio_id: ctx.studio.id, project_id: projectId, created_by: ctx.userId })
    .select("id")
    .single();
  return { id: data!.id, studioId: ctx.studio.id };
}

export type ShotBoardPatch = Partial<{
  title: string | null;
  subtitle: string | null;
  client: string | null;
  agency: string | null;
  production_co: string | null;
  director: string | null;
  dp: string | null;
  location: string | null;
  deliverables: string | null;
  job_no: string | null;
  rev_date: string | null;
  shoot_days: string | null;
}>;

export async function saveBoard(
  projectId: string,
  patch: ShotBoardPatch
): Promise<BoardActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase.from("shot_boards").upsert(
    {
      studio_id: ctx.studio.id,
      project_id: projectId,
      ...patch,
      updated_at: new Date().toISOString(),
      created_by: ctx.userId,
    },
    { onConflict: "project_id" }
  );
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

// ---- Flavors ----------------------------------------------------------------

export async function addFlavor(projectId: string): Promise<BoardActionState> {
  const board = await ensureBoard(projectId);
  const supabase = createClient();
  const { data: last } = await supabase
    .from("shot_board_flavors")
    .select("position")
    .eq("board_id", board.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("shot_board_flavors").insert({
    studio_id: board.studioId,
    board_id: board.id,
    position: (last?.position ?? -1) + 1,
    name: "",
    hue: "green",
  });
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function updateFlavor(
  projectId: string,
  id: string,
  patch: { name?: string; hue?: string }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("shot_board_flavors").update(patch).eq("id", id);
  rp(projectId);
}

export async function deleteFlavor(projectId: string, id: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("shot_board_flavors").delete().eq("id", id);
  rp(projectId);
}

// ---- Groups (Shots) ---------------------------------------------------------

export async function addGroup(projectId: string): Promise<BoardActionState> {
  const ctx = await requireStudioContext();
  await ensureBoard(projectId);
  const supabase = createClient();
  const { data: last } = await supabase
    .from("shot_groups")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("shot_groups").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    position: (last?.position ?? -1) + 1,
    title: "",
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function updateGroup(
  projectId: string,
  id: string,
  patch: { title?: string; subtitle?: string; description?: string }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("shot_groups").update(patch).eq("id", id);
  rp(projectId);
}

export async function deleteGroup(projectId: string, id: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("shot_groups").delete().eq("id", id);
  rp(projectId);
}

export async function swapGroups(
  projectId: string,
  a: { id: string; position: number },
  b: { id: string; position: number }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("shot_groups").update({ position: b.position }).eq("id", a.id);
  await supabase.from("shot_groups").update({ position: a.position }).eq("id", b.id);
  rp(projectId);
}

// ---- Cards ------------------------------------------------------------------

export async function addCard(
  projectId: string,
  groupId: string
): Promise<BoardActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("shot_cards")
    .select("position")
    .eq("group_id", groupId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("shot_cards").insert({
    studio_id: ctx.studio.id,
    group_id: groupId,
    position: (last?.position ?? -1) + 1,
    tags: [],
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function updateCard(
  projectId: string,
  id: string,
  patch: {
    code?: string;
    day?: string;
    flavor_name?: string;
    flavor_hue?: string;
    description?: string;
    vo?: string;
    shot_size?: string;
    shot_type?: string;
    movement?: string;
    tags?: string[];
  }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("shot_cards").update(patch).eq("id", id);
  rp(projectId);
}

// Links a project asset to a shot row and copies its current version's image so
// the shot displays it. Keeps asset_id for the connection-ready reference.
export async function setCardAsset(
  projectId: string,
  cardId: string,
  assetId: string
): Promise<BoardActionState> {
  await requireStudioContext();
  const supabase = createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select("name, current_version_id")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) return { error: "That asset is no longer available." };

  // Prefer the asset's current version; fall back to its newest.
  let version: { storage_path: string | null; mime_type: string | null } | null =
    null;
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
    .from("shot_cards")
    .update({
      asset_id: assetId,
      storage_path: version?.storage_path ?? null,
      mime_type: version?.mime_type ?? null,
      image_name: asset.name,
    })
    .eq("id", cardId);
  rp(projectId);
  return null;
}

// Clears the linked asset and its image from a shot row.
export async function clearCardAsset(
  projectId: string,
  cardId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("shot_cards")
    .update({ asset_id: null, storage_path: null, mime_type: null, image_name: null })
    .eq("id", cardId);
  rp(projectId);
}

export async function deleteCard(projectId: string, id: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("shot_cards").delete().eq("id", id);
  rp(projectId);
}

export async function swapCards(
  projectId: string,
  a: { id: string; position: number },
  b: { id: string; position: number }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("shot_cards").update({ position: b.position }).eq("id", a.id);
  await supabase.from("shot_cards").update({ position: a.position }).eq("id", b.id);
  rp(projectId);
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "image";
}

export async function uploadCardImage(formData: FormData): Promise<BoardActionState> {
  const ctx = await requireStudioContext();
  const projectId = String(formData.get("projectId") ?? "");
  const cardId = String(formData.get("cardId") ?? "");
  const file = formData.get("file");
  if (!projectId || !cardId || !(file instanceof File) || file.size === 0) {
    return { error: "Missing image." };
  }
  const supabase = createClient();
  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${ctx.studio.id}/shotboard/${projectId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: upErr } = await supabase.storage
    .from("assets")
    .upload(path, bytes, { contentType: file.type || undefined, upsert: false });
  if (upErr) return { error: upErr.message };
  const { error } = await supabase
    .from("shot_cards")
    .update({
      storage_path: path,
      mime_type: file.type || null,
      image_name: file.name,
    })
    .eq("id", cardId);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}
