// Server-only Figma OAuth + REST helpers. Read-only: pull a file's frames and
// render them to PNGs to import as project assets. Access tokens are refreshed
// on demand from the stored refresh token.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EmailAccount } from "@/lib/database.types";

const AUTH_URL = "https://www.figma.com/oauth";
const TOKEN_URL = "https://api.figma.com/v1/oauth/token";
const REFRESH_URL = "https://api.figma.com/v1/oauth/refresh";
const API = "https://api.figma.com/v1";

// Figma's granular read scope (current apps reject the legacy "file_read").
export const FIGMA_SCOPE = "files:read";

export function figmaConfigured(): boolean {
  return Boolean(
    process.env.FIGMA_CLIENT_ID && process.env.FIGMA_CLIENT_SECRET
  );
}

export function buildFigmaAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FIGMA_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: FIGMA_SCOPE,
    state,
    response_type: "code",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type FigmaTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export async function exchangeFigmaCode(
  code: string,
  redirectUri: string
): Promise<FigmaTokens> {
  const body = new URLSearchParams({
    client_id: process.env.FIGMA_CLIENT_ID!,
    client_secret: process.env.FIGMA_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    code,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Figma token exchange failed: ${res.status}`);
  }
  return (await res.json()) as FigmaTokens;
}

export type FigmaUser = { id: string; email: string; handle: string };

export async function getFigmaMe(token: string): Promise<FigmaUser> {
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not read Figma account.");
  const d = (await res.json()) as {
    id: string;
    email?: string;
    handle?: string;
  };
  return { id: d.id, email: d.email ?? "", handle: d.handle ?? "Figma" };
}

// Returns a valid access token, refreshing it if it has expired.
export async function getAccessToken(
  supabase: SupabaseClient<Database>,
  account: Pick<
    EmailAccount,
    "id" | "access_token" | "refresh_token" | "token_expiry"
  >
): Promise<string> {
  const exp = account.token_expiry
    ? new Date(account.token_expiry).getTime()
    : 0;
  if (account.access_token && exp - 60_000 > Date.now()) {
    return account.access_token;
  }
  if (!account.refresh_token) {
    throw new Error("Figma needs reconnecting (no refresh token).");
  }
  const body = new URLSearchParams({
    client_id: process.env.FIGMA_CLIENT_ID!,
    client_secret: process.env.FIGMA_CLIENT_SECRET!,
    refresh_token: account.refresh_token,
  });
  const res = await fetch(REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Could not refresh Figma access.");
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  const expiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase
    .from("email_accounts")
    .update({ access_token: data.access_token, token_expiry: expiry })
    .eq("id", account.id);
  return data.access_token;
}

// Extracts a file key from a Figma URL (figma.com/file/KEY or /design/KEY),
// or accepts a bare key.
export function parseFileKey(input: string): string | null {
  const s = input.trim();
  const m = s.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]{10,}$/.test(s)) return s;
  return null;
}

export type FigmaFrame = { id: string; name: string; page: string };

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
};

// Top-level frames/components per page (what a designer would export).
export async function getFileFrames(
  token: string,
  key: string
): Promise<{ fileName: string; frames: FigmaFrame[] }> {
  const res = await fetch(`${API}/files/${key}?depth=2`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Figma file ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    name?: string;
    document?: FigmaNode;
  };
  const frames: FigmaFrame[] = [];
  const wanted = new Set([
    "FRAME",
    "COMPONENT",
    "COMPONENT_SET",
    "SECTION",
  ]);
  for (const page of data.document?.children ?? []) {
    for (const node of page.children ?? []) {
      if (wanted.has(node.type)) {
        frames.push({ id: node.id, name: node.name, page: page.name });
      }
    }
  }
  return { fileName: data.name ?? "Figma file", frames };
}

// Renders nodes to image URLs (public, short-lived S3 links).
export async function getImageUrls(
  token: string,
  key: string,
  ids: string[],
  scale = 2,
  format: "png" | "jpg" | "svg" = "png"
): Promise<Record<string, string | null>> {
  if (ids.length === 0) return {};
  const params = new URLSearchParams({
    ids: ids.join(","),
    format,
    scale: String(scale),
  });
  const res = await fetch(`${API}/images/${key}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Figma images ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    images?: Record<string, string | null>;
  };
  return data.images ?? {};
}

// Downloads a rendered image (the URL is public, no auth needed).
export async function fetchImageBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download the Figma render.");
  return Buffer.from(await res.arrayBuffer());
}
