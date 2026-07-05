"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  addBudgetLine,
  updateBudgetLine,
  deleteBudgetLine,
  renameBudgetCategory,
} from "@/app/(app)/projects/[id]/production/budget-actions";
import type { BudgetLine } from "@/lib/database.types";

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
}: {
  projectId: string;
  lines: BudgetLine[];
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

  const totalEst = rows.reduce((n, r) => n + (r.estimated || 0), 0);
  const totalAct = rows.reduce((n, r) => n + (r.actual || 0), 0);
  const variance = totalAct - totalEst;

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
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Tile label="Estimated" value={money.format(totalEst)} hue="indigo" />
        <Tile label="Actual" value={money.format(totalAct)} hue="blue" />
        <Tile
          label={variance > 0 ? "Over budget" : "Under budget"}
          value={`${variance > 0 ? "+" : ""}${money.format(variance)}`}
          hue={variance > 0 ? "red" : "green"}
        />
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
            const act = gLines.reduce((n, r) => n + (r.actual || 0), 0);
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
                    <input
                      type="number"
                      value={r.actual || ""}
                      onChange={(e) => edit(r.id, { actual: Number(e.target.value) || 0 })}
                      onBlur={() => updateBudgetLine(projectId, r.id, { actual: r.actual || 0 })}
                      placeholder="0"
                      className={num}
                    />
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
