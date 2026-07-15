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
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const canCreate = !ctx.isCollaborator;

  const [{ data: projects }, { data: clients }, outstanding] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, title, status, due_date, shoot_date, archived_at, color, client:clients(name)")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").order("name"),
      getOutstanding(),
    ]);

  const rows: ProjectRow[] = (projects ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    due_date: p.due_date,
    shoot_date: p.shoot_date,
    client: (p.client as { name: string } | null) ?? null,
    archived: Boolean((p as { archived_at: string | null }).archived_at),
    color: (p as { color: string | null }).color ?? null,
  }));
  const clientOptions = clients ?? [];

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Every job, one board."
        icon={<ProjectsIcon className="h-6 w-6" />}
        hue="indigo"
        action={canCreate ? <NewProjectButton clients={clientOptions} /> : undefined}
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
