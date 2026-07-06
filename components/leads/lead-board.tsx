import { LeadCard } from "@/components/leads/lead-card";
import { LEAD_STAGE, LEAD_STAGE_ORDER } from "@/lib/status";
import type { LeadRow } from "@/components/leads/types";

// Horizontal pipeline: one column per stage, new through won/lost.
export function LeadBoard({
  leads,
  followUps,
}: {
  leads: LeadRow[];
  followUps: Record<string, number>;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {LEAD_STAGE_ORDER.map((stage) => {
        const meta = LEAD_STAGE[stage];
        // Leads needing follow-up rise to the top of their column.
        const items = leads
          .filter((l) => l.stage === stage)
          .sort(
            (a, b) => (followUps[b.id] ?? -1) - (followUps[a.id] ?? -1)
          );
        return (
          <div key={stage} className="flex w-64 shrink-0 flex-col">
            <div
              className="mb-3 flex items-center gap-2 rounded-[11px] px-3 py-2"
              style={{ backgroundColor: `var(--h-${meta.hue}-bg)` }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: `var(--h-${meta.hue})` }}
                aria-hidden="true"
              />
              <span
                className="text-sm font-extrabold"
                style={{ color: `var(--h-${meta.hue})` }}
              >
                {meta.label}
              </span>
              <span
                className="ml-auto rounded-pill px-2 py-0.5 text-xs font-bold"
                style={{
                  backgroundColor: "var(--surface)",
                  color: `var(--h-${meta.hue})`,
                }}
              >
                {items.length}
              </span>
            </div>
            <div
              className="flex flex-1 flex-col gap-3 rounded-[16px] border-t-2 bg-surface-2/50 p-2.5"
              style={{ borderColor: `var(--h-${meta.hue})` }}
            >
              {items.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-text-faint">
                  Nothing here yet
                </p>
              ) : (
                items.map((l) => (
                  <LeadCard key={l.id} lead={l} followUpDays={followUps[l.id]} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
