// Talking to BILL (bill.com).
//
// EVERY SHAPE IN HERE WAS PROVEN BY PRESSING IT, through the diagnostics probe
// at /api/diagnostics/bill, against a real BILL organization: sign-in, the
// 2-step challenge, creating a vendor, creating a bill, creating a funding
// account, and submitting a payment. Do not "fix" a field name against a
// half-remembered doc. developer.bill.com is egress-blocked from a Claude Code
// session, so the probe and its printed bodies are the documentation we have,
// and they are better than the alternative: each name below is one BILL itself
// named in a refusal.
//
// TWO API GENERATIONS, and the difference matters:
//   - v2 (ListOrgs) is form-encoded and answers HTTP 200 WITH THE FAILURE
//     INSIDE the body. A status code means nothing there.
//   - v3 (everything else) is JSON through a gateway, with the session id and
//     the developer key as headers, and answers real status codes.
// billSucceeded() in lib/bill-error.ts is the one place that decides, so no
// caller has to remember which path it is on.
//
// THE DEVELOPER KEY IS OURS, NOT THE STUDIO'S. It identifies this integration;
// the studio supplies its own login. Proven incidentally: one developer key
// listed a different company's organization using that company's username.
import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { billFailure, billSucceeded } from "@/lib/bill-error";
import type { BillBillState } from "@/lib/bill-settled";
import { billCryptoReady, decryptSecret, encryptSecret } from "@/lib/bill-crypto";
import type { Database } from "@/lib/database.types";

const HOSTS = {
  // Sandbox and production share no data and need SEPARATE developer keys.
  // BILL's sign-up does not make clear which you have, and the error for
  // using one against the other says the key is invalid.
  sandbox: {
    gateway: "https://gateway.stage.bill.com/connect/v3",
    orgs: "https://api-stage.bill.com/api/v2/ListOrgs.json",
  },
  production: {
    gateway: "https://gateway.prod.bill.com/connect/v3",
    orgs: "https://api.bill.com/api/v2/ListOrgs.json",
  },
} as const;

export type BillEnv = keyof typeof HOSTS;

/**
 * Which BILL to talk to. DEFAULTS TO PRODUCTION, deliberately: a deployment
 * serving a real studio means their real books, and a default of sandbox would
 * be a connection that silently does nothing. The sandbox is opt-in.
 */
export function billEnv(): BillEnv {
  return (process.env.BILL_ENV ?? "").trim().toLowerCase() === "sandbox"
    ? "sandbox"
    : "production";
}

/** Trimmed, because a stray character on a stored key cost a whole round once. */
function devKey(): string {
  return (process.env.BILL_DEV_KEY ?? "").trim();
}

/**
 * Can a studio connect at all? Both halves are required: the developer key to
 * reach BILL, and the credential key so there is somewhere safe to keep the
 * password. Missing either means the form should not be offered.
 */
export function billConfigured(): boolean {
  return Boolean(devKey()) && billCryptoReady();
}

export class BillError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    super(billFailure(status, body));
    this.name = "BillError";
    this.status = status;
    this.body = body;
  }
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Keep the raw text: a gateway error page is not JSON and saying so beats
    // reporting "no reason given" when there was one in HTML.
    return text;
  }
}

