import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { assetStorage, signThumbs } from "@/lib/asset-storage";
import { isDocKind, type DocKind } from "@/lib/review-links";
import { clientItemState, type PortalItemState } from "@/lib/client-portal";
import type { Database } from "@/lib/database.types";

type Service = SupabaseClient<Database>;

export type PortalItem = {
  linkToken: string;
  title: string;
  /** "Image", "Video", "Storyboard"... what it is, in the client's words. */
  kindLabel: string;
  /** "v3" for an asset, so a client can say which cut they mean. */
  versionLabel: string | null;
  state: PortalItemState;
  dueDate: string | null;
  sharedAt: string;
  thumbUrl: string | null;
  /** Drawn when there is no thumbnail: image | video | audio | doc. */
  glyph: "image" | "video" | "audio" | "doc";
};

export type PortalView = {
  studioName: string;
  logoUrl: string | null;
  projectTitle: string;
  clientName: string | null;
  /** The project's client, so the page can offer that client's request link. */
  clientId: string | null;
  items: PortalItem[];
};

const DOC_LABEL: Record<DocKind, string> = {
  shot_list: "Shot list",
  storyboard: "Storyboard",
  moodboard: "Moodboard",
  ai_shot: "Shot",
  sequence: "Sequence",
  props: "Props",
  schedule: "Shooting schedule",
};

const ASSET_LABEL: Record<string, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  storyboard: "Storyboard",
  reference: "Reference",
  cut: "Cut",
  document: "Document",
  other: "File",
};

function glyphFor(mime: string | null): PortalItem["glyph"] {
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  return "doc";
}

