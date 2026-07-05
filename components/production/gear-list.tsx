"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  addGearItem,
  updateGearItem,
  deleteGearItem,
  renameGearCategory,
} from "@/app/(app)/projects/[id]/production/ops-actions";
import type { GearItem } from "@/lib/database.types";

const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

export function GearList({
  projectId,
  items,
}: {
  projectId: string;
  items: GearItem[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<GearItem[]>(items);
  const sig = items.map((i) => i.id).join(",");
  useEffect(() => {
    setRows(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [busy, start] = useTransition();

  function edit(id: string, patch: Partial<GearItem>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function toggle(r: GearItem) {
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
    const m = new Map<string, GearItem[]>();
    for (const r of rows) {
      const key = r.category || "Other";
      const list = m.get(key) ?? [];
      list.push(r);
      m.set(key, list);
    }
    return [...m.entries()];
  }, [rows]);

  const confirmed = rows.filter((r) => r.confirmed).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {rows.length} item{rows.length === 1 ? "" : "s"}
          {rows.length > 0 && (
            <span className="text-text-faint"> · {confirmed} confirmed</span>
          )}
        </p>
        <Button size="sm" variant="secondary" onClick={() => addLine("New category")} disabled={busy}>
          + Category
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border py-10 text-center text-sm text-text-faint">
          No gear or crew yet. Add a category to start your list.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(([category, gItems]) => (
            <div key={category} className="overflow-hidden rounded-[12px] border border-border">
              <div className="flex items-center justify-between border-b border-border bg-surface-2/50 px-3 py-2">
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
                  className="rounded-[6px] border border-transparent bg-transparent px-1 py-0.5 text-sm font-bold text-text outline-none hover:border-border focus:border-border-strong focus:bg-surface"
                />
                <span className="text-xs font-semibold text-text-muted">
                  {gItems.filter((i) => i.confirmed).length}/{gItems.length}
                </span>
              </div>
              {gItems.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[auto_3rem_1fr_1fr_auto] items-center gap-2 border-b border-border px-2 py-1 last:border-0"
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
                    className={`${cell} ${r.confirmed ? "text-text-muted" : ""}`}
                  />
                  <input
                    value={r.notes ?? ""}
                    onChange={(e) => edit(r.id, { notes: e.target.value })}
                    onBlur={() => updateGearItem(projectId, r.id, { notes: r.notes ?? "" })}
                    placeholder="Notes"
                    className={cell}
                  />
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
              <button
                onClick={() => addLine(category)}
                disabled={busy}
                className="w-full px-3 py-1.5 text-left text-xs font-semibold text-accent transition hover:bg-surface-2"
              >
                + Item
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
