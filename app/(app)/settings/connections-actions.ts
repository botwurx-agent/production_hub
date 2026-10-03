"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { logWrite } from "@/lib/log";

export async function disconnectEmailAccount(id: string) {
  await requireStudioContext();
  const supabase = createClient();
  // RLS restricts deletion to the owning user's own connection.
  await logWrite(
    "disconnectEmailAccount/email_accounts",
    supabase.from("email_accounts").delete().eq("id", id)
  );
  revalidatePath("/settings");
}
