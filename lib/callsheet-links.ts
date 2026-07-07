import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  CallSheet,
  CallSheetEntry,
  CallSheetRecipient,
} from "@/lib/database.types";

// Look up a recipient by their public token (service client, RLS bypassed).
export async function getCallSheetRecipient(
  service: SupabaseClient<Database>,
  token: string
): Promise<CallSheetRecipient | null> {
  const { data } = await service
    .from("call_sheet_recipients")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return (data as CallSheetRecipient | null) ?? null;
}

export type PublicCallSheet = {
  sheet: CallSheet;
  entries: CallSheetEntry[];
  studioName: string;
  clientName: string | null;
  logoUrl: string | null;
  projectId: string;
};

// Assemble the read-only call sheet for a recipient. Strictly scoped to the
// recipient's call_sheet_id / studio_id.
export async function loadCallSheetForRecipient(
  service: SupabaseClient<Database>,
  recipient: CallSheetRecipient
): Promise<PublicCallSheet | null> {
  const { data: sheet } = await service
    .from("call_sheets")
    .select("*")
    .eq("id", recipient.call_sheet_id)
    .maybeSingle();
  if (!sheet) return null;
  const s = sheet as CallSheet;

  const [{ data: entriesRaw }, { data: studio }, { data: project }] =
    await Promise.all([
      service
        .from("call_sheet_entries")
        .select("*")
        .eq("call_sheet_id", s.id)
        .order("position", { ascending: true }),
      service.from("studios").select("name, logo_path").eq("id", s.studio_id).maybeSingle(),
      service
        .from("projects")
        .select("id, title, client:clients(name)")
        .eq("id", s.project_id)
        .maybeSingle(),
    ]);

  let logoUrl: string | null = null;
  const logoPath = (studio as { logo_path?: string | null } | null)?.logo_path;
  if (logoPath) {
    const { data } = await service.storage
      .from("assets")
      .createSignedUrl(logoPath, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  return {
    sheet: s,
    entries: (entriesRaw ?? []) as CallSheetEntry[],
    studioName: (studio as { name?: string } | null)?.name ?? "The studio",
    clientName: (project?.client as { name: string } | null)?.name ?? null,
    logoUrl,
    projectId: s.project_id,
  };
}
