/**
 * Two different ceilings, because attachments reach us by two different routes
 * and only one of them is constrained by our own infrastructure.
 */

/**
 * A file picked from the device travels browser -> Server Action -> Gmail, so
 * its bytes cross the serverless request body (~4.5MB on Vercel). A request
 * over that is rejected at the platform edge before our code runs, so it
 * cannot be explained to the user: the click just appears to do nothing.
 * Staying under it lets us fail in our own code with a message.
 *
 * Deliberately not in the actions file: a "use server" module can only export
 * async functions, and the composer needs this to warn before the upload.
 */
export const MAX_UPLOAD_BYTES = 4_000_000;

/**
 * The assembled message's ceiling. Project assets and Drive files are fetched
 * server-side and never touch the request body, so the only thing bounding
 * them is Gmail's own attachment limit. Sending this much requires the Gmail
 * upload URI rather than the plain endpoint (see sendGmailReply).
 */
export const MAX_EMAIL_BYTES = 25_000_000;

/**
 * Splits picked Drive files into the ones small enough to attach as bytes and
 * the ones that have to travel as a Drive link, mirroring what Gmail itself
 * does at its size limit.
 *
 * Runs on a running total rather than per file, so three 10MB files do not all
 * attach and then fail the message-level check with no way forward: the ones
 * that no longer fit simply become links. `otherBytes` is everything already
 * committed to the message (device files, project assets).
 *
 * Google-native docs (Docs, Sheets, Slides) report a size of 0 because they
 * have no direct byte size. They export small, so they always attach.
 */
export function splitDriveByLimit<T extends { size: number }>(
  files: T[],
  otherBytes: number
): { attach: T[]; link: T[] } {
  let used = otherBytes;
  const attach: T[] = [];
  const link: T[] = [];
  for (const f of files) {
    if (f.size > 0 && used + f.size > MAX_EMAIL_BYTES) {
      link.push(f);
    } else {
      attach.push(f);
      used += f.size;
    }
  }
  return { attach, link };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
