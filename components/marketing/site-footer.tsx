import Link from "next/link";
import { APP_ORIGIN } from "@/lib/marketing/hosts";
import { StudioTile } from "@/components/brand/studio-mark";
import { FEATURES, featureHref } from "@/lib/marketing/features";
import { LIVE_SOCIALS } from "@/lib/marketing/socials";
import { SocialIcon } from "./social-icons";

const COLUMNS = [
  {
    title: "Features",
    // Built from the same data as the nav dropdown and the pages, so the
    // footer cannot link a page that does not exist (the /#how lesson).
    links: [
      ...FEATURES.map((f) => ({
        href: featureHref(f),
        label: f.nav,
      })),
      { href: "/features", label: "All features" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: `${APP_ORIGIN}/terms`, label: "Terms" },
      { href: `${APP_ORIGIN}/privacy`, label: "Privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface px-6 py-16 sm:px-10">
      <div className="mx-auto grid w-full max-w-[1400px] gap-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <StudioTile />
            <span className="font-display text-[17px] font-bold tracking-tight text-text">
              Studio Flows
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-text-muted">
            The connected production hub for studios of every scale. Built
            inside a working studio.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="font-display text-sm font-bold text-text">
              {col.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-text-muted transition hover:text-text"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 flex w-full max-w-[1400px] flex-col-reverse gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-faint">
          © {new Date().getFullYear()} Studio Flows. All rights reserved.
        </p>
        {LIVE_SOCIALS.length > 0 && (
          <ul className="-ml-2 flex items-center gap-1 sm:-mr-2 sm:ml-0">
            {LIVE_SOCIALS.map((s) => (
              <li key={s.network}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Studio Flows on ${s.label}`}
                  title={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-2 hover:text-text"
                >
                  <SocialIcon network={s.network} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}
