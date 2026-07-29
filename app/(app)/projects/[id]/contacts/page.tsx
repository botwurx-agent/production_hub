import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { loadContactRates } from "@/lib/rates";
import {
  ProjectContacts,
  type ContactRow,
} from "@/components/projects/project-contacts";

const SELECT = "id, name, type, role, company, email, phone, notes";

/**
 * Day rates live in `contact_rates`, an is_studio_member table (migration
 * 0074), so a project collaborator's query simply returns no rows and every
 * rate comes back null without any check here. That is deliberate: the old
 * approach stripped the column in this component, which worked but had to be
 * remembered at every new read site.
 */
function withRates(
  rows: ContactRow[],
  rates: Map<string, number>
): ContactRow[] {
  return rows.map((c) => ({ ...c, rate: rates.get(c.id) ?? null }));
}

export default async function ProjectContactsPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client_id, client:clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const clientName =
    (project.client as { name: string } | null)?.name ?? null;

  const [{ data: projectRows }, { data: clientRows }] = await Promise.all([
    supabase
      .from("contacts")
      .select(SELECT)
      .eq("project_id", project.id)
      .order("created_at", { ascending: true }),
    project.client_id
      ? supabase
          .from("contacts")
          .select(SELECT)
          .eq("client_id", project.client_id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as ContactRow[] }),
  ]);

  const rates = await loadContactRates(supabase, [
    ...(projectRows ?? []).map((c) => c.id),
    ...(clientRows ?? []).map((c) => c.id),
  ]);

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Project contacts"
        hue="orange"
        subtitle="Crew, talent, and client contacts for this job, in one roster."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          </svg>
        }
      />
      <ProjectContacts
        projectId={project.id}
        projectContacts={withRates((projectRows ?? []) as ContactRow[], rates)}
        clientContacts={withRates((clientRows ?? []) as ContactRow[], rates)}
        clientId={project.client_id}
        clientName={clientName}
        canSeeRates={!ctx.isCollaborator}
      />
    </div>
  );
}
