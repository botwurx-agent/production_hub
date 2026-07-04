"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { getAccessToken as getGoogleToken } from "@/lib/gmail";
import { getDriveFileBytes } from "@/lib/googledrive";
import {
  getAccessToken as getFigmaToken,
  getImageUrls,
  fetchImageBytes,
} from "@/lib/figma";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Board } from "@/lib/database.types";

export type BoardState = { error?: string } | null;
const SIGNED_TTL = 60 * 60;
const DEFAULT_W = 260;
const DEFAULT_H = 200;

export type BoardItemView = {
  id: string;
  kind: string;
  name: string | null;
  mimeType: string | null;
  text: string | null;
  hue: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  signedUrl: string | null;
};

// ---- Boards -----------------------------------------------------------------

export async function createBoard(
  name?: string,
  projectId?: string
): Promise<{ board: Board } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("boards")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from("boards")
    .insert({
      studio_id: ctx.studio.id,
      name: name?.trim() || "Untitled board",
      project_id: projectId || null,
      position,
      created_by: ctx.userId,
    })
    .select("*")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return { board: data as Board };
}

export async function renameBoard(id: string, name: string): Promise<BoardState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("boards")
    .update({ name: name.trim() || "Untitled board", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return null;
}

export async function setBoardBackground(
  id: string,
  background: string
): Promise<BoardState> {
  await requireStudioContext();
  const supabase = createClient();
  const bg = ["dots", "grid", "plain"].includes(background) ? background : "dots";
  const { error } = await supabase
    .from("boards")
    .update({ background: bg })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return null;
}

export async function setBoardProject(
  id: string,
  projectId: string | null
): Promise<BoardState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("boards")
    .update({ project_id: projectId })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return null;
}

export async function deleteBoard(id: string): Promise<BoardState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase.from("boards").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return null;
}

// ---- Items ------------------------------------------------------------------

export async function getBoardItems(
  boardId: string
): Promise<{ items: BoardItemView[] } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("board_items")
    .select("*")
    .eq("board_id", boardId)
    .order("z", { ascending: true });
  if (error) return { error: error.message };

  const paths = (data ?? [])
    .map((i) => i.storage_path)
    .filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: list } = await supabase.storage
      .from("assets")
      .createSignedUrls(paths, SIGNED_TTL);
    for (const s of list ?? []) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }

  const items: BoardItemView[] = (data ?? []).map((i) => ({
    id: i.id,
    kind: i.kind,
    name: i.name,
    mimeType: i.mime_type,
    text: i.text,
    hue: i.hue,
    x: i.x,
    y: i.y,
    w: i.w,
    h: i.h,
    z: i.z,
    signedUrl: i.storage_path ? (signed.get(i.storage_path) ?? null) : i.url,
  }));
  return { items };
}

async function nextZ(
  supabase: SupabaseClient<Database>,
  boardId: string
): Promise<number> {
  const { data } = await supabase
    .from("board_items")
    .select("z")
    .eq("board_id", boardId)
    .order("z", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.z ?? 0) + 1;
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
}

// Upload image files from the device onto a board.
export async function addUploadItems(formData: FormData): Promise<BoardState> {
  const ctx = await requireStudioContext();
  const boardId = String(formData.get("boardId") ?? "");
  const baseX = Number(formData.get("x") ?? 40);
  const baseY = Number(formData.get("y") ?? 40);
  if (!boardId) return { error: "Missing board." };

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "No files chosen." };

  const supabase = createClient();
  let z = await nextZ(supabase, boardId);
  let offset = 0;
  for (const f of files) {
    const bytes = Buffer.from(await f.arrayBuffer());
    const path = `${ctx.studio.id}/boards/${boardId}/${crypto.randomUUID()}-${safeName(f.name)}`;
    const { error: upErr } = await supabase.storage
      .from("assets")
      .upload(path, bytes, { contentType: f.type || undefined, upsert: false });
    if (upErr) return { error: upErr.message };
    const { error } = await supabase.from("board_items").insert({
      studio_id: ctx.studio.id,
      board_id: boardId,
      kind: "image",
      name: f.name,
      mime_type: f.type || null,
      storage_path: path,
      x: baseX + offset,
      y: baseY + offset,
      w: DEFAULT_W,
      h: DEFAULT_H,
      z: z++,
      created_by: ctx.userId,
    });
    if (error) return { error: error.message };
    offset += 28;
  }
  revalidatePath("/boards");
  return null;
}

// Add existing project assets (their current stored file) onto a board.
export async function addAssetItems(
  boardId: string,
  assetIds: string[],
  baseX = 40,
  baseY = 40
): Promise<BoardState> {
  const ctx = await requireStudioContext();
  if (assetIds.length === 0) return null;
  const supabase = createClient();
  const { data: assets } = await supabase
    .from("assets")
    .select(
      "id, name, current:versions!assets_current_version_fk(storage_path, mime_type)"
    )
    .in("id", assetIds);

  let z = await nextZ(supabase, boardId);
  let offset = 0;
  for (const a of assets ?? []) {
    const cur = a.current as {
      storage_path: string | null;
      mime_type: string | null;
    } | null;
    if (!cur?.storage_path) continue;
    const { error } = await supabase.from("board_items").insert({
      studio_id: ctx.studio.id,
      board_id: boardId,
      kind: "image",
      name: a.name,
      mime_type: cur.mime_type,
      storage_path: cur.storage_path,
      x: baseX + offset,
      y: baseY + offset,
      w: DEFAULT_W,
      h: DEFAULT_H,
      z: z++,
      created_by: ctx.userId,
    });
    if (error) return { error: error.message };
    offset += 28;
  }
  revalidatePath("/boards");
  return null;
}

