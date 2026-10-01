"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import {
  getBillCategories,
  sendCostToFreshbooks,
  syncFreshbooksBills,
} from "@/app/(app)/projects/[id]/freshbooks-bill-actions";
import { FRESHBOOKS_BILLS_URL } from "@/lib/freshbooks";
import type { ProjectCost } from "@/lib/database.types";

// Paying a vendor through FreshBooks Bill Pay, from the budget.
//
// The split is set by what FreshBooks' API allows: we can create a bill and
// read whether it was paid, never pay it. So the studio does the work here,
// sends the cost across, presses Pay on FreshBooks' own screen, and the cost
// flips to paid here on its own the next time the budget is opened.

export type FreshbooksState = { connected: boolean; needsReconnect: boolean };

const CATEGORY_KEY = "freshbooks.billCategory";

const moneyExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function readCategory(): string | null {
  try {
    return localStorage.getItem(CATEGORY_KEY);
  } catch {
    return null;
  }
}
function saveCategory(id: string) {
  try {
    localStorage.setItem(CATEGORY_KEY, id);
  } catch {
    /* a remembered default is a convenience, not state */
  }
}

/** A cost that is in FreshBooks but not yet paid there. */
export function openBill(c: ProjectCost): boolean {
  return Boolean(c.fb_bill_id) && c.fb_bill_status !== "paid";
}

const STATUS: Record<string, { label: string; hue: string }> = {
  unpaid: { label: "In FreshBooks", hue: "blue" },
  overdue: { label: "Overdue in FreshBooks", hue: "red" },
  partial: { label: "Part paid in FreshBooks", hue: "amber" },
  paid: { label: "Paid in FreshBooks", hue: "green" },
};

/** The row control: a send button before, a status link after. */
export function FreshbooksBillControl({
  cost,
  onSend,
}: {
  cost: ProjectCost;
  onSend: () => void;
}) {
  if (!cost.fb_bill_id) {
    return (
      <button
        onClick={onSend}
        title="Send to FreshBooks to pay"
        className="rounded-[7px] px-2 py-1 text-xs font-semibold text-text-faint transition hover:bg-surface-2 hover:text-accent"
      >
        Pay via FB
      </button>
    );
  }
  const s = STATUS[cost.fb_bill_status ?? "unpaid"] ?? STATUS.unpaid;
  return (
    <a
      href={FRESHBOOKS_BILLS_URL}
      target="_blank"
      rel="noreferrer"
      title="Open your bills in FreshBooks"
      className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-bold transition hover:opacity-80"
      style={{ background: `var(--h-${s.hue}-bg)`, color: `var(--h-${s.hue})` }}
    >
      FB
      <span className="font-semibold">
        {cost.fb_bill_status === "paid" ? "paid" : cost.fb_bill_status ?? "sent"}
      </span>
    </a>
  );
}

/**
 * Reads open bills back once when the budget opens, so paying in FreshBooks
 * and returning is all it takes. Also a manual button, for someone who pays
 * with the budget still open in another tab.
 */
export function FreshbooksSync({
  projectId,
  openCount,
}: {
  projectId: string;
  openCount: number;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const ran = useRef(false);

  function run(quiet: boolean) {
    start(async () => {
      const res = await syncFreshbooksBills(projectId);
      if ("error" in res) {
        if (!quiet) toast(res.error, "error");
        return;
      }
      if (res.newlyPaid > 0) {
        toast(
          `${res.newlyPaid} ${res.newlyPaid === 1 ? "bill was" : "bills were"} paid in FreshBooks. Marked paid here.`,
          "success",
        );
        router.refresh();
      } else if (!quiet) {
        toast(
          res.failed > 0
            ? `Could not read ${res.failed} of ${res.checked} bills from FreshBooks.`
            : "Nothing new: FreshBooks still shows these as unpaid.",
          res.failed > 0 ? "error" : "info",
        );
        router.refresh();
      }
    });
  }

  useEffect(() => {
    if (ran.current || openCount === 0) return;
    ran.current = true;
    run(true);
    // Once per page load; openCount only decides whether there is anything to ask.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCount]);

  if (openCount === 0) return null;
  return (
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(false)}>
      {busy ? "Checking..." : "Check FreshBooks"}
    </Button>
  );
}

export function SendBillModal({
  projectId,
  cost,
  state,
  onClose,
}: {
  projectId: string;
  cost: ProjectCost;
  state: FreshbooksState;
  onClose: () => void;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: string; name: string }[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (state.needsReconnect) return;
    let live = true;
    getBillCategories().then((res) => {
      if (!live) return;
      if ("error" in res) {
        setLoadError(res.error);
        return;
      }
      setCategories(res.categories);
      const remembered = readCategory();
      const pick =
        res.categories.find((c) => c.id === remembered) ??
        res.categories.find((c) => /contract|subcontract|professional/i.test(c.name)) ??
        res.categories[0];
      if (pick) setCategoryId(pick.id);
    });
    return () => {
      live = false;
    };
  }, [state.needsReconnect]);

  const amount = Number(cost.amount) || 0;
  const missing = !cost.vendor.trim()
    ? "Add the vendor's name to this cost first."
    : amount <= 0
      ? "Add the amount to this cost first."
      : null;

  function send() {
    start(async () => {
      const res = await sendCostToFreshbooks(projectId, cost.id, categoryId);
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      saveCategory(categoryId);
      setSent(true);
      router.refresh();
    });
  }

  const rows: [string, string][] = [
    ["Vendor", cost.vendor || "Missing"],
    ["Amount", moneyExact.format(amount)],
    ["Bill number", cost.invoice_number || "None"],
    ["Invoice date", cost.invoice_date || "Today"],
    ["Due", cost.due_date || "FreshBooks default"],
  ];

  return (
    <Modal open onClose={onClose} title={sent ? "Bill sent to FreshBooks" : "Pay this cost in FreshBooks"}>
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-text">
            {cost.vendor}&apos;s bill for {moneyExact.format(amount)} is in FreshBooks.
            Pay it there, then come back to this budget: it checks FreshBooks when it
            opens and marks the cost paid.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
            <a
              href={FRESHBOOKS_BILLS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-[11px] bg-accent px-4 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
            >
              Open FreshBooks bills
            </a>
          </div>
        </div>
      ) : state.needsReconnect ? (
        <div className="space-y-4">
          <p className="text-sm text-text">
            FreshBooks is connected, but before paying bills was possible. Reconnect
            it once to allow bills, then come back here.
          </p>
          <div className="flex justify-end">
            <a
              href="/settings"
              className="inline-flex h-10 items-center rounded-[11px] bg-accent px-4 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
            >
              Go to Settings
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            This creates a bill in FreshBooks. Nothing is paid until you press Pay
            there.
          </p>
          <dl className="divide-y divide-border rounded-[12px] border border-border">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-3 py-2 text-sm">
                <dt className="text-text-muted">{k}</dt>
                <dd className="text-right font-semibold text-text">{v}</dd>
              </div>
            ))}
          </dl>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-text-faint">
              FreshBooks expense category
            </label>
            {loadError ? (
              <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm text-red">{loadError}</p>
            ) : categories === null ? (
              <p className="text-sm text-text-faint">Loading from FreshBooks...</p>
            ) : (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-border-strong"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {missing && <p className="text-sm font-medium text-red">{missing}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={send}
              disabled={busy || !categoryId || Boolean(missing) || Boolean(loadError)}
            >
              {busy ? "Sending..." : "Send to FreshBooks"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
