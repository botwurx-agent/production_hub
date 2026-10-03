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

// Enough body to diagnose from, not so much that a stack of them is a wall.
const BODY_CHARS = 1500;

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

  const raw = {
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
  const missing = [
    !devKey && "BILL_DEV_KEY",
    !username && "BILL_USERNAME",
    !password && "BILL_PASSWORD",
  ].filter(Boolean);
  if (missing.length) {
    return NextResponse.json({ error: `Not set here: ${missing.join(", ")}` }, { status: 400 });
  }

  const url = new URL(req.url);
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

  // STEP 0. Ask both, because their sign-up does not say which you got.
  const sandboxOk = await askOrgs("sandbox");
  const prodOk = sandboxOk ? false : await askOrgs("production");
  const env: Env | null = sandboxOk ? "sandbox" : prodOk ? "production" : null;

  if (!env) {
    return NextResponse.json({
      fingerprint,
      environment: "unknown",
      reading:
        "Neither host accepted this developer key. Read the two bodies: 'Developer key is invalid' on both means the key is not active yet or was copied with a stray character. Nothing was created.",
      steps,
    });
  }

  const API = HOSTS[env].api;

  if (!orgId) {
    return NextResponse.json({
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

  // STEP 1: sign in. Nothing below means anything without this.
  const rememberMeId = (process.env.BILL_REMEMBER_ME_ID ?? "").trim();
  const device = (process.env.BILL_DEVICE_ID ?? "studio-flows-server").trim();
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
      fingerprint,
      environment: env,
      reading: "No sessionId came back, so nothing else could run. The body names the reason.",
      steps,
    });
  }

  // STEP 2: is this session MFA trusted? Paying a bill needs one. An earlier
  // version called /v3/session for this and got a 404: there is no such path,
  // and the LOGIN response already carries it, so read it from there.
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
      fingerprint,
      environment: env,
      mfaTrusted: trusted,
      nextUrl: id
        ? `${url.origin}/api/diagnostics/bill?challengeid=${encodeURIComponent(id)}&mfacode=PUT_CODE_HERE`
        : null,
      reading: id
        ? "A code is on its way. Open nextUrl, replace PUT_CODE_HERE with the code, and press it. These expire in minutes, so do it straight away rather than pasting the response anywhere first."
        : "No challengeId came back. If the body names required fields instead, that IS the spec.",
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
  await call("list cards money can come from", "GET", "/funding-accounts/cards");

  // Tolerant on purpose: the list shape is not known here, and a wrapper key
  // guessed wrong would read as "no funding account" when there is one.
  function firstId(j: unknown): string {
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
    for (const r of rows as { id?: unknown }[]) if (typeof r?.id === "string") return r.id;
    return "";
  }
  const fundingId = (url.searchParams.get("fundingid") ?? "").trim() || firstId(banks.json);

  // THE INVARIANT. Production never writes from here, whatever the URL says.
  if (env === "production") {
    return NextResponse.json({
      fingerprint,
      environment: env,
      fundingId: fundingId || null,
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
    // The body is DELIBERATELY MINIMAL. Every field shape in this file so far
    // was learned from a refusal naming what was missing (the vendor address,
    // the nested invoice, the top-level dueDate), and that has been faster and
    // more accurate than guessing a full payload. 021000021 is a real, valid
    // routing number, so a checksum check passes; the account number is not.
    const made = await call("add a dummy bank account", "POST", "/funding-accounts/banks", {
      name: "Studio Flows sandbox checking",
      nameOnAccount: "Studio Flows Sandbox",
      routingNumber: "021000021",
      accountNumber: "1234567890",
      accountType: "CHECKING",
    });
    const after = await call("read the bank list back", "GET", "/funding-accounts/banks");
    const newId = (made.json as { id?: string } | null)?.id ?? firstId(after.json);
    return NextResponse.json({
      fingerprint,
      environment: env,
      mfaTrusted: trusted,
      bankId: newId || null,
      reading: newId
        ? "A bank account exists now. Read its body for a verification status: if BILL wants micro deposits confirmed, paying will be refused until that is done, and ?verify=<amount> tries that. If it reads as usable, go straight to ?write=1&pay=1."
        : "No bank id came back. If the body lists the fields it wants, that IS the spec. If it refuses the endpoint outright, a sandbox org cannot hold a funding account and a payment cannot be completed here at all, which is itself the answer.",
      steps,
    });
  }

  // Verifying it, if BILL asks for micro deposits. Amount comes from the URL
  // because only the operator can see what the sandbox posted.
  if (verifyAmount) {
    const bankId = (url.searchParams.get("bankid") ?? "").trim() || fundingId;
    if (!bankId) {
      return NextResponse.json({
        fingerprint,
        environment: env,
        reading: "Nothing to verify: no bank account was found. Press ?bank=1 first.",
        steps,
      });
    }
    await call("verify the bank account", "POST", `/funding-accounts/banks/${bankId}/verify`, {
      depositAmount: Number(verifyAmount),
    });
    return NextResponse.json({
      fingerprint,
      environment: env,
      bankId,
      reading:
        "Read the body. A refusal naming the field it wanted is the spec; a refusal on the amount means the deposit figure is wrong rather than the call being shut.",
      steps,
    });
  }

  if (!write) {
    return NextResponse.json({
      fingerprint,
      environment: env,
      mfaTrusted: trusted,
      fundingId: fundingId || null,
      reading:
        (fundingId
          ? "Signed in, and a funding account is already here, so a payment has something to come from."
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
      fingerprint,
      environment: env,
      vendorId,
      reading: "Vendor created. Stopped at the bill, and its body names the shape it wants.",
      steps,
    });
  }

  if (!pay) {
    return NextResponse.json({
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
  // `processingOptions` is sent EMPTY on purpose. It was refused for being
  // null, so an empty object clears that check and the refusal that follows
  // names the children it actually wants, which is the cheapest way to learn
  // a shape the docs cannot be read for from here.
  await call("pay the bill", "POST", "/payments", {
    vendorId,
    processDate: today,
    ...(fundingId ? { fundingAccount: { id: fundingId, type: "BANK_ACCOUNT" } } : {}),
    processingOptions: {},
    billPayments: [{ billId, amount: 12.34 }],
  });

  return NextResponse.json({
    fingerprint,
    environment: env,
    vendorId,
    billId,
    mfaTrusted: trusted,
    fundingId: fundingId || null,
    reading:
      (fundingId
        ? "A funding account was sent with the payment."
        : "NO funding account was sent, because none was found, so expect the same 'must not be null' refusal. Press ?bank=1 first.") +
      " Read the payment body: a refusal naming MFA or naming a field it wants is a GOOD result, since the call is permitted and only the shape or the session is wrong.",
    steps,
  });
}
