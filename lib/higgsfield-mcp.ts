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

const ISSUER = "https://mcp.higgsfield.ai";
export const HF_MCP_URL = `${ISSUER}/mcp`;
const AUTHORIZE_URL = `${ISSUER}/oauth2/authorize`;
const TOKEN_URL = `${ISSUER}/oauth2/token`;
const REGISTER_URL = `${ISSUER}/oauth2/register`;
export const HF_SCOPE = "openid email offline_access";
const MCP_PROTOCOL = "2025-06-18";

/** Always true: there are no credentials of ours to configure. */
export function higgsfieldConfigured(): boolean {
  return true;
}

/** What the connection row keeps in external_ref. */
export type HfRef = { client_id: string; redirect_uri: string; sub?: string };

export function hfRef(raw: unknown): HfRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.client_id !== "string" || typeof r.redirect_uri !== "string") return null;
  return {
    client_id: r.client_id,
    redirect_uri: r.redirect_uri,
    sub: typeof r.sub === "string" ? r.sub : undefined,
  };
}

/** Registers Studio Flows as a client for this redirect URI. */
export async function registerHiggsfieldClient(redirectUri: string): Promise<string> {
  const res = await fetch(REGISTER_URL, {
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
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type HfTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
};

async function tokenRequest(body: URLSearchParams): Promise<HfTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const data = (await res.json().catch(() => null)) as
    | (HfTokens & { error?: string; error_description?: string })
    | null;
  if (!res.ok || !data?.access_token) {
    const why = data?.error_description || data?.error || `HTTP ${res.status}`;
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
  if (!account.refresh_token || !ref) {
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
