"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { LOGIN_URL } from "@/lib/marketing/hosts";
import { FEATURES, PAGE_BANDS, featureHref } from "@/lib/marketing/features";

/**
 * The phone's navigation for the marketing site.
 *
 * There was none. Features and Pricing were `hidden md:flex` and Log in was
 * `hidden sm:block`, so below 640px the bar offered exactly two things: the
 * wordmark and Start free. Thirteen feature pages, the pricing page, and the
 * way back into the app were all unreachable from a phone, which is most of
 * the traffic a marketing site gets and the half of it least likely to try
 * again on a laptop.
 *
 * A CLIENT ISLAND on purpose, and only this. SiteNav stays a server component
 * and its desktop dropdown stays CSS-only (group-hover plus focus-within), so
 * no JavaScript is shipped for the case that already worked. A menu that opens
 * on tap and closes on navigation genuinely needs state; `<details>` would
 * avoid the island but would stay open over the page it just took you to,
 * because Next navigates on the client and never unmounts it.
 *
 * It lists the feature pages rather than linking only to /features, from the
 * same FEATURES data the desktop menu and the pages themselves are built from,
 * so it cannot offer a page that does not exist.
 */
export function SiteNavMobile() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* 44px, the smallest target a thumb hits reliably. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-text-muted transition hover:bg-surface-2 hover:text-text md:hidden"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-50 md:hidden">
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                className="absolute inset-x-0 top-0 flex max-h-[100dvh] flex-col rounded-b-2xl border-b border-border bg-surface shadow-xl"
              >
                <div className="flex h-16 shrink-0 items-center justify-between px-6">
                  <Link href="/" className="flex items-center gap-2.5">
                    <span
                      className="grid h-8 w-8 place-items-center rounded-[9px] font-display text-[13px] font-extrabold"
                      style={{
                        backgroundColor: "var(--accent)",
                        color: "var(--accent-fg)",
                      }}
                    >
                      SF
                    </span>
                    <span className="font-display text-[17px] font-bold tracking-tight text-text">
                      Studio Flows
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-text-muted transition hover:bg-surface-2 hover:text-text"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-7">
                  {PAGE_BANDS.map((band) => {
                    const pages = FEATURES.filter((f) => f.band === band.key);
                    if (!pages.length) return null;
                    return (
                      <div key={band.key} className="mb-4">
                        <p className="pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-text-faint">
                          {band.label}
                        </p>
                        {pages.map((f) => (
                          <Link
                            key={f.slug}
                            href={featureHref(f)}
                            className="flex items-center gap-2.5 rounded-[10px] py-2.5 text-[15px] font-semibold text-text transition hover:bg-surface-2"
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: `var(--h-${f.hue})` }}
                            />
                            {f.nav}
                          </Link>
                        ))}
                      </div>
                    );
                  })}

                  <div className="mt-2 space-y-1 border-t border-border pt-4">
                    <Link
                      href="/features"
                      className="block rounded-[10px] py-2.5 text-[15px] font-semibold text-text transition hover:bg-surface-2"
                    >
                      All features
                    </Link>
                    <Link
                      href="/pricing"
                      className="block rounded-[10px] py-2.5 text-[15px] font-semibold text-text transition hover:bg-surface-2"
                    >
                      Pricing
                    </Link>
                    <a
                      href={LOGIN_URL}
                      className="block rounded-[10px] py-2.5 text-[15px] font-semibold text-text transition hover:bg-surface-2"
                    >
                      Log in
                    </a>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
