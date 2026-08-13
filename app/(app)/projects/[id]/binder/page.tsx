import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { BinderBuilder, type BinderRow } from "@/components/production/binder-builder";
import { loadBinderSections } from "@/lib/binder-data";
import { siteOrigin } from "@/lib/site-url";

export default async function BinderPage({
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

  const [{ data: binders }, available] = await Promise.all([
    supabase
      .from("project_binders")
      .select(
        "id, title, token, sections, shared_at, revoked_at, view_count, last_viewed_at"
      )
      .eq("project_id", params.id)
      .order("created_at", { ascending: true }),
    loadBinderSections(supabase, params.id),
  ]);

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Binder"
        hue="orange"
        subtitle="Everything about this job in one place, assembled from what is already here. You choose what the client sees."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" />
            <path d="M8 3v18M4 8h4M4 12h4M4 16h4" />
          </svg>
        }
      />
      <Card className="p-4">
        <BinderBuilder
          projectId={project.id}
          origin={siteOrigin()}
          binders={(binders ?? []) as BinderRow[]}
          available={available}
        />
      </Card>
    </div>
  );
}
