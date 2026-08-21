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
 *
 * TRANSPARENT, not white. The aurora is rendered behind the whole top of the
 * page (see the marketing layout), so the bar picks up the same gradient the
 * hero sits on, and content scrolling underneath stays visible through the
 * blur.
 *
 * The translucency is an INLINE color-mix rather than `bg-surface/70`. Tailwind
 * compiles its opacity modifier to nothing on a var()-valued colour in this
 * setup, which is exactly how this bar ended up solid white: the /90 that was
 * here before never did anything at all. Same trap as the weekend tinting on
 * the studio slate.
 */
export function SiteNav() {
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{
        backgroundColor: "color-mix(in oklch, var(--surface) 62%, transparent)",
        borderColor: "color-mix(in oklch, var(--border) 70%, transparent)",
      }}
    >
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
        </div>
      </nav>
    </header>
  );
}
