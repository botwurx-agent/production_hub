import "server-only";

// Higgsfield over its MCP connection: the same sign-in and the same plan
// credits Claude uses when somebody connects Higgsfield there. Chosen over
// Higgsfield's REST API (2026-10-12) because the API is a SEPARATE account with
// its own prepaid dollar balance, so a studio already paying for a Higgsfield
// plan would have paid twice. The MCP connection spends the plan.
//
// WHAT THIS IS NOT: a published, versioned API. MCP tools are described for an
// AI agent and Higgsfield can rename or reshape one without notice. So nothing
// here assumes a tool's input shape from memory: the probe
// (/api/diagnostics/higgsfield) prints the live tool list, and a feature built
// on a tool reads its schema from that list rather than from this file.
//
// SIGN-IN, verified against mcp.higgsfield.ai on 2026-10-12:
// - Dynamic client registration is open (POST /oauth2/register answered 201
//   with a public client id, no secret, no approval step).
// - Public client + PKCE (S256), scopes openid email offline_access, refresh
//   tokens supported.
// - The `resource` parameter (RFC 8707, which the MCP spec asks for) names
//   https://mcp.higgsfield.ai/mcp.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EmailAccount } from "@/lib/database.types";

export const HF_MCP_URL = "https://mcp.higgsfield.ai/mcp";

// WHERE TO SIGN IN IS DISCOVERED, NOT HARDCODED. Until November 2026 the
// sign-in lived on mcp.higgsfield.ai/oauth2/*; Higgsfield then moved it to
// Clerk (clerk.higgsfield.ai/oauth/*). The old register endpoint started
// refusing, and tokens it had issued began failing their backend's check on
// every tool ("FNF API GET /mcp/workspaces failed (401)"). The MCP spec says to
// read the protected resource's metadata for its authorization server, then
// that server's metadata for its endpoints, which is what Claude does, so a
// move like that is followed with no deploy. The constant below is only used
// when discovery itself fails.
export type HfEndpoints = { issuer: string; authorize: string; token: string; register: string };
const FALLBACK_ENDPOINTS: HfEndpoints = {
  issuer: "https://clerk.higgsfield.ai",
  authorize: "https://clerk.higgsfield.ai/oauth/authorize",
  token: "https://clerk.higgsfield.ai/oauth/token",
  register: "https://clerk.higgsfield.ai/oauth/register",
};
let endpointCache: { at: number; ep: HfEndpoints } | null = null;

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function higgsfieldEndpoints(): Promise<HfEndpoints> {
  if (endpointCache && Date.now() - endpointCache.at < 60 * 60 * 1000) return endpointCache.ep;
  const pr = await getJson("https://mcp.higgsfield.ai/.well-known/oauth-protected-resource");
  const servers = Array.isArray(pr?.authorization_servers) ? pr.authorization_servers : [];
  const as = typeof servers[0] === "string" ? servers[0].replace(/\/$/, "") : null;
  if (as && /^https:\/\//.test(as)) {
    const meta =
      (await getJson(`${as}/.well-known/oauth-authorization-server`)) ??
      (await getJson(`${as}/.well-known/openid-configuration`));
    const str = (k: string) => (typeof meta?.[k] === "string" && /^https:\/\//.test(meta[k] as string) ? (meta[k] as string) : null);
    const authorize = str("authorization_endpoint");
    const token = str("token_endpoint");
    const register = str("registration_endpoint");
    if (authorize && token && register) {
      const ep = { issuer: str("issuer") ?? as, authorize, token, register };
      endpointCache = { at: Date.now(), ep };
      return ep;
    }
  }
  console.error("[higgsfield] sign-in discovery failed, using the fallback endpoints");
  return FALLBACK_ENDPOINTS;
}

export const HF_SCOPE = "openid email offline_access";
const MCP_PROTOCOL = "2025-06-18";

/** Always true: there are no credentials of ours to configure. */
export function higgsfieldConfigured(): boolean {
  return true;
}

/** What the connection row keeps in external_ref. */
/** `issuer` is the sign-in server the client id was registered with; a row
 *  without one predates the move to Clerk and its client id is no good. */
export type HfRef = { client_id: string; redirect_uri: string; sub?: string; issuer?: string };

export function hfRef(raw: unknown): HfRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.client_id !== "string" || typeof r.redirect_uri !== "string") return null;
  return {
    client_id: r.client_id,
    redirect_uri: r.redirect_uri,
    sub: typeof r.sub === "string" ? r.sub : undefined,
    issuer: typeof r.issuer === "string" ? r.issuer : undefined,
  };
}

/** Registers Studio Flows as a client for this redirect URI. */
export async function registerHiggsfieldClient(redirectUri: string, ep: HfEndpoints): Promise<string> {
  const res = await fetch(ep.register, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "Studio Flows",
      client_uri: "https://studio-flows.com",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: HF_SCOPE,
    }),
  });
  const body = (await res.json().catch(() => null)) as { client_id?: unknown } | null;
  if (!res.ok || typeof body?.client_id !== "string") {
    console.error("[higgsfield] client registration refused:", ep.register, res.status, JSON.stringify(body).slice(0, 300));
    throw new Error(`Higgsfield client registration failed (${res.status}).`);
  }
  return body.client_id;
}

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** A PKCE verifier and its S256 challenge. */
export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

export function buildHiggsfieldAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  ep: HfEndpoints;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: HF_SCOPE,
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
    resource: HF_MCP_URL,
  });
  return `${opts.ep.authorize}?${params.toString()}`;
}

export type HfTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
};

