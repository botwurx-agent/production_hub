/**
 * Mentioning someone on a job by what they DO, not by their name.
 *
 * WHY ROLE-FIRST. On a commercial crew nobody knows everyone's name. The DP
 * knows there is a prop stylist; he does not necessarily know she is called
 * Amy. So the search matches the POSITION as readily as the name, which is how
 * people actually talk on a job ("tell the gaffer", "the prop stylist needs to
 * know"). The project roster already holds both, plus the email that makes the
 * note deliverable.
 *
 * WHAT IS STORED. Not this text. The comment body keeps the plain readable
 * sentence the author typed, and the CONTACT IDS are recorded in their own
 * rows (comment_mentions). Two reasons: no renderer has to learn a token
 * syntax, and a comment written in August still reads the way it was written
 * if somebody is renamed in September, which is right for a historical note.
 * These functions are the matching and the trust boundary, never the storage.
 *
 * FREE TEXT IS THE TRAP, the same lesson the shoot-day grouping taught.
 * `contacts.role` is a combobox seeded from a positions list but accepting
 * anything, so one roster can hold "Prop Stylist", "Props", and "Set Dresser /
 * Props". That is why the composer PICKS from matches rather than parsing what
 * was typed after the fact: a near miss that silently matches nobody is the
 * worst possible outcome for a note somebody is relying on.
 */

export type MentionCandidate = {
  id: string;
  name: string;
  /** The position, e.g. "Prop Stylist". Free text, often blank. */
  role: string | null;
  company: string | null;
  /** Roster category: crew | talent | extras | vendor | client. */
  type: string | null;
  email: string | null;
  /**
   * The account behind this roster entry, when there is one. Null is the
   * normal case: most crew on a job never sign up, and are reached by email.
   */
  userId: string | null;
};

/**
 * Who may be mentioned. CLIENTS ARE EXCLUDED, and this is a safety rule rather
 * than a tidiness one: the client sits on the same roster, and a crew member
 * casually mentioning "the client" would email the brand a note about an
 * internal problem. Talking to the client is what the review share links and
 * the Communication module are for, both of which are deliberate acts.
 */
export const MENTIONABLE_TYPES = ["crew", "talent", "extras", "vendor"];

export function isMentionable(c: MentionCandidate): boolean {
  return MENTIONABLE_TYPES.includes((c.type ?? "crew").toLowerCase());
}

/**
 * Abbreviations crew actually type. Deliberately short: these are the ones
 * said out loud on every job, and each expands to words that are then matched
 * normally, so an alias never bypasses the ranking.
 */
const ALIASES: Record<string, string> = {
  dp: "director of photography",
  dop: "director of photography",
  ac: "assistant camera",
  ad: "assistant director",
  pa: "production assistant",
  vtr: "video assist",
  em: "equipment manager",
  hmu: "hair makeup",
  mua: "makeup artist",
  props: "prop",
  swing: "set dresser",
};

/**
 * Lowercase, strip punctuation, drop a trailing plural "s" from each word.
 *
 * The plural rule earns its place: the first real use of this typed "prop
 * stylists", and a matcher that treats that as a different word from "Prop
 * Stylist" fails on the very first sentence. Applied to BOTH sides, so the
 * roster's own "Props" reduces to the same stem.
 */
export function normalizeTerm(s: string): string[] {
  const expanded = s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => (ALIASES[w] ? ALIASES[w].split(" ") : [w]));
  return expanded
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    // "of" and "the" carry no signal and would let any query match any role.
    .filter((w) => w !== "of" && w !== "the" && w !== "a");
}

/** Every word a candidate can be found by, already normalized. */
function haystack(c: MentionCandidate): { role: string[]; name: string[]; company: string[] } {
  return {
    role: normalizeTerm(c.role ?? ""),
    name: normalizeTerm(c.name ?? ""),
    company: normalizeTerm(c.company ?? ""),
  };
}

/** Do all query words appear as a prefix of some word in the target? */
function coversAll(query: string[], target: string[]): boolean {
  if (query.length === 0 || target.length === 0) return false;
  return query.every((q) => target.some((t) => t.startsWith(q)));
}

