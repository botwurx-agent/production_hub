"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";

export type ProjTeamState = { error?: string; token?: string } | null;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Invite someone to collaborate on a single project. Returns the invite token so
// the caller can copy the /project-invite/<token> link. Only studio staff can
// invite (RLS also enforces: project_invites is is_studio_member-gated).
export async function inviteToProject(
  projectId: string,
  email: string
): Promise<ProjTeamState> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator)
    return { error: "Only studio members can invite people." };

  const clean = email.trim().toLowerCase();
  if (!clean || !EMAIL_RE.test(clean))
    return { error: "Enter a valid email address." };

  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, studio_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  // Reuse an existing pending invite for this email on this project.
  const { data: existing } = await supabase
    .from("project_invites")
    .select("token")
    .eq("project_id", projectId)
    .eq("email", clean)
    .eq("revoked", false)
    .is("accepted_at", null)
    .maybeSingle();
  if (existing) {
    revalidatePath(`/projects/${projectId}`);
    return { token: existing.token };
  }

  const token = randomBytes(18).toString("base64url");
  const { error } = await supabase.from("project_invites").insert({
    studio_id: project.studio_id,
    project_id: projectId,
    email: clean,
    role: "collaborator",
    token,
    invited_by: ctx.userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { token };
}

export async function revokeProjectInvite(
  id: string,
  projectId: string
): Promise<ProjTeamState> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Not allowed." };
  const supabase = createClient();
  const { error } = await supabase
    .from("project_invites")
    .update({ revoked: true })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return null;
}

// Remove a collaborator from a project (revokes their access immediately).
export async function removeProjectMember(
  id: string,
  projectId: string
): Promise<ProjTeamState> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Not allowed." };
  const supabase = createClient();
  const { error } = await supabase.from("project_members").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return null;
}

// Accept every pending project invite for the signed-in user's email. Returns
// a project to land on.
export async function acceptProjectInvite(): Promise<{
  error?: string;
  projectId?: string;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to accept the invite." };

  const { error } = await supabase.rpc("claim_pending_project_invites");
  if (error) return { error: error.message };

  const { data } = await supabase
    .from("project_members")
    .select("project_id")
    .order("created_at", { ascending: false })
    .limit(1);

  revalidatePath("/", "layout");
  return { projectId: data?.[0]?.project_id };
}
