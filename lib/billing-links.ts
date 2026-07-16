import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, BillingDocument } from "@/lib/database.types";
import type { DocSnapshot } from "@/lib/billing-doc";

export type PublicBillingDoc = {
  doc: BillingDocument;
  snapshot: DocSnapshot;
  logoUrl: string | null;
};

// Look up a sent billing document by its public share token (service client,
// RLS bypassed). Returns null unless it has been sent (has a frozen snapshot).
export async function loadBillingDocByToken(
  service: SupabaseClient<Database>,
  token: string
): Promise<PublicBillingDoc | null> {
  const { data } = await service
    .from("billing_documents")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();
  if (!data) return null;
  const doc = data as BillingDocument;
  if (!doc.snapshot) return null;
  const snapshot = doc.snapshot as unknown as DocSnapshot;

  let logoUrl: string | null = null;
  const { data: studio } = await service
    .from("studios")
    .select("logo_path")
    .eq("id", doc.studio_id)
    .maybeSingle();
  const logoPath = (studio as { logo_path?: string | null } | null)?.logo_path;
  if (logoPath) {
    const { data: signed } = await service.storage
      .from("assets")
      .createSignedUrl(logoPath, 60 * 60);
    logoUrl = signed?.signedUrl ?? null;
  }

  return { doc, snapshot, logoUrl };
}
