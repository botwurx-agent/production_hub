"use client";

import Link from "next/link";
import { costStatus, COST_STATUS } from "@/lib/costs";

export type UnpaidCost = {
  id: string;
  projectId: string;
  projectTitle: string;
  vendor: string;
  /** What is still owed, which is the remainder when a deposit has been sent. */
  amount: number;
  /** The next payment's date when there is a schedule, else the cost's own. */
  dueDate: string | null;
  status: string;
  partPaid: boolean;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** A date column is a plain YYYY-MM-DD, so compare and render it as UTC or a
 * timezone west of GMT reads yesterday. Same rule as lib/slate.ts. */
function dayValue(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fmtDue(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * What the studio owes across every active project. The per-project budget
 * page answers "did this job make money"; this answers "who is chasing me",
 * which is the question that actually wakes a producer up.
 */
export function UnpaidCosts({
  costs,
  todayIso,
}: {
  costs: UnpaidCost[];
  todayIso: string;
}) {
  if (costs.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-text-faint">
        Nothing outstanding. Every logged invoice is marked paid.
      </p>
    );
  }

  const today = dayValue(todayIso);
  const total = costs.reduce((n, c) => n + c.amount, 0);
  const overdue = costs.filter(
    (c) => c.dueDate !== null && dayValue(c.dueDate) < today
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <span className="text-lg font-extrabold tabular-nums text-text">
          {money.format(total)}
        </span>
        <span className="text-xs text-text-muted">
          across {costs.length} {costs.length === 1 ? "invoice" : "invoices"}
        </span>
        {overdue.length > 0 && (
          <span className="rounded-pill bg-red-bg px-1.5 py-0.5 text-[10px] font-bold text-red">
            {overdue.length} overdue
          </span>
        )}
      </div>

      <ul className="space-y-1">
        {costs.slice(0, 6).map((c) => {
          const isOverdue = c.dueDate !== null && dayValue(c.dueDate) < today;
          const s = COST_STATUS[costStatus(c.status)];
          return (
            <li key={c.id}>
              <Link
                href={`/projects/${c.projectId}/budget`}
                className="flex items-center gap-2 rounded-[8px] px-1.5 py-1 transition hover:bg-surface-2"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: `var(--h-${s.hue})` }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text">
                    {c.vendor || "Unnamed vendor"}
                  </span>
                  <span className="block truncate text-[11px] text-text-faint">
                    {c.projectTitle}
                    {c.partPaid && " · balance"}
                    {c.dueDate && (
                      <span className={isOverdue ? "font-semibold text-red" : ""}>
                        {" · "}
                        {isOverdue ? "overdue " : "due "}
                        {fmtDue(c.dueDate)}
                      </span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-text">
                  {money.format(c.amount)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {costs.length > 6 && (
        <p className="mt-1.5 px-1.5 text-[11px] text-text-faint">
          and {costs.length - 6} more.
        </p>
      )}
    </div>
  );
}
