import Link from "next/link";
import { APP_ORIGIN } from "@/lib/marketing/hosts";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#product", label: "Project hub" },
      { href: "/#review", label: "Client review" },
      { href: "/#production", label: "Shot lists and call sheets" },
      { href: "/#budget", label: "Budget and delivery" },
      { href: "/#pipeline", label: "AI pipeline" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/pricing", label: "Pricing" },
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

      <div className="mx-auto mt-12 w-full max-w-[1400px] border-t border-border pt-6">
        <p className="text-xs text-text-faint">
          © {new Date().getFullYear()} Studio Flows. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
