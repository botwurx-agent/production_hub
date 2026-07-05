"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status-tag";
import {
  addDeliverable,
  updateDeliverable,
  deleteDeliverable,
  saveBilling,
} from "@/app/(app)/projects/[id]/production/ops-actions";
import type { Deliverable, ProjectBilling } from "@/lib/database.types";

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";
const cell =
  "w-full rounded-[8px] border border-transparent bg-transparent px-2 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

const DSTATUS: Record<string, { label: string; hue: "yellow" | "blue" | "green" }> = {
  pending: { label: "Pending", hue: "yellow" },
  in_progress: { label: "In progress", hue: "blue" },
  delivered: { label: "Delivered", hue: "green" },
};
const BSTATUS: Record<string, { label: string; hue: "yellow" | "blue" | "green" }> = {
  not_invoiced: { label: "Not invoiced", hue: "yellow" },
  invoiced: { label: "Invoiced", hue: "blue" },
  paid: { label: "Paid", hue: "green" },
};

export function DeliveryPanel({
  projectId,
  deliverables,
  billing,
}: {
  projectId: string;
  deliverables: Deliverable[];
  billing: ProjectBilling | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Deliverable[]>(deliverables);
  const sig = deliverables.map((d) => d.id).join(",");
  useEffect(() => {
    setRows(deliverables);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [busy, start] = useTransition();

  const [bill, setBill] = useState({
    status: billing?.status ?? "not_invoiced",
    amount: billing?.amount != null ? String(billing.amount) : "",
    invoice_no: billing?.invoice_no ?? "",
    notes: billing?.notes ?? "",
  });

  function edit(id: string, patch: Partial<Deliverable>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function add() {
    start(async () => {
      await addDeliverable(projectId);
      router.refresh();
    });
  }
  function del(id: string) {
    setRows((p) => p.filter((r) => r.id !== id));
    start(async () => {
      await deleteDeliverable(projectId, id);
      router.refresh();
    });
  }

  const delivered = rows.filter((r) => r.status === "delivered").length;

  return (
    <div className="space-y-8">
      {/* Deliverables */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-text-muted">
            {rows.length} deliverable{rows.length === 1 ? "" : "s"}
            {rows.length > 0 && (
              <span className="text-text-faint"> · {delivered} delivered</span>
            )}
          </p>
          <Button size="sm" onClick={add} disabled={busy}>
            + Deliverable
          </Button>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-border py-10 text-center text-sm text-text-faint">
            No deliverables yet. List what ships to the client.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-[12px] border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    value={r.name}
                    onChange={(e) => edit(r.id, { name: e.target.value })}
                    onBlur={() => updateDeliverable(projectId, r.id, { name: r.name })}
                    placeholder="Deliverable (e.g. OLV :30)"
                    className={`${cell} flex-1 font-semibold`}
                  />
                  <select
                    value={r.status}
                    onChange={(e) => {
                      edit(r.id, { status: e.target.value });
                      updateDeliverable(projectId, r.id, { status: e.target.value });
                    }}
                    className="rounded-[8px] border border-border bg-surface px-2 py-1 text-xs font-semibold"
                  >
                    {Object.entries(DSTATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => del(r.id)}
                    className="grid h-7 w-7 place-items-center rounded-[7px] text-text-faint transition hover:bg-red-bg hover:text-red"
                    aria-label="Delete deliverable"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mt-1 grid grid-cols-1 gap-2 pl-1 sm:grid-cols-3">
                  <input
                    value={r.spec ?? ""}
                    onChange={(e) => edit(r.id, { spec: e.target.value })}
                    onBlur={() => updateDeliverable(projectId, r.id, { spec: r.spec ?? "" })}
                    placeholder="Spec (1920x1080, :30)"
                    className={cell}
                  />
                  <input
                    type="date"
                    value={r.due_date ?? ""}
                    onChange={(e) => edit(r.id, { due_date: e.target.value })}
                    onBlur={() =>
                      updateDeliverable(projectId, r.id, { due_date: r.due_date || null })
                    }
                    className={cell}
                  />
                  <input
                    value={r.link ?? ""}
                    onChange={(e) => edit(r.id, { link: e.target.value })}
                    onBlur={() => updateDeliverable(projectId, r.id, { link: r.link ?? "" })}
                    placeholder="Delivery link"
                    className={cell}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Billing */}
      <div className="rounded-[14px] border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">Billing</h3>
          <StatusTag hue={BSTATUS[bill.status]?.hue ?? "yellow"}>
            {BSTATUS[bill.status]?.label ?? "Not invoiced"}
          </StatusTag>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
              Status
            </label>
            <select
              value={bill.status}
              onChange={(e) => {
                setBill((b) => ({ ...b, status: e.target.value }));
                saveBilling(projectId, { status: e.target.value });
              }}
              className={`mt-1 ${field}`}
            >
              {Object.entries(BSTATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
              Amount
            </label>
            <input
              type="number"
              value={bill.amount}
              onChange={(e) => setBill((b) => ({ ...b, amount: e.target.value }))}
              onBlur={() =>
                saveBilling(projectId, {
                  amount: bill.amount ? Number(bill.amount) : null,
                })
              }
              placeholder="0"
              className={`mt-1 ${field}`}
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
              Invoice #
            </label>
            <input
              value={bill.invoice_no}
              onChange={(e) => setBill((b) => ({ ...b, invoice_no: e.target.value }))}
              onBlur={() => saveBilling(projectId, { invoice_no: bill.invoice_no || null })}
              className={`mt-1 ${field}`}
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
            Notes
          </label>
          <input
            value={bill.notes}
            onChange={(e) => setBill((b) => ({ ...b, notes: e.target.value }))}
            onBlur={() => saveBilling(projectId, { notes: bill.notes || null })}
            placeholder="Payment terms, PO, etc."
            className={`mt-1 ${field}`}
          />
        </div>
      </div>
    </div>
  );
}
