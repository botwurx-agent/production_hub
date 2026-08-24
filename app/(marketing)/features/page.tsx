import type { Metadata } from "next";
import Link from "next/link";
import { Wash } from "@/components/marketing/aurora";
import { CtaButton, CtaMicrocopy } from "@/components/marketing/cta";
import { Section, SectionHeader } from "@/components/marketing/section";
import { FEATURES } from "@/lib/marketing/features";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything Studio Flows does, one page per argument: the project hub, client review, communication, call sheets, budgets and invoicing, the AI pipeline, and Runner.",
  alternates: { canonical: "/features" },
};

/**
 * The features overview: where the nav's "Features" lands on a click or a tap,
 * and the fallback for anyone the hover dropdown does not serve. A grid of the
 * seven arguments, each opening its dedicated page.
 */
export default function FeaturesIndex() {
  return (
    <>
      <Section className="pt-14 sm:pt-20" backdrop={<Wash hue="indigo" />}>
        <SectionHeader
          eyebrow="Features"
          title="Everything it takes to run the job."
          sub="Seven pieces, one spine. Each one stands on its own, and every one gets stronger because the others are in the same place."
        />

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Link
              key={f.slug}
              href={`/features/${f.slug}`}
              className="group relative overflow-clip rounded-2xl border border-border bg-surface p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              {/* Identity accent: a hue bar on the top edge, the same color-as-
                  signal restraint the app itself uses. */}
              <span
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: `var(--h-${f.hue})` }}
              />
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-[10px]"
                style={{ backgroundColor: `var(--h-${f.hue}-bg)` }}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: `var(--h-${f.hue})` }}
                />
              </span>
              <h2 className="mt-4 font-display text-xl font-extrabold tracking-tight text-text">
                {f.nav}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
                {f.hint}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition group-hover:gap-2.5">
                See how it works
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section className="text-center" tint="tinted">
        <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-text sm:text-5xl">
          One product, not seven subscriptions.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-text-muted">
          Every plan includes all of it. The tiers buy room, not permission.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <CtaButton shine />
          <CtaMicrocopy />
        </div>
      </Section>
    </>
  );
}
