import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { getOutstanding } from "@/lib/outstanding";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { ProjectsView } from "@/components/projects/projects-view";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { NeedsYou } from "@/components/projects/needs-you";
import { ProjectsIcon } from "@/components/app-shell/nav-icons";
import type { ProjectRow } from "@/components/projects/types";

export default async function ProjectsPage() {
  await requireStudioContext();
  const supabase = createClient();

  const [{ data: projects }, { data: clients }, outstanding] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, title, status, due_date, shoot_date, client:clients(name)")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").order("name"),
      getOutstanding(),
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
      <NeedsYou items={outstanding} />
      {rows.length === 0 ? (
        <EmptyState
          hue="indigo"
          icon={<ProjectsIcon className="h-7 w-7" />}
          title="No projects yet"
          description="A project is a single job or production. It holds the brief, assets, approvals, and everything else in one place."
          action={<NewProjectButton clients={clientOptions} />}
          steps={[
            {
              title: "Start a job",
              text: "Create a project and tie it to a client.",
            },
            {
              title: "Work through stages",
              text: "Move it from brief to review to shooting to delivered.",
            },
            {
              title: "See it on the board",
              text: "Every job, color-tagged by status, at a glance.",
            },
          ]}
        />
      ) : (
        <ProjectsView projects={rows} />
      )}
    </div>
  );
}
