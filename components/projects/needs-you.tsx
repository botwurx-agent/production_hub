import Link from "next/link";
import { StatusTag } from "@/components/status-tag";
import type { OutstandingItem } from "@/lib/outstanding";

const copy: Record<
  OutstandingItem["kind"],
  { label: string; hue: "red" | "yellow"; verb: string }
> = {
  changes_requested: {
    label: "Revisions",
    hue: "red",
    verb: "Changes requested on",
  },
  awaiting_review: {
    label: "Awaiting",
    hue: "yellow",
    verb: "Awaiting sign-off on",
  },
};

export function NeedsYou({ items }: { items: OutstandingItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-6 rounded-[16px] border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ backgroundColor: "var(--h-red)" }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--h-red)" }}
          />
        </span>
        <h2 className="text-sm font-bold text-text">Needs you</h2>
        <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs font-semibold text-text-muted">
          {items.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 6).map((item) => {
          const c = copy[item.kind];
          return (
            <li key={`${item.assetId}-${item.kind}`}>
              <Link
                href={`/projects/${item.projectId}`}
                className="flex items-center justify-between gap-3 rounded-[10px] px-2 py-1.5 transition hover:bg-surface-2/70"
              >
                <span className="min-w-0 text-sm text-text">
                  <span className="text-text-muted">{c.verb} </span>
                  <span className="font-semibold">{item.assetName}</span>
                  <span className="text-text-faint"> v{item.versionNumber}</span>
                  <span className="text-text-faint">
                    {" "}
                    · {item.projectTitle}
                  </span>
                </span>
                <StatusTag hue={c.hue} dot={false}>
                  {c.label}
                </StatusTag>
              </Link>
            </li>
          );
        })}
      </ul>
      {items.length > 6 && (
        <p className="mt-2 px-2 text-xs text-text-faint">
          and {items.length - 6} more
        </p>
      )}
    </div>
  );
}
