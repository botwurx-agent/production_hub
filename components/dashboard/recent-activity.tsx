import Link from "next/link";
import { shortDate } from "@/lib/format";
import type { ActivityFeedItem } from "@/components/dashboard/types";

// Studio-wide "what just happened" feed across all projects.
export function RecentActivity({ items }: { items: ActivityFeedItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-faint">No activity yet.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.id} className="flex items-start justify-between gap-3">
          <span className="min-w-0 text-sm text-text">
            <span className="text-text-muted">{it.content}</span>{" "}
            <Link
              href={`/projects/${it.projectId}`}
              className="font-semibold hover:text-accent"
            >
              {it.projectTitle}
            </Link>
          </span>
          <span className="shrink-0 text-xs text-text-faint">
            {shortDate(it.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