// Add Google Drive files onto a board (downloaded server-side).
export async function addDriveItems(
  boardId: string,
  files: { id: string; name: string; mimeType: string }[],
  baseX = 40,
  baseY = 40
): Promise<BoardState> {
  const ctx = await requireStudioContext();
  if (files.length === 0) return null;
  const supabase = createClient();
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry")
    .eq("provider", "google")
    .limit(1)
    .maybeSingle();
  if (!account) return { error: "Connect Google in Settings first." };

  try {
    const token = await getGoogleToken(supabase, account);
    let z = await nextZ(supabase, boardId);
    let offset = 0;
    for (const f of files) {
      const dl = await getDriveFileBytes(token, f.id, f.name, f.mimeType);
      const path = `${ctx.studio.id}/boards/${boardId}/${crypto.randomUUID()}-${safeName(dl.filename)}`;
      const { error: upErr } = await supabase.storage
        .from("assets")
        .upload(path, dl.bytes, { contentType: dl.mimeType || undefined });
      if (upErr) return { error: upErr.message };
      const { error } = await supabase.from("board_items").insert({
        studio_id: ctx.studio.id,
        board_id: boardId,
        kind: "image",
        name: dl.filename,
        mime_type: dl.mimeType,
        storage_path: path,
        x: baseX + offset,
        y: baseY + offset,
        w: DEFAULT_W,
        h: DEFAULT_H,
        z: z++,
        created_by: ctx.userId,
      });
      if (error) return { error: error.message };
      offset += 28;
    }
    revalidatePath("/boards");
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Drive import failed." };
  }
}

// Add Figma frames (rendered to PNG) onto a board.
export async function addFigmaItems(
  boardId: string,
  fileKey: string,
  frames: { id: string; name: string }[],
  baseX = 40,
  baseY = 40
): Promise<BoardState> {
  const ctx = await requireStudioContext();
  if (frames.length === 0) return null;
  const supabase = createClient();
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry")
    .eq("provider", "figma")
    .limit(1)
    .maybeSingle();
  if (!account) return { error: "Connect Figma in Settings first." };

  try {
    const token = await getFigmaToken(supabase, account);
    const images = await getImageUrls(token, fileKey, frames.map((f) => f.id), 2);
    let z = await nextZ(supabase, boardId);
    let offset = 0;
    for (const f of frames) {
      const url = images[f.id];
      if (!url) continue;
      const bytes = await fetchImageBytes(url);
      const path = `${ctx.studio.id}/boards/${boardId}/${crypto.randomUUID()}-${safeName(f.name)}.png`;
      const { error: upErr } = await supabase.storage
        .from("assets")
        .upload(path, bytes, { contentType: "image/png" });
      if (upErr) return { error: upErr.message };
      const { error } = await supabase.from("board_items").insert({
        studio_id: ctx.studio.id,
        board_id: boardId,
        kind: "image",
        name: f.name,
        mime_type: "image/png",
        storage_path: path,
        x: baseX + offset,
        y: baseY + offset,
        w: DEFAULT_W,
        h: DEFAULT_H,
        z: z++,
        created_by: ctx.userId,
      });
      if (error) return { error: error.message };
      offset += 28;
    }
    revalidatePath("/boards");
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Figma import failed." };
  }
}

export async function addNote(
  boardId: string,
  x: number,
  y: number
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const z = await nextZ(supabase, boardId);
  const { data, error } = await supabase
    .from("board_items")
    .insert({
      studio_id: ctx.studio.id,
      board_id: boardId,
      kind: "note",
      text: "",
      hue: "yellow",
      x,
      y,
      w: 220,
      h: 160,
      z,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function moveItem(id: string, x: number, y: number): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("board_items").update({ x, y }).eq("id", id);
}

export async function resizeItem(id: string, w: number, h: number): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("board_items").update({ w, h }).eq("id", id);
}

export async function bringToFront(id: string, boardId: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  const z = await nextZ(supabase, boardId);
  await supabase.from("board_items").update({ z }).eq("id", id);
}

export async function updateNote(
  id: string,
  text: string,
  hue: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("board_items").update({ text, hue }).eq("id", id);
}

export async function deleteItem(id: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("board_items").delete().eq("id", id);
}

// Projects + their assets, for the "add from project assets" picker.
export async function getProjectAssetsForBoard(): Promise<{
  projects: {
    id: string;
    title: string;
    assets: { id: string; name: string }[];
  }[];
}> {
  await requireStudioContext();
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, title, assets(id, name, current_version_id)")
    .order("created_at", { ascending: false });
  const projects = (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    assets: ((p.assets as { id: string; name: string; current_version_id: string | null }[]) ?? [])
      .filter((a) => a.current_version_id)
      .map((a) => ({ id: a.id, name: a.name })),
  }));
  return { projects };
}
