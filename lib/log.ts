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

// Wraps a Supabase write so a failure is recorded instead of vanishing.
//
// Most writes in the action files discard their result, which means a row that
// fails to save (an RLS denial, a constraint, a dropped connection) looks
// identical to success: the page revalidates and the user assumes their work is
// stored. This does not change control flow, it only makes the failure
// observable in the logs and in Sentry. Actions that can meaningfully recover
// should still check the error and tell the user.
export async function logWrite<T extends { error: unknown }>(
  context: string,
  op: PromiseLike<T>
): Promise<T> {
  const res = await op;
  if (res.error) reportError(context, res.error);
  return res;
}
