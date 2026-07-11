import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { BoardItemView } from "@/app/(app)/boards/actions";

// Public (token-gated) read of a whole board for the share page. Uses the
// service-role client, scoped strictly to the board the token points at.

const SIGNED_TTL = 60 * 60;

export type BoardConnectionView = {
  id: string;
  fromItemId: string;
  toItemId: string;
};

export type SharedBoard = {
  boardName: string;
  background: string;
  studioName: string;
  items: BoardItemView[];
  connections: BoardConnectionView[];
};

export async function loadSharedBoard(
  service: SupabaseClient<Database>,
  token: string
): Promise<SharedBoard | null> {
  const { data: share } = await service
    .from("board_shares")
    .select("board_id, studio_id, revoked")
    .eq("token", token)
    .maybeSingle();
  if (!share || share.revoked) return null;

  const { data: board } = await service
    .from("boards")
    .select("name, background, studio_id")
    .eq("id", share.board_id)
    .maybeSingle();
  if (!board) return null;

  const [{ data: studio }, { data: rows }, { data: conns }] = await Promise.all([
    service.from("studios").select("name").eq("id", share.studio_id).maybeSingle(),
    service
      .from("board_items")
      .select("*")
      .eq("board_id", share.board_id)
      .order("z", { ascending: true }),
    service
      .from("board_connections")
      .select("id, from_item_id, to_item_id")
      .eq("board_id", share.board_id),
  ]);

  const paths = (rows ?? [])
    .map((i) => i.storage_path)
    .filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: list } = await service.storage.from("assets").createSignedUrls(paths, SIGNED_TTL);
    for (const s of list ?? []) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }

  const items: BoardItemView[] = (rows ?? []).map((i) => {
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

  const connections: BoardConnectionView[] = (conns ?? []).map((c) => ({
    id: c.id,
    fromItemId: c.from_item_id,
    toItemId: c.to_item_id,
  }));

  return {
    boardName: board.name,
    background: board.background ?? "dots",
    studioName: studio?.name ?? "Studio",
    items,
    connections,
  };
}
