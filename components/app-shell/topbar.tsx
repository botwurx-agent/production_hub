"use client";

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

        <div className="flex-1" />

        <div className="flex items-center gap-2">
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
