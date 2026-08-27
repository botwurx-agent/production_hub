import Link from "next/link";
import {
  FEATURES,
  MODULES,
  PAGE_BANDS,
  featureHref,
  moduleHref,
} from "@/lib/marketing/features";

/**
 * The closing section of every feature page: the whole product, grouped by the
 * phase bands the app itself uses, every entry a link.
 *
 * This is the one structural idea taken straight from the category leader's
 * pages, because it is the idea that makes page-per-functionality compound:
 * every page passes a reader (and a crawler) to every other page, so the pages
 * rank as a body of work instead of thirteen orphans.
 *
 * REBUILT from a text-link grid into band rows of CARDS (operator's call: the
 * link grid read as a footer sitemap, which is precisely the floating-in-
 * whitespace this site's design standard bans). Each page is now a card
 * carrying its hue tile, its name and its one-line claim, so the section
 * argues instead of listing: the reader came for one tool and leaves having
 * seen twelve more, each making its own pitch. The layout deliberately echoes
 * the app's own project hub, where modules sit in these same phase bands:
 * the marketing site mirroring the product's real structure IS the pitch.
 *
 * `current` stays listed but inert and marked, because a map that pretends
 * you are not on it reads as broken.
 */

const BAND_HUES: Record<string, string> = {
  plan: "indigo",
  visualize: "purple",
  review: "green",
  produce: "amber",
  money: "blue",
  ai: "cyan",
};

export function FeatureMesh({ current }: { current?: string }) {
  return (
    <div className="overflow-clip rounded-[28px] border border-border bg-surface shadow-sm">
      {PAGE_BANDS.map((band) => {
        const pages = FEATURES.filter((f) => f.band === band.key);
        const anchored = MODULES.filter(
          (m) => !m.own && pages.some((p) => p.slug === m.page)
        );
        if (!pages.length && !anchored.length) return null;
        const hue = BAND_HUES[band.key] ?? "indigo";
        return (
          <div
            key={band.key}
            className="grid gap-4 border-border p-6 sm:p-7 lg:grid-cols-[150px_1fr] lg:gap-8 [&:not(:first-child)]:border-t"
          >
            {/* The band rail: the app's own vocabulary, colored as identity. */}
            <div className="flex items-center gap-2.5 lg:items-start lg:pt-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: `var(--h-${hue})` }}
              />
              <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-text">
                {band.label}
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              {pages.map((f) => {
                const here = f.slug === current;
                return here ? (
                  <span
                    key={f.slug}
                    className="flex min-w-[220px] flex-1 items-center gap-3 rounded-[16px] border-2 px-4 py-3 sm:min-w-[240px]"
                    style={{
                      borderColor: `var(--h-${f.hue})`,
                      backgroundColor: `var(--h-${f.hue}-bg)`,
                    }}
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px]"
                      style={{ backgroundColor: "var(--surface)" }}
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: `var(--h-${f.hue})` }}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-display text-[15px] font-extrabold tracking-tight text-text">
                          {f.nav}
                        </span>
                        <span
                          className="rounded-pill px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                          style={{
                            backgroundColor: `var(--h-${f.hue})`,
                            color: "var(--accent-fg)",
                          }}
                        >
                          This page
                        </span>
                      </span>
                      <span className="block truncate text-[12.5px] font-medium text-text-muted">
                        {f.hint}
                      </span>
                    </span>
                  </span>
                ) : (
                  <Link
                    key={f.slug}
                    href={featureHref(f)}
                    className="group flex min-w-[220px] flex-1 items-center gap-3 rounded-[16px] border border-border bg-bg px-4 py-3 transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md sm:min-w-[240px]"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] transition group-hover:scale-105"
                      style={{ backgroundColor: `var(--h-${f.hue}-bg)` }}
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: `var(--h-${f.hue})` }}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-display text-[15px] font-extrabold tracking-tight text-text">
                        {f.nav}
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                          className="shrink-0 -translate-x-1 text-accent opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
                        >
                          <path
                            d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="block truncate text-[12.5px] font-medium text-text-muted">
                        {f.hint}
                      </span>
                    </span>
                  </Link>
                );
              })}

              {/* The anchored modules ride along as quiet chips, so the band
                  states its whole territory without out-shouting its pages. */}
              {anchored.length > 0 && (
                <span className="flex w-full flex-wrap items-center gap-2 pt-1">
                  {anchored.map((m) => (
                    <Link
                      key={m.key}
                      href={moduleHref(m)}
                      className="rounded-pill border border-border px-3 py-1 text-[12.5px] font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
                    >
                      {m.name}
                    </Link>
                  ))}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
