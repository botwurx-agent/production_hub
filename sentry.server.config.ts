import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Server-side (Node runtime) error + performance monitoring. Fully inert until a
// DSN is set, so local/CI builds and un-configured deploys carry no overhead.
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  debug: false,
});
