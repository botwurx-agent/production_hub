"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";

export async function saveBillingProfile(patch: {
  business_name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  default_terms?: string | null;
  default_notes?: string | null;
  invoice_prefix?: string;
  estimate_prefix?: string;
}): Promise<void> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("billing_profiles")
    .upsert(
      { studio_id: ctx.studio.id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "studio_id" },
    );
  revalidatePath("/settings");
}
