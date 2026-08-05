"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";

/**
 * The link that hands a project's picked takes to whoever cuts it.
 *
 * One live link per project rather than one per send: the page always serves
 * the current picks, so a second link would only be a second thing to keep
 * track of. Re-running this returns the existing link.
 */
export async function getOrCreateHandoff(projectId: string) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("editor_handoffs")
    .select("token")
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.token) return { token: existing.token };

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("editor_handoffs").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    token,
    created_by: ctx.userId,
  });
  if (error) {
    reportError("getOrCreateHandoff", { error, projectId });
    return { error: "Could not create that link." };
  }
  revalidatePath(`/projects/${projectId}/pipeline`);
  return { token };
}

export async function revokeHandoff(projectId: string) {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("editor_handoffs")
    .update({ revoked_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .is("revoked_at", null);
  if (error) {
    reportError("revokeHandoff", { error, projectId });
    return { error: "Could not turn that off." };
  }
  revalidatePath(`/projects/${projectId}/pipeline`);
  return {};
}
