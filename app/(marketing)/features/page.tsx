import type { Metadata } from "next";
import Link from "next/link";
import { Wash } from "@/components/marketing/aurora";
import { CtaButton, CtaMicrocopy } from "@/components/marketing/cta";
import { Section, SectionHeader } from "@/components/marketing/section";
import {
  FEATURES,
  MODULES,
  MODULE_BANDS,
  featureHref,
  moduleHref,
} from "@/lib/marketing/features";

/** Identity hue per band, matching the app's own hub bands. */
const BAND_HUES: Record<string, string> = {
  plan: "indigo",
  visualize: "purple",
  review: "green",
  produce: "amber",
};

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything Studio Flows does, one page per feature: call sheets, shot lists, storyboards, client review, budgets, invoicing, the AI pipeline and more.",
  alternates: { canonical: "/features" },
};

/**
 * The features overview: where the nav's "Features" lands on a click or a tap,
 * and the fallback for anyone the hover dropdown does not serve. A grid of the
 * thirteen feature pages, each at its own keyword URL.
 */
export default function FeaturesIndex() {
  return (
    <>
      <Section className="pt-14 sm:pt-20" backdrop={<Wash hue="indigo" />}>
        <SectionHeader
          eyebrow="Features"
          title="Everything it takes to run the job."
          sub="One spine, thirteen pieces. Each stands on its own, and every one gets stronger because the others are in the same place."
        />

        <div className="mx-auto mt-16 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.slug}
              href={featureHref(f)}
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

      {/* The full inventory: every project module by name, grouped by the
          app's own hub bands. The grouping IS the pitch: the marketing page
          mirrors how a real project actually opens. Each name links to the
          module's anchored showcase on its feature page. */}
      <Section tint="tinted">
        <SectionHeader
          eyebrow="The full inventory"
          title={`${MODULES.length} modules, one project.`}
          sub="Everything a job carries, grouped the way the app itself groups them: the four phases a production moves through. Every one of these is a page inside the project."
        />
        <div className="mx-auto mt-14 grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {MODULE_BANDS.map((band) => (
            <div key={band.key}>
              {/* Full-strength text, matching the nav dropdown: a band label
                  that is lighter than the module names under it stops reading
                  as a header at all. */}
              <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em] text-text">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: `var(--h-${BAND_HUES[band.key]})` }}
                />
                {band.label}
              </p>
              <ul className="mt-4 space-y-4">
                {MODULES.filter((m) => m.band === band.key).map((m) => (
                  <li key={m.key}>
                    <Link href={moduleHref(m)} className="group block">
                      <span className="text-[15px] font-semibold text-text transition group-hover:text-accent">
                        {m.name}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-text-muted">
                        {m.blurb}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section className="text-center">
        <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-text sm:text-5xl">
          One product, not {MODULES.length} subscriptions.
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
