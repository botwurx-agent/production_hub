"use server";

// Paying a vendor cost through BILL (bill.com).
//
// WHAT THIS REMOVES, in the operator's own words: "going into FreshBooks and
// having to add people as vendors each and every time and then processing the
// payment information is a bit of a lengthy process." So the chain is vendor,
// bill, payment, from a cost that is already on the budget, with nothing
// retyped.
//
// THE CONTRACT, which is the same one the remittance email and Runner's cards
// hold: NOTHING HAPPENS WITHOUT A DELIBERATE PRESS that named the vendor and
// the amount. There is no automatic send, no send on page load, and no retry
// loop. A payment that goes out twice cannot be recalled, so every guard here
// errs toward refusing.
//
// WHY THE BILL ID IS WRITTEN BEFORE THE PAYMENT IS ATTEMPTED: if the payment
// fails after the bill exists, a retry must not create a second bill. The
// record of what BILL already has is therefore saved at the first moment it
// is true, not at the end.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { allow } from "@/lib/rate-limit";
import {
  BillError,
  billConfigured,
  billSessionForStudio,
  createBillBill,
  createBillPayment,
  createBillVendor,
  findBillVendor,
  listBillFundingAccounts,
  readBillBill,
  type BillAddress,
  type BillFundingAccount,
} from "@/lib/bill";

type Fail = { error: string };

/** What the send window needs to show before anybody presses anything. */
export type BillPayContext = {
  connected: boolean;
  /** False until a 2-step code has been confirmed in Settings. */
  trusted: boolean;
  fundingAccounts: BillFundingAccount[];
  /** Set when the vendor already exists at BILL, so no address is asked for. */
  existingVendorId: string | null;
  existingVendorName: string | null;
};

/**
 * ADMINS ONLY, and stated rather than emergent. `bill_connections` is
 * admin-gated by RLS, so a plain member's read comes back empty and every
 * action here would have reported "BILL is not connected", which is false and
 * unfixable from the member's side. Paying a vendor is an admin-grade act
 * anyway, so the rule is made explicit and the message says which it is.
 */
async function requirePayer() {
  const ctx = await requireStudioContext();
  // project_costs is is_studio_member only, so a collaborator cannot see a
  // cost at all; refusing here states it rather than relying on an empty read.
  if (ctx.isCollaborator) return { ctx: null, error: "Not available on this account." as const };
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return {
      ctx: null,
      error: "Only studio admins can pay a bill through BILL." as const,
    };
  }
  return { ctx, error: null };
}

function readable(e: unknown, where: string): string {
  if (e instanceof BillError) return e.message;
  reportError(where, e);
  return e instanceof Error && e.message ? e.message : "Something went wrong reaching BILL.";
}

