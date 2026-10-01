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
 * A refusal we have seen, with the places worth checking named.
 *
 * ONE ENTRY ONLY, and it should stay that way unless a second refusal is
 * actually met: a list of guessed-at causes is worse than FreshBooks' own
 * words. This one was earned on the first real bill (operator, 2026-10-01).
 * FreshBooks answered "You do not have access to bill vendors", which names
 * the endpoint and not the reason, so it reads as something the studio did
 * wrong.
 *
 * IT NAMES TWO CAUSES AND PICKS NEITHER, which is the correction to a first
 * version that blamed the plan outright. Bills and vendors are the Accounts
 * Payable feature, so a plan without it is refused; but the SCOPES are a
 * second, independent gate, and FreshBooks grants only what the developer app
 * is configured to request, so an app registered before the bill scopes were
 * added is refused on a plan that has the feature. The operator hit exactly
 * that: they pay vendors in FreshBooks every week. Naming one cause as the
 * answer sent them to check a plan that was never the problem, which is worse
 * than naming both.
 */
function knownCause(reason: string, write: boolean, vendor: boolean): string | null {
  if (!/access to bill[ _](vendors|payments)|access to bills\b/i.test(reason)) {
    return null;
  }
  // A REFUSED WRITE IS A DIFFERENT SENTENCE FROM A REFUSED READ, and splitting
  // them is what the operator's case needed: reading the vendor list answered
  // 200 on the same token that was refused creating one, so sending them to
  // check "bill scopes" as a group describes something half true and points at
  // no action. A granted read is evidence the plan carries Accounts Payable,
  // which leaves exactly one thing to check.
  // AND THE WAY ROUND IT WAS WRONG TOO, which is the fourth and last costume.
  // It said to add the vendor in FreshBooks by hand, because the vendor list
  // answered 200 and the create did not. The operator did, and it was still
  // not found: `GET /bill_vendors` and `GET /bills` BOTH report total 0 on an
  // account whose Bill Pay screen shows a vendor and a scheduled payment. So a
  // 200 was never evidence the read worked, and the read/write split those two
  // earlier messages rested on was an artifact of reading status codes.
  //
  // FRESHBOOKS' OWN SUPPORT EXPLAINS IT: existing bills and vendors "are not
  // automatically shared in the Bill Pay sub-section". Bill Pay and the Bills
  // API are SEPARATE STORES. The API reaches classic Accounts Payable, this
  // studio works in Bill Pay, and Bill Pay has no public API. Nothing anybody
  // ticks, reconnects or types by hand changes that, so the message stops
  // asking and says what was found.
  if (vendor) {
    return "This is not something you can fix by ticking or reconnecting anything, so please do not try again. FreshBooks reports no bills and no vendors at all on this account through its API, while your Bill Pay screen shows both, because Bill Pay and the Bills API are separate and Bill Pay has no API we can reach. Pay this one in FreshBooks directly, then mark it paid here.";
  }
  if (write) {
    return "Reading is allowed and writing is not, so this is the write scope. Check user:bill_vendors:write and user:bills:write are ticked on your FreshBooks developer app, then reconnect in Settings, since a token issued before a scope was added does not carry it.";
  }
  // THIS USED TO END ON "then reconnect", which is the reconnect loop again
  // one step further out: the operator checked the plan, ticked every scope,
  // reconnected, and got the identical sentence back telling them to do all
  // three. Advice somebody has already acted on is not advice. It names the
  // two things to check, then points at the probe, which answers from the
  // API rather than from a guess about which of them is at fault.
  return "That is Accounts Payable. Check that your FreshBooks plan carries it and that the bill scopes are ticked on your FreshBooks developer app. If both are already true, open /api/diagnostics/freshbooks to see which endpoint is actually being refused.";
}

/**
 * The sentence the producer reads when a FreshBooks call fails.
 *
 * `what` is what we were trying to do, as a verb phrase ("send this bill",
 * "load your expense categories"), because "something went wrong" sends the
 * next report back to us with nothing in it.
 *
 * `write` says the call was CREATING something rather than reading it. The
 * caller knows which it was; the response body does not say, and FreshBooks
 * answers a refused read and a refused write with the same sentence.
 * `vendor` narrows that to creating a VENDOR, which is the one refusal with a
 * way round it: the vendor can be made in FreshBooks and matched by name.
 */
export function freshbooksFailure(
  status: number,
  body: string | null | undefined,
  what: string,
  opts: { write?: boolean; vendor?: boolean } = {},
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
    if (!reason) {
      return `FreshBooks would not allow us to ${what} (403), and reconnecting will not help. Check that your FreshBooks plan includes bills (Accounts Payable), and that the bill scopes are ticked on your FreshBooks developer app.`;
    }
    const cause = knownCause(reason, opts.write === true, opts.vendor === true);
    return cause
      ? `FreshBooks would not allow us to ${what}: ${reason} ${cause}`
      : `FreshBooks would not allow us to ${what}: ${reason} Reconnecting will not help, this is a permission on your FreshBooks account.`;
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
