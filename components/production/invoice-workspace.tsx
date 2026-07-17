"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  sendBillingDoc,
  updateDocStyle,
  saveDefaultDocStyle,
  addDocAttachment,
  deleteDocAttachment,
} from "@/app/(app)/projects/[id]/native-invoice-actions";
import { toast } from "@/components/ui/toast";
import { shortDate } from "@/lib/format";
import {
  DOC_TEMPLATES,
  DOC_FONTS,
  DOC_ACCENTS,
  fontStack,
  safeAccent,
  docLabel as kindLabel,
  type DocKind,
} from "@/lib/billing-doc";
import type {
  BillingDocument,
  BillingDocumentLine,
  BillingDocumentAttachment,
  BillingProfile,
} from "@/lib/database.types";

type DocWithLines = BillingDocument & {
  lines: BillingDocumentLine[];
  attachments: BillingDocumentAttachment[];
};
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

const STATUSES: Record<DocKind, string[]> = {
  invoice: ["draft", "sent", "paid", "void"],
  estimate: ["draft", "sent", "accepted", "declined"],
  proposal: ["draft", "sent", "accepted", "declined"],
};

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
  const [copied, setCopied] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const origin =
    siteOrigin || (typeof window !== "undefined" ? window.location.origin : "");

  const docsSig = documents
    .map(
      (d) =>
        `${d.id}:${d.lines.map((l) => l.id).join(",")}:${d.attachments
          .map((a) => a.id)
          .join(",")}`
    )
    .join("|");

  const active = documents.find((d) => d.id === activeId) ?? null;

  // Local editable copy of the active document.
  const [form, setForm] = useState<DocWithLines | null>(active);
  useEffect(() => {
    setForm(documents.find((d) => d.id === activeId) ?? null);
    setStyleOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, docsSig]);

  function create(kind: DocKind) {
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

  // Style (template / theme color / font).
  function setStyle(patch: { template?: string; accent_color?: string | null; font?: string }) {
    if (!form) return;
    patchDoc(patch as Partial<BillingDocument>);
    void updateDocStyle(projectId, form.id, patch);
  }
  function saveStyleDefault() {
    if (!form) return;
    void saveDefaultDocStyle(projectId, {
      template: form.template,
      accent: safeAccent(form.accent_color),
      font: form.font,
    });
    toast("Saved as the default style for new documents.", "success");
  }

  // Attachments (proposals).
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !form) return;
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await addDocAttachment(projectId, form.id, fd);
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      router.refresh();
    });
  }
  function removeAttachment(id: string) {
    setForm((f) =>
      f ? { ...f, attachments: f.attachments.filter((a) => a.id !== id) } : f
    );
    start(async () => {
      await deleteDocAttachment(projectId, id);
      router.refresh();
    });
  }

  function copyLink() {
    if (!form?.share_token) return;
    navigator.clipboard?.writeText(`${origin}/p/${form.share_token}`).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {}
    );
  }
  function send() {
    if (!form) return;
    start(async () => {
      const res = await sendBillingDoc(projectId, form.id);
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      navigator.clipboard?.writeText(`${origin}/p/${res.token}`).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast("Share link ready and copied.", "success");
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

  const kind = (form?.kind as DocKind) ?? "invoice";
  const statuses = STATUSES[kind] ?? STATUSES.invoice;
  const docLabel = kindLabel(kind);
  const accent = safeAccent(form?.accent_color);
  const isProposal = kind === "proposal";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
      {/* Left rail: document list */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="secondary" onClick={() => create("estimate")} disabled={busy}>
            + Estimate
          </Button>
          <Button size="sm" variant="secondary" onClick={() => create("proposal")} disabled={busy}>
            + Proposal
          </Button>
          <Button size="sm" onClick={() => create("invoice")} disabled={busy}>
            + Invoice
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-text-faint">
          Estimate to scope, proposal to sign, invoice to bill.
        </p>
        {documents.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-border p-4 text-center text-xs text-text-faint">
            Nothing here yet. Create a document to start.
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
                      {kindLabel(d.kind)}
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
          Select or create a document.
        </div>
      ) : (
        <div
          className="rounded-[16px] border border-border bg-surface p-6 shadow-sm"
          style={{ fontFamily: fontStack(form.font) }}
        >
          {/* Toolbar: customize style */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              onClick={() => setStyleOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="10.5" r="2.5" /><circle cx="17" cy="14" r="2.5" /><circle cx="8.5" cy="18" r="2.5" />
              </svg>
              Customize style
            </button>
            <span className="text-xs text-text-faint">Changes save automatically.</span>
          </div>

          {styleOpen && (
            <StylePanel
              template={form.template}
              accent={accent}
              font={form.font}
              onTemplate={(t) => setStyle({ template: t })}
              onAccent={(c) => setStyle({ accent_color: c })}
              onFont={(f) => setStyle({ font: f })}
              onSaveDefault={saveStyleDefault}
              onClose={() => setStyleOpen(false)}
            />
          )}

          {/* Header: From + doc meta */}
          {(() => {
            const logoBusiness = (
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
            );

            const numberInput = (light: boolean) => (
              <input
                value={form.number ?? ""}
                onChange={(e) => patchDoc({ number: e.target.value })}
                onBlur={() => saveDoc({ number: form.number ?? "" })}
                className={
                  light
                    ? "mt-1 rounded-[8px] border border-white/30 bg-white/10 px-1.5 py-1 text-right text-sm font-semibold text-white outline-none transition focus:border-white/70"
                    : `${inputCls} mt-1 text-right font-semibold`
                }
              />
            );

            const dateFields = (light: boolean) => (
              <div className="mt-2 space-y-1 text-xs">
                <label className="flex items-center justify-end gap-2">
                  <span className={light ? "text-white/75" : "text-text-faint"}>Issued</span>
                  <input
                    type="date"
                    value={form.issue_date ?? ""}
                    onChange={(e) => patchDoc({ issue_date: e.target.value })}
                    onBlur={() => saveDoc({ issue_date: form.issue_date })}
                    style={light ? { colorScheme: "dark" } : undefined}
                    className={
                      light
                        ? "rounded-[8px] border border-white/30 bg-white/10 px-1.5 py-1 text-sm text-white outline-none focus:border-white/70"
                        : inputCls
                    }
                  />
                </label>
                <label className="flex items-center justify-end gap-2">
                  <span className={light ? "text-white/75" : "text-text-faint"}>
                    {kind === "invoice" ? "Due" : "Valid until"}
                  </span>
                  <input
                    type="date"
                    value={form.due_date ?? ""}
                    onChange={(e) => patchDoc({ due_date: e.target.value })}
                    onBlur={() => saveDoc({ due_date: form.due_date || null })}
                    style={light ? { colorScheme: "dark" } : undefined}
                    className={
                      light
                        ? "rounded-[8px] border border-white/30 bg-white/10 px-1.5 py-1 text-sm text-white outline-none focus:border-white/70"
                        : inputCls
                    }
                  />
                </label>
              </div>
            );

            const statusControl = (
              <label className="flex items-center justify-end gap-2 text-xs">
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
            );

            if (form.template === "modern") {
              return (
                <div>
                  <div
                    className="-mx-6 -mt-2 mb-5 flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                    style={{ backgroundColor: accent }}
                  >
                    <div className="font-display text-2xl font-extrabold uppercase tracking-tight text-white">
                      {docLabel}
                    </div>
                    <div className="text-right">
                      {numberInput(true)}
                      {dateFields(true)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    {logoBusiness}
                    <div className="text-right">{statusControl}</div>
                  </div>
                </div>
              );
            }

            if (form.template === "bold") {
              return (
                <div>
                  <div
                    className="font-display text-4xl font-black uppercase tracking-tight"
                    style={{ color: accent }}
                  >
                    {docLabel}
                  </div>
                  <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
                    {logoBusiness}
                    <div className="text-right">
                      {numberInput(false)}
                      {dateFields(false)}
                      <div className="mt-1">{statusControl}</div>
                    </div>
                  </div>
                </div>
              );
            }

            // classic
            return (
              <div className="flex flex-wrap items-start justify-between gap-6">
                {logoBusiness}
                <div className="text-right">
                  <div
                    className="font-display text-2xl font-extrabold uppercase tracking-tight"
                    style={{ color: accent }}
                  >
                    {docLabel}
                  </div>
                  {numberInput(false)}
                  {dateFields(false)}
                  <div className="mt-1">{statusControl}</div>
                </div>
              </div>
            );
          })()}

          {/* Bill To */}
          <div className="mt-6 max-w-sm">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                {isProposal ? "Prepared for" : "Bill to"}
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
            <div
              className="grid grid-cols-[1fr_5rem_3.5rem_4.5rem_6rem_1.5rem] items-center gap-2 border-b-2 pb-1.5 text-[11px] font-bold uppercase tracking-wide"
              style={{ borderColor: accent, color: accent }}
            >
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
              <div
                className="flex justify-between rounded-[8px] px-2 py-1.5 text-base font-bold text-white"
                style={{ backgroundColor: accent }}
              >
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

          {/* Attachments (proposals) */}
          {isProposal && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                  Attachments
                </label>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  + Add a file
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={onPickFile}
                />
              </div>
              {form.attachments.length === 0 ? (
                <p className="mt-2 rounded-[10px] border border-dashed border-border px-3 py-3 text-center text-xs text-text-faint">
                  Add a scope doc, contract, or reference PDF. It travels with the
                  proposal and shows on the client link.
                </p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {form.attachments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 rounded-[9px] border border-border px-3 py-2 text-sm"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-faint">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                      <span className="truncate font-medium text-text">{a.name}</span>
                      <button
                        onClick={() => removeAttachment(a.id)}
                        className="ml-auto grid h-6 w-6 place-items-center rounded-[6px] text-text-faint transition hover:bg-red-bg hover:text-red"
                        aria-label="Remove attachment"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Send */}
          <div className="mt-6 rounded-[12px] border border-border bg-surface-2/40 p-4">
            {isProposal && form.accepted_at ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-green text-white">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <span className="font-semibold text-green">
                  Signed by {form.signer_name}
                </span>
                <span className="text-text-faint">
                  on {shortDate(form.accepted_at)}
                </span>
                {form.share_token && (
                  <button
                    onClick={copyLink}
                    className="ml-auto rounded-[8px] border border-border px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:bg-surface hover:text-text"
                  >
                    {copied ? "Copied" : "View signed link"}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">
                    {isProposal ? "Send for signature" : `Send ${docLabel.toLowerCase()}`}
                  </p>
                  <p className="text-xs text-text-muted">
                    {form.sent_at
                      ? "Shared. Re-send to push edits into a fresh copy."
                      : isProposal
                        ? "Freeze this proposal and share a link the client signs to accept."
                        : `Freeze this ${docLabel.toLowerCase()} and share a link the client can view.`}
                  </p>
                  {form.sent_at && (
                    <p className="mt-1 text-xs text-text-faint">
                      {form.viewed_at
                        ? `Viewed ${shortDate(form.viewed_at)}`
                        : "Sent, not viewed yet"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {form.share_token && (
                    <button
                      onClick={copyLink}
                      className="rounded-[9px] border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface hover:text-text"
                    >
                      {copied ? "Copied" : "Copy link"}
                    </button>
                  )}
                  <Button size="sm" onClick={send} disabled={busy}>
                    {form.sent_at
                      ? "Re-send"
                      : isProposal
                        ? "Send for signature"
                        : "Send"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="mt-6 flex items-center justify-end border-t border-border pt-4">
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

// FreshBooks-style "Customize style" panel: template + theme color + font.
function StylePanel({
  template,
  accent,
  font,
  onTemplate,
  onAccent,
  onFont,
  onSaveDefault,
  onClose,
}: {
  template: string;
  accent: string;
  font: string;
  onTemplate: (t: string) => void;
  onAccent: (c: string) => void;
  onFont: (f: string) => void;
  onSaveDefault: () => void;
  onClose: () => void;
}) {
  const customActive = !DOC_ACCENTS.includes(accent);
  return (
    <div className="mb-5 rounded-[14px] border border-border bg-surface-2/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text">Customize style</h3>
        <button
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded-[6px] text-text-faint transition hover:bg-surface hover:text-text"
          aria-label="Close"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Template */}
      <div className="mt-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
          Template
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {DOC_TEMPLATES.map((t) => {
            const on = template === t.value;
            return (
              <button
                key={t.value}
                onClick={() => onTemplate(t.value)}
                className={`rounded-[10px] border px-3 py-2.5 text-left transition ${
                  on ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong"
                }`}
              >
                <TemplateThumb variant={t.value} accent={accent} />
                <div className="mt-2 text-xs font-semibold text-text">{t.label}</div>
                <div className="text-[10px] leading-tight text-text-faint">{t.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme color */}
      <div className="mt-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
          Theme color
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {DOC_ACCENTS.map((c) => {
            const on = accent.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                onClick={() => onAccent(c)}
                className={`grid h-8 w-8 place-items-center rounded-[9px] ring-2 ring-offset-2 ring-offset-surface transition ${
                  on ? "ring-text/60" : "ring-transparent hover:ring-border-strong"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Theme ${c}`}
              >
                {on && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                )}
              </button>
            );
          })}
          <label
            className={`relative grid h-8 w-8 cursor-pointer place-items-center overflow-hidden rounded-[9px] ring-2 ring-offset-2 ring-offset-surface transition ${
              customActive ? "ring-text/60" : "ring-transparent hover:ring-border-strong"
            }`}
            style={{
              background: customActive
                ? accent
                : "conic-gradient(from 0deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)",
            }}
            title="Custom color"
          >
            <input
              type="color"
              value={accent}
              onChange={(e) => onAccent(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            {!customActive && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            )}
          </label>
        </div>
      </div>

      {/* Font */}
      <div className="mt-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
          Font
        </div>
        <select
          value={font}
          onChange={(e) => onFont(e.target.value)}
          className="mt-2 w-48 rounded-[9px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
          style={{ fontFamily: fontStack(font) }}
        >
          {DOC_FONTS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: fontStack(f.value) }}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <button
          onClick={onSaveDefault}
          className="text-xs font-semibold text-accent hover:underline"
        >
          Save as default for new documents
        </button>
        <Button size="sm" variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

function TemplateThumb({ variant, accent }: { variant: string; accent: string }) {
  if (variant === "modern") {
    return (
      <div className="overflow-hidden rounded-[6px] border border-border bg-white">
        <div className="h-3" style={{ backgroundColor: accent }} />
        <div className="space-y-1 p-1.5">
          <div className="h-1 w-1/2 rounded bg-slate-300" />
          <div className="h-1 w-full rounded bg-slate-200" />
          <div className="h-1 w-full rounded bg-slate-200" />
        </div>
      </div>
    );
  }
  if (variant === "bold") {
    return (
      <div className="space-y-1 rounded-[6px] border border-border bg-white p-1.5">
        <div className="h-2 w-2/3 rounded" style={{ backgroundColor: accent }} />
        <div className="h-1 w-full rounded bg-slate-200" />
        <div className="h-1 w-full rounded bg-slate-200" />
        <div className="mt-1 h-1.5 w-1/2 rounded" style={{ backgroundColor: accent }} />
      </div>
    );
  }
  // classic
  return (
    <div className="rounded-[6px] border border-border bg-white p-1.5">
      <div className="flex items-start justify-between">
        <div className="h-1.5 w-1/3 rounded bg-slate-300" />
        <div className="h-1.5 w-1/4 rounded" style={{ backgroundColor: accent }} />
      </div>
      <div className="mt-1.5 space-y-1">
        <div className="h-1 w-full rounded bg-slate-200" />
        <div className="h-1 w-full rounded bg-slate-200" />
      </div>
    </div>
  );
}
