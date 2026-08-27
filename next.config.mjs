import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // The marketing home briefly lived at /site while two versions of it
      // existed side by side. Preview links to that path are still in people's
      // hands, and without this they land on the login screen, since a path
      // that is no longer a route falls through to the app's auth gate.
      { source: "/site", destination: "/", permanent: true },
      { source: "/site/:path*", destination: "/", permanent: true },
      // The feature pages moved from /features/<argument> to root-level
      // keyword slugs (2026-08-27). Permanent, so any link equity the old
      // URLs earned follows the content. /features itself stays: it is the
      // overview index.
      { source: "/features/project-hub", destination: "/production-hub", permanent: true },
      { source: "/features/client-review", destination: "/video-review-software", permanent: true },
      { source: "/features/communication", destination: "/production-communication", permanent: true },
      { source: "/features/production", destination: "/call-sheet-software", permanent: true },
      { source: "/features/budget", destination: "/production-budgeting-software", permanent: true },
      { source: "/features/ai-pipeline", destination: "/ai-video-production", permanent: true },
      { source: "/features/runner", destination: "/runner", permanent: true },
    ];
  },
  images: {
    // Next serves WebP only by default. The marketing screenshots are large flat
    // areas of UI, which is exactly what AVIF compresses best, and they are the
    // first bytes a stranger downloads. AVIF is listed first because the browser
    // takes the first format it accepts; anything that cannot decode it falls
    // through to WebP and then to the original.
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Reply attachments (device files) post through a Server Action as FormData;
    // raise the default 1MB cap to allow real files (Gmail caps sends at ~5MB).
    serverActions: { bodySizeLimit: "12mb" },
  },
};

// withSentryConfig is safe without Sentry env: it only uploads source maps when
// SENTRY_AUTH_TOKEN is present, so local/CI builds and un-configured deploys just
// build normally.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
