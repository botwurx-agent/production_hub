"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assetStorage } from "@/lib/asset-storage";
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
  const { data: group, error } = await supabase
    .from("shot_groups")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      position: (last?.position ?? -1) + 1,
      title: "",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // A shot list starts with a minimum of 3 empty shots to fill in.
  if (group) {
    await supabase.from("shot_cards").insert(
      [0, 1, 2].map((position) => ({
        studio_id: ctx.studio.id,
        group_id: group.id,
        position,
        tags: [],
        created_by: ctx.userId,
      }))
    );
  }

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

// Undo/redo: replay a snapshot of the shot board (its lists + shots). Reconciles
// the DB to match: upsert groups then cards (original ids so references survive),
// delete extras. Column ordering by `position` is part of each row.
type ShotGroupSnap = {
  id: string;
  position: number;
  title: string;
  subtitle: string | null;
  description: string | null;
};
type ShotCardSnap = {
  id: string;
  group_id: string;
  position: number;
  code: string | null;
  day: string | null;
  flavor_name: string | null;
  flavor_hue: string | null;
  storagePath: string | null;
  mimeType: string | null;
  image_name: string | null;
  description: string | null;
  vo: string | null;
  shot_size: string | null;
  shot_type: string | null;
  movement: string | null;
  asset_id: string | null;
  tags: string[];
};

export async function restoreShotBoard(
  projectId: string,
  groups: ShotGroupSnap[],
  cards: ShotCardSnap[]
): Promise<BoardActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const studioId = ctx.studio.id;

  const groupRows = groups.map((g) => ({
    id: g.id,
    studio_id: studioId,
    project_id: projectId,
    position: g.position,
    title: g.title,
    subtitle: g.subtitle,
    description: g.description,
  }));
  if (groupRows.length) {
    const { error } = await supabase
      .from("shot_groups")
      .upsert(groupRows, { onConflict: "id" });
    if (error) return { error: error.message };
  }

  const cardRows = cards.map((c) => ({
    id: c.id,
    studio_id: studioId,
    group_id: c.group_id,
    position: c.position,
    code: c.code,
    day: c.day,
    flavor_name: c.flavor_name,
    flavor_hue: c.flavor_hue,
    storage_path: c.storagePath,
    mime_type: c.mimeType,
    image_name: c.image_name,
    description: c.description,
    vo: c.vo,
    shot_size: c.shot_size,
    shot_type: c.shot_type,
    movement: c.movement,
    asset_id: c.asset_id,
    tags: c.tags,
  }));
  if (cardRows.length) {
    const { error } = await supabase
      .from("shot_cards")
      .upsert(cardRows, { onConflict: "id" });
    if (error) return { error: error.message };
  }

  const { data: existingGroups } = await supabase
    .from("shot_groups")
    .select("id")
    .eq("project_id", projectId);
  const groupIds = (existingGroups ?? []).map((g) => g.id);
  const keepGroups = new Set(groupRows.map((g) => g.id));

  const { data: existingCards } = groupIds.length
    ? await supabase.from("shot_cards").select("id").in("group_id", groupIds)
    : { data: [] as { id: string }[] };
  const keepCards = new Set(cardRows.map((c) => c.id));
  const delCards = (existingCards ?? [])
    .map((c) => c.id)
    .filter((id) => !keepCards.has(id));
  if (delCards.length) {
    await supabase.from("shot_cards").delete().in("id", delCards);
  }
  const delGroups = groupIds.filter((id) => !keepGroups.has(id));
  if (delGroups.length) {
    await supabase.from("shot_groups").delete().in("id", delGroups);
  }

  rp(projectId);
  return null;
}

// Duplicates a shot into the same list, right after the source.
export async function duplicateCard(
  projectId: string,
  id: string
): Promise<BoardActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: src } = await supabase
    .from("shot_cards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!src) return { error: "That shot no longer exists." };
  const { data: last } = await supabase
    .from("shot_cards")
    .select("position")
    .eq("group_id", src.group_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("shot_cards").insert({
    studio_id: ctx.studio.id,
    group_id: src.group_id,
    position: (last?.position ?? -1) + 1,
    code: src.code,
    day: src.day,
    flavor_name: src.flavor_name,
    flavor_hue: src.flavor_hue,
    storage_path: src.storage_path,
    mime_type: src.mime_type,
    image_name: src.image_name,
    description: src.description,
    vo: src.vo,
    shot_size: src.shot_size,
    shot_type: src.shot_type,
    movement: src.movement,
    asset_id: src.asset_id,
    tags: src.tags ?? [],
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

// Moves a shot to another list (group), appending it to the end.
export async function moveCard(
  projectId: string,
  cardId: string,
  targetGroupId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("shot_cards")
    .select("position")
    .eq("group_id", targetGroupId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase
    .from("shot_cards")
    .update({ group_id: targetGroupId, position: (last?.position ?? -1) + 1 })
    .eq("id", cardId);
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
  const { error: upErr } = await assetStorage()
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