/** Money as BILL wants it: a number of dollars, rounded to cents. */
function cents(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Everything the send window needs, in one round trip: whether BILL can pay at
 * all, what it can pay from, and whether this vendor is already known to it.
 */
export async function billPayContext(
  projectId: string,
  costId: string
): Promise<BillPayContext | Fail> {
  const { ctx, error } = await requirePayer();
  if (!ctx) return { error };
  if (!billConfigured()) return { connected: false, trusted: false, fundingAccounts: [], existingVendorId: null, existingVendorName: null };

  const supabase = createClient();
  const { data: cost } = await supabase
    .from("project_costs")
    .select("id, vendor")
    .eq("id", costId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!cost) return { error: "That cost is no longer here." };

  try {
    const signed = await billSessionForStudio(supabase, ctx.studio.id);
    if (!signed) {
      return { connected: false, trusted: false, fundingAccounts: [], existingVendorId: null, existingVendorName: null };
    }
    // Both reads are independent, so they genuinely run together here: this is
    // the server, not the browser, where Next would queue them.
    const [funding, vendor] = await Promise.all([
      listBillFundingAccounts(signed.session),
      cost.vendor ? findBillVendor(signed.session, cost.vendor) : Promise.resolve(null),
    ]);
    return {
      connected: true,
      trusted: signed.session.trusted,
      fundingAccounts: funding,
      existingVendorId: vendor?.id ?? null,
      existingVendorName: vendor?.name ?? null,
    };
  } catch (e) {
    return { error: readable(e, "billPayContext") };
  }
}

/**
 * The whole chain for one cost. `pay` false stops after the bill exists, which
 * is the right shape for net-30: the bill is queued at BILL and somebody pays
 * it on its due date.
 */
export async function sendCostToBill(
  projectId: string,
  costId: string,
  opts: {
    pay: boolean;
    fundingAccountId?: string | null;
    /** Required only when the vendor is not already at BILL. */
    address?: BillAddress | null;
  }
): Promise<{ ok: true; billId: string; paid: boolean } | Fail> {
  const { ctx, error } = await requirePayer();
  if (!ctx) return { error };
  if (!billConfigured()) return { error: "BILL is not set up on this deployment." };

  // A payment is not something to allow in a tight loop, whatever the UI does.
  if (!allow(`billpay:${ctx.studio.id}`, 6, 60_000)) {
    return { error: "Too many payment attempts in a row. Wait a minute." };
  }

  const supabase = createClient();
  const { data: cost } = await supabase
    .from("project_costs")
    .select("*")
    .eq("id", costId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!cost) return { error: "That cost is no longer here." };

  // ONE COST, ONE BILL. A second send would create a duplicate at BILL, and a
  // duplicate bill is how a vendor gets paid twice.
  if (cost.bill_bill_id) {
    return {
      error:
        "This cost has already been sent to BILL. Open it there to pay or change it, rather than sending it again.",
    };
  }

  const amount = cents(cost.amount);
  if (amount <= 0) return { error: "A cost with no amount cannot be sent to BILL." };
  const vendorName = (cost.vendor ?? "").trim();
  if (!vendorName) return { error: "Give this cost a vendor name before sending it to BILL." };

  try {
    const signed = await billSessionForStudio(supabase, ctx.studio.id);
    if (!signed) return { error: "BILL is not connected. Connect it in Settings." };

    if (opts.pay && !signed.session.trusted) {
      return {
        error:
          "BILL will not let this session pay yet. Confirm a 2-step code once in Settings, then try again.",
      };
    }

    // The vendor: found, or created. SEPARATE CALLS under separate catches, so
    // a refusal says which one was refused rather than blaming the read for a
    // write that failed.
    let vendorId = cost.bill_vendor_id ?? null;
    let vendorSource: "existing" | "created" = "existing";
    if (!vendorId) {
      const found = await findBillVendor(signed.session, vendorName);
      vendorId = found?.id ?? null;
    }
    if (!vendorId) {
      if (!opts.address) {
        return {
          error: `${vendorName} is not a vendor at BILL yet, and BILL requires an address to add one.`,
        };
      }
      const made = await createBillVendor(signed.session, {
        name: vendorName,
        address: opts.address,
      });
      vendorId = made.id;
      vendorSource = "created";
    }

    const invoiceNumber = (cost.invoice_number ?? "").trim() || `SF-${costId.slice(0, 8)}`;
    const billId = await createBillBill(signed.session, {
      vendorId,
      amount,
      invoiceNumber,
      invoiceDate: (cost.invoice_date ?? "").slice(0, 10) || today(),
      dueDate: (cost.due_date ?? "").slice(0, 10) || today(),
      description: (cost.description ?? "").trim() || vendorName,
    });

    // WRITTEN NOW, before any payment is attempted. If the payment below fails
    // or this request dies, the bill still exists at BILL and this row is what
    // stops a retry creating a second one.
    const { error: linkError } = await supabase
      .from("project_costs")
      .update({
        bill_vendor_id: vendorId,
        bill_bill_id: billId,
        bill_status: "unpaid",
        bill_synced_at: new Date().toISOString(),
      })
      .eq("id", costId);
    if (linkError) {
      reportError("sendCostToBill/link", linkError);
      return {
        error: `The bill was created at BILL (id ${billId}) but saving that here failed. Do NOT send this cost again: open BILL and work from the bill that is already there.`,
      };
    }

    if (!opts.pay) {
      revalidatePath(`/projects/${projectId}/budget`);
      return { ok: true, billId, paid: false };
    }

    const fundingAccountId = (opts.fundingAccountId ?? "").trim();
    if (!fundingAccountId) {
      revalidatePath(`/projects/${projectId}/budget`);
      return {
        error:
          "The bill was added to BILL, but no bank account was chosen to pay it from, so nothing was paid.",
      };
    }

    const paymentId = await createBillPayment(signed.session, {
      vendorId,
      billId,
      amount,
      fundingAccountId,
      processDate: today(),
    });

    await supabase
      .from("project_costs")
      .update({
        bill_payment_id: paymentId,
        bill_status: "paid",
        bill_synced_at: new Date().toISOString(),
        // The cost's own status follows, since the money has left.
        status: "paid",
      })
      .eq("id", costId);

    revalidatePath(`/projects/${projectId}/budget`);
    void vendorSource;
    return { ok: true, billId, paid: true };
  } catch (e) {
    return { error: readable(e, "sendCostToBill") };
  }
}

/**
 * Read back what BILL says about this project's sent bills. A read only: it
 * never pays anything, which is what makes it safe to run when a page opens.
 */
export async function syncBillCosts(projectId: string): Promise<{ checked: number } | Fail> {
  const { ctx, error } = await requirePayer();
  if (!ctx) return { error };
  if (!billConfigured()) return { checked: 0 };

  const supabase = createClient();
  const { data: costs } = await supabase
    .from("project_costs")
    .select("id, bill_bill_id, bill_status")
    .eq("project_id", projectId)
    .not("bill_bill_id", "is", null);
  const open = (costs ?? []).filter((c) => c.bill_status !== "paid");
  if (!open.length) return { checked: 0 };

  try {
    const signed = await billSessionForStudio(supabase, ctx.studio.id);
    if (!signed) return { checked: 0 };
    let checked = 0;
    for (const c of open) {
      const state = await readBillBill(signed.session, c.bill_bill_id as string);
      if (!state) continue;
      checked += 1;
      const paid = /paid/i.test(state.paymentStatus) || state.dueAmount <= 0;
      if (!paid) continue;
      await supabase
        .from("project_costs")
        .update({ bill_status: "paid", status: "paid", bill_synced_at: new Date().toISOString() })
        .eq("id", c.id);
    }
    if (checked) revalidatePath(`/projects/${projectId}/budget`);
    return { checked };
  } catch (e) {
    return { error: readable(e, "syncBillCosts") };
  }
}
