import Link from "next/link";
import { StatusTag } from "@/components/status-tag";
import { PROJECT_STATUS } from "@/lib/status";
import { shortDate } from "@/lib/format";
import type { ProjectRow } from "@/components/projects/types";

export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-text-faint">
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Stage</th>
            <th className="hidden px-4 py-3 sm:table-cell">Shoot</th>
            <th className="hidden px-4 py-3 sm:table-cell">Due</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.id}
              className="border-b border-border last:border-0 transition hover:bg-surface-2/60"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/projects/${p.id}`}
                  className="font-semibold text-text hover:text-accent"
                >
                  {p.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-text-muted">
                {p.client?.name ?? "No client"}
              </td>
              <td className="px-4 py-3">
                <StatusTag hue={PROJECT_STATUS[p.status].hue}>
                  {PROJECT_STATUS[p.status].label}
                </StatusTag>
              </td>
              <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                {shortDate(p.shoot_date) || "—"}
              </td>
              <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                {shortDate(p.due_date) || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
