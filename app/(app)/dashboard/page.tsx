import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { DashboardIcon } from "@/components/app-shell/nav-icons";
import { DashboardBody } from "@/components/dashboard/dashboard-body";
import type { Stat } from "@/components/dashboard/stat-tiles";
import { getOutstanding } from "@/lib/outstanding";
import { DEAL_OPEN_STAGES } from "@/lib/status";
import type {
  CalendarEvent,
  ActivityFeedItem,
} from "@/components/dashboard/types";

const pad = (n: number) => String(n).padStart(2, "0");
const dateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async function DashboardPage() {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const [
    { data: projects },
    { data: deals },
    { data: taskRaw },
    { data: projectTaskRaw },
    { data: activityRaw },
    { data: googleAccount },
    outstanding,
  ] = await Promise.all([
      supabase
        .from("projects")
        .select("id, title, status, shoot_date, due_date, client:clients(name)")
        .is("archived_at", null),
      supabase.from("deals").select("id, stage, value"),
      supabase
        .from("crm_tasks")
        .select(
          "id, title, due_date, deal_id, account_id, deal:deals(title), account:clients(name)"
        )
        .eq("done", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(12),
      supabase
        .from("project_tasks")
        .select("id, title, due_date, project_id")
        .eq("done", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(12),
      supabase
        .from("activity")
        .select("id, content, type, created_at, project:projects(id, title)")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("email_accounts")
        .select("scope")
        .eq("provider", "google")
        .limit(1)
        .maybeSingle(),
      getOutstanding(),
    ]);
  const calendarConnected = Boolean(
    googleAccount?.scope?.includes("/auth/calendar")
  );

  const proj = projects ?? [];
  const now = new Date();
  const todayStr = dateStr(now);
  const in30Str = dateStr(new Date(now.getTime() + 30 * 86_400_000));

  // Calendar events from shoot and delivery dates (carry client for filtering).
  const events: CalendarEvent[] = [];
  for (const p of proj) {
    const clientName = (p.client as { name: string } | null)?.name ?? null;
    if (p.shoot_date)
      events.push({
        date: p.shoot_date,
        title: p.title,
        kind: "shoot",
        href: `/projects/${p.id}`,
        client: clientName,
      });
    if (p.due_date)
      events.push({
        date: p.due_date,
        title: p.title,
        kind: "due",
        href: `/projects/${p.id}`,
        client: clientName,
      });
  }
  const todayEvents = events.filter((e) => e.date === todayStr);
  const upcoming = events
    .filter((e) => e.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 7);

  // KPIs.
  const activeProjects = proj.filter((p) => p.status !== "delivered").length;
  const shootsNext30 = proj.filter(
    (p) => p.shoot_date && p.shoot_date >= todayStr && p.shoot_date <= in30Str
  ).length;

  // Pipeline counts by deal stage + open (in-play) pipeline value.
  const dealRows = deals ?? [];
  const counts: Record<string, number> = {};
  for (const d of dealRows) counts[d.stage] = (counts[d.stage] ?? 0) + 1;
  const openDeals = dealRows.filter((d) =>
    DEAL_OPEN_STAGES.includes(d.stage)
  );
  const openValue = openDeals.reduce((t, d) => t + (d.value ?? 0), 0);

  const stats: Stat[] = [
    { label: "Active projects", value: activeProjects, hue: "indigo" },
    { label: "Shoots (next 30d)", value: shootsNext30, hue: "orange" },
    { label: "Needs sign-off", value: outstanding.length, hue: "yellow" },
    { label: "Open deals", value: openDeals.length, hue: "cyan" },
  ];

  // Open tasks for the dashboard widget: CRM (deal/account) + project tasks,
  // merged and sorted by due date (dated first), capped for a tidy widget.
  const crmTasks = (taskRaw ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    kind: "crm" as const,
    deal_id: t.deal_id,
    account_id: t.account_id,
    deal_title: (t.deal as { title: string } | null)?.title ?? null,
    account_name: (t.account as { name: string } | null)?.name ?? null,
    project_id: null,
    project_title: null,
  }));
  // Title lookup from the already-loaded active projects; tasks on archived or
  // otherwise unlisted projects are dropped from the dashboard.
  const projectTitleById = new Map(
    (projects ?? []).map((p) => [p.id, p.title as string])
  );
  const projTasks = (projectTaskRaw ?? [])
    .filter((t) => projectTitleById.has(t.project_id))
    .map((t) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      kind: "project" as const,
      deal_id: null,
      account_id: null,
      deal_title: null,
      account_name: null,
      project_id: t.project_id,
      project_title: projectTitleById.get(t.project_id) ?? null,
    }));
  const tasks = [...crmTasks, ...projTasks]
    .sort((a, b) => {
      if (!a.due_date) return b.due_date ? 1 : 0;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    })
    .slice(0, 12);

  // Recent activity feed.
  const activity: ActivityFeedItem[] = (activityRaw ?? []).flatMap((a) => {
    const project = a.project as { id: string; title: string } | null;
    if (!project) return [];
    return [
      {
        id: a.id,
        content: a.content,
        type: a.type,
        created_at: a.created_at,
        projectId: project.id,
        projectTitle: project.title,
      },
    ];
  });

  return (
    <div>
      <PageHeader
        title={ctx.studio.name}
        subtitle="Your studio at a glance."
        icon={<DashboardIcon className="h-6 w-6" />}
        hue="indigo"
      />
      <DashboardBody
        stats={stats}
        outstanding={outstanding}
        events={events}
        upcoming={upcoming}
        todayEvents={todayEvents}
        counts={counts}
        openValue={openValue}
        tasks={tasks}
        activity={activity}
        calendarConnected={calendarConnected}
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth()}
        todayStr={todayStr}
      />
    </div>
  );
}
