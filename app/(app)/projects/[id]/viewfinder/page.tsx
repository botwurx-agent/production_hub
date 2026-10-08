import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditProject, requireStudioContext } from "@/lib/studio";
import { ViewfinderGate } from "@/components/viewfinder/viewfinder-gate";

export const dynamic = "force-dynamic";

export const metadata = { title: "Viewfinder" };

export default async function ViewfinderPage({ params }: { params: { id: string } }) {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id, title").eq("id", params.id).maybeSingle();
  if (!project) notFound();
  return (
    <ViewfinderGate
      projectId={project.id}
      projectTitle={project.title}
      canEdit={canEditProject(ctx, project.id)}
      stillsHref={`/projects/${project.id}/stills`}
      backHref={`/projects/${project.id}`}
    />
  );
}
