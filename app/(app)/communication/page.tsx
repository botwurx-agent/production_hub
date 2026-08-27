import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { CommunicationIcon } from "@/components/app-shell/nav-icons";
import type { LinkedThread } from "@/components/projects/project-email";
import type { LinkedSlackChannel } from "@/components/communication/slack-panel";
import type { LinkedChatSpace } from "@/components/communication/gchat-panel";
import {
  StudioComms,
  type StudioCommsGroup,
} from "@/components/communication/comms-groups";
import { chatCanSend, countNewIncoming as countNewChat } from "@/lib/googlechat";
import { getAccessToken, getThreadPreview } from "@/lib/gmail";
import { countNewIncoming as countNewSlack } from "@/lib/slack";
import type { Hue } from "@/components/status-tag";

type OwnerJoins = {
  project: { id: string; title: string } | null;
  lead: { id: string; company: string } | null;
  client: { id: string; name: string } | null;
};
type EmailRow = LinkedThread & OwnerJoins;
type SlackRow = LinkedSlackChannel & OwnerJoins;
type ChatRow = LinkedChatSpace & OwnerJoins;

type Group = {
  key: string;
  label: string;
  href: string;
  kind: "Project" | "Lead" | "Client";
  hue: Hue;
  projectId?: string;
  email: EmailRow[];
  slack: SlackRow[];
  chat: ChatRow[];
};

function classify(
  r: OwnerJoins
): Omit<Group, "email" | "slack" | "chat"> | null {
  if (r.project)
    return {
      key: `project:${r.project.id}`,
      label: r.project.title,
      href: `/projects/${r.project.id}`,
      kind: "Project",
      hue: "indigo",
      projectId: r.project.id,
    };
  if (r.lead)
    return {
      key: `lead:${r.lead.id}`,
      label: r.lead.company,
      href: `/leads/${r.lead.id}`,
      kind: "Lead",
      hue: "yellow",
    };
  if (r.client)
    return {
      key: `client:${r.client.id}`,
      label: r.client.name,
      href: `/clients/${r.client.id}`,
      kind: "Client",
      hue: "blue",
    };
  return null;
}

