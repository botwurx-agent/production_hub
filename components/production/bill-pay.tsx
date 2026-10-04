"use client";

// Paying a cost through BILL, from the budget's cost ledger.
//
// THE WINDOW IS THE POINT. What is being confirmed is a real payment to a real
// person, so it states every value that will be sent, in the words a producer
// uses, before anything happens: who, how much, against which invoice number,
// out of which bank account. A confirmation nobody can check in two seconds is
// not a confirmation, which is the rule this app already holds for Runner's
// cards and the remittance email.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  billPayContext,
  sendCostToBill,
  syncBillCosts,
  type BillPayContext,
} from "@/app/(app)/projects/[id]/bill-pay-actions";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/status-tag";
import { toast } from "@/components/ui/toast";
import { actionError } from "@/lib/action-result";
// exactMoney, not money(): lib/format's money() rounds to whole dollars, and
// this window states the figure that will leave a bank account, where the
// cents are the point. Same reason the remittance email uses it.
import { exactMoney } from "@/lib/remittance";
import { payRefused, railLabel, railWarning, type PayRail } from "@/lib/bill-payable";
import type { BillAddress as BillAddressInput } from "@/lib/bill";
import type { ProjectCost } from "@/lib/database.types";

/** Null when BILL is not connected: no pay controls appear at all. */
export type BillPayState = { connected: boolean; trusted: boolean };

const field =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-text-faint";

/** The small control on a cost row. */
export function BillPayControl({
  cost,
  onSend,
}: {
  cost: ProjectCost;
  onSend: () => void;
}) {
  if (cost.bill_bill_id) {
    const paid = cost.bill_status === "paid";
    return (
      <span
        title={paid ? "Paid through BILL" : "Added to BILL, not paid yet"}
        className="inline-flex items-center"
      >
        <StatusTag hue={paid ? "green" : "amber"}>{paid ? "BILL paid" : "At BILL"}</StatusTag>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onSend}
      title="Add this to BILL as a bill, and pay it"
      className="rounded-[7px] px-2 py-1 text-xs font-semibold text-text-faint transition hover:bg-surface-2 hover:text-text"
    >
      Pay via BILL
    </button>
  );
}

/**
 * Reads back what BILL says when the budget opens. A READ ONLY, which is what
 * makes it safe to run unattended: it can mark a cost paid, and it can never
 * pay one.
 */
export function BillSync({ projectId, openCount }: { projectId: string; openCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ran, setRan] = useState(false);

  useEffect(() => {
    if (ran || openCount === 0) return;
    setRan(true);
    // Quietly: nobody asked, so a toast on every page open would be noise.
    void syncBillCosts(projectId).then((r) => {
      if (!actionError(r) && (r as { checked: number }).checked) router.refresh();
    });
  }, [ran, openCount, projectId, router]);

  if (openCount === 0) return null;
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncBillCosts(projectId);
          const err = actionError(r);
          if (err) toast(err, "error");
          else {
            const n = (r as { checked: number }).checked;
            toast(n ? `Checked ${n} at BILL.` : "Nothing waiting at BILL.", "success");
            router.refresh();
          }
        })
      }
    >
      {pending ? "Checking..." : "Check BILL"}
    </Button>
  );
}

export function SendBillModal({
  projectId,
  cost,
  onClose,
}: {
  projectId: string;
  cost: ProjectCost;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ctx, setCtx] = useState<BillPayContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void billPayContext(projectId, cost.id).then((res) => {
      if (!alive) return;
      const err = actionError(res);
      if (err) setLoadError(err);
      else setCtx(res as BillPayContext);
    });
    return () => {
      alive = false;
    };
  }, [projectId, cost.id]);

  return (
    <SendBillBody
      cost={cost}
      ctx={ctx}
      loadError={loadError}
      pending={pending}
      onClose={onClose}
      onRun={(pay, fundingAccountId, address) =>
        start(async () => {
          const res = await sendCostToBill(projectId, cost.id, {
            pay,
            fundingAccountId: pay ? fundingAccountId : null,
            address,
          });
          const err = actionError(res);
          if (err) {
            toast(err, "error");
            router.refresh();
            return;
          }
          const done = res as { paid: boolean; notified: boolean };
          const vendor = (cost.vendor ?? "").trim();
          const notifyTo = ctx?.vendorEmail ?? null;
          // A FAILED REMITTANCE IS SAID OUT LOUD, because the payment
          // succeeded and the row will not show that half as missing: it just
          // stays unstamped. Naming it here is what sends the producer to the
          // mail button on the row.
          const toldThem = done.notified
            ? " They have been emailed."
            : notifyTo
              ? " The email to them did not send: use the mail button on the row."
              : "";
          toast(
            done.paid
              ? `Sent ${exactMoney(Number(cost.amount) || 0)} to ${vendor} through BILL.${toldThem}`
              : `${vendor} and this bill are now at BILL. Nothing has been paid.`,
            done.paid && notifyTo && !done.notified ? "error" : "success"
          );
          router.refresh();
          onClose();
        })
      }
    />
  );
}

