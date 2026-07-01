// Server-only Gmail REST helpers. Access tokens are refreshed on demand from
// the stored refresh token. All calls act as the connected user (users/me).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EmailAccount } from "@/lib/database.types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

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
  // Reuse the token if it has more than a minute of life left.
  if (account.access_token && exp - 60_000 > Date.now()) {
    return account.access_token;
  }
  if (!account.refresh_token) {
    throw new Error("Gmail needs reconnecting (no refresh token).");
  }

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: account.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Could not refresh Gmail access.");
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

async function gapi<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

function headerMap(headers: GmailHeader[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers ?? []) map[h.name.toLowerCase()] = h.value;
  return map;
}

function decodeB64(data: string): string {
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export type ThreadSummary = {
  gmailThreadId: string;
  subject: string;
  from: string;
  snippet: string;
  dateMs: number;
};

export async function searchThreads(
  accessToken: string,
  query: string,
  max = 12
): Promise<ThreadSummary[]> {
  const list = await gapi<{ messages?: { id: string }[] }>(
    accessToken,
    `messages?q=${encodeURIComponent(query)}&maxResults=${max}`
  );
  const ids = (list.messages ?? []).map((m) => m.id);
  const metas = await Promise.all(
    ids.map((id) =>
      gapi<GmailMessage>(
        accessToken,
        `messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`
      )
    )
  );
  const byThread = new Map<string, ThreadSummary>();
  for (const m of metas) {
    const h = headerMap(m.payload?.headers);
    const dateMs = Number(m.internalDate ?? 0);
    const prev = byThread.get(m.threadId);
    if (!prev || dateMs > prev.dateMs) {
      byThread.set(m.threadId, {
        gmailThreadId: m.threadId,
        subject: h["subject"] || "(no subject)",
        from: h["from"] || "",
        snippet: m.snippet || "",
        dateMs,
      });
    }
  }
  return [...byThread.values()].sort((a, b) => b.dateMs - a.dateMs);
}

export type ThreadAttachment = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
};
export type ThreadMessage = {
  id: string;
  from: string;
  to: string;
  date: string;
  dateMs: number;
  bodyText: string;
  attachments: ThreadAttachment[];
};

function walkParts(
  part: GmailPart | undefined,
  acc: { plain: string; html: string; attachments: ThreadAttachment[] }
) {
  if (!part) return acc;
  if (part.filename && part.body?.attachmentId) {
    acc.attachments.push({
      attachmentId: part.body.attachmentId,
      filename: part.filename,
      mimeType: part.mimeType || "application/octet-stream",
      size: part.body.size || 0,
    });
  } else if (part.mimeType === "text/plain" && part.body?.data && !acc.plain) {
    acc.plain = decodeB64(part.body.data);
  } else if (part.mimeType === "text/html" && part.body?.data && !acc.html) {
    acc.html = decodeB64(part.body.data);
  }
  for (const p of part.parts ?? []) walkParts(p, acc);
  return acc;
}

export async function getThread(
  accessToken: string,
  gmailThreadId: string
): Promise<ThreadMessage[]> {
  const t = await gapi<{ messages?: GmailMessage[] }>(
    accessToken,
    `threads/${gmailThreadId}?format=full`
  );
  return (t.messages ?? []).map((m) => {
    const h = headerMap(m.payload?.headers);
    const acc = walkParts(m.payload, { plain: "", html: "", attachments: [] });
    const bodyText = acc.plain || (acc.html ? stripHtml(acc.html) : m.snippet || "");
    return {
      id: m.id,
      from: h["from"] || "",
      to: h["to"] || "",
      date: h["date"] || "",
      dateMs: Number(m.internalDate ?? 0),
      bodyText,
      attachments: acc.attachments,
    };
  });
}

// Returns the raw bytes of an attachment.
export async function getAttachmentBytes(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const a = await gapi<{ data: string }>(
    accessToken,
    `messages/${messageId}/attachments/${attachmentId}`
  );
  return Buffer.from(a.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
