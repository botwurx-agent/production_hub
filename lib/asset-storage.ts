import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";

// Storage accessor for the private "assets" bucket that works for BOTH full
// studio members and project collaborators.
//
// The bucket policy is scoped to the studio folder (is_studio_member), so a
// project collaborator (who has no membership) can't sign or upload through the
// RLS client. Access is already enforced one layer up: every read signs paths
// that came from an RLS-authorized data row (assets/boards/etc., opened to
// collaborators in migration 0056), and every server-side upload is followed by
// an RLS-gated row insert. So using the service role here only bypasses the
// studio-folder storage policy, never a project boundary.
//
// Falls back to the RLS client when the service key is not configured (members
// still work locally; collaborators need the key set, as in production).
export function assetStorage() {
  const client = serviceConfigured() ? createServiceClient() : createClient();
  return client.storage.from("assets");
}

/** Wide enough to stay sharp on a retina card, small enough to be instant. */
const THUMB_WIDTH = 640;
const THUMB_QUALITY = 70;

/**
 * A signed URL for DISPLAYING an image in a grid, rather than for keeping.
 *
 * The pipeline stores what the generator produced, which for a Higgsfield still
 * is a 20 to 34MB PNG. That is correct for the master, and ruinous for a grid:
 * eighteen candidates meant half a gigabyte of downloads to draw thumbnails the
 * size of a postage stamp, which is what a producer experiences as "the images
 * take forever".
 *
 * Storage resizes on the fly and caches the result, so the original is never
 * touched again for the grid and nothing needs re-uploading. Only the grid uses
 * this; opening a candidate still serves the full file, since that is the point
 * of opening it.
 *
 * Returns null rather than throwing when resizing is unavailable, so the caller
 * falls back to the original and a grid that is slow beats a grid that is
 * blank.
 */
export async function signThumb(
  path: string,
  width = THUMB_WIDTH
): Promise<string | null> {
  const { data } = await assetStorage().createSignedUrl(path, 60 * 60, {
    transform: { width, quality: THUMB_QUALITY, resize: "contain" },
  });
  return data?.signedUrl ?? null;
}

/**
 * The same, for a page that signs a whole list.
 *
 * Keyed by PATH rather than by row id, because every caller already builds a
 * path-keyed map from createSignedUrls and this drops in beside it.
 *
 * Signed one at a time on purpose: the batch endpoint takes no transform, so
 * there is no plural form to call. They go in parallel and a failure is simply
 * an absent key, leaving the caller on the original.
 */
export async function signThumbs(
  paths: string[],
  width = THUMB_WIDTH
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    [...new Set(paths.filter(Boolean))].map(async (path) => {
      const url = await signThumb(path, width);
      if (url) out.set(path, url);
    })
  );
  return out;
}

/** Anything that is not a still has no server-side resize. */
export function isResizable(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType && mimeType.startsWith("image/"));
}
