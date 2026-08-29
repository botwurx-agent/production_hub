"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RunnerIcon } from "@/components/app-shell/nav-icons";
import { navFor, isActive } from "@/components/app-shell/nav-items";
import { CommunicationBadge } from "@/components/app-shell/communication-badge";
import { openAgent } from "@/components/agent/agent-open";
import {
  StudioSwitcher,
  type StudioOption,
} from "@/components/app-shell/studio-switcher";

const STORAGE_KEY = "sidebar.collapsed";

export function Sidebar({
  studioName,
  logoUrl,
  collaborator = false,
  studios = [],
  activeStudioId = "",
  assistant = false,
}: {
  studioName: string;
  logoUrl?: string | null;
  collaborator?: boolean;
  studios?: StudioOption[];
  activeStudioId?: string;
  /** Show the Runner row. Staff only, and only with an AI key configured. */
  assistant?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const items = navFor(collaborator);

  // Restore the last collapse state (client-only to avoid a hydration mismatch).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  return (
    // Sticky and exactly one viewport tall. It used to stretch to the height
    // of the DOCUMENT (the parent is a stretching flex row), so on any page
    // longer than the screen the nav stretched with it and the Collapse
    // control sat at the bottom of the page rather than the bottom of the
    // window: measured at 1307px on a 390px-tall viewport.
    //
    // It appears at `lg`, not `md`. At 768 it spent 240px of an 820px tablet on
    // navigation and left the page 516px, which is LESS room than the same
    // phone gets held sideways (780px). Below lg the drawer carries the nav
    // instead, and it carries it better: labelled rows rather than an icon
    // rail whose title tooltips a touch device never shows.
    //
    // Hidden on a SHORT viewport at any width, which is a phone held sideways.
    // 844x390 passes even `lg` on width alone, and there is no room for a
    // full-height sidebar in 390px of height.
    <aside
      className={`sticky top-0 hidden h-[100dvh] shrink-0 flex-col self-start border-r border-border bg-surface transition-[width] duration-200 ease-out print:!hidden lg:flex short:!hidden ${
        collapsed ? "w-[68px]" : "w-60"
      }`}
    >
      <div
        className={`flex h-14 items-center border-b border-border ${
          collapsed ? "justify-center px-2" : "gap-2 px-4"
        }`}
      >
        <StudioSwitcher
          studios={studios}
          activeId={activeStudioId}
          name={studioName}
          logoUrl={logoUrl}
          collapsed={collapsed}
        />
      </div>

      {/* min-h-0 so the nav can actually shrink inside the flex column, and
          scroll its own overflow rather than pushing the footer off. */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {/* Runner opens the panel rather than navigating, so it is a button
            wearing a nav row's clothes. Deliberate: the panel slides over
            whatever you are reading and picks up the project you are already
            on, both of which a route change would throw away. It sits above
            the pages, and under its own divider, because it is a different
            kind of thing to a destination. */}
        {assistant ? (
          <>
            <button
              type="button"
              onClick={openAgent}
              data-tour="runner"
              title={collapsed ? "Runner (Cmd+K)" : undefined}
              className={`flex w-full items-center rounded-[11px] py-2 text-sm font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text ${
                collapsed ? "justify-center px-0" : "gap-3 px-3"
              }`}
            >
              <RunnerIcon />
              {!collapsed && (
                <>
                  Runner
                  <kbd className="ml-auto rounded-[6px] border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-faint">
                    ⌘K
                  </kbd>
                </>
              )}
            </button>
            <div className="!my-2 border-t border-border" />
          </>
        ) : null}

        {/* The tour anchors here rather than on <nav>, which is flex-1 and so
            stretches to the full height of a long page. Anchoring to a
            stretched element makes "scroll it into view" meaningless, since
            its middle can be a thousand pixels below the links it contains. */}
        <div className="space-y-1" data-tour="nav">
          {items.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center rounded-[11px] py-2 text-sm font-semibold transition ${
                  collapsed ? "justify-center px-0" : "gap-3 px-3"
                } ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Icon />
                {!collapsed && (
                  <>
                    {label}
                    {href === "/communication" && <CommunicationBadge />}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`flex w-full items-center rounded-[11px] py-2 text-sm font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text ${
            collapsed ? "justify-center px-0" : "gap-3 px-3"
          }`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: collapsed ? "rotate(180deg)" : "none" }}
          >
            <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
          </svg>
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
