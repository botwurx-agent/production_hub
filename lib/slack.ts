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

// Search messages, then dedupe to the channels they live in (link targets).
export async function searchConversations(
  token: string,
  query: string,
  max = 20
): Promise<SlackConversationMatch[]> {
  const data = await slackGet<{
    messages?: {
      matches?: {
        channel?: { id: string; name?: string };
        text?: string;
      }[];
    };
  }>(token, "search.messages", { query, count: String(max) });

  const byChannel = new Map<string, SlackConversationMatch>();
  for (const m of data.messages?.matches ?? []) {
    const ch = m.channel;
    if (!ch?.id || byChannel.has(ch.id)) continue;
    byChannel.set(ch.id, {
      channelId: ch.id,
      channelName: ch.name || ch.id,
      snippet: m.text || "",
    });
  }
  return [...byChannel.values()];
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

