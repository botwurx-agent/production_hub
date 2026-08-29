import {
  DashboardIcon,
  ProjectsIcon,
  BoardsIcon,
  ClientsIcon,
  LeadsIcon,
  SettingsIcon,
  CommunicationIcon,
} from "@/components/app-shell/nav-icons";

/**
 * The studio's destinations, in one place.
 *
 * The sidebar and the phone nav used to carry their own copies, and they had
 * drifted: the phone's list was missing /dashboard, so on a phone the
 * dashboard was not reachable at all (the brand mark goes to /projects). One
 * array means a destination added here appears in both, which is the only way
 * that stays true.
 */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/projects", label: "Projects", Icon: ProjectsIcon },
  { href: "/boards", label: "Boards", Icon: BoardsIcon },
  { href: "/communication", label: "Communication", Icon: CommunicationIcon },
  { href: "/clients", label: "Clients", Icon: ClientsIcon },
  { href: "/pipeline", label: "Pipeline", Icon: LeadsIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

/** A project collaborator only ever sees their project(s). */
export function navFor(collaborator: boolean): readonly NavItem[] {
  return collaborator
    ? NAV_ITEMS.filter((n) => n.href === "/projects")
    : NAV_ITEMS;
}

/** A nav row is active on its own page and on anything beneath it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
