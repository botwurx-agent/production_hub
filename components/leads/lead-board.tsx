import { LeadCard } from "@/components/leads/lead-card";
import { LEAD_STAGE, LEAD_STAGE_ORDER } from "@/lib/status";
import type { LeadRow } from "@/components/leads/types";

// Horizontal pipeline: one column per stage, new through won/lost.
export function LeadBoard({ leads }: { leads: LeadRow[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {LEAD_STAGE_ORDER.map((stage) => {
        const meta = LEAD_STAGE[stage];
        const items = leads.filter((l) => l.stage === stage);
        return (
          <div key={stage} className="flex w-64 shrink-0 flex-col">
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
                items.map((l) => <LeadCard key={l.id} lead={l} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
