"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { StatusTag, type Hue } from "@/components/status-tag";
import {
  createBillingDocument,
  updateBillingDocument,
  deleteBillingDocument,
  setDocumentRecipient,
  addDocLine,
  updateDocLine,
  deleteDocLine,
} from "@/app/(app)/projects/[id]/native-invoice-actions";
import type {
  BillingDocument,
  BillingDocumentLine,
  BillingProfile,
} from "@/lib/database.types";

type DocWithLines = BillingDocument & { lines: BillingDocumentLine[] };
type ContactOption = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
};

const STATUS: Record<string, { label: string; hue: Hue }> = {
  draft: { label: "Draft", hue: "yellow" },
  sent: { label: "Sent", hue: "blue" },
  paid: { label: "Paid", hue: "green" },
  void: { label: "Void", hue: "red" },
  accepted: { label: "Accepted", hue: "green" },
  declined: { label: "Declined", hue: "red" },
};

const INVOICE_STATUSES = ["draft", "sent", "paid", "void"];
const ESTIMATE_STATUSES = ["draft", "sent", "accepted", "declined"];

function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

const inputCls =
  "rounded-[8px] border border-transparent bg-transparent px-1.5 py-1 text-sm text-text outline-none transition hover:border-border focus:border-border-strong focus:bg-surface";

