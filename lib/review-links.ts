import "server-only";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReviewLink } from "@/lib/database.types";
import type { ApprovalStatus } from "@/lib/database.types";

export function generateReviewToken(): string {
  return randomBytes(24).toString("base64url");
}

// A valid link exists, is not revoked, and is not past its expiry.
export async function getValidLink(
  service: SupabaseClient<Database>,
  token: string
): Promise<ReviewLink | null> {
  const { data } = await service
    .from("review_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!data || data.revoked) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }
  return data as ReviewLink;
}

export type PortalComment = {
  id: string;
  version_id: string;
  body: string;
  created_at: string;
  author: string; // display name (studio name for team, reviewer_name for client)
  isClient: boolean;
  // Frame.io-style pin: numbered marker at (x, y) percent on the asset.
  pinNumber: number | null;
  x: number | null;
  y: number | null;
  resolved: boolean;
};

export type PortalVersion = {
  id: string;
  version_number: number;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  created_at: string;
};

export type PortalData = {
  studioName: string;
  projectTitle: string;
  asset: { id: string; name: string; currentVersionId: string | null };
  versions: PortalVersion[];
  comments: PortalComment[];
  // The client's own current decision on the current version, via this link.
  myDecision: ApprovalStatus | null;
};

// Assembles everything the client portal shows, strictly scoped to the link's
// asset. Runs with the service client (RLS bypassed), so it must only ever read
// rows tied to link.asset_id / link.studio_id.
export async function gatherReview(
  service: SupabaseClient<Database>,
  link: ReviewLink
): Promise<PortalData | null> {
  const [{ data: asset }, { data: studio }, { data: project }] =
    await Promise.all([
      service
        .from("assets")
        .select("id, name, current_version_id")
        .eq("id", link.asset_id)
        .maybeSingle(),
      service
        .from("studios")
        .select("name")
        .eq("id", link.studio_id)
        .maybeSingle(),
      service
        .from("projects")
        .select("title")
        .eq("id", link.project_id)
        .maybeSingle(),
    ]);

  if (!asset) return null;

  const { data: versionsRaw } = await service
    .from("versions")
    .select("id, version_number, mime_type, size_bytes, notes, created_at")
    .eq("asset_id", asset.id)
    .order("version_number", { ascending: false });

  const versions = (versionsRaw ?? []) as PortalVersion[];
  const versionIds = versions.map((v) => v.id);

  const studioName = studio?.name ?? "The studio";

  let comments: PortalComment[] = [];
  let myDecision: ApprovalStatus | null = null;

  if (versionIds.length > 0) {
    const [{ data: commentsRaw }, { data: myApproval }] = await Promise.all([
      service
        .from("review_comments")
        .select(
          "id, version_id, body, created_at, author_id, reviewer_name, pin_number, pos_x, pos_y, resolved_at"
        )
        .in("version_id", versionIds)
        .order("created_at", { ascending: true }),
      // The client's decision on the current version, made through this link.
      asset.current_version_id
        ? service
            .from("approvals")
            .select("status")
            .eq("target_type", "version")
            .eq("target_id", asset.current_version_id)
            .eq("review_link_id", link.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    comments = (commentsRaw ?? []).map((c) => {
      const isClient = Boolean(c.reviewer_name) && !c.author_id;
      return {
        id: c.id,
        version_id: c.version_id,
        body: c.body,
        created_at: c.created_at,
        author: isClient ? (c.reviewer_name as string) : studioName,
        isClient,
        pinNumber: c.pin_number ?? null,
        x: c.pos_x ?? null,
        y: c.pos_y ?? null,
        resolved: Boolean(c.resolved_at),
      };
    });

    myDecision =
      (myApproval as { status?: ApprovalStatus } | null)?.status ?? null;
  }

  return {
    studioName,
    projectTitle: project?.title ?? "Project",
    asset: {
      id: asset.id,
      name: asset.name,
      currentVersionId: asset.current_version_id,
    },
    versions,
    comments,
    myDecision,
  };
}