/**
 * Score a candidate against a typed query. Higher is better; 0 means no match.
 *
 * ROLE OUTRANKS NAME on purpose. Someone typing "prop" is reaching for a
 * function, and if a roster happened to hold a grip named Mr. Propper the
 * stylist should still come first.
 */
export function scoreCandidate(query: string, c: MentionCandidate): number {
  const q = normalizeTerm(query);
  // A query that REDUCED to nothing is not the same as no query at all.
  // "of the" normalizes away entirely, and treating that as an empty search
  // listed the whole roster, which reads as a match rather than as a miss.
  // matchMentions handles the genuinely blank input before it gets here.
  if (q.length === 0) return 0;
  const h = haystack(c);

  const roleExact = h.role.length > 0 && h.role.join(" ") === q.join(" ");
  if (roleExact) return 100;
  const nameExact = h.name.length > 0 && h.name.join(" ") === q.join(" ");
  if (nameExact) return 90;
  if (coversAll(q, h.role)) return 70;
  if (coversAll(q, h.name)) return 60;
  if (coversAll(q, [...h.role, ...h.name])) return 40;
  if (coversAll(q, h.company)) return 20;
  return 0;
}

/**
 * The candidates to offer for a typed query, best first.
 *
 * Ties break by name so the list does not reshuffle between keystrokes, which
 * is how a picker makes you select the wrong person.
 */
export function matchMentions(
  query: string,
  candidates: MentionCandidate[],
  limit = 8
): MentionCandidate[] {
  const blank = query.trim().length === 0;
  return candidates
    .filter(isMentionable)
    .map((c) => ({ c, s: blank ? 1 : scoreCandidate(query, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}

/** The text inserted into the comment: "@Amy Chen". */
export function mentionText(c: { name: string }): string {
  return `@${c.name.trim()}`;
}

/** The second line of a picker row: "Prop Stylist · REDEYE". */
export function mentionSubtitle(c: MentionCandidate): string {
  return [c.role?.trim(), c.company?.trim()].filter(Boolean).join(" · ");
}

/**
 * THE TRUST BOUNDARY. Ids arrive from the browser, so they are kept only if
 * they name a contact the server itself loaded for this project, and only if
 * that contact is mentionable. Everything else is dropped silently rather than
 * erroring: a stale id means the roster changed under an open composer, which
 * is not the author's fault and should not cost them their comment.
 */
export function validMentionIds(
  requested: unknown,
  allowed: MentionCandidate[]
): string[] {
  if (!Array.isArray(requested)) return [];
  const byId = new Map(allowed.filter(isMentionable).map((c) => [c.id, c]));
  const out: string[] = [];
  for (const r of requested) {
    if (typeof r !== "string") continue;
    if (!byId.has(r)) continue;
    if (out.includes(r)) continue;
    out.push(r);
    // A comment naming twenty people is a broadcast, not a mention, and every
    // name costs an email. Ten is well past any real "who needs to know this".
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * The address to actually send to, or null if there isn't a usable one.
 *
 * PASTED ADDRESSES ARRIVE DRESSED. A real roster on a real job had
 * "amymelissataylor@gmail.com>" in it, a leftover from copying "Name <addr>"
 * out of a mail client, and that would have bounced silently: the mention would
 * look sent, the stylist would never hear about it, and the feature would look
 * broken rather than the data. So the angle-bracket form is unwrapped, stray
 * brackets and whitespace are stripped, and anything that still does not look
 * like an address is treated as no address at all, which the picker then says
 * out loud rather than promising a delivery it cannot make.
 *
 * Deliberately a shallow check, not RFC validation: the job here is to catch
 * the copy-paste debris that actually occurs, not to adjudicate exotic but
 * legal addresses.
 */
export function cleanEmail(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  // "Amy Taylor <amy@example.com>" keeps only what is inside the brackets.
  const angled = t.match(/<([^>]+)>/);
  const candidate = (angled ? angled[1] : t).replace(/[<>\s]/g, "");
  if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(candidate)) return null;
  return candidate;
}

/** Whether this person can be reached at all, and how. */
export function reachOf(c: MentionCandidate): "app" | "email" | "none" {
  if (c.userId) return "app";
  return cleanEmail(c.email) ? "email" : "none";
}
