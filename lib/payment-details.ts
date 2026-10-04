/**
 * WHO ON THIS JOB CAN BE PAID BY ACH, and who would be posted a paper check.
 *
 * WHY THIS EXISTS. A vendor BILL has no bank details for is paid by posted
 * check (`payByType: CHECK`, `bankAccountStatus: NO_ACCOUNT`, observed on the
 * real account), and this studio pays freelancers by ACH and, in their words,
 * "at no point is a check ever written". The send window now refuses a check
 * at the moment of paying, which stops the wrong outcome but tells you at the
 * worst time: net 30, with the invoice in front of you. The honest moment is
 * WRAP, when everybody has finished and there is still a month to sort it out.
 *
 * THE STATE LIVES IN BILL, NEVER HERE. A DP booked four times a year connects
 * once, so "has this person connected" is a fact about their BILL vendor that
 * we read. A local flag would drift, which is the rule this codebase follows
 * for every derived value (the schedule's times, the task board's phase
 * labels, a budget line's actual).
 *
 * PURE, and NOT `server-only`, so it is testable: the same call as
 * invoice-draft, upload-limits and contact.
 */
import { payRail, railLabel, type PayRail, type VendorPayment } from "@/lib/bill-payable";

/**
 * The categories that get PAID. Clients do not, so they are not asked for
 * banking details, which would be an odd email to send the brand paying you.
 * Crew, talent, extras and vendors all do.
 */
export const PAYABLE_CATEGORIES = ["crew", "talent", "extras", "vendor"] as const;

export function isPayableCategory(type: string | null | undefined): boolean {
  return (PAYABLE_CATEGORIES as readonly string[]).includes((type ?? "").trim().toLowerCase());
}

/** A roster row, narrowed to what this question needs. */
export type RosterPerson = {
  id: string;
  name: string;
  email: string | null;
  type: string | null;
  role?: string | null;
};

/**
 * READ THE PAYMENT FIELDS OFF A BILL VENDOR BODY. Here rather than in
 * lib/bill.ts because that module is `server-only` and these field names are
 * the kind of thing that has to be ASSERTED against a real body: a first
 * version read `payByType` at the top level and it is nested.
 *
 * THE SHAPE, printed by /api/diagnostics/bill?invite= on a real vendor:
 *   { "paymentInformation": { "payByType": "CHECK", ... },
 *     "bankAccountStatus": "NO_ACCOUNT",
 *     "networkStatus": "NOT_CONNECTED" }
 * so the three really do sit at different depths. The top level is still read
 * as a FALLBACK rather than removed, since the LIST row's shape has not been
 * printed and may be flatter; nested wins when both carry a string.
 *
 * WHY THE BUG WAS INVISIBLE: with payByType unreadable the rail fell to the
 * NO_ACCOUNT backstop and still said "check", so the cheque refusal worked for
 * the wrong reason. An ACH-ready vendor would have read "BILL did not say".
 */
export function vendorPayment(row: unknown): VendorRowFields {
  const v = (row ?? {}) as {
    payByType?: unknown;
    bankAccountStatus?: unknown;
    networkStatus?: unknown;
    paymentInformation?: { payByType?: unknown } | null;
  };
  const nested = v.paymentInformation?.payByType;
  return {
    payByType:
      typeof nested === "string" ? nested : typeof v.payByType === "string" ? v.payByType : null,
    bankAccountStatus: typeof v.bankAccountStatus === "string" ? v.bankAccountStatus : null,
    networkStatus: typeof v.networkStatus === "string" ? v.networkStatus : null,
  };
}

export type VendorRowFields = VendorPayment & { networkStatus: string | null };

/** A BILL vendor, as the list endpoint gives it. */
export type VendorRow = VendorPayment & { id: string; name: string };

/**
 * `absent` is NOT a rail: it means BILL has never heard of this person, which
 * is a different problem from BILL knowing them and posting a check. Keeping
 * them apart is the whole point, since the next step differs.
 */
export type ReadinessState = PayRail | "absent";

export type Readiness = {
  contactId: string;
  name: string;
  email: string | null;
  category: string;
  role: string | null;
  /** The BILL vendor this person matched, when one exists. */
  vendorId: string | null;
  state: ReadinessState;
  /** What the row says, in the words a producer uses. */
  label: string;
  /** An invite cannot go to somebody with no address, whatever their state. */
  needsEmail: boolean;
};

/**
 * Names are matched the way the send already matches them, through
 * `vendorKey`, so this panel and the payment cannot disagree about whether
 * BILL already holds somebody. Duplicated rather than imported because
 * lib/bill.ts is `server-only` and this module is deliberately not.
 * IF ONE CHANGES, CHANGE BOTH: a drift here means the panel says "not at BILL"
 * about a vendor the send then finds, or the reverse.
 */
export function matchKey(name: string): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Just the people on this job who get paid, in roster order. */
export function payablePeople(rows: RosterPerson[]): RosterPerson[] {
  return (rows ?? []).filter((r) => r && typeof r.id === "string" && isPayableCategory(r.type));
}

