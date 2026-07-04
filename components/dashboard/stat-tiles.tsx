import type { Hue } from "@/components/status-tag";

export type Stat = { label: string; value: number; hue: Hue };

// Monday-style KPI row: quick numbers across the top of the dashboard.
export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-[16px] border border-border bg-surface p-4 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: `var(--h-${s.hue})` }}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-text-faint">
              {s.label}
            </span>
          </div>
          <div className="mt-2 font-display text-3xl font-extrabold text-text">
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
