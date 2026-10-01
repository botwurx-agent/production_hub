"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { logWrite, reportError } from "@/lib/log";
import { emailConfigured, sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { isEmailAddress, singleLine } from "@/lib/contact";
import { remittanceEmail, remittanceSubject } from "@/lib/remittance";
import { summarizePayments } from "@/lib/costs";

/**
 * Tells a vendor their payment is on its way.
 *
 * A DELIBERATE PRESS, NEVER AUTOMATIC. The paid status is read back from
 * FreshBooks when the budget page opens, so an email hanging off that would go
 * out whenever somebody happened to browse: possibly days late, possibly at
 * eleven at night, possibly twice if two people open the page. Outward email
 * about money gets a human commit, the same contract Runner and the meal round
 * already hold.
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
  if (!emailConfigured()) {
    return { error: "Email is not set up here, so nothing can be sent." };
  }

  const to = singleLine(input.to).toLowerCase();
  if (!isEmailAddress(to)) return { error: "That is not a valid email address." };

  const supabase = createClient();
  const { data: cost } = await supabase
    .from("project_costs")
    .select("id, vendor, description, amount, invoice_number, status, project_id")
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

  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle();

  const facts = {
    studio: ctx.studio.name,
    amount: summary.committed,
    description: cost.description,
    invoiceNumber: cost.invoice_number,
    project: project?.title ?? null,
    note: input.message,
  };
  const subject = singleLine(input.subject) || remittanceSubject(facts);
  const { html, text } = renderEmail(remittanceEmail(facts));

  const res = await sendEmail({ to, subject, html, text });
  if (!res.ok) {
    const why = res.error ?? "The email did not send.";
    reportError(`remittance.send ${costId}`, new Error(why));
    // Nothing is stamped on a failure, so the row still reads as untold and
    // the producer can try again rather than believing it went.
    return { error: why };
  }

  await logWrite(
    "remittance.stamp",
    supabase
      .from("project_costs")
      .update({ remittance_sent_at: new Date().toISOString() })
      .eq("id", costId),
  );

  revalidatePath(`/projects/${projectId}/budget`);
  return { ok: true };
}
