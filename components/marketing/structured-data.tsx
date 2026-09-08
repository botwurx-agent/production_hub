import { PLANS, FAQS } from "@/lib/marketing/pricing";

/**
 * Schema.org markup for the marketing site.
 *
 * WHAT THIS IS FOR: a search engine, and increasingly an assistant answering a
 * question about production software, reads the page and has to work out what
 * the product is, who makes it, and what it costs. Structured data states it
 * outright instead of leaving it to be inferred from prose.
 *
 * THE ONE RULE, and it is the same rule the rest of the site follows: nothing
 * here is claimed unless it is true. In particular there is NO aggregateRating
 * and NO review markup, because there are no customers yet and no reviews to
 * aggregate. Inventing them would be a search-policy violation on the page a
 * buyer scrutinises hardest, and it is the same fabricated social proof this
 * site already refuses in its copy ("Best value", never "Most popular").
 *
 * Prices are read from lib/marketing/pricing.ts, the same module the cards and
 * the compare table read, so the markup cannot quote a price the page does not.
 */

const ORIGIN = "https://studio-flows.com";

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // The payload is our own module data, not user input. Stringify escapes
      // the quotes; the `<` guard is the standard defence against a literal
      // </script> ending the block early if a string ever carries one.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${ORIGIN}/#organization`,
  name: "Studio Flows",
  url: ORIGIN,
  logo: `${ORIGIN}/icon`,
  description:
    "A connected production hub for commercial production studios: briefs, boards, client approvals, schedules, call sheets and budgets in one place.",
};

/** Site-wide identity. Mounted once in the marketing layout. */
export function SiteSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          ORGANIZATION,
          {
            "@type": "WebSite",
            "@id": `${ORIGIN}/#website`,
            url: ORIGIN,
            name: "Studio Flows",
            publisher: { "@id": `${ORIGIN}/#organization` },
          },
        ],
      }}
    />
  );
}

/**
 * The product and what it costs. On the pricing page, where the offers are
 * actually stated, so the markup and the visible page agree.
 *
 * ANNUAL is the price quoted, matching the cards' default toggle position, and
 * every plan is a real tier from PLANS including the free one.
 */
export function PricingSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Studio Flows",
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Video production management software",
        operatingSystem: "Web browser",
        url: ORIGIN,
        publisher: { "@id": `${ORIGIN}/#organization` },
        description:
          "Production management software for commercial studios: briefs, moodboards, storyboards, shot lists, shooting schedules, call sheets, client review and approval, budgets and invoicing.",
        offers: PLANS.map((p) => ({
          "@type": "Offer",
          name: p.name,
          description: p.tagline,
          price: String(p.annual),
          priceCurrency: "USD",
          url: `${ORIGIN}/pricing`,
          availability: "https://schema.org/InStock",
          ...(p.annual > 0
            ? {
                priceSpecification: {
                  "@type": "UnitPriceSpecification",
                  price: String(p.annual),
                  priceCurrency: "USD",
                  unitText: "seat per month, billed annually",
                },
              }
            : {}),
        })),
      }}
    />
  );
}

/** The pricing page's written questions, stated as questions. */
export function FaqSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }}
    />
  );
}
