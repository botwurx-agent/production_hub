import Link from "next/link";
import { StatusMenu } from "@/components/projects/status-menu";
import { ColorMenu } from "@/components/projects/color-menu";
import { shortDate } from "@/lib/format";
import type { ProjectRow } from "@/components/projects/types";

export function ProjectCard({ project }: { project: ProjectRow }) {
  const date = project.shoot_date ?? project.due_date;
  const dateLabel = project.shoot_date
    ? `Shoot ${shortDate(project.shoot_date)}`
    : project.due_date
      ? `Due ${shortDate(project.due_date)}`
      : null;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group relative block overflow-hidden rounded-[15px] border border-border bg-surface p-4 pl-5 shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
    >
      {/* Identity color spine (wayfinding; status stays the signal) */}
      {project.color && (
        <span
          className="absolute left-0 top-0 h-full w-1.5"
          style={{ backgroundColor: `var(--h-${project.color})` }}
        />
      )}
      <div className="mb-3 flex items-center justify-between gap-2">
        <StatusMenu projectId={project.id} status={project.status} />
        <div className="flex items-center gap-2">
          {dateLabel && date && (
            <span className="text-xs text-text-faint">{dateLabel}</span>
          )}
          <ColorMenu projectId={project.id} color={project.color} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {project.color && (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: `var(--h-${project.color})` }}
          />
        )}
        <h3 className="font-display text-[15px] font-bold leading-snug text-text group-hover:text-accent">
          {project.title}
        </h3>
      </div>
      <p className="mt-1 text-sm text-text-muted">
        {project.client?.name ?? "No client"}
      </p>
    </Link>
  );
}