export default async function CommunicationPage() {
  await requireStudioContext();
  const supabase = createClient();

  const [
    { data: emailRaw },
    { data: slackRaw },
    { data: chatRaw },
    { data: googleAccount },
    { data: slackAccount },
  ] = await Promise.all([
      supabase
        .from("email_threads")
        .select(
          "id, gmail_thread_id, subject, last_message_at, last_read_at, project:projects(id, title), lead:leads(id, company), client:clients(id, name)"
        )
        .order("last_message_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("slack_channels")
        .select(
          "id, slack_channel_id, channel_name, last_read_at, project:projects(id, title), lead:leads(id, company), client:clients(id, name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("chat_spaces")
        .select(
          "id, space_name, space_display_name, last_read_at, project:projects(id, title), lead:leads(id, company), client:clients(id, name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("email_accounts")
        .select("id, scope, access_token, refresh_token, token_expiry, external_ref")
        .eq("provider", "google")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("email_accounts")
        .select("id, scope, access_token, external_ref")
        .eq("provider", "slack")
        .limit(1)
        .maybeSingle(),
    ]);

  const emails = (emailRaw ?? []) as unknown as EmailRow[];
  const slacks = (slackRaw ?? []) as unknown as SlackRow[];
  const chats = (chatRaw ?? []) as unknown as ChatRow[];
  const canSend = Boolean(googleAccount?.scope?.includes("gmail.send"));
  const slackCanSend = Boolean(slackAccount?.scope?.includes("chat:write"));
  const chatCanSendMsg = chatCanSend(googleAccount?.scope);
  const anyConnection =
    emails.length > 0 || slacks.length > 0 || chats.length > 0;

  // Per-conversation unread, so the same signal as the nav badge lands on the
  // exact row. Best-effort + capped so we never fan out into hundreds of API
  // calls; a provider that errors just contributes no badges.
  const slackUnread = new Map<string, number>();
  const chatUnread = new Map<string, number>();
  const gExternal = (googleAccount?.external_ref ?? null) as {
    user_id?: string;
  } | null;
  const sAcct = slackAccount as {
    access_token?: string | null;
    external_ref?: { slack_user_id?: string } | null;
  } | null;

  if (googleAccount?.access_token && (emails.length > 0 || chats.length > 0)) {
    try {
      const token = await getAccessToken(supabase, googleAccount);
      const emailPreview = new Map<
        string,
        Awaited<ReturnType<typeof getThreadPreview>>
      >();
      await Promise.all(
        (emailRaw ?? []).slice(0, 20).map(async (t) => {
          const sinceMs = t.last_read_at ? new Date(t.last_read_at).getTime() : 0;
          try {
            emailPreview.set(t.id, await getThreadPreview(token, t.gmail_thread_id, sinceMs));
          } catch {
            // skip this thread's preview
          }
        })
      );
      for (const t of emails) t.preview = emailPreview.get(t.id) ?? null;

      const myChat = gExternal?.user_id ? `users/${gExternal.user_id}` : "";
      await Promise.all(
        (chatRaw ?? []).slice(0, 40).map(async (s) => {
          const sinceMs = s.last_read_at ? new Date(s.last_read_at).getTime() : 0;
          try {
            chatUnread.set(s.id, await countNewChat(token, s.space_name, sinceMs, myChat));
          } catch {
            // skip
          }
        })
      );
    } catch {
      // Google unavailable: no email/chat badges.
    }
  }

  if (sAcct?.access_token && slacks.length > 0) {
    const myUserId = sAcct.external_ref?.slack_user_id ?? "";
    const token = sAcct.access_token;
    await Promise.all(
      (slackRaw ?? []).slice(0, 40).map(async (c) => {
        const since = c.last_read_at
          ? (new Date(c.last_read_at).getTime() / 1000).toFixed(6)
          : "";
        try {
          slackUnread.set(c.id, await countNewSlack(token, c.slack_channel_id, since, myUserId));
        } catch {
          // skip
        }
      })
    );
  }

  const groups = new Map<string, Group>();
  const ensure = (base: Omit<Group, "email" | "slack" | "chat">): Group => {
    const g =
      groups.get(base.key) ?? { ...base, email: [], slack: [], chat: [] };
    groups.set(base.key, g);
    return g;
  };
  for (const r of emails) {
    const base = classify(r);
    if (base) ensure(base).email.push(r);
  }
  for (const r of slacks) {
    const base = classify(r);
    if (base) ensure(base).slack.push(r);
  }
  for (const r of chats) {
    const base = classify(r);
    if (base) ensure(base).chat.push(r);
  }

  return (
    <div>
      <PageHeader
        title="Communication"
        subtitle="Every conversation, from first contact to delivery, in one place."
        icon={<CommunicationIcon className="h-6 w-6" />}
        hue="blue"
      />

      {!anyConnection ? (
        <EmptyState
          icon={<CommunicationIcon className="h-7 w-7" />}
          title="No conversations linked yet"
          description="Link a Gmail thread, Slack channel, or Google Chat space from a lead, client, or project and it will show up here. Connect channels in Settings."
          action={
            <Link
              href="/settings"
              className="rounded-[11px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
            >
              Go to Settings
            </Link>
          }
        />
      ) : (
        <StudioComms
          groups={[...groups.values()].map(
            (g): StudioCommsGroup => ({
              key: g.key,
              label: g.label,
              href: g.href,
              kind: g.kind,
              hue: g.hue,
              projectId: g.projectId,
              // Stripped to the reader props: the owner joins are server-side
              // grouping detail, and the unread counts ride on their rows.
              email: g.email.map(({ project, lead, client, ...t }) => t),
              slack: g.slack.map(({ project, lead, client, ...c }) => ({
                ...c,
                unread: slackUnread.get(c.id) ?? 0,
              })),
              chat: g.chat.map(({ project, lead, client, ...c }) => ({
                ...c,
                unread: chatUnread.get(c.id) ?? 0,
              })),
            })
          )}
          canSend={canSend}
          slackCanSend={slackCanSend}
          chatCanSend={chatCanSendMsg}
        />
      )}
    </div>
  );
}
