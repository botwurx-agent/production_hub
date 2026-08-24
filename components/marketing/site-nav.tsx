import Link from "next/link";
import { CtaButton } from "./cta";
import { LOGIN_URL } from "@/lib/marketing/hosts";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * Two top-level items, deliberately. Monday runs mega menus because it sells a
 * suite; we sell one product, and a mega menu would advertise complexity we do
 * not have.
 *
 * "How it works" was removed rather than pointed somewhere new: it had been
 * linking to /#how, an anchor that does not exist on the home page, so it
 * scrolled nowhere. The product band already answers the same question with a
 * screenshot, which is a better answer than a heading would have been.
 *
 * NO BACKGROUND AND NO BORDER, so the bar is seamless with the gradient behind
 * it. Any tint at all, even a 62% one, reads as a lighter band across the top
 * because the aurora underneath is not that colour.
 *
 * The backdrop-blur stays and costs nothing here: blurring a smooth gradient
 * returns the same smooth gradient, so it is invisible at rest and only shows
 * itself once real content scrolls underneath, which is exactly when it is
 * wanted.
 *
 * Worth remembering rather than reaching for `bg-surface/70` later: Tailwind
 * compiles its opacity modifier to nothing on a var()-valued colour in this
 * setup, which is how this bar was once solid white while claiming to be 90%.
 */
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
