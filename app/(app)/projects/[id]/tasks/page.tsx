import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { loadProjectPeople } from "@/lib/people-load";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { ProjectTasks } from "@/components/projects/project-tasks";
import type { ProjectTask } from "@/lib/database.types";

export default async function TasksPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, project_type, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: tasks }, people] = await Promise.all([
    supabase
      .from("project_tasks")
      .select("*")
      .eq("project_id", params.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    loadProjectPeople(supabase, ctx, params.id),
  ]);

  // Today is resolved HERE, not in the browser, matching the slate and the
  // payment schedule: an overdue chip that disagrees between the server render
  // and hydration is a bug you only see intermittently.
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Tasks"
        hue="purple"
        subtitle="Everything this job still needs, in the phase it belongs to."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        }
      />
      <Card className="p-5">
        <ProjectTasks
          projectId={project.id}
          projectType={project.project_type}
          projectStatus={project.status}
          tasks={(tasks ?? []) as ProjectTask[]}
          people={people}
          todayIso={todayIso}
          viewerId={ctx.userId}
          // No canEdit gate here, deliberately. project_tasks is one of the
          // four tables migration 0093 kept REVIEWER-WRITABLE, on the grounds
          // that "view and comment" is just "view" otherwise: someone reviewing
          // a cut has to be able to write down what they want changed. Hiding
          // the controls would take back what that migration granted.
        />
      </Card>
    </div>
  );
}
