"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  addPayment,
  scheduleDeposit,
  setPaymentPaid,
  deletePayment,
} from "@/app/(app)/projects/[id]/cost-actions";
import { depositSplit, type PaymentSummary } from "@/lib/costs";
import type { CostPayment } from "@/lib/database.types";

const moneyExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const field =
  "w-full rounded-[8px] border border-border bg-surface px-2 py-1 text-sm text-text outline-none transition focus:border-border-strong";

/** Dates are plain YYYY-MM-DD, parsed as UTC so no timezone shifts a day. */
function fmtDay(iso: string | null): string {
  if (!iso) return "no date";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "no date";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function isOverdue(due: string | null, todayIso: string): boolean {
  return due !== null && due < todayIso;
}

/**
 * The payments made and still owed against one cost. A vendor asking for a
 * deposit up front and the balance on delivery is one commitment paid in
 * parts, which a single amount plus a status chip cannot express.
 */
export function PaymentSchedule({
  projectId,
  costId,
  committed,
  payments,
  summary,
  todayIso,
}: {
  projectId: string;
  costId: string;
  committed: number;
  payments: CostPayment[];
  summary: PaymentSummary;
  todayIso: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [splitting, setSplitting] = useState(false);

  function togglePaid(p: CostPayment) {
    start(async () => {
      const res = await setPaymentPaid(projectId, p.id, !p.paid_at);
      if ("error" in res) toast(res.error, "error");
      router.refresh();
    });
  }

  function remove(p: CostPayment) {
    start(async () => {
      await deletePayment(projectId, p.id);
      router.refresh();
    });
  }

  return (
    <div className="mt-2 rounded-[10px] border border-border bg-surface-2 p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
          Payment schedule
        </span>
        <span className="text-[11px] tabular-nums text-text-muted">
          {moneyExact.format(summary.paid)} paid of{" "}
          {moneyExact.format(summary.committed)}
          {summary.owed > 0 && (
            <span className="font-semibold text-text">
              {" · "}
              {moneyExact.format(summary.owed)} owed
            </span>
          )}
        </span>
      </div>

      {payments.length > 0 && (
        <ul className="mb-2 space-y-1">
          {payments.map((p) => {
            const paid = Boolean(p.paid_at);
            const late = !paid && isOverdue(p.due_date, todayIso);
            return (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-[8px] bg-surface px-2 py-1.5"
              >
                <button
                  onClick={() => togglePaid(p)}
                  disabled={busy}
                  title={paid ? "Mark as not sent" : "Mark as sent"}
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition ${
                    paid
                      ? "border-green bg-green text-white"
                      : "border-border-strong hover:border-green"
                  }`}
                  aria-label={paid ? "Mark as not sent" : "Mark as sent"}
                >
                  {paid && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
                <span className="min-w-0 flex-1 truncate text-xs text-text">
                  {p.label || "Payment"}
                </span>
                <span
                  className={`shrink-0 text-[11px] ${
                    late ? "font-semibold text-red" : "text-text-faint"
                  }`}
                >
                  {paid ? "sent" : `due ${fmtDay(p.due_date)}`}
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-text">
                  {moneyExact.format(Number(p.amount) || 0)}
                </span>
                <button
                  onClick={() => remove(p)}
                  disabled={busy}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] text-text-faint transition hover:bg-red-bg hover:text-red"
                  aria-label="Delete payment"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* A schedule that does not add up to the commitment is stated rather
          than left for the producer to notice. */}
      {summary.unscheduled > 0.005 && (
        <p className="mb-2 rounded-[8px] border border-amber bg-amber-bg px-2 py-1 text-[11px] text-amber">
          {moneyExact.format(summary.unscheduled)} of this cost is not on the
          schedule yet.
        </p>
      )}

      {splitting ? (
        <DepositSplitForm
          projectId={projectId}
          costId={costId}
          committed={committed}
          onDone={() => setSplitting(false)}
        />
      ) : adding ? (
        <AddPaymentForm
          projectId={projectId}
          costId={costId}
          suggested={summary.unscheduled > 0 ? summary.unscheduled : 0}
          onDone={() => setAdding(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAdding(true)}
            className="text-[11px] font-semibold text-accent hover:underline"
          >
            + Add a payment
          </button>
          <button
            onClick={() => setSplitting(true)}
            className="text-[11px] font-semibold text-accent hover:underline"
          >
            {payments.length > 0 ? "Rebuild as deposit + balance" : "Deposit + balance"}
          </button>
        </div>
      )}
    </div>
  );
}

/** The vendor's own words: "25% up front, balance on delivery". */
function DepositSplitForm({
  projectId,
  costId,
  committed,
  onDone,
}: {
  projectId: string;
  costId: string;
  committed: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [percent, setPercent] = useState(25);
  const [depositDue, setDepositDue] = useState("");
  const [balanceDue, setBalanceDue] = useState("");
  const [depositPaid, setDepositPaid] = useState(false);

  const preview = depositSplit(committed, percent);

  function save() {
    start(async () => {
      const res = await scheduleDeposit(projectId, costId, {
        percent,
        depositDue: depositDue || null,
        balanceDue: balanceDue || null,
        depositPaid,
      });
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-[8px] bg-surface p-2.5">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[11px] font-semibold text-text-muted">
          Deposit %
          <input
            type="number"
            min="1"
            max="99"
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value) || 0)}
            className={`${field} mt-0.5 tabular-nums`}
          />
        </label>
        <label className="text-[11px] font-semibold text-text-muted">
          Deposit due
          <input
            type="date"
            value={depositDue}
            onChange={(e) => setDepositDue(e.target.value)}
            className={`${field} mt-0.5`}
          />
        </label>
        <label className="text-[11px] font-semibold text-text-muted">
          Balance due
          <input
            type="date"
            value={balanceDue}
            onChange={(e) => setBalanceDue(e.target.value)}
            className={`${field} mt-0.5`}
          />
        </label>
      </div>

      {preview ? (
        <p className="text-[11px] text-text-muted">
          {moneyExact.format(preview.deposit)} deposit, then{" "}
          {moneyExact.format(preview.balance)} balance.
        </p>
      ) : (
        <p className="text-[11px] text-amber">
          Set the cost amount first, and a deposit between 1 and 99 percent.
        </p>
      )}

      <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
        <input
          type="checkbox"
          checked={depositPaid}
          onChange={(e) => setDepositPaid(e.target.checked)}
        />
        The deposit has already been sent
      </label>

      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={busy || !preview}>
          {busy ? "Saving..." : "Build schedule"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
      <p className="text-[11px] text-text-faint">
        This replaces any payments already on this cost.
      </p>
    </div>
  );
}

function AddPaymentForm({
  projectId,
  costId,
  suggested,
  onDone,
}: {
  projectId: string;
  costId: string;
  suggested: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(suggested || 0);
  const [dueDate, setDueDate] = useState("");
  const [paid, setPaid] = useState(false);

  function save() {
    if (!(amount > 0)) {
      toast("Enter an amount.", "error");
      return;
    }
    start(async () => {
      const res = await addPayment(projectId, costId, {
        label: label || "Payment",
        amount,
        dueDate: dueDate || null,
        paid,
        method: null,
        notes: null,
      });
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-[8px] bg-surface p-2.5">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-[11px] font-semibold text-text-muted">
          Label
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Deposit"
            className={`${field} mt-0.5`}
          />
        </label>
        <label className="text-[11px] font-semibold text-text-muted">
          Amount
          <input
            type="number"
            step="0.01"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className={`${field} mt-0.5 text-right tabular-nums`}
          />
        </label>
        <label className="text-[11px] font-semibold text-text-muted">
          Due
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={`${field} mt-0.5`}
          />
        </label>
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
        <input
          type="checkbox"
          checked={paid}
          onChange={(e) => setPaid(e.target.checked)}
        />
        Already sent
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving..." : "Add payment"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
