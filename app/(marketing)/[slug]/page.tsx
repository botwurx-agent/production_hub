import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { CtaButton, CtaMicrocopy } from "@/components/marketing/cta";
import { FeatureMesh } from "@/components/marketing/feature-mesh";
import { Motif } from "@/components/marketing/motifs";
import { PointList, Section, SectionHeader } from "@/components/marketing/section";
import { FEATURE_SLUGS } from "@/lib/marketing/feature-slugs";
import {
  featureBySlug,
  featureHref,
  modulesForPage,
} from "@/lib/marketing/features";

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
  return {
    title: { absolute: `${f.metaTitle} | Studio Flows` },
    description: f.lede,
    alternates: { canonical: `/${f.slug}` },
  };
}

/** The soft color canvas every product visual stands on. */
function Canvas({
  hue,
  children,
  className = "",
}: {
  hue: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] p-5 sm:p-8 ${className}`}
      style={{
        background: `linear-gradient(150deg, var(--h-${hue}-bg), color-mix(in oklch, var(--h-${hue}-bg) 45%, var(--surface)))`,
      }}
    >
      {children}
    </div>
  );
}

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const f = featureBySlug(params.slug);
  if (!f) notFound();

  const related = f.related
    .map((slug) => featureBySlug(slug))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  const mods = modulesForPage(f.slug);
  const hasShot = f.shots.length > 0;
  const shot = f.shots[0];

  return (
    <>
      {/* HERO: words left, evidence right, the whole fold. */}
      <Section className="pt-10 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
          <div>
            <p
              className="mb-5 text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: `var(--h-${f.hue})` }}
            >
              {f.keyword}
            </p>
            <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em] text-text sm:text-6xl lg:text-[4.25rem]">
              {f.h1}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-muted sm:text-xl">
              {f.lede}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CtaButton shine />
              <CtaButton variant="quiet" href="/pricing" label="See pricing" />
            </div>
            <CtaMicrocopy className="mt-3" />
          </div>

          <Canvas hue={f.hue}>
            {hasShot ? (
              <BrowserFrame
                priority
                motion="settle"
                sizes="(min-width: 1024px) 640px, 100vw"
                caption={shot.caption}
                shot={shot.shot}
                hue={f.hue}
                alt={shot.alt}
              />
            ) : (
              <Motif slug={f.slug} />
            )}
          </Canvas>
        </div>

        {/* Fold-closer: the three claims in one line, dots as hue markers, so
            the argument's shape is visible before anyone scrolls. */}
        <div className="mt-14 hidden items-stretch justify-between gap-6 border-t border-border pt-8 lg:flex">
          {f.blocks.map((b) => (
            <div key={b.title} className="flex flex-1 items-center gap-3 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-border [&:not(:first-child)]:pl-6">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: `var(--h-${f.hue})` }}
              />
              <span className="font-display text-[17px] font-bold tracking-tight text-text">
                {b.title}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* THE PROBLEM: a full band that reads like a pull quote, not a caption. */}
      <Section tint="tinted" className="!py-20 sm:!py-24">
        <div className="mx-auto grid max-w-5xl items-start gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-faint lg:pt-3">
            The problem
          </p>
          <p className="font-display text-2xl font-bold leading-[1.35] tracking-tight text-text sm:text-3xl">
            {f.problem}
          </p>
        </div>
      </Section>

      {/* THE CLAIMS: numbered panels with real presence, not columns of small
          text. The numeral is the visual anchor for a section that has no
          screenshot of its own. */}
      <Section>
        <div className="grid gap-6 lg:grid-cols-3">
          {f.blocks.map((b, i) => (
            <div
              key={b.title}
              className="flex flex-col rounded-[24px] border border-border bg-surface p-8 shadow-sm sm:p-9"
            >
              {/* A watermark numeral, not an outline: outlined digits read as
                  bubble lettering, and the anchor should whisper. */}
              <span
                className="font-display text-6xl font-extrabold leading-none tracking-tight"
                style={{ color: `color-mix(in oklch, var(--h-${f.hue}) 34%, transparent)` }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-5 font-display text-[26px] font-extrabold leading-tight tracking-tight text-text">
                {b.title}
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-text-muted">
                {b.body}
              </p>
              <PointList points={b.points} className="mt-6" />
            </div>
          ))}
        </div>
      </Section>

      {/* THE DIFFERENTIATOR: the page's one claim a competitor cannot make,
          with the motif staged on its color canvas. */}
      <Section tint="tinted">
        <div className="grid items-center gap-12 lg:grid-cols-11 lg:gap-20">
          <div className="lg:col-span-6">
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: `var(--h-${f.hue})` }}
            >
              {f.diff.eyebrow}
            </p>
            <h2 className="font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-text sm:text-5xl">
              {f.diff.title}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-text-muted">
              {f.diff.body}
            </p>
            <PointList points={f.diff.points} className="mt-7" />
          </div>
          <div className="lg:col-span-5">
            {/* The motif always lives here: on shot pages it is its first
                appearance, on motif-hero pages it recurs as the through-line. */}
            <Canvas hue={f.hue}>
              <Motif slug={f.slug} />
            </Canvas>
          </div>
        </div>
      </Section>

      {/* THE LONG TAIL: a spec grid with hairlines, so depth reads as
          structure instead of floating bullets. */}
      <Section>
        <SectionHeader title={f.moreTitle} />
        <div className="mx-auto mt-14 max-w-6xl overflow-clip rounded-[24px] border border-border bg-surface shadow-sm">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3">
            {f.ticks.map((tick, i) => (
              <div
                key={tick.t}
                className="border-border p-7 sm:p-8 [&:not(:first-child)]:border-t sm:[&:nth-child(-n+2)]:border-t-0 sm:[&:nth-child(2n)]:border-l lg:[&:nth-child(-n+3)]:!border-t-0 lg:[&:nth-child(n+4)]:!border-t lg:[&:nth-child(2n)]:border-l-0 lg:[&:not(:nth-child(3n+1))]:border-l"
              >
                <span
                  className="grid h-7 w-7 place-items-center rounded-full"
                  style={{
                    backgroundColor: `var(--h-${f.hue}-bg)`,
                    color: `var(--h-${f.hue})`,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      d="M4 10.5 8 14l8-8"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <h3 className="mt-4 font-display text-[17px] font-bold tracking-tight text-text">
                  {tick.t}
                </h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-text-muted">
                  {tick.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* This page's anchored modules, each linkable by name. */}
      {mods.length > 0 && (
        <Section tint="tinted">
          <SectionHeader
            eyebrow="Also here"
            title="Lives alongside it."
            sub="Each of these is a page inside the project, on the same spine, so nothing is retyped between them."
          />
          <div
            className={
              mods.length > 1
                ? "mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2"
                : "mx-auto mt-14 grid max-w-2xl gap-6"
            }
          >
            {mods.map((m) => (
              <div
                key={m.key}
                id={m.key}
                className="relative scroll-mt-24 overflow-clip rounded-[24px] border border-border bg-surface p-8 shadow-sm"
              >
                <span
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: `var(--h-${m.hue})` }}
                />
                <h3 className="font-display text-[22px] font-extrabold tracking-tight text-text">
                  {m.name}
                </h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-text-muted">
                  {m.blurb}
                </p>
                <PointList points={m.points} className="mt-4" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Related pages + the mesh, one band: where to go next, then the whole
          map, so the page ends by handing the reader somewhere rather than
          fading out. */}
      <Section>
        <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
          {related.map((r) => (
            <Link
              key={r.slug}
              href={featureHref(r)}
              className="group relative overflow-clip rounded-[24px] border border-border bg-surface p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: `var(--h-${r.hue})` }}
              />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-faint">
                Works with
              </p>
              <h3 className="mt-2 font-display text-xl font-extrabold tracking-tight text-text">
                {r.nav}
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-text-muted">
                {r.hint}
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

        <div className="mx-auto mt-24 max-w-6xl">
          {/* The convert line: the reader arrived searching for ONE tool, and
              this is where they learn the rest is already in the box. That is
              the pitch against every point solution they are comparing us to,
              so it gets headline scale, not a sitemap label. */}
          <div className="mb-10 max-w-3xl">
            <p
              className="text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: `var(--h-${f.hue})` }}
            >
              The whole toolkit
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-text sm:text-5xl">
              You just read about one of thirteen.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-text-muted">
              The rest is already in the box: every plan carries the whole
              toolkit, and the tiers buy room, never permission. This is the
              part a point solution cannot say.
            </p>
          </div>
          <FeatureMesh current={f.slug} />
        </div>
      </Section>

      {/* CTA: a destination panel, not a floating sentence. */}
      <Section className="!pt-4">
        <div
          className="mx-auto max-w-6xl rounded-[32px] px-8 py-16 text-center sm:py-20"
          style={{
            background: `linear-gradient(160deg, var(--h-${f.hue}-bg), color-mix(in oklch, var(--h-${f.hue}-bg) 35%, var(--surface)))`,
          }}
        >
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-text sm:text-5xl">
            Run your next job in Studio Flows.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">
            Your first project is free, with no card and no countdown.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <CtaButton shine />
            <CtaMicrocopy />
          </div>
        </div>
      </Section>
    </>
  );
}
