import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { BriefEditor } from "@/components/projects/brief-editor";
import { ProjectSubhead } from "@/components/projects/project-subhead";

export default async function BriefPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const [{ data: project }, { data: brief }] = await Promise.all([
    supabase.from("projects").select("id, title").eq("id", params.id).maybeSingle(),
    supabase
      .from("briefs")
      .select("content")
      .eq("project_id", params.id)
      .maybeSingle(),
  ]);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Brief"
        hue="blue"
        subtitle="The creative direction for this job."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
            <path d="M14 4v5h5M8 13h8M8 17h6" />
          </svg>
        }
      />
      <Card className="p-5">
        <p className="mb-3 text-sm text-text-muted">
          Everything downstream (assets, shots, approvals) references it.
        </p>
        <BriefEditor
          projectId={project.id}
          initialContent={brief?.content ?? ""}
        />
      </Card>
    </div>
  );
}
