import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { StatusMenu } from "@/components/projects/status-menu";
import { ArchiveProjectButton } from "@/components/projects/archive-project-button";
import { ProjectClientPicker } from "@/components/projects/project-client-picker";
import { HubCard, BandLabel } from "@/components/projects/hub-card";
import { ProjectSummary } from "@/components/projects/project-summary";
import { ProjectAttention } from "@/components/projects/project-attention";
import { getProjectOutstanding } from "@/lib/outstanding";
import { aiConfigured } from "@/lib/ai";
import { loadProjectAssets } from "@/lib/project-data";
import {
  ActivityPanel,
  type ActivityItem,
} from "@/components/projects/activity-panel";
import { StatusTag } from "@/components/status-tag";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { longDate } from "@/lib/format";
import {
  PROJECT_STATUS,
  PROJECT_STATUS_ORDER,
  ASSET_STATUS,
} from "@/lib/status";
import type { ProjectStatus } from "@/lib/database.types";

function daysUntil(date: string): number {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function money(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// Small presentational helpers, kept local to the hub.
function Kpi({
  label,
  value,
  unit,
  alert = false,
}: {
  label: string;
  value: string;
  unit?: string;
  alert?: boolean;
}) {
  return (
    <div
      className="rounded-[12px] border p-4 shadow-sm"
      style={
        alert
          ? { backgroundColor: "var(--h-yellow-bg)", borderColor: "transparent" }
          : { backgroundColor: "var(--surface)", borderColor: "var(--border)" }
      }
    >
      <div
        className="text-[11px] font-bold uppercase tracking-wide"
        style={{ color: alert ? "var(--h-yellow)" : "var(--text-faint)" }}
      >
        {label}
      </div>
      <div
        className="mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums"
        style={alert ? { color: "var(--h-yellow)" } : undefined}
      >
        {value}
        {unit && (
          <span className="ml-1 text-sm font-semibold text-text-muted">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, status, due_date, shoot_date, archived_at, client_id, client:clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: clientOptions } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");

  const [
    { data: brief },
    { data: activityRaw },
    { data: summary },
    { data: emailThreads },
    { data: slackChannels },
    { data: chatSpaces },
    { data: shotGroups },
    { data: callSheet },
    { data: budgetLines },
    { data: deliverables },
    { data: rosterContacts },
    { data: upcomingEvents },
  ] = await Promise.all([
    supabase.from("briefs").select("content").eq("project_id", params.id).maybeSingle(),
    supabase
      .from("activity")
      .select("id, content, type, created_at, author_id")
      .eq("project_id", params.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("project_summaries")
      .select("content, created_at")
      .eq("project_id", params.id)
      .maybeSingle(),
    supabase.from("email_threads").select("id").eq("project_id", params.id),
    supabase.from("slack_channels").select("id").eq("project_id", params.id),
    supabase.from("chat_spaces").select("id").eq("project_id", params.id),
    supabase.from("shot_groups").select("id").eq("project_id", params.id),
    supabase
      .from("call_sheets")
      .select("shoot_date, call_time, crew_call, location")
      .eq("project_id", params.id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("budget_lines")
      .select("estimated, actual")
      .eq("project_id", params.id),
    supabase.from("deliverables").select("status").eq("project_id", params.id),
    supabase.from("contacts").select("id").eq("project_id", params.id),
    supabase
      .from("project_events")
      .select("title, date")
      .eq("project_id", params.id)
      .order("date", { ascending: true }),
  ]);

  const [attention, { assets, reviewLinkByAsset }] = await Promise.all([
    getProjectOutstanding(params.id),
    loadProjectAssets(supabase, params.id),
  ]);

  // Shot count needs group ids.
  const groupIds = (shotGroups ?? []).map((g) => g.id);
  let shotCount = 0;
  if (groupIds.length > 0) {
    const { count } = await supabase
      .from("shot_cards")
      .select("id", { count: "exact", head: true })
      .in("group_id", groupIds);
    shotCount = count ?? 0;
  }

  const rosterCount = (rosterContacts ?? []).length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const eventCount = (upcomingEvents ?? []).length;
  const nextEvent = (upcomingEvents ?? []).find((e) => e.date >= todayStr) ?? null;

  const clientName = (project.client as { name: string } | null)?.name ?? null;
  const status = project.status as ProjectStatus;
  const statusInfo = PROJECT_STATUS[status];
  const currentOrder = statusInfo?.order ?? 0;

  // KPI derivations.
  const versionCount = assets.reduce((n, a) => n + a.versions.length, 0);
  const shootDays = project.shoot_date ? daysUntil(project.shoot_date) : null;
  const budgetEstimated = (budgetLines ?? []).reduce((n, b) => n + (b.estimated ?? 0), 0);
  const budgetActual = (budgetLines ?? []).reduce((n, b) => n + (b.actual ?? 0), 0);
  const budgetPct =
    budgetEstimated > 0 ? Math.round((budgetActual / budgetEstimated) * 100) : null;

  // Brief preview.
  const briefText = (brief?.content ?? "").trim();
  const briefSnippet = briefText.length > 150 ? `${briefText.slice(0, 150)}…` : briefText;

  // Assets preview (most recent 3, with the current version's status).
  const recentAssets = assets.slice(0, 3).map((a) => {
    const cur = a.versions[0];
    const st = ASSET_STATUS[a.status as keyof typeof ASSET_STATUS];
    return {
      id: a.id,
      name: a.name,
      hue: st?.hue ?? "cyan",
      label: st?.label ?? a.status,
      version: cur ? `v${cur.version_number}` : "",
    };
  });

  // Review derivations.
  let pendingCount = 0;
  let changesCount = 0;
  type ReviewAction = { name: string; text: string; hue: string; at: string };
  const reviewActions: ReviewAction[] = [];
  for (const a of assets) {
    for (const v of a.versions) {
      for (const ap of v.approvals) {
        if (ap.status === "changes_requested") changesCount++;
        else if (ap.status === "pending") pendingCount++;
        reviewActions.push({
          name: ap.reviewer_name ?? "Someone",
          text:
            ap.status === "approved"
              ? `approved ${a.name}`
              : ap.status === "changes_requested"
                ? `requested changes on ${a.name}`
                : `is reviewing ${a.name}`,
          hue:
            ap.status === "approved"
              ? "green"
              : ap.status === "changes_requested"
                ? "red"
                : "yellow",
          at: ap.created_at,
        });
      }
      for (const c of v.comments) {
        reviewActions.push({
          name: c.reviewer_name ?? "Someone",
          text: `commented on ${a.name}`,
          hue: "blue",
          at: c.created_at,
        });
      }
    }
  }
  reviewActions.sort((x, y) => (x.at < y.at ? 1 : -1));
  const recentReview = reviewActions.slice(0, 2);
  const reviewLinkCount = reviewLinkByAsset.size;

  // Communication counts.
  const emailCount = (emailThreads ?? []).length;
  const slackCount = (slackChannels ?? []).length;
  const chatCount = (chatSpaces ?? []).length;
  const commsTotal = emailCount + slackCount + chatCount;

  // Produce derivations.
  const deliveredCount = (deliverables ?? []).filter((d) => d.status === "delivered").length;
  const deliverTotal = (deliverables ?? []).length;

  const activity = (activityRaw ?? []) as ActivityItem[];

  return (
    <div>
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
      >
        <ChevronLeftIcon /> Projects
      </Link>

      {/* Hero */}
      <div className="relative mb-5 overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
        <div
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, var(--h-purple), var(--h-pink) 40%, var(--h-cyan) 72%, var(--h-green))",
          }}
        />
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {statusInfo && (
                <StatusTag hue={statusInfo.hue} className="mb-2">
                  {statusInfo.label}
                </StatusTag>
              )}
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-text">
                {project.title}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center text-sm text-text-muted">
                <ProjectClientPicker
                  projectId={project.id}
                  clientId={project.client_id}
                  clientName={clientName}
                  clients={clientOptions ?? []}
                />
                {project.shoot_date && (
                  <span className="text-text-faint">
                    {"  ·  "}Shoot {longDate(project.shoot_date)}
                  </span>
                )}
                {project.due_date && (
                  <span className="text-text-faint">
                    {"  ·  "}Due {longDate(project.due_date)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ArchiveProjectButton
                projectId={project.id}
                archived={Boolean((project as { archived_at: string | null }).archived_at)}
              />
              <StatusMenu projectId={project.id} status={project.status} />
            </div>
          </div>

          {/* Lifecycle stepper */}
          <div className="mt-5 flex flex-wrap gap-2">
            {PROJECT_STATUS_ORDER.map((s, i) => {
              const info = PROJECT_STATUS[s];
              const state =
                info.order < currentOrder
                  ? "done"
                  : info.order === currentOrder
                    ? "current"
                    : "todo";
              return (
                <div
                  key={s}
                  className="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-bold"
                  style={{
                    backgroundColor:
                      state === "current"
                        ? "var(--accent-soft)"
                        : "var(--surface-2)",
                    color:
                      state === "current"
                        ? "var(--accent)"
                        : state === "done"
                          ? "var(--text-muted)"
                          : "var(--text-faint)",
                  }}
                >
                  <span
                    className="grid h-4 w-4 place-items-center rounded-full text-[10px] text-white"
                    style={{
                      backgroundColor:
                        state === "done"
                          ? "var(--h-green)"
                          : state === "current"
                            ? "var(--accent)"
                            : "var(--border-strong)",
                    }}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  {info.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Needs attention"
          value={String(attention.length)}
          unit={attention.length === 1 ? "item" : "items"}
          alert={attention.length > 0}
        />
        <Kpi label="Assets" value={String(assets.length)} unit={`· ${versionCount} versions`} />
        <Kpi
          label="Shoot in"
          value={shootDays === null ? "—" : shootDays < 0 ? "Shot" : String(shootDays)}
          unit={shootDays !== null && shootDays >= 0 ? "days" : undefined}
        />
        <Kpi
          label="Budget used"
          value={budgetPct === null ? "—" : String(budgetPct)}
          unit={budgetPct === null ? undefined : "%"}
        />
      </div>

      {/* AI summary */}
      <Card className="mb-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="font-display text-base font-bold">Project summary</h2>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Module hub */}
        <div className="lg:col-span-2">
          <BandLabel hue="blue" label="Plan" />
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <HubCard
              href={`/projects/${project.id}/brief`}
              hue="blue"
              title="Brief"
              sub={briefText ? "Creative direction" : "Not started"}
              footer={briefText ? "View & edit" : "Add the brief"}
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
                  <path d="M14 4v5h5M8 13h8M8 17h6" />
                </svg>
              }
            >
              <p className="text-[13px] leading-relaxed text-text-muted">
                {briefSnippet || "No creative direction captured yet."}
              </p>
            </HubCard>

            <HubCard
              href={`/projects/${project.id}/assets`}
              hue="purple"
              title="Assets"
              sub={`${assets.length} ${assets.length === 1 ? "file" : "files"} · ${versionCount} versions`}
              footer={recentAssets.map((a) => a.name).join(" · ") || "Add your first file"}
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                </svg>
              }
            >
              {recentAssets.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {recentAssets.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-[13px]">
                      <StatusTag hue={a.hue as never}>{a.label}</StatusTag>
                      <span className="truncate font-semibold text-text">{a.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-text-faint">{a.version}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-text-muted">
                  Upload cuts, boards, and stills. Every version is kept.
                </p>
              )}
            </HubCard>
          </div>

          <BandLabel hue="purple" label="Visualize" />
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <HubCard
              href={`/projects/${project.id}/pipeline`}
              hue="purple"
              title="AI Pipeline"
              sub="Script → images → video, with provenance"
              footer="Open the pipeline"
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 9h18M8 4v16" />
                  <circle cx="14.5" cy="14" r="2.5" />
                </svg>
              }
            >
              <p className="text-[13px] text-text-muted">
                Break the script into shots, then generate and triage images and
                video, keeping every model, prompt, and seed on record.
              </p>
            </HubCard>

            <HubCard
              href={`/projects/${project.id}/storyboards`}
              hue="indigo"
              title="Storyboards"
              sub="Plan the edit, frame by frame"
              footer="Open storyboards"
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M2 9h20M8 4v5M16 4v5M8 20v-5M16 20v-5" />
                </svg>
              }
            >
              <p className="text-[13px] text-text-muted">
                Sketch the sequence in frames before the shot list.
              </p>
            </HubCard>

            <HubCard
              href={`/projects/${project.id}/shot-list`}
              hue="purple"
              title="Shot list"
              sub={`${shotCount} shots · ${groupIds.length} groups`}
              footer={shotCount > 0 ? "Present & export" : "Build the shot list"}
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 3v18" />
                </svg>
              }
            >
              <p className="text-[13px] text-text-muted">
                {shotCount > 0
                  ? "Shots, groups, and a client-ready cover."
                  : "Lay out every shot for the shoot."}
              </p>
            </HubCard>

            <HubCard
              href={`/projects/${project.id}/moodboard`}
              hue="cyan"
              title="Moodboard"
              sub="References, styles & inspiration"
              footer="Open moodboard"
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                </svg>
              }
            >
              <p className="text-[13px] text-text-muted">
                Collect references, styles, and inspiration in one place.
              </p>
            </HubCard>
          </div>

          <BandLabel hue="pink" label="Review" />
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <HubCard
              href={`/projects/${project.id}/review`}
              hue="pink"
              title="Review & approvals"
              sub={`${pendingCount} pending · ${changesCount} changes`}
              footer={
                reviewLinkCount > 0
                  ? `${reviewLinkCount} active review ${reviewLinkCount === 1 ? "link" : "links"}`
                  : "Share an asset to review"
              }
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3 8-8" />
                  <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
                </svg>
              }
            >
              {recentReview.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {recentReview.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-[13px]">
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: `var(--h-${r.hue})` }}
                      >
                        {initials(r.name)}
                      </span>
                      <span className="truncate text-text-muted">
                        <span className="font-semibold text-text">{r.name}</span> {r.text}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-text-muted">
                  No review activity yet. Share an asset to collect sign-off.
                </p>
              )}
            </HubCard>

            <HubCard
              href={`/projects/${project.id}/communication`}
              hue="cyan"
              title="Communication"
              sub="Gmail · Slack · Chat"
              footer={
                commsTotal > 0
                  ? `${commsTotal} linked ${commsTotal === 1 ? "conversation" : "conversations"}`
                  : "Link a conversation"
              }
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              }
            >
              {commsTotal > 0 ? (
                <div className="flex flex-wrap gap-2 text-[13px]">
                  {emailCount > 0 && <StatusTag hue="red" dot={false}>{emailCount} email</StatusTag>}
                  {slackCount > 0 && <StatusTag hue="purple" dot={false}>{slackCount} Slack</StatusTag>}
                  {chatCount > 0 && <StatusTag hue="green" dot={false}>{chatCount} Chat</StatusTag>}
                </div>
              ) : (
                <p className="text-[13px] text-text-muted">
                  Link Gmail threads, Slack channels, or Chat spaces to this job.
                </p>
              )}
            </HubCard>
          </div>

          <BandLabel hue="green" label="Produce" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <HubCard
              href={`/projects/${project.id}/contacts`}
              hue="orange"
              title="Project contacts"
              sub="Crew, talent & clients"
              footer={rosterCount > 0 ? "View roster" : "Add crew & talent"}
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
              }
            >
              <p className="text-[13px] text-text-muted">
                {rosterCount > 0
                  ? `${rosterCount} on this production, plus the client's contacts.`
                  : "One roster of crew, talent, and client contacts for the job."}
              </p>
            </HubCard>

            <HubCard
              href={`/projects/${project.id}/calendar`}
              hue="blue"
              title="Calendar"
              sub="Shoot & delivery dates"
              footer={eventCount > 0 ? `${eventCount} scheduled` : "Add key dates"}
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              }
            >
              {nextEvent ? (
                <p className="text-[13px] text-text-muted">
                  Next: <span className="font-semibold text-text">{nextEvent.title}</span>{" "}
                  · {longDate(nextEvent.date)}
                </p>
              ) : project.shoot_date ? (
                <p className="text-[13px] text-text-muted">
                  Shoot <span className="font-semibold text-text">{longDate(project.shoot_date)}</span>
                </p>
              ) : (
                <p className="text-[13px] text-text-muted">
                  Track shoot, review, and delivery dates for this job.
                </p>
              )}
            </HubCard>

            <HubCard
              href={`/projects/${project.id}/callsheet`}
              hue="green"
              title="Call sheet"
              sub={callSheet?.shoot_date ? longDate(callSheet.shoot_date) : "Not created"}
              footer={callSheet ? "View & export PDF" : "Create call sheet"}
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              }
            >
              {callSheet ? (
                <div className="flex flex-col gap-1 text-[13px] text-text-muted">
                  <span>
                    <span className="font-bold text-text">{callSheet.crew_call || callSheet.call_time || "—"}</span>{" "}
                    crew call
                  </span>
                  {callSheet.location && <span className="truncate">📍 {callSheet.location}</span>}
                </div>
              ) : (
                <p className="text-[13px] text-text-muted">
                  Industry-standard call sheet with PDF export.
                </p>
              )}
            </HubCard>

            <HubCard
              href={`/projects/${project.id}/budget`}
              hue="indigo"
              title="Budget"
              sub="Bid vs actual"
              footer={
                budgetEstimated > 0
                  ? `${money(budgetEstimated - budgetActual)} remaining`
                  : "Start the budget"
              }
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
            >
              {budgetEstimated > 0 ? (
                <div>
                  <div className="mb-2 h-2.5 overflow-hidden rounded-pill bg-surface-2">
                    <div
                      className="h-full rounded-pill"
                      style={{
                        width: `${Math.min(100, budgetPct ?? 0)}%`,
                        background: "linear-gradient(90deg, var(--h-green), var(--h-cyan))",
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="font-bold tabular-nums">{money(budgetActual)} <span className="font-medium text-text-faint">actual</span></span>
                    <span className="font-bold tabular-nums">{money(budgetEstimated)} <span className="font-medium text-text-faint">bid</span></span>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-text-muted">
                  Track estimate against actual spend.
                </p>
              )}
            </HubCard>

            <HubCard
              href={`/projects/${project.id}/gear`}
              hue="amber"
              title="Gear & crew"
              sub="Equipment & crew needs"
              footer="Plan gear & crew"
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              }
            >
              <p className="text-[13px] text-text-muted">
                List camera, lighting, grip, and crew needs for the shoot.
              </p>
            </HubCard>

            <HubCard
              href={`/projects/${project.id}/delivery`}
              hue="green"
              title="Delivery & billing"
              sub={`${deliveredCount} of ${deliverTotal} delivered`}
              footer={deliverTotal > 0 ? "Manage delivery" : "Add deliverables"}
              icon={
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7h13v10H3zM16 10h3l2 3v4h-5" />
                  <circle cx="7" cy="18" r="2" />
                  <circle cx="18" cy="18" r="2" />
                </svg>
              }
            >
              <p className="text-[13px] text-text-muted">
                {deliverTotal > 0
                  ? "Final deliverables and billing status."
                  : "List the final deliverables and invoice."}
              </p>
            </HubCard>
          </div>
        </div>

        {/* Right rail: what needs you + activity, always present */}
        <div className="space-y-6 lg:col-span-1">
          <ProjectAttention items={attention} />
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
