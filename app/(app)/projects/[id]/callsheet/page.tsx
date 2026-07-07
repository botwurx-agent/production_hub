import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { signedLogoUrl } from "@/lib/branding";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { CallSheetWorkspace } from "@/components/production/callsheet-workspace";
import type {
  CallSheet as CS,
  CallSheetEntry,
  CallSheetRecipient,
} from "@/lib/database.types";

export default async function CallSheetPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const logoUrl = await signedLogoUrl(ctx.studio.logo_path);

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: sheets } = await supabase
    .from("call_sheets")
    .select("*")
    .eq("project_id", params.id)
    .order("position", { ascending: true });

  const sheetIds = (sheets ?? []).map((s) => s.id);
  let entries: CallSheetEntry[] = [];
  let recipients: CallSheetRecipient[] = [];
  if (sheetIds.length > 0) {
    const [{ data: entryRows }, { data: recipientRows }] = await Promise.all([
      supabase
        .from("call_sheet_entries")
        .select("*")
        .in("call_sheet_id", sheetIds)
        .order("position", { ascending: true }),
      supabase
        .from("call_sheet_recipients")
        .select("*")
        .in("call_sheet_id", sheetIds)
        .order("created_at", { ascending: true }),
    ]);
    entries = (entryRows ?? []) as CallSheetEntry[];
    recipients = (recipientRows ?? []) as CallSheetRecipient[];
  }

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Call sheet"
        hue="green"
        subtitle="Build one or more call sheets per shoot day, with PDF export."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        }
      />
      <CallSheetWorkspace
        projectId={project.id}
        projectTitle={project.title}
        sheets={(sheets ?? []) as CS[]}
        entries={entries}
        recipients={recipients}
        logoUrl={logoUrl}
      />
    </div>
  );
}
