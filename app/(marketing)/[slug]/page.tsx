import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wash } from "@/components/marketing/aurora";
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
 * The page's rhythm, in order: keyword eyebrow over a creative h1, the problem
 * named before the relief, real-shot-or-motif as evidence, three claim blocks,
 * the tick grid carrying the long tail, one differentiator band, this page's
 * anchored modules, and the mesh linking every page to every other one.
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

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const f = featureBySlug(params.slug);
  if (!f) notFound();

  const related = f.related
    .map((slug) => featureBySlug(slug))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  const mods = modulesForPage(f.slug);
  const hasShot = f.shots.length > 0;

  return (
    <>
      {/* Hero: the keyword is the eyebrow, the voice is the h1. */}
      <Section className="pt-14 sm:pt-20" backdrop={<Wash hue={f.hue} />}>
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="mb-5 text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: `var(--h-${f.hue})` }}
          >
            {f.keyword}
          </p>
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em] text-text sm:text-7xl">
            {f.h1}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted sm:text-xl">
            {f.lede}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <CtaButton shine />
              <CtaButton variant="quiet" href="/pricing" label="See pricing" />
            </div>
            <CtaMicrocopy />
          </div>
        </div>

        {/* Evidence: the real screenshot where one exists, the motif where one
            does not yet. A drawn motif beats a tinted "screenshot pending"
            card, and it never pretends to be a screenshot. */}
        {hasShot ? (
          <div className="mx-auto mt-16 max-w-[1200px]">
            {f.shots.map((s, i) => (
              <BrowserFrame
                key={s.shot}
                priority={i === 0}
                motion="settle"
                sizes="(min-width: 1280px) 1200px, 100vw"
                caption={s.caption}
                shot={s.shot}
                hue={f.hue}
                alt={s.alt}
              />
            ))}
          </div>
        ) : (
          <div className="mx-auto mt-16 max-w-xl">
            <Motif slug={f.slug} />
          </div>
        )}
      </Section>

      {/* The problem, named plainly, before any more relief is offered. */}
      <Section tint="tinted" className="!py-16 sm:!py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-faint">
            The problem
          </p>
          <p className="mt-4 font-display text-xl font-bold leading-snug tracking-tight text-text sm:text-2xl">
            {f.problem}
          </p>
        </div>
      </Section>

      {/* The claims. */}
      <Section>
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

      {/* The differentiator: one claim a competitor's page cannot make, with
          the motif as its visual on pages whose hero used a screenshot. */}
      <Section tint="tinted" backdrop={<Wash hue={f.hue} />}>
        <div
          className={
            hasShot
              ? "grid items-center gap-14 lg:grid-cols-11 lg:gap-20"
              : "mx-auto max-w-2xl text-center"
          }
        >
          <div className={hasShot ? "lg:col-span-6" : ""}>
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: `var(--h-${f.hue})` }}
            >
              {f.diff.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-text sm:text-4xl">
              {f.diff.title}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-text-muted">
              {f.diff.body}
            </p>
            <PointList
              points={f.diff.points}
              className={hasShot ? "mt-6" : "mx-auto mt-6 max-w-xl text-left"}
            />
          </div>
          {hasShot ? (
            <div className="lg:col-span-5">
              <Motif slug={f.slug} />
            </div>
          ) : null}
        </div>
      </Section>

      {/* The long tail: cheap depth, every cell true. */}
      <Section>
        <SectionHeader title={f.moreTitle} />
        <div className="mx-auto mt-12 grid max-w-5xl gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {f.ticks.map((tick) => (
            <div key={tick.t} className="flex gap-3">
              <span
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
                style={{
                  backgroundColor: `var(--h-${f.hue}-bg)`,
                  color: `var(--h-${f.hue})`,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 20 20" aria-hidden="true">
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
              <div>
                <h3 className="text-[15px] font-bold text-text">{tick.t}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-text-muted">
                  {tick.d}
                </p>
              </div>
            </div>
          ))}
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

      {/* Related pages: the spine is the argument, so every page points at the
          two neighbours it works with. */}
      <Section>
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.16em] text-text-faint">
          Works with
        </p>
        <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
          {related.map((r) => (
            <Link
              key={r.slug}
              href={featureHref(r)}
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

      {/* The mesh: every feature page reachable from every other one. */}
      <Section tint="tinted">
        <SectionHeader
          eyebrow="The whole toolkit"
          title="One product. Every price."
          sub="Every plan carries all of it. The tiers buy room, not permission."
        />
        <div className="mx-auto mt-14 max-w-5xl">
          <FeatureMesh current={f.slug} />
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
