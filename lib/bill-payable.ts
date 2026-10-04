/**
 * HOW BILL WILL ACTUALLY MOVE THE MONEY, read off the vendor rather than
 * assumed.
 *
 * WHY THIS EXISTS. A vendor BILL has no bank details for is paid by POSTED
 * PAPER CHECK, and the send window never said so: it named the vendor, the
 * amount, the invoice and the bank account it pays FROM, and left out the
 * rail. The operator pays freelancers by ACH and, in their words, "at no point
 * is a check ever written", so a press that posts one is the wrong outcome
 * arriving silently.
 *
 * ONLY `payByType` GRANTS a rail. A vendor with a bank account on file can
 * still be set to virtual card, so "they have an account" is not evidence of
 * ACH. The bank status can only ever WITHHOLD, never grant, which is the same
 * direction lib/bill-settled.ts takes with an outstanding amount.
 *
 * UNKNOWN IS NOT CHECK AND NOT ACH. It is reported as unknown and the window
 * says so, because a field BILL renames would otherwise either block every
 * payment (if unknown blocked) or quietly post cheques (if unknown allowed).
 * The one thing it must never do is read as ACH.
 */

/** The rails worth telling apart. `card` is BILL's virtual card, not ACH. */
export type PayRail = "ach" | "check" | "card" | "unknown";

export type VendorPayment = {
  /** BILL's own field. OBSERVED: "CHECK" fresh, "WALLET" once connected. */
  payByType: string | null;
  /** OBSERVED: "NO_ACCOUNT" fresh, "NET_LINKED_ACCOUNT" once connected. */
  bankAccountStatus: string | null;
};

function norm(v: unknown): string {
  return typeof v === "string" ? v.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}

// Matched against a whitelist after normalising, never by pattern: "check"
// is a substring of nothing useful, but the lesson from `/paid/i` matching
// "UNPAID" is that a pattern test against a money decision is how a silent
// disaster ships.
//
// `wallet` IS BILL'S WORD FOR A CONNECTED VENDOR and is the one value here
// OBSERVED on a real payable vendor rather than reasoned about. A freelancer
// who took the invite and linked their own bank comes back
// `payByType: "WALLET"` with `bankAccountStatus: "NET_LINKED_ACCOUNT"` and a
// VERIFIED bank account under `paymentInformation.bankAccount`, against
// `CHECK` / `NO_ACCOUNT` / `NOT_CONNECTED` on a vendor who has not. Without
// it the person this whole flow exists to reach reads as "BILL did not say",
// which is how it was found: an ACH-ready freelancer sat on the readiness
// panel as a gap.
const ACH = new Set(["ach", "achcredit", "directdeposit", "epayment", "eft", "wallet"]);
const CHECK = new Set(["check", "papercheck", "mailedcheck"]);
const CARD = new Set(["virtualcard", "card", "vcard"]);

/** No bank details on file, so BILL posts a cheque whatever else is set. */
const NO_ACCOUNT = new Set(["noaccount", "none", "notconnected"]);

export function payRail(v: VendorPayment): PayRail {
  const by = norm(v.payByType);
  if (ACH.has(by)) return "ach";
  if (CHECK.has(by)) return "check";
  if (CARD.has(by)) return "card";
  // Nothing readable in payByType. A vendor with NO bank account on file is
  // paid by cheque, which is the one case worth asserting without it.
  if (NO_ACCOUNT.has(norm(v.bankAccountStatus))) return "check";
  return "unknown";
}

/** What the window prints next to the amount. */
export function railLabel(rail: PayRail): string {
  if (rail === "ach") return "ACH deposit";
  if (rail === "check") return "Posted paper check";
  if (rail === "card") return "Virtual card";
  return "BILL did not say";
}

/**
 * Whether paying is refused. ONLY an explicit cheque refuses: unknown is
 * warned about and allowed, because blocking on a field we could not read
 * would take the feature down for everybody the first time BILL renames one,
 * with nothing the studio could do about it from their side.
 */
export function payRefused(rail: PayRail): boolean {
  return rail === "check";
}

/** The sentence shown when paying is refused or uncertain. Empty when fine. */
export function railWarning(rail: PayRail, vendor: string): string {
  if (rail === "check") {
    return `BILL has no bank details for ${vendor}, so paying from here would post a paper check. Add their bank details at BILL, or ask them for their payment details, then pay.`;
  }
  if (rail === "card") {
    return `BILL is set to pay ${vendor} by virtual card rather than ACH. Change it at BILL if that is not what you want.`;
  }
  if (rail === "unknown") {
    return `BILL did not say how ${vendor} gets paid. Check their payment method at BILL before paying from here.`;
  }
  return "";
}
