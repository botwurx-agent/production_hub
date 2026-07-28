"use client";

import { createClient } from "@/lib/supabase/client";
import { createAssetUploadUrl } from "@/app/(app)/projects/[id]/upload-actions";

const BUCKET = "assets";

/**
 * Uploads a file straight from the browser to Supabase Storage, so the bytes
 * never pass through a serverless function (which caps request bodies around
 * 4.5 MB, useless for video). Returns metadata to persist on the version row.
 *
 * The upload is authorized by a one-shot signed URL minted server-side rather
 * than by the caller's own storage permissions. That matters because the bucket
 * policy is scoped to the studio folder, so a project collaborator (no studio
 * membership) could never upload directly. The server checks project access,
 * which covers members and collaborators alike, and hands back a token good for
 * exactly one path.
 */
export async function uploadAssetFile(opts: {
  // Kept for call-site compatibility; the path now comes from the server, so
  // the browser cannot choose which studio folder it writes into.
  studioId: string;
  projectId: string;
  file: File;
}): Promise<{ storagePath: string; mimeType: string; sizeBytes: number }> {
  const ticket = await createAssetUploadUrl(opts.projectId, opts.file.name);
  if ("error" in ticket) throw new Error(ticket.error);

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(ticket.path, ticket.token, opts.file, {
      contentType: opts.file.type || undefined,
    });
  if (error) throw new Error(error.message);

  return {
    storagePath: ticket.path,
    mimeType: opts.file.type || "",
    sizeBytes: opts.file.size,
  };
}
