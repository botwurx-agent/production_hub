"use client";

import { createClient } from "@/lib/supabase/client";
import { createUploadTicket } from "@/app/(app)/upload-actions";
import type { UploadScope } from "@/lib/upload-ticket";

const BUCKET = "assets";

export type DirectUpload = {
  /** The storage path the server authorized. Persist exactly this. */
  path: string;
  /** What the browser believes the file is. The server re-checks the real one. */
  sizeBytes: number;
  mimeType: string;
};

/**
 * Send a file straight from the browser to Storage, skipping the function.
 *
 * This is the whole point of the exercise. A file routed browser -> Server
 * Action -> storage dies at the ~4.5MB Vercel request body, at the platform
 * edge, before any of our code runs, so it cannot even be reported: the click
 * just appears to do nothing. Going direct removes that ceiling entirely,
 * which is why the asset-version upload has always worked this way.
 *
 * The server chooses the path, so the browser cannot pick which studio folder
 * it writes into, and the ticket is good for that one path only.
 *
 * NO PROGRESS REPORTING YET, and it is a real gap on a large file: an upload
 * with no progress bar reads as a frozen app. supabase-js uploads with fetch,
 * which cannot report progress, and getting it means an XHR PUT straight at
 * the signed URL. That is a protocol I have not verified against the live
 * endpoint, and guessing at it would break silently on a client upgrade. Until
 * then callers show an indeterminate state naming the file and its size, which
 * at least says the app is doing something.
 */
export async function uploadDirect(
  scope: UploadScope,
  file: File
): Promise<DirectUpload> {
  const ticket = await createUploadTicket(scope, file.name, file.size);
  if ("error" in ticket) throw new Error(ticket.error);

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(ticket.path, ticket.token, file, {
      contentType: file.type || undefined,
    });
  if (error) throw new Error(error.message);

  return {
    path: ticket.path,
    sizeBytes: file.size,
    mimeType: file.type || "",
  };
}
