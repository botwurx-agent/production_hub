import Link from "next/link";

/** The SF mark, shared by the marketing nav and footer. */
export function Mark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-xs";
  return (
    <span
      className={`grid ${box} place-items-center rounded-[9px] bg-accent font-display font-extrabold tracking-tight text-accent-fg`}
    >
      SF
    </span>
  );
}

export function MarketingNav() {
  return (
    // A translucent bar has to be written as color-mix rather than bg-bg/92:
    // Tailwind's opacity modifier compiles to nothing on a var()-valued color
    // in this setup, so the nav would end up with no background at all.
    <header
      className="sticky top-0 z-40 border-b border-border backdrop-blur"
      style={{ backgroundColor: "color-mix(in oklch, var(--bg) 92%, transparent)" }}
    >
      <nav className="mx-auto flex max-w-[1180px] items-center gap-3 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="font-display text-[17px] font-extrabold tracking-[-0.4px]">
            Studio Flows
          </span>
        </Link>

        <div className="ml-auto hidden items-center gap-7 md:flex">
          <a
            href="#how"
            className="text-sm font-medium text-text-muted transition hover:text-text"
          >
            How it works
          </a>
          <a
            href="#review"
            className="text-sm font-medium text-text-muted transition hover:text-text"
          >
            Client review
          </a>
          <a
            href="#why"
            className="text-sm font-medium text-text-muted transition hover:text-text"
          >
            Why it exists
          </a>
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-7">
          <Link
            href="/login"
            className="rounded-[10px] px-3 py-2 text-sm font-medium text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-[10px] bg-accent px-4 py-2 font-display text-sm font-bold text-accent-fg shadow-sm transition hover:opacity-90"
          >
            Start free
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-6 py-10 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <Mark size="sm" />
          <span className="font-display text-sm font-extrabold tracking-[-0.3px]">
            Studio Flows
          </span>
        </div>
        <p className="max-w-[42ch] text-[13px] text-text-faint sm:ml-6">
          Pre-production, review and delivery for boutique commercial studios.
        </p>
        <div className="flex items-center gap-5 text-[13px] text-text-faint sm:ml-auto">
          <Link href="/terms" className="transition hover:text-text">
            Terms
          </Link>
          <Link href="/privacy" className="transition hover:text-text">
            Privacy
          </Link>
          <Link href="/login" className="transition hover:text-text">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
