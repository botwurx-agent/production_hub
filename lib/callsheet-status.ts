/**
 * Where one person is with their call sheet.
 *
 * THREE DATE COLUMNS WERE THE PROBLEM. Sent, Viewed and Confirmed each got
 * their own column, so a person who did all three on the same day read as
 * "Sep 2  Sep 2  Sep 2" and a producer scanning twelve rows saw thirty-six
 * dates and no answer. The question is never "what are this person's three
 * dates", it is "where are they, and do I need to chase them".
 *
 * So there is ONE state per person: the furthest point they have reached. The
 * dates are still there, on the milestones that actually happened, but they
 * stop competing for attention.
 *
 * NOT SENT DOES NOT MEAN THEY DO NOT HAVE IT, which is the case that makes a
 * naive "sent / not sent" flag lie. Copying somebody their link and texting it
 * is a normal way to reach a crew member, and then they view and confirm
 * having never been emailed. The milestones are recorded independently, so
 * that person reads as Viewed with the emailed step simply not filled in,
 * rather than as a contradiction.
 */

export type RecipientLike = {
  email: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  confirmed_at: string | null;
  send_count?: number | null;
};

export type StageKey = "confirmed" | "viewed" | "sent" | "unsent" | "no_email";

export type Stage = {
  key: StageKey;
  /** The one word that answers "where are they". */
  label: string;
  /** The date that word refers to, or null. */
  at: string | null;
  /** Which of emailed / opened / confirmed have happened, in order. */
  steps: [boolean, boolean, boolean];
  hue: "green" | "blue" | "amber" | "muted";
  /** Only when something needs explaining, e.g. a link shared by hand. */
  note: string | null;
};

export function recipientStage(r: RecipientLike): Stage {
  const steps: [boolean, boolean, boolean] = [
    Boolean(r.sent_at),
    Boolean(r.viewed_at),
    Boolean(r.confirmed_at),
  ];

  // SAY ONLY WHAT IS KNOWN. This person was never emailed from here and opened
  // the link anyway, which means it reached them some other way (copied into a
  // text or a Slack message, or forwarded on). The app cannot see which, so it
  // does not claim to: the first wording said "Link shared by hand", which
  // guessed at a mechanism, and the operator had to ask what it meant.
  //
  // The consequence is the useful half and was missing: this person is not on
  // the email trail, so a later send skips them unless they are emailed on
  // purpose.
  const notEmailed = !r.sent_at && (r.viewed_at || r.confirmed_at)
    ? "Never emailed from here"
    : null;

  if (r.confirmed_at) {
    return { key: "confirmed", label: "Confirmed", at: r.confirmed_at, steps, hue: "green", note: notEmailed };
  }
  if (r.viewed_at) {
    return { key: "viewed", label: "Opened", at: r.viewed_at, steps, hue: "blue", note: notEmailed ?? "Not confirmed yet" };
  }
  if (r.sent_at) {
    const again = (r.send_count ?? 0) > 1 ? `Sent ${r.send_count} times` : null;
    return { key: "sent", label: "Sent", at: r.sent_at, steps, hue: "muted", note: again ?? "Not opened yet" };
  }
  if (!r.email?.trim()) {
    return { key: "no_email", label: "No email", at: null, steps, hue: "amber", note: "Copy their link instead" };
  }
  return { key: "unsent", label: "Not sent", at: null, steps, hue: "amber", note: null };
}

/** The counts the header states, each one a different job for the producer. */
export function tallyRecipients(rows: RecipientLike[]) {
  let confirmed = 0, opened = 0, sent = 0, unsent = 0, noEmail = 0;
  for (const r of rows) {
    switch (recipientStage(r).key) {
      case "confirmed": confirmed++; break;
      case "viewed": opened++; break;
      case "sent": sent++; break;
      case "no_email": noEmail++; break;
      default: unsent++;
    }
  }
  return {
    total: rows.length,
    confirmed,
    /** Opened but has not confirmed: probably fine, worth a glance. */
    opened,
    /** Emailed and never opened: the ones most likely not to know. */
    sent,
    /** Never emailed, and could be. The only group with a one-click fix. */
    unsent,
    /** Never emailed and cannot be. Needs a link copied by hand. */
    noEmail,
    /** Everyone who has not confirmed, which is what the reminder chases. */
    outstanding: rows.length - confirmed,
  };
}
