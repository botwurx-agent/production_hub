import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import {
  ProjectCalendar,
  type PEvent,
} from "@/components/projects/project-calendar";

export default async function ProjectCalendarPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, shoot_date, due_date")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: events } = await supabase
    .from("project_events")
    .select("id, title, date, end_date, kind, notes")
    .eq("project_id", project.id)
    .order("date", { ascending: true });

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Calendar"
        hue="blue"
        subtitle="Shoot, review, and delivery dates for this job."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        }
      />
      <ProjectCalendar
        projectId={project.id}
        events={(events ?? []) as PEvent[]}
        shootDate={project.shoot_date}
        dueDate={project.due_date}
        todayStr={todayStr}
      />
    </div>
  );
}
