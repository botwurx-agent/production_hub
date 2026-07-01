import { ProjectCard } from "@/components/projects/project-card";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/lib/status";
import type { ProjectRow } from "@/components/projects/types";

export function ProjectBoard({ projects }: { projects: ProjectRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {PROJECT_STATUS_ORDER.map((status) => {
        const meta = PROJECT_STATUS[status];
        const items = projects.filter((p) => p.status === status);
        return (
          <div key={status} className="flex flex-col">
            <div className="mb-3 flex items-center gap-2 px-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: `var(--h-${meta.hue})` }}
                aria-hidden="true"
              />
              <span className="text-sm font-bold text-text">{meta.label}</span>
              <span className="ml-auto rounded-pill bg-surface-2 px-2 py-0.5 text-xs font-semibold text-text-muted">
                {items.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-3 rounded-[16px] bg-surface-2/50 p-2.5">
              {items.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-text-faint">
                  Nothing here yet
                </p>
              ) : (
                items.map((p) => <ProjectCard key={p.id} project={p} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
