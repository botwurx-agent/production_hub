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

/**
 * WHO IS BEING THANKED. A crew member or a performer was ON the shoot; a
 * rental house or a prop shop worked WITH the studio on it, and telling a
 * truck company thank you for being on the shoot reads as a mail merge. The
 * project roster already records which of the two somebody is, so the line
 * follows it rather than guessing.
 */
export type RemittanceRecipient = "person" | "company";

export type RemittanceFacts = {
  /** The studio doing the paying, for the From line of the sentence. */
  studio: string;
  amount: number;
  description: string | null;
  invoiceNumber: string | null;
  project: string | null;
  /** Anything the producer typed in the composer, shown under the greeting. */
  note?: string | null;
  /** Defaults to a person, which is who a roster contact nearly always is. */
  recipient?: RemittanceRecipient | null;
};

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? "").replace(/[\r\n]+/g, " ").trim();
  return t ? t : null;
};

/**
 * A bare number reads as a stray figure in a sentence, so a printed invoice
 * number that is only digits gets the hash somebody would say out loud. One
 * carrying its own prefix (INV-204, EST-3) is left exactly as printed.
 */
function invoiceLabel(n: string): string {
  return /^\d+$/.test(n) ? `#${n}` : n;
}

/**
 * The greeting, and the reason this email does not read as a bank
 * notification: it names the job. Null when no project is known, since there
 * is nothing to thank anybody for by name and a bare "thank you" is filler.
 */
export function remittanceThanks(f: RemittanceFacts): string | null {
  const project = clean(f.project);
  if (!project) return null;
  return f.recipient === "company"
    ? `Thank you for your work on ${project}.`
    : `Thank you for being on the ${project} shoot.`;
}

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
    invoice ? `Invoice ${invoiceLabel(invoice)}` : null,
    project,
  ]
    .filter(Boolean)
    .join(" · ");

  // TOWARDS, not for, and it is not a hedge: a cost can be settled in a
  // deposit and a balance (cost_payments), so a payment is routinely one of
  // two against the same invoice. "Towards" is true of both cases where "for"
  // is only true of one.
  const against = invoice
    ? description
      ? `your invoice ${invoiceLabel(invoice)} for ${description}`
      : `your invoice ${invoiceLabel(invoice)}`
    : description
      ? description
      : "your invoice";

  const thanks = remittanceThanks(f);

  return {
    heading: "Payment sent",
    lines: [
      // The greeting leads, then anything the producer wrote, then the figures.
      ...(thanks ? [thanks] : []),
      ...(note ? [note] : []),
      `${studio} has sent a payment towards ${against}.`,
      details,
      // Never "you have been paid": see the module comment.
      "Payments can take a few business days to arrive, depending on the method used.",
    ],
    footnote: "Reply to this email if anything does not look right.",
  };
}
