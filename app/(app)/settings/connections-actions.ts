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
