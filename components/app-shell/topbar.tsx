"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { NotificationBell } from "@/components/app-shell/notification-bell";
import { InviteButton } from "@/components/app-shell/invite-button";
import type { StudioOption } from "@/components/app-shell/studio-switcher";

export function Topbar({
  email,
  needsYouCount = 0,
  collaborator = false,
  studios = [],
  activeStudioId = "",
  assistant = false,
  studioName = "",
  logoUrl = null,
  projectNav = null,
}: {
  email: string | null;
  needsYouCount?: number;
  collaborator?: boolean;
  studios?: StudioOption[];
  activeStudioId?: string;
  /** Runner reads studio-wide tables, so it is staff only, and it needs an AI
   *  key to do anything at all. Both are decided on the server. */
  assistant?: boolean;
  /** For the phone drawer's header, which is the sidebar's header. */
  studioName?: string;
  logoUrl?: string | null;
  /**
   * The project's phase-band nav, on a project route only.
   *
   * Built by the app layout (which already reads the path from the x-pathname
   * header) rather than passed up from the page, for the same reason the invite
   * button reads the URL: the topbar renders above every route, and threading
   * an id down would mean every page remembering to pass one.
   *
   * Hidden below lg, where the header has no room next to the drawer, the
   * brand and four utility buttons. The project layout still renders it in the
   * page body at those widths, so nothing is lost on a phone.
   */
  projectNav?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur print:hidden">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        {/* The phone's whole navigation, in 44px. `short:` covers a phone held
            sideways, which is wide enough to pass md but has no height for the
            sidebar. */}
        <MobileNav
          studioName={studioName}
          logoUrl={logoUrl}
          collaborator={collaborator}
          studios={studios}
          activeStudioId={activeStudioId}
          assistant={assistant}
        />

        {/* Phone brand. The sidebar carries it everywhere else. */}
        <Link
          href={collaborator ? "/projects" : "/dashboard"}
          className="flex items-center gap-2 lg:hidden short:!flex"
        >
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-accent-fg">
            <span className="text-xs font-extrabold tracking-tight">SF</span>
          </span>
        </Link>

        {/* Always a flex-1 spacer, so hiding the nav on a narrow screen cannot
            slide the utility cluster left off the right edge. */}
        <div className="flex min-w-0 flex-1">
          {projectNav ? (
            <div className="hidden min-w-0 flex-1 lg:flex short:!hidden">
              {projectNav}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
