// Does BILL consider this bill settled?
//
// PURE AND NOT `server-only` ON PURPOSE, so it can be unit tested. It exists as
// its own module because the first version of this test was one line inside the
// sync loop and was WRONG IN TWO INDEPENDENT WAYS, either of which marked every
// bill in the studio as paid:
//
//   const paid = /paid/i.test(state.paymentStatus) || state.dueAmount <= 0;
//
//   (1) `/paid/i` MATCHES "UNPAID". It is a substring test, and both "UNPAID"
//       and "PARTIALLY_PAID" contain it.
//   (2) AN ABSENT FIELD WOULD READ AS SETTLED. dueAmount came through
//       `Number(b.dueAmount ?? 0) || 0`, so a bill not carrying that field at
//       all arrived as 0, and 0 <= 0 is true. CORRECTION, recorded because it
//       was first written up as a co-cause: this one did NOT fire on the real
//       incident. The body was later read and carried `dueAmount: 3959.83`,
//       present and exactly the bill's amount, so only (1) ever ran. It stays
//       guarded as a latent hazard, not as an explanation.
//
// It cost a false "paid" on a real $3,959.83 bill to a real freelancer, which
// is not a cosmetic bug: a paid cost leaves "Still owed", leaves the dashboard's
// unpaid list, and becomes eligible for the remittance email that tells a vendor
// their payment has been sent.
//
// SO THIS FAILS CLOSED. Only a status BILL states explicitly can mark a bill
// settled; anything unrecognised, empty or absent means not settled, and the
// outstanding amount can only ever WITHHOLD that verdict, never grant it.

export type BillBillState = {
  /** BILL's own word, verbatim. Empty when it sent none. */
  paymentStatus: string;
  /** What is still owed, or NULL when BILL did not report it. Never coerce an
   *  absent value to a number here: that is bug (2) above. */
  dueAmount: number | null;
  /** How many payments BILL has recorded against the bill, or NULL when it did
   *  not report the array. Corroboration only, see below. */
  paymentCount: number | null;
};

/** Lower-cased with every non-alphanumeric character removed, so PAID,
 *  "Paid In Full" and PAID_IN_FULL all compare as one thing. */
export function normalizeBillStatus(status: unknown): string {
  return typeof status === "string" ? status.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}

/**
 * A WHITELIST, never a pattern. A value BILL invents tomorrow, or a typo, or a
 * blank reads as not settled, which leaves a cost sitting in "Still owed" until
 * somebody looks. That is the right direction to be wrong in.
 */
const SETTLED = new Set([
  "paid",
  "paidinfull",
  "fullypaid",
  "complete",
  "completed",
]);

export function billSettled(state: BillBillState): boolean {
  // A stated outstanding balance is the one thing that can overrule everything
  // below. It is never what grants the verdict, so an absent or unreadable
  // amount changes nothing rather than meaning zero.
  if (state.dueAmount !== null && Number.isFinite(state.dueAmount) && state.dueAmount > 0) {
    return false;
  }
  if (SETTLED.has(normalizeBillStatus(state.paymentStatus))) return true;

  // SECOND ROUTE, because the whitelist is still a guess in one direction. An
  // UNPAID bill has been read in full (dueAmount equal to the amount, an empty
  // payments array, paymentStatus "UNPAID"); a PAID one never has, so if BILL's
  // settled word is not in the set above this would fail closed forever and the
  // feature would silently never complete.
  //
  // It needs TWO facts that must both be PRESENT and specific: nothing left to
  // pay, AND at least one payment actually recorded. Neither can be produced by
  // an absence, which is what makes this safe to add on one observation, and
  // together they cannot fire on the unpaid bill that was read.
  const owesNothing = state.dueAmount !== null && Number.isFinite(state.dueAmount) && state.dueAmount <= 0;
  const hasPayment = state.paymentCount !== null && state.paymentCount > 0;
  return owesNothing && hasPayment;
}
