"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import {
  addCost,
  updateCost,
  deleteCost,
  setCostStatus,
  uploadCostDoc,
  getCostDocUrl,
  extractInvoiceDraft,
  type CostInput,
} from "@/app/(app)/projects/[id]/cost-actions";
import { useAiEnabled } from "@/components/ai/ai-availability";
import {
  COST_STATUS,
  COST_STATUS_ORDER,
  costStatus,
  rateCheck,
  summarizePayments,
  MAX_COST_DOC_BYTES,
  type CostStatus,
} from "@/lib/costs";
import { PaymentSchedule } from "@/components/production/payment-schedule";
import type { BudgetLine, CostPayment, ProjectCost } from "@/lib/database.types";

export type RosterOption = {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  rate: number | null;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const moneyExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const field =
  "w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none transition focus:border-border-strong";
const label =
  "mb-1 block text-[11px] font-bold uppercase tracking-wide text-text-faint";

/** A date column is a plain YYYY-MM-DD, so parse it as UTC or a timezone west
 * of GMT renders yesterday. Same rule as lib/slate.ts. */
function fmtDay(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function emptyCost(): CostInput {
  return {
    vendor: "",
    description: "",
    amount: 0,
    days: null,
    budgetLineId: null,
    contactId: null,
    invoiceNumber: null,
    invoiceDate: null,
    dueDate: null,
    status: "received",
    notes: null,
  };
}

function toInput(c: ProjectCost): CostInput {
  return {
    vendor: c.vendor,
    description: c.description,
    amount: Number(c.amount) || 0,
    days: c.days === null ? null : Number(c.days),
    budgetLineId: c.budget_line_id,
    contactId: c.contact_id,
    invoiceNumber: c.invoice_number,
    invoiceDate: c.invoice_date,
    dueDate: c.due_date,
    status: c.status,
    notes: c.notes,
  };
}

/**
 * Only fires for a cost linked to a roster contact that has an agreed rate AND
 * a day count on the invoice. Anything looser would flag every kit fee.
 */
function overRate(c: ProjectCost, roster: RosterOption[]): boolean {
  if (!c.contact_id) return false;
  const contact = roster.find((r) => r.id === c.contact_id);
  const check = rateCheck({
    rate: contact?.rate,
    days: c.days,
    amount: Number(c.amount),
  });
  return check?.status === "over";
}

export function CostLedger({
  projectId,
  costs,
  lines,
  roster,
  payments,
  todayIso,
}: {
  projectId: string;
  costs: ProjectCost[];
  lines: BudgetLine[];
  roster: RosterOption[];
  payments: CostPayment[];
  /** Computed on the server, so overdue cannot differ after hydration. */
  todayIso: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<ProjectCost | "new" | null>(null);
  const [openSchedule, setOpenSchedule] = useState<string | null>(null);

  const paymentsByCost = useMemo(() => {
    const m = new Map<string, CostPayment[]>();
    for (const p of payments) {
      const list = m.get(p.cost_id) ?? [];
      list.push(p);
      m.set(p.cost_id, list);
    }
    // Soonest first, undated last: the schedule should read in the order it
    // will actually happen.
    for (const list of m.values()) {
      list.sort((a, b) => {
        if (a.due_date === b.due_date) return 0;
        if (a.due_date === null) return 1;
        if (b.due_date === null) return -1;
        return a.due_date < b.due_date ? -1 : 1;
      });
    }
    return m;
  }, [payments]);

  const lineName = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lines) {
      m.set(l.id, `${l.category || "General"}: ${l.description || "Untitled"}`);
    }
    return m;
  }, [lines]);

  const totals = useMemo(() => {
    let all = 0;
    let outstanding = 0;
    for (const c of costs) {
      all += Number(c.amount) || 0;
      // A part-paid commitment owes only its remainder, which the old binary
      // status could not express.
      outstanding += summarizePayments(
        c.amount,
        paymentsByCost.get(c.id) ?? [],
        c.status
      ).owed;
    }
    return { all, outstanding };
  }, [costs, paymentsByCost]);

  function remove(cost: ProjectCost) {
    if (
      !window.confirm(
        `Delete the ${money.format(Number(cost.amount) || 0)} cost from ${
          cost.vendor || "this vendor"
        }? The attached document is deleted too.`
      )
    )
      return;
    start(async () => {
      await deleteCost(projectId, cost.id);
      router.refresh();
    });
  }

  function cycleStatus(cost: ProjectCost) {
    const i = COST_STATUS_ORDER.indexOf(costStatus(cost.status));
    const next = COST_STATUS_ORDER[(i + 1) % COST_STATUS_ORDER.length];
    start(async () => {
      const res = await setCostStatus(projectId, cost.id, next);
      if ("error" in res) toast(res.error, "error");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-text">Costs</h3>
          <p className="text-xs text-text-muted">
            {costs.length === 0
              ? "Vendor and freelancer invoices, rolled up into the actuals above."
              : `${costs.length} ${costs.length === 1 ? "invoice" : "invoices"}, ${money.format(totals.all)} total${
                  totals.outstanding > 0
                    ? `, ${money.format(totals.outstanding)} still owed`
                    : ", all paid"
                }.`}
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          + Add a cost
        </Button>
      </div>

      {costs.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border py-8 text-center text-sm text-text-faint">
          No costs logged yet. Add a vendor invoice to start the running tab.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-border">
          <div className="hidden grid-cols-[1fr_1fr_7rem_6rem_auto] gap-2 border-b border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint md:grid">
            <span>Vendor</span>
            <span>Budget line</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
            <span />
          </div>
          {costs.map((c) => {
            const costPayments = paymentsByCost.get(c.id) ?? [];
            const summary = summarizePayments(c.amount, costPayments, c.status);
            const scheduleOpen = openSchedule === c.id;
            return (
            <div key={c.id} className="border-b border-border px-3 py-2 last:border-0">
            <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[1fr_1fr_7rem_6rem_auto]">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-text">
                  {c.vendor || "Unnamed vendor"}
                </div>
                <div className="truncate text-xs text-text-muted">
                  {[c.description, c.invoice_number && `#${c.invoice_number}`, fmtDay(c.invoice_date)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className="min-w-0 text-xs text-text-muted">
                {c.budget_line_id ? (
                  <span className="truncate">{lineName.get(c.budget_line_id) ?? "Removed line"}</span>
                ) : (
                  <span className="text-text-faint">Unassigned</span>
                )}
              </div>
              <div className="text-sm font-bold tabular-nums text-text md:text-right">
                {moneyExact.format(Number(c.amount) || 0)}
                {summary.state === "part" && (
                  <span className="ml-1 block text-[10px] font-semibold text-text-faint">
                    {moneyExact.format(summary.owed)} left
                  </span>
                )}
                {overRate(c, roster) && (
                  <span
                    title="This invoice is over the day rate agreed with this contact."
                    className="ml-1.5 rounded-pill bg-amber-bg px-1.5 py-0.5 text-[10px] font-bold text-amber"
                  >
                    over rate
                  </span>
                )}
              </div>
              <div>
                {summary.hasSchedule ? (
                  <DerivedChip state={summary.state} />
                ) : (
                  <StatusChip
                    status={costStatus(c.status)}
                    onClick={() => cycleStatus(c)}
                    disabled={busy}
                  />
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setOpenSchedule(scheduleOpen ? null : c.id)}
                  title="Payment schedule"
                  className={`rounded-[7px] px-2 py-1 text-xs font-semibold transition hover:bg-surface-2 ${
                    summary.hasSchedule ? "text-accent" : "text-text-faint"
                  }`}
                >
                  {summary.hasSchedule
                    ? `${costPayments.filter((p) => p.paid_at).length}/${costPayments.length}`
                    : "Split"}
                </button>
                {c.storage_path && <DocButton costId={c.id} name={c.file_name} />}
                <button
                  onClick={() => setEditing(c)}
                  className="rounded-[7px] px-2 py-1 text-xs font-semibold text-accent transition hover:bg-surface-2"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(c)}
                  className="grid h-7 w-7 place-items-center rounded-[7px] text-text-faint transition hover:bg-red-bg hover:text-red"
                  aria-label="Delete cost"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {scheduleOpen && (
              <PaymentSchedule
                projectId={projectId}
                costId={c.id}
                committed={Number(c.amount) || 0}
                payments={costPayments}
                summary={summary}
                todayIso={todayIso}
              />
            )}
            </div>
            );
          })}
        </div>
      )}

      {editing && (
        <CostModal
          projectId={projectId}
          cost={editing === "new" ? null : editing}
          lines={lines}
          roster={roster}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function StatusChip({
  status,
  onClick,
  disabled,
}: {
  status: CostStatus;
  onClick: () => void;
  disabled: boolean;
}) {
  const s = COST_STATUS[status];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="Click to advance"
      className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-bold transition hover:opacity-80"
      style={{
        background: `var(--h-${s.hue}-bg)`,
        color: `var(--h-${s.hue})`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: `var(--h-${s.hue})` }}
      />
      {s.label}
    </button>
  );
}

/**
 * Status when a payment schedule exists: read from the payments rather than
 * clickable, so the chip and the schedule can never disagree. Same rule as a
 * budget line's actual going read-only once costs back it.
 */
function DerivedChip({ state }: { state: "unpaid" | "part" | "paid" }) {
  const map = {
    unpaid: { label: "Scheduled", hue: "amber" },
    part: { label: "Part paid", hue: "blue" },
    paid: { label: "Paid", hue: "green" },
  } as const;
  const s = map[state];
  return (
    <span
      title="Set by the payment schedule."
      className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-bold"
      style={{ background: `var(--h-${s.hue}-bg)`, color: `var(--h-${s.hue})` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: `var(--h-${s.hue})` }}
      />
      {s.label}
    </span>
  );
}

/**
 * States the agreed rate, and flags a gap when the invoice does not match it.
 * Says nothing until both a rate and a day count are known, because an amount
 * alone cannot be judged: $2,400 is either three fair days or one dear one.
 */
function RateNote({
  rate,
  days,
  amount,
}: {
  rate: number | null;
  days: number | null;
  amount: number;
}) {
  if (!rate) return null;
  const check = rateCheck({ rate, days, amount });
  if (!check) {
    return (
      <p className="text-[11px] text-text-muted">
        Agreed rate {moneyExact.format(rate)}/day. Add the days billed to check
        it against this invoice.
      </p>
    );
  }
  if (check.status === "match") {
    return (
      <p className="text-[11px] font-semibold text-green">
        Matches the agreed rate ({days} x {moneyExact.format(rate)}).
      </p>
    );
  }
  const over = check.status === "over";
  return (
    <p className={`text-[11px] font-semibold ${over ? "text-amber" : "text-text-muted"}`}>
      {over ? "Over" : "Under"} the agreed rate by{" "}
      {moneyExact.format(Math.abs(check.delta))}: {days} days at{" "}
      {moneyExact.format(rate)} is {moneyExact.format(check.expected)}.
    </p>
  );
}

/** Signs on click rather than on page load: most invoices are never opened. */
function DocButton({ costId, name }: { costId: string; name: string | null }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        const res = await getCostDocUrl(costId);
        setLoading(false);
        if ("error" in res) toast(res.error, "error");
        else window.open(res.url, "_blank", "noopener");
      }}
      disabled={loading}
      title={name ?? "Open the invoice"}
      className="grid h-7 w-7 place-items-center rounded-[7px] text-text-muted transition hover:bg-surface-2 hover:text-accent"
      aria-label="Open the invoice document"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    </button>
  );
}

export function CostModal({
  projectId,
  cost,
  lines,
  roster,
  initial,
  initialFilled,
  attachment,
  onClose,
}: {
  projectId: string;
  cost: ProjectCost | null;
  lines: BudgetLine[];
  roster: RosterOption[];
  /** Prefilled draft (an invoice already read elsewhere, e.g. from email). */
  initial?: CostInput | null;
  /** Which fields that draft filled, for the same banner as an in-modal read. */
  initialFilled?: string[] | null;
  /**
   * An invoice that already exists somewhere else (a Gmail attachment), filed
   * against the cost once it saves. Replaces the file picker: there is nothing
   * for the producer to choose.
   */
  attachment?: {
    label: string;
    attach: (costId: string) => Promise<{ error: string } | { ok: true }>;
  };
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CostInput>(
    cost ? toInput(cost) : (initial ?? emptyCost())
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiEnabled = useAiEnabled();

  // Extraction is a DRAFT: it fills the form and says so, and never saves.
  // `before` holds the pre-extraction values so a bad read is one click to
  // undo, the same contract as the composer's Polish button.
  const [reading, setReading] = useState(false);
  const [filled, setFilled] = useState<string[] | null>(initialFilled ?? null);
  const [before, setBefore] = useState<CostInput | null>(null);
  // What the document called itself. An estimate is a commitment rather than a
  // bill, so the banner names it instead of calling everything an invoice.
  const [docKind, setDocKind] = useState<"invoice" | "estimate" | null>(null);

  async function readInvoice(f: File) {
    setReading(true);
    setFilled(null);
    const fd = new FormData();
    fd.set("file", f);
    const res = await extractInvoiceDraft(projectId, fd);
    setReading(false);
    if ("error" in res) {
      toast(res.error, "error");
      return;
    }
    const { draft, contactId, vendorMatch } = res;
    setBefore(form);
    setDocKind(draft.documentKind);

    const got: string[] = [];
    setForm((prev) => {
      const next = { ...prev };
      if (draft.vendor) {
        next.vendor = draft.vendor;
        got.push("vendor");
      }
      if (draft.description) {
        next.description = draft.description;
        got.push("description");
      }
      if (draft.amount !== null) {
        next.amount = draft.amount;
        got.push("amount");
      }
      if (draft.days !== null) {
        next.days = draft.days;
        got.push("days billed");
      }
      if (draft.invoiceNumber) {
        next.invoiceNumber = draft.invoiceNumber;
        got.push("invoice number");
      }
      if (draft.invoiceDate) {
        next.invoiceDate = draft.invoiceDate;
        got.push("invoice date");
      }
      if (draft.dueDate) {
        next.dueDate = draft.dueDate;
        got.push("due date");
      }
      if (draft.budgetLineId) {
        next.budgetLineId = draft.budgetLineId;
        got.push("budget line");
      }
      if (draft.notes) next.notes = draft.notes;
      if (contactId) {
        next.contactId = contactId;
        // The matched roster name wins over the letterhead: a bill routed
        // through a rep says "REDEYE Reps" while the studio files the cost
        // under the stylist it booked.
        if (vendorMatch) next.vendor = vendorMatch;
        got.push(`roster match (${vendorMatch})`);
      }
      return next;
    });
    setFilled(got);
    // A currency we do not store is worth saying out loud rather than
    // silently treating a EUR invoice as dollars.
    if (draft.currency && draft.currency.toUpperCase() !== "USD") {
      toast(
        `That document is in ${draft.currency.toUpperCase()}. Amounts here are USD.`,
        "error"
      );
    }
  }

  function undoRead() {
    if (!before) return;
    setForm(before);
    setBefore(null);
    setFilled(null);
  }

  // The roster carries an agreed day rate, so an invoice can be read against
  // what was actually agreed instead of just landing as a number.
  const matched = roster.find((r) => r.id === form.contactId) ?? null;

  function set<K extends keyof CostInput>(k: K, v: CostInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function pickContact(id: string) {
    if (!id) {
      set("contactId", null);
      return;
    }
    const r = roster.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      contactId: id,
      // Only fill the vendor when it is still blank, so picking a contact never
      // silently overwrites a name that was already typed.
      vendor: f.vendor.trim() ? f.vendor : r?.company?.trim() || r?.name || "",
    }));
  }

  async function save() {
    if (!form.vendor.trim()) {
      toast("Add a vendor name.", "error");
      return;
    }
    setSaving(true);
    const res = cost
      ? await updateCost(projectId, cost.id, form)
      : await addCost(projectId, form);

    if ("error" in res) {
      setSaving(false);
      toast(res.error, "error");
      return;
    }

    const id = cost ? cost.id : (res as { ok: true; id: string }).id;
    if (attachment && !cost) {
      const up = await attachment.attach(id);
      if ("error" in up) {
        setSaving(false);
        toast(`Cost saved, but the invoice did not attach: ${up.error}`, "error");
        router.refresh();
        onClose();
        return;
      }
    }
    if (file) {
      const fd = new FormData();
      fd.set("file", file);
      const up = await uploadCostDoc(projectId, id, fd);
      if ("error" in up) {
        // The row saved; only the document failed. Say exactly that, so the
        // producer does not re-enter a cost that is already recorded.
        setSaving(false);
        toast(`Cost saved, but the file did not attach: ${up.error}`, "error");
        router.refresh();
        onClose();
        return;
      }
    }
    setSaving(false);
    router.refresh();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={cost ? "Edit cost" : "Add a cost"} size="lg">
      <div className="space-y-3">
        {roster.length > 0 && (
          <div>
            <span className={label}>From the project roster</span>
            <select
              value={form.contactId ?? ""}
              onChange={(e) => pickContact(e.target.value)}
              className={field}
            >
              <option value="">Not on the roster (one-off vendor)</option>
              {roster.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.role ? ` (${r.role})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className={label}>Vendor</span>
            <input
              value={form.vendor}
              onChange={(e) => set("vendor", e.target.value)}
              placeholder="Who sent the invoice"
              className={field}
            />
          </div>
          <div>
            <span className={label}>Amount</span>
            <input
              type="number"
              step="0.01"
              value={form.amount || ""}
              onChange={(e) => set("amount", Number(e.target.value) || 0)}
              placeholder="0.00"
              className={`${field} text-right tabular-nums`}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className={label}>Days billed (optional)</span>
            <input
              type="number"
              step="0.5"
              min="0"
              value={form.days ?? ""}
              onChange={(e) =>
                set("days", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="Leave blank for a flat fee"
              className={`${field} text-right tabular-nums`}
            />
          </div>
          <div className="flex items-end">
            <RateNote rate={matched?.rate ?? null} days={form.days} amount={form.amount} />
          </div>
        </div>

        <div>
          <span className={label}>What it was for</span>
          <input
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Two shoot days plus kit"
            className={field}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className={label}>Budget line</span>
            <select
              value={form.budgetLineId ?? ""}
              onChange={(e) => set("budgetLineId", e.target.value || null)}
              className={field}
            >
              <option value="">Unassigned</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.category || "General"}: {l.description || "Untitled line"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={label}>Status</span>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className={field}
            >
              {COST_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {COST_STATUS[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className={label}>Invoice number</span>
            <input
              value={form.invoiceNumber ?? ""}
              onChange={(e) => set("invoiceNumber", e.target.value || null)}
              placeholder="INV-0042"
              className={field}
            />
          </div>
          <div>
            <span className={label}>Invoice date</span>
            <input
              type="date"
              value={form.invoiceDate ?? ""}
              onChange={(e) => set("invoiceDate", e.target.value || null)}
              className={field}
            />
          </div>
          <div>
            <span className={label}>Due</span>
            <input
              type="date"
              value={form.dueDate ?? ""}
              onChange={(e) => set("dueDate", e.target.value || null)}
              className={field}
            />
          </div>
        </div>

        <div>
          <span className={label}>Invoice document</span>
          {attachment ? (
            <p className="rounded-[10px] border border-border bg-surface-2 px-2.5 py-2 text-xs text-text-muted">
              <span className="font-semibold text-text">{attachment.label}</span>{" "}
              will be filed against this cost when you save.
            </p>
          ) : (
          <>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => {
              // Read the FileList before clearing the input: it is a live view
              // of the selection, so clearing first empties it.
              const picked = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (!picked) return;
              if (picked.size > MAX_COST_DOC_BYTES) {
                toast("That file is too large (4MB max for an invoice).", "error");
                return;
              }
              setFile(picked);
              // The point of the feature: attach the invoice and the form
              // fills itself. Still a draft, still confirmed before saving.
              if (aiEnabled) void readInvoice(picked);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              {cost?.storage_path ? "Replace file" : "Attach a PDF or photo"}
            </Button>
            {file ? (
              <span className="text-xs text-text-muted">{file.name}</span>
            ) : cost?.file_name ? (
              <span className="text-xs text-text-muted">{cost.file_name} attached</span>
            ) : null}
            {aiEnabled && file && !reading && (
              <button
                type="button"
                onClick={() => void readInvoice(file)}
                className="text-xs font-semibold text-accent hover:underline"
              >
                Read it again
              </button>
            )}
          </div>
          {aiEnabled && !file && !cost?.storage_path && (
            <p className="mt-1 text-[11px] text-text-faint">
              Attach the invoice or estimate and the fields below fill
              themselves. You check them before saving.
            </p>
          )}

          {reading && (
            <div className="mt-2 flex items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-2.5 py-2 text-xs text-text-muted">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Reading the document...
            </div>
          )}

          {!reading && filled && (
            <div className="mt-2 rounded-[10px] border border-amber bg-amber-bg px-2.5 py-2 text-[11px] leading-relaxed text-amber">
              {filled.length === 0 ? (
                <span className="font-semibold">
                  Nothing could be read off that document. Fill the fields in by
                  hand.
                </span>
              ) : (
                <>
                  <span className="font-semibold">
                    Filled from the {docKind ?? "document"}: {filled.join(", ")}.
                  </span>{" "}
                  Check the total against the document before saving.
                  {docKind === "estimate" && (
                    <>
                      {" "}
                      This is an estimate, so it is what you are committing to,
                      not a bill yet.
                    </>
                  )}
                </>
              )}
              {before && (
                <button
                  type="button"
                  onClick={undoRead}
                  className="ml-1 font-semibold underline"
                >
                  Undo
                </button>
              )}
            </div>
          )}
          </>
          )}
        </div>

        <div>
          <span className={label}>Notes</span>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
            rows={2}
            className={`${field} resize-y`}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : cost ? "Save changes" : "Add cost"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