/**
 * The window itself, SPLIT OUT AS PRESENTATIONAL so it can be driven in a
 * browser. A session that cannot reach Supabase or BILL can otherwise only
 * ever see "Checking with BILL..." and the failure state, which is how a
 * window that states what will happen to somebody's money ships unchecked.
 */
export function SendBillBody({
  cost,
  ctx,
  loadError,
  pending,
  onClose,
  onRun,
}: {
  cost: ProjectCost;
  ctx: BillPayContext | null;
  loadError: string | null;
  pending: boolean;
  onClose: () => void;
  onRun: (pay: boolean, fundingAccountId: string, address: BillAddressInput | null) => void;
}) {
  const [fundingId, setFundingId] = useState("");
  const [addr, setAddr] = useState({ line1: "", city: "", state: "", zip: "" });

  // One usable account is not a choice, so it is made.
  useEffect(() => {
    const usable = (ctx?.fundingAccounts ?? []).filter((f) => f.usable);
    if (usable.length === 1) setFundingId(usable[0].id);
  }, [ctx]);

  const amount = Number(cost.amount) || 0;
  const vendor = (cost.vendor ?? "").trim();
  const usable = (ctx?.fundingAccounts ?? []).filter((f) => f.usable);
  const needsAddress = Boolean(ctx && !ctx.existingVendorId);

  // HOW THE MONEY WOULD TRAVEL. A vendor that does not exist at BILL yet is a
  // known quantity rather than an unknown one: a freshly created vendor comes
  // back with no bank account and `payByType: CHECK`, observed on the real
  // account. So creating and paying in one press POSTS A CHEQUE, and saying
  // "BILL did not say" there would be worse than useless.
  const rail: PayRail = !ctx ? "unknown" : ctx.existingVendorId ? ctx.rail : "check";
  const refused = payRefused(rail);
  const warning = ctx ? railWarning(rail, vendor || "this vendor") : "";
  // Stated before the press, not discovered after it: paying emails this
  // person, and a window whose whole job is saying what will happen cannot
  // leave out the message it sends on somebody's behalf.
  const notifyTo = ctx?.vendorEmail ?? null;
  const addressDone =
    !needsAddress || Boolean(addr.line1.trim() && addr.city.trim() && addr.state.trim() && addr.zip.trim());

  function run(pay: boolean) {
    onRun(
      pay,
      fundingId,
      needsAddress
        ? {
            line1: addr.line1.trim(),
            city: addr.city.trim(),
            stateOrProvince: addr.state.trim(),
            zipOrPostalCode: addr.zip.trim(),
            country: "US",
          }
        : null
    );
  }

  return (
    <Modal open onClose={onClose} title="Pay through BILL" size="md">
      {loadError ? (
        <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm text-text">{loadError}</p>
      ) : !ctx ? (
        <p className="text-sm text-text-muted">Checking with BILL...</p>
      ) : !ctx.connected ? (
        <p className="rounded-[10px] bg-yellow-bg px-3 py-2 text-sm text-text">
          BILL is not connected. A studio admin can connect it in Settings.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Exactly what goes, before anything happens. */}
          <dl className="divide-y divide-border rounded-[12px] border border-border">
            <Row label="Vendor">
              {vendor}
              {ctx.existingVendorId ? (
                <span className="ml-2 text-xs text-text-faint">already at BILL</span>
              ) : (
                <span className="ml-2 text-xs text-text-faint">will be added to BILL</span>
              )}
            </Row>
            <Row label="Amount">{exactMoney(amount)}</Row>
            <Row label="Invoice">{(cost.invoice_number ?? "").trim() || "no number on the cost"}</Row>
            <Row label="Due">{(cost.due_date ?? "").slice(0, 10) || "today"}</Row>
            <Row label="Pays by">{railLabel(rail)}</Row>
          </dl>

          {warning && (
            // THE WORDS STAY IN THE TEXT COLOUR and the hue is carried by the
            // tint and the border, which is what ReadBanner concluded after
            // measuring: a hue on its own -bg tint is about 1.8:1, far below
            // AA for body type. Inline vars rather than Tailwind classes
            // because `border-red-border` and its kind DO NOT EXIST in this
            // setup and compile to nothing, which is the same silent class as
            // `bg-surface-2/50`.
            <p
              className="rounded-[10px] px-3 py-2 text-sm leading-relaxed text-text"
              style={{
                background: `var(--h-${refused ? "red" : "amber"}-bg)`,
                border: `1px solid var(--h-${refused ? "red" : "amber"})`,
              }}
            >
              {warning}
            </p>
          )}

          {needsAddress && (
            <div className="space-y-2 rounded-[12px] border border-border bg-surface-2 p-3">
              <p className="text-xs leading-relaxed text-text-muted">
                BILL needs an address to add a vendor. It is usually printed on
                their invoice. This is asked once per vendor, not per bill.
              </p>
              <input
                className={field}
                placeholder="Street address"
                value={addr.line1}
                onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  className={field}
                  placeholder="City"
                  value={addr.city}
                  onChange={(e) => setAddr({ ...addr, city: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="State"
                  value={addr.state}
                  onChange={(e) => setAddr({ ...addr, state: e.target.value })}
                />
                <input
                  className={field}
                  placeholder="ZIP"
                  value={addr.zip}
                  onChange={(e) => setAddr({ ...addr, zip: e.target.value })}
                />
              </div>
            </div>
          )}

          <div>
            <label className={label} htmlFor="bill-funding">
              Pay from
            </label>
            {usable.length === 0 ? (
              <p className="rounded-[10px] bg-yellow-bg px-3 py-2 text-sm text-text">
                {ctx.fundingAccounts.length === 0
                  ? "BILL has no bank account on this organization, so it cannot pay anything yet. Add one in BILL."
                  : "No bank account at BILL is verified yet, so it cannot pay anything. Finish verifying it in BILL."}{" "}
                You can still add the bill here and pay it there.
              </p>
            ) : (
              <select
                id="bill-funding"
                className={field}
                value={fundingId}
                onChange={(e) => setFundingId(e.target.value)}
              >
                <option value="">Choose an account</option>
                {usable.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {!ctx.trusted && (
            <p className="rounded-[10px] bg-yellow-bg px-3 py-2 text-sm text-text">
              BILL will not let this studio pay until a 2-step code is confirmed
              once, in Settings. Until then the bill can be added but not paid.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={pending || !addressDone}
              onClick={() => run(false)}
              title="Create the vendor and the bill at BILL, and pay it there later"
            >
              {pending ? "..." : "Just add the bill"}
            </Button>
            <Button
              disabled={pending || !addressDone || !fundingId || !ctx.trusted || refused}
              onClick={() => run(true)}
            >
              {pending ? "Sending..." : `Pay ${exactMoney(amount)}`}
            </Button>
          </div>
          <p className="text-right text-xs leading-relaxed text-text-faint">
            Paying sends money from the account above. It cannot be undone here.
            <br />
            {notifyTo
              ? `${vendor || "They"} will be emailed at ${notifyTo} to say the payment is on its way.`
              : "Nobody will be emailed: this cost has no contact with an email address."}
          </p>
        </div>
      )}
    </Modal>
  );
}

function Row({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-text-faint">{l}</dt>
      <dd className="min-w-0 truncate text-sm font-semibold text-text">{children}</dd>
    </div>
  );
}