export function InvoiceWorkspace({
  projectId,
  documents,
  profile,
  logoUrl,
  contacts,
}: {
  projectId: string;
  documents: DocWithLines[];
  profile: BillingProfile | null;
  logoUrl: string | null;
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(documents[0]?.id ?? null);

  const docsSig = documents
    .map((d) => `${d.id}:${d.lines.map((l) => l.id).join(",")}`)
    .join("|");

  const active = documents.find((d) => d.id === activeId) ?? null;

  // Local editable copy of the active document.
  const [form, setForm] = useState<DocWithLines | null>(active);
  useEffect(() => {
    setForm(documents.find((d) => d.id === activeId) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, docsSig]);

  function create(kind: "invoice" | "estimate") {
    start(async () => {
      const res = await createBillingDocument(projectId, kind);
      if (res?.id) setActiveId(res.id);
      router.refresh();
    });
  }

  function patchDoc(patch: Partial<BillingDocument>) {
    setForm((f) => (f ? { ...f, ...patch } : f));
  }
  function saveDoc(patch: Parameters<typeof updateBillingDocument>[2]) {
    if (!form) return;
    void updateBillingDocument(projectId, form.id, patch);
  }

  function patchLine(id: string, patch: Partial<BillingDocumentLine>) {
    setForm((f) =>
      f ? { ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : f,
    );
  }
  function saveLine(id: string, patch: { description?: string; rate?: number; qty?: number; tax_rate?: number }) {
    void updateDocLine(projectId, id, patch);
  }
  function addLine() {
    if (!form) return;
    start(async () => {
      await addDocLine(projectId, form.id);
      router.refresh();
    });
  }
  function removeLine(id: string) {
    setForm((f) => (f ? { ...f, lines: f.lines.filter((l) => l.id !== id) } : f));
    start(async () => {
      await deleteDocLine(projectId, id);
      router.refresh();
    });
  }

  const [taxOpen, setTaxOpen] = useState<string | null>(null);

  const totals = useMemo(() => {
    const lines = form?.lines ?? [];
    const subtotal = lines.reduce((s, l) => s + (l.rate || 0) * (l.qty || 0), 0);
    const tax = lines.reduce(
      (s, l) => s + (l.rate || 0) * (l.qty || 0) * ((l.tax_rate || 0) / 100),
      0,
    );
    const discount = form?.discount || 0;
    return { subtotal, tax, discount, total: subtotal + tax - discount };
  }, [form]);

  const statuses = form?.kind === "estimate" ? ESTIMATE_STATUSES : INVOICE_STATUSES;
  const docLabel = form?.kind === "estimate" ? "Estimate" : "Invoice";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
      {/* Left rail: document list */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => create("invoice")} disabled={busy} className="flex-1">
            + Invoice
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => create("estimate")}
            disabled={busy}
            className="flex-1"
          >
            + Estimate
          </Button>
        </div>
        {documents.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-border p-4 text-center text-xs text-text-faint">
            No invoices or estimates yet. Create one to start.
          </p>
        ) : (
          <div className="space-y-1.5">
            {documents.map((d) => {
              const s = STATUS[d.status] ?? { label: d.status, hue: "blue" as Hue };
              const on = d.id === activeId;
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveId(d.id)}
                  className={`w-full rounded-[11px] border px-3 py-2 text-left transition ${
                    on
                      ? "border-accent bg-accent-soft"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-text-faint">
                      {d.kind === "estimate" ? "Estimate" : "Invoice"}
                    </span>
                    <StatusTag hue={s.hue}>{s.label}</StatusTag>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-text">
                    {d.number ?? "Draft"}
                  </div>
                  {d.bill_to_name && (
                    <div className="truncate text-xs text-text-faint">{d.bill_to_name}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: the document */}
      {!form ? (
        <div className="grid place-items-center rounded-[14px] border border-dashed border-border p-16 text-sm text-text-faint">
          Select or create an {docLabel.toLowerCase()}.
        </div>
      ) : (
        <div className="rounded-[16px] border border-border bg-surface p-6 shadow-sm">
          {/* Header: From + doc meta */}
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Logo"
                  width={160}
                  height={56}
                  className="mb-3 h-12 w-auto object-contain"
                  unoptimized
                />
              ) : null}
              <div className="text-sm font-bold text-text">
                {profile?.business_name ?? "Your business"}
              </div>
              <div className="whitespace-pre-line text-xs text-text-muted">
                {[profile?.address, profile?.phone, profile?.email, profile?.website]
                  .filter(Boolean)
                  .join("\n")}
              </div>
              {!profile?.business_name && (
                <a href="/settings" className="text-xs font-semibold text-accent underline">
                  Add your business details in Settings
                </a>
              )}
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-extrabold uppercase tracking-tight text-text">
                {docLabel}
              </div>
              <input
                value={form.number ?? ""}
                onChange={(e) => patchDoc({ number: e.target.value })}
                onBlur={() => saveDoc({ number: form.number ?? "" })}
                className={`${inputCls} mt-1 text-right font-semibold`}
              />
              <div className="mt-2 space-y-1 text-xs">
                <label className="flex items-center justify-end gap-2">
                  <span className="text-text-faint">Issued</span>
                  <input
                    type="date"
                    value={form.issue_date ?? ""}
                    onChange={(e) => patchDoc({ issue_date: e.target.value })}
                    onBlur={() => saveDoc({ issue_date: form.issue_date })}
                    className={inputCls}
                  />
                </label>
                <label className="flex items-center justify-end gap-2">
                  <span className="text-text-faint">Due</span>
                  <input
                    type="date"
                    value={form.due_date ?? ""}
                    onChange={(e) => patchDoc({ due_date: e.target.value })}
                    onBlur={() => saveDoc({ due_date: form.due_date || null })}
                    className={inputCls}
                  />
                </label>
                <label className="flex items-center justify-end gap-2">
                  <span className="text-text-faint">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => {
                      patchDoc({ status: e.target.value });
                      saveDoc({ status: e.target.value });
                    }}
                    className="rounded-[8px] border border-border bg-surface px-2 py-1 text-xs font-semibold"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {STATUS[s]?.label ?? s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="mt-6 max-w-sm">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                Bill to
              </span>
              {contacts.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    const c = contacts.find((x) => x.id === id);
                    if (c) {
                      patchDoc({
                        bill_to_name: c.name,
                        bill_to_email: c.email,
                        bill_to_company: c.company,
                      });
                      void setDocumentRecipient(projectId, form.id, id);
                    }
                  }}
                  className="rounded-[7px] border border-border bg-surface px-1.5 py-0.5 text-xs text-text-muted"
                >
                  <option value="">Fill from contact…</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` — ${c.company}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <input
              value={form.bill_to_name ?? ""}
              onChange={(e) => patchDoc({ bill_to_name: e.target.value })}
              onBlur={() => saveDoc({ bill_to_name: form.bill_to_name || null })}
              placeholder="Client / company name"
              className={`${inputCls} block w-full font-semibold`}
            />
            <input
              value={form.bill_to_company ?? ""}
              onChange={(e) => patchDoc({ bill_to_company: e.target.value })}
              onBlur={() => saveDoc({ bill_to_company: form.bill_to_company || null })}
              placeholder="Company (optional)"
              className={`${inputCls} block w-full`}
            />
            <input
              value={form.bill_to_email ?? ""}
              onChange={(e) => patchDoc({ bill_to_email: e.target.value })}
              onBlur={() => saveDoc({ bill_to_email: form.bill_to_email || null })}
              placeholder="Email"
              className={`${inputCls} block w-full`}
            />
            <input
              value={form.reference ?? ""}
              onChange={(e) => patchDoc({ reference: e.target.value })}
              onBlur={() => saveDoc({ reference: form.reference || null })}
              placeholder="Reference / PO (optional)"
              className={`${inputCls} block w-full`}
            />
          </div>

          {/* Line items */}
          <div className="mt-6 overflow-visible">
            <div className="grid grid-cols-[1fr_5rem_3.5rem_4.5rem_6rem_1.5rem] items-center gap-2 border-b-2 border-text/80 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">
              <span>Description</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Tax</span>
              <span className="text-right">Line total</span>
              <span />
            </div>
            {form.lines.map((l) => {
              const lineTotal = (l.rate || 0) * (l.qty || 0) * (1 + (l.tax_rate || 0) / 100);
              return (
                <div
                  key={l.id}
                  className="grid grid-cols-[1fr_5rem_3.5rem_4.5rem_6rem_1.5rem] items-center gap-2 border-b border-border py-1"
                >
                  <input
                    value={l.description}
                    onChange={(e) => patchLine(l.id, { description: e.target.value })}
                    onBlur={() => saveLine(l.id, { description: l.description })}
                    placeholder="Item / service"
                    className={`${inputCls} w-full`}
                  />
                  <input
                    type="number"
                    value={l.rate || ""}
                    onChange={(e) => patchLine(l.id, { rate: Number(e.target.value) || 0 })}
                    onBlur={() => saveLine(l.id, { rate: l.rate })}
                    placeholder="0"
                    className={`${inputCls} w-full text-right`}
                  />
                  <input
                    type="number"
                    value={l.qty || ""}
                    onChange={(e) => patchLine(l.id, { qty: Number(e.target.value) || 0 })}
                    onBlur={() => saveLine(l.id, { qty: l.qty })}
                    placeholder="1"
                    className={`${inputCls} w-full text-right`}
                  />
                  <div className="relative text-right">
                    <button
                      onClick={() => setTaxOpen(taxOpen === l.id ? null : l.id)}
                      className="w-full rounded-[7px] px-1 py-1 text-right text-sm text-text-muted transition hover:bg-surface-2"
                    >
                      {l.tax_rate ? `${l.tax_rate}%` : "+ Tax"}
                    </button>
                    {taxOpen === l.id && (
                      <div className="absolute right-0 z-10 mt-1 flex items-center gap-1 rounded-[10px] border border-border bg-surface p-2 shadow-md">
                        <input
                          type="number"
                          autoFocus
                          value={l.tax_rate || ""}
                          onChange={(e) =>
                            patchLine(l.id, { tax_rate: Number(e.target.value) || 0 })
                          }
                          onBlur={() => saveLine(l.id, { tax_rate: l.tax_rate })}
                          placeholder="0"
                          className="w-16 rounded-[7px] border border-border bg-surface px-2 py-1 text-sm text-text outline-none focus:border-border-strong"
                        />
                        <span className="text-sm text-text-faint">%</span>
                        <button
                          onClick={() => setTaxOpen(null)}
                          className="rounded-[7px] px-1.5 py-1 text-xs font-semibold text-accent"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-right text-sm tabular-nums text-text">
                    {money(lineTotal, form.currency)}
                  </span>
                  <button
                    onClick={() => removeLine(l.id)}
                    className="grid h-6 w-6 place-items-center rounded-[6px] text-text-faint transition hover:bg-red-bg hover:text-red"
                    aria-label="Remove line"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
            <button
              onClick={addLine}
              disabled={busy}
              className="mt-2 text-xs font-semibold text-accent hover:underline"
            >
              + Add a line
            </button>
          </div>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between text-text-muted">
                <span>Subtotal</span>
                <span className="tabular-nums">{money(totals.subtotal, form.currency)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Tax</span>
                <span className="tabular-nums">{money(totals.tax, form.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-text-muted">
                <span>Discount</span>
                <span className="flex items-center gap-1">
                  <span className="text-text-faint">$</span>
                  <input
                    type="number"
                    value={form.discount || ""}
                    onChange={(e) => patchDoc({ discount: Number(e.target.value) || 0 })}
                    onBlur={() => saveDoc({ discount: form.discount || 0 })}
                    placeholder="0"
                    className={`${inputCls} w-20 text-right`}
                  />
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 text-base font-bold text-text">
                <span>Total</span>
                <span className="tabular-nums">{money(totals.total, form.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes + Terms */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                Notes
              </label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => patchDoc({ notes: e.target.value })}
                onBlur={() => saveDoc({ notes: form.notes || null })}
                rows={3}
                placeholder="Anything the client should know."
                className="mt-1 w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                Terms
              </label>
              <textarea
                value={form.terms ?? ""}
                onChange={(e) => patchDoc({ terms: e.target.value })}
                onBlur={() => saveDoc({ terms: form.terms || null })}
                rows={3}
                placeholder="Payment terms, late fees, etc."
                className="mt-1 w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-text-faint">
              Changes save automatically. PDF export and send-link are coming next.
            </span>
            <button
              onClick={() => {
                if (confirm("Delete this document?")) {
                  const id = form.id;
                  setActiveId(null);
                  start(async () => {
                    await deleteBillingDocument(projectId, id);
                    router.refresh();
                  });
                }
              }}
              className="text-xs font-semibold text-red hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
