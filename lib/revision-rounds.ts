/**
 * Revision rounds: how many times the CLIENT has sent a deliverable back,
 * against how many rounds the SOW includes.
 *
 * A round is SPENT when the client requests changes on a version through a
 * review link. That is the event a contract counts, and it is the one moment
 * a studio needs to know about: "they asked again, and this one is outside
 * scope". Three things deliberately do not count:
 * - a version the studio uploaded and never showed the client,
 * - the studio's own internal "request changes" (review_link_id is null),
 * - a version the client first sent back and then approved (the approval row
 *   is updated in place, so it no longer reads as changes requested).
 *
 * Derived from approvals every time, never stored, so it cannot drift.
 * Pure and not `server-only`, so it is testable and the page and the
 * notification read the same rule.
 */

export const MAX_ROUNDS = 20;

export type RoundApproval = {
  status: string;
  review_link_id?: string | null;
};

/** Versions the client has sent back, one round each. */
export function clientRoundsUsed(
  versions: { approvals: RoundApproval[] }[]
): number {
  return versions.filter((v) =>
    v.approvals.some(
      (a) => a.review_link_id != null && a.status === "changes_requested"
    )
  ).length;
}

export type RoundTone = "ok" | "last" | "over";

export type RoundState = {
  used: number;
  included: number;
  tone: RoundTone;
  label: string;
};

/** Null when the project does not track rounds. */
export function roundState(
  used: number,
  included: number | null | undefined
): RoundState | null {
  if (included == null || !Number.isFinite(included)) return null;
  const inc = Math.max(0, Math.floor(included));
  const u = Math.max(0, Math.floor(Number.isFinite(used) ? used : 0));
  if (u > inc) {
    const over = u - inc;
    return {
      used: u,
      included: inc,
      tone: "over",
      label: `${u} of ${inc} revision ${inc === 1 ? "round" : "rounds"} used, ${over} over`,
    };
  }
  if (u === inc) {
    return {
      used: u,
      included: inc,
      tone: "last",
      label:
        inc === 0
          ? "No revision rounds included"
          : `${u} of ${inc} revision ${inc === 1 ? "round" : "rounds"} used, next is extra`,
    };
  }
  return {
    used: u,
    included: inc,
    tone: "ok",
    label: `${u} of ${inc} revision ${inc === 1 ? "round" : "rounds"} used`,
  };
}

/**
 * The note added to a client "changes requested" notification, or null when
 * there is nothing worth saying. `used` already counts the request just made.
 */
export function roundNote(
  used: number,
  included: number | null | undefined
): string | null {
  const s = roundState(used, included);
  if (!s || s.used === 0) return null;
  if (s.tone === "over") return `round ${s.used}, ${s.included} included`;
  if (s.tone === "last") return `last of ${s.included} included rounds`;
  return null;
}

/** The trust boundary for a value arriving from the browser. */
export function parseRounds(raw: unknown): number | null {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (str === "") return null;
  if (!/^\d{1,2}$/.test(str)) return null;
  const n = Number(str);
  return n >= 0 && n <= MAX_ROUNDS ? n : null;
}
