import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { StatusTag } from "@/components/status-tag";
import { CommunicationIcon } from "@/components/app-shell/nav-icons";
import { ThreadRow, type LinkedThread } from "@/components/projects/project-email";

type Row = LinkedThread & { project: { id: string; title: string } | null };

// Channels the hub unifies. Email is live; others are on the connector roadmap.
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
      .select("id, gmail_thread_id, subject, last_message_at, project:projects(id, title)")
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase.from("email_accounts").select("id, scope").limit(1).maybeSingle(),
  ]);

  const rows = (threadsRaw ?? []) as unknown as Row[];
  const canSend = Boolean(account?.scope?.includes("gmail.send"));

  // Group linked threads by project for a scannable inbox.
  const groups = new Map<string, { title: string; threads: Row[] }>();
  for (const r of rows) {
    if (!r.project) continue;
    const g = groups.get(r.project.id) ?? { title: r.project.title, threads: [] };
    g.threads.push(r);
    groups.set(r.project.id, g);
  }

  return (
    <div>
      <PageHeader
        title="Communication"
        subtitle="Every conversation for every job, in one place."
      />

      {/* Channel legend / roadmap */}
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
          description="Connect Gmail in Settings to bring your project email into one inbox. Slack and Google Chat are coming next."
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
          description="Open a project, link a Gmail thread in its Email section, and it will show up here across all your jobs."
        />
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([projectId, g]) => (
            <section key={projectId}>
              <div className="mb-3 flex items-center gap-2">
                <Link
                  href={`/projects/${projectId}`}
                  className="font-display text-sm font-bold text-text hover:text-accent"
                >
                  {g.title}
                </Link>
                <StatusTag hue="blue" dot={false}>
                  Email
                </StatusTag>
                <span className="text-xs text-text-faint">
                  {g.threads.length} thread{g.threads.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-2">
                {g.threads.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    projectId={projectId}
                    canSend={canSend}
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
