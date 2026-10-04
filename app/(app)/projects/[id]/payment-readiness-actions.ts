"use server";

// WHO ON THIS JOB CAN BE PAID BY ACH.
//
// Asked at WRAP, which is the operator's own answer to when it should be
// asked: "it is a bit odd to ask for banking and invoice info when the job
// hasnt been completed yet." The send window already refuses to post a paper
// check at the moment of paying, but net 30 with the invoice in front of you
// is the worst time to find out; this is the same fact a month earlier, when
// there is still time to sort it out.
//
// IT IS A DELIBERATE PRESS, NOT A PAGE LOAD. Reading this costs a BILL sign-in
// (their API has no token cache) plus a vendor list read, so hanging it off
// every open of the contacts page would spend that on everybody who came to
// look up a phone number. The producer asks the question when they have it.
//
// READ ONLY, apart from `requestPaymentDetails`, which is the one outward
// action here and takes a deliberate press naming the person. An unprompted
// email asking a freelancer for banking information is phishing-shaped, so it
// goes when the producer decided it goes, which is the same contract the
// remittance email and the meal round hold.
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import {
  BillError,
  billConfigured,
  billSessionForStudio,
  createBillVendor,
  findBillVendor,
  listBillVendors,
  readBillVendor,
  sendBillVendorInvite,
  type BillAddress,
} from "@/lib/bill";
import { isEmailAddress } from "@/lib/contact";
import {
  applyVendorDetail,
  matchReadiness,
  readinessTally,
  thinVendorIds,
  type Readiness,
  type ReadinessTally,
  type RosterPerson,
} from "@/lib/payment-details";
import type { VendorPayment } from "@/lib/bill-payable";

type Fail = { error: string };

export type PaymentReadiness = {
  /** False when BILL is not set up in this deployment, or not connected. */
  connected: boolean;
  rows: Readiness[];
  tally: ReadinessTally;
  /**
   * How many vendor rows were read. `listBillVendors` reads ONE page, so a
   * studio past that ceiling would see its oldest vendors reported as "not at
   * BILL yet"; stating the figure makes that visible rather than silent.
   */
  vendorsRead: number;
};

/**
 * ADMINS ONLY, the same rule and the same reason as the pay path:
 * `bill_connections` is admin-gated by RLS, so a plain member's read comes
 * back empty and this would report "not connected", which is false and
 * unfixable from their side.
 */
async function requireAdmin() {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { ctx: null, error: "Not available on this account." };
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { ctx: null, error: "Only studio admins can see how vendors get paid." };
  }
  return { ctx, error: null };
}

export async function loadPaymentReadiness(
  projectId: string
): Promise<PaymentReadiness | Fail> {
  const { ctx, error } = await requireAdmin();
  if (!ctx) return { error };

  const supabase = createClient();
  // The project read IS the access check: its policy is
  // `is_studio_member OR can_access_project`, and a collaborator is already
  // refused above.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, email, type, role")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  const roster = (contacts ?? []) as RosterPerson[];

  if (!billConfigured()) {
    return { connected: false, rows: [], tally: readinessTally([]), vendorsRead: 0 };
  }

  try {
    const signed = await billSessionForStudio(supabase, ctx.studio.id);
    if (!signed) {
      return { connected: false, rows: [], tally: readinessTally([]), vendorsRead: 0 };
    }
    const vendors = await listBillVendors(signed.session);
    let rows = matchReadiness(roster, vendors);

    // A list row that omitted the payment fields reads as "unclear", which is
    // the one answer this panel must not give about somebody who HAS
    // connected. Those are re-read in full, in parallel, and only those.
    const thin = thinVendorIds(rows);
    if (thin.length) {
      const reads = await Promise.all(
        thin.map(async (id) => [id, await readBillVendor(signed.session, id)] as const)
      );
      const detail = new Map<string, VendorPayment>();
      for (const [id, full] of reads) if (full) detail.set(id, full);
      rows = applyVendorDetail(rows, detail);
    }

    return {
      connected: true,
      rows,
      tally: readinessTally(rows),
      vendorsRead: vendors.length,
    };
  } catch (e) {
    if (e instanceof BillError) return { error: e.message };
    reportError("loadPaymentReadiness", e);
    return { error: "Could not reach BILL to check how vendors get paid." };
  }
}