/** The portal a client opens, or null when the token is unknown or turned off. */
export async function loadPortalByToken(token: string): Promise<PortalView | null> {
  if (!serviceConfigured() || !token) return null;
  const service = createServiceClient();
  const { data: portal } = await service
    .from("client_portals")
    .select("id, studio_id, project_id, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!portal || portal.revoked_at) return null;
  return buildPortalView(service, portal.studio_id, portal.project_id);
}

/** Best effort: a failed stamp must never fail the page a client is reading. */
export async function recordPortalView(token: string): Promise<void> {
  if (!serviceConfigured()) return;
  await createServiceClient()
    .from("client_portals")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("token", token)
    .is("revoked_at", null);
}

/**
 * The portal for a project: every live review link, with where each stands
 * for the client. Shared with the studio's own count on the Review page, so
 * the button can say how many items the client will see.
 */
export async function buildPortalView(
  service: Service,
  studioId: string,
  projectId: string
): Promise<PortalView | null> {
  const [{ data: project }, { data: studio }, { data: links }] = await Promise.all([
    service
      .from("projects")
      .select("title, client_id, client:clients(name)")
      .eq("id", projectId)
      .maybeSingle(),
    service.from("studios").select("name, logo_path").eq("id", studioId).maybeSingle(),
    service
      .from("review_links")
      .select("id, token, asset_id, target_type, target_id, due_date, expires_at, created_at")
      .eq("project_id", projectId)
      .eq("revoked", false)
      .order("created_at", { ascending: false }),
  ]);
  if (!project) return null;

  const now = Date.now();
  const live = (links ?? []).filter(
    (l) => !l.expires_at || new Date(l.expires_at).getTime() >= now
  );
  // One item per thing shared. A thing shared twice keeps its newest link.
  const seen = new Set<string>();
  const unique = live.filter((l) => {
    const key = l.asset_id ? `a:${l.asset_id}` : `d:${l.target_type}:${l.target_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const assetLinks = unique.filter((l) => l.asset_id);
  const docLinks = unique.filter(
    (l) => !l.asset_id && isDocKind(l.target_type) && l.target_id
  );
  const linkIds = unique.map((l) => l.id);

  const assetIds = assetLinks.map((l) => l.asset_id as string);
  const boardIds = docLinks
    .filter((l) => l.target_type === "storyboard" || l.target_type === "moodboard")
    .map((l) => l.target_id as string);
  const shotIds = docLinks
    .filter((l) => l.target_type === "ai_shot")
    .map((l) => l.target_id as string);

  const [{ data: assets }, { data: boards }, { data: shots }, { data: approvals }] =
    await Promise.all([
      assetIds.length
        ? service
            .from("assets")
            .select("id, name, type, current_version_id")
            .in("id", assetIds)
        : Promise.resolve({ data: [] as { id: string; name: string; type: string; current_version_id: string | null }[] }),
      boardIds.length
        ? service.from("boards").select("id, name").in("id", boardIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      shotIds.length
        ? service.from("ai_shots").select("id, title").in("id", shotIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      linkIds.length
        ? service
            .from("approvals")
            .select("target_id, status, review_link_id")
            .in("review_link_id", linkIds)
        : Promise.resolve({ data: [] as { target_id: string; status: string; review_link_id: string | null }[] }),
    ]);

  const versionIds = (assets ?? [])
    .map((a) => a.current_version_id)
    .filter((v): v is string => Boolean(v));
  const { data: versions } = versionIds.length
    ? await service
        .from("versions")
        .select("id, version_number, mime_type, storage_path, poster_path")
        .in("id", versionIds)
    : { data: [] as { id: string; version_number: number; mime_type: string | null; storage_path: string | null; poster_path: string | null }[] };

  const versionById = new Map((versions ?? []).map((v) => [v.id, v]));
  const thumbPaths = (versions ?? []).flatMap((v) => {
    if (v.poster_path) return [v.poster_path];
    if (v.storage_path && v.mime_type?.startsWith("image/")) return [v.storage_path];
    return [];
  });
  const thumbs = await signThumbs(thumbPaths);

  const decision = (linkId: string, targetId: string | null | undefined) =>
    (approvals ?? []).find((a) => a.review_link_id === linkId && a.target_id === targetId)
      ?.status ?? null;

  const assetById = new Map((assets ?? []).map((a) => [a.id, a]));
  const boardName = new Map((boards ?? []).map((b) => [b.id, b.name]));
  const shotName = new Map((shots ?? []).map((s) => [s.id, s.title]));

  const items: PortalItem[] = [];
  for (const l of assetLinks) {
    const asset = assetById.get(l.asset_id as string);
    if (!asset) continue; // the asset was deleted; its link opens nothing
    const v = asset.current_version_id ? versionById.get(asset.current_version_id) : undefined;
    const thumbPath = v?.poster_path ?? (v?.mime_type?.startsWith("image/") ? v.storage_path : null);
    items.push({
      linkToken: l.token,
      title: asset.name,
      kindLabel: ASSET_LABEL[asset.type] ?? "File",
      versionLabel: v ? `v${v.version_number}` : null,
      state: clientItemState(decision(l.id, asset.current_version_id)),
      dueDate: l.due_date,
      sharedAt: l.created_at,
      thumbUrl: thumbPath ? (thumbs.get(thumbPath) ?? null) : null,
      glyph: glyphFor(v?.mime_type ?? null),
    });
  }
  for (const l of docLinks) {
    const kind = l.target_type as DocKind;
    const id = l.target_id as string;
    const title =
      kind === "storyboard" || kind === "moodboard"
        ? boardName.get(id)
        : kind === "ai_shot"
          ? shotName.get(id)
          : null;
    // A board or shot that has been deleted leaves a link to nothing.
    if ((kind === "storyboard" || kind === "moodboard" || kind === "ai_shot") && !title)
      continue;
    items.push({
      linkToken: l.token,
      title: title || DOC_LABEL[kind],
      kindLabel: DOC_LABEL[kind],
      versionLabel: null,
      state: clientItemState(decision(l.id, id)),
      dueDate: l.due_date,
      sharedAt: l.created_at,
      thumbUrl: null,
      glyph: "doc",
    });
  }

  let logoUrl: string | null = null;
  if (studio?.logo_path) {
    const { data } = await assetStorage().createSignedUrl(studio.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  const client = (project as { client?: { name?: string } | null }).client;
  return {
    studioName: studio?.name ?? "Your studio",
    logoUrl,
    projectTitle: project.title,
    clientName: client?.name ?? null,
    clientId: (project as { client_id?: string | null }).client_id ?? null,
    items,
  };
}

/**
 * The portal token a visitor presented, when it is a LIVE portal for this
 * same project, else null. A single review link can be sent to somebody who
 * should see only that item (a talent agent approving one photo), so the way
 * back to everything is shown only to a visitor who already holds the portal
 * link: they hand it in, and this only confirms it. Nothing is ever revealed
 * that the visitor did not bring.
 */
export async function verifyPortalToken(
  service: Service,
  projectId: string,
  presented: string | null | undefined
): Promise<string | null> {
  if (!presented || presented.length > 100) return null;
  const { data } = await service
    .from("client_portals")
    .select("token")
    .eq("token", presented)
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .maybeSingle();
  return data?.token ?? null;
}
