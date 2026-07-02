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
import type { Hue } from "@/components/status-tag";

type OwnerJoins = {
  project: { id: string; title: string } | null;
  lead: { id: string; company: string } | null;
  client: { id: string; name: string } | null;
};
type EmailRow = LinkedThread & OwnerJoins;
type SlackRow = LinkedSlackChannel & OwnerJoins;

type Group = {
  key: string;
  label: string;
  href: string;
  kind: "Project" | "Lead" | "Client";
  hue: Hue;
  projectId?: string;
  email: EmailRow[];
  slack: SlackRow[];
};

const CHANNELS: { key: string; label: string; live: boolean }[] = [
  { key: "email", label: "Email", live: true },
  { key: "slack", label: "Slack", live: true },
  { key: "gchat", label: "Google Chat", live: false },
];

function classify(r: OwnerJoins): Omit<Group, "email" | "slack"> | null {
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

  const [{ data: emailRaw }, { data: slackRaw }, { data: googleAccount }] =
    await Promise.all([
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
        .from("email_accounts")
        .select("id, scope")
        .eq("provider", "google")
        .limit(1)
        .maybeSingle(),
    ]);

  const emails = (emailRaw ?? []) as unknown as EmailRow[];
  const slacks = (slackRaw ?? []) as unknown as SlackRow[];
  const canSend = Boolean(googleAccount?.scope?.includes("gmail.send"));
  const anyConnection = emails.length > 0 || slacks.length > 0;

  const groups = new Map<string, Group>();
  const ensure = (base: Omit<Group, "email" | "slack">): Group => {
    const g = groups.get(base.key) ?? { ...base, email: [], slack: [] };
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

  return (
    <div>
      <PageHeader
        title="Communication"
        subtitle="Every conversation, from first contact to delivery, in one place."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {CHANNELS.map((c) => (
          <span
            key={c.key}
            className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold ${
              c.live
                ? "border-border bg-surface text-text"
                : "border-dashed border-border text-text-faint"
            }`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: c.live ? "var(--h-green)" : "var(--border-strong)",
              }}
            />
            {c.label}
            {!c.live && <span className="text-text-faint">· soon</span>}
          </span>
        ))}
      </div>

      {!anyConnection ? (
        <EmptyState
          icon={<CommunicationIcon className="h-7 w-7" />}
          title="No conversations linked yet"
          description="Link a Gmail thread or Slack channel from a lead, client, or project and it will show up here. Connect channels in Settings."
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
              <div className="mb-3 flex items-center gap-2">
                <Link
                  href={g.href}
                  className="font-display text-sm font-bold text-text hover:text-accent"
                >
                  {g.label}
                </Link>
                <StatusTag hue={g.hue} dot={false}>
                  {g.kind}
                </StatusTag>
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