export type InviteResult = {
  /** How many invites BILL accepted. */
  sent: number;
  /** One line per person it could not be sent for, naming why. */
  skipped: string[];
};

/**
 * ASK THESE PEOPLE FOR THEIR OWN PAYMENT DETAILS. BILL emails each one, they
 * give their bank details to BILL, and the studio never holds them.
 *
 * THE INVITE IS ADDRESSED TO A VENDOR ID, so somebody BILL has never met has
 * to be created first. That used to be reported as "add their bill first",
 * which is the wrong instruction at the moment it is read: the whole point of
 * this panel is WRAP, weeks before an invoice exists, and telling a producer
 * to go and invent a bill to unlock an email is a workaround wearing the
 * shape of a feature. So this creates the vendor itself when an address is
 * supplied for them.
 *
 * THE ADDRESS IS NOT STORED HERE, deliberately. BILL requires one to create a
 * vendor, and once the vendor exists it is never needed again, so it passes
 * through and is forgotten. A freelancer's address is usually their home
 * address, and the 0074 rule says a studio-only side table at minimum; not
 * holding it at all is strictly better, and it costs nothing because the
 * vendor persists across every job after this one.
 *
 * PARTIAL SUCCESS IS THE NORMAL CASE and is reported per person, the same
 * shape the Higgsfield link import uses: twelve people on a roster will not
 * all be in the same state, and one missing email must not fail the other
 * eleven.
 */
export async function requestPaymentDetails(
  projectId: string,
  contactIds: string[],
  /** Keyed by contact id, for the people BILL has never met. */
  addresses?: Record<string, BillAddress>
): Promise<InviteResult | Fail> {
  const { ctx, error } = await requireAdmin();
  if (!ctx) return { error };
  if (!billConfigured()) return { error: "BILL is not set up in this deployment." };

  // A cap rather than a page: this sends EMAIL to real people, and a request
  // asking for a thousand is a mistake rather than a roster.
  const ids = Array.from(new Set((contactIds ?? []).filter((v) => typeof v === "string"))).slice(0, 50);
  if (ids.length === 0) return { error: "Nobody was selected." };

  const supabase = createClient();
  // Scoped to the project, so an id from the browser cannot reach a contact on
  // another job: the filter is the authorization, not the id.
  const { data: rows } = await supabase
    .from("contacts")
    .select("id, name, email")
    .eq("project_id", projectId)
    .in("id", ids);
  const people = (rows ?? []) as { id: string; name: string; email: string | null }[];
  if (people.length === 0) return { error: "Those contacts are not on this project." };

  let session;
  try {
    const signed = await billSessionForStudio(supabase, ctx.studio.id);
    if (!signed) return { error: "BILL is not connected. A studio admin can connect it in Settings." };
    session = signed.session;
  } catch (e) {
    if (e instanceof BillError) return { error: e.message };
    reportError("requestPaymentDetails/login", e);
    return { error: "Could not reach BILL." };
  }

  const skipped: string[] = [];
  let sent = 0;

  for (const person of people) {
    const email = (person.email ?? "").trim();
    if (!isEmailAddress(email)) {
      skipped.push(`${person.name}: no email on the roster.`);
      continue;
    }
    try {
      let vendor = await findBillVendor(session, person.name);
      if (!vendor) {
        const address = addresses?.[person.id];
        if (!address) {
          // Not a failure, a missing fact. The panel asks for it and presses
          // again; naming the person is what makes that obvious.
          skipped.push(`${person.name}: BILL needs their address before it can write to them.`);
          continue;
        }
        // The EMAIL goes on the vendor as well as on the invite. BILL shows it
        // on the vendor record and uses it for everything after this one
        // message, so a vendor created without it is one that can never be
        // chased again.
        vendor = await createBillVendor(session, { name: person.name, address, email });
      }
      await sendBillVendorInvite(session, { vendorId: vendor.id, email });
      sent += 1;
    } catch (e) {
      // BILL's own sentence, which is how every payload here was learned. Only
      // `email` has been proven required, so a refusal naming another field is
      // the next piece of the spec rather than a dead end.
      skipped.push(`${person.name}: ${e instanceof BillError ? e.message : "BILL refused the request."}`);
      if (!(e instanceof BillError)) reportError("requestPaymentDetails/send", e);
    }
  }

  return { sent, skipped };
}
