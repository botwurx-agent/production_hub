// Server-only Google OAuth helpers for the Gmail connector.
// Slice 1a requests read access (organize incoming mail + attachments);
// send scope is added in a later slice.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  // Google Chat: list the user's spaces, read messages, and post as the user.
  "https://www.googleapis.com/auth/chat.spaces.readonly",
  "https://www.googleapis.com/auth/chat.messages",
  "openid",
  "email",
  "profile",
].join(" ");

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline", // request a refresh token
    include_granted_scopes: "true",
    prompt: "consent", // force a refresh token on every connect
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
};

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as GoogleTokens;
}

function idTokenPayload(
  idToken: string | undefined
): Record<string, unknown> | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
  } catch {
    return null;
  }
}

// Extracts the account email from the OpenID id_token (no signature check
// needed: the token came directly from Google's token endpoint over TLS).
export function emailFromIdToken(idToken: string | undefined): string | null {
  const email = idTokenPayload(idToken)?.email;
  return typeof email === "string" ? email : null;
}

// The Google user id (OpenID `sub`). This is the same numeric id Google Chat
// uses in a User resource name ("users/{sub}"), so we store it to recognize the
// connected user's own Chat messages.
export function subFromIdToken(idToken: string | undefined): string | null {
  const sub = idTokenPayload(idToken)?.sub;
  return typeof sub === "string" ? sub : null;
}
