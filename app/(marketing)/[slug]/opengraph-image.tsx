import { notFound } from "next/navigation";
import { featureBySlug } from "@/lib/marketing/features";
import { FEATURE_SLUGS } from "@/lib/marketing/feature-slugs";
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing/og";

/**
 * One card per feature page, carrying that page's own keyword, headline and
 * hue. This is the whole reason the cards are generated: before it existed, a
 * link to the budget page and a link to the call sheet page produced the same
 * picture and the same words, so a share told the reader nothing about where
 * it went.
 *
 * generateStaticParams is declared here as well as on the page, because the
 * image is its own route: without it these render on demand rather than at
 * build time. generateImageMetadata is what makes the ALT per page; a plain
 * `export const alt` is a constant and would describe every card identically,
 * which is the same failure in a smaller place.
 */
export function generateStaticParams() {
  return FEATURE_SLUGS.map((slug) => ({ slug }));
}

export function generateImageMetadata({ params }: { params: { slug: string } }) {
  const f = featureBySlug(params.slug);
  return [
    {
      id: "card",
      alt: f ? `${f.keyword}: ${f.h1} Studio Flows.` : "Studio Flows",
      size: OG_SIZE,
      contentType: OG_CONTENT_TYPE,
    },
  ];
}

export default function Image({ params }: { params: { slug: string } }) {
  const f = featureBySlug(params.slug);
  if (!f) notFound();
  return ogCard({ eyebrow: f.keyword, title: f.h1, body: f.lede, hue: f.hue });
}
