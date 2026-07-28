"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  ProjectsIcon,
  BoardsIcon,
  ClientsIcon,
  LeadsIcon,
  SettingsIcon,
  CommunicationIcon,
} from "@/components/app-shell/nav-icons";
import { CommunicationBadge } from "@/components/app-shell/communication-badge";
import {
  StudioSwitcher,
  type StudioOption,
} from "@/components/app-shell/studio-switcher";

const nav = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/projects", label: "Projects", Icon: ProjectsIcon },
  { href: "/boards", label: "Boards", Icon: BoardsIcon },
  { href: "/communication", label: "Communication", Icon: CommunicationIcon },
  { href: "/clients", label: "Clients", Icon: ClientsIcon },
  { href: "/pipeline", label: "Pipeline", Icon: LeadsIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

const STORAGE_KEY = "sidebar.collapsed";

export function Sidebar({
  studioName,
  logoUrl,
  collaborator = false,
  studios = [],
  activeStudioId = "",
}: {
  studioName: string;
  logoUrl?: string | null;
  collaborator?: boolean;
  studios?: StudioOption[];
  activeStudioId?: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // A project collaborator only ever sees their project(s).
  const items = collaborator
    ? nav.filter((n) => n.href === "/projects")
    : nav;

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
    <aside
      className={`hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out print:!hidden md:flex ${
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

      <nav className="flex-1 space-y-1 p-3">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
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
      </nav>

      <div className="border-t border-border p-3">
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
