import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Browser error monitoring. Session replay is off by default (privacy + cost);
// enable later if wanted. Inert until a DSN is set.
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
