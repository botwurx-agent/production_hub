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
  "chat:write",
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

// ---------------------------------------------------------------------------
// Web API (read). All calls use the connected user's token.
// ---------------------------------------------------------------------------
const API = "https://slack.com/api";

async function slackGet<T>(
  token: string,
  method: string,
  params: Record<string, string>
): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}/${method}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!data.ok) throw new Error(`Slack ${method}: ${data.error ?? "error"}`);
  return data;
}

export type SlackConversationMatch = {
  channelId: string;
  channelName: string;
  snippet: string;
};

// Lists the user's conversations (channels, private channels, group + direct
// messages) and filters by name. Empty query returns the full list to browse.
// DM names are resolved via users.info (bounded).
export async function searchConversations(
  token: string,
  query: string,
  max = 40
): Promise<SlackConversationMatch[]> {
  const q = query.trim().toLowerCase();
  const data = await slackGet<{
    channels?: {
      id: string;
      name?: string;
      is_im?: boolean;
      user?: string;
    }[];
  }>(token, "conversations.list", {
    types: "public_channel,private_channel,mpim,im",
    exclude_archived: "true",
    limit: "200",
  });

  const channels = data.channels ?? [];
  const out: SlackConversationMatch[] = [];
  let imLookups = 0;

  for (const c of channels) {
    let name = c.name;
    // Direct messages have no name; resolve the other user (bounded to 60).
    if (!name && c.is_im && c.user && imLookups < 60) {
      imLookups += 1;
      try {
        const u = await slackGet<{
          user?: { real_name?: string; name?: string };
        }>(token, "users.info", { user: c.user });
        name = u.user?.real_name || u.user?.name || c.user;
      } catch {
        name = c.user;
      }
    }
    const label = name || c.id;
    if (q && !label.toLowerCase().includes(q)) continue;
    out.push({ channelId: c.id, channelName: label, snippet: "" });
    if (out.length >= max) break;
  }
  return out;
}

export type SlackFile = {
  id: string;
  name: string;
  mimetype: string;
  size: number;
  urlPrivateDownload: string;
};
export type SlackMessage = {
  ts: string;
  author: string;
  text: string;
  files: SlackFile[];
};

export async function getConversationHistory(
  token: string,
  channelId: string,
  limit = 30
): Promise<SlackMessage[]> {
  const data = await slackGet<{
    messages?: {
      ts: string;
      user?: string;
      username?: string;
      text?: string;
      files?: {
        id: string;
        name?: string;
        mimetype?: string;
        size?: number;
        url_private_download?: string;
      }[];
    }[];
  }>(token, "conversations.history", {
    channel: channelId,
    limit: String(limit),
  });

  const messages = data.messages ?? [];
  // Resolve user display names (cached per call).
  const nameCache = new Map<string, string>();
  const resolve = async (userId?: string): Promise<string> => {
    if (!userId) return "Unknown";
    if (nameCache.has(userId)) return nameCache.get(userId)!;
    try {
      const u = await slackGet<{
        user?: { real_name?: string; name?: string };
      }>(token, "users.info", { user: userId });
      const name = u.user?.real_name || u.user?.name || userId;
      nameCache.set(userId, name);
      return name;
    } catch {
      return userId;
    }
  };

  const out: SlackMessage[] = [];
  for (const m of messages.reverse()) {
    out.push({
      ts: m.ts,
      author: m.username || (await resolve(m.user)),
      text: m.text || "",
      files: (m.files ?? [])
        .filter((f) => f.url_private_download)
        .map((f) => ({
          id: f.id,
          name: f.name || "file",
          mimetype: f.mimetype || "application/octet-stream",
          size: f.size || 0,
          urlPrivateDownload: f.url_private_download!,
        })),
    });
  }
  return out;
}

// Counts channel messages newer than sinceTs (epoch seconds string) that were
// not authored by the connected user, skipping system messages (joins, etc.).
// An empty sinceTs counts the recent window. Used for the Communication badge.
export async function countNewIncoming(
  token: string,
  channelId: string,
  sinceTs: string,
  myUserId: string
): Promise<number> {
  const params: Record<string, string> = { channel: channelId, limit: "100" };
  if (sinceTs) {
    params.oldest = sinceTs;
    params.inclusive = "false";
  }
  const data = await slackGet<{
    messages?: { ts: string; user?: string; subtype?: string }[];
  }>(token, "conversations.history", params);
  let n = 0;
  for (const m of data.messages ?? []) {
    if (m.subtype) continue;
    if (m.user && m.user === myUserId) continue;
    n += 1;
  }
  return n;
}

// Posts a message to a channel as the connected user (needs chat:write).
export async function postSlackMessage(
  token: string,
  channelId: string,
  text: string
): Promise<void> {
  const res = await fetch(`${API}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: channelId, text }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(`Slack send: ${data.error ?? "error"}`);
}

export async function getSlackFileBytes(
  token: string,
  urlPrivateDownload: string
): Promise<Buffer> {
  const res = await fetch(urlPrivateDownload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Slack file download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

