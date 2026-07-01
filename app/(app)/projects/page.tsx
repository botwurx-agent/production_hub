import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { ProjectsView } from "@/components/projects/projects-view";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectsIcon } from "@/components/app-shell/nav-icons";
import type { ProjectRow } from "@/components/projects/types";

export default async function ProjectsPage() {
  await requireStudioContext();
  const supabase = createClient();

  const [{ data: projects }, { data: clients }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, status, due_date, shoot_date, client:clients(name)")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const rows = (projects ?? []) as unknown as ProjectRow[];
  const clientOptions = clients ?? [];

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Every job, one board."
        action={<NewProjectButton clients={clientOptions} />}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<ProjectsIcon className="h-7 w-7" />}
          title="No projects yet"
          description="Start your first job to see it on the board, organized by stage."
          action={<NewProjectButton clients={clientOptions} />}
        />
      ) : (
        <ProjectsView projects={rows} />
      )}
    </div>
  );
}
