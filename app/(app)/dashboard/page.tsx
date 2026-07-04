import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { StatTiles, type Stat } from "@/components/dashboard/stat-tiles";
import { Calendar } from "@/components/dashboard/calendar";
import { Upcoming } from "@/components/dashboard/upcoming";
import { PipelineSnapshot } from "@/components/dashboard/pipeline-snapshot";
import { NeedsYou } from "@/components/projects/needs-you";
import { getOutstanding } from "@/lib/outstanding";
import { getLeadFollowups } from "@/lib/leads-followup";
import type { CalendarEvent } from "@/components/dashboard/types";

const pad = (n: number) => String(n).padStart(2, "0");
const dateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async function DashboardPage() {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const [{ data: projects }, { data: leads }, outstanding, followUps] =
    await Promise.all([
      supabase.from("projects").select("id, title, status, shoot_date, due_date"),
      supabase.from("leads").select("id, stage"),
      getOutstanding(),
      getLeadFollowups(),
    ]);

  const proj = projects ?? [];
  const now = new Date();
  const todayStr = dateStr(now);
  const in30Str = dateStr(new Date(now.getTime() + 30 * 86_400_000));

  // Calendar + upcoming events from shoot and delivery dates.
  const events: CalendarEvent[] = [];
  for (const p of proj) {
    if (p.shoot_date)
      events.push({
        date: p.shoot_date,
        title: p.title,
        kind: "shoot",
        href: `/projects/${p.id}`,
      });
    if (p.due_date)
      events.push({
        date: p.due_date,
        title: p.title,
        kind: "due",
        href: `/projects/${p.id}`,
      });
  }
  const upcoming = events
    .filter((e) => e.date >= todayStr)
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

  return (
    <div>
      <PageHeader
        title={ctx.studio.name}
        subtitle="Your studio at a glance."
      />

      <div className="space-y-6">
        <StatTiles stats={stats} />
        <NeedsYou items={outstanding} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <Calendar
              events={events}
              initialYear={now.getFullYear()}
              initialMonth={now.getMonth()}
              todayStr={todayStr}
            />
          </Card>

          <div className="space-y-6">
            <Card className="p-5">
              <h2 className="mb-3 font-display text-base font-bold">Upcoming</h2>
              <Upcoming events={upcoming} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 font-display text-base font-bold">Pipeline</h2>
              <PipelineSnapshot counts={counts} followUps={followUpCount} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
