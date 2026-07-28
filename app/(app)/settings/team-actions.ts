"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { siteOrigin } from "@/lib/site-url";
import type { MembershipRole } from "@/lib/database.types";

export type TeamState =
  | { error?: string; token?: string; emailed?: boolean }
  | null;

function canManage(role: MembershipRole): boolean {
  return role === "owner" || role === "admin";
}

const ROLE_BLURB: Record<string, string> = {
  admin: "You will be an admin, so you can invite others and manage the team.",
  member: "You will be able to work on the studio's projects.",
};

// Emails the invite link. Best effort by design: the invite row already exists
// and the link still works, so a mail failure must not fail the invite. The
// caller can always fall back to copying the link.
async function sendInviteEmail(opts: {
  to: string;
  studioName: string;
  role: MembershipRole;
  token: string;
  invitedBy: string | null;
}): Promise<boolean> {
  if (!emailConfigured()) return false;

  const url = `${siteOrigin()}/invite/${opts.token}`;
  const from = opts.invitedBy ? `${opts.invitedBy} invited you` : "You are invited";
  const subject = `${from} to join ${opts.studioName} on Studio Flows`;

  const { html, text } = renderEmail({
    heading: `Join ${opts.studioName} on Studio Flows`,
    lines: [
      `${from} to join ${opts.studioName}, their production workspace on Studio Flows.`,
      ROLE_BLURB[opts.role] ?? "You will be able to work on the studio's projects.",
      "Open the link below to accept. If you do not have an account yet, you can create one on the same page.",
    ],
    ctaLabel: "Accept invite",
    ctaUrl: url,
    footnote: "If you were not expecting this, you can ignore this email.",
  });

  const res = await sendEmail({ to: opts.to, subject, html, text });
  return res.ok;
}

// Create (or reuse) a pending invite for an email + role, and email the person
// their link. Also returns the token, so the caller can copy the
// /invite/<token> link (the only path when email is not configured, and a
// useful fallback when it is).
export async function inviteMember(
  email: string,
  role: MembershipRole
): Promise<TeamState> {
  const ctx = await requireStudioContext();
  if (!canManage(ctx.role)) return { error: "Only owners and admins can invite." };

  const clean = email.trim().toLowerCase();
  if (!clean || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean))
    return { error: "Enter a valid email address." };
  if (role !== "admin" && role !== "member")
    return { error: "Pick a role (member or admin)." };

  const supabase = createClient();

  // Reuse an existing pending invite for this email in this studio.
  const { data: existing } = await supabase
    .from("studio_invites")
    .select("token")
    .eq("studio_id", ctx.studio.id)
    .eq("email", clean)
    .eq("revoked", false)
    .is("accepted_at", null)
    .maybeSingle();
  // Re-inviting someone who already has a pending invite re-sends the mail,
  // which is the natural "they never got it" affordance.
  if (existing) {
    const emailed = await sendInviteEmail({
      to: clean,
      studioName: ctx.studio.name,
      role,
      token: existing.token,
      invitedBy: ctx.email,
    });
    revalidatePath("/settings");
    return { token: existing.token, emailed };
  }

  const token = randomBytes(18).toString("base64url");
  const { error } = await supabase.from("studio_invites").insert({
    studio_id: ctx.studio.id,
    email: clean,
    role,
    token,
    invited_by: ctx.userId,
  });
  if (error) return { error: error.message };

  const emailed = await sendInviteEmail({
    to: clean,
    studioName: ctx.studio.name,
    role,
    token,
    invitedBy: ctx.email,
  });

  revalidatePath("/settings");
  return { token, emailed };
}

export async function revokeInvite(id: string): Promise<TeamState> {
  const ctx = await requireStudioContext();
  if (!canManage(ctx.role)) return { error: "Not allowed." };
  const supabase = createClient();
  const { error } = await supabase
    .from("studio_invites")
    .update({ revoked: true })
    .eq("id", id)
    .eq("studio_id", ctx.studio.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return null;
}

export async function changeMemberRole(
  membershipId: string,
  role: MembershipRole
): Promise<TeamState> {
  const ctx = await requireStudioContext();
  if (!canManage(ctx.role)) return { error: "Not allowed." };
  if (role !== "admin" && role !== "member")
    return { error: "Invalid role." };

  const supabase = createClient();
  const { data: m } = await supabase
    .from("memberships")
    .select("id, role")
    .eq("id", membershipId)
    .eq("studio_id", ctx.studio.id)
    .maybeSingle();
  if (!m) return { error: "Member not found." };
  if (m.role === "owner") return { error: "The owner's role can't be changed." };

  const { error } = await supabase
    .from("memberships")
    .update({ role })
    .eq("id", membershipId)
    .eq("studio_id", ctx.studio.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return null;
}

export async function removeMember(membershipId: string): Promise<TeamState> {
  const ctx = await requireStudioContext();
  if (!canManage(ctx.role)) return { error: "Not allowed." };

  const supabase = createClient();
  const { data: m } = await supabase
    .from("memberships")
    .select("id, role, user_id")
    .eq("id", membershipId)
    .eq("studio_id", ctx.studio.id)
    .maybeSingle();
  if (!m) return { error: "Member not found." };
  if (m.role === "owner") return { error: "You can't remove the studio owner." };
  if (m.user_id === ctx.userId) return { error: "You can't remove yourself." };

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", membershipId)
    .eq("studio_id", ctx.studio.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return null;
}

// Join the signed-in user to any studio that invited their email. Used by the
// /invite/<token> accept page.
export async function acceptInvite(): Promise<{ error?: string; joined?: number }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to accept the invite." };
  const { data, error } = await supabase.rpc("claim_pending_invites");
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { joined: (data as number | null) ?? 0 };
}
