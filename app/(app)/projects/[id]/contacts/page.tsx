import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { loadContactRates } from "@/lib/rates";
import {
  loadContactProfiles,
  loadContactFilesByContact,
  signHeadshots,
} from "@/lib/talent-data";
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

/**
 * Talent detail, merged onto the roster rows.
 *
 * Unlike rates, this is NOT withheld from a collaborator: costume needs the
 * measurements and craft services needs the allergies, and both reach the job
 * as collaborators. Migration 0091 says the same thing in the policy, and the
 * page says it out loud in the catering pane.
 */
function withProfiles(
  rows: ContactRow[],
  profiles: Map<string, import("@/lib/talent").TalentProfile>,
  headshots: Map<string, string>,
  files: Map<string, import("@/lib/talent-data").ContactFile[]>
): ContactRow[] {
  return rows.map((c) => ({
    ...c,
    profile: profiles.get(c.id) ?? null,
    headshotUrl: headshots.get(c.id) ?? null,
    files: files.get(c.id) ?? [],
  }));
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

  const ids = [
    ...(projectRows ?? []).map((c) => c.id),
    ...(clientRows ?? []).map((c) => c.id),
  ];

  const [rates, profiles, files] = await Promise.all([
    loadContactRates(supabase, ids),
    loadContactProfiles(supabase, ids),
    loadContactFilesByContact(supabase, ids),
  ]);
  // Signing depends on the profiles, so it cannot join the batch above.
  const headshots = await signHeadshots(profiles);

  const merge = (rows: ContactRow[]) =>
    withProfiles(withRates(rows, rates), profiles, headshots, files);

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
        projectContacts={merge((projectRows ?? []) as ContactRow[])}
        clientContacts={merge((clientRows ?? []) as ContactRow[])}
        clientId={project.client_id}
        clientName={clientName}
        canSeeRates={!ctx.isCollaborator}
      />
    </div>
  );
}
