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

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
