/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Reply attachments (device files) post through a Server Action as FormData;
    // raise the default 1MB cap to allow real files (Gmail caps sends at ~5MB).
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
