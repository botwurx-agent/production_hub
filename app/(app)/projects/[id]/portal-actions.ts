"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { generateReviewToken } from "@/lib/review-links";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { isEmailAddress } from "@/lib/contact";
import { reportError } from "@/lib/log";
import { siteOrigin } from "@/lib/site-url";

type PortalResult = { token: string } | { error: string };

/**
 * The project's client portal link, created on first ask. One per project:
 * an existing live link is returned as it is, so the client keeps one stable
 * address; a link that was turned off is reissued with a NEW token, so the
 * old address stays dead.
 */
export async function ensureClientPortal(projectId: string): Promise<PortalResult> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator)
    return { error: "Only the studio can share the client portal." };
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { data: existing } = await supabase
    .from("client_portals")
    .select("id, token, revoked_at")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existing && !existing.revoked_at) return { token: existing.token };

  const token = generateReviewToken();
  if (existing) {
    const { error } = await supabase
      .from("client_portals")
      .update({ token, revoked_at: null, last_viewed_at: null })
      .eq("id", existing.id);
    if (error) {
      reportError("ensureClientPortal/reissue", error);
      return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("client_portals").insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      token,
      created_by: ctx.userId,
    });
    if (error) {
      reportError("ensureClientPortal/insert", error);
      return { error: error.message };
    }
  }
  revalidatePath(`/projects/${projectId}/review`);
  return { token };
}

/** Turn the portal link off. The single review links keep working. */
export async function revokeClientPortal(
  projectId: string
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator)
    return { error: "Only the studio can turn the client portal off." };
  const supabase = createClient();
  const { error } = await supabase
    .from("client_portals")
    .update({ revoked_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .is("revoked_at", null);
  if (error) {
    reportError("revokeClientPortal", error);
    return { error: error.message };
  }
  revalidatePath(`/projects/${projectId}/review`);
  return { ok: true };
}

/** Email the portal link to the client. Gated on emailConfigured(). */
export async function emailClientPortal(
  projectId: string,
  input: { to: string; subject: string; message?: string }
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  if (!emailConfigured()) return { error: "Email is not set up yet." };
  const to = input.to.trim();
  if (!isEmailAddress(to)) return { error: "Enter a valid recipient email." };

  const portal = await ensureClientPortal(projectId);
  if ("error" in portal) return { error: portal.error };

  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle();
  const title = project?.title ?? "your project";

  const subject =
    input.subject.trim() || `${title}: everything for your review, in one place`;
  const lines = input.message?.trim()
    ? [input.message.trim()]
    : [
        `${ctx.studio.name} has put everything for your review on ${title} in one place.`,
        "It shows what is waiting on you, what is being changed, and what is approved, and opens each one to comment or sign off. No login needed.",
      ];
  const { html, text } = renderEmail({
    heading: subject,
    lines,
    ctaLabel: "Open your review portal",
    ctaUrl: `${siteOrigin()}/portal/${portal.token}`,
  });
  const result = await sendEmail({ to, subject, html, text });
  if (!result.ok) return { error: result.error ?? "The email could not be sent." };
  return { ok: true };
}
