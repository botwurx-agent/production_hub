import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditProject, requireStudioContext } from "@/lib/studio";
import { loadRosterOptions, loadSchedule, loadShotOptions } from "@/lib/schedule-data";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { ScheduleEditor } from "@/components/production/schedule-editor";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ params }: { params: { id: string } }) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const [days, shotOptions, roster] = await Promise.all([
    loadSchedule(supabase, project.id),
    loadShotOptions(supabase, project.id),
    loadRosterOptions(supabase, project.id),
  ]);

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Schedule"
        hue="green"
        subtitle="The shoot, day by day. Times fall out of the durations; the day re-flows when anything changes."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h4M8 18h6" />
          </svg>
        }
      />
      <div className="mt-5">
        <ScheduleEditor
          projectId={project.id}
          days={days}
          shotOptions={shotOptions}
          roster={roster}
          canEdit={canEditProject(ctx, project.id)}
        />
      </div>
    </div>
  );
}
