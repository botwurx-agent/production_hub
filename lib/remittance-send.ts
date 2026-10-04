import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { emailConfigured, sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { isEmailAddress, singleLine } from "@/lib/contact";
import { logWrite, reportError } from "@/lib/log";
import {
  remittanceEmail,
  remittanceSubject,
  type RemittanceFacts,
  type RemittanceRecipient,
} from "@/lib/remittance";

/**
 * Sending the remittance, for both of the presses that can send one.
 *
 * ONE PLACE, because there are now two: the producer's own button on a paid
 * cost, and the Pay press that moves the money through BILL. Two copies of
 * "assemble the facts, send it, stamp the row" would drift the first time
 * either changed, and what they would drift about is the wording of a claim
 * about money.
 *
 * THE STAMP IS WRITTEN ONLY AFTER A SUCCESSFUL SEND, so a mail failure leaves
 * `remittance_sent_at` null and the row still reads as untold. That is what
 * makes the manual button a working retry rather than a lie.
 */

/** The parts of a cost this needs. Narrowed so a caller can pass any shape. */
export type RemittanceCost = {
  id: string;
  vendor: string | null;
  description: string | null;
  invoice_number: string | null;
  contact_id: string | null;
  remittance_sent_at?: string | null;
};

export type RemittanceTarget = {
  /** Null when there is nobody to write to, which is a normal answer. */
  email: string | null;
  recipient: RemittanceRecipient;
};

/**
 * Who gets told, off the project roster. A till receipt from a shop carries no
 * contact at all, so null is ordinary and never an error.
 *
 * The roster category decides the greeting: a vendor is a company and everyone
 * else on a job is a person.
 */
export async function remittanceTarget(
  supabase: SupabaseClient<Database>,
  cost: Pick<RemittanceCost, "contact_id">,
): Promise<RemittanceTarget> {
  if (!cost.contact_id) return { email: null, recipient: "person" };
  const { data } = await supabase
    .from("contacts")
    .select("email, type")
    .eq("id", cost.contact_id)
    .maybeSingle();
  const email = singleLine(data?.email ?? "").toLowerCase();
  return {
    email: isEmailAddress(email) ? email : null,
    recipient: (data?.type ?? "").trim().toLowerCase() === "vendor" ? "company" : "person",
  };
}

/**
 * Builds the email, sends it, stamps the cost. The amount passed is the one
 * that was actually paid, which the caller already knows: this never re-derives
 * it, because the two callers know it from different places (a roll-up for the
 * manual press, the payment itself for the BILL one).
 */
export async function deliverRemittance(
  supabase: SupabaseClient<Database>,
  args: {
    cost: RemittanceCost;
    to: string;
    amount: number;
    studioName: string;
    projectTitle: string | null;
    recipient: RemittanceRecipient;
    /** The producer's own words, when they typed any. */
    note?: string | null;
    /** An edited subject from the composer; the generated one otherwise. */
    subject?: string | null;
  },
): Promise<{ ok: true } | { error: string }> {
  if (!emailConfigured()) {
    return { error: "Email is not set up here, so nothing can be sent." };
  }
  const to = singleLine(args.to).toLowerCase();
  if (!isEmailAddress(to)) return { error: "That is not a valid email address." };

  const facts: RemittanceFacts = {
    studio: args.studioName,
    amount: args.amount,
    description: args.cost.description,
    invoiceNumber: args.cost.invoice_number,
    project: args.projectTitle,
    note: args.note ?? null,
    recipient: args.recipient,
  };
  const subject = singleLine(args.subject ?? "") || remittanceSubject(facts);
  const { html, text } = renderEmail(remittanceEmail(facts));

  const res = await sendEmail({ to, subject, html, text });
  if (!res.ok) {
    const why = res.error ?? "The email did not send.";
    reportError(`remittance.send ${args.cost.id}`, new Error(why));
    return { error: why };
  }

  await logWrite(
    "remittance.stamp",
    supabase
      .from("project_costs")
      .update({ remittance_sent_at: new Date().toISOString() })
      .eq("id", args.cost.id),
  );
  return { ok: true };
}
