import { createClient } from "@/lib/supabase/server";
import { ProjectNav } from "@/components/projects/project-nav";

/**
 * Every project sub-page.
 *
 * The phase-band nav MOVED INTO THE TOPBAR (see the app layout): it used to sit
 * at the top of this body, which left an empty header above it and pushed every
 * project page down by its own height plus a margin.
 *
 * It is still rendered here BELOW lg, because the header at those widths is
 * already carrying the drawer, the brand and four utility buttons and has no
 * room for it. Two instances, one visible at each breakpoint: both read the
 * active module from the URL and hold nothing but transient dropdown state, so
 * they cannot disagree.
 */
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
        <div className="lg:hidden short:!block">
          <ProjectNav
            projectId={project.id}
            projectType={project.project_type ?? "general"}
          />
        </div>
      )}
      {children}
    </div>
  );
}
