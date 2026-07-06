import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { EmailPanel } from "@/components/projects/project-email";
import { SlackPanel } from "@/components/communication/slack-panel";
import { ChatPanel } from "@/components/communication/gchat-panel";
import {
  ClientUpdate,
  type UpdateDestination,
} from "@/components/projects/client-update";
import { aiConfigured } from "@/lib/ai";
import { chatConnected, chatCanSend } from "@/lib/googlechat";

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
      .select("id, gmail_thread_id, subject, last_message_at")
      .eq("project_id", params.id)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("email_accounts")
      .select("id, scope")
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

  // Channels a client update can be sent through: linked to the project and the
  // provider connected with send access.
  const emailCanSend = Boolean(emailAccount?.scope?.includes("gmail.send"));
  const slackCanSend = Boolean(slackAccount?.scope?.includes("chat:write"));
  const updateDestinations: UpdateDestination[] = [
    ...(emailCanSend
      ? (emailThreads ?? []).map((t) => ({
          kind: "email" as const,
          id: `email:${t.id}`,
          label: `Email: ${t.subject || "thread"}`,
          gmailThreadId: t.gmail_thread_id,
        }))
      : []),
    ...(slackCanSend
      ? (slackChannels ?? []).map((c) => ({
          kind: "slack" as const,
          id: `slack:${c.id}`,
          label: `Slack: #${c.channel_name || "channel"}`,
          channelId: c.slack_channel_id,
        }))
      : []),
    ...(chatCanSend(emailAccount?.scope)
      ? (chatSpaces ?? []).map((s) => ({
          kind: "chat" as const,
          id: `chat:${s.id}`,
          label: `Chat: ${s.space_display_name || "space"}`,
          spaceName: s.space_name,
        }))
      : []),
  ];

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Communication"
        hue="cyan"
      />

      <Card className="mb-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="font-display text-base font-bold">Client update</h2>
          <span
            className="inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
          >
            AI
          </span>
        </div>
        <ClientUpdate
          projectId={project.id}
          connected={aiConfigured()}
          destinations={updateDestinations}
        />
      </Card>

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
            threads={emailThreads ?? []}
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
