"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { MAX_DOCUMENT_BYTES } from "@/lib/upload-limits";
import { formatBytes } from "@/lib/attachment-limits";
import { uploadDirect } from "@/components/upload/direct-upload";
import { compressImage } from "@/lib/compress-image";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import {
  addCost,
  updateCost,
  deleteCost,
  setCostStatus,
  attachCostDoc,
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
import {
  FreshbooksBillControl,
  FreshbooksSync,
  SendBillModal,
  openBill,
  type FreshbooksState,
} from "@/components/production/freshbooks-bill";
import type { DocumentKind } from "@/lib/invoice-draft";
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

/**
 * How a photographed document is shrunk BEFORE it is sent to be read.
 *
 * Deliberately gentler than the app's default compression (2400px at 0.82):
 * this is a document whose small print is the whole point, not a thumbnail.
 * Only the COPY sent to the model is compressed, never the file that gets
 * attached, so the studio keeps the receipt it photographed.
 *
 * MEASURED in Chromium against generated receipt photographs carrying sensor
 * grain, since grain is what makes a camera JPEG big and a clean synthetic
 * image would flatter this: a 12MP camera JPEG goes 4,924KB to 1,195KB and a
 * 48MP one 18,945KB to 1,219KB, both about a third of the read ceiling. A file
 * already under 3MB is sent untouched, because it fits as it is and
 * re-encoding it would only lose detail.
 */
const READ_COMPRESSION = {
  maxEdge: 2600,
  quality: 0.85,
  skipUnderBytes: 3_000_000,
};

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
  freshbooks,
}: {
  projectId: string;
  costs: ProjectCost[];
  lines: BudgetLine[];
  roster: RosterOption[];
  payments: CostPayment[];
  /** Computed on the server, so overdue cannot differ after hydration. */
  todayIso: string;
  /** Null when FreshBooks is not connected: no pay-via controls at all. */
  freshbooks: FreshbooksState | null;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<ProjectCost | "new" | null>(null);
  const [openSchedule, setOpenSchedule] = useState<string | null>(null);
  const [billing, setBilling] = useState<ProjectCost | null>(null);
  const openBills = costs.filter(openBill).length;
  // A vendor invoice dropped on the ledger. It opens the add-a-cost form with
  // the document attached, which is what makes the AI read fire: filing an
  // invoice with no amount, vendor or budget line would not be a cost.
  const [dropped, setDropped] = useState<File | null>(null);

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
        }? The attached document is deleted too.${
          cost.fb_bill_id
            ? " Its bill stays in FreshBooks; delete it there as well if it is not going to be paid."
            : ""
        }`
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
    <FileDropzone
      accept=".pdf,image/*"
      multiple={false}
      maxBytes={MAX_DOCUMENT_BYTES}
      onTooLarge={() =>
        toast(
          `That file is too large (${formatBytes(MAX_DOCUMENT_BYTES)} max).`,
          "error"
        )
      }
      onFiles={(files) => {
        setDropped(files[0]);
        setEditing("new");
      }}
      label="Drop an invoice or a receipt to log a cost"
      // ONE WAY IN. The page used to show this dashed panel AND an "Add a
      // cost" button, two controls for the same form that read as two
      // different jobs. The panel moved inside that form, where it is the
      // first thing you see; dropping a file anywhere on the page still
      // opens the form with it attached, as a shortcut.
      browse={false}
      disabled={Boolean(editing)}
    >
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-text">Costs</h3>
          <p className="text-xs text-text-muted">
            {costs.length === 0
              ? "Invoices, receipts and everything else this job spent, rolled up into the actuals above."
              : `${costs.length} ${costs.length === 1 ? "cost" : "costs"}, ${money.format(totals.all)} total${
                  totals.outstanding > 0
                    ? `, ${money.format(totals.outstanding)} still owed`
                    : ", all paid"
                }.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {freshbooks && (
            <FreshbooksSync projectId={projectId} openCount={openBills} />
          )}
          <Button size="sm" onClick={() => setEditing("new")}>
            + Add a cost
          </Button>
        </div>
      </div>

      {costs.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-border py-8 text-center text-sm text-text-faint">
          No costs logged yet. Add a cost from an invoice, a photo of a receipt,
          or by hand, to start the running tab.
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
                {freshbooks && (c.fb_bill_id || summary.owed > 0) && (
                  <FreshbooksBillControl cost={c} onSend={() => setBilling(c)} />
                )}
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

      {billing && freshbooks && (
        <SendBillModal
          projectId={projectId}
          cost={billing}
          state={freshbooks}
          onClose={() => setBilling(null)}
        />
      )}

      {editing && (
        <CostModal
          projectId={projectId}
          cost={editing === "new" ? null : editing}
          lines={lines}
          roster={roster}
          initialFile={dropped}
          onClose={() => {
            setEditing(null);
            setDropped(null);
          }}
        />
      )}
    </div>
    </FileDropzone>
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
      title={name ?? "Open the document"}
      className="grid h-7 w-7 place-items-center rounded-[7px] text-text-muted transition hover:bg-surface-2 hover:text-accent"
      aria-label="Open the attached document"
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
  initialDocKind,
  attachment,
  initialFile = null,
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
   * What that draft's document called itself, so a read done elsewhere says
   * the same thing in the same banner as one done here. The two ways in have
   * to behave identically or they quietly diverge.
   */
  initialDocKind?: DocumentKind | null;
  /**
   * An invoice that already exists somewhere else (a Gmail attachment), filed
   * against the cost once it saves. Replaces the file picker: there is nothing
   * for the producer to choose.
   */
  attachment?: {
    label: string;
    attach: (costId: string) => Promise<{ error: string } | { ok: true }>;
  };
  /** An invoice dropped on the ledger, already attached when the form opens. */
  initialFile?: File | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CostInput>(
    cost ? toInput(cost) : (initial ?? emptyCost())
  );
  const [file, setFile] = useState<File | null>(initialFile);
  const [saving, setSaving] = useState(false);
  // A new cost starts at the DOCUMENT, because most costs arrive as one.
  // "Enter it by hand" is the way past it, not a second button on the page.
  const [manual, setManual] = useState(false);
  const choosing = !cost && !attachment && !initial && !file && !manual;
  const fileRef = useRef<HTMLInputElement>(null);
  const aiEnabled = useAiEnabled();

  // Extraction is a DRAFT: it fills the form and says so, and never saves.
  // `before` holds the pre-extraction values so a bad read is one click to
  // undo, the same contract as the composer's Polish button.
  const [reading, setReading] = useState(false);
  const [filled, setFilled] = useState<string[] | null>(initialFilled ?? null);
  const [before, setBefore] = useState<CostInput | null>(null);
  // What the document called itself. An estimate is a commitment rather than a
  // bill and a receipt is money already gone, so the banner names which it
  // read instead of calling all three an invoice.
  const [docKind, setDocKind] = useState<DocumentKind | null>(
    initialDocKind ?? null
  );

  // Dropped and picked have to behave identically, or the two ways in quietly
  // do different things. Once only.
  const autoRead = useRef(false);
  useEffect(() => {
    if (autoRead.current || !initialFile) return;
    autoRead.current = true;
    if (aiEnabled) void readInvoice(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  async function readInvoice(f: File) {
    // TWO DIFFERENT CEILINGS. ATTACHING is a direct upload with no function in
    // the path, so a big scan is fine. READING sends the bytes through a
    // Server Action, so it is still bound by the ~4.5MB request body, past
    // which the request dies at the platform edge with nothing to report.
    //
    // The check is HERE rather than at the call sites because there are three
    // of them: a pick, a drop, and the "Read it again" button.
    //
    // A PHOTOGRAPHED RECEIPT WOULD FAIL THAT CEILING ON EVERY CURRENT PHONE,
    // which is the one device it is most useful on: a 12MP camera JPEG is
    // around 5MB, so the feature would refuse to read exactly the document it
    // was built for. So a COPY is compressed for the read. The original is
    // still what gets attached, because the receipt is the studio's own record
    // of the spend and there is nothing to gain from keeping a smaller one.
    const forReading = await compressImage(f, READ_COMPRESSION);
    if (forReading.size > MAX_COST_DOC_BYTES) {
      toast(
        `Attached. It is too big to read automatically (over ${formatBytes(
          MAX_COST_DOC_BYTES
        )}), so fill the amount in by hand.`,
        "info"
      );
      return;
    }
    setReading(true);
    setFilled(null);
    const fd = new FormData();
    fd.set("file", forReading);
    const res = await extractInvoiceDraft(projectId, fd);
    setReading(false);
    if ("error" in res) {
      toast(res.error, "error");
      return;
    }
    const { draft, contactId, vendorMatch } = res;
    setBefore(form);
    setDocKind(draft.documentKind);

    // Built OUTSIDE the state updater. React can call an updater more than
    // once for a single change, and does exactly that in development, so
    // pushing into a list from inside it names every filled field twice.
    const got: string[] = [];
    const patch: Partial<CostInput> = {};
    if (draft.vendor) {
      patch.vendor = draft.vendor;
      got.push("vendor");
    }
    if (draft.description) {
      patch.description = draft.description;
      got.push("description");
    }
    if (draft.amount !== null) {
      patch.amount = draft.amount;
      got.push("amount");
    }
    if (draft.days !== null) {
      patch.days = draft.days;
      got.push("days billed");
    }
    if (draft.invoiceNumber) {
      patch.invoiceNumber = draft.invoiceNumber;
      got.push("number");
    }
    if (draft.invoiceDate) {
      patch.invoiceDate = draft.invoiceDate;
      got.push("date");
    }
    if (draft.dueDate) {
      patch.dueDate = draft.dueDate;
      got.push("due date");
    }
    if (draft.budgetLineId) {
      patch.budgetLineId = draft.budgetLineId;
      got.push("budget line");
    }
    if (draft.notes) patch.notes = draft.notes;
    // A RECEIPT IS ALREADY SPENT. Money handed over at a till is not money the
    // studio still owes, and leaving it on the default "received" would make
    // the budget's "still owed" tile and the dashboard's unpaid-invoice widget
    // chase the producer for what they paid at the counter.
    if (draft.documentKind === "receipt") {
      patch.status = "paid";
      got.push("status (paid)");
    }
    if (contactId) {
      patch.contactId = contactId;
      // The matched roster name wins over the letterhead: a bill routed
      // through a rep says "REDEYE Reps" while the studio files the cost
      // under the stylist it booked.
      if (vendorMatch) patch.vendor = vendorMatch;
      got.push(`roster match (${vendorMatch})`);
    }
    setForm((prev) => ({ ...prev, ...patch }));
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

  // The picker, the drop panel and a drop onto the open form all land here,
  // so the three ways of handing over a document cannot behave differently.
  function acceptFile(picked: File) {
    if (picked.size > MAX_DOCUMENT_BYTES) {
      toast(
        `That file is ${formatBytes(picked.size)}, over the ${formatBytes(
          MAX_DOCUMENT_BYTES
        )} limit.`,
        "error"
      );
      return;
    }
    setFile(picked);
    // The point of the feature: attach the invoice and the form fills itself.
    // Still a draft, still confirmed before saving.
    if (aiEnabled) void readInvoice(picked);
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
      // Straight to Storage under a server-minted ticket, so a multi-page
      // scanned invoice is not capped at the 4MB a Server Action can carry.
      const up = await uploadDirect({ kind: "cost", projectId }, file)
        .then((d) => attachCostDoc(projectId, id, d.path, file.name))
        .catch((e) => ({ error: e instanceof Error ? e.message : "Upload failed." }));
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

  if (choosing) {
    return (
      <Modal open onClose={onClose} title="Add a cost" size="lg">
        <FileDropzone
          accept=".pdf,image/*"
          multiple={false}
          label="Drop to attach it to this cost"
          browse={{ text: "Drop an invoice, an estimate or a receipt" }}
          hint={
            aiEnabled
              ? "A PDF or a photo. The vendor, amount and date are read for you, and you check them before saving."
              : "A PDF or a photo. It is kept with the cost when you save."
          }
          chooseLabel="Choose a file or take a photo"
          onFiles={(files) => acceptFile(files[0])}
          onTooLarge={(files) =>
            toast(
              `That file is ${formatBytes(files[0].size)}, over the ${formatBytes(
                MAX_DOCUMENT_BYTES
              )} limit.`,
              "error"
            )
          }
          maxBytes={MAX_DOCUMENT_BYTES}
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setManual(true)}
              className="text-sm font-semibold text-accent hover:underline"
            >
              No document? Enter it by hand
            </button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </FileDropzone>
      </Modal>
    );
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
              placeholder="Who sent the invoice, or the shop"
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
            <span className={label}>Number</span>
            <input
              value={form.invoiceNumber ?? ""}
              onChange={(e) => set("invoiceNumber", e.target.value || null)}
              placeholder="INV-0042"
              className={field}
            />
          </div>
          <div>
            <span className={label}>Date</span>
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
          <span className={label}>Document</span>
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
              if (picked) acceptFile(picked);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              {cost?.storage_path ? "Replace file" : "Attach a PDF or a photo"}
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
              Attach an invoice, an estimate or a receipt and the fields above
              fill themselves. You check them before saving. On a phone this
              offers the camera, so a receipt can be photographed on the way
              out of the shop.
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
                  {docKind === "receipt" && (
                    <>
                      {" "}
                      This is a receipt, so it is money already spent and is
                      logged as paid rather than as still owed.
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
