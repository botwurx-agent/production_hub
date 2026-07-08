"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusTag, type Hue } from "@/components/status-tag";
import {
  addDeliverable,
  updateDeliverable,
  deleteDeliverable,
  saveBilling,
} from "@/app/(app)/projects/[id]/production/ops-actions";
import {
  createInvoiceForProject,
  sendInvoiceForProject,
  syncInvoiceForProject,
} from "@/app/(app)/projects/[id]/billing-actions";
import type {
  Deliverable,
  ProjectBilling,
  ProjectInvoice,
} from "@/lib/database.types";

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

// FreshBooks invoice status -> chip.
const ISTATUS: Record<string, { label: string; hue: Hue }> = {
  draft: { label: "Draft", hue: "yellow" },
  sent: { label: "Sent", hue: "blue" },
  viewed: { label: "Viewed", hue: "cyan" },
  partial: { label: "Partly paid", hue: "purple" },
  paid: { label: "Paid", hue: "green" },
  overdue: { label: "Overdue", hue: "red" },
  disputed: { label: "Disputed", hue: "red" },
};

function money(n: number | null | undefined, currency = "USD") {
  if (n == null) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function DeliveryPanel({
  projectId,
  deliverables,
  billing,
  invoices,
  freshbooksConnected,
}: {
  projectId: string;
  deliverables: Deliverable[];
  billing: ProjectBilling | null;
  invoices: ProjectInvoice[];
  freshbooksConnected: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Deliverable[]>(deliverables);
  const sig = deliverables.map((d) => d.id).join(",");
  useEffect(() => {
    setRows(deliverables);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [busy, start] = useTransition();

  // Invoicing action state.
  const [invBusy, startInv] = useTransition();
  const [invError, setInvError] = useState<string | null>(null);

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
  const invoiceTotal = rows.reduce(
    (sum, r) => sum + (r.rate != null && r.rate > 0 ? r.rate * (r.qty ?? 1) : 0),
    0,
  );
  const pricedCount = rows.filter((r) => r.rate != null && r.rate > 0).length;

  function runInvoiceAction(fn: () => Promise<{ error?: string } | null | undefined>) {
    setInvError(null);
    startInv(async () => {
      const res = await fn();
      if (res?.error) setInvError(res.error);
      router.refresh();
    });
  }

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
            No deliverables yet. List what ships to the client, with a rate to
            bill it.
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
                <div className="mt-1 grid grid-cols-2 gap-2 pl-1 sm:grid-cols-4">
                  <label className="flex items-center gap-1 rounded-[8px] border border-transparent px-1 focus-within:border-border-strong">
                    <span className="text-xs font-semibold text-text-faint">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={r.rate ?? ""}
                      onChange={(e) =>
                        edit(r.id, {
                          rate: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      onBlur={() => updateDeliverable(projectId, r.id, { rate: r.rate })}
                      placeholder="Rate"
                      className="w-full bg-transparent py-1 text-sm text-text outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-1 rounded-[8px] border border-transparent px-1 focus-within:border-border-strong">
                    <span className="text-xs font-semibold text-text-faint">×</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={r.qty ?? 1}
                      onChange={(e) => edit(r.id, { qty: Number(e.target.value) || 1 })}
                      onBlur={() => updateDeliverable(projectId, r.id, { qty: r.qty ?? 1 })}
                      placeholder="Qty"
                      className="w-full bg-transparent py-1 text-sm text-text outline-none"
                    />
                  </label>
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
                </div>
              </div>
            ))}
          </div>
        )}
        {pricedCount > 0 && (
          <p className="mt-2 text-right text-xs font-semibold text-text-muted">
            Invoice total: {money(invoiceTotal)}{" "}
            <span className="text-text-faint">
              ({pricedCount} priced line{pricedCount === 1 ? "" : "s"})
            </span>
          </p>
        )}
      </div>

      {/* Invoicing (FreshBooks) */}
      <div className="rounded-[14px] border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">Invoicing</h3>
          <span className="text-xs font-semibold text-text-faint">FreshBooks</span>
        </div>

        {!freshbooksConnected ? (
          <p className="rounded-[10px] bg-yellow-bg px-3 py-2 text-sm font-medium text-yellow">
            Connect FreshBooks in{" "}
            <a href="/settings" className="underline">
              Settings
            </a>{" "}
            to create and send invoices from this project.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() =>
                  runInvoiceAction(() => createInvoiceForProject(projectId))
                }
                disabled={invBusy || pricedCount === 0}
              >
                {invBusy ? "Working..." : "Create invoice"}
                {pricedCount > 0 ? ` · ${money(invoiceTotal)}` : ""}
              </Button>
              {pricedCount === 0 && (
                <span className="text-xs text-text-faint">
                  Set a rate on a deliverable first.
                </span>
              )}
            </div>

            {invError && (
              <p className="mt-2 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
                {invError}
              </p>
            )}

            {invoices.length > 0 && (
              <div className="mt-4 space-y-2">
                {invoices.map((inv) => {
                  const s = ISTATUS[inv.status] ?? { label: inv.status, hue: "blue" as Hue };
                  const isDraft = inv.status === "draft";
                  return (
                    <div
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-text">
                          {inv.number ? `Invoice #${inv.number}` : "Draft invoice"}
                          <span className="ml-2 font-normal text-text-muted">
                            {money(inv.amount, inv.currency)}
                          </span>
                          {inv.amount_paid > 0 && (
                            <span className="ml-2 text-xs font-semibold text-green">
                              {money(inv.amount_paid, inv.currency)} paid
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusTag hue={s.hue}>{s.label}</StatusTag>
                        {isDraft && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={invBusy}
                            onClick={() =>
                              runInvoiceAction(() =>
                                sendInvoiceForProject(projectId, inv.id),
                              )
                            }
                          >
                            Send
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={invBusy}
                          onClick={() =>
                            runInvoiceAction(() =>
                              syncInvoiceForProject(projectId, inv.id),
                            )
                          }
                        >
                          Refresh
                        </Button>
                        {inv.hosted_url && (
                          <a
                            href={inv.hosted_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-[9px] border border-border-strong px-2.5 py-1 text-xs font-semibold text-text hover:border-accent hover:text-accent"
                          >
                            View / Pay
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Billing (manual status, kept in sync when invoicing) */}
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
