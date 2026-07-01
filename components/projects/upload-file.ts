"use client";

import { createClient } from "@/lib/supabase/client";

const BUCKET = "assets";

/**
 * Uploads a file straight from the browser to Supabase Storage using the
 * signed-in user's session (RLS scopes writes to the studio via the first
 * path segment). Returns metadata to persist on the version row. Keeping the
 * bytes off the server action avoids the request-body size limit and scales
 * to large media.
 */
export async function uploadAssetFile(opts: {
  studioId: string;
  projectId: string;
  file: File;
}): Promise<{ storagePath: string; mimeType: string; sizeBytes: number }> {
  const supabase = createClient();
  const safe =
    opts.file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
  const unique =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  const path = `${opts.studioId}/${opts.projectId}/${unique}-${safe}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, opts.file, {
      contentType: opts.file.type || undefined,
      upsert: false,
    });
  if (error) throw new Error(error.message);

  return {
    storagePath: path,
    mimeType: opts.file.type || "",
    sizeBytes: opts.file.size,
  };
}
