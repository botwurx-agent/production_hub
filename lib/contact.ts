/**
 * The trust boundary between a public form and the database.
 *
 * NOT `server-only`, on purpose and for the same reason lib/invoice-draft.ts
 * and lib/upload-limits.ts are not: this is the part worth unit testing, and a
 * server-only module cannot be imported by a test harness. The form also
 * mirrors these limits client-side so a reader is told about a problem while
 * they are still typing rather than after they press send.
 *
 * Everything here assumes the input is hostile. This is the one form on the
 * site an anonymous stranger can post to.
 */

/** Why someone is writing. Free text in the column, fixed set on the form. */
export const CONTACT_TOPICS = [
  "Trying it on a job",
  "See it in action",
  "Pricing and plans",
  "Security and compliance",
  "Press",
  "Something else",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const LIMITS = {
  name: 120,
  email: 254, // the maximum length of an address per RFC 5321
  company: 160,
  message: 4000,
};

/**
 * The shortest a form can be filled in by a human who read it.
 *
 * A bot posts the instant the page loads. This is not a security control, it
 * is the cheapest filter that exists and it costs a real person nothing.
 */
export const MIN_FILL_MS = 3000;

export type ContactInput = {
  name: string;
  email: string;
  company: string;
  topic: string;
  message: string;
};

export type ContactValid = {
  ok: true;
  value: { name: string; email: string; company: string | null; topic: string | null; message: string };
};
export type ContactInvalid = { ok: false; field: keyof ContactInput; error: string };

/**
 * Deliberately permissive: one @, something either side, a dot in the domain,
 * no whitespace. Anything stricter rejects real addresses (plus tags, new
 * TLDs, apostrophes), and the only real test of an address is mail arriving at
 * it. This exists to catch a typo, not to prove deliverability.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * A submission is rejected on the FIRST problem, naming the field, so the form
 * can put the message beside the input the person has to fix.
 */
export function validateContact(input: ContactInput): ContactValid | ContactInvalid {
  const name = input.name.trim();
  const email = input.email.trim();
  const company = input.company.trim();
  const topic = input.topic.trim();
  const message = input.message.trim();

  if (!name) return { ok: false, field: "name", error: "Tell us your name." };
  if (name.length > LIMITS.name) return { ok: false, field: "name", error: "That name is too long." };

  if (!email) return { ok: false, field: "email", error: "We need an address to reply to." };
  if (email.length > LIMITS.email || !EMAIL.test(email)) {
    return { ok: false, field: "email", error: "That does not look like an email address." };
  }

  if (company.length > LIMITS.company) {
    return { ok: false, field: "company", error: "That studio name is too long." };
  }

  if (!message) return { ok: false, field: "message", error: "Tell us what you need." };
  if (message.length > LIMITS.message) {
    return { ok: false, field: "message", error: `Keep it under ${LIMITS.message} characters.` };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      company: company || null,
      // An unrecognised topic is dropped rather than stored. It can only come
      // from a hand-posted request, and a made-up value would then show up in
      // the notification email as if it were one of ours.
      topic: (CONTACT_TOPICS as readonly string[]).includes(topic) ? topic : null,
      message,
    },
  };
}

/**
 * Header injection guard for the values that reach the notification email.
 *
 * The name goes into a subject line and the address into Reply-To, so a
 * newline in either could add headers of its own. Resend takes JSON rather
 * than raw headers, so this is defence in depth, not the only thing standing
 * between us and an injected header.
 */
export function singleLine(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}
