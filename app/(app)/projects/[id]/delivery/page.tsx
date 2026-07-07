import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { DeliveryPanel } from "@/components/production/delivery-panel";
import type { Deliverable, ProjectBilling } from "@/lib/database.types";

export default async function DeliveryPage({
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

  const [{ data: deliverables }, { data: billing }] = await Promise.all([
    supabase
      .from("deliverables")
      .select("*")
      .eq("project_id", params.id)
      .order("position", { ascending: true }),
    supabase
      .from("project_billing")
      .select("*")
      .eq("project_id", params.id)
      .maybeSingle(),
  ]);

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Delivery & billing"
        hue="green"
        subtitle="Final deliverables and billing status."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7h13v10H3zM16 10h3l2 3v4h-5" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="18" cy="18" r="2" />
          </svg>
        }
      />
      <Card className="p-5">
        <DeliveryPanel
          projectId={project.id}
          deliverables={(deliverables ?? []) as Deliverable[]}
          billing={(billing as ProjectBilling | null) ?? null}
        />
      </Card>
    </div>
  );
}
