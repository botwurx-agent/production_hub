import type { MetadataRoute } from "next";

/**
 * Pairs with app/sitemap.ts. The app host is behind auth and returns nothing
 * a crawler can use, so only the marketing site is offered; the Sitemap line
 * is how a crawler finds the index without Search Console being told.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://studio-flows.com/sitemap.xml",
  };
}
