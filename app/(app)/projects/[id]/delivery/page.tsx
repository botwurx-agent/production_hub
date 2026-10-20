import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext, canEditProject } from "@/lib/studio";
import { emailConfigured } from "@/lib/email";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { DeliveryPanel } from "@/components/production/delivery-panel";
import type { Deliverable, DeliveryFile } from "@/lib/database.types";

/**
 * Deliverables: what the job ships, the stage each is at, and the final home
 * for the finished files with one link that sends them to the client.
 *
 * The billing-status block and the per-deliverable rate that used to live here
 * are gone from the page (operator, 2026-10-20). Their tables are untouched:
 * project_billing.amount is still the margin fallback on the budget and in
 * reports, and deliverable_pricing still holds any rate already entered.
 */
export default async function DeliverablesPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: deliverables }, { data: files }, link] = await Promise.all([
    supabase
      .from("deliverables")
      .select("*")
      .eq("project_id", params.id)
      .order("position", { ascending: true }),
    supabase
      .from("delivery_files")
      .select("*")
      .eq("project_id", params.id)
      .order("created_at", { ascending: true }),
    ctx.isCollaborator
      ? Promise.resolve({ data: null })
      : supabase
          .from("delivery_links")
          .select("token, revoked_at")
          .eq("project_id", params.id)
          .maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Deliverables"
        hue="green"
        subtitle="What the job ships, where each one stands, and the final files the client downloads."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16.5 9.4 7.5 4.2M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <path d="M3.3 7 12 12l8.7-5M12 22V12" />
          </svg>
        }
      />
      <Card className="p-5">
        <DeliveryPanel
          projectId={project.id}
          projectTitle={project.title}
          deliverables={(deliverables ?? []) as Deliverable[]}
          files={(files ?? []) as DeliveryFile[]}
          linkToken={link.data && !link.data.revoked_at ? link.data.token : null}
          canEdit={canEditProject(ctx, project.id)}
          canSend={!ctx.isCollaborator}
          emailEnabled={emailConfigured()}
        />
      </Card>
    </div>
  );
}
