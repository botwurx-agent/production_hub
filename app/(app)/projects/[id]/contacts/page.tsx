import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import {
  ProjectContacts,
  type ContactRow,
} from "@/components/projects/project-contacts";

const SELECT = "id, name, type, role, company, email, phone, rate, notes";

/**
 * A project collaborator (a DP, an AD, a PA) legitimately needs the roster,
 * but must not see what the rest of the crew is being paid. RLS is row-level
 * and cannot mask one column of a row the viewer is allowed to read, so the
 * rate is dropped here, before anything is handed to the browser. The durable
 * fix is to move rate into its own is_studio_member table, where RLS can
 * enforce it rather than this code.
 */
function stripRates(rows: ContactRow[], hide: boolean): ContactRow[] {
  return hide ? rows.map((c) => ({ ...c, rate: null })) : rows;
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
        projectContacts={stripRates((projectRows ?? []) as ContactRow[], ctx.isCollaborator)}
        clientContacts={stripRates((clientRows ?? []) as ContactRow[], ctx.isCollaborator)}
        clientId={project.client_id}
        clientName={clientName}
        canSeeRates={!ctx.isCollaborator}
      />
    </div>
  );
}
