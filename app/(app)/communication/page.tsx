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
import type { Hue } from "@/components/status-tag";

type Row = LinkedThread & {
  project_id: string | null;
  lead_id: string | null;
  client_id: string | null;
  project: { id: string; title: string } | null;
  lead: { id: string; company: string } | null;
  client: { id: string; name: string } | null;
};

type Group = {
  key: string;
  label: string;
  href: string;
  kind: "Project" | "Lead" | "Client";
  hue: Hue;
  projectId?: string;
  threads: Row[];
};

const CHANNELS: { key: string; label: string; live: boolean }[] = [
  { key: "email", label: "Email", live: true },
  { key: "slack", label: "Slack", live: false },
  { key: "gchat", label: "Google Chat", live: false },
];

export default async function CommunicationPage() {
  await requireStudioContext();
  const supabase = createClient();

  const [{ data: threadsRaw }, { data: account }] = await Promise.all([
    supabase
      .from("email_threads")
      .select(
        "id, gmail_thread_id, subject, last_message_at, project_id, lead_id, client_id, project:projects(id, title), lead:leads(id, company), client:clients(id, name)"
      )
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase.from("email_accounts").select("id, scope").limit(1).maybeSingle(),
  ]);

  const rows = (threadsRaw ?? []) as unknown as Row[];
  const canSend = Boolean(account?.scope?.includes("gmail.send"));

  // Group by owner (project / lead / client).
  const groups = new Map<string, Group>();
  for (const r of rows) {
    let g: Group | undefined;
    if (r.project) {
      const key = `project:${r.project.id}`;
      g = groups.get(key) ?? {
        key,
        label: r.project.title,
        href: `/projects/${r.project.id}`,
        kind: "Project",
        hue: "indigo",
        projectId: r.project.id,
        threads: [],
      };
    } else if (r.lead) {
      const key = `lead:${r.lead.id}`;
      g = groups.get(key) ?? {
        key,
        label: r.lead.company,
        href: `/leads/${r.lead.id}`,
        kind: "Lead",
        hue: "yellow",
        threads: [],
      };
    } else if (r.client) {
      const key = `client:${r.client.id}`;
      g = groups.get(key) ?? {
        key,
        label: r.client.name,
        href: `/clients/${r.client.id}`,
        kind: "Client",
        hue: "blue",
        threads: [],
      };
    }
    if (!g) continue;
    g.threads.push(r);
    groups.set(g.key, g);
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

      {!account ? (
        <EmptyState
          icon={<CommunicationIcon className="h-7 w-7" />}
          title="Connect a channel to get started"
          description="Connect Gmail in Settings to bring email into one inbox. Slack and Google Chat are coming next."
          action={
            <Link
              href="/settings"
              className="rounded-[11px] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:bg-accent-strong"
            >
              Go to Settings
            </Link>
          }
        />
      ) : groups.size === 0 ? (
        <EmptyState
          icon={<CommunicationIcon className="h-7 w-7" />}
          title="No conversations linked yet"
          description="Link a Gmail thread from a lead, client, or project and it will show up here."
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
                <span className="text-xs text-text-faint">
                  {g.threads.length} thread{g.threads.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-2">
                {g.threads.map((t) => (
                  <ThreadReader
                    key={t.id}
                    thread={t}
                    canSend={canSend}
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
