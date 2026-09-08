"use server";

import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { emailConfigured, sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { allowPublic } from "@/lib/rate-limit";
import { reportError } from "@/lib/log";
import { MIN_FILL_MS, singleLine, validateContact } from "@/lib/contact";

/**
 * The marketing contact form's one action.
 *
 * THE ORDER OF OPERATIONS IS THE DESIGN. The row is written FIRST and the
 * email is a notification on top of it, because email is best effort here
 * exactly as it is for invites: Resend can be down and a key can be missing in
 * a fresh environment. Somebody writing to a company they are evaluating gets
 * one shot at it, so a mail failure must never lose the message. If the insert
 * itself fails, the person is told plainly and given the address to write to
 * directly, rather than being shown a success screen over a dropped message.
 *
 * WHERE IT LANDS: contact_messages has RLS on with no policies at all, so this
 * service-role write is the only way in and nothing anonymous can read it back.
 */

/** The address the site publishes, and where a submission is sent. */
const INBOX = "studioflows1@gmail.com";

export type ContactResult =
  | { ok: true }
  | { ok: false; field?: "name" | "email" | "company" | "topic" | "message"; error: string };

export async function submitContact(form: FormData): Promise<ContactResult> {
  // Two spam filters that cost a real person nothing, before any work is done.
  //
  // The HONEYPOT is a field hidden from people and left empty by them; a bot
  // filling every input it finds trips it. The TIMING check catches the same
  // bot posting the instant the page loads. Both fail QUIETLY as a success,
  // deliberately: telling a script which check it tripped is telling it how to
  // pass next time, and a real person cannot reach either branch.
  if (String(form.get("website") ?? "")) return { ok: true };

  const startedAt = Number(form.get("startedAt"));
  if (Number.isFinite(startedAt) && Date.now() - startedAt < MIN_FILL_MS) {
    return { ok: true };
  }

  // A hard limit a human will never reach. Unlike the two above this DOES say
  // so, because a person who genuinely sends a second message a minute later
  // deserves to know it did not go through.
  if (!allowPublic("contact", 5, 10 * 60_000)) {
    return {
      ok: false,
      error: `That is a lot of messages. Write to ${INBOX} directly and we will pick it up.`,
    };
  }

  const parsed = validateContact({
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    company: String(form.get("company") ?? ""),
    topic: String(form.get("topic") ?? ""),
    message: String(form.get("message") ?? ""),
  });
  if (!parsed.ok) return { ok: false, field: parsed.field, error: parsed.error };
  const v = parsed.value;

  if (!serviceConfigured()) {
    reportError("submitContact", new Error("Contact form: service client is not configured"));
    return { ok: false, error: `Something went wrong. Please write to ${INBOX} instead.` };
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("contact_messages")
    .insert({
      name: v.name,
      email: v.email,
      company: v.company,
      topic: v.topic,
      message: v.message,
    })
    .select("id")
    .single();

  if (error || !data) {
    reportError("submitContact", error ?? new Error("Contact insert returned no row"));
    return { ok: false, error: `Something went wrong. Please write to ${INBOX} instead.` };
  }

  // From here the message is SAFE. Everything below is notification, and a
  // failure in it is logged rather than shown: the person's message is stored
  // and telling them it failed would only make them send it twice.
  if (emailConfigured()) {
    const subject = singleLine(
      `Studio Flows: ${v.topic ?? "message"} from ${v.name}${v.company ? ` (${v.company})` : ""}`,
    );
    const body = renderEmail({
      heading: "New message from the site",
      lines: [
        `${v.name}${v.company ? ` at ${v.company}` : ""} <${v.email}>`,
        v.topic ? `About: ${v.topic}` : "No topic given.",
        v.message,
        "Reply to this email and it goes straight back to them.",
      ],
    });
    const sent = await sendEmail({
      to: INBOX,
      subject,
      html: body.html,
      text: body.text,
      // The whole point of the notification: hitting reply answers the person
      // rather than the sending domain. The address cannot carry a newline,
      // because the validator rejects whitespace in it outright.
      replyTo: singleLine(v.email),
    });
    if (sent.ok) {
      await supabase
        .from("contact_messages")
        .update({ emailed_at: new Date().toISOString() })
        .eq("id", data.id);
    } else {
      // emailed_at stays null, which is how a message that exists only in the
      // table can be found later.
      reportError(
        "submitContact",
        new Error(`Contact notification failed for ${data.id}: ${sent.error ?? "unknown"}`),
      );
    }
  }

  return { ok: true };
}
