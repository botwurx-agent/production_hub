import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type NewNotification = {
  studio_id: string;
  project_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
};

// Inserts a notification. Client-agnostic so it works from the authenticated
// app (RLS client) and the public review portal (service-role client).
export async function createNotification(
  client: SupabaseClient<Database>,
  n: NewNotification
): Promise<void> {
  await client.from("notifications").insert({
    studio_id: n.studio_id,
    project_id: n.project_id ?? null,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    href: n.href ?? null,
  });
}
