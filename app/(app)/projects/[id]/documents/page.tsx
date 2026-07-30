import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { ProjectDocuments } from "@/components/projects/project-documents";
import { loadProjectAssets } from "@/lib/project-data";

export default async function DocumentsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  // The same loader the Assets page uses, asked for the other side of the
  // library, so signed URLs and version history behave identically.
  const { assets } = await loadProjectAssets(
    supabase,
    params.id,
    null,
    "document"
  );

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Documents"
        hue="cyan"
        subtitle="Paperwork that arrives from outside: permits, certificates, specs, schedules."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M8 13h8M8 17h5" />
          </svg>
        }
      />
      <Card className="p-5">
        <ProjectDocuments projectId={project.id} documents={assets} />
      </Card>
    </div>
  );
}
