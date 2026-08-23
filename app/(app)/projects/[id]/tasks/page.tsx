import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { loadProjectPeople, loadPendingInvites } from "@/lib/people-load";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { ProjectTasks } from "@/components/projects/project-tasks";
import type { BoardTask } from "@/lib/tasks";

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
      // Assignees ride along as an embedded select. The typed client refuses
      // the embed without a Relationships entry in database.types.ts, which is
      // the same trap prop_options and call_sheet_recipients hit.
      .select("*, assignees:project_task_assignees(user_id)")
      .eq("project_id", params.id)
      // The board sorts within a column itself (hand-placed position, then due
      // date), so this only needs to be stable.
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true }),
    loadProjectPeople(supabase, ctx, params.id),
  ]);

  // Only worth asking for when there is somebody to invite in the first place.
  const pendingInvites = ctx.isCollaborator
    ? []
    : await loadPendingInvites(supabase, ctx, params.id);

  // Today is resolved HERE, not in the browser, matching the slate and the
  // payment schedule: an overdue chip that disagrees between the server render
  // and hydration is a bug you only see intermittently.
  const todayIso = new Date().toISOString().slice(0, 10);

  // Flatten the embedded rows to plain user ids, so nothing past this point has
  // to know assignees live in their own table.
  const board: BoardTask[] = (tasks ?? []).map((t) => {
    const { assignees, ...row } = t as typeof t & {
      assignees: { user_id: string }[] | null;
    };
    return { ...row, assignees: (assignees ?? []).map((a) => a.user_id) };
  });

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Tasks"
        hue="purple"
        subtitle="Drag a card as the work moves. Group by status, or by the phase of the job."
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
          tasks={board}
          people={people}
          todayIso={todayIso}
          viewerId={ctx.userId}
          // The invite panel is only mounted for staff, so offering the button
          // to a collaborator would be a dead end rather than a refusal.
          canInvite={!ctx.isCollaborator}
          pendingInvites={pendingInvites}
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
