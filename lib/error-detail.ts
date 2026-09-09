// What a caught error can honestly tell the person looking at a broken screen.
//
// WHY THIS EXISTS: all three error boundaries used to show one sentence and,
// for a SERVER error, a digest. A digest is only useful to somebody holding the
// platform's logs, and a CLIENT-side error does not carry one at all, so the
// most common failure in the app reported literally nothing. The person saw
// "Something broke", had nothing to send on, and the fault was unfindable
// afterwards: Vercel logs only server requests, and Sentry is inert until
// NEXT_PUBLIC_SENTRY_DSN is set. Until it is, THIS TEXT IS THE REPORT.
//
// So the fault line is shown on the card. A screenshot of a broken screen is
// what actually gets sent, and a screenshot of a generic apology is worth
// nothing, while a screenshot naming the fault is most of the diagnosis.
//
// It is a SECOND line under the human sentence, never the headline: a producer
// mid-job needs to know what to do first, and the technical line is for
// whoever they forward it to. The full block (stack, path, browser) goes to the
// clipboard rather than on screen, because a wall of stack frames reads as the
// app having fallen apart rather than as one thing having gone wrong.

/** How much of a message fits on a card without becoming the card. */
const SUMMARY_MAX = 240;
/** Stack frames worth carrying. The first few name the fault; the rest is React. */
const STACK_LINES = 12;

export type BoundaryError = (Error & { digest?: string }) | undefined | null;

function clamp(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  // Room for the ellipsis is taken OUT of the budget, or the clamped line
  // comes back two characters longer than the limit it was clamped to.
  return t.length <= max ? t : `${t.slice(0, max - 3).trimEnd()}...`;
}

/**
 * The one line that names the fault, or null when there is nothing to say.
 *
 * Next replaces a server-side message in production with a fixed sentence, so
 * on that path the digest is the only identifier and it is returned instead.
 * A client-side TypeError keeps its real message, which is the case this is
 * mostly for.
 */
export function errorSummary(error: BoundaryError): string | null {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  if (message && !/^an error occurred in the server/i.test(message)) {
    return clamp(message, SUMMARY_MAX);
  }
  return error?.digest ? `Server error ${error.digest}` : null;
}

/**
 * The whole thing, for the clipboard: what broke, where, when, and in what.
 *
 * `where` is passed in rather than read here so the caller decides (the global
 * boundary replaces the document and has no router to ask).
 */
export function errorReport(error: BoundaryError, where: string): string {
  const stack = typeof error?.stack === "string" ? error.stack.trim() : "";
  const lines = [
    `Studio Flows error`,
    `When: ${new Date().toISOString()}`,
    `Where: ${where || "unknown"}`,
    `What: ${error?.name ?? "Error"}: ${error?.message ?? "no message"}`,
  ];
  if (error?.digest) lines.push(`Reference: ${error.digest}`);
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    lines.push(`Browser: ${navigator.userAgent}`);
  }
  if (stack) {
    lines.push("", stack.split("\n").slice(0, STACK_LINES).join("\n"));
  }
  return lines.join("\n");
}

/** The page an error happened on, as much of it as is worth carrying. */
export function currentLocation(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}
