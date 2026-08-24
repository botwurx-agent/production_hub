import Link from "next/link";
import { CtaButton } from "./cta";
import { LOGIN_URL } from "@/lib/marketing/hosts";
import { FEATURES } from "@/lib/marketing/features";

/**
 * Two top-level items still, but "Product" became a FEATURES DROPDOWN
 * (operator's call, 2026-08-24): the feature set outgrew a single anchor link,
 * and each feature now has a dedicated page under /features. The dropdown is
 * built from lib/marketing/features.ts, the same data that builds the pages,
 * so the menu cannot list a page that does not exist.
 *
 * CSS-only on purpose: group-hover + focus-within open it, so the nav stays a
 * server component with no client JS. The trigger itself LINKS to /features
 * (the overview), so a click, a tap, and a keyboard user all have a way in
 * that never depends on hover.
 *
 * "How it works" was removed rather than pointed somewhere new: it had been
 * linking to /#how, an anchor that does not exist on the home page, so it
 * scrolled nowhere.
 *
 * NO BACKGROUND AND NO BORDER on the bar, so it is seamless with the gradient
 * behind it. Any tint at all, even a 62% one, reads as a lighter band across
 * the top because the aurora underneath is not that colour.
 *
 * Worth remembering rather than reaching for `bg-surface/70` later: Tailwind
 * compiles its opacity modifier to nothing on a var()-valued colour in this
 * setup, which is how this bar was once solid white while claiming to be 90%.
 */
function FeaturesMenu() {
  return (
    <div className="group relative">
      <Link
        href="/features"
        className="inline-flex items-center gap-1 text-[15px] font-medium text-text-muted transition hover:text-text"
      >
        Features
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mt-0.5 transition group-hover:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </Link>

      {/* pt-2 bridges the hover gap between the trigger and the card, so the
          menu does not vanish while the cursor crosses it. */}
      <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="w-[300px] rounded-2xl border border-border bg-surface p-2 shadow-xl">
          {FEATURES.map((f) => (
            <Link
              key={f.slug}
              href={`/features/${f.slug}`}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface-2"
            >
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: `var(--h-${f.hue})` }}
              />
              <span>
                <span className="block text-sm font-semibold text-text">
                  {f.nav}
                </span>
                <span className="block text-[13px] leading-snug text-text-muted">
                  {f.hint}
                </span>
              </span>
            </Link>
          ))}
          <div className="mx-3 my-1.5 h-px bg-border" />
          <Link
            href="/features"
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-accent transition hover:bg-surface-2"
          >
            All features
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md">
      <nav className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 place-items-center rounded-[9px] font-display text-[13px] font-extrabold"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
          >
            SF
          </span>
          <span className="font-display text-[17px] font-bold tracking-tight text-text">
            Studio Flows
          </span>
        </Link>

        {/* Everything else rides on the right, so the bar reads as wordmark on
            one side and actions on the other rather than three loose clusters. */}
        <div className="flex items-center gap-8">
          <div className="hidden items-center gap-8 md:flex">
            <FeaturesMenu />
            <Link
              href="/pricing"
              className="text-[15px] font-medium text-text-muted transition hover:text-text"
            >
              Pricing
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={LOGIN_URL}
              className="hidden text-[15px] font-medium text-text-muted transition hover:text-text sm:block"
            >
              Log in
            </a>
            <CtaButton size="sm" />
          </div>
        </div>
      </nav>
    </header>
  );
}
