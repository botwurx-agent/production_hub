import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { StatusTag } from "@/components/status-tag";
import { ContactList } from "@/components/contacts/contact-list";
import { AddContactForm } from "@/components/contacts/add-contact-form";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { addClientContact } from "@/app/(app)/clients/actions";
import { EmailPanel } from "@/components/projects/project-email";
import { SlackPanel } from "@/components/communication/slack-panel";
import { ChatPanel } from "@/components/communication/gchat-panel";
import { chatConnected, chatCanSend } from "@/lib/googlechat";
import { PROJECT_STATUS } from "@/lib/status";
import { shortDate } from "@/lib/format";
import type { Contact } from "@/lib/database.types";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, type, notes")
    .eq("id", params.id)
    .maybeSingle();
  if (!client) notFound();

  const [
    { data: contacts },
    { data: projects },
    { data: emailThreads },
    { data: emailAccount },
    { data: slackChannels },
    { data: slackAccount },
    { data: chatSpaces },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .eq("client_id", params.id)
      .order("created_at"),
    supabase
      .from("projects")
      .select("id, title, status, shoot_date, due_date")
      .eq("client_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("email_threads")
      .select("id, gmail_thread_id, subject, last_message_at")
      .eq("client_id", params.id)
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
      .eq("client_id", params.id)
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
      .eq("client_id", params.id)
      .order("created_at", { ascending: false }),
  ]);

  const revalidate = `/clients/${params.id}`;
  const primaryEmail = (contacts ?? []).find((c) => c.email)?.email ?? "";

  return (
    <div>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
      >
        <ChevronLeftIcon /> Clients
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-text">
              {client.name}
            </h1>
            <StatusTag hue={client.type === "agency" ? "purple" : "blue"}>
              {client.type === "agency" ? "Agency" : "Brand"}
            </StatusTag>
          </div>
          {client.notes && (
            <p className="mt-2 max-w-2xl text-sm text-text-muted">
              {client.notes}
            </p>
          )}
        </div>
        <NewProjectButton
          clients={[{ id: client.id, name: client.name }]}
          defaultClientId={client.id}
          label="Start a project"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contacts */}
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Contacts</h2>
          <div className="mb-4">
            <ContactList
              contacts={(contacts ?? []) as Contact[]}
              revalidate={revalidate}
            />
          </div>
          <AddContactForm action={addClientContact.bind(null, client.id)} />
        </Card>

        {/* Projects */}
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Projects</h2>
          {(projects ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-text-faint">
              No projects yet for this client.
            </p>
          ) : (
            <ul className="space-y-2">
              {(projects ?? []).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex items-center justify-between gap-3 rounded-[11px] border border-border px-3 py-2.5 transition hover:border-border-strong hover:bg-surface-2/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-text">
                        {p.title}
                      </span>
                      <span className="text-xs text-text-faint">
                        {p.shoot_date
                          ? `Shoot ${shortDate(p.shoot_date)}`
                          : p.due_date
                            ? `Due ${shortDate(p.due_date)}`
                            : "No dates set"}
                      </span>
                    </span>
                    <StatusTag hue={PROJECT_STATUS[p.status].hue}>
                      {PROJECT_STATUS[p.status].label}
                    </StatusTag>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Email */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-display text-base font-bold">Email</h2>
          <EmailPanel
            ownerType="client"
            ownerId={client.id}
            connected={Boolean(emailAccount)}
            canSend={Boolean(emailAccount?.scope?.includes("gmail.send"))}
            defaultQuery={primaryEmail || client.name}
            threads={emailThreads ?? []}
          />
        </Card>

        {/* Slack */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-display text-base font-bold">Slack</h2>
          <SlackPanel
            ownerType="client"
            ownerId={client.id}
            connected={Boolean(slackAccount)}
            canSend={Boolean(slackAccount?.scope?.includes("chat:write"))}
            channels={slackChannels ?? []}
          />
        </Card>

        {/* Google Chat */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-display text-base font-bold">Google Chat</h2>
          <ChatPanel
            ownerType="client"
            ownerId={client.id}
            connected={Boolean(emailAccount) && chatConnected(emailAccount?.scope)}
            canSend={chatCanSend(emailAccount?.scope)}
            spaces={chatSpaces ?? []}
          />
        </Card>
      </div>
    </div>
  );
}
