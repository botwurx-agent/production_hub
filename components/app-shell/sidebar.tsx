"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  ProjectsIcon,
  ClientsIcon,
  LeadsIcon,
  SettingsIcon,
  CommunicationIcon,
} from "@/components/app-shell/nav-icons";
import { CommunicationBadge } from "@/components/app-shell/communication-badge";

const nav = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/projects", label: "Projects", Icon: ProjectsIcon },
  { href: "/communication", label: "Communication", Icon: CommunicationIcon },
  { href: "/clients", label: "Clients", Icon: ClientsIcon },
  { href: "/leads", label: "Leads", Icon: LeadsIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export function Sidebar({ studioName }: { studioName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-accent text-accent-fg shadow-sm">
          <span className="text-sm font-extrabold">H</span>
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-tight text-text">
            {studioName}
          </div>
          <div className="text-[11px] leading-tight text-text-faint">
            The Hub
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map(({ href, label, Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-[11px] px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              <Icon />
              {label}
              {href === "/communication" && <CommunicationBadge />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
