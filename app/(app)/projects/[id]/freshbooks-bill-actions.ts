"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { getBillingAccount, getFreshbooksAuth } from "@/lib/billing";
import {
  billIsPaid,
  createBill,
  findOrCreateVendor,
  FreshbooksError,
  getBill,
  hasBillScopes,
  listExpenseCategories,
  type FbCategory,
} from "@/lib/freshbooks";
import { freshbooksFailure } from "@/lib/freshbooks-error";
import { logWrite, reportError } from "@/lib/log";

// Hand a cost to FreshBooks to be PAID, and learn when it was.
//
// The shape of the whole feature is set by one API fact: FreshBooks can create
// a bill and report its status, and cannot initiate a payment. So the studio
// does the work here (the invoice is read, filed against a budget line, rate
// checked), sends it across as a bill, presses Pay on FreshBooks' own screen,
// and the budget reads the result back. Nothing here ever moves money.
//
// project_costs is is_studio_member only, and every action starts with
// requireStudioContext, so a project collaborator is refused twice.

const RECONNECT =
  "FreshBooks needs one reconnect to allow bills. Settings, Connections, Reconnect.";

type Ready =
  | { error: string }
  | { token: string; accountId: string };

async function freshbooks(): Promise<Ready> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Not available on this project." };
  const supabase = createClient();
  const account = await getBillingAccount(supabase, ctx.studio.id);
  if (!account) return { error: "Connect FreshBooks in Settings first." };
  if (!hasBillScopes(account.scope)) return { error: RECONNECT };
  try {
    return await getFreshbooksAuth(supabase, account);
  } catch (e) {
    reportError("freshbooks.auth", e);
    return { error: "FreshBooks sign-in has expired. Reconnect it in Settings." };
  }
}

/**
 * What went wrong, in words the producer can act on.
 *
 * THIS USED TO ANSWER "RECONNECT" FOR BOTH 401 AND 403, which is a loop with
 * no exit on a 403: the call was authenticated, reconnecting changes nothing,
 * and the same message comes back next time. It is the bug the operator hit on
 * the first real bill. lib/freshbooks-error.ts splits the two and quotes
 * FreshBooks' own reason, which was previously only reaching Sentry, and
 * Sentry is inert here.
 *
 * `what` is the verb phrase for the call being made, so a screenshot of the
 * toast says which step failed. It does not name FreshBooks: every sentence
 * these go into already starts with it.
 */
function readable(e: unknown, what: string): string {
  if (e instanceof FreshbooksError) {
    return freshbooksFailure(e.status, e.body, what);
  }
  return `Could not ${what}. ${e instanceof Error ? e.message : "Unknown error."}`.trim();
}

/** The expense categories a bill line can be filed under. Loaded when the send
 * window opens, not with the page, so the budget never waits on FreshBooks. */
export async function getBillCategories(): Promise<
  { error: string } | { categories: FbCategory[] }
> {
  const fb = await freshbooks();
  if ("error" in fb) return fb;
  try {
    const categories = await listExpenseCategories(fb.accountId, fb.token);
    if (categories.length === 0) {
      return { error: "FreshBooks returned no expense categories." };
    }
    return { categories };
  } catch (e) {
    reportError("freshbooks.categories", e);
    return { error: readable(e, "load your expense categories") };
  }
}

export async function sendCostToFreshbooks(
  projectId: string,
  costId: string,
  categoryId: string,
): Promise<
  | { error: string }
  | { ok: true; vendorCreated: boolean; status: string | null }
