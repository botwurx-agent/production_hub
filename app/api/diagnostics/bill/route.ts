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
  const login = await call("sign in", "POST", "/login", {
    username,
    password,
    organizationId: orgId,
    devKey,
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

  // STEP 3: the reads, separately, so one being shut cannot hide the other.
  await call("list vendors", "GET", "/vendors?max=5");
  await call("list bills", "GET", "/bills?max=5");

  // THE INVARIANT. Production never writes from here, whatever the URL says.
  if (env === "production") {
    return NextResponse.json({
      fingerprint,
      environment: env,
      reading:
        "Read only, because this is your real account. The vendor and bill bodies above answer the FreshBooks question: whether a list comes back with your actual rows in it, or empty. Creating and paying need a SANDBOX key.",
      steps,
    });
  }

  if (!write) {
    return NextResponse.json({
      fingerprint,
      environment: env,
      mfaTrusted: trusted,
      reading: "Signed in and read. Add ?write=1 to create a test vendor and a test bill in the sandbox.",
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
    invoiceNumber: `PROBE-${stamp}`,
    invoiceDate: today,
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
  await call("pay the bill", "POST", "/payments", {
    vendorId,
    processDate: today,
    billPayments: [{ billId, amount: 12.34 }],
  });

  return NextResponse.json({
    fingerprint,
    environment: env,
    vendorId,
    billId,
    mfaTrusted: trusted,
    reading:
      "Read the payment body. A refusal naming MFA is a GOOD result: the call is permitted and the session needs trusting, which is a flow question rather than a wall.",
    steps,
  });
}
