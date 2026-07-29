"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  addBudgetLine,
  updateBudgetLine,
  deleteBudgetLine,
  renameBudgetCategory,
} from "@/app/(app)/projects/[id]/production/budget-actions";
import { CostLedger, type RosterOption } from "@/components/production/cost-ledger";
import {
  lineActual as lineActualOf,
  marginOf,
  rollUpActual,
  summarizePayments,
} from "@/lib/costs";
import type { BudgetLine, CostPayment, ProjectCost } from "@/lib/database.types";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";
const num =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-right text-sm tabular-nums text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

export function BudgetTable({
  projectId,
  lines,
  costs,
  roster,
  billed,
  billedFromInvoices,
  payments,
  todayIso,
}: {
  projectId: string;
  lines: BudgetLine[];
  costs: ProjectCost[];
  roster: RosterOption[];
  /** What the client has been charged, for the margin band. */
  billed: number;
  /** True when that came from real invoices rather than the manual field. */
  billedFromInvoices: boolean;
  payments: CostPayment[];
  todayIso: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<BudgetLine[]>(lines);
  const sig = lines.map((l) => l.id).join(",");
  useEffect(() => {
    setRows(lines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [busy, start] = useTransition();

  function edit(id: string, patch: Partial<BudgetLine>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const groups = useMemo(() => {
    const m = new Map<string, BudgetLine[]>();
    for (const r of rows) {
      const key = r.category || "General";
      const list = m.get(key) ?? [];
      list.push(r);
      m.set(key, list);
    }
    return [...m.entries()];
  }, [rows]);

  // Actual is a ledger now, not a typed number. A line with invoices against
  // it reports their sum and its own cell goes read-only; a line with none
  // keeps the typed value, so the quick-estimate workflow still works and no
  // existing number is stranded.
  const costsByLine = useMemo(() => {
    const m = new Map<string, ProjectCost[]>();
    for (const c of costs) {
      if (!c.budget_line_id) continue;
      const list = m.get(c.budget_line_id) ?? [];
      list.push(c);
      m.set(c.budget_line_id, list);
    }
    return m;
  }, [costs]);

  const lineActual = useCallback(
    (r: BudgetLine) => lineActualOf(r, costs),
    [costs]
  );

  const totalEst = rows.reduce((n, r) => n + (r.estimated || 0), 0);
  const totalAct = rollUpActual(rows, costs);
  const variance = totalAct - totalEst;
  // Still owed is the remainder after any payments already sent, not the whole
  // commitment: a part-paid deposit arrangement is not fully outstanding.
  const unpaid = costs.reduce(
    (n, c) =>
      n +
      summarizePayments(
        c.amount,
        payments.filter((p) => p.cost_id === c.id),
        c.status
      ).owed,
    0
  );
  // What the job made, as opposed to whether it stayed on budget. Those are
  // different questions, so this sits apart from the four tiles above.
  const margin = marginOf(billed, totalAct);

  function addLine(category: string) {
    start(async () => {
      await addBudgetLine(projectId, category);
      router.refresh();
    });
  }
  function addCategory() {
    start(async () => {
      await addBudgetLine(projectId, "New category");
      router.refresh();
    });
  }
  function del(id: string) {
    setRows((p) => p.filter((r) => r.id !== id));
    start(async () => {
      await deleteBudgetLine(projectId, id);
      router.refresh();
    });
  }

  return (
    <div>
      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Estimated" value={money.format(totalEst)} hue="indigo" />
        <Tile label="Actual" value={money.format(totalAct)} hue="blue" />
        <Tile
          label={variance > 0 ? "Over budget" : "Under budget"}
          value={`${variance > 0 ? "+" : ""}${money.format(variance)}`}
          hue={variance > 0 ? "red" : "green"}
        />
        <Tile label="Still owed" value={money.format(unpaid)} hue="amber" />
      </div>

      <div className="mb-5 rounded-[12px] border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-text">Margin</h3>
          <span className="text-[11px] text-text-faint">
            {billedFromInvoices
              ? "Billed from this project's invoices."
              : margin.billed > 0
                ? "Billed from the amount on the delivery page."
                : "Nothing billed to the client yet."}
          </span>
        </div>
        {margin.billed > 0 ? (
          <>
            <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-2">
              <Figure label="Billed" value={money.format(margin.billed)} />
              <Figure label="Job cost" value={money.format(margin.cost)} />
              <Figure
                label={margin.profit < 0 ? "Loss" : "Margin"}
                value={`${money.format(margin.profit)}${margin.pct === null ? "" : ` (${margin.pct}%)`}`}
                hue={margin.profit < 0 ? "red" : "green"}
              />
            </div>
            {/* Cost as a share of what was billed: the bar fills toward the
                point where the job stops making money. */}
            <div className="mt-3 h-2 overflow-hidden rounded-pill bg-surface-2">
              <div
                className="h-full rounded-pill transition-all"
                style={{
                  width: `${Math.min(100, Math.round((margin.cost / margin.billed) * 100))}%`,
                  backgroundColor:
                    margin.profit < 0 ? "var(--h-red)" : "var(--h-green)",
                }}
              />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            Once you invoice the client, this shows what the job actually made
            against {money.format(totalAct)} of cost.
          </p>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-text-muted">Estimate vs actual, by category.</p>
        <Button size="sm" variant="secondary" onClick={addCategory} disabled={busy}>
          + Category
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border py-10 text-center text-sm text-text-faint">
          No budget lines yet. Add a category to start estimating.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map(([category, gLines]) => {
            const est = gLines.reduce((n, r) => n + (r.estimated || 0), 0);
            const act = gLines.reduce((n, r) => n + lineActual(r), 0);
            return (
              <div key={category} className="overflow-hidden rounded-[12px] border border-border">
                <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2/50 px-3 py-2">
                  <input
                    defaultValue={category}
                    onBlur={(e) => {
                      const to = e.target.value.trim();
                      if (to && to !== category)
                        start(async () => {
                          await renameBudgetCategory(projectId, category, to);
                          router.refresh();
                        });
                    }}
                    className="rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-sm font-bold text-text outline-none hover:border-border focus:border-border-strong focus:bg-surface"
                  />
                  <span className="text-xs font-semibold tabular-nums text-text-muted">
                    {money.format(est)} est · {money.format(act)} act
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_7rem_7rem_1fr_auto] gap-2 border-b border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
                  <span>Item</span>
                  <span className="text-right">Estimated</span>
                  <span className="text-right">Actual</span>
                  <span>Notes</span>
                  <span />
                </div>

                {gLines.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_7rem_7rem_1fr_auto] items-center gap-2 border-b border-border px-2 py-1 last:border-0"
                  >
                    <input
                      value={r.description}
                      onChange={(e) => edit(r.id, { description: e.target.value })}
                      onBlur={() => updateBudgetLine(projectId, r.id, { description: r.description })}
                      placeholder="Line item"
                      className={cell}
                    />
                    <input
                      type="number"
                      value={r.estimated || ""}
                      onChange={(e) => edit(r.id, { estimated: Number(e.target.value) || 0 })}
                      onBlur={() => updateBudgetLine(projectId, r.id, { estimated: r.estimated || 0 })}
                      placeholder="0"
                      className={num}
                    />
                    {costsByLine.get(r.id)?.length ? (
                      <div
                        title={`Sum of ${costsByLine.get(r.id)!.length} invoice(s) below. Edit the costs to change it.`}
                        className="flex items-center justify-end gap-1.5 px-2 py-1"
                      >
                        <span className="text-sm font-semibold tabular-nums text-text">
                          {money.format(lineActual(r))}
                        </span>
                        <span className="rounded-pill bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">
                          {costsByLine.get(r.id)!.length}
                        </span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={r.actual || ""}
                        onChange={(e) => edit(r.id, { actual: Number(e.target.value) || 0 })}
                        onBlur={() => updateBudgetLine(projectId, r.id, { actual: r.actual || 0 })}
                        placeholder="0"
                        className={num}
                      />
                    )}
                    <input
                      value={r.notes ?? ""}
                      onChange={(e) => edit(r.id, { notes: e.target.value })}
                      onBlur={() => updateBudgetLine(projectId, r.id, { notes: r.notes ?? "" })}
                      placeholder="Notes"
                      className={cell}
                    />
                    <button
                      onClick={() => del(r.id)}
                      className="grid h-7 w-7 place-items-center rounded-[7px] text-text-faint transition hover:bg-red-bg hover:text-red"
                      aria-label="Delete line"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => addLine(category)}
                  disabled={busy}
                  className="w-full px-3 py-1.5 text-left text-xs font-semibold text-accent transition hover:bg-surface-2"
                >
                  + Line
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <CostLedger
          projectId={projectId}
          costs={costs}
          lines={rows}
          roster={roster}
          payments={payments}
          todayIso={todayIso}
        />
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  hue,
}: {
  label: string;
  value: string;
  hue?: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
        {label}
      </div>
      <div
        className="text-lg font-extrabold tabular-nums"
        style={hue ? { color: `var(--h-${hue})` } : { color: "var(--text)" }}
      >
        {value}
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  hue,
}: {
  label: string;
  value: string;
  hue: string;
}) {
  return (
    <div className="rounded-[12px] border border-border p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
        {label}
      </div>
      <div className="mt-1 text-xl font-extrabold tabular-nums" style={{ color: `var(--h-${hue})` }}>
        {value}
      </div>
    </div>
  );
}
