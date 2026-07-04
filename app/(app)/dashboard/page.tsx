import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { DashboardBody } from "@/components/dashboard/dashboard-body";
import type { Stat } from "@/components/dashboard/stat-tiles";
import { getOutstanding } from "@/lib/outstanding";
import { getLeadFollowups } from "@/lib/leads-followup";
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

  const [{ data: projects }, { data: leads }, { data: activityRaw }, outstanding, followUps] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, title, status, shoot_date, due_date, client:clients(name)"),
      supabase.from("leads").select("id, stage"),
      supabase
        .from("activity")
        .select("id, content, type, created_at, project:projects(id, title)")
        .order("created_at", { ascending: false })
        .limit(8),
      getOutstanding(),
      getLeadFollowups(),
    ]);

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
  const followUpCount = Object.keys(followUps).length;

  const stats: Stat[] = [
    { label: "Active projects", value: activeProjects, hue: "indigo" },
    { label: "Shoots (next 30d)", value: shootsNext30, hue: "orange" },
    { label: "Needs sign-off", value: outstanding.length, hue: "yellow" },
    { label: "Leads to follow up", value: followUpCount, hue: "cyan" },
  ];

  // Pipeline counts by stage.
  const counts: Record<string, number> = {};
  for (const l of leads ?? []) counts[l.stage] = (counts[l.stage] ?? 0) + 1;

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
      <PageHeader title={ctx.studio.name} subtitle="Your studio at a glance." />
      <DashboardBody
        stats={stats}
        outstanding={outstanding}
        events={events}
        upcoming={upcoming}
        todayEvents={todayEvents}
        counts={counts}
        followUpCount={followUpCount}
        activity={activity}
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth()}
        todayStr={todayStr}
      />
    </div>
  );
}