function stateLabel(state: ReadinessState): string {
  if (state === "absent") return "Not at BILL yet";
  if (state === "ach") return "ACH ready";
  if (state === "check") return "Needs their bank details";
  return railLabel(state);
}

/**
 * Join the roster to BILL's vendors. ONE pass over a vendor list read once,
 * rather than a lookup per person: a roster of twenty would otherwise be
 * twenty round trips, and BILL has no token cache so each carries its own
 * cost.
 */
export function matchReadiness(people: RosterPerson[], vendors: VendorRow[]): Readiness[] {
  const byKey = new Map<string, VendorRow>();
  for (const v of vendors ?? []) {
    if (!v || typeof v.id !== "string") continue;
    const k = matchKey(v.name);
    // First wins, so a later duplicate cannot displace the vendor the send
    // would have found walking the same list in the same order.
    if (k && !byKey.has(k)) byKey.set(k, v);
  }

  return payablePeople(people).map((p) => {
    const vendor = byKey.get(matchKey(p.name)) ?? null;
    const state: ReadinessState = vendor ? payRail(vendor) : "absent";
    const email = (p.email ?? "").trim() || null;
    return {
      contactId: p.id,
      name: p.name,
      email,
      category: (p.type ?? "").trim().toLowerCase() || "crew",
      role: (p.role ?? "").trim() || null,
      vendorId: vendor?.id ?? null,
      state,
      label: stateLabel(state),
      needsEmail: !email,
    };
  });
}

export type ReadinessTally = {
  total: number;
  /** Money can go out electronically to these. */
  ach: number;
  /** BILL would post a paper check: the ones to chase. */
  check: number;
  /** BILL has never heard of them. */
  absent: number;
  /** Virtual card, or a method BILL did not name. Worth a look, not a chase. */
  other: number;
};

export function readinessTally(rows: Readiness[]): ReadinessTally {
  const t: ReadinessTally = { total: 0, ach: 0, check: 0, absent: 0, other: 0 };
  for (const r of rows ?? []) {
    t.total += 1;
    if (r.state === "ach") t.ach += 1;
    else if (r.state === "check") t.check += 1;
    else if (r.state === "absent") t.absent += 1;
    else t.other += 1;
  }
  return t;
}

/**
 * The one-line answer, for a button or a prompt at wrap. Null when there is
 * nothing to say, so a caller can hide itself rather than printing "0 people
 * need anything", which is noise on every job that is already sorted.
 */
export function readinessSummary(t: ReadinessTally): string | null {
  if (t.total === 0) return null;
  const waiting = t.check + t.absent;
  if (waiting === 0) return null;
  const who = waiting === 1 ? "1 person" : `${waiting} people`;
  return `${who} on this job cannot be paid by ACH yet`;
}

/**
 * WHO A COST'S VENDOR NAME IS, when nothing linked it to the roster.
 *
 * A cost carries `contact_id` only when the vendor was PICKED from the roster.
 * One typed by hand, or drafted from an emailed invoice whose vendor matching
 * found nothing, carries a NAME and no link. Without this the app says "nobody
 * will be emailed" about somebody whose address it is holding on the same
 * project's roster.
 *
 * WHAT THE REAL DATA SAYS, checked rather than assumed: all five costs on the
 * operator's own books are linked and carry a real email, so the common path
 * was already covered and this is the edge. The four unlinked ones are the
 * DEMO studio's seed rows. The gap is real anyway, because the two ways to
 * produce an unlinked cost (typing a vendor name, and an invoice draft whose
 * vendor matching returns null, which it does by design rather than guess) are
 * both ordinary.
 *
 * THE MATCH IS DELIBERATELY STRICTER THAN THE INVOICE EXTRACTOR'S. That one
 * takes containment, so "Jane Doe" matches "Jane Doe Lighting LLC", which is
 * fine for filing a cost against a budget line and is NOT fine here: the
 * consequence of a wrong match is telling a stranger money is on its way to
 * them. So:
 *   - exact equality on the normalised key, never containment,
 *   - exactly one candidate, since two people with the same name is a question
 *     for a human rather than a coin toss,
 *   - payable categories only, so a client contact can never be told the
 *     studio has paid them,
 *   - and an address is required, because a match with no email answers
 *     nothing.
 * Anything short of that returns null and the cost reads as having nobody to
 * write to, which is the safe direction.
 */
export function matchRosterVendor(
  vendorName: string | null | undefined,
  roster: RosterPerson[],
): RosterPerson | null {
  const key = matchKey(vendorName ?? "");
  // A one or two character key is not a name, it is whatever survived
  // normalising punctuation, and it would match far too much.
  if (key.length < 3) return null;
  const hits = payablePeople(roster).filter(
    (p) => matchKey(p.name) === key && (p.email ?? "").trim(),
  );
  return hits.length === 1 ? hits[0] : null;
}
