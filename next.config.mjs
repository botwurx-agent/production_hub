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
    ];
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
