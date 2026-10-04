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
  findBillVendor,
  listBillVendors,
  sendBillVendorInvite,
} from "@/lib/bill";
import { isEmailAddress } from "@/lib/contact";
import {
  matchReadiness,
  readinessTally,
  type Readiness,
  type ReadinessTally,
  type RosterPerson,
} from "@/lib/payment-details";

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
    const rows = matchReadiness(roster, vendors);
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
 * THE VENDOR HAS TO EXIST AT BILL FIRST, which is a real constraint rather
 * than an oversight: the invite is addressed to a vendor id, and BILL refuses
 * to create a vendor without a postal address we do not have on the roster. In
 * practice that is the right order anyway, since a vendor is created the first
 * time their bill is added, which is at or just after wrap. Somebody BILL has
 * never heard of is REPORTED rather than silently skipped, so the producer
 * knows the next step is adding the bill.
 *
 * PARTIAL SUCCESS IS THE NORMAL CASE and is reported per person, the same
 * shape the Higgsfield link import uses: twelve people on a roster will not
 * all be in the same state, and one missing email must not fail the other
 * eleven.
 */
export async function requestPaymentDetails(
  projectId: string,
  contactIds: string[]
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
      const vendor = await findBillVendor(session, person.name);
      if (!vendor) {
        skipped.push(`${person.name}: not a vendor at BILL yet. Add their bill first.`);
        continue;
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
