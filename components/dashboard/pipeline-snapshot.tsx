import Link from "next/link";
import { LEAD_STAGE, LEAD_STAGE_ORDER } from "@/lib/status";

// Mini funnel: lead counts per stage, plus the follow-up nudge.
export function PipelineSnapshot({
  counts,
  followUps,
}: {
  counts: Record<string, number>;
  followUps: number;
}) {
  const max = Math.max(1, ...LEAD_STAGE_ORDER.map((s) => counts[s] ?? 0));
  const total = LEAD_STAGE_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-faint">
        No leads yet.{" "}
        <Link href="/leads" className="font-semibold text-accent hover:underline">
          Capture one
        </Link>
        .
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {LEAD_STAGE_ORDER.map((s) => {
          const n = counts[s] ?? 0;
          const meta = LEAD_STAGE[s];
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
      {followUps > 0 && (
        <Link
          href="/leads"
          className="mt-3 flex items-center justify-between rounded-[10px] px-2 py-1.5 text-sm transition hover:bg-surface-2/70"
        >
          <span className="text-text-muted">Leads to follow up</span>
          <span
            className="rounded-pill px-2 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: "var(--h-orange-bg)",
              color: "var(--h-orange)",
            }}
          >
            {followUps}
          </span>
        </Link>
      )}
    </div>
  );
}
