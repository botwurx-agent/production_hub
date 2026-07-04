import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ContactList } from "@/components/contacts/contact-list";
import { AddContactForm } from "@/components/contacts/add-contact-form";
import { LeadStageMenu } from "@/components/leads/lead-stage-menu";
import { ConvertButton } from "@/components/leads/convert-button";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { addLeadContact } from "@/app/(app)/leads/actions";
import { EmailPanel } from "@/components/projects/project-email";
import { SlackPanel } from "@/components/communication/slack-panel";
import { ChatPanel } from "@/components/communication/gchat-panel";
import { chatConnected, chatCanSend } from "@/lib/googlechat";
import { OutreachDraft } from "@/components/leads/outreach-draft";
import { LeadNotesEditor } from "@/components/leads/lead-notes-editor";
import { aiConfigured } from "@/lib/ai";
import type { UpdateDestination } from "@/components/projects/client-update";
import type { Contact } from "@/lib/database.types";

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, company, source, stage, notes, converted_client_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!lead) notFound();

  const [
    { data: contacts },
    { data: emailThreads },
    { data: emailAccount },
    { data: slackChannels },
    { data: slackAccount },
    { data: chatSpaces },
  ] = await Promise.all([
    supabase.from("contacts").select("*").eq("lead_id", params.id).order("created_at"),
    supabase
      .from("email_threads")
      .select("id, gmail_thread_id, subject, last_message_at")
      .eq("lead_id", params.id)
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
      .eq("lead_id", params.id)
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
      .eq("lead_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  const revalidate = `/leads/${params.id}`;
  const primaryEmail = (contacts ?? []).find((c) => c.email)?.email ?? "";

  // Channels linked to this lead that outreach can be sent through.
  const emailCanSend = Boolean(emailAccount?.scope?.includes("gmail.send"));
  const slackCanSend = Boolean(slackAccount?.scope?.includes("chat:write"));
  const outreachDestinations: UpdateDestination[] = [
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
      <Link
        href="/leads"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
      >
        <ChevronLeftIcon /> Leads
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-text">
              {lead.company}
            </h1>
            <LeadStageMenu leadId={lead.id} stage={lead.stage} />
          </div>
          {lead.source && (
            <p className="mt-2 text-sm text-text-muted">
              Source: {lead.source}
            </p>
          )}
        </div>
        {lead.converted_client_id ? (
          <Link
            href={`/clients/${lead.converted_client_id}`}
            className="text-sm font-semibold text-accent hover:underline"
          >
            View client &rarr;
          </Link>
        ) : (
          <ConvertButton leadId={lead.id} size="md" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-display text-base font-bold">Notes</h2>
          <LeadNotesEditor leadId={lead.id} initialContent={lead.notes ?? ""} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Contacts</h2>
          <div className="mb-4">
            <ContactList
              contacts={(contacts ?? []) as Contact[]}
              revalidate={revalidate}
            />
          </div>
          <AddContactForm action={addLeadContact.bind(null, lead.id)} />
        </Card>

        {/* AI outreach draft */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="font-display text-base font-bold">Outreach</h2>
            <span
              className="inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-bold"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              AI
            </span>
          </div>
          <OutreachDraft
            leadId={lead.id}
            connected={aiConfigured()}
            destinations={outreachDestinations}
          />
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-display text-base font-bold">Email</h2>
          <EmailPanel
            ownerType="lead"
            ownerId={lead.id}
            connected={Boolean(emailAccount)}
            canSend={Boolean(emailAccount?.scope?.includes("gmail.send"))}
            defaultQuery={primaryEmail || lead.company}
            threads={emailThreads ?? []}
          />
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-display text-base font-bold">Slack</h2>
          <SlackPanel
            ownerType="lead"
            ownerId={lead.id}
            connected={Boolean(slackAccount)}
            canSend={Boolean(slackAccount?.scope?.includes("chat:write"))}
            channels={slackChannels ?? []}
          />
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-display text-base font-bold">Google Chat</h2>
          <ChatPanel
            ownerType="lead"
            ownerId={lead.id}
            connected={Boolean(emailAccount) && chatConnected(emailAccount?.scope)}
            canSend={chatCanSend(emailAccount?.scope)}
            spaces={chatSpaces ?? []}
          />
        </Card>
      </div>
    </div>
  );
}
