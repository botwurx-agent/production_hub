// Can BILL do what FreshBooks Bill Pay could not: create the vendor, create
// the bill, and pay it?
//
// WHY THIS EXISTS BEFORE ANY FEATURE CODE. The FreshBooks probe was built
// AFTER four rounds of guessing, and the thing that finally answered it was
// printing the RESPONSE BODY rather than the status code: their vendor list
// returned 200 with an empty array for a week while we read that as working.
// BILL does the same in its own way, answering HTTP 200 with
// `response_status: 1` and the real error inside, so a status code is worth
// even less here. Every body is printed, success included, and every step is
// caught SEPARATELY so a refusal names which call was refused.
//
// IT FINDS ITS OWN ENVIRONMENT. BILL's sandbox and production share no data
// and need different developer keys, and their sign-up does not make clear
// which you have ended up with. So step one asks BOTH hosts which
// organizations the key can see. That is a read: it creates nothing, on
// either side.
//
// WRITES ARE SANDBOX ONLY, AS AN INVARIANT RATHER THAN A SETTING. If the key
// turns out to be a production key, the create and pay steps are refused by
// this file no matter what is in the URL.
//
// THE FUNDING ACCOUNT IS THE LAST UNKNOWN. A payment was refused for
// `fundingAccount: must not be null` and `processingOptions: must not be
// null`, and a sandbox org cannot have a real bank account attached to it. So
// three questions, each its own step and its own body: does the org already
// carry a funding account, can a dummy one be created, and does BILL insist
// on verifying it before it will pay. None of those can be answered from the
// docs, which are egress blocked from here.
//
// Staff only, same gate as the FreshBooks probe.
import { NextResponse } from "next/server";
import { getStudioContext } from "@/lib/studio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOSTS = {
  sandbox: { api: "https://gateway.stage.bill.com/connect", orgs: "https://api-stage.bill.com/api/v2/ListOrgs.json" },
  production: { api: "https://gateway.prod.bill.com/connect", orgs: "https://api.bill.com/api/v2/ListOrgs.json" },
} as const;

type Env = keyof typeof HOSTS;

// THE ONE REAL ACCOUNT THIS MAY TOUCH, written here rather than read from a
// setting. The whole point is that no environment variable, no URL and no
// later edit elsewhere can point the writing half of this probe at somebody
// else's books: an organization id that is not in this list gets the
// read-only branch, exactly as before. Botwurx LLC is the operator's own
// studio, standing in for a customer of Studio Flows.
// NOT YET USED. The write path for a real account is not built: the
// read-only branch below still refuses every real organization, this list
// included. It is here because the SCOPE is the part worth deciding in
// advance, and deciding it in a constant is what stops it later becoming a
// setting somebody can point anywhere.
const WRITABLE_REAL_ORGS = ["00802ZJVYBVTJQZ2y1xh"];
void WRITABLE_REAL_ORGS;

// A probe is not a payment tool. A real-account press over this is refused,
// so a mistyped amount cannot become a four-figure one.
const REAL_AMOUNT_CAP = 10000;
void REAL_AMOUNT_CAP;

// Enough body to diagnose from, not so much that a stack of them is a wall.
const BODY_CHARS = 1500;

// BUMP THIS WITH EVERY CHANGE. Two rounds were spent reading a response from
// a build that had not finished deploying, which is indistinguishable from a
// real answer unless the response says which code produced it.
const PROBE = "2026-10-03-j";

type Step = { what: string; request: string; status: number; ok: boolean; body: string };

/** A session id or a password in a body is a live credential, so it never
 *  leaves here, even though only the operator can open this page. */
function redact(text: string, secrets: string[]) {
  let out = text;
  for (const s of secrets) if (s && s.length > 6) out = out.split(s).join("[redacted]");
  return out;
}

/** BILL answers 200 and puts the failure in the body, so "did it work" is a
 *  question about the body, never about the status. */
function billOk(text: string) {
  try {
    const j = JSON.parse(text) as { response_status?: number };
    if (typeof j.response_status === "number") return j.response_status === 0;
  } catch {}
  return true;
}

