import Link from "next/link";
import { DEAL_STAGE, DEAL_STAGE_ORDER } from "@/lib/status";
import { money } from "@/lib/format";

// Mini funnel: deal counts per stage, plus the open pipeline value.
export function PipelineSnapshot({
  counts,
  openValue,
}: {
  counts: Record<string, number>;
  openValue: number;
}) {
  const max = Math.max(1, ...DEAL_STAGE_ORDER.map((s) => counts[s] ?? 0));
  const total = DEAL_STAGE_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-faint">
        No deals yet.{" "}
        <Link
          href="/pipeline"
          className="font-semibold text-accent hover:underline"
        >
          Add one
        </Link>
        .
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {DEAL_STAGE_ORDER.map((s) => {
          const n = counts[s] ?? 0;
          const meta = DEAL_STAGE[s];
          return (
            <li key={s} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs font-semibold text-text-muted">
                {meta.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-2">
                <div
                  className="h-full rounded-pill"
                  style={{
                    width: `${(n / max) * 100}%`,
                    backgroundColor: `var(--h-${meta.hue})`,
                  }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs font-semibold text-text">
                {n}
              </span>
            </li>
          );
        })}
      </ul>
      {openValue > 0 && (
        <Link
          href="/pipeline"
          className="mt-3 flex items-center justify-between rounded-[10px] px-2 py-1.5 text-sm transition hover:bg-surface-2/70"
        >
          <span className="text-text-muted">Open pipeline</span>
          <span
            className="rounded-pill px-2 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: "var(--h-green-bg)",
              color: "var(--h-green)",
            }}
          >
            {money(openValue)}
          </span>
        </Link>
      )}
    </div>
  );
}
