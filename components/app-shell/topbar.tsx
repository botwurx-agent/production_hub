"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/app-shell/user-menu";
import { BellIcon } from "@/components/app-shell/nav-icons";

const nav = [
  { href: "/projects", label: "Projects" },
  { href: "/clients", label: "Clients" },
  { href: "/leads", label: "Leads" },
  { href: "/settings", label: "Settings" },
];

export function Topbar({
  email,
  needsYouCount = 0,
}: {
  email: string | null;
  needsYouCount?: number;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        {/* Mobile brand */}
        <Link href="/projects" className="flex items-center gap-2 md:hidden">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-accent-fg">
            <span className="text-sm font-extrabold">H</span>
          </span>
        </Link>

        {/* Mobile nav */}
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto md:hidden">
          {nav.map(({ href, label }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`whitespace-nowrap rounded-pill px-3 py-1.5 text-xs font-semibold ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-text-muted"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden flex-1 md:block" />

        <div className="flex items-center gap-2">
          <Link
            href="/projects"
            aria-label={`${needsYouCount} items need you`}
            title="Needs you"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-[11px] border border-border bg-surface text-text-muted shadow-sm transition hover:border-border-strong hover:text-text"
          >
            <BellIcon />
            {needsYouCount > 0 && (
              <span
                className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: "var(--h-red)" }}
              >
                {needsYouCount > 9 ? "9+" : needsYouCount}
              </span>
            )}
          </Link>
          <ThemeToggle />
          <UserMenu email={email} />
        </div>
      </div>
    </header>
  );
}
