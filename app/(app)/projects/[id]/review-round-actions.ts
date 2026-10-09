"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { parseRounds } from "@/lib/revision-rounds";

/**
 * Set how many client revision rounds the project includes per deliverable.
 * A blank value turns tracking off. Studio staff only: the number usually
 * comes off the SOW, which a collaborator does not hold, and RLS on projects
 * refuses them anyway.
 */
export async function setRevisionRounds(
  projectId: string,
  raw: string
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator)
    return { error: "Only the studio can set the revision rounds." };
  const value = parseRounds(raw);
  if (raw.trim() !== "" && value == null)
    return { error: "Rounds must be a whole number from 0 to 20." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ revision_rounds: value })
    .eq("id", projectId)
    .select("id");
  if (error) {
    reportError("setRevisionRounds", error);
    return { error: error.message };
  }
  if (!data || data.length === 0)
    return { error: "This project could not be updated." };

  revalidatePath(`/projects/${projectId}/review`);
  revalidatePath(`/projects/${projectId}/assets`);
  return { ok: true };
}
