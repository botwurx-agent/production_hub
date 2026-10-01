/**
 * The email that tells a vendor their payment is on its way.
 *
 * WHY IT COMES FROM US RATHER THAN THE BILLING TOOL (operator, 2026-10-01):
 * FreshBooks knows a bill to "Veronica Laramie" for $2,400 was paid. It does
 * not know the money was for prop styling on Hint Water against invoice 1043.
 * Naming the job is what stops the follow-up email, so the remittance is worth
 * more sent from here, and it works whether or not the billing tool also
 * notifies.
 *
 * THE WORDING IS A CLAIM ABOUT MONEY, which is the whole reason this is a
 * module of its own rather than a string built in the action. A cost reads as
 * paid once the payment was RECORDED or INITIATED, and an ACH transfer takes
 * several business days to land. So this never says "you have been paid": it
 * says the payment has been SENT and that it takes time to arrive. Telling a
 * freelancer the money is in their account when it is not manufactures the
 * exact chase the feature exists to end.
 *
 * NOT "server-only", the same call as invoice-draft and contact, so the
 * wording and the money formatting can be asserted in a test.
 */
import type { EmailContent } from "@/lib/email-template";

/** Exact cents, unlike lib/format money(), which rounds to whole dollars. A
 * remittance states a figure somebody will reconcile against their bank. */
export function exactMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export type RemittanceFacts = {
  /** The studio doing the paying, for the From line of the sentence. */
  studio: string;
  amount: number;
  description: string | null;
  invoiceNumber: string | null;
  project: string | null;
  /** Anything the producer typed in the composer, shown first. */
  note?: string | null;
};

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? "").replace(/[\r\n]+/g, " ").trim();
  return t ? t : null;
};

/** The subject somebody scans in an inbox: what happened, how much, which job. */
export function remittanceSubject(f: RemittanceFacts): string {
  const project = clean(f.project);
  return `Payment sent: ${exactMoney(f.amount)}${project ? ` (${project})` : ""}`;
}

export function remittanceEmail(f: RemittanceFacts): EmailContent {
  const note = clean(f.note);
  const description = clean(f.description);
  const invoice = clean(f.invoiceNumber);
  const project = clean(f.project);
  const studio = clean(f.studio) ?? "The studio";

  // One details line rather than a paragraph each: four one-line paragraphs
  // read as a form, and this is a note between two people.
  const details = [
    exactMoney(f.amount),
    invoice ? `Invoice ${invoice}` : null,
    project,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    heading: "Payment sent",
    lines: [
      ...(note ? [note] : []),
      description
        ? `${studio} has sent payment for ${description}.`
        : `${studio} has sent payment for your invoice.`,
      details,
      // Never "you have been paid": see the module comment.
      "Payments can take a few business days to arrive, depending on the method used.",
    ],
    footnote: "Reply to this email if anything does not look right.",
  };
}