export async function GET(req: Request) {
  const ctx = await getStudioContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (ctx.isCollaborator) {
    return NextResponse.json({ error: "Not available on this account." }, { status: 403 });
  }

  const url = new URL(req.url);

  // REACHING THE REAL ACCOUNT TAKES ITS OWN URL AND ITS OWN VARIABLES. A
  // separate set rather than swapping the existing ones, for two reasons: the
  // sandbox keeps working, so a shape can still be learned for free, and
  // BILL's developer keys are per environment, so these are different values
  // and not just a different login.
  const real = url.searchParams.get("env") === "production";
  const raw = real
    ? {
        devKey: process.env.BILL_PROD_DEV_KEY ?? "",
        username: process.env.BILL_PROD_USERNAME ?? "",
        password: process.env.BILL_PROD_PASSWORD ?? "",
        orgId: process.env.BILL_PROD_ORG_ID ?? "",
      }
    : {
        devKey: process.env.BILL_DEV_KEY ?? "",
        username: process.env.BILL_USERNAME ?? "",
        password: process.env.BILL_PASSWORD ?? "",
        orgId: process.env.BILL_ORG_ID ?? "",
      };
  const devKey = raw.devKey.trim();
  const username = raw.username.trim();
  const password = raw.password.trim();
  const orgId = raw.orgId.trim();

  // Never the values. Enough shape to see whether what reached the function
  // is the same thing as last time, which is the one question a repeated
  // "Developer key is invalid" cannot answer on its own.
  const fingerprint = {
    devKey: `${devKey.length} chars, ends ${devKey.slice(-4) || "?"}${raw.devKey !== devKey ? ", HAD WHITESPACE" : ""}`,
    username: `${username.length} chars, ${username.split("@")[1] ?? "no domain"}${raw.username !== username ? ", HAD WHITESPACE" : ""}`,
    password: `${password.length} chars${raw.password !== password ? ", HAD WHITESPACE" : ""}`,
    orgId: orgId ? `${orgId.length} chars, ends ${orgId.slice(-4)}` : "not set",
  };
  const prefix = real ? "BILL_PROD_" : "BILL_";
  const missing = [
    !devKey && `${prefix}DEV_KEY`,
    !username && `${prefix}USERNAME`,
    !password && `${prefix}PASSWORD`,
  ].filter(Boolean);
  if (missing.length) {
    return NextResponse.json({ error: `Not set here: ${missing.join(", ")}` }, { status: 400 });
  }

  const write = url.searchParams.get("write") === "1";
  const pay = url.searchParams.get("pay") === "1";
  const addBank = url.searchParams.get("bank") === "1";
  const verifyAmount = (url.searchParams.get("verify") ?? "").trim();

  const steps: Step[] = [];
  const secrets = [password, devKey];
  let sessionId = "";

  function record(what: string, request: string, status: number, ok: boolean, text: string) {
    steps.push({
      what,
      request,
      status,
      ok,
      // ALWAYS, success included. An empty list behind a 200 is the failure
      // mode that cost the last round, and only the body shows it.
      body: redact(text, [...secrets, sessionId]).slice(0, BODY_CHARS),
    });
  }

  /** Which organizations can this key see on this host? Read only. */
  async function askOrgs(env: Env) {
    let status = 0;
    let text = "";
    try {
      const res = await fetch(HOSTS[env].orgs, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ devKey, userName: username, password }),
      });
      status = res.status;
      text = await res.text();
    } catch (e) {
      text = `NETWORK FAILURE: ${e instanceof Error ? e.message : "unknown"}`;
    }
    const ok = status === 200 && billOk(text);
    record(`is this a ${env} key?`, `POST ${HOSTS[env].orgs}`, status, ok, text);
    return ok;
  }

  // STEP 0. Which host. Asked for the real account, only that host is tried,
  // because a fallback to the sandbox on a bad credential would silently run
  // the wrong test. Otherwise both are asked, since BILL's sign-up does not
  // say which kind of key you ended up with.
  const sandboxOk = real ? false : await askOrgs("sandbox");
  // Reads as before: production is asked only when the sandbox did not
  // answer, which is always the case when the real account was asked for,
  // since the sandbox is not tried at all then.
  const prodOk = sandboxOk ? false : await askOrgs("production");
  const env: Env | null = sandboxOk ? "sandbox" : prodOk ? "production" : null;

  if (!env) {
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: "unknown",
      reading:
        "Neither host accepted this developer key. Read the two bodies: 'Developer key is invalid' on both means the key is not active yet or was copied with a stray character. Nothing was created.",
      steps,
    });
  }

  const API = HOSTS[env].api;
  // THE OLDER API, which is a different host and a different encoding rather
  // than a different path: form encoded, one endpoint per file name, and the
  // failure inside a 200. The invite probe below needs it because the endpoint
  // titled "invite a vendor not in the BILL network", which is every
  // freelancer, lives there and has no v3 equivalent we can see.
  const V2 = HOSTS[env].orgs.replace(/ListOrgs\.json$/, "");

  if (!orgId) {
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      reading:
        `The key works and it is a ${env.toUpperCase()} key. The body above lists the organizations it can see; an organization id begins with 008. Add it as BILL_ORG_ID in Vercel and press this again.` +
        (env === "production"
          ? " NOTE: this is production, so this probe will READ only and will refuse to create or pay anything."
          : ""),
      steps,
    });
  }

  /** One API call. Never throws: a probe that falls over on the first refusal
   *  tells you less than the one it replaces. */
  async function call(what: string, method: "GET" | "POST", path: string, body?: unknown) {
    const target = `${API}/v3${path}`;
    const headers: Record<string, string> = { "Content-Type": "application/json", devKey };
    if (sessionId) headers.sessionId = sessionId;
    let status = 0;
    let ok = false;
    let text = "";
    try {
      const res = await fetch(target, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      status = res.status;
      text = await res.text();
      // After the body, never before: with BILL the body is what says whether
      // the call worked, and res.ok alone is close to meaningless.
      ok = res.ok && billOk(text);
    } catch (e) {
      text = `NETWORK FAILURE: ${e instanceof Error ? e.message : "unknown"}`;
    }
    record(what, `${method} ${target}`, status, ok, text);
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status, ok, json };
  }

  /** One v2 call. Form encoded, payload as a JSON string in `data`, and the
   *  real answer inside a 200, so `ok` asks the body exactly as above. */
  async function v2call(what: string, endpoint: string, session: string, data: unknown) {
    const target = `${V2}${endpoint}.json`;
    let status = 0;
    let ok = false;
    let text = "";
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ devKey, sessionId: session, data: JSON.stringify(data) }),
      });
      status = res.status;
      text = await res.text();
      ok = res.ok && billOk(text);
    } catch (e) {
      text = `NETWORK FAILURE: ${e instanceof Error ? e.message : "unknown"}`;
    }
    record(what, `POST ${target}`, status, ok, text);
    return { status, ok, body: text };
  }

  /** A v2 session, which may or may not be the same thing as a v3 one. That
   *  question is half of what the invite probe exists to answer, so it is
   *  asked rather than assumed. */
  async function v2login() {
    let status = 0;
    let text = "";
    try {
      const res = await fetch(`${V2}Login.json`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ devKey, userName: username, password, orgId }),
      });
      status = res.status;
      text = await res.text();
    } catch (e) {
      text = `NETWORK FAILURE: ${e instanceof Error ? e.message : "unknown"}`;
    }
    const ok = status === 200 && billOk(text);
    let id = "";
    try {
      const j = JSON.parse(text) as { response_data?: { sessionId?: unknown } };
      const sid = j.response_data?.sessionId;
      if (typeof sid === "string") id = sid;
    } catch {}
    if (id) secrets.push(id);
    record("sign in to the older API", `POST ${V2}Login.json`, status, ok, text);
    return id;
  }

  // STEP 1: sign in. Nothing below means anything without this.
  // `fresh=1` WITHHOLDS the remembered id, so this signs in UNTRUSTED, which is
  // the state the app's own connect flow is always in. Without it the probe
  // presents BILL_REMEMBER_ME_ID, comes back trusted, and is therefore not a
  // like-for-like comparison with the thing being diagnosed.
  const fresh = url.searchParams.get("fresh") === "1";
  const rememberMeId = fresh ? "" : (process.env.BILL_REMEMBER_ME_ID ?? "").trim();
  // `device=...` overrides the device string sent on validate, so the ONE
  // remaining difference between this working path and the app's failing one
  // can be tested on its own. The app sends a 49-character id; this has always
  // sent 19, and BILL has twice now reported a problem by naming something
  // other than its real cause.
  const device = (
    url.searchParams.get("device") ??
    process.env.BILL_DEVICE_ID ??
    "studio-flows-server"
  ).trim();
  const login = await call("sign in", "POST", "/login", {
    username,
    password,
    organizationId: orgId,
    devKey,
    // Presenting a remembered MFA id is what makes a session TRUSTED, which
    // paying a bill requires. Sent only once one has been obtained.
    ...(rememberMeId ? { rememberMeId, device } : {}),
  });
  sessionId = (login.json as { sessionId?: string } | null)?.sessionId ?? "";
  if (!sessionId) {
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      reading: "No sessionId came back, so nothing else could run. The body names the reason.",
      steps,
    });
  }

  // STEP 2: is this session MFA trusted? Paying a bill needs one. An earlier
  // version called /v3/session for this and got a 404: there is no such path,
  // and the LOGIN response already carries it, so read it from there.
  // The login step's body was recorded BEFORE sessionId was known, so the
  // redaction list did not yet contain it and a live session id was printed.
  // Sweep every step already taken now that it is.
  for (const st of steps) st.body = redact(st.body, [sessionId]);

  const trusted = (login.json as { trusted?: boolean } | null)?.trusted === true;

  // MFA, on request only. ?mfa=1 asks BILL to send a challenge code, and
  // ?mfacode=... validates it with rememberMe set, which is what mints the
  // remembered id. Separate presses because the first SENDS A TEXT, and a
  // probe that fires one on every press is a probe nobody presses.
  const mfaAsk = url.searchParams.get("mfa") === "1";
  const mfaCode = (url.searchParams.get("mfacode") ?? "").trim();
  const challengeId = (url.searchParams.get("challengeid") ?? "").trim();

  if (mfaAsk) {
    const ch = await call("ask BILL for an MFA challenge", "POST", "/mfa/challenge", {});
    const id = (ch.json as { challengeId?: string } | null)?.challengeId ?? "";
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      mfaTrusted: trusted,
      nextUrl: id
        ? `${url.origin}/api/diagnostics/bill?challengeid=${encodeURIComponent(id)}&mfacode=PUT_CODE_HERE` +
          (fresh ? "&fresh=1" : "") +
          (url.searchParams.get("device") ? `&device=${encodeURIComponent(device)}` : "")
        : null,
      reading: id
        ? "A code is on its way. Open nextUrl, replace PUT_CODE_HERE with the code, and press it. These expire in minutes, so do it straight away rather than pasting the response anywhere first."
        : "No challengeId came back. If the body names required fields instead, that IS the spec.",
      steps,
    });
  }

  // READ ONE BILL, by id, and print the whole body. This exists because the
  // sync decided a bill was settled from `paymentStatus` and `dueAmount`,
  // names that were assumed rather than observed, and both readings were
  // wrong. A create has been pressed; a READ never had. Nothing is written.
  const readBillId = (url.searchParams.get("bill") ?? "").trim();
  if (readBillId) {
    await call("read one bill", "GET", `/bills/${encodeURIComponent(readBillId)}`);
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      reading:
        "The body above is the whole bill as BILL states it. What matters is the exact name and value of whatever reports settlement, since the sync was reading `paymentStatus` and `dueAmount` on an assumption. A bill nobody has paid must NOT carry a value that reads as paid.",
      steps,
    });
  }

  // CAN BILL ASK A FREELANCER FOR THEIR OWN ACH DETAILS? The step the studio
  // does by hand today, and the one thing standing between "add the bill" and
  // "pay by ACH in one press": a vendor we create comes back
  // `payByType: CHECK` with no bank account, and pressing Pay on that posts a
  // paper cheque, which is not how this studio pays anybody.
  //
  // WHY A PROBE AND NOT CODE. Two endpoints exist and the docs blur them.
  // `POST /v3/network/invitation/vendor/{id}` is documented as taking a
  // networkId from a search of companies ALREADY IN the BILL network, which a
  // freelancer who has never heard of BILL cannot be. `SendVendorInvite` is
  // titled "invite a vendor not in the BILL network", which is the case that
  // matters, and it lives on the OLDER API, so there is a second unknown
  // underneath the first: whether a v3 session is accepted there at all.
  // Writing either from a remembered shape is how the FreshBooks rounds went.
  //
  // NOTHING IS CREATED AND NOBODY IS EMAILED. The v3 attempt carries an EMPTY
  // BODY and the v2 attempt carries only the vendor id, so neither has an
  // address to send anything to: the refusal naming the missing fields IS the
  // answer, which is exactly how the payment payload was assembled. It runs
  // on the REAL account deliberately, ahead of the production refusal below,
  // because the vendor whose rail we need to change is on the real account.
  const inviteVendorId = (url.searchParams.get("invite") ?? "").trim();
  if (inviteVendorId) {
    // The vendor as BILL states it. This also checks the two fields the send
    // window now reads, `payByType` and `bankAccountStatus`, against what
    // lib/bill-payable whitelists: a value outside those sets reports as
    // "BILL did not say" rather than as a rail.
    await call("read the vendor", "GET", `/vendors/${encodeURIComponent(inviteVendorId)}`);

    // Is this company in the BILL network at all? An empty result is the
    // evidence that the v3 invitation is the wrong endpoint for a stranger.
    await call("search the BILL network", "GET", "/network?max=5");

    await call(
      "v3 network invitation, empty body",
      "POST",
      `/network/invitation/vendor/${encodeURIComponent(inviteVendorId)}`,
      {}
    );

    // The same question on the older API, twice: once on the v3 session we
    // already hold, once on a session from v2's own login. Separately, because
    // "the shape is wrong" and "the session is wrong" point in opposite
    // directions and one message covers both.
    await v2call("v2 SendVendorInvite, v3 session", "SendVendorInvite", sessionId, {
      vendorId: inviteVendorId,
    });
    const v2session = await v2login();
    if (v2session) {
      await v2call("v2 SendVendorInvite, v2 session", "SendVendorInvite", v2session, {
        vendorId: inviteVendorId,
      });
    }

    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      reading:
        "Read the five bodies in order. The vendor body gives the LIVE values of payByType and bankAccountStatus, which is what the send window reads. The network search says whether this person is in BILL's network: empty means the v3 invitation cannot reach them. Then the two SendVendorInvite attempts: a refusal naming required fields is a GOOD result, since the endpoint is permitted and only the shape is missing, and that refusal is the spec. 'Invalid session' on the v3-session attempt but not the v2-session one means the older API needs its own login, which is a known cost rather than a wall. A flat refusal of the endpoint on both sessions means this account cannot invite a vendor through the API, and the answer is BILL's own screen. Nothing was created and nobody was emailed: neither attempt carried an address.",
      steps,
    });
  }

  if (mfaCode) {
    await call("validate the MFA code and remember this device", "POST", "/mfa/challenge/validate", {
      ...(challengeId ? { challengeId } : {}),
      token: mfaCode,
      // The point of the whole exercise: a remembered id that later sign-ins
      // can present to come back trusted.
      rememberMe: true,
      device,
    });
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      reading:
        "If the body carries a rememberMeId, that is the answer: add it to Vercel as BILL_REMEMBER_ME_ID, redeploy, and the next plain press should report mfaTrusted true. Treat it as a credential, since it is what lets this server hold a payment-capable session.",
      steps,
    });
  }

  // STEP 3: the reads, separately, so one being shut cannot hide the other.
  await call("list vendors", "GET", "/vendors?max=5");
  await call("list bills", "GET", "/bills?max=5");

  // STEP 3b: what can money come OUT of? Read before writing, because a
  // sandbox org may already ship with a funding account, in which case
  // nothing needs creating and the payment can go straight through.
  const banks = await call("list bank accounts money can come from", "GET", "/funding-accounts/banks");
  // THE CARD LIST IS GONE ON PURPOSE. It wanted a cardUserStatus whose
  // accepted values are not documented anywhere reachable from here, so it
  // put a red row in every response for a question that does not matter: a
  // vendor bill is paid from a bank account, not from a card.

  // Tolerant about the WRAPPER, strict about the ROW. Tolerant because the
  // list shape is not known here and a key guessed wrong would read as "no
  // funding account" on an org that has one. Strict because the first version
  // of this took the first row and called it a funding account, and the row
  // it found was archived and PENDING, which cannot pay anything: presence is
  // not usability, and reporting presence as usability is the same mistake as
  // reading a FreshBooks 200 as a working list.
  type BankRow = { id?: unknown; archived?: unknown; status?: unknown; nameOnAccount?: unknown };

  function bankRows(j: unknown): BankRow[] {
    const o = j as Record<string, unknown> | null;
    const rows = Array.isArray(o)
      ? o
      : Array.isArray(o?.results)
        ? o.results
        : Array.isArray(o?.data)
          ? o.data
          : Array.isArray(o?.fundingAccounts)
            ? o.fundingAccounts
            : [];
    return (rows as BankRow[]).filter((r) => typeof r?.id === "string");
  }

  /** What a row is, in one line, so a reading can be checked rather than
   *  believed. */
  function describe(r: BankRow) {
    const bits = [
      String(r.id),
      typeof r.nameOnAccount === "string" ? r.nameOnAccount : null,
      typeof r.status === "string" ? r.status : "no status",
      r.archived === true ? "ARCHIVED" : null,
    ].filter(Boolean);
    return bits.join(", ");
  }

  /** Archived is out, and anything not VERIFIED is out. PENDING means BILL is
   *  still waiting on verification, so it is not something money leaves from. */
  function usable(r: BankRow) {
    return r.archived !== true && String(r.status ?? "").toUpperCase() === "VERIFIED";
  }

  const allBanks = bankRows(banks.json);
  const good = allBanks.find(usable);
  const fundingOverride = (url.searchParams.get("fundingid") ?? "").trim();
  const fundingId = fundingOverride || (good ? String(good.id) : "");
  const bankSummary = allBanks.map(describe);

  // THE INVARIANT. Production never writes from here, whatever the URL says.
  if (env === "production") {
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      fundingId: fundingId || null,
      banks: bankSummary,
      reading:
        "Read only, because this is your real account. The vendor and bill bodies above answer the FreshBooks question: whether a list comes back with your actual rows in it, or empty, and the funding bodies say whether a real bank account is attached. Creating and paying need a SANDBOX key.",
      steps,
    });
  }

  // A DUMMY BANK ACCOUNT, on its own press. Separate from ?write=1 because a
  // funding account belongs to the ORG rather than to a throwaway test row:
  // it is the one write here that somebody might not want repeated, so it is
  // never a side effect of asking for a vendor and a bill.
  if (addBank) {
    // THE FIELD NAMES COME FROM THE READ, not from a guess: the existing row
    // carries `type`, `ownerType`, `nameOnAccount`, `routingNumber` and
    // `accountNumber`, so those are what go out. An earlier draft of this sent
    // `accountType`, which the list shape says is wrong. 021000021 is a real,
    // valid routing number so a checksum check passes; the account number is
    // deliberately not.
    const made = await call("add a dummy bank account", "POST", "/funding-accounts/banks", {
      nameOnAccount: "Studio Flows Sandbox",
      routingNumber: "021000021",
      accountNumber: "1234567890",
      type: "CHECKING",
      ownerType: "BUSINESS",
      // Required, which the refusal said and no amount of reasoning would
      // have. It is the bank behind routing 021000021, written the way BILL
      // writes the one it looked up for the existing row, in case it checks
      // the pair rather than just storing what it is handed.
      bankName: "JPMORGAN CHASE BANK NATIONAL ASSOCIATION",
    });
    const after = await call("read the bank list back", "GET", "/funding-accounts/banks");
    const afterRows = bankRows(after.json);
    const madeId = (made.json as { id?: string } | null)?.id ?? "";
    const newRow = afterRows.find((r) => String(r.id) === madeId) ?? afterRows.find((r) => r.archived !== true);
    const newId = madeId || (newRow ? String(newRow.id) : "");
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      mfaTrusted: trusted,
      bankId: newId || null,
      bankState: newRow ? describe(newRow) : null,
      banks: afterRows.map(describe),
      reading: !newId
        ? "No bank id came back. If the body lists the fields it wants, that IS the spec. If it refuses the endpoint outright, a sandbox org cannot hold a funding account at all, and a payment can never be completed here, which is itself the answer."
        : newRow && usable(newRow)
          ? "A usable bank account exists. Go to ?write=1&pay=1."
          : "A bank account was created but it is not usable yet: read bankState. PENDING means BILL is waiting on verification, which normally means micro deposits it posts to the account, and in a sandbox those may never arrive. If the body names a verification call, ?verify=<amount> tries it. If verification can only happen against a real bank, that is the answer: the payment leg cannot be proven in the sandbox.",
      steps,
    });
  }

  // Verifying it. Amount comes from the URL because only the operator can see
  // what the sandbox posted, if it posted anything at all.
  if (verifyAmount) {
    // Default to the most recent row rather than to a verified one, since by
    // definition nothing is verified yet when this is being pressed.
    const newest = allBanks.length ? allBanks[allBanks.length - 1] : null;
    const bankId = (url.searchParams.get("bankid") ?? "").trim() || (newest ? String(newest.id) : "");
    if (!bankId) {
      return NextResponse.json({
        probe: PROBE,
        fingerprint,
        environment: env,
        reading: "Nothing to verify: no bank account was found. Press ?bank=1 first.",
        steps,
      });
    }
    const amount = Number(verifyAmount);
    // Read the one row first: it may carry a verification state or a next
    // step the list view trims out.
    await call("read this one bank account", "GET", `/funding-accounts/banks/${bankId}`);
    // Two plausible paths, SEPARATELY, because a 404 means there is no such
    // route while a 400 or a 422 means the route is there and the payload is
    // wrong, and those point in opposite directions. One catch over both
    // could not tell them apart, which is exactly how findOrCreateVendor
    // reported a refused write as a refused read for two rounds.
    await call("verify it (singular path)", "POST", `/funding-accounts/banks/${bankId}/verify`, {
      depositAmount: amount,
    });
    await call("verify it (plural path)", "POST", `/funding-accounts/banks/${bankId}/verifications`, {
      depositAmount: amount,
    });
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      bankId,
      reading:
        "Compare the two verify bodies. A 404 on BOTH means there is no API verification route, so a bank account can only be verified in BILL's own screen against a real bank. A 400 or 422 means the route exists and the payload or the amount is wrong, which is a shape question rather than a wall. The amount is almost certainly wrong either way, since no micro deposit was ever posted to an invented account.",
      steps,
    });
  }

  if (!write) {
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      mfaTrusted: trusted,
      fundingId: fundingId || null,
      banks: bankSummary,
      reading:
        (fundingId
          ? "Signed in, and a VERIFIED funding account is here, so a payment has something to come from."
          : allBanks.length
            ? "Signed in. Bank accounts exist but NONE is usable: read the banks list, where each row carries its status and whether it is archived. An archived or PENDING account cannot pay. Press ?bank=1 to try adding a dummy one."
            : "Signed in, and NO funding account was found, which is the thing a payment was refused for. Press ?bank=1 to try creating a dummy one.") +
        " Add ?write=1 to create a test vendor and a test bill in the sandbox.",
      steps,
    });
  }

  // STEP 4: create a vendor. The step retyped on every job today.
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const vendor = await call("create a vendor", "POST", "/vendors", {
    name: `Studio Flows probe ${stamp}`,
    address: {
      line1: "1 Test Street",
      city: "Los Angeles",
      stateOrProvince: "CA",
      zipOrPostalCode: "90001",
      country: "US",
    },
  });
  const vendorId = (vendor.json as { id?: string } | null)?.id ?? "";
  if (!vendorId) {
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      reading:
        "Stopped at the vendor. If the body lists the fields it wants, that IS the spec, and it is the documentation this session cannot reach.",
      steps,
    });
  }

  // STEP 5: create a bill against it.
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const bill = await call("create a bill", "POST", "/bills", {
    vendorId,
    invoice: {
      invoiceNumber: `PROBE-${stamp}`,
      invoiceDate: today,
    },
    dueDate: due,
    billLineItems: [{ amount: 12.34, description: "Studio Flows sandbox probe" }],
  });
  const billId = (bill.json as { id?: string } | null)?.id ?? "";
  if (!billId) {
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      vendorId,
      reading: "Vendor created. Stopped at the bill, and its body names the shape it wants.",
      steps,
    });
  }

  if (!pay) {
    return NextResponse.json({
      probe: PROBE,
      fingerprint,
      environment: env,
      vendorId,
      billId,
      reading: "Vendor and bill both created in the sandbox. Add &pay=1 to try paying it. Sandbox money is not real.",
      steps,
    });
  }

  // STEP 6: pay it. The question FreshBooks could never answer.
  //
  // THE POINT OF PRESSING THIS IN A SANDBOX IS NOT TO MOVE MONEY. A funding
  // account cannot be verified against an invented bank, so this is expected
  // to be refused. What it buys is the PAYLOAD: every field shape in this
  // file was learned from a refusal naming what was missing, so learning the
  // rest of the payment body here means the first attempt on a real account
  // is one press rather than four. Pass ?fundingid=<id> to attach an
  // unverified account deliberately and get past the null check to whatever
  // is underneath it.
  //
  // `processingOptions` is sent EMPTY for the same reason. It was refused for
  // being null, so an empty object clears that check and the refusal that
  // follows names the children it actually wants.
  await call("pay the bill", "POST", "/payments", {
    vendorId,
    processDate: today,
    ...(fundingId ? { fundingAccount: { id: fundingId, type: "BANK_ACCOUNT" } } : {}),
    processingOptions: {},
    // READ OFF THE REFUSAL, not remembered. It named `amount` and `billId`
    // as bare words, and this API reports a nested problem with a dotted
    // path (`address.country: invalid value`), so bare means top level and
    // the array was being ignored. `createBill` is a flag the refusal itself
    // revealed: it said billId is required when createBill is false, and
    // false is what we want, since the bill already exists.
    amount: 12.34,
    billId,
    createBill: false,
    // The array stays too, deliberately. If it turns out to be the real
    // shape then the top-level fields are the extras and BILL will say so.
    // Either way one press learns more than two.
    billPayments: [{ billId, amount: 12.34 }],
  });

  return NextResponse.json({
    probe: PROBE,
    fingerprint,
    environment: env,
    vendorId,
    billId,
    mfaTrusted: trusted,
    fundingId: fundingId || null,
    banks: bankSummary,
    reading:
      (fundingId
        ? "A funding account was sent with the payment."
        : "NO funding account was sent, because none of the ones here is verified. Pass ?fundingid=<id> from the banks list to attach an unverified one on purpose: the refusal that comes back is the payload spec, which is what this press is for.") +
      " Read the payment body: a refusal naming a field it wants is a GOOD result, since the call is permitted and only the shape is wrong. A refusal about the account being unverified is the expected end of the sandbox road.",
    steps,
  });
}
