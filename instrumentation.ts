import * as Sentry from "@sentry/nextjs";

// Loads the right Sentry init for each server runtime. Next calls register()
// once at server startup.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures errors thrown in nested React Server Components (App Router).
export const onRequestError = Sentry.captureRequestError;
