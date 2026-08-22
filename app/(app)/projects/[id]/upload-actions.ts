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
  // can_access_project (migration 0056), so a successful read proves the caller
  // can SEE this project.
  const { data: project } = await supabase
    .from("projects")
    .select("id, studio_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "You do not have access to this project." };

  // Seeing it is no longer enough. Since migration 0093 a project person can be
  // a REVIEWER, who reads and comments but does not change the job, and reading
  // the row above is something they can do.
  //
  // This is the one place RLS cannot finish the job on its own: the upload goes
  // straight to Storage under a service-role ticket, so nothing downstream would
  // stop a reviewer writing bytes. The `versions` insert that follows would be
  // refused, which means the file would land in the bucket with no row pointing
  // at it and no way to find it again.
  //
  // Asked of the DATABASE rather than re-derived from the session, so the answer
  // is the same one every RLS policy uses instead of a second rule that can
  // drift away from it.
  const { data: canEdit } = await supabase.rpc("can_edit_project", {
    p_project_id: projectId,
  });
  if (!canEdit) {
    return { error: "You have review access to this project, so you cannot upload files." };
  }

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
