import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createNotification } from "@/lib/notifications";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { siteOrigin } from "@/lib/site-url";
import { reportError } from "@/lib/log";
import { validMentionIds, type MentionCandidate } from "@/lib/mentions";

/**
 * Delivering a mention.
 *
 * TWO CHANNELS, BECAUSE THERE ARE TWO KINDS OF PERSON on a job. Someone with an
 * account gets an addressed notification (their bell), which since migration
 * 0102 works even for a project collaborator who is not a studio member.
 * Everyone else gets an email, which is the only way to reach the majority of a
 * crew: a stylist booked for three weeks is never going to create an account,
 * and a feature that only works for people who do would not have solved the
 * problem it was built for.
 *
 * BEST EFFORT, ALWAYS. The comment is already saved by the time this runs, so a
 * mail outage or a missing key must never turn a posted note into an error. A
 * failure is reported and the mention row simply keeps a null `notified_at`,
 * which is why that column is a timestamp rather than a boolean: a gap is
 * visible, and "we tried and failed" is not silently the same as "sent".
 */

export type MentionContext = {
  /** Who wrote the comment, for the "Fred Nunez mentioned you" line. */
  authorName: string;
  projectId: string;
  projectTitle: string;
  studioId: string;
  studioName: string;
  /** What the note is attached to, e.g. "Shot 1A" or "Bright Water pack shot". */
  subject: string;
  /** In-app destination for the comment. */
  href: string;
  /** The comment text itself. */
  body: string;
};

/**
 * Records the mentions and notifies the people named.
 *
 * `requested` is whatever the browser sent and is filtered against `roster`,
 * which the server loaded itself, so an id that is not on this project's roster
 * (or belongs to a client) cannot be mentioned however it arrives.
 */
export async function deliverMentions(
  supabase: SupabaseClient<Database>,
  commentId: string,
  requested: unknown,
  roster: MentionCandidate[],
  ctx: MentionContext
): Promise<void> {
  const ids = validMentionIds(requested, roster);
  if (ids.length === 0) return;
  const byId = new Map(roster.map((c) => [c.id, c]));

  const { error: insErr } = await supabase.from("comment_mentions").insert(
    ids.map((contact_id) => ({
      studio_id: ctx.studioId,
      comment_id: commentId,
      contact_id,
    }))
  );
  if (insErr) {
    // Without the rows there is nothing to stamp, but the people should still
    // be told, so this is reported and delivery continues.
    reportError("deliverMentions:insert", insErr);
  }

  const origin = siteOrigin();
  const url = origin ? `${origin}${ctx.href}` : ctx.href;
  const delivered: string[] = [];

  for (const id of ids) {
    const person = byId.get(id);
    if (!person) continue;
    let reached = false;

    // In-app, when we know which account they are.
    if (person.userId) {
      try {
        await createNotification(supabase, {
          studio_id: ctx.studioId,
          project_id: ctx.projectId,
          user_id: person.userId,
          type: "mention",
          title: `${ctx.authorName} mentioned you`,
          body: `${ctx.subject}: ${ctx.body}`.slice(0, 500),
          href: ctx.href,
        });
        reached = true;
      } catch (e) {
        reportError("deliverMentions:notify", e);
      }
    }

    // By email, for everyone with an address. Sent even to someone who also has
    // an account: a mention is a request for action, and a bell they may not
    // look at today is not delivery.
    if (person.email?.trim() && emailConfigured()) {
      const mail = renderEmail({
        heading: `${ctx.authorName} mentioned you on ${ctx.projectTitle}`,
        lines: [`On ${ctx.subject}:`, ctx.body],
        ctaLabel: "Open the note",
        ctaUrl: url,
        footnote: `Sent by ${ctx.studioName} from Studio Flows because you are on the ${ctx.projectTitle} crew list.`,
      });
      const res = await sendEmail({
        to: person.email.trim(),
        subject: `${ctx.authorName} mentioned you on ${ctx.projectTitle}`,
        html: mail.html,
        text: mail.text,
      });
      if (res.ok) reached = true;
    }

    if (reached) delivered.push(id);
  }

  if (delivered.length > 0) {
    const { error } = await supabase
      .from("comment_mentions")
      .update({ notified_at: new Date().toISOString() })
      .eq("comment_id", commentId)
      .in("contact_id", delivered);
    if (error) reportError("deliverMentions:stamp", error);
  }
}
