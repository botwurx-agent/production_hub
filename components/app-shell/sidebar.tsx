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
}: {
  studioName: string;
  logoUrl?: string | null;
  collaborator?: boolean;
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
        {logoUrl ? (
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={studioName} className="h-full w-full object-contain p-0.5" />
          </span>
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent text-accent-fg shadow-sm">
            <span className="text-xs font-extrabold tracking-tight">SF</span>
          </span>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight text-text">
              {studioName}
            </div>
            <div className="text-[11px] leading-tight text-text-faint">Studio Flows</div>
          </div>
        )}
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
