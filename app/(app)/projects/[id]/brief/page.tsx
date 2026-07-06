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
      />
      <Card className="p-5">
        <p className="mb-3 text-sm text-text-muted">
          The creative direction for this job. Everything downstream (assets,
          shots, approvals) references it.
        </p>
        <BriefEditor
          projectId={project.id}
          initialContent={brief?.content ?? ""}
        />
      </Card>
    </div>
  );
}
