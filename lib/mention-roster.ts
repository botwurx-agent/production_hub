import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MentionCandidate } from "@/lib/mentions";

/**
 * The people on a project who can be mentioned.
 *
 * ONE LOADER, TWO JOBS, and that is the point: the composer offers exactly this
 * list, and the server validates against exactly this list. If they came from
 * different queries they could disagree, and the failure mode of that
 * disagreement is a note addressed to somebody who never gets it.
 *
 * PROJECT CONTACTS ONLY. The client's own contacts hang off `client_id` rather
 * than `project_id` and are deliberately not here, matching the client
 * exclusion in lib/mentions.ts: talking to the brand is what the review share
 * links and the Communication module are for, and both are deliberate acts
 * rather than a side effect of typing a name.
 */
export async function loadMentionRoster(
  projectId: string
): Promise<MentionCandidate[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, name, role, company, type, email, user_id")
    .eq("project_id", projectId)
    .order("name", { ascending: true });

  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    company: c.company,
    type: c.type,
    email: c.email,
    userId: c.user_id,
  }));
}
