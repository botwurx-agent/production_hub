// Server-only Google Chat REST helpers. All calls act as the connected Google
// user (user authentication), so they see the spaces that user is a member of
// and post messages attributed to them (text-only, per the Chat API). Access
// tokens are the same Google tokens used for Gmail (refreshed via getAccessToken).
import "server-only";

const API = "https://chat.googleapis.com/v1";

// Google Chat rides on the Google account's granted scopes. Chat is available
// once a Chat scope is present; sending needs the writable chat.messages scope.
export function chatConnected(scope: string | null | undefined): boolean {
  const s = scope ?? "";
  return s.includes("chat.spaces") || s.includes("chat.messages");
}
export function chatCanSend(scope: string | null | undefined): boolean {
  return (scope ?? "").includes("chat.messages");
}

async function chatGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Chat API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export type ChatSpaceMatch = {
  spaceName: string; // resource name, e.g. "spaces/AAAA"
  displayName: string;
  snippet: string;
};

// Lists the spaces the connected user belongs to, filtered by display name.
// An empty query returns the full list to browse. Direct messages have no
// display name, so they show generically.
export async function listSpaces(
  token: string,
  query = "",
  max = 50
): Promise<ChatSpaceMatch[]> {
  const data = await chatGet<{
    spaces?: { name?: string; displayName?: string; spaceType?: string }[];
  }>(token, "spaces?pageSize=100");

  const q = query.trim().toLowerCase();
  const out: ChatSpaceMatch[] = [];
  for (const s of data.spaces ?? []) {
    if (!s.name) continue;
    const label =
      s.displayName ||
      (s.spaceType === "DIRECT_MESSAGE" ? "Direct message" : s.name);
    if (q && !label.toLowerCase().includes(q)) continue;
    out.push({
      spaceName: s.name,
      displayName: label,
      snippet:
        s.spaceType === "DIRECT_MESSAGE"
          ? "Direct message"
          : s.spaceType === "GROUP_CHAT"
            ? "Group chat"
            : "Space",
    });
    if (out.length >= max) break;
  }
  return out;
}

export type ChatMessage = {
  name: string; // message resource name
  senderName: string; // "users/{id}" of the sender
  author: string; // display name for the UI
  text: string;
  createTime: string;
  createTimeMs: number;
};

// Reads recent messages in a space (newest first from the API, returned oldest
// first for display).
export async function listSpaceMessages(
  token: string,
  spaceName: string,
  limit = 30
): Promise<ChatMessage[]> {
  const data = await chatGet<{
    messages?: {
      name?: string;
      text?: string;
      createTime?: string;
      sender?: { name?: string; displayName?: string };
    }[];
  }>(
    token,
    `${spaceName}/messages?pageSize=${limit}&orderBy=${encodeURIComponent("createTime DESC")}`
  );

  const msgs = (data.messages ?? []).map((m) => ({
    name: m.name ?? "",
    senderName: m.sender?.name ?? "",
    author: m.sender?.displayName || "Member",
    text: m.text ?? "",
    createTime: m.createTime ?? "",
    createTimeMs: m.createTime ? Date.parse(m.createTime) : 0,
  }));
  return msgs.reverse();
}

// Posts a text message to a space as the connected user (needs chat.messages).
export async function createSpaceMessage(
  token: string,
  spaceName: string,
  text: string
): Promise<void> {
  const res = await fetch(`${API}/${spaceName}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Chat send ${res.status}: ${await res.text()}`);
  }
}

// Counts messages newer than sinceMs not authored by the connected user, for
// the Communication badge. myUserName is "users/{id}" (empty skips exclusion).
export async function countNewIncoming(
  token: string,
  spaceName: string,
  sinceMs: number,
  myUserName: string
): Promise<number> {
  const msgs = await listSpaceMessages(token, spaceName, 100);
  let n = 0;
  for (const m of msgs) {
    if (m.createTimeMs > sinceMs && (!myUserName || m.senderName !== myUserName)) {
      n += 1;
    }
  }
  return n;
}
