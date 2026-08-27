import type { MetadataRoute } from "next";
import { FEATURE_SLUGS } from "@/lib/marketing/feature-slugs";

/**
 * The sitemap exists for the MARKETING site only: the app lives behind auth
 * and has no business in a search index. Built from the same slug module as
 * the routes and the middleware, so a new feature page joins the sitemap by
 * existing.
 *
 * The apex domain is hardcoded rather than read from NEXT_PUBLIC_SITE_URL,
 * because that env var points at the APP host (app.studio-flows.com) and a
 * sitemap full of app-host URLs would tell search engines to index the login
 * screen thirteen times.
 */
const ORIGIN = "https://studio-flows.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${ORIGIN}/`, lastModified: now, priority: 1 },
    { url: `${ORIGIN}/pricing`, lastModified: now, priority: 0.9 },
    { url: `${ORIGIN}/features`, lastModified: now, priority: 0.8 },
    ...FEATURE_SLUGS.map((slug) => ({
      url: `${ORIGIN}/${slug}`,
      lastModified: now,
      priority: 0.8,
    })),
  ];
}
