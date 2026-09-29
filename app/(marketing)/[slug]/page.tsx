import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeaturePageView } from "@/components/marketing/feature-page-view";
import { FEATURE_SLUGS } from "@/lib/marketing/feature-slugs";
import { featureBySlug } from "@/lib/marketing/features";
import { chaptersFor, LIVE_CHAPTER_PAGES } from "@/lib/marketing/chapters";

/**
 * One template for every feature page, fed by lib/marketing/features.ts.
 *
 * ROOT-LEVEL DYNAMIC ROUTE, and the two lines below are what make that safe:
 * only the slugs in FEATURE_SLUGS build, and anything else 404s instead of
 * being caught. The slugs are keyword-shaped ("call-sheet-software") because
 * the URL is the search term; that is the point of the whole restructure.
 *
 * REBUILT 2026-08-27 after the operator compared the first pass against
 * Monday's industry pages and called it flat. What the first pass got wrong,
 * kept here as the standard for anything built on this site later:
 *
 * - NOTHING IMPORTANT IS CENTER-STACKED. The hero is a two-column spread:
 *   words left, evidence right, filling the fold. A page where every element
 *   sits on the center axis reads as a template, because every template does
 *   exactly that.
 * - EVERY SECTION HAS A VISUAL ANCHOR. Product visuals sit on large rounded
 *   COLOR CANVASES (the page hue's soft token). That is staging, not a
 *   decorative wash: the color exists to present the product, the same way a
 *   gallery wall exists for the painting. Text-only sections earn structure
 *   from panels, numerals and hairline grids instead.
 * - TYPE CARRIES THE STRUCTURE. Marketing body text never drops below 15px,
 *   claims run 17px+, headlines are large and tight. Small text reads as a
 *   spec sheet, and a spec sheet is what "boring" looks like up close.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURE_SLUGS.map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const f = featureBySlug(params.slug);
  if (!f) return {};
  const title = `${f.metaTitle} | Studio Flows`;
  return {
    title: { absolute: title },
    description: f.lede,
    alternates: { canonical: `/${f.slug}` },
    // Stated per page, or every feature page shares the home page's card and a
    // link to one of them describes another. The image itself comes from this
    // segment's opengraph-image.tsx, which reads the same FeatureDef.
    openGraph: {
      title,
      description: f.lede,
      url: `/${f.slug}`,
      type: "website",
    },
    // `card` is repeated at every override on purpose. Next REPLACES the
    // parent's `twitter` object rather than merging into it, so a child that
    // sets only a title silently drops back to the small `summary` card.
    twitter: { card: "summary_large_image", title, description: f.lede },
  };
}

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const f = featureBySlug(params.slug);
  if (!f) notFound();
  // A page switches to its chapter form only once the operator has approved
  // it; until then its chapters are visible at /dev/feature/<slug>.
  const chapters = LIVE_CHAPTER_PAGES.includes(f.slug) ? chaptersFor(f.slug) : undefined;
  return <FeaturePageView f={f} chapters={chapters} />;
}
