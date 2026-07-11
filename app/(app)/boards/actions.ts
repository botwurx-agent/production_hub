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
import { unfurl, isFetchableUrl, BROWSER_UA } from "@/lib/unfurl";
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
  // Destination URL for a link card (board_items.url).
  url: string | null;
  // Signed storage image (null unless the item has a stored file); used as the
  // preview thumbnail for link cards without misreading a link's destination.
  thumbUrl: string | null;
  // Column membership: parentId is the containing column (null = top-level on the
  // canvas); sort orders the item within its column.
  parentId: string | null;
  sort: number;
};

// ---- Boards -----------------------------------------------------------------

export async function createBoard(
  name?: string,
  projectId?: string,
  kind: string = "general"
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
      kind,
      position,
      created_by: ctx.userId,
    })
    .select("*")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/boards");
  if (projectId) {
    revalidatePath(`/projects/${projectId}/moodboard`);
    revalidatePath(`/projects/${projectId}/storyboards`);
  }
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

  const items: BoardItemView[] = (data ?? []).map((i) => {
    const thumbUrl = i.storage_path ? (signed.get(i.storage_path) ?? null) : null;
    return {
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
      signedUrl: i.storage_path ? thumbUrl : i.url,
      url: i.url,
      thumbUrl,
      parentId: i.parent_id,
      sort: i.sort ?? 0,
    };
  });
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

async function nextSort(
  supabase: SupabaseClient<Database>,
  parentId: string
): Promise<number> {
  const { data } = await supabase
    .from("board_items")
    .select("sort")
    .eq("parent_id", parentId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort ?? -1) + 1;
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
  y: number,
  parentId?: string | null
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const z = await nextZ(supabase, boardId);
  const sort = parentId ? await nextSort(supabase, parentId) : 0;
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
      parent_id: parentId ?? null,
      sort,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return { id: data.id };
}

// A standalone line/arrow. Endpoints + style are JSON in text; x/y mirror the
// start endpoint. Reuses updateItemText for edits and deleteItem for removal.
export async function addLine(
  boardId: string,
  ax: number,
  ay: number,
  bx: number,
  by: number
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const z = await nextZ(supabase, boardId);
  const data = {
    ax,
    ay,
    bx,
    by,
    color: "slate",
    weight: 2,
    dashed: false,
    startArrow: false,
    endArrow: true,
    label: "",
  };
  const { data: row, error } = await supabase
    .from("board_items")
    .insert({
      studio_id: ctx.studio.id,
      board_id: boardId,
      kind: "line",
      text: JSON.stringify(data),
      x: Math.round(ax),
      y: Math.round(ay),
      w: Math.round(bx - ax),
      h: Math.round(by - ay),
      z,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return { id: row.id };
}

// A titled container that stacks other items. Only width is meaningful; height
// flows from its children.
export async function addColumn(
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
      kind: "column",
      name: "Column",
      x,
      y,
      w: 260,
      h: 320,
      z,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return { id: data.id };
}

// A color swatch card. The hex value lives in `text`; an optional label in name.
export async function addColorItem(
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
      kind: "color",
      text: "#6366F1",
      x,
      y,
      w: 160,
      h: 160,
      z,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return { id: data.id };
}

// A large section-heading label (transparent, no box). Text lives in `text`.
export async function addHeadingItem(
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
      kind: "heading",
      text: "",
      x,
      y,
      w: 360,
      h: 60,
      z,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return { id: data.id };
}

// Move an existing top-level item into a column (drag-in), appended at the end.
export async function attachToColumn(
  itemId: string,
  columnId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  const sort = await nextSort(supabase, columnId);
  await supabase
    .from("board_items")
    .update({ parent_id: columnId, sort })
    .eq("id", itemId);
  revalidatePath("/boards");
}

// Pop an item out of its column back onto the canvas at (x, y).
export async function detachFromColumn(
  itemId: string,
  x: number,
  y: number
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("board_items")
    .update({ parent_id: null, sort: 0, x: Math.max(0, x), y: Math.max(0, y) })
    .eq("id", itemId);
  revalidatePath("/boards");
}

// Persist a new order for a column's children (ids in display order).
export async function setColumnOrder(ids: string[]): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await Promise.all(
    ids.map((id, i) => supabase.from("board_items").update({ sort: i }).eq("id", id))
  );
  revalidatePath("/boards");
}

// Rename a column (its title) or any item's name.
export async function updateItemName(id: string, name: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("board_items").update({ name }).eq("id", id);
}

// ---- Connections (arrows between items) ------------------------------------

export type BoardConnection = {
  id: string;
  fromItemId: string;
  toItemId: string;
};

export async function getBoardConnections(
  boardId: string
): Promise<{ connections: BoardConnection[] } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("board_connections")
    .select("id, from_item_id, to_item_id")
    .eq("board_id", boardId);
  if (error) return { error: error.message };
  return {
    connections: (data ?? []).map((c) => ({
      id: c.id,
      fromItemId: c.from_item_id,
      toItemId: c.to_item_id,
    })),
  };
}

