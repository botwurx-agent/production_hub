/**
 * What to tell somebody when FreshBooks refuses a call.
 *
 * WHY THIS IS A MODULE OF ITS OWN, and the bug it exists to fix (operator,
 * 2026-10-01, on the first real bill): the send path mapped every 401 AND
 * every 403 onto one sentence, "FreshBooks needs one reconnect to allow
 * bills". For a 401 that is right, since a 401 is authentication and
 * reconnecting fixes it. For a 403 it is a loop with no exit: a 403 means the
 * call was authenticated and is not permitted, so reconnecting changes nothing
 * and the same message comes back forever. That is exactly what happened. They
 * reconnected, the up-front scope check passed, the expense categories loaded
 * (so the token was good), the bill was refused, and the app sent them back to
 * Settings to reconnect a connection that was already fine.
 *
 * AND IT SAYS WHAT FRESHBOOKS SAID. Their own message is the only thing that
 * names the cause, and it was going nowhere at all: reportError sends it to
 * Sentry, which is inert in this deployment (NEXT_PUBLIC_SENTRY_DSN has never
 * been set), so the one useful sentence was discarded in both directions. The
 * status code is in the text for the same reason the error card puts the fault
 * line on the card: a screenshot that names the fault is most of the
 * diagnosis.
 *
 * NOT "server-only", the same call as invoice-draft, contact and remittance,
 * so the wording can be asserted in a test.
 */

/** Longest reason we will put in a toast. A refused call can answer with a
 * whole HTML error page, and a wall of markup reads as the app breaking. */
const MAX_REASON = 200;

/**
 * The human sentence out of a FreshBooks error body, or null when there is
 * none to find.
 *
 * TOLERANT BY DESIGN: these come back in at least three shapes depending on
 * which half of the platform refused (the accounting API nests an errors
 * array, the OAuth layer uses error_description, and some paths answer with a
 * bare message), and an HTML error page carries none of them. Anything
 * unrecognised is null rather than a guess, so the caller falls back to
 * saying what it can rather than quoting markup at somebody.
 */
export function freshbooksReason(body: string | null | undefined): string | null {
  const raw = (body ?? "").trim();
  if (!raw || raw.startsWith("<")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;

  const nested = (o.response ?? {}) as Record<string, unknown>;
  const errors = Array.isArray(nested.errors) ? nested.errors : [];
  const fromErrors = errors
    .map((e) => (e && typeof e === "object" ? (e as Record<string, unknown>).message : null))
    .filter((m): m is string => typeof m === "string" && m.trim() !== "");

  const real = (m: unknown): m is string => typeof m === "string" && m.trim() !== "";
  const written = [
    ...fromErrors,
    nested.message,
    o.error_description,
    o.message,
  ].filter(real);

  // `error` is usually a bare slug ("unauthenticated", "forbidden"), which is
  // the status code in words rather than a reason. Only when nothing was
  // written, and never ALONGSIDE something written, or a real sentence picks
  // up a slug on the end of it.
  const candidates = written.length > 0 ? written : [o.error].filter(real);

  if (candidates.length === 0) return null;
  // One line, since this lands in a toast, and sentence-ended so it reads as
  // part of the message rather than a truncated field.
  const text = candidates
    .map((m) => m.replace(/\s+/g, " ").trim())
    .join(" ")
    .slice(0, MAX_REASON);
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * The sentence the producer reads when a FreshBooks call fails.
 *
 * `what` is what we were trying to do, as a verb phrase ("send this bill",
 * "load your expense categories"), because "something went wrong" sends the
 * next report back to us with nothing in it.
 */
export function freshbooksFailure(
  status: number,
  body: string | null | undefined,
  what: string,
): string {
  const reason = freshbooksReason(body);
  const because = reason ? ` ${reason}` : "";

  // Authentication. The one case where reconnecting is the real answer.
  if (status === 401) {
    return `FreshBooks sign-in has expired. Reconnect it in Settings.${because}`;
  }

  // Authenticated and not permitted. Never offer a reconnect here: it is the
  // loop this module exists to end. The two things it can be are both on the
  // operator's own FreshBooks side and both checkable, so name them when
  // FreshBooks itself did not.
  if (status === 403) {
    return reason
      ? `FreshBooks would not allow us to ${what}: ${reason} Reconnecting will not help, this is a permission on your FreshBooks account.`
      : `FreshBooks would not allow us to ${what} (403), and reconnecting will not help. Check that your FreshBooks plan includes bills (Accounts Payable), and that the bill scopes are ticked on your FreshBooks developer app.`;
  }

  if (status === 404) {
    return `FreshBooks could not find what it needed to ${what} (404).${because}`;
  }
  if (status === 429) {
    return `FreshBooks is rate limiting us. Wait a minute and try again.${because}`;
  }
  if (status >= 500) {
    return `FreshBooks had a server error (${status}) and could not ${what}. Try again shortly.`;
  }
  return `FreshBooks could not ${what} (${status}).${because}`;
}
