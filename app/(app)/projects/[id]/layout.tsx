import { createClient } from "@/lib/supabase/server";
import { ProjectNav } from "@/components/projects/project-nav";

// Wraps every project sub-page with the StudioBinder-style project top nav (phase
// bands + module dropdowns) for quick jumping around the project.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, project_type")
    .eq("id", params.id)
    .maybeSingle();

  return (
    <div>
      {project && (
        <ProjectNav projectId={project.id} projectType={project.project_type ?? "general"} />
      )}
      {children}
    </div>
  );
}
