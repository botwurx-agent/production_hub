"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/app-shell/user-menu";
import { NotificationBell } from "@/components/app-shell/notification-bell";
import { InviteButton } from "@/components/app-shell/invite-button";
import { openAgent } from "@/components/agent/agent-open";
import { RunnerIcon } from "@/components/app-shell/nav-icons";
import type { StudioOption } from "@/components/app-shell/studio-switcher";

const nav = [
  { href: "/projects", label: "Projects" },
  { href: "/boards", label: "Boards" },
  { href: "/communication", label: "Comms" },
  { href: "/clients", label: "Clients" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/settings", label: "Settings" },
];

export function Topbar({
  email,
  needsYouCount = 0,
  collaborator = false,
  studios = [],
  activeStudioId = "",
  assistant = false,
}: {
  email: string | null;
  needsYouCount?: number;
  collaborator?: boolean;
  studios?: StudioOption[];
  activeStudioId?: string;
  /** Runner reads studio-wide tables, so it is staff only, and it needs an AI
   *  key to do anything at all. Both are decided on the server. */
  assistant?: boolean;
}) {
  const pathname = usePathname();
  const items = collaborator ? nav.filter((n) => n.href === "/projects") : nav;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur print:hidden">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        {/* Mobile brand */}
        <Link href="/projects" className="flex items-center gap-2 md:hidden">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-accent-fg">
            <span className="text-xs font-extrabold tracking-tight">SF</span>
          </span>
        </Link>

        {/* Mobile nav */}
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto md:hidden">
          {items.map(({ href, label }) => {
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
          {/* Desktop reaches Runner from the sidebar; this is the phone's
              only route to it, since the sidebar is hidden below md. */}
          {assistant ? (
            <button
              type="button"
              onClick={openAgent}
              aria-label="Open Runner"
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-text-muted hover:bg-surface-2 hover:text-text md:hidden"
            >
              <RunnerIcon />
            </button>
          ) : null}
          {/* Hidden from collaborators, who cannot invite anyone: the server
              actions refuse them, so a button here would only be a dead end. */}
          {!collaborator && <InviteButton />}
          <span data-tour="notifications">
            <NotificationBell needsYouCount={needsYouCount} />
          </span>
          <ThemeToggle />
          <UserMenu
            email={email}
            studios={studios}
            activeStudioId={activeStudioId}
          />
        </div>
      </div>
    </header>
  );
}
