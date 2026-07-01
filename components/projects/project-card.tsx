import Link from "next/link";
import { StatusMenu } from "@/components/projects/status-menu";
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
      className="group block rounded-[15px] border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <StatusMenu projectId={project.id} status={project.status} />
        {dateLabel && date && (
          <span className="text-xs text-text-faint">{dateLabel}</span>
        )}
      </div>
      <h3 className="font-display text-[15px] font-bold leading-snug text-text group-hover:text-accent">
        {project.title}
      </h3>
      <p className="mt-1 text-sm text-text-muted">
        {project.client?.name ?? "No client"}
      </p>
    </Link>
  );
}
