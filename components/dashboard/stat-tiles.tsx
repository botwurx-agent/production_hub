import type { Hue } from "@/components/status-tag";

export type Stat = { label: string; value: number; hue: Hue };

// Bold KPI row across the top of the dashboard: a tinted hue chip, a big
// number, and a colored accent edge so each stat reads at a glance.
export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="relative overflow-hidden rounded-[16px] border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span
            className="absolute inset-y-0 left-0 w-1"
            style={{ backgroundColor: `var(--h-${s.hue})` }}
            aria-hidden="true"
          />
          <div className="flex items-center gap-2 pl-1.5">
            <span
              className="grid h-6 w-6 place-items-center rounded-[7px]"
              style={{
                backgroundColor: `var(--h-${s.hue}-bg)`,
                color: `var(--h-${s.hue})`,
              }}
              aria-hidden="true"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: "currentColor" }}
              />
            </span>
            <span className="text-xs font-semibold text-text-muted">
              {s.label}
            </span>
          </div>
          <div className="mt-2 pl-1.5 font-display text-3xl font-extrabold tabular-nums text-text">
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