export async function addConnection(
  boardId: string,
  fromItemId: string,
  toItemId: string
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  if (fromItemId === toItemId) return { error: "Cannot connect an item to itself." };
  const supabase = createClient();
  // Avoid duplicates in either direction.
  const { data: existing } = await supabase
    .from("board_connections")
    .select("id")
    .eq("board_id", boardId)
    .or(
      `and(from_item_id.eq.${fromItemId},to_item_id.eq.${toItemId}),and(from_item_id.eq.${toItemId},to_item_id.eq.${fromItemId})`
    )
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { data, error } = await supabase
    .from("board_connections")
    .insert({
      studio_id: ctx.studio.id,
      board_id: boardId,
      from_item_id: fromItemId,
      to_item_id: toItemId,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function deleteConnection(id: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("board_connections").delete().eq("id", id);
}

// Paste a URL: unfurl it (title/description/preview image) and drop a link card.
// The preview image is downloaded into our storage so it renders reliably.
export async function addLinkItem(
  boardId: string,
  rawUrl: string,
  x: number,
  y: number
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const withScheme = /^https?:\/\//i.test(rawUrl.trim())
    ? rawUrl.trim()
    : `https://${rawUrl.trim()}`;
  const u = isFetchableUrl(withScheme);
  if (!u) return { error: "Enter a valid http(s) link." };

  const supabase = createClient();
  const meta = await unfurl(u);

  let storagePath: string | null = null;
  let mime: string | null = null;
  if (meta.image) {
    const img = isFetchableUrl(meta.image);
    if (img) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const r = await fetch(img.toString(), {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "user-agent": BROWSER_UA,
            accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
            // Some CDNs (e.g. Pinterest's i.pinimg.com) require the page origin.
            referer: `${u.origin}/`,
          },
        });
        clearTimeout(timer);
        const type = r.headers.get("content-type") ?? "";
        if (r.ok && type.startsWith("image/")) {
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length > 0 && buf.length <= 6_000_000) {
            const ext = (type.split("/")[1] || "jpg").split(";")[0].slice(0, 5);
            const path = `${ctx.studio.id}/boards/${boardId}/${crypto.randomUUID()}-link.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("assets")
              .upload(path, buf, { contentType: type });
            if (!upErr) {
              storagePath = path;
              mime = type;
            }
          }
        }
      } catch {
        // No thumbnail; the card still shows the title + domain.
      }
    }
  }

  const z = await nextZ(supabase, boardId);
  const title = (meta.title || meta.siteName || u.hostname).slice(0, 300);
  const { data, error } = await supabase
    .from("board_items")
    .insert({
      studio_id: ctx.studio.id,
      board_id: boardId,
      kind: "link",
      name: title,
      text: meta.description ? meta.description.slice(0, 500) : null,
      url: u.toString(),
      storage_path: storagePath,
      mime_type: mime,
      x,
      y,
      w: 240,
      h: 210,
      z,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return { id: data.id };
}

// A checklist card. The items live as JSON in text: [{id,text,done}].
export async function addTodoItem(
  boardId: string,
  x: number,
  y: number,
  parentId?: string | null
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const z = await nextZ(supabase, boardId);
  const sort = parentId ? await nextSort(supabase, parentId) : 0;
  const { data, error } = await supabase
    .from("board_items")
    .insert({
      studio_id: ctx.studio.id,
      board_id: boardId,
      kind: "todo",
      text: "[]",
      hue: "blue",
      x,
      y,
      w: 240,
      h: 200,
      z,
      parent_id: parentId ?? null,
      sort,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return { id: data.id };
}

// Generic text persistence (used by the checklist card).
export async function updateItemText(id: string, text: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("board_items").update({ text }).eq("id", id);
}

// Update only an item's color (hue), without touching its text.
export async function updateItemHue(id: string, hue: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("board_items").update({ hue }).eq("id", id);
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