> {
  if (!/^\d+$/.test(categoryId)) return { error: "Pick a category." };
  const fb = await freshbooks();
  if ("error" in fb) return fb;
  const supabase = createClient();

  const { data: cost } = await supabase
    .from("project_costs")
    .select("id, project_id, vendor, description, amount, invoice_number, invoice_date, due_date, fb_bill_id")
    .eq("id", costId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!cost) return { error: "That cost is gone." };
  // One cost, one bill. A second send would ask FreshBooks to pay it twice.
  if (cost.fb_bill_id) return { error: "This cost is already in FreshBooks." };
  const vendor = cost.vendor.trim();
  if (!vendor) return { error: "Add the vendor's name before sending." };
  // numeric arrives from PostgREST as a string.
  const amount = Number(cost.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Add the amount before sending." };
  }

  const issueDate = cost.invoice_date || new Date().toISOString().slice(0, 10);

  // THE VENDOR AND THE BILL ARE CAUGHT SEPARATELY, so a refusal names which
  // one. They are different FreshBooks features behind different scopes
  // (bill_vendors and bills), and when the first real send was refused there
  // was no way to tell which had said no: one catch reported both as "the
  // bill". The expense categories load through a third, and that one is known
  // to work, since the send button is not enabled until it has.
  let vendorCreated = false;
  let vendorId: string;
  try {
    const v = await findOrCreateVendor(fb.accountId, fb.token, vendor);
    vendorCreated = v.created;
    vendorId = v.vendorId;
  } catch (e) {
    reportError(`freshbooks.vendor ${costId}`, e);
    return { error: `${readable(e, "look this vendor up")} Nothing was sent.` };
  }

  let bill;
  try {
    bill = await createBill(fb.accountId, fb.token, {
      vendorId,
      categoryId,
      issueDate,
      dueDate: cost.due_date,
      billNumber: cost.invoice_number,
      description: cost.description || vendor,
      amount,
    });
  } catch (e) {
    reportError(`freshbooks.sendBill ${costId}`, e);
    // Nothing is linked, so nothing is owed in FreshBooks and a retry is safe
    // once whatever it named is dealt with. A vendor created a moment ago does
    // stay behind, which is a name in a list rather than a bill, and the next
    // attempt reuses it.
    return { error: `${readable(e, "create the bill")} Nothing was sent.` };
  }

  const { error } = await supabase
    .from("project_costs")
    .update({
      fb_bill_id: bill.billId,
      fb_bill_status: bill.status,
      fb_bill_outstanding: bill.outstanding,
      fb_synced_at: new Date().toISOString(),
    })
    .eq("id", costId);
  if (error) {
    // The bill exists in FreshBooks and we failed to remember it. Say so
    // plainly, because a retry would create a second one.
    reportError(`freshbooks.linkBill ${costId} bill ${bill.billId}`, error);
    return {
      error: `The bill was created in FreshBooks (id ${bill.billId}) but could not be linked here. Do not send it again.`,
    };
  }
  revalidatePath(`/projects/${projectId}/budget`);
  return { ok: true, vendorCreated, status: bill.status };
}

/**
 * Read every linked, not-yet-paid bill back from FreshBooks. A bill FreshBooks
 * calls paid marks the cost paid here: the chip when there is no payment
 * schedule, every unpaid scheduled payment when there is one, since the
 * schedule is what the budget reads once it exists.
 */
export async function syncFreshbooksBills(projectId: string): Promise<
  { error: string } | { ok: true; checked: number; newlyPaid: number; failed: number }
> {
  const fb = await freshbooks();
  if ("error" in fb) return fb;
  const supabase = createClient();

  const { data: linked } = await supabase
    .from("project_costs")
    .select("id, fb_bill_id, fb_bill_status")
    .eq("project_id", projectId)
    .not("fb_bill_id", "is", null);
  const open = (linked ?? []).filter((c) => c.fb_bill_status !== "paid");
  if (open.length === 0) return { ok: true, checked: 0, newlyPaid: 0, failed: 0 };

  const now = new Date().toISOString();
  let newlyPaid = 0;
  let failed = 0;
  // The reason every read was refused, when they all were. A boolean here used
  // to become the reconnect message, with the same 403 loop as the send path.
  let blocked: string | null = null;

  await Promise.all(
    open.map(async (c) => {
      let bill;
      try {
        bill = await getBill(fb.accountId, fb.token, c.fb_bill_id!);
      } catch (e) {
        failed++;
        if (e instanceof FreshbooksError && (e.status === 401 || e.status === 403)) {
          blocked = readable(e, "read your bills back");
        }
        reportError(`freshbooks.syncBill ${c.id}`, e);
        return;
      }
      const paid = billIsPaid(bill);
      await logWrite(
        "freshbooks.syncBill.save",
        supabase
        .from("project_costs")
        .update({
          fb_bill_status: paid ? "paid" : bill.status,
          fb_bill_outstanding: bill.outstanding,
          fb_synced_at: now,
          ...(paid ? { status: "paid" } : {}),
        })
        .eq("id", c.id),
      );
      if (paid) {
        newlyPaid++;
        await logWrite(
          "freshbooks.syncBill.payments",
          supabase
            .from("cost_payments")
            .update({ paid_at: now })
            .eq("cost_id", c.id)
            .is("paid_at", null),
        );
      }
    }),
  );

  // Only when NOTHING could be read: one refused bill among many is reported
  // as a count, since it is probably that one bill rather than the connection.
  if (blocked && failed === open.length) return { error: blocked };
  revalidatePath(`/projects/${projectId}/budget`);
  if (newlyPaid > 0) revalidatePath(`/projects/${projectId}`);
  return { ok: true, checked: open.length, newlyPaid, failed };
}
