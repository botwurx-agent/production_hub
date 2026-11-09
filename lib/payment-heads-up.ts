import type { EmailContent } from "@/lib/email-template";

/**
 * The studio's own note that goes out alongside BILL's invite.
 *
 * WHY IT EXISTS: BILL's invite arrives cold, from a company the freelancer has
 * never heard of, asking for banking information. That is the shape of every
 * phishing email anyone has been warned about, and the operator found the
 * signup slow enough that somebody could stop halfway. This note comes from
 * the studio they just worked for, names the job, and says what BILL's email
 * is and that it costs them nothing.
 *
 * IT IS SENT AFTER BILL ACCEPTS THE INVITE, not before. Sent first, a refused
 * invite would leave somebody waiting for an email that never comes. So the
 * wording says BILL's email "is on its way or may already be in your inbox",
 * which is true either way: both go out within seconds of each other.
 *
 * WHAT IT NEVER SAYS: it never asks for bank details itself, never carries a
 * link to a form, and says plainly that the studio will not ask for them by
 * email. A note designed to make the real request trustworthy must not look
 * like the thing it is vouching for.
 *
 * Pure and not `server-only`, so the wording can be tested.
 */

export type HeadsUpFacts = {
  studio: string | null;
  project: string | null;
  /** The freelancer's name as it reads on the roster. */
  name: string | null;
};

function clean(s: string | null | undefined): string | null {
  const v = (s ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return v ? v.slice(0, 120) : null;
}

/** First word of a name, for the greeting. "Hi Steve," reads as a person. */
function firstName(name: string | null): string | null {
  const n = clean(name);
  if (!n) return null;
  const first = n.split(" ")[0];
  return first.length >= 2 ? first : n;
}

export function headsUpSubject(f: HeadsUpFacts): string {
  const studio = clean(f.studio) ?? "Your studio";
  return `${studio}: getting you paid by direct deposit`;
}

export function headsUpEmail(f: HeadsUpFacts): EmailContent {
  const studio = clean(f.studio) ?? "The studio";
  const project = clean(f.project);
  const first = firstName(f.name);

  const greeting = first ? `Hi ${first},` : "Hi,";
  const thanks = project
    ? `Thanks for your work on ${project}. We would like to pay you by direct deposit.`
    : "We would like to pay you by direct deposit.";

  return {
    heading: "An email from BILL is coming",
    lines: [
      greeting,
      thanks,
      `We pay through BILL (bill.com). You will get an email from BILL asking you to add your bank details, and it is on its way or may already be in your inbox. It comes from BILL rather than from ${studio}, and it is genuine.`,
      "Setting it up is free for you. Your bank details go straight to BILL, so we never see or store them.",
      "If you would rather be paid another way, or anything about BILL's email looks wrong, just reply to this one.",
    ],
    footnote: `${studio} will never ask for your bank details by email.`,
  };
}
