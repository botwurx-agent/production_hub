import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { StatusTag } from "@/components/status-tag";
import { CommunicationIcon } from "@/components/app-shell/nav-icons";
import {
  ThreadReader,
  type LinkedThread,
} from "@/components/projects/project-email";
import {
  SlackReader,
  type LinkedSlackChannel,
} from "@/components/communication/slack-panel";
import {
  ChatReader,
  type LinkedChatSpace,
} from "@/components/communication/gchat-panel";
import { chatCanSend } from "@/lib/googlechat";
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

const CHANNELS: { key: string; label: string; live: boolean; hue: Hue }[] = [
  { key: "email", label: "Email", live: true, hue: "blue" },
  { key: "slack", label: "Slack", live: true, hue: "purple" },
  { key: "gchat", label: "Google Chat", live: true, hue: "cyan" },
];

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
          "id, gmail_thread_id, subject, last_message_at, project:projects(id, title), lead:leads(id, company), client:clients(id, name)"
        )
        .order("last_message_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("slack_channels")
        .select(
          "id, slack_channel_id, channel_name, project:projects(id, title), lead:leads(id, company), client:clients(id, name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("chat_spaces")
        .select(
          "id, space_name, space_display_name, project:projects(id, title), lead:leads(id, company), client:clients(id, name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("email_accounts")
        .select("id, scope")
        .eq("provider", "google")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("email_accounts")
        .select("id, scope")
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

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {CHANNELS.map((c) => (
          <span
            key={c.key}
            className="inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold"
            style={
              c.live
                ? {
                    backgroundColor: `var(--h-${c.hue}-bg)`,
                    color: `var(--h-${c.hue})`,
                    borderColor: "transparent",
                  }
                : undefined
            }
          >
            <span className={c.live ? "" : "flex items-center gap-1.5 text-text-faint"}>
              {!c.live && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "var(--border-strong)" }}
                />
              )}
              {c.label}
              {!c.live && <span className="text-text-faint"> · soon</span>}
            </span>
          </span>
        ))}
      </div>

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
        <div className="space-y-8">
          {[...groups.values()].map((g) => (
            <section key={g.key}>
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="h-6 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--h-${g.hue})` }}
                />
                <Link
                  href={g.href}
                  className="font-display text-lg font-extrabold tracking-tight text-text transition hover:text-accent"
                >
                  {g.label}
                </Link>
                <StatusTag hue={g.hue} dot={false}>
                  {g.kind}
                </StatusTag>
                <span className="text-xs font-medium text-text-faint">
                  {g.email.length + g.slack.length + g.chat.length}{" "}
                  {g.email.length + g.slack.length + g.chat.length === 1
                    ? "conversation"
                    : "conversations"}
                </span>
              </div>
              <div className="space-y-2">
                {g.email.map((t) => (
                  <ThreadReader
                    key={t.id}
                    thread={t}
                    canSend={canSend}
                    projectId={g.projectId}
                    revalidate="/communication"
                  />
                ))}
                {g.slack.map((c) => (
                  <SlackReader
                    key={c.id}
                    channel={c}
                    projectId={g.projectId}
                    canSend={slackCanSend}
                    revalidate="/communication"
                  />
                ))}
                {g.chat.map((s) => (
                  <ChatReader
                    key={s.id}
                    space={s}
                    canSend={chatCanSendMsg}
                    revalidate="/communication"
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
