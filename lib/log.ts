import "server-only";
import * as Sentry from "@sentry/nextjs";

// Single place to record a server-side error. Writes to the platform logs and
// forwards to Sentry (a no-op until a DSN is configured), so every call site
// reports automatically.
export function reportError(context: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[${context}]`, error);
  Sentry.captureException(error, { tags: { context } });
}
