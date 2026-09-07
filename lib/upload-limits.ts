/**
 * How big a file is allowed to be, by what kind of thing it is.
 *
 * WHY THIS REPLACES ONE NUMBER. `MAX_UPLOAD_BYTES` (4MB) is not a policy we
 * chose, it is the Vercel serverless request body: any file routed browser ->
 * Server Action -> storage dies at the platform edge before our code runs, so
 * the click appears to do nothing. Every cap in the app was therefore set by
 * where the bytes travelled rather than by what the file was, which is why a
 * scanned contract and a moodboard thumbnail had the same ceiling.
 *
 * Uploads that go DIRECT to storage under a signed URL never touch a function,
 * so the ceiling becomes a real decision instead of a physical constant. These
 * are those decisions.
 *
 * NOT "server-only", so the picker can refuse an oversized file before the
 * upload starts rather than after it fails.
 *
 * IMPORTANT: a number here is ADVISORY on its own. The browser declares a size
 * when it asks for a ticket and could lie, so the ceiling is checked again
 * against the object's REAL size after the upload and before the row is
 * written (see lib/upload-ticket.ts finalizeUpload). The last line of defence
 * is the bucket's own file_size_limit, which is why migration 0106 sets one
 * rather than leaving it null.
 */

/** A contract, a permit, a delivery spec, an invoice scan. */
export const MAX_DOCUMENT_BYTES = 100_000_000;

/** A photograph or a reference image, at full camera resolution. */
export const MAX_IMAGE_BYTES = 100_000_000;

/** A cut, a master, a walkthrough. The reason any of this exists. */
export const MAX_MEDIA_BYTES = 2_000_000_000;

/**
 * The largest any ticket may authorize. The bucket is configured to this, so a
 * client that lies about its size is refused by Storage itself.
 */
export const MAX_ANY_BYTES = MAX_MEDIA_BYTES;

/**
 * Is this path exactly one the ticket for `folder` would have minted?
 *
 * PURE, AND HERE RATHER THAN NEXT TO THE MINT, so it can be unit tested: this
 * is the check that stops a browser handing back a path it did not receive.
 * lib/upload-ticket.ts is "server-only", and nothing in it can be exercised
 * from a harness, which is the same reason invoice-draft.ts and shot-doc.ts
 * were split out of lib/ai.ts.
 *
 * Deliberately exact rather than "starts with the studio id". A file must sit
 * DIRECTLY in its scope's folder, so neither a traversal ("a/../b"), a deeper
 * path that smuggles another scope's folder into the tail, nor a sibling
 * studio whose id merely shares a prefix can pass.
 */
export function pathWithinScope(
  path: string,
  studioId: string,
  folder: string
): boolean {
  if (!path || !studioId || !folder) return false;
  if (path.includes("..")) return false;
  const prefix = `${studioId}/${folder}/`;
  if (!path.startsWith(prefix)) return false;
  const name = path.slice(prefix.length);
  return name.length > 0 && !name.includes("/");
}