async function tokenRequest(body: URLSearchParams): Promise<HfTokens> {
  const ep = await higgsfieldEndpoints();
  const res = await fetch(ep.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const data = (await res.json().catch(() => null)) as
    | (HfTokens & { error?: string; error_description?: string })
    | null;
  if (!res.ok || !data?.access_token) {
    const why = data?.error_description || data?.error || `HTTP ${res.status}`;
    console.error("[higgsfield] token request refused:", body.get("grant_type"), why);
    throw new Error(`Higgsfield token request failed: ${why}`);
  }
  return data;
}

export function exchangeHiggsfieldCode(opts: {
  clientId: string;
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<HfTokens> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: opts.clientId,
      code: opts.code,
      code_verifier: opts.verifier,
      redirect_uri: opts.redirectUri,
      resource: HF_MCP_URL,
    })
  );
}

/**
 * The email in the id token, for the Settings row's label. Decoded WITHOUT
 * verifying the signature, which is fine for a display label and nothing else:
 * no access decision is ever made on it.
 */
export function idTokenIdentity(idToken?: string): { email: string | null; sub: string | null } {
  if (!idToken) return { email: null, sub: null };
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    return {
      email: typeof payload.email === "string" ? payload.email : null,
      sub: typeof payload.sub === "string" ? payload.sub : null,
    };
  } catch {
    return { email: null, sub: null };
  }
}

export function expiryFrom(tokens: HfTokens): string {
  // Absent expires_in is treated as an hour rather than forever, so a token
  // with an unknown life is refreshed early instead of used until it fails.
  const secs = Number(tokens.expires_in) > 0 ? Number(tokens.expires_in) : 3600;
  return new Date(Date.now() + secs * 1000).toISOString();
}

/** A valid access token for this connection, refreshing it when it has run out. */
export async function getHiggsfieldToken(
  supabase: SupabaseClient<Database>,
  account: Pick<EmailAccount, "id" | "access_token" | "refresh_token" | "token_expiry" | "external_ref">
): Promise<string> {
  const exp = account.token_expiry ? new Date(account.token_expiry).getTime() : 0;
  if (account.access_token && exp - 60_000 > Date.now()) return account.access_token;
  const ref = hfRef(account.external_ref);
  // A connection made on the old sign-in server cannot be refreshed on the new
  // one: its client id and refresh token belong to the old system.
  const ep = await higgsfieldEndpoints();
  if (!account.refresh_token || !ref || ref.issuer !== ep.issuer) {
    throw new Error("Higgsfield needs reconnecting in Settings.");
  }
  const tokens = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: ref.client_id,
      refresh_token: account.refresh_token,
      resource: HF_MCP_URL,
    })
  );
  await supabase
    .from("email_accounts")
    .update({
      access_token: tokens.access_token,
      // Refresh tokens may rotate; keep the old one only if no new one came.
      refresh_token: tokens.refresh_token ?? account.refresh_token,
      token_expiry: expiryFrom(tokens),
    })
    .eq("id", account.id);
  return tokens.access_token;
}

// ----- The MCP conversation itself (Streamable HTTP, JSON-RPC 2.0) ------------

export type McpReply = {
  status: number;
  contentType: string;
  /** The JSON-RPC message answering our request, when one could be read. */
  message: { result?: unknown; error?: { code?: number; message?: string } } | null;
  /** The raw body, cut short, for the probe to print when parsing fails. */
  raw: string;
};

/** Reads a JSON-RPC reply out of a plain JSON body or an SSE stream. */
export function readMcpBody(text: string, contentType: string, id: number): McpReply["message"] {
  const pick = (v: unknown) => {
    const list = Array.isArray(v) ? v : [v];
    for (const m of list) {
      if (m && typeof m === "object" && (m as { id?: unknown }).id === id) return m as McpReply["message"];
    }
    return null;
  };
  if (contentType.includes("text/event-stream")) {
    // Each event's data lines are joined; the reply is the event whose id is ours.
    for (const event of text.split(/\r?\n\r?\n/)) {
      const data = event
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      try {
        const hit = pick(JSON.parse(data));
        if (hit) return hit;
      } catch {
        // not JSON, keep looking
      }
    }
    return null;
  }
  try {
    return pick(JSON.parse(text));
  } catch {
    return null;
  }
}

/** One MCP session on behalf of a signed-in Higgsfield account. */
export class HiggsfieldMcp {
  private sessionId: string | null = null;
  private nextId = 1;
  constructor(private token: string) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": MCP_PROTOCOL,
    };
    if (this.sessionId) h["Mcp-Session-Id"] = this.sessionId;
    return h;
  }

  async request(method: string, params?: unknown): Promise<McpReply> {
    const id = this.nextId++;
    const res = await fetch(HF_MCP_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) }),
    });
    const sid = res.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    return { status: res.status, contentType, message: readMcpBody(text, contentType, id), raw: text.slice(0, 4000) };
  }

  async notify(method: string, params?: unknown): Promise<number> {
    const res = await fetch(HF_MCP_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) }),
    });
    await res.text().catch(() => "");
    return res.status;
  }

  /** initialize + notifications/initialized, as the protocol requires. */
  async open(): Promise<McpReply> {
    const init = await this.request("initialize", {
      protocolVersion: MCP_PROTOCOL,
      capabilities: {},
      clientInfo: { name: "Studio Flows", version: "1.0" },
    });
    if (init.message?.result) await this.notify("notifications/initialized");
    return init;
  }

  /** Ends the session politely; failure is harmless. */
  async close(): Promise<void> {
    if (!this.sessionId) return;
    await fetch(HF_MCP_URL, { method: "DELETE", headers: this.headers() }).catch(() => undefined);
  }
}
