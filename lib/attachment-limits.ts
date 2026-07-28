/**
 * Total attachment bytes allowed on one outgoing email.
 *
 * The binding constraint is the serverless request-body cap (~4.5MB on
 * Vercel), not Gmail's own much larger limit. A request over that cap is
 * rejected at the platform edge before the Server Action ever runs, so there
 * is no opportunity to return a useful error: to the person sending, the click
 * simply appears to do nothing. Staying under it lets us fail in our own code
 * with an explanation.
 *
 * Deliberately not in the actions file: a "use server" module can only export
 * async functions, and the composer needs this value to warn before the upload
 * rather than after it.
 */
export const MAX_ATTACHMENT_BYTES = 4_000_000;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
