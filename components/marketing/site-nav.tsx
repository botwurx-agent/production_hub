import Link from "next/link";
import { CtaButton } from "./cta";
import { LOGIN_URL } from "@/lib/marketing/hosts";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * Three top-level items, deliberately. Monday runs mega menus because it sells
 * a suite; we sell one product, and a mega menu would advertise complexity we
 * do not have.
 */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
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

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[15px] font-medium text-text-muted transition hover:text-text"
            >
              {l.label}
            </Link>
          ))}
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
      </nav>
    </header>
  );
}
