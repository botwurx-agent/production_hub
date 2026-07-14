import { DealCard } from "@/components/deals/deal-card";
import { DEAL_STAGE, DEAL_STAGE_ORDER } from "@/lib/status";
import { money } from "@/lib/format";
import type { DealRow } from "@/components/deals/types";

// Horizontal pipeline: one column per stage. Each column header carries a count
// and the summed value of its deals (color as signal, value as substance).
export function DealBoard({ deals }: { deals: DealRow[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {DEAL_STAGE_ORDER.map((stage) => {
        const meta = DEAL_STAGE[stage];
        const items = deals.filter((d) => d.stage === stage);
        const sum = items.reduce((t, d) => t + (d.value ?? 0), 0);
        return (
          <div key={stage} className="flex w-64 shrink-0 flex-col">
            <div
              className="mb-3 rounded-[11px] px-3 py-2"
              style={{ backgroundColor: `var(--h-${meta.hue}-bg)` }}
            >
              <div className="flex items-center gap-2">
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
              {sum > 0 && (
                <div
                  className="mt-1 text-xs font-semibold"
                  style={{ color: `var(--h-${meta.hue})` }}
                >
                  {money(sum)}
                </div>
              )}
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
                items.map((d) => <DealCard key={d.id} deal={d} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
