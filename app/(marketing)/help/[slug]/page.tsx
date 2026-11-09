import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section } from "@/components/marketing/section";
import { HelpMedia } from "@/components/marketing/help/help-media";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  articlesIn,
  helpArticle,
  helpCategory,
} from "@/lib/help/articles";
import { featureBySlug, featureHref } from "@/lib/marketing/features";
import { SIGNUP_URL } from "@/lib/marketing/hosts";

/**
 * One help article: numbered steps, each with its real screenshot when one
 * exists, tips, and a way on to the next guide.
 *
 * The left rail lists the other guides in the same topic and every topic
 * below, so a reader is never more than one click from the next thing, and it
 * sticks while the steps scroll. On a phone the rail drops below the article.
 */

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = helpArticle(params.slug);
  if (!a) return {};
  const title = `${a.title} | Studio Flows help`;
  return {
    title: a.title,
    description: a.summary,
    alternates: { canonical: `/help/${a.slug}` },
    openGraph: { title, description: a.summary, url: `/help/${a.slug}`, type: "article" },
    twitter: { card: "summary_large_image", title, description: a.summary },
  };
}

export default function HelpArticlePage({ params }: { params: { slug: string } }) {
  const a = helpArticle(params.slug);
  if (!a) notFound();
  const cat = helpCategory(a.category);
  const siblings = articlesIn(a.category);
  const i = HELP_ARTICLES.indexOf(a);
  const prev = HELP_ARTICLES[i - 1];
  const next = HELP_ARTICLES[i + 1];
  const feature = a.feature ? featureBySlug(a.feature) : undefined;

  // HowTo structured data: the steps are exactly that shape, and search shows
  // them as a numbered guide.
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: a.title,
    description: a.summary,
    totalTime: `PT${a.minutes}M`,
    step: a.steps.map((s, n) => ({ "@type": "HowToStep", position: n + 1, name: s.title, text: s.body })),
  };

  return (
    <Section className="!pt-10 sm:!pt-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo) }} />

      <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-[14px] text-text-muted">
        <Link href="/help" className="hover:text-text">Help center</Link>
        <span aria-hidden>/</span>
        <Link href={`/help?topic=${cat.id}`} className="hover:text-text">{cat.label}</Link>
      </nav>

      <div className="grid gap-12 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <article className="min-w-0 lg:order-2">
          <header className="max-w-[760px]">
            <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: `var(--h-${cat.hue})` }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--h-${cat.hue})` }} aria-hidden />
              {cat.label}
            </span>
            <h1 className="mt-3 font-display text-[38px] font-extrabold leading-[1.06] tracking-tight text-text sm:text-[52px]">
              {a.title}
            </h1>
            <p className="mt-4 text-[18px] leading-relaxed text-text-muted">{a.summary}</p>
            <p className="mt-4 text-[14px] text-text-faint">
              {a.steps.length} steps · about {a.minutes} {a.minutes === 1 ? "minute" : "minutes"}
            </p>
          </header>

          {a.hero && (
            <div className="mt-10 max-w-[900px]">
              <HelpMedia media={a.hero} priority sizes="(min-width: 1280px) 900px, 100vw" />
            </div>
          )}

          <ol className="mt-12 max-w-[820px] space-y-12">
            {a.steps.map((s, n) => (
              <li key={s.title} id={`step-${n + 1}`} className="scroll-mt-24">
                <div className="flex gap-5">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-[17px] font-extrabold"
                    style={{ background: `var(--h-${cat.hue}-bg)`, color: "var(--text)", boxShadow: `inset 0 0 0 1.5px var(--h-${cat.hue})` }}
                  >
                    {n + 1}
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <h2 className="font-display text-[22px] font-bold tracking-tight text-text">{s.title}</h2>
                    <p className="mt-2 text-[16px] leading-[1.7] text-text-muted">{s.body}</p>
                    {s.media && (
                      <div className="mt-5">
                        <HelpMedia media={s.media} />
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {a.tips && a.tips.length > 0 && (
            <aside className="mt-14 max-w-[820px] rounded-2xl border border-border bg-surface-2 p-6 sm:p-8">
              <h2 className="font-display text-[18px] font-bold text-text">Good to know</h2>
              <ul className="mt-3 space-y-3">
                {a.tips.map((t) => (
                  <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-text-muted">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <div className="mt-10 grid max-w-[820px] gap-4 sm:grid-cols-2">
            {feature && (
              <Link href={featureHref(feature)} className="rounded-2xl border border-border bg-surface p-5 transition hover:border-border-strong">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-text-faint">The bigger picture</span>
                <span className="mt-1 block font-display text-[17px] font-bold text-text">See {feature.nav} in action</span>
              </Link>
            )}
            <a href={SIGNUP_URL} className="rounded-2xl border border-border bg-accent-soft p-5 transition hover:border-border-strong">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-text-faint">Try it yourself</span>
              <span className="mt-1 block font-display text-[17px] font-bold text-text">Start free, no card needed</span>
            </a>
          </div>

          <nav aria-label="More guides" className="mt-14 grid max-w-[820px] gap-4 border-t border-border pt-8 sm:grid-cols-2">
            {prev ? (
              <Link href={`/help/${prev.slug}`} className="group">
                <span className="text-[13px] text-text-faint">Previous</span>
                <span className="mt-1 block font-display text-[17px] font-bold text-text group-hover:text-accent">← {prev.title}</span>
              </Link>
            ) : <span />}
            {next && (
              <Link href={`/help/${next.slug}`} className="group sm:text-right">
                <span className="text-[13px] text-text-faint">Next</span>
                <span className="mt-1 block font-display text-[17px] font-bold text-text group-hover:text-accent">{next.title} →</span>
              </Link>
            )}
          </nav>
        </article>

        <aside className="lg:order-1">
          <div className="lg:sticky lg:top-24">
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-text-faint">{cat.label}</p>
            <ul className="mt-3 space-y-1 border-l border-border">
              {siblings.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/help/${s.slug}`}
                    aria-current={s.slug === a.slug ? "page" : undefined}
                    className={`-ml-px block border-l-2 py-1.5 pl-4 text-[15px] transition ${
                      s.slug === a.slug
                        ? "border-accent font-semibold text-text"
                        : "border-transparent text-text-muted hover:border-border-strong hover:text-text"
                    }`}
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
            {a.steps.length > 2 && (
              <>
                <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.14em] text-text-faint">On this page</p>
                <ol className="mt-3 space-y-1.5">
                  {a.steps.map((s, n) => (
                    <li key={s.title}>
                      <a href={`#step-${n + 1}`} className="text-[14px] text-text-muted hover:text-text">
                        {n + 1}. {s.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <p className="mt-8 text-[13px] font-bold uppercase tracking-[0.14em] text-text-faint">Other topics</p>
            <ul className="mt-3 space-y-1.5">
              {HELP_CATEGORIES.filter((c) => c.id !== cat.id).map((c) => (
                <li key={c.id}>
                  <Link href={`/help?topic=${c.id}`} className="flex items-center gap-2 text-[14px] text-text-muted hover:text-text">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--h-${c.hue})` }} aria-hidden />
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </Section>
  );
}
