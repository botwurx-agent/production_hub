"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { deliverRemittance, remittanceTarget } from "@/lib/remittance-send";
import { summarizePayments } from "@/lib/costs";

/**
 * Tells a vendor their payment is on its way.
 *
 * THIS PRESS IS THE RETRY AND THE AFTERTHOUGHT. A payment made through BILL
 * now sends the same email from the Pay press itself, which is where it
 * belongs: the producer is already naming the vendor and the amount there. The
 * button stays for the two cases that press cannot cover, both real: a cost
 * paid outside Studio Flows and marked paid here, and "they never got it".
 *
 * WHAT IS STILL REFUSED is an email hanging off a PAGE LOAD. The paid status is
 * read back from BILL when the budget opens, so a send attached to that would
 * go out whenever somebody happened to browse: possibly days late, possibly at
 * eleven at night, possibly twice if two people open the page. Outward email
 * about money follows a press that meant it.
 *
 * THE PAID CHECK IS RE-DERIVED HERE rather than trusted from the browser. The
 * button is only offered on a paid cost, but a button is presentation; the
 * thing that must not happen is an email saying money was sent for a cost
 * nobody has paid.
 */
export async function sendRemittance(
  projectId: string,
  costId: string,
  input: { to: string; subject: string; message: string },
): Promise<{ error: string } | { ok: true }> {
  const ctx = await requireStudioContext();

  const supabase = createClient();
  const { data: cost } = await supabase
    .from("project_costs")
    .select(
      "id, vendor, description, amount, invoice_number, contact_id, status, project_id",
    )
    .eq("id", costId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!cost) return { error: "That cost is gone." };

  // The schedule is authoritative when one exists, the manual chip otherwise:
  // the same roll-up the tile and the dashboard use, so three surfaces cannot
  // disagree about whether this is paid.
  const { data: payments } = await supabase
    .from("cost_payments")
    .select("amount, due_date, paid_at")
    .eq("cost_id", costId);
  const summary = summarizePayments(cost.amount, payments ?? [], cost.status);
  if (summary.state !== "paid") {
    return {
      error:
        "This cost is not paid yet, so there is nothing to tell them. Mark it paid first.",
    };
  }

  const [{ data: project }, target] = await Promise.all([
    supabase.from("projects").select("title").eq("id", projectId).maybeSingle(),
    remittanceTarget(supabase, cost),
  ]);

  const res = await deliverRemittance(supabase, {
    cost,
    // The composer's address wins: the producer may be sending it on to an
    // agent or a bookkeeper rather than to the person on the roster.
    to: input.to,
    amount: summary.committed,
    studioName: ctx.studio.name,
    projectTitle: project?.title ?? null,
    recipient: target.recipient,
    note: input.message,
    subject: input.subject,
  });
  if ("error" in res) return res;

  revalidatePath(`/projects/${projectId}/budget`);
  return { ok: true };
}
