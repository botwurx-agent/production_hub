import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { StatusMenu } from "@/components/projects/status-menu";
import { BriefEditor } from "@/components/projects/brief-editor";
import { AssetCard } from "@/components/projects/asset-card";
import { AddAssetButton } from "@/components/projects/add-asset-button";
import { EmailPanel } from "@/components/projects/project-email";
import { SlackPanel } from "@/components/communication/slack-panel";
import { ChatPanel } from "@/components/communication/gchat-panel";
import { chatConnected, chatCanSend } from "@/lib/googlechat";
import { ProjectSummary } from "@/components/projects/project-summary";
import { aiConfigured } from "@/lib/ai";
import {
  ActivityPanel,
  type ActivityItem,
} from "@/components/projects/activity-panel";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { longDate } from "@/lib/format";
import type {
  AssetWithVersions,
  VersionComment,
  VersionApproval,
} from "@/components/projects/asset-types";

const SIGNED_URL_TTL = 60 * 60; // 1 hour

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, status, due_date, shoot_date, client:clients(name)")
    .eq("id", params.id)
    .maybeSingle();

  if (!project) notFound();

  const [
    { data: brief },
    { data: assetsRaw },
    { data: activityRaw },
    { data: emailThreads },
    { data: emailAccount },
    { data: slackChannels },
    { data: slackAccount },
    { data: chatSpaces },
    { data: summary },
  ] = await Promise.all([
      supabase
        .from("briefs")
        .select("content")
        .eq("project_id", params.id)
        .maybeSingle(),
      supabase
        .from("assets")
        .select(
          "id, name, type, status, current_version_id, versions:versions!versions_asset_id_fkey(id, version_number, storage_path, url, mime_type, size_bytes, notes, created_at)"
        )
        .eq("project_id", params.id)
        .order("created_at", { ascending: true })
        .order("version_number", {
          referencedTable: "versions",
          ascending: false,
        }),
      supabase
        .from("activity")
        .select("id, content, type, created_at, author_id")
        .eq("project_id", params.id)
        .order("created_at", { ascending: false })
        .limit(100),
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
      supabase
        .from("project_summaries")
        .select("content, created_at")
        .eq("project_id", params.id)
        .maybeSingle(),
    ]);

  // Batch-sign all stored files so private previews and downloads work.
  const paths = (assetsRaw ?? [])
    .flatMap((a) => a.versions ?? [])
    .map((v) => v.storage_path)
    .filter((p): p is string => Boolean(p));

  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signedList } = await supabase.storage
      .from("assets")
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of signedList ?? []) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }

  // Review data (comments + internal sign-offs) for every version.
  const versionIds = (assetsRaw ?? []).flatMap((a) =>
    (a.versions ?? []).map((v) => v.id)
  );
  const commentsByVersion = new Map<string, VersionComment[]>();
  const approvalsByVersion = new Map<string, VersionApproval[]>();
  if (versionIds.length > 0) {
    const [{ data: comments }, { data: approvals }] = await Promise.all([
      supabase
        .from("review_comments")
        .select("id, body, created_at, author_id, version_id")
        .in("version_id", versionIds),
      supabase
        .from("approvals")
        .select("id, status, reviewer_user_id, created_at, target_id")
        .eq("target_type", "version")
        .in("target_id", versionIds),
    ]);
    for (const c of comments ?? []) {
      const list = commentsByVersion.get(c.version_id) ?? [];
      list.push(c);
      commentsByVersion.set(c.version_id, list);
    }
    for (const a of approvals ?? []) {
      const list = approvalsByVersion.get(a.target_id) ?? [];
      list.push(a);
      approvalsByVersion.set(a.target_id, list);
    }
  }

  const assets: AssetWithVersions[] = (assetsRaw ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    status: a.status,
    current_version_id: a.current_version_id,
    versions: (a.versions ?? []).map((v) => ({
      ...v,
      signedUrl: v.storage_path ? (signed.get(v.storage_path) ?? null) : null,
      comments: commentsByVersion.get(v.id) ?? [],
      approvals: approvalsByVersion.get(v.id) ?? [],
    })),
  }));

  const activity = (activityRaw ?? []) as ActivityItem[];
  const clientName = (project.client as { name: string } | null)?.name ?? null;
  const dateBits = [
    project.shoot_date ? `Shoot ${longDate(project.shoot_date)}` : null,
    project.due_date ? `Due ${longDate(project.due_date)}` : null,
  ].filter(Boolean);

  return (
    <div>
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
      >
        <ChevronLeftIcon /> Projects
      </Link>

      {/* Project header: title is the hero, meta sits quieter beneath. */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-text">
            {project.title}
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            {clientName ?? "No client"}
            {dateBits.length > 0 && (
              <span className="text-text-faint">
                {"  ·  "}
                {dateBits.join("  ·  ")}
              </span>
            )}
          </p>
        </div>
        <StatusMenu projectId={project.id} status={project.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* AI project summary */}
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="font-display text-base font-bold">
                Project summary
              </h2>
              <span
                className="inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
              >
                AI
              </span>
            </div>
            <ProjectSummary
              projectId={project.id}
              connected={aiConfigured()}
              initialContent={summary?.content ?? null}
              initialAt={summary?.created_at ?? null}
            />
          </Card>

          {/* Brief */}
          <Card className="p-5">
            <h2 className="mb-3 font-display text-base font-bold">Brief</h2>
            <BriefEditor
              projectId={project.id}
              initialContent={brief?.content ?? ""}
            />
          </Card>

          {/* Assets */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-bold">Assets</h2>
              <AddAssetButton projectId={project.id} studioId={ctx.studio.id} />
            </div>
            {assets.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-border py-10 text-center text-sm text-text-faint">
                No assets yet. Add your first deliverable and its versions.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {assets.map((a) => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    projectId={project.id}
                    studioId={ctx.studio.id}
                    currentUserId={ctx.userId}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Email / communication */}
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

          {/* Slack */}
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

          {/* Google Chat */}
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

        {/* Activity */}
        <div className="lg:col-span-1">
          <Card className="p-5">
            <h2 className="mb-4 font-display text-base font-bold">
              Activity &amp; notes
            </h2>
            <ActivityPanel
              projectId={project.id}
              items={activity}
              currentUserId={ctx.userId}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
