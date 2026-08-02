import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { loadCast } from "@/lib/cast-data";
import { CastWorkspace } from "@/components/production/cast-workspace";

export default async function ProjectCastPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const { entities, shots, assignments } = await loadCast(project.id, ctx.studio.id);

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Cast & elements"
        hue="purple"
        subtitle="Who and what is in this job, what they wear, and the handles that keep a generation consistent."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        }
      />
      <CastWorkspace
        projectId={project.id}
        studioId={ctx.studio.id}
        entities={entities}
        shots={shots}
        assignments={assignments}
      />
    </div>
  );
}
