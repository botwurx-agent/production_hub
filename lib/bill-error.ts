// Reading a refusal out of BILL's responses.
//
// WHY THIS IS ITS OWN MODULE, and the FreshBooks round is the argument: a
// provider's own sentence naming the cause is the entire diagnosis, and it was
// being flattened into an Error nobody read and posted to a Sentry that is
// inert here. So the sentence is extracted, kept, and shown.
//
// BILL ANSWERS IN THREE SHAPES, all three seen while proving the chain:
//   1. The v2 endpoints (ListOrgs) answer HTTP 200 with the failure INSIDE:
//      {"response_status": 1, "response_message": "...",
//       "response_data": {"error_code": "BDC_1102", "error_message": "..."}}
//      A status code is therefore worth nothing on that path.
//   2. The v3 gateway answers a real status with an ARRAY of problems:
//      [{"message": "address: must not be null", "severity": "ERROR"}]
//      Several at once, each naming one field, which is how every field shape
//      in this integration was learned.
//   3. A single object carrying `message`, occasionally with a `code`.
//
// Pure and NOT "server-only", so it can be unit tested.

/** Codes worth recognising, each learned from being hit. */
export const BILL_CODES = {
  BAD_DEV_KEY: "BDC_1102",
  RATE_LIMIT: "BDC_1144",
  CONCURRENCY: "BDC_1322",
  MFA_EXPIRED: "BDC_1356",
  NO_ONLINE_PAYMENT: "BDC_1151",
} as const;

type Problem = { message?: unknown; error_message?: unknown; code?: unknown; error_code?: unknown };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Every problem BILL named, in order, deduped. An empty array means the body
 * carried nothing readable, which is itself worth saying rather than inventing
 * a reason.
 */
export function billProblems(body: unknown): string[] {
  const out: string[] = [];
  // DEDUPE ON THE SENTENCE, NOT THE STRING. BILL answers a refused payment
  // with its reason twice: once plainly, and once more keyed by the id of the
  // thing that failed ("00n02... : This vendor is unable to receive
  // ePayments..."). Exact-string dedupe cannot see that they are the same
  // sentence, so the toast said it twice and pushed the advice off the end of
  // a long red box, at the moment somebody most needs to read it.
  //
  // THE FIRST FORM WINS, whichever it is: an id-prefixed problem arriving on
  // its own is kept whole, since the id names which bill failed and nothing
  // else would.
  const seen = new Set<string>();
  const push = (v: unknown) => {
    const s = str(v);
    if (!s) return;
    const key = s.replace(/^[0-9A-Za-z]{8,40}\s*:\s*(?=\S)/, "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  const visit = (node: unknown, depth = 0) => {
    if (!node || depth > 4) return;
    if (Array.isArray(node)) {
      for (const n of node.slice(0, 40)) visit(n, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const o = node as Problem & { response_data?: unknown; errors?: unknown };
    push(o.message);
    push(o.error_message);
    // response_data carries the real reason on the v2 path, where the HTTP
    // status is a lie.
    if (o.response_data) visit(o.response_data, depth + 1);
    if (o.errors) visit(o.errors, depth + 1);
  };

  visit(body);
  return out;
}

/** The first code BILL named, if any. */
export function billCode(body: unknown): string | null {
  let found: string | null = null;
  const visit = (node: unknown, depth = 0) => {
    if (found || !node || depth > 4) return;
    if (Array.isArray(node)) {
      for (const n of node.slice(0, 40)) visit(n, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const o = node as Problem & { response_data?: unknown };
    const c = str(o.code) || str(o.error_code);
    if (/^BDC_\d+$/.test(c)) {
      found = c;
      return;
    }
    if (o.response_data) visit(o.response_data, depth + 1);
  };
  visit(body);
  return found;
}

/**
 * Did this call work? On the v2 path the body decides, never the status, which
 * is the single most expensive thing the FreshBooks round taught: a 200 with
 * an empty or failed body read as success for a week.
 */
export function billSucceeded(status: number, body: unknown): boolean {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const rs = (body as { response_status?: unknown }).response_status;
    if (typeof rs === "number") return rs === 0;
  }
  return status >= 200 && status < 300;
}

/**
 * One sentence a person can act on. It leads with BILL's own words, because
 * theirs name the field or the permission and ours can only guess, and it adds
 * a plain next step ONLY for the cases where there genuinely is one.
 */
export function billFailure(status: number, body: unknown): string {
  const problems = billProblems(body);
  const code = billCode(body);
  const said = problems.slice(0, 3).join(" ");

  let advice = "";
  if (code === BILL_CODES.BAD_DEV_KEY) {
    // Twice this message named the wrong thing: once it was a stray character
    // on the stored key, once the username belonged to the other environment.
    advice =
      " BILL reports this as an invalid developer key, which it also says when the login belongs to a different BILL environment, so check both before changing the key.";
  } else if (code === BILL_CODES.RATE_LIMIT) {
    advice = " This is BILL's rate limit rather than anything wrong with the request. Wait and try again.";
  } else if (code === BILL_CODES.MFA_EXPIRED) {
    advice = " The code expired. Ask for a new one and enter it straight away.";
  } else if (code === BILL_CODES.NO_ONLINE_PAYMENT) {
    advice =
      " The bank account BILL is being asked to pay from cannot make online payments. Check in BILL that it is verified and enabled for payments.";
  } else if (/unable to receive ePayments/i.test(said)) {
    // NAMES BOTH AND PICKS NEITHER, the shape the FreshBooks round arrived at
    // after asserting a plan tier on a pricing page and being wrong.
    //
    // BILL's own sentence says the vendor's bank is not set up, and on the one
    // real refusal of this feature that was FALSE: the vendor read
    // payByType WALLET, bankAccountStatus NET_LINKED_ACCOUNT, networkStatus
    // CONNECTED and carried a VERIFIED checking account, and BILL's own
    // payer-facing vendor page said Connected and ePayment. What the refusal
    // actually was, found by opening the same payment in BILL's own interface:
    // "this payment isn't included with your current Basic Receivables plan".
    //
    // So the sentence points at the one party who cannot fix it. One
    // observation is not a mapping, though, and a vendor bank genuinely can be
    // unfinished, so this says to check the plan FIRST because that check is
    // free and ours to make, without claiming it is the cause.
    advice =
      " BILL says this is the vendor's bank setup. It said exactly that once when the real cause was the BILL PLAN not including payments, which the vendor cannot fix, so open this bill on BILL's own Pay screen first: it states a plan limit plainly. If the plan is fine, then it is the vendor's own account setup at BILL.";
  } else if (status === 401) {
    advice = " The sign-in was refused, so the stored username or password is no longer right. Reconnect BILL.";
  }

  if (said) return `BILL refused this: ${said}${advice}`;
  if (advice) return `BILL refused this (${code ?? status}).${advice}`;
  return `BILL refused this and gave no reason (HTTP ${status}).`;
}