/** One v3 call. Throws BillError carrying BILL's own words. */
async function v3<T>(
  path: string,
  body: unknown,
  opts: { sessionId?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    devKey: devKey(),
  };
  if (opts.sessionId) headers.sessionId = opts.sessionId;
  const res = await fetch(`${HOSTS[billEnv()].gateway}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  const parsed = await readJson(res);
  if (!billSucceeded(res.status, parsed)) throw new BillError(res.status, parsed);
  return parsed as T;
}

export type BillOrg = { orgId: string; orgName: string };

/**
 * Which organizations this login can see. Used during the connect so nobody
 * has to find and type a twenty-character organization id by hand, and so the
 * stored row can carry the company's NAME for the Settings card.
 */
export async function listBillOrgs(username: string, password: string): Promise<BillOrg[]> {
  const res = await fetch(HOSTS[billEnv()].orgs, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ devKey: devKey(), userName: username, password }),
    cache: "no-store",
  });
  const parsed = await readJson(res);
  if (!billSucceeded(res.status, parsed)) throw new BillError(res.status, parsed);
  const rows = (parsed as { response_data?: unknown }).response_data;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const o = r as { orgId?: unknown; orgName?: unknown };
      return {
        orgId: typeof o.orgId === "string" ? o.orgId : "",
        orgName: typeof o.orgName === "string" ? o.orgName : "",
      };
    })
    .filter((o) => o.orgId);
}

export type BillSession = {
  sessionId: string;
  /**
   * Whether this session may PAY. It comes back on the LOGIN response, and
   * there is no endpoint to ask afterwards: /v3/session is a 404, which was a
   * guess that cost a round.
   */
  trusted: boolean;
};

export async function billLogin(args: {
  username: string;
  password: string;
  orgId: string;
  rememberMeId?: string | null;
  device?: string | null;
}): Promise<BillSession> {
  const res = await v3<{ sessionId?: string; trusted?: boolean }>("/login", {
    username: args.username,
    password: args.password,
    organizationId: args.orgId,
    devKey: devKey(),
    // Presenting a remembered id and its device is what makes a session
    // payment-capable with nobody present. Sent only once one exists.
    ...(args.rememberMeId && args.device
      ? { rememberMeId: args.rememberMeId, device: args.device }
      : {}),
  });
  const sessionId = typeof res.sessionId === "string" ? res.sessionId : "";
  if (!sessionId) throw new BillError(200, res);
  return { sessionId, trusted: res.trusted === true };
}

/**
 * Ask BILL to send a 2-step code. The challenge is NOT bound to the session it
 * was asked for (a validate on a fresh sign-in finds it), but the code expires
 * in minutes, so whatever calls this must put the entry field in front of
 * somebody immediately rather than making them carry an id around.
 */
export async function billMfaChallenge(session: BillSession): Promise<string> {
  const res = await v3<{ challengeId?: string }>("/mfa/challenge", {}, { sessionId: session.sessionId });
  const id = typeof res.challengeId === "string" ? res.challengeId : "";
  if (!id) throw new BillError(200, res);
  return id;
}

/**
 * The device identifier this server presents to BILL. It is stable per studio
 * and has to be, because a remembered id is bound to the device it was minted
 * for, so changing it later would silently stop a trusted session coming back
 * trusted.
 *
 * SHORT ON PURPOSE, and this was learned from a refusal rather than a doc. The
 * first version was `studio-flows-${randomUUID()}`, 49 characters, and BILL
 * answered the validate with `400 BDC_1143 Invalid entity data. deviceId.`
 * What made it expensive is what it said through the APP's own path: there it
 * came back as `2-Step Verification token has expired`, which sent three
 * rounds at the code and the clock instead of at the field. Third time BILL
 * has named something other than the real cause.
 *
 * 19 characters, matching `studio-flows-server`, which is the value proven to
 * work end to end through the probe. The exact ceiling is unknown and is not
 * worth another SMS round to find: matching a known-good length is not a guess
 * about the limit, it is declining to go near it.
 */
export function newBillDeviceId(): string {
  return `sf-${randomBytes(8).toString("hex")}`;
}

/** Whether a stored device id is one `newBillDeviceId` would mint today. A row
 *  written before that refusal was understood carries a long one, which BILL
 *  will not accept, so the connect flow repairs it rather than failing. */
export function billDeviceIdOk(device: string): boolean {
  return /^sf-[0-9a-f]{16}$/.test(device);
}

/** Validates the code and remembers this device, which is the point. */
export async function billMfaValidate(
  session: BillSession,
  args: { challengeId: string; code: string; device: string }
): Promise<string> {
  const res = await v3<{ rememberMeId?: string }>(
    "/mfa/challenge/validate",
    {
      challengeId: args.challengeId,
      token: args.code,
      rememberMe: true,
      device: args.device,
    },
    { sessionId: session.sessionId }
  );
  const id = typeof res.rememberMeId === "string" ? res.rememberMeId : "";
  if (!id) throw new BillError(200, res);
  return id;
}

export type BillConnection =
  Database["public"]["Tables"]["bill_connections"]["Row"];

/**
 * The columns a page may render. The ciphers are deliberately NOT in here:
 * nothing outside this module and the server actions has a reason to hold an
 * encrypted password, and a select list is the cheapest way to make sure a new
 * read site cannot pick one up by accident.
 */
export const BILL_PUBLIC_COLUMNS =
  "id, studio_id, username, org_id, org_name, mfa_trusted_at, last_ok_at, created_at" as const;

/**
 * Sign in as the studio, using the credential it stored. The ONE place that
 * decrypts, so every caller gets a session without ever touching a secret.
 *
 * `trusted` is returned rather than asserted: a caller that needs to PAY has
 * to check it, and one that only reads does not care.
 */
export async function billSessionForStudio(
  supabase: SupabaseClient<Database>,
  studioId: string
): Promise<{ session: BillSession; conn: BillConnection } | null> {
  const { data } = await supabase
    .from("bill_connections")
    .select("*")
    .eq("studio_id", studioId)
    .maybeSingle();
  if (!data) return null;
  const conn = data as BillConnection;
  const session = await billLogin({
    username: conn.username,
    password: decryptSecret(conn.password_cipher),
    orgId: conn.org_id,
    rememberMeId: conn.remember_me_cipher ? decryptSecret(conn.remember_me_cipher) : null,
    device: conn.device_id,
  });
  return { session, conn };
}

export { encryptSecret };

// --- Paying a vendor bill ---------------------------------------------------
//
// THE PAYLOADS BELOW WERE EACH LEARNED FROM A REFUSAL NAMING WHAT WAS MISSING,
// which is the only documentation available from here. The payment one took
// five rounds, so it is the one least worth rewriting from memory:
//   - `amount` and `billId` are TOP LEVEL. A `billPayments: [{...}]` array is
//     accepted and then silently ignored. The tell was the error style: BILL
//     reports a nested problem with a dotted path (`address.country: ...`), so
//     two bare names meant top level.
//   - `createBill: false` says the bill already exists. Its own refusal
//     revealed it ("billId must be provided if createBill is false").
//   - `processingOptions` must be present and MAY BE EMPTY. It was first
//     refused for being null, which read as though it carried required
//     children; it does not.
// The end of that road was `422 BDC_1151`, which is the funding account rather
// than the payload, and is therefore a PASS for everything above it.

export type BillVendor = {
  id: string;
  name: string;
  /**
   * HOW BILL WOULD PAY THEM. Null when the body did not carry it, which is a
   * real case: the list endpoint returns a thinner row than the create does.
   * lib/bill-payable.ts turns the pair into a rail and NEVER reads an absence
   * as ACH.
   */
  payByType: string | null;
  bankAccountStatus: string | null;
};

/**
 * The payment fields off any vendor body. One reader for the list row, the
 * create response and the single-vendor read, so the three cannot drift into
 * disagreeing about how somebody gets paid.
 */
function vendorPayFields(row: unknown): Pick<BillVendor, "payByType" | "bankAccountStatus"> {
  const v = (row ?? {}) as { payByType?: unknown; bankAccountStatus?: unknown };
  return {
    payByType: typeof v.payByType === "string" ? v.payByType : null,
    bankAccountStatus: typeof v.bankAccountStatus === "string" ? v.bankAccountStatus : null,
  };
}

/**
 * How a vendor name is matched. Lower-cased with every run of non-alphanumeric
 * characters collapsed to one space, so case and punctuation do not matter and
 * anything EXTRA does: "Veronica Laramie Prop Styling" is not "Veronica
 * Laramie". Exported because a refusal has to be able to explain the rule.
 */
export function vendorKey(name: string): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Look for an existing vendor by normalised name. SEPARATE from creating one,
 * and this is not tidiness: FreshBooks spent two rounds of diagnosis on an
 * endpoint that was answering fine, because a read and a write sat under one
 * catch and a refused write reported itself as a refused read.
 */
export async function findBillVendor(
  session: BillSession,
  name: string
): Promise<BillVendor | null> {
  const want = vendorKey(name);
  if (!want) return null;
  const res = await v3<{ results?: unknown }>(
    "/vendors/list",
    { max: 100 },
    { sessionId: session.sessionId }
  ).catch(async () => {
    // Some deployments expose the list as a GET. Try that before giving up,
    // and let a real refusal surface from the second attempt.
    const r = await fetch(`${HOSTS[billEnv()].gateway}/vendors?max=100`, {
      headers: { "Content-Type": "application/json", devKey: devKey(), sessionId: session.sessionId },
      cache: "no-store",
    });
    const parsed = await readJson(r);
    if (!billSucceeded(r.status, parsed)) throw new BillError(r.status, parsed);
    return parsed as { results?: unknown };
  });

  const rows = Array.isArray(res.results) ? res.results : [];
  for (const row of rows) {
    const v = row as { id?: unknown; name?: unknown; archived?: unknown };
    if (v.archived === true) continue;
    if (typeof v.id === "string" && typeof v.name === "string" && vendorKey(v.name) === want) {
      return { id: v.id, name: v.name, ...vendorPayFields(row) };
    }
  }
  return null;
}

/**
 * One vendor, by id. Exists because the LIST row is thinner than the create
 * response, so a vendor found by name may arrive with no payment fields and
 * the send window would then have to say it could not tell. Shaped on
 * readBillBill, which is the proven sibling: same gateway, same GET, same
 * body-not-status success test.
 *
 * Returns null rather than throwing on a refusal: a window that cannot read
 * the rail should say so, not fall over.
 */
export async function readBillVendor(
  session: BillSession,
  vendorId: string
): Promise<BillVendor | null> {
  const r = await fetch(`${HOSTS[billEnv()].gateway}/vendors/${encodeURIComponent(vendorId)}`, {
    headers: { "Content-Type": "application/json", devKey: devKey(), sessionId: session.sessionId },
    cache: "no-store",
  }).catch(() => null);
  if (!r) return null;
  const parsed = await readJson(r);
  if (!billSucceeded(r.status, parsed)) return null;
  const v = parsed as { id?: unknown; name?: unknown };
  if (typeof v.id !== "string") return null;
  return {
    id: v.id,
    name: typeof v.name === "string" ? v.name : "",
    ...vendorPayFields(parsed),
  };
}

export type BillAddress = {
  line1: string;
  city: string;
  stateOrProvince: string;
  zipOrPostalCode: string;
  /** ISO 3166-1 alpha-2. `US`, never `USA`, which BILL refuses by name. */
  country: string;
};

/** Creating a vendor. An address is REQUIRED; BILL refuses without one. */
export async function createBillVendor(
  session: BillSession,
  args: { name: string; address: BillAddress; email?: string | null }
): Promise<BillVendor> {
  const res = await v3<{ id?: string; name?: string }>(
    "/vendors",
    {
      name: args.name,
      address: args.address,
      ...(args.email ? { email: args.email } : {}),
    },
    { sessionId: session.sessionId }
  );
  if (typeof res.id !== "string") throw new BillError(200, res);
  return {
    id: res.id,
    name: typeof res.name === "string" ? res.name : args.name,
    ...vendorPayFields(res),
  };
}

/**
 * Creating a bill. The invoice number and date NEST inside `invoice`; the due
 * date does NOT, it is top level. Both learned from refusals.
 */
export async function createBillBill(
  session: BillSession,
  args: {
    vendorId: string;
    amount: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    description: string;
  }
): Promise<string> {
  const res = await v3<{ id?: string }>(
    "/bills",
    {
      vendorId: args.vendorId,
      invoice: { invoiceNumber: args.invoiceNumber, invoiceDate: args.invoiceDate },
      dueDate: args.dueDate,
      billLineItems: [{ amount: args.amount, description: args.description }],
    },
    { sessionId: session.sessionId }
  );
  if (typeof res.id !== "string") throw new BillError(200, res);
  return res.id;
}

export type BillFundingAccount = {
  id: string;
  name: string;
  status: string;
  archived: boolean;
  /** Only a VERIFIED, unarchived account can actually pay. */
  usable: boolean;
};

/**
 * Where money can come from. PRESENCE IS NOT USABILITY: the first version of
 * this read the first row and called it a funding account, and the row was
 * archived and PENDING and could pay nothing. A row has to be unarchived AND
 * verified to count, and every row is returned with its state so a caller can
 * say WHY rather than just refusing.
 */
export async function listBillFundingAccounts(
  session: BillSession
): Promise<BillFundingAccount[]> {
  const r = await fetch(`${HOSTS[billEnv()].gateway}/funding-accounts/banks`, {
    headers: { "Content-Type": "application/json", devKey: devKey(), sessionId: session.sessionId },
    cache: "no-store",
  });
  const parsed = await readJson(r);
  if (!billSucceeded(r.status, parsed)) throw new BillError(r.status, parsed);
  const rows = (parsed as { results?: unknown }).results;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const b = row as { id?: unknown; nameOnAccount?: unknown; bankName?: unknown; status?: unknown; archived?: unknown };
    const status = typeof b.status === "string" ? b.status : "";
    const archived = b.archived === true;
    return {
      id: typeof b.id === "string" ? b.id : "",
      name:
        (typeof b.nameOnAccount === "string" && b.nameOnAccount) ||
        (typeof b.bankName === "string" && b.bankName) ||
        "Bank account",
      status,
      archived,
      usable: !archived && status.toUpperCase() === "VERIFIED",
    };
  }).filter((b) => b.id);
}

/** Submitting the payment. This is the call that moves money. */
export async function createBillPayment(
  session: BillSession,
  args: { vendorId: string; billId: string; amount: number; fundingAccountId: string; processDate: string }
): Promise<string> {
  const res = await v3<{ id?: string }>(
    "/payments",
    {
      vendorId: args.vendorId,
      processDate: args.processDate,
      amount: args.amount,
      billId: args.billId,
      createBill: false,
      fundingAccount: { id: args.fundingAccountId, type: "BANK_ACCOUNT" },
      processingOptions: {},
    },
    { sessionId: session.sessionId }
  );
  if (typeof res.id !== "string") throw new BillError(200, res);
  return res.id;
}

/** What BILL says about a bill now, for reading paid status back. */
export async function readBillBill(
  session: BillSession,
  billId: string
): Promise<BillBillState | null> {
  const r = await fetch(`${HOSTS[billEnv()].gateway}/bills/${encodeURIComponent(billId)}`, {
    headers: { "Content-Type": "application/json", devKey: devKey(), sessionId: session.sessionId },
    cache: "no-store",
  });
  const parsed = await readJson(r);
  if (!billSucceeded(r.status, parsed)) return null;
  const b = parsed as { paymentStatus?: unknown; dueAmount?: unknown; payments?: unknown };
  // NULL WHEN ABSENT, never 0. An earlier version coerced a missing field to
  // zero and the caller read zero as "nothing outstanding", which marked every
  // bill paid. See lib/bill-settled.ts.
  const due =
    b.dueAmount === null || b.dueAmount === undefined || b.dueAmount === ""
      ? null
      : Number(b.dueAmount);
  return {
    paymentStatus: typeof b.paymentStatus === "string" ? b.paymentStatus : "",
    // numeric comes back as a string from plenty of APIs, this one included.
    dueAmount: due !== null && Number.isFinite(due) ? due : null,
    // OBSERVED on a real bill: `payments` is an array, empty while nothing has
    // been paid. NULL when absent, never 0, for the same reason as dueAmount:
    // an absence must not be able to say anything.
    paymentCount: Array.isArray(b.payments) ? b.payments.length : null,
  };
}
