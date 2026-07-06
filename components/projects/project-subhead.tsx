import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { IconTile } from "@/components/ui/icon-tile";

// Consistent header for a project's focused module pages (Brief, Assets,
// Communication, Shot list): a back link to the hub plus the section title,
// carrying the same colored identity tile + gradient accent as PageHeader so
// the module stays on the app's design language.
export function ProjectSubhead({
  projectId,
  projectTitle,
  section,
  hue,
  icon,
  subtitle,
  action,
}: {
  projectId: string;
  projectTitle: string;
  section: string;
  hue: string;
  icon?: ReactNode;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <Link
        href={`/projects/${projectId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
      >
        <ChevronLeftIcon /> {projectTitle}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {icon ? (
            <IconTile hue={hue} size="lg">
              {icon}
            </IconTile>
          ) : (
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: `var(--h-${hue})` }}
            />
          )}
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-text">
              {section}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      <div
        className="mt-4 h-[3px] w-full rounded-pill opacity-80"
        style={{
          background: `linear-gradient(90deg, var(--h-${hue}), transparent 55%)`,
        }}
      />
    </div>
  );
}
