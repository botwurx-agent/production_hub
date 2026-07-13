// Server-only: assemble a compact, factual snapshot of a project's state for
// the AI layer. RLS on the passed client scopes every read to the studio.
// This is the shared "gather project context" step the AI features build on.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  PROJECT_STATUS,
  ASSET_STATUS,
  ASSET_TYPE_LABEL,
  APPROVAL_STATUS,
} from "@/lib/status";
import { shortDate, htmlToText } from "@/lib/format";
import { getAccessToken, getThread } from "@/lib/gmail";
import { getConversationHistory } from "@/lib/slack";
import { listSpaceMessages } from "@/lib/googlechat";

export async function gatherProjectContext(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<string | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, status, due_date, shoot_date, client:clients(name)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const [
    { data: brief },
    { data: assets },
    { data: activity },
    { count: emailCount },
    { count: slackCount },
    { count: chatCount },
  ] = await Promise.all([
    supabase
      .from("briefs")
      .select("content")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("assets")
      .select(
        "id, name, type, status, current_version_id, versions:versions!versions_asset_id_fkey(id, version_number, notes, created_at)"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .order("version_number", { referencedTable: "versions", ascending: false }),
    supabase
      .from("activity")
      .select("content, type, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("email_threads")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("slack_channels")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("chat_spaces")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  // Review state on the current version of each asset.
  const currentVersionIds = (assets ?? [])
    .map((a) => a.current_version_id)
    .filter((id): id is string => Boolean(id));
  const approvalsByVersion = new Map<string, string[]>();
  const commentsByVersion = new Map<string, number>();
  if (currentVersionIds.length > 0) {
    const [{ data: approvals }, { data: comments }] = await Promise.all([
      supabase
        .from("approvals")
        .select("status, target_id")
        .eq("target_type", "version")
        .in("target_id", currentVersionIds),
      supabase
        .from("review_comments")
        .select("version_id")
        .in("version_id", currentVersionIds),
    ]);
    for (const a of approvals ?? []) {
      const list = approvalsByVersion.get(a.target_id) ?? [];
      list.push(a.status);
      approvalsByVersion.set(a.target_id, list);
    }
    for (const c of comments ?? []) {
      if (!c.version_id) continue;
      commentsByVersion.set(
        c.version_id,
        (commentsByVersion.get(c.version_id) ?? 0) + 1
      );
    }
  }

  const lines: string[] = [];
  const clientName =
    (project.client as { name: string } | null)?.name ?? "No client set";
  lines.push(`Project: ${project.title}`);
  lines.push(`Client: ${clientName}`);
  lines.push(`Stage: ${PROJECT_STATUS[project.status].label}`);
  lines.push(
    `Shoot date: ${project.shoot_date ? shortDate(project.shoot_date) : "not set"}`
  );
  lines.push(
    `Due date: ${project.due_date ? shortDate(project.due_date) : "not set"}`
  );
  lines.push(
    `Linked conversations: ${emailCount ?? 0} email, ${slackCount ?? 0} Slack, ${chatCount ?? 0} Google Chat`
  );
  lines.push("");

  const briefText = htmlToText(brief?.content ?? "");
  lines.push("Brief:");
  lines.push(briefText || "(no brief written yet)");
  lines.push("");

  const assetList = assets ?? [];
  lines.push(`Assets (${assetList.length}):`);
  if (assetList.length === 0) lines.push("(no assets uploaded yet)");
  for (const a of assetList) {
    const versions = a.versions ?? [];
    const typeLabel = ASSET_TYPE_LABEL[a.type] ?? a.type;
    const statusLabel = ASSET_STATUS[a.status]?.label ?? a.status;
    let line = `- ${a.name} (${typeLabel}), status: ${statusLabel}, ${versions.length} version${versions.length === 1 ? "" : "s"}`;
    const latest = versions[0];
    if (latest?.created_at) {
      line += `, latest v${latest.version_number} on ${shortDate(latest.created_at)}`;
    }
    if (latest?.notes?.trim()) line += `, note: "${latest.notes.trim()}"`;
    const cv = a.current_version_id;
    if (cv) {
      const appr = approvalsByVersion.get(cv) ?? [];
      if (appr.length > 0) {
        const counts: Record<string, number> = {};
        for (const s of appr) counts[s] = (counts[s] ?? 0) + 1;
        const parts = Object.entries(counts).map(
          ([s, n]) =>
            `${n} ${APPROVAL_STATUS[s as keyof typeof APPROVAL_STATUS]?.label ?? s}`
        );
        line += `, internal review: ${parts.join(", ")}`;
      }
      const cc = commentsByVersion.get(cv) ?? 0;
      if (cc > 0) line += `, ${cc} comment${cc === 1 ? "" : "s"}`;
    }
    lines.push(line);
  }
  lines.push("");

  const activityList = activity ?? [];
  lines.push("Recent activity (newest first):");
  if (activityList.length === 0) lines.push("(no activity logged yet)");
  for (const ev of activityList) {
    lines.push(
      `- [${ev.created_at ? shortDate(ev.created_at) : ""}] ${ev.content}`
    );
  }

  return lines.join("\n");
}

// --- Email communication (linked Gmail threads, fetched live) ----------------
// Emails are not stored; only the link is. So to let the AI read what was
// actually discussed, we pull the linked threads from Gmail at generation time.
// Best-effort: any failure (no Gmail, token expired, API error) returns null and
// the summary falls back to the rest of the context.

const MAX_EMAIL_THREADS = 6;
const MAX_MSGS_PER_THREAD = 10;
const MAX_BODY_CHARS = 1200;
const MAX_CHANNELS = 4;
const MAX_CHANNEL_MSGS = 20;

// Strip quoted reply history and collapse whitespace so each message is a
// compact, token-cheap gist rather than a full nested email chain.
function condenseEmailBody(raw: string): string {
  const withoutQuotes = raw
    .split("\n")
    .filter((l) => !l.trimStart().startsWith(">"))
    .join("\n");
  // Drop everything from the first "On <date>, <person> wrote:" reply marker.
  const beforeReply = withoutQuotes.split(/On .{0,120}wrote:/)[0];
  const clean = beforeReply.replace(/\s+/g, " ").trim();
  return clean.length > MAX_BODY_CHARS
    ? `${clean.slice(0, MAX_BODY_CHARS)}…`
    : clean;
}

// Collapse a chat/Slack message to a compact gist.
function condenseText(raw: string): string {
  const clean = (raw || "").replace(/\s+/g, " ").trim();
  return clean.length > MAX_BODY_CHARS ? `${clean.slice(0, MAX_BODY_CHARS)}…` : clean;
}

export async function gatherProjectEmailContext(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<string | null> {
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry, email, scope")
    .eq("provider", "google")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!account) return null;

  const { data: threads } = await supabase
    .from("email_threads")
    .select("gmail_thread_id, subject, last_message_at")
    .eq("project_id", projectId)
    .order("last_message_at", { ascending: false })
    .limit(MAX_EMAIL_THREADS);
  if (!threads || threads.length === 0) return null;

  let token: string;
  try {
    token = await getAccessToken(supabase, account);
  } catch {
    return null;
  }

  const sections: string[] = [];
  for (const t of threads) {
    try {
      const messages = await getThread(token, t.gmail_thread_id);
      if (messages.length === 0) continue;
      const recent = messages.slice(-MAX_MSGS_PER_THREAD);
      const body = recent
        .map((m) => {
          const gist = condenseEmailBody(m.bodyText || "");
          return `  - ${m.from || "unknown"} (${m.date || ""}): ${gist || "(no text)"}`;
        })
        .join("\n");
      sections.push(`Thread "${t.subject || "(no subject)"}":\n${body}`);
    } catch {
      // Skip a thread that fails to load; keep the rest.
    }
  }
  // Threads are linked but none could be fetched (token/API issue): say so, so
  // the summary reflects that comms exist but couldn't be read (vs. silently
  // dropping them).
  if (sections.length === 0) {
    return `Email communication: ${threads.length} linked Gmail thread(s) exist but could not be read right now (the Google connection may need reauthorizing in Settings).`;
  }

  return `Email communication (linked Gmail threads, newest first; quoted reply history trimmed):\n${sections.join("\n\n")}`;
}

// --- Slack communication (linked channels, fetched live) ---------------------
async function gatherProjectSlackContext(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<string | null> {
  const { data: account } = await supabase
    .from("email_accounts")
    .select("access_token")
    .eq("provider", "slack")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!account?.access_token) return null;

  const { data: channels } = await supabase
    .from("slack_channels")
    .select("slack_channel_id, channel_name")
    .eq("project_id", projectId)
    .limit(MAX_CHANNELS);
  if (!channels || channels.length === 0) return null;

  const sections: string[] = [];
  for (const c of channels) {
    try {
      const messages = await getConversationHistory(
        account.access_token,
        c.slack_channel_id,
        MAX_CHANNEL_MSGS
      );
      const body = messages
        .filter((m) => m.text.trim())
        .map((m) => {
          const when = m.ts ? shortDate(new Date(Number(m.ts) * 1000).toISOString()) : "";
          return `  - ${m.author} (${when}): ${condenseText(m.text)}`;
        })
        .join("\n");
      if (body) sections.push(`Channel #${c.channel_name || "channel"}:\n${body}`);
    } catch {
      // Skip a channel that fails to load; keep the rest.
    }
  }
  if (sections.length === 0) return null;
  return `Slack communication (linked channels):\n${sections.join("\n\n")}`;
}

// --- Google Chat communication (linked spaces, fetched live) -----------------
async function gatherProjectChatContext(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<string | null> {
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry, email, scope")
    .eq("provider", "google")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!account) return null;

  const { data: spaces } = await supabase
    .from("chat_spaces")
    .select("space_name, space_display_name")
    .eq("project_id", projectId)
    .limit(MAX_CHANNELS);
  if (!spaces || spaces.length === 0) return null;

  let token: string;
  try {
    token = await getAccessToken(supabase, account);
  } catch {
    return null;
  }

  const sections: string[] = [];
  for (const s of spaces) {
    try {
      const messages = await listSpaceMessages(token, s.space_name, MAX_CHANNEL_MSGS);
      const body = messages
        .filter((m) => m.text.trim())
        .map((m) => {
          const when = m.createTime ? shortDate(m.createTime) : "";
          return `  - ${m.author} (${when}): ${condenseText(m.text)}`;
        })
        .join("\n");
      if (body) sections.push(`Space "${s.space_display_name || s.space_name}":\n${body}`);
    } catch {
      // Skip a space that fails to load; keep the rest.
    }
  }
  if (sections.length === 0) return null;
  return `Google Chat communication (linked spaces):\n${sections.join("\n\n")}`;
}

// All linked communication (email + Slack + Google Chat) as one context block,
// so the summary and client update reflect what was actually discussed across
// every channel, not just email. Best-effort per channel.
export async function gatherProjectCommsContext(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<string | null> {
  const [email, slack, chat] = await Promise.all([
    gatherProjectEmailContext(supabase, projectId),
    gatherProjectSlackContext(supabase, projectId),
    gatherProjectChatContext(supabase, projectId),
  ]);
  const parts = [email, slack, chat].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join("\n\n") : null;
}
