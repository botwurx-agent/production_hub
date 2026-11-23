import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { asSetup, type Setup } from "@/components/previz/setup";
import { isShareMode, type ShareMode } from "@/lib/scene-share-rules";

// Reading a scene builder setup through its share link. Everything here runs
// on the SERVICE client, so the token is the whole access check: every query
// below starts from the link row the token named and never reads past the one
// setup (or the guest's own copy of it) that link is for.

type Service = SupabaseClient<Database>;

export type LiveSceneLink = {
  id: string;
  studioId: string;
  projectId: string;
  setupId: string;
  mode: ShareMode;
};

/** The link a token names, when it exists and has not been turned off. */
export async function liveSceneLink(service: Service, token: string): Promise<LiveSceneLink | null> {
  if (typeof token !== "string" || token.length < 16 || token.length > 128) return null;
  const { data } = await service
    .from("scene_share_links")
    .select("id, studio_id, project_id, scene_setup_id, mode, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!data || data.revoked_at || !isShareMode(data.mode)) return null;
  return { id: data.id, studioId: data.studio_id, projectId: data.project_id, setupId: data.scene_setup_id, mode: data.mode };
}

export type SharedSceneView = {
  mode: ShareMode;
  studioName: string;
  setupName: string;
  setup: Setup;
  /** Set when this browser has already saved through the link. */
  mine: { name: string; savedAt: string } | null;
};

/**
 * What the shared page opens on. On a copy link a guest who has saved before
 * (matched by their browser's key) gets THEIR copy back, not the original.
 */
export async function loadSharedScene(service: Service, token: string, guestKey: string | null): Promise<SharedSceneView | null> {
  const link = await liveSceneLink(service, token);
  if (!link) return null;

  let setupId = link.setupId;
  let mine: SharedSceneView["mine"] = null;
  if (guestKey && link.mode !== "view") {
    const { data: take } = await service
      .from("scene_share_takes")
      .select("scene_setup_id, guest_name, updated_at")
      .eq("link_id", link.id)
      .eq("guest_key", guestKey)
      .maybeSingle();
    if (take) {
      mine = { name: take.guest_name, savedAt: take.updated_at };
      if (link.mode === "copy") setupId = take.scene_setup_id;
    }
  }

  const [{ data: row }, { data: studio }] = await Promise.all([
    service.from("scene_setups").select("name, data, project_id").eq("id", setupId).maybeSingle(),
    service.from("studios").select("name").eq("id", link.studioId).maybeSingle(),
  ]);
  // The copy must still be on the link's own project, or it is not ours to show.
  if (!row || row.project_id !== link.projectId) return null;
  const setup = asSetup(row.data);
  if (!setup) return null;
  return { mode: link.mode, studioName: studio?.name ?? "The studio", setupName: row.name, setup, mine };
}
