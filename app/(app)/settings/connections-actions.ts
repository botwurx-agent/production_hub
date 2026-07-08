"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";

export async function disconnectEmailAccount(id: string) {
  await requireStudioContext();
  const supabase = createClient();
  // RLS restricts deletion to the owning user's own connection.
  await supabase.from("email_accounts").delete().eq("id", id);
  revalidatePath("/settings");
}

export async function disconnectFreshbooks() {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("billing_accounts")
    .delete()
    .eq("studio_id", ctx.studio.id)
    .eq("provider", "freshbooks");
  revalidatePath("/settings");
}
