import "server-only";

// Single place to record a server-side error. Right now it writes to the
// platform logs (captured by Vercel); when an error monitor is wired up, add the
// capture call here so every call site reports automatically.
export function reportError(context: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[${context}]`, error);
}
