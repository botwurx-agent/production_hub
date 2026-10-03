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
import type { SupabaseClient } from "@supabase/supabase-js";
import { billFailure, billSucceeded } from "@/lib/bill-error";
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
