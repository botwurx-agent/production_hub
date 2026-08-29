"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import {
  addGearItem,
  updateGearItem,
  deleteGearItem,
  renameGearCategory,
} from "@/app/(app)/projects/[id]/production/ops-actions";
import type { GearItem } from "@/lib/database.types";

/**
 * The day rate is not a column on `gear_items` (that table is readable by
 * project collaborators). It lives in the studio-only `gear_rates` table
 * (migration 0075) and is merged in by the page, so it arrives null for
 * anyone without a membership.
 */
export type GearRow = GearItem & { rate: number | null };

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * These editable tables carry fixed columns for the numbers and `1fr` for the
 * text. Below about 600px the fixed ones eat the row and the `1fr` tracks
 * collapse to nothing, so the phone showed quantities and prices with no item
 * name and no notes: not a squeeze, a silent loss of the only columns that say
 * what the row IS. They scroll inside their own box instead, the same answer
 * the elements usage map and the binder already use. `min-w` is the width the
 * text columns stop being readable at, not the width the row happens to be.
 */
const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

export function GearList({
  projectId,
  items,
  canSeeRates = true,
}: {
  projectId: string;
  items: GearRow[];
  /**
   * UI only: hides the rate column. The protection is RLS on `gear_rates`,
   * so removing this prop leaks nothing.
   */
  canSeeRates?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<GearRow[]>(items);
  const sig = items.map((i) => i.id).join(",");
  useEffect(() => {
    setRows(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [busy, start] = useTransition();

  function edit(id: string, patch: Partial<GearRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function toggle(r: GearRow) {
    edit(r.id, { confirmed: !r.confirmed });
    void updateGearItem(projectId, r.id, { confirmed: !r.confirmed });
  }
  function addLine(category: string) {
    start(async () => {
      await addGearItem(projectId, category);
      router.refresh();
    });
  }
  function del(id: string) {
    setRows((p) => p.filter((r) => r.id !== id));
    start(async () => {
      await deleteGearItem(projectId, id);
      router.refresh();
    });
  }

  const groups = useMemo(() => {
    const m = new Map<string, GearRow[]>();
    for (const r of rows) {
      const key = r.category || "Other";
      const list = m.get(key) ?? [];
      list.push(r);
      m.set(key, list);
    }
    return [...m.entries()];
  }, [rows]);

  const confirmed = rows.filter((r) => r.confirmed).length;
  // What this list costs for ONE shoot day. Multiplying by a day count is the
  // budget page's job; this page does not know how many days the job runs.
  const dayTotal = rows.reduce(
    (n, r) => n + (r.rate ? (r.qty || 1) * r.rate : 0),
    0
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-[12px] border border-dashed border-border px-6 py-12 text-center">
        <IconTile hue="amber" size="lg">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </IconTile>
        <p className="mt-4 text-sm font-bold text-text">No gear or crew yet</p>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Build the checklist for the shoot: cameras, lenses, grip, crew roles.
          Tick each line as it gets confirmed.
        </p>
        <Button
          size="sm"
          className="mt-4"
          style={{ backgroundColor: "var(--h-amber)" }}
          onClick={() => addLine("New category")}
          disabled={busy}
        >
          Add a category
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text">
            {confirmed}/{rows.length} confirmed
            {canSeeRates && dayTotal > 0 && (
              <span className="ml-2 font-semibold text-text">
                · {money.format(dayTotal)}/day
              </span>
            )}
          </p>
          <div className="mt-1.5 h-1.5 max-w-[16rem] overflow-hidden rounded-pill bg-surface-2">
            <div
              className="h-full rounded-pill transition-all"
              style={{
                width: `${rows.length ? Math.round((confirmed / rows.length) * 100) : 0}%`,
                background: "linear-gradient(90deg, var(--h-amber), var(--h-green))",
              }}
            />
          </div>
        </div>
        <Button
          size="sm"
          style={{ backgroundColor: "var(--h-amber)" }}
          onClick={() => addLine("New category")}
          disabled={busy}
        >
          + Category
        </Button>
      </div>

      <div className="space-y-4">
        {groups.map(([category, gItems]) => {
          const done = gItems.filter((i) => i.confirmed).length;
          const allDone = done === gItems.length && gItems.length > 0;
          return (
            <div
              key={category}
              className="overflow-hidden rounded-[12px] border border-border"
              style={{ borderTop: "3px solid var(--h-amber)" }}
            >
              <div
                className="flex items-center justify-between border-b border-border px-3 py-2"
                style={{ backgroundColor: "var(--h-amber-bg)" }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--h-amber)" }}
                  />
                  <input
                    defaultValue={category}
                    onBlur={(e) => {
                      const to = e.target.value.trim();
                      if (to && to !== category)
                        start(async () => {
                          await renameGearCategory(projectId, category, to);
                          router.refresh();
                        });
                    }}
                    className="min-w-0 rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-sm font-bold text-text outline-none hover:border-border focus:border-border-strong focus:bg-surface"
                  />
                </div>
                <span
                  className="shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold"
                  style={
                    allDone
                      ? { backgroundColor: "var(--h-green-bg)", color: "var(--h-green)" }
                      : { backgroundColor: "var(--surface)", color: "var(--h-amber)" }
                  }
                >
                  {done}/{gItems.length}
                </span>
              </div>
              {/* Wide row: see the note at the top of this file. */}
              <div className="overflow-x-auto">
              <div className="min-w-[600px] md:min-w-0">
              {gItems.map((r) => (
                <div
                  key={r.id}
                  className={`grid ${
                    canSeeRates
                      ? "grid-cols-[auto_3rem_1fr_1fr_6rem_5rem_auto]"
                      : "grid-cols-[auto_3rem_1fr_1fr_auto]"
                  } items-center gap-2 border-b border-border px-2 py-1 last:border-0 ${
                    r.confirmed ? "bg-green-bg/30" : ""
                  }`}
                >
                  <button
                    onClick={() => toggle(r)}
                    className={`grid h-5 w-5 place-items-center rounded-[6px] border transition ${
                      r.confirmed
                        ? "border-green bg-green text-white"
                        : "border-border-strong hover:border-green"
                    }`}
                    aria-label="Toggle confirmed"
                  >
                    {r.confirmed && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                  <input
                    type="number"
                    value={r.qty || ""}
                    onChange={(e) => edit(r.id, { qty: Number(e.target.value) || 1 })}
                    onBlur={() => updateGearItem(projectId, r.id, { qty: r.qty || 1 })}
                    className={`${cell} text-center`}
                  />
                  <input
                    value={r.name}
                    onChange={(e) => edit(r.id, { name: e.target.value })}
                    onBlur={() => updateGearItem(projectId, r.id, { name: r.name })}
                    placeholder="Item / role"
                    className={`${cell} ${r.confirmed ? "text-text-muted line-through" : ""}`}
                  />
                  <input
                    value={r.notes ?? ""}
                    onChange={(e) => edit(r.id, { notes: e.target.value })}
                    onBlur={() => updateGearItem(projectId, r.id, { notes: r.notes ?? "" })}
                    placeholder="Notes"
                    className={cell}
                  />
                  {canSeeRates && (
                    <>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={r.rate ?? ""}
                        onChange={(e) =>
                          edit(r.id, {
                            rate: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        onBlur={() => updateGearItem(projectId, r.id, { rate: r.rate })}
                        placeholder="$/day"
                        className={`${cell} text-right tabular-nums`}
                      />
                      {/* Per day, not per job: this page has no day count, and
                          inventing one would misstate the number. */}
                      <span className="px-1 text-right text-xs font-semibold tabular-nums text-text-muted">
                        {r.rate ? money.format((r.qty || 1) * r.rate) : ""}
                      </span>
                    </>
                  )}
                  <button
                    onClick={() => del(r.id)}
                    className="grid h-7 w-7 place-items-center rounded-[7px] text-text-faint transition hover:bg-red-bg hover:text-red"
                    aria-label="Delete"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              </div>
              </div>
              <button
                onClick={() => addLine(category)}
                disabled={busy}
                className="w-full px-3 py-1.5 text-left text-xs font-semibold transition hover:bg-surface-2"
                style={{ color: "var(--h-amber)" }}
              >
                + Item
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
