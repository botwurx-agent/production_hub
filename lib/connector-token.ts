/**
 * The private link behind the AI connector. The token in the URL IS the
 * credential (Claude's and ChatGPT's custom connectors take a URL, and a URL
 * with a secret in it is the one thing both accept without an OAuth server),
 * so it is long, random, shown once, and only ever stored as a hash.
 *
 * NOT `server-only`, so the shape rules can be unit tested.
 */
import { createHash, randomBytes } from "node:crypto";

export const TOKEN_PREFIX = "sfc_";

/** 192 bits, base64url: 32 characters after the prefix. */
export function newConnectorToken(): string {
  return TOKEN_PREFIX + randomBytes(24).toString("base64url");
}

/** Cheap shape check before any database read, so junk never costs a query. */
export function looksLikeToken(t: string): boolean {
  return /^sfc_[A-Za-z0-9_-]{32}$/.test(t);
}

export function hashConnectorToken(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

/** What a list shows so a person can tell two links apart without the secret. */
export function tokenLast4(t: string): string {
  return t.slice(-4);
}

/** The connector URL for a token on a given origin, with no trailing slash. */
export function connectorUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/api/mcp/${token}`;
}

/** A name is for telling links apart ("Claude on my laptop"); never empty. */
export function cleanLinkName(raw: unknown): string {
  const s = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  return s || "AI connector";
}
