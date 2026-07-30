import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { assetStorage } from "@/lib/asset-storage";
import { loadReactions } from "@/lib/review-reactions-load";
import type {
  AssetWithVersions,
  VersionComment,
  VersionApproval,
} from "@/components/projects/asset-types";

const SIGNED_URL_TTL = 60 * 60; // 1 hour

export type ProjectAssets = {
  assets: AssetWithVersions[];
  reviewLinkByAsset: Map<
    string,
    { id: string; token: string; recipient: string | null }
  >;
};

// Loads a project's assets with versions, signed file URLs, review comments,
// and internal sign-offs. Shared by the project hub (for live previews and
// counts) and the dedicated Assets page (for the full grid), so the two never
// drift apart.
/**
 * Which side of the library to load.
 *
 * "creative" is everything the project is making (images, cuts, references) and
 * is the default, so every existing caller keeps meaning what it meant.
 * "document" is the paperwork that arrives from outside: permits, certificates,
 * specs, schedules. They share a table because a document has versions too, but
 * they are never shown in the same list, since a review status and a
 * share-for-approval button mean nothing on an insurance certificate.
 */
export type AssetSide = "creative" | "document";

export async function loadProjectAssets(
  supabase: SupabaseClient<Database>,
  projectId: string,
  // Current user, so their own reactions come back marked.
  userId?: string | null,
  side: AssetSide = "creative"
): Promise<ProjectAssets> {
  const [{ data: assetsRaw }, { data: reviewLinks }] = await Promise.all([
    (side === "document"
      ? supabase.from("assets").select(
          "id, name, type, status, current_version_id, created_at, external_ref, versions:versions!versions_asset_id_fkey(id, version_number, storage_path, url, mime_type, size_bytes, notes, created_at)"
        ).eq("type", "document")
      : supabase.from("assets").select(
          "id, name, type, status, current_version_id, created_at, external_ref, versions:versions!versions_asset_id_fkey(id, version_number, storage_path, url, mime_type, size_bytes, notes, created_at)"
        ).neq("type", "document"))
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .order("version_number", {
        referencedTable: "versions",
        ascending: false,
      }),
    supabase
      .from("review_links")
      .select("id, asset_id, token, recipient")
      .eq("project_id", projectId)
      .eq("revoked", false)
      .order("created_at", { ascending: false }),
  ]);

  const reviewLinkByAsset = new Map<
    string,
    { id: string; token: string; recipient: string | null }
  >();
  for (const l of reviewLinks ?? []) {
    if (l.asset_id && !reviewLinkByAsset.has(l.asset_id)) {
      reviewLinkByAsset.set(l.asset_id, {
        id: l.id,
        token: l.token,
        recipient: l.recipient ?? null,
      });
    }
  }

  const paths = (assetsRaw ?? [])
    .flatMap((a) => a.versions ?? [])
    .map((v) => v.storage_path)
    .filter((p): p is string => Boolean(p));

  const signed = new Map<string, string>();
  if (paths.length > 0) {
    // Sign via the storage helper so project collaborators (no studio
    // membership) also get file URLs; the asset rows above were already
    // RLS-authorized for this caller.
    const { data: signedList } = await assetStorage()
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of signedList ?? []) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }

  const versionIds = (assetsRaw ?? []).flatMap((a) =>
    (a.versions ?? []).map((v) => v.id)
  );
  const commentsByVersion = new Map<string, VersionComment[]>();
  const approvalsByVersion = new Map<string, VersionApproval[]>();
  if (versionIds.length > 0) {
    const [{ data: comments }, { data: approvals }] = await Promise.all([
      supabase
        .from("review_comments")
        .select(
          "id, body, created_at, author_id, reviewer_name, version_id, pin_number, pos_x, pos_y, timecode, resolved_at, parent_id, drawing, timecode_end, author_key, edited_at"
        )
        .in("version_id", versionIds),
      supabase
        .from("approvals")
        .select(
          "id, status, reviewer_user_id, reviewer_name, created_at, target_id"
        )
        .eq("target_type", "version")
        .in("target_id", versionIds),
    ]);
    const reactions = await loadReactions(
      supabase,
      (comments ?? []).map((c) => c.id),
      userId ?? null
    );
    for (const c of comments ?? []) {
      if (!c.version_id) continue;
      const list = commentsByVersion.get(c.version_id) ?? [];
      list.push({ ...c, reactions: reactions.get(c.id) ?? [] });
      commentsByVersion.set(c.version_id, list);
    }
    for (const a of approvals ?? []) {
      const list = approvalsByVersion.get(a.target_id) ?? [];
      list.push(a);
      approvalsByVersion.set(a.target_id, list);
    }
  }

  const assets: AssetWithVersions[] = (assetsRaw ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    status: a.status,
    current_version_id: a.current_version_id,
    created_at: a.created_at,
    external_ref: (a.external_ref ?? null) as AssetWithVersions["external_ref"],
    versions: (a.versions ?? []).map((v) => ({
      ...v,
      signedUrl: v.storage_path ? (signed.get(v.storage_path) ?? null) : null,
      comments: commentsByVersion.get(v.id) ?? [],
      approvals: approvalsByVersion.get(v.id) ?? [],
    })),
  }));

  return { assets, reviewLinkByAsset };
}
