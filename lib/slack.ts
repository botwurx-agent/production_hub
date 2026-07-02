// Server-only Slack OAuth helpers (connection foundation).
// User-token flow: we read conversations as the connecting user. Slack user
// tokens do not expire, so there is no refresh step.

const SLACK_AUTH_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

// User-token scopes for reading conversations + files (used by later slices).
export const SLACK_USER_SCOPES = [
  "channels:history",
  "channels:read",
  "groups:history",
  "groups:read",
  "im:history",
  "im:read",
  "mpim:history",
  "mpim:read",
  "users:read",
  "files:read",
  "search:read",
].join(",");

export function slackConfigured(): boolean {
  return Boolean(
    process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
  );
}

export function buildSlackAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    user_scope: SLACK_USER_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `${SLACK_AUTH_URL}?${params.toString()}`;
}

export type SlackConnection = {
  userToken: string;
  scope: string;
  teamId: string;
  teamName: string;
  slackUserId: string;
};

export async function exchangeSlackCode(
  code: string,
  redirectUri: string
): Promise<SlackConnection> {
  const body = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    client_secret: process.env.SLACK_CLIENT_SECRET!,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(SLACK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    authed_user?: { id: string; scope: string; access_token: string };
    team?: { id: string; name: string };
  };
  if (!data.ok || !data.authed_user?.access_token) {
    throw new Error(`Slack OAuth failed: ${data.error ?? "unknown error"}`);
  }
  return {
    userToken: data.authed_user.access_token,
    scope: data.authed_user.scope,
    teamId: data.team?.id ?? "",
    teamName: data.team?.name ?? "Slack",
    slackUserId: data.authed_user.id,
  };
}
