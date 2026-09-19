import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditProject, requireStudioContext } from "@/lib/studio";
import { loadRosterOptions, loadSchedule, loadShotOptions } from "@/lib/schedule-data";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { emailConfigured } from "@/lib/email";
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

  const [days, shotOptions, roster, { data: docReview }] = await Promise.all([
    loadSchedule(supabase, project.id),
    loadShotOptions(supabase, project.id),
    loadRosterOptions(supabase, project.id),
    supabase
      .from("doc_reviews")
      .select("id")
      .eq("target_type", "schedule")
      .eq("target_id", project.id)
      .maybeSingle(),
  ]);

  // Client comments returned on the schedule, from a shared review link. The
  // author_id filter is what makes this "what came back from outside" rather
  // than a count of the studio's own notes.
  const { count: commentCount } = await supabase
    .from("review_comments")
    .select("id", { count: "exact", head: true })
    .eq("target_type", "schedule")
    .eq("target_id", project.id)
    .is("author_id", null);

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
          studioName={ctx.studio.name}
          emailEnabled={emailConfigured()}
          inReview={Boolean(docReview)}
          commentCount={commentCount ?? 0}
        />
      </div>
    </div>
  );
}
