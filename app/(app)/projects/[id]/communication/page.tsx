import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { EmailPanel } from "@/components/projects/project-email";
import { SlackPanel } from "@/components/communication/slack-panel";
import { ChatPanel } from "@/components/communication/gchat-panel";
// NOTE: the AI "Client update" card is archived for now (removed from this page,
// component + draftClientUpdate action left intact so it can be brought back).
import { chatConnected, chatCanSend } from "@/lib/googlechat";
import { getAccessToken, getThreadPreview, type ThreadPreview } from "@/lib/gmail";

export default async function CommunicationPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client:clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const [
    { data: emailThreads },
    { data: emailAccount },
    { data: slackChannels },
    { data: slackAccount },
    { data: chatSpaces },
  ] = await Promise.all([
    supabase
      .from("email_threads")
      .select("id, gmail_thread_id, subject, last_message_at, last_read_at")
      .eq("project_id", params.id)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("email_accounts")
      .select("id, scope, access_token, refresh_token, token_expiry")
      .eq("provider", "google")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("slack_channels")
      .select("id, slack_channel_id, channel_name")
      .eq("project_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("email_accounts")
      .select("id, scope")
      .eq("provider", "slack")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("chat_spaces")
      .select("id, space_name, space_display_name")
      .eq("project_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  const clientName = (project.client as { name: string } | null)?.name ?? null;

  // Fetch a lightweight preview (latest sender + snippet + unread count) for each
  // linked email thread, so the Communication page shows a Gmail-like preview and
  // a per-conversation unread badge. Best-effort and capped so a large project
  // does not fan out into hundreds of Gmail calls; the rest fall back to no
  // preview (still readable on click).
  const threadList = emailThreads ?? [];
  const previews = new Map<string, ThreadPreview>();
  if (emailAccount && threadList.length > 0) {
    try {
      const token = await getAccessToken(supabase, emailAccount);
      const capped = threadList.slice(0, 15);
      const results = await Promise.all(
        capped.map(async (t) => {
          const sinceMs = t.last_read_at
            ? new Date(t.last_read_at).getTime()
            : 0;
          try {
            const p = await getThreadPreview(token, t.gmail_thread_id, sinceMs);
            return [t.id, p] as const;
          } catch {
            return [t.id, null] as const;
          }
        })
      );
      for (const [id, p] of results) if (p) previews.set(id, p);
    } catch {
      // Gmail unavailable (token expired, revoked): skip previews entirely.
    }
  }
  const emailThreadsWithPreview = threadList.map((t) => ({
    ...t,
    preview: previews.get(t.id) ?? null,
  }));

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Communication"
        hue="cyan"
        subtitle="Every conversation for this job, in one place."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        }
      />

      <div className="grid grid-cols-1 gap-6">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Email</h2>
          <EmailPanel
            ownerType="project"
            ownerId={project.id}
            projectId={project.id}
            connected={Boolean(emailAccount)}
            canSend={Boolean(emailAccount?.scope?.includes("gmail.send"))}
            defaultQuery={clientName ?? ""}
            threads={emailThreadsWithPreview}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Slack</h2>
          <SlackPanel
            ownerType="project"
            ownerId={project.id}
            projectId={project.id}
            connected={Boolean(slackAccount)}
            canSend={Boolean(slackAccount?.scope?.includes("chat:write"))}
            channels={slackChannels ?? []}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Google Chat</h2>
          <ChatPanel
            ownerType="project"
            ownerId={project.id}
            connected={Boolean(emailAccount) && chatConnected(emailAccount?.scope)}
            canSend={chatCanSend(emailAccount?.scope)}
            spaces={chatSpaces ?? []}
          />
        </Card>
      </div>
    </div>
  );
}
