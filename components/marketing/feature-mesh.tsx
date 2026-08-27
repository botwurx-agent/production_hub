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
 * rank as a body of work instead of thirteen orphans. Feature pages lead each
 * band; the modules that live as anchored blocks follow as quieter links.
 *
 * `current` is still listed but inert and marked, because a map that pretends
 * you are not on it reads as broken.
 */
export function FeatureMesh({ current }: { current?: string }) {
  return (
    <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {PAGE_BANDS.map((band) => {
        const pages = FEATURES.filter((f) => f.band === band.key);
        // Anchored modules join the band their PAGE sits in, so a band lists
        // its whole territory in one place.
        const anchored = MODULES.filter(
          (m) => !m.own && pages.some((p) => p.slug === m.page)
        );
        if (!pages.length && !anchored.length) return null;
        return (
          <div key={band.key}>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-text-faint">
              {band.label}
            </p>
            <ul className="space-y-1">
              {pages.map((f) =>
                f.slug === current ? (
                  <li
                    key={f.slug}
                    className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[14px] font-semibold text-text"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: `var(--h-${f.hue})` }}
                    />
                    {f.nav}
                    <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                      You are here
                    </span>
                  </li>
                ) : (
                  <li key={f.slug}>
                    <Link
                      href={featureHref(f)}
                      className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[14px] font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: `var(--h-${f.hue})` }}
                      />
                      {f.nav}
                    </Link>
                  </li>
                )
              )}
              {anchored.map((m) => (
                <li key={m.key}>
                  <Link
                    href={moduleHref(m)}
                    className="block rounded-[8px] px-2 py-1 pl-[22px] text-[13px] font-medium text-text-faint transition hover:bg-surface-2 hover:text-text"
                  >
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
