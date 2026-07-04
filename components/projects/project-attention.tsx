import { StatusTag, type Hue } from "@/components/status-tag";
import type { OutstandingItem } from "@/lib/outstanding";

// Quiet "needs attention" surface for a single project: revision requests,
// pending sign-offs, and un-reviewed assets, with how long each has waited.
// Renders nothing when the project is clear.

const copy: Record<
  OutstandingItem["kind"],
  { label: string; hue: Hue; verb: string }
> = {
  changes_requested: { label: "Revisions", hue: "red", verb: "Changes requested on" },
  pending_signoff: { label: "Pending", hue: "yellow", verb: "Sign-off pending on" },
  awaiting_review: { label: "Awaiting", hue: "cyan", verb: "Awaiting sign-off on" },
};

function age(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function ProjectAttention({ items }: { items: OutstandingItem[] }) {
  if (items.length === 0) return null;
  const stalled = items.filter((i) => i.stalled).length;

  return (
    <div
      className="overflow-hidden rounded-[16px] border border-border bg-surface p-4 shadow-sm"
      style={stalled > 0 ? { borderLeft: "3px solid var(--h-orange)" } : undefined}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: stalled > 0 ? "var(--h-orange)" : "var(--h-yellow)",
          }}
        />
        <h2 className="text-sm font-bold text-text">Needs attention</h2>
        {stalled > 0 && (
          <span
            className="rounded-pill px-2 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: "var(--h-orange-bg)",
              color: "var(--h-orange)",
            }}
          >
            {stalled} stalled
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const c = copy[item.kind];
          return (
            <li
              key={`${item.assetId}-${item.kind}`}
              className="flex items-center justify-between gap-3"
            >
              <span className="min-w-0 text-sm text-text">
                <span className="text-text-muted">{c.verb} </span>
                <span className="font-semibold">{item.assetName}</span>
                <span className="text-text-faint"> v{item.versionNumber}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className="text-xs font-medium"
                  style={{
                    color: item.stalled ? "var(--h-orange)" : "var(--text-faint)",
                  }}
                >
                  {age(item.days)}
                </span>
                <StatusTag hue={c.hue} dot={false}>
                  {c.label}
                </StatusTag>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
