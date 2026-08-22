"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { siteOrigin } from "@/lib/site-url";

export type ProjTeamState =
  | { error?: string; token?: string; emailed?: boolean }
  | null;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Emails a collaborator their project invite. Best effort: the invite row is
// already written and the link works regardless, so a mail failure never fails
// the invite.
async function sendProjectInviteEmail(opts: {
  to: string;
  projectTitle: string;
  studioName: string;
  token: string;
  invitedBy: string | null;
}): Promise<boolean> {
  if (!emailConfigured()) return false;

  const url = `${siteOrigin()}/project-invite/${opts.token}`;
  const from = opts.invitedBy ? `${opts.invitedBy} invited you` : "You are invited";
  const subject = `${from} to work on ${opts.projectTitle}`;

  const { html, text } = renderEmail({
    heading: `Join ${opts.projectTitle}`,
    lines: [
      `${from} to collaborate on ${opts.projectTitle}, a production run by ${opts.studioName} on Studio Flows.`,
      // Say the boundary out loud: a crew member should know what they are and
      // are not being given access to before they accept.
      "You will have access to this project only, not to the rest of the studio.",
      "Open the link below to accept. If you do not have an account yet, you can create one on the same page.",
    ],
    ctaLabel: "Open the project",
    ctaUrl: url,
    footnote: "If you were not expecting this, you can ignore this email.",
  });

  const res = await sendEmail({ to: opts.to, subject, html, text });
  return res.ok;
}

// Invite someone to collaborate on a single project, and email them the link.
// Also returns the invite token so the caller can copy the
// /project-invite/<token> link. Only studio staff can invite (RLS also
// enforces: project_invites is is_studio_member-gated).
/**
 * Two tiers on a project (migration 0093). An EDITOR works the job; a REVIEWER
 * reads it and leaves notes. Only the literal string 'reviewer' restricts, so
 * anything unexpected lands as an editor, matching can_edit_project.
 */
export type ProjectRole = "editor" | "reviewer";

function cleanRole(v: string | null | undefined): ProjectRole {
  return v === "reviewer" ? "reviewer" : "editor";
}

export async function inviteToProject(
  projectId: string,
  email: string,
  role: ProjectRole = "editor"
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
    .select("id, studio_id, title")
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
  // Re-inviting re-sends the mail (the "they never got it" affordance).
  if (existing) {
    const emailed = await sendProjectInviteEmail({
      to: clean,
      projectTitle: project.title,
      studioName: ctx.studio.name,
      token: existing.token,
      invitedBy: ctx.email,
    });
    revalidatePath(`/projects/${projectId}`);
    return { token: existing.token, emailed };
  }

  const token = randomBytes(18).toString("base64url");
  const { error } = await supabase.from("project_invites").insert({
    studio_id: project.studio_id,
    project_id: projectId,
    email: clean,
    role: cleanRole(role),
    token,
    invited_by: ctx.userId,
  });
  if (error) return { error: error.message };

  const emailed = await sendProjectInviteEmail({
    to: clean,
    projectTitle: project.title,
    studioName: ctx.studio.name,
    token,
    invitedBy: ctx.email,
  });

  revalidatePath(`/projects/${projectId}`);
  return { token, emailed };
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
