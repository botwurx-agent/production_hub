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
import { RelationshipFeed } from "@/components/crm/relationship-feed";
import { TaskList } from "@/components/crm/task-list";
import { loadAccountFeed } from "@/lib/crm-feed";
import { PROJECT_STATUS, ACCOUNT_STATUS, DEAL_STAGE } from "@/lib/status";
import { shortDate, money, timeAgo } from "@/lib/format";
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
    .select("id, name, type, notes, account_status")
    .eq("id", params.id)
    .maybeSingle();
  if (!client) notFound();

  const [
    { data: contacts },
    { data: projects },
    { data: deals },
    feed,
    { data: tasks },
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
      .from("deals")
      .select("id, title, value, stage")
      .eq("account_id", params.id)
      .order("created_at", { ascending: false }),
    loadAccountFeed(supabase, params.id),
    supabase
      .from("crm_tasks")
      .select("id, title, due_date, done")
      .eq("account_id", params.id)
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
            <StatusTag hue={ACCOUNT_STATUS[client.account_status].hue}>
              {ACCOUNT_STATUS[client.account_status].label}
            </StatusTag>
            <StatusTag hue={client.type === "agency" ? "purple" : "blue"}>
              {client.type === "agency" ? "Agency" : "Brand"}
            </StatusTag>
          </div>
          {client.notes && (
            <p className="mt-2 max-w-2xl text-sm text-text-muted">
              {client.notes}
            </p>
          )}
          {feed.lastContactAt && (
            <p className="mt-2 text-xs font-medium text-text-faint">
              Last contact {timeAgo(feed.lastContactAt)}
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

        {/* Deals */}
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Deals</h2>
          {(deals ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-text-faint">
              No deals yet.{" "}
              <Link
                href="/pipeline"
                className="font-semibold text-accent hover:underline"
              >
                Add one
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {(deals ?? []).map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/pipeline/${d.id}`}
                    className="flex items-center justify-between gap-3 rounded-[11px] border border-border px-3 py-2.5 transition hover:border-border-strong hover:bg-surface-2/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-text">
                        {d.title}
                      </span>
                      {d.value != null && (
                        <span className="text-xs text-text-faint">
                          {money(d.value)}
                        </span>
                      )}
                    </span>
                    <StatusTag hue={DEAL_STAGE[d.stage].hue}>
                      {DEAL_STAGE[d.stage].label}
                    </StatusTag>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Tasks */}
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-bold">Tasks</h2>
          <TaskList accountId={client.id} tasks={tasks ?? []} />
        </Card>

        {/* Activity */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold">Activity</h2>
            {feed.lastContactAt && (
              <span className="text-xs text-text-faint">
                Last contact {timeAgo(feed.lastContactAt)}
              </span>
            )}
          </div>
          <RelationshipFeed accountId={client.id} entries={feed.entries} />
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
