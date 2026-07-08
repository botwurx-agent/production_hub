"use client";

import { useState } from "react";
import { saveBillingProfile } from "@/app/(app)/settings/billing-profile-actions";
import type { BillingProfile } from "@/lib/database.types";

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";
const labelCls =
  "text-[11px] font-bold uppercase tracking-wide text-text-faint";

export function BillingProfileForm({ profile }: { profile: BillingProfile | null }) {
  const [f, setF] = useState({
    business_name: profile?.business_name ?? "",
    address: profile?.address ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    website: profile?.website ?? "",
    invoice_prefix: profile?.invoice_prefix ?? "INV-",
    estimate_prefix: profile?.estimate_prefix ?? "EST-",
    default_terms: profile?.default_terms ?? "",
    default_notes: profile?.default_notes ?? "",
  });

  function save(patch: Parameters<typeof saveBillingProfile>[0]) {
    void saveBillingProfile(patch);
  }
  function set(k: keyof typeof f, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Your business details for the header of native invoices and estimates.
        Your uploaded logo (above) appears alongside these.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Business name</label>
          <input
            value={f.business_name}
            onChange={(e) => set("business_name", e.target.value)}
            onBlur={() => save({ business_name: f.business_name || null })}
            placeholder="Studio LLC"
            className={`mt-1 ${field}`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Address</label>
          <input
            value={f.address}
            onChange={(e) => set("address", e.target.value)}
            onBlur={() => save({ address: f.address || null })}
            placeholder="123 Main St, City, ST 00000"
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input
            value={f.email}
            onChange={(e) => set("email", e.target.value)}
            onBlur={() => save({ email: f.email || null })}
            placeholder="billing@studio.com"
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input
            value={f.phone}
            onChange={(e) => set("phone", e.target.value)}
            onBlur={() => save({ phone: f.phone || null })}
            placeholder="(555) 123-4567"
            className={`mt-1 ${field}`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Website</label>
          <input
            value={f.website}
            onChange={(e) => set("website", e.target.value)}
            onBlur={() => save({ website: f.website || null })}
            placeholder="studio.com"
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className={labelCls}>Invoice number prefix</label>
          <input
            value={f.invoice_prefix}
            onChange={(e) => set("invoice_prefix", e.target.value)}
            onBlur={() => save({ invoice_prefix: f.invoice_prefix || "INV-" })}
            className={`mt-1 ${field}`}
          />
        </div>
        <div>
          <label className={labelCls}>Estimate number prefix</label>
          <input
            value={f.estimate_prefix}
            onChange={(e) => set("estimate_prefix", e.target.value)}
            onBlur={() => save({ estimate_prefix: f.estimate_prefix || "EST-" })}
            className={`mt-1 ${field}`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Default terms</label>
          <textarea
            value={f.default_terms}
            onChange={(e) => set("default_terms", e.target.value)}
            onBlur={() => save({ default_terms: f.default_terms || null })}
            placeholder="Payment due within 30 days. Thank you for your business."
            rows={2}
            className={`mt-1 ${field}`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Default notes</label>
          <textarea
            value={f.default_notes}
            onChange={(e) => set("default_notes", e.target.value)}
            onBlur={() => save({ default_notes: f.default_notes || null })}
            placeholder="Anything you want on every invoice by default."
            rows={2}
            className={`mt-1 ${field}`}
          />
        </div>
      </div>
    </div>
  );
}
