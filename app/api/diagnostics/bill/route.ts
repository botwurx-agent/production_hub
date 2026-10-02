// Can BILL do what FreshBooks Bill Pay could not: create the vendor, create
// the bill, and pay it?
//
// WHY THIS EXISTS BEFORE ANY FEATURE CODE. The FreshBooks probe was built
// AFTER four rounds of guessing, and the thing that finally answered it was
// printing the RESPONSE BODY rather than the status code: their vendor list
// returned 200 with an empty array for a week while we read that as working.
// So this prints every body from the first press, on success as well as on
// failure, and catches every step SEPARATELY so a refusal names which call
// was refused. One try/catch around a read and a write is what sent two days
// of diagnosis at an endpoint that had been fine the whole time.
//
// SANDBOX ONLY, AND NOT CONFIGURABLE. The hosts below are hard-coded rather
// than read from the environment, so no setting, typo or stray variable can
// point this at the real books. gateway.prod and api.bill.com are real money.
//
// Staff only, same gate as the FreshBooks probe.
import { NextResponse } from "next/server";
import { getStudioContext } from "@/lib/studio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The sandbox. Never the production hosts, and never from env.
const API = "https://gateway.stage.bill.com/connect";
const LIST_ORGS = "https://api-stage.bill.com/api/v2/ListOrgs.json";

// Enough body to diagnose from, not so much that a stack of them is a wall.
const BODY_CHARS = 1500;

type Step = {
  what: string;
  request: string;
  status: number;
  ok: boolean;
  body: string;
};

/** A session id in a body is a live credential, so it never leaves here. */
function redact(text: string, secrets: string[]) {
  let out = text;
  for (const s of secrets) {
    if (s && s.length > 6) out = out.split(s).join("[redacted]");
  }
  return out;
}

export async function GET(req: Request) {
  const ctx = await getStudioContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (ctx.isCollaborator) {
    return NextResponse.json({ error: "Not available on this account." }, { status: 403 });
  }

  const devKey = process.env.BILL_DEV_KEY ?? "";
  const username = process.env.BILL_USERNAME ?? "";
  const password = process.env.BILL_PASSWORD ?? "";
  const orgId = process.env.BILL_ORG_ID ?? "";

  const missing = [
    !devKey && "BILL_DEV_KEY",
    !username && "BILL_USERNAME",
    !password && "BILL_PASSWORD",
  ].filter(Boolean);
  if (missing.length) {
    return NextResponse.json(
      { error: `Not set in this environment: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  // Writes and the payment are each a separate deliberate press, even in a
  // sandbox: a payment is worth asking for on purpose.
  const write = url.searchParams.get("write") === "1";
  const pay = url.searchParams.get("pay") === "1";

  const steps: Step[] = [];
  const secrets = [password, devKey];
  let sessionId = "";

  /** One call. Never throws: a probe that falls over on the first refusal
   *  tells you less than the one it replaces. */
  async function call(
    what: string,
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<{ status: number; ok: boolean; json: unknown }> {
    const target = `${API}/v3${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      devKey,
    };
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
      ok = res.ok;
      text = await res.text();
    } catch (e) {
      text = `NETWORK FAILURE: ${e instanceof Error ? e.message : "unknown"}`;
    }
    steps.push({
      what,
      request: `${method} ${target}`,
      status,
      ok,
      // ALWAYS, success included. An empty list behind a 200 is the failure
      // mode that cost the last round, and only the body shows it.
      body: redact(text, [...secrets, sessionId]).slice(0, BODY_CHARS),
    });
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status, ok, json };
  }

  // STEP 0: which organizations does this login have? Only when we have not
  // been told, so nobody has to hunt for an id in their UI. It lives on the
  // older v2 host and takes form encoding, so it is not a call() above.
  if (!orgId) {
    let status = 0;
    let ok = false;
    let text = "";
    try {
      const res = await fetch(LIST_ORGS, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ devKey, userName: username, password }),
      });
      status = res.status;
      ok = res.ok;
      text = await res.text();
    } catch (e) {
      text = `NETWORK FAILURE: ${e instanceof Error ? e.message : "unknown"}`;
    }
    steps.push({
      what: "which organizations does this login have?",
      request: `POST ${LIST_ORGS}`,
      status,
      ok,
      body: redact(text, secrets).slice(0, BODY_CHARS),
    });
    return NextResponse.json({
      environment: "SANDBOX",
      reading:
        "BILL_ORG_ID is not set, so this only asked which organizations exist. An organization id begins with 008. Add the SANDBOX one as BILL_ORG_ID in Vercel, redeploy, and press this again.",
      steps,
    });
  }

  // STEP 1: sign in. Nothing below means anything without this.
  const login = await call("sign in", "POST", "/login", {
    username,
    password,
    organizationId: orgId,
    devKey,
  });
  const loginJson = login.json as { sessionId?: string } | null;
  sessionId = loginJson?.sessionId ?? "";
  if (!sessionId) {
    return NextResponse.json({
      environment: "SANDBOX",
      reading:
        "No sessionId came back, so nothing else could run. If the body names a field, that is the answer.",
      steps,
    });
  }

  // STEP 2: is this session MFA trusted? Paying a bill needs one, so knowing
  // BEFORE the payment is the difference between a diagnosis and a mystery.
  await call("session details (is it MFA trusted?)", "GET", "/session");

  // STEP 3: reads, separately, so one being shut cannot hide the other.
  await call("list vendors", "GET", "/vendors?max=5");
  await call("list bills", "GET", "/bills?max=5");

  if (!write) {
    return NextResponse.json({
      environment: "SANDBOX",
      reading:
        "Signed in and read. Add ?write=1 to the URL to create a test vendor and a test bill in the sandbox.",
      steps,
    });
  }

  // STEP 4: create a vendor. This is the step retyped on every job today.
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const vendor = await call("create a vendor", "POST", "/vendors", {
    name: `Studio Flows probe ${stamp}`,
  });
  const vendorId = (vendor.json as { id?: string } | null)?.id ?? "";
  if (!vendorId) {
    return NextResponse.json({
      environment: "SANDBOX",
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
      environment: "SANDBOX",
      reading: "Vendor created. Stopped at the bill, and its body names the shape it wants.",
      steps,
    });
  }

  if (!pay) {
    return NextResponse.json({
      environment: "SANDBOX",
      vendorId,
      billId,
      reading:
        "Vendor and bill both created in the sandbox. Add &pay=1 to try paying it. Sandbox money is not real.",
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
    environment: "SANDBOX",
    vendorId,
    billId,
    reading:
      "Read the payment body. A refusal naming MFA is a GOOD result: it means the call is permitted and the session needs trusting, which is a flow question rather than a wall.",
    steps,
  });
}
