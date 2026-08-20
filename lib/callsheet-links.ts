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

/**
 * The meal rounds this recipient is actually on, with their own state.
 *
 * Scoped by the JOIN rather than by a filter on the round: a recipient sees a
 * round only when a meal_responses row puts them on it, which is the same rule
 * the producer's include/exclude list writes. Someone dropped from the crew
 * lunch stops seeing it, without anything else having to remember.
 */
export type PublicMeal = {
  roundId: string;
  meal: string;
  orderUrl: string;
  instructions: string | null;
  cutoffAt: string | null;
  budgetPerHead: number | null;
  openedAt: string | null;
  orderedAt: string | null;
};

export async function loadMealsForRecipient(
  service: SupabaseClient<Database>,
  recipient: CallSheetRecipient
): Promise<PublicMeal[]> {
  const { data } = await service
    .from("meal_responses")
    .select(
      "id, opened_at, ordered_at, round:meal_rounds(id, meal, order_url, instructions, cutoff_at, budget_per_head, sent_at)"
    )
    .eq("recipient_id", recipient.id);

  const out: PublicMeal[] = [];
  for (const row of data ?? []) {
    const r = row.round as unknown as {
      id: string;
      meal: string;
      order_url: string;
      instructions: string | null;
      cutoff_at: string | null;
      budget_per_head: number | string | null;
      sent_at: string | null;
    } | null;
    // An unsent round is still being drafted by the producer. Showing it would
    // leak a half-built order to the crew before anyone meant to send it.
    if (!r || !r.sent_at) continue;
    out.push({
      roundId: r.id,
      meal: r.meal,
      orderUrl: r.order_url,
      instructions: r.instructions,
      cutoffAt: r.cutoff_at,
      // numeric arrives from PostgREST as a string.
      budgetPerHead: r.budget_per_head === null ? null : Number(r.budget_per_head),
      openedAt: row.opened_at,
      orderedAt: row.ordered_at,
    });
  }
  return out;
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
