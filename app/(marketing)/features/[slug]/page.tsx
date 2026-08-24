import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wash } from "@/components/marketing/aurora";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { CtaButton, CtaMicrocopy } from "@/components/marketing/cta";
import { PointList, Section, SectionHeader } from "@/components/marketing/section";
import {
  FEATURES,
  featureBySlug,
  modulesForPage,
} from "@/lib/marketing/features";

/**
 * One template for every feature page, fed by lib/marketing/features.ts. Shape:
 * hero (name, title, lede), the product shot as the evidence, three claim
 * blocks, two related features, CTA. Adding a feature page is adding a data
 * entry, not a page.
 */

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const f = featureBySlug(params.slug);
  if (!f) return {};
  return {
    title: f.nav,
    description: f.lede,
    alternates: { canonical: `/features/${f.slug}` },
  };
}

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const f = featureBySlug(params.slug);
  if (!f) notFound();

  const related = f.related
    .map((slug) => featureBySlug(slug))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  const mods = modulesForPage(f.slug);

  return (
    <>
      {/* Hero + the shot as evidence, the home hero's shape. */}
      <Section className="pt-14 sm:pt-20" backdrop={<Wash hue={f.hue} />}>
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="mb-5 text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: `var(--h-${f.hue})` }}
          >
            {f.nav}
          </p>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-text sm:text-6xl">
            {f.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted sm:text-xl">
            {f.lede}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <CtaButton shine />
            <CtaMicrocopy />
          </div>
        </div>

        <div
          className={
            f.shots.length > 1
              ? "mx-auto mt-16 grid max-w-[1200px] gap-10 lg:grid-cols-2"
              : "mx-auto mt-16 max-w-[1200px]"
          }
        >
          {f.shots.map((s, i) => (
            <BrowserFrame
              key={s.shot}
              priority={i === 0}
              motion="settle"
              sizes={
                f.shots.length > 1
                  ? "(min-width: 1280px) 580px, 100vw"
                  : "(min-width: 1280px) 1200px, 100vw"
              }
              caption={s.caption}
              shot={s.shot}
              hue={f.hue}
              alt={s.alt}
            />
          ))}
        </div>
      </Section>

      {/* The claims. Three blocks in one band: a feature page argues one
          feature, so the alternating full-band rhythm of the home page would
          overstate it. */}
      <Section tint="tinted">
        <div className="grid gap-12 lg:grid-cols-3 lg:gap-10">
          {f.blocks.map((b) => (
            <div key={b.title}>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-text">
                {b.title}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
                {b.body}
              </p>
              <PointList points={b.points} className="mt-5" />
            </div>
          ))}
        </div>
      </Section>

      {/* The modules: every project feature that lives on this page, each an
          ANCHORED block so the nav dropdown and the /features inventory can
          link straight to it. This is the layer the operator asked for: all of
          the project's features, each named and showable, without twenty thin
          pages that would outrun the screenshots we can honestly take. */}
      {mods.length > 0 && (
        <Section>
          <SectionHeader
            eyebrow="The modules"
            title="Every piece, by name."
            sub="Each of these is a page inside the project, not a bullet point. They share the same spine, so nothing is retyped between them."
          />
          <div
            className={
              mods.length > 1
                ? "mx-auto mt-14 grid max-w-5xl gap-5 sm:grid-cols-2"
                : "mx-auto mt-14 grid max-w-2xl gap-5"
            }
          >
            {mods.map((m) => (
              <div
                key={m.key}
                id={m.key}
                className="relative scroll-mt-24 overflow-clip rounded-2xl border border-border bg-surface p-7 shadow-sm"
              >
                <span
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: `var(--h-${m.hue})` }}
                />
                <h3 className="font-display text-xl font-extrabold tracking-tight text-text">
                  {m.name}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
                  {m.blurb}
                </p>
                <PointList points={m.points} className="mt-4" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Related features: the spine is the product's argument, so every page
          points at the two neighbours it works with. */}
      <Section>
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.16em] text-text-faint">
          Works with
        </p>
        <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
          {related.map((r) => (
            <Link
              key={r.slug}
              href={`/features/${r.slug}`}
              className="group relative overflow-clip rounded-2xl border border-border bg-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: `var(--h-${r.hue})` }}
              />
              <h3 className="font-display text-lg font-extrabold tracking-tight text-text">
                {r.nav}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                {r.hint}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition group-hover:gap-2.5">
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

      {/* CTA */}
      <Section className="text-center" backdrop={<Wash hue={f.hue} />}>
        <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-text sm:text-5xl">
          Run your next job in Studio Flows.
        </h2>
        <div className="mt-8 flex flex-col items-center gap-4">
          <CtaButton shine />
          <CtaMicrocopy />
        </div>
      </Section>
    </>
  );
}
