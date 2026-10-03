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
// READ ONLY. Nothing here creates a vendor, sends an invite or moves money.
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { BillError, billConfigured, billSessionForStudio, listBillVendors } from "@/lib/bill";
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
export async function loadPaymentReadiness(
  projectId: string
): Promise<PaymentReadiness | Fail> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Not available on this account." };
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Only studio admins can see how vendors get paid." };
  }

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
