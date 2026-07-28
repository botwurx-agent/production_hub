"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { assetStorage } from "@/lib/asset-storage";
import { reportError } from "@/lib/log";

// Browser uploads go straight to Storage so the bytes never pass through a
// serverless function (which caps request bodies around 4.5 MB, useless for
// video). That direct path used the caller's own session, and the bucket policy
// is scoped to the studio folder via is_studio_member, so a PROJECT
// COLLABORATOR (who has no membership) could not upload at all.
//
// The fix is to keep the direct upload but stop relying on the caller's storage
// permissions: this action checks project access with the RLS client, then mints
// a one-shot signed upload URL with the service role. The browser uploads to
// that URL. Authorization happens here, in code we control, rather than in a
// bucket policy that cannot express "collaborator on this project".

export type UploadTicket =
  | { path: string; token: string }
  | { error: string };

export async function createAssetUploadUrl(
  projectId: string,
  fileName: string
): Promise<UploadTicket> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  // The projects table is readable when is_studio_member OR
  // can_access_project (migration 0056), so a successful read IS the
  // authorization check, for members and collaborators alike.
  const { data: project } = await supabase
    .from("projects")
    .select("id, studio_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "You do not have access to this project." };

  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
  const path = `${project.studio_id}/${project.id}/${crypto.randomUUID()}-${safe}`;

  const { data, error } = await assetStorage().createSignedUploadUrl(path);
  if (error || !data) {
    reportError("createAssetUploadUrl", error);
    return { error: error?.message ?? "Could not start the upload." };
  }
  // Path is returned separately from data.path so the caller stores exactly
  // what we authorized, not whatever the storage layer echoes back.
  return { path, token: data.token };
}
