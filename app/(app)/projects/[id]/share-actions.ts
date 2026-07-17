"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { generateReviewToken } from "@/lib/review-links";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { longDate } from "@/lib/format";

export type ShareState = { error?: string } | null;

const DOC_NOUN: Record<string, string> = {
  shot_list: "shot list",
  storyboard: "storyboard",
  moodboard: "moodboard",
  ai_shot: "shot",
};

function emailOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

// Creates a client review link for an asset (or returns the existing active
// one, so a studio always shares one stable URL per asset).
export async function createReviewLink(
  projectId: string,
  assetId: string,
  recipient?: string
): Promise<{ token: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  // Confirm the asset belongs to this project (and, via RLS, this studio).
  const { data: asset } = await supabase
    .from("assets")
    .select("id, project_id")
    .eq("id", assetId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!asset) return { error: "Asset not found." };

  const { data: existing } = await supabase
    .from("review_links")
    .select("token")
    .eq("asset_id", assetId)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { token: existing.token };

  const token = generateReviewToken();
  const { error } = await supabase.from("review_links").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    asset_id: assetId,
    token,
    recipient: recipient?.trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { token };
}

// Creates (or returns the existing active) client review link for a doc
// surface: the shot list (target = project), a storyboard, or a moodboard
// (target = boards.id). Verifies the target belongs to this project + studio.
export async function createDocReviewLink(
  projectId: string,
  kind: "shot_list" | "storyboard" | "moodboard" | "ai_shot",
  targetId: string
): Promise<{ token: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  if (kind === "shot_list") {
    if (targetId !== projectId) return { error: "Invalid shot list target." };
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return { error: "Project not found." };
  } else if (kind === "ai_shot") {
    const { data: shot } = await supabase
      .from("ai_shots")
      .select("id")
      .eq("id", targetId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!shot) return { error: "That shot was not found." };
  } else {
    const { data: board } = await supabase
      .from("boards")
      .select("id")
      .eq("id", targetId)
      .eq("project_id", projectId)
      .eq("kind", kind)
      .maybeSingle();
    if (!board) return { error: "That board was not found." };
  }

  const { data: existing } = await supabase
    .from("review_links")
    .select("token")
    .eq("target_type", kind)
    .eq("target_id", targetId)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { token: existing.token };

  const token = generateReviewToken();
  const { error } = await supabase.from("review_links").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    target_type: kind,
    target_id: targetId,
    token,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { token };
}

// Email the client a doc review link (shot list / storyboard / moodboard):
// creates or reuses the /r/<token> link, then sends it. Gated on emailConfigured().
export async function emailDocReviewLink(
  projectId: string,
  kind: "shot_list" | "storyboard" | "moodboard" | "ai_shot",
  targetId: string,
  input: { to: string; subject: string; message?: string; dueDate?: string }
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  if (!emailConfigured()) return { error: "Email is not set up yet." };

  const to = input.to.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { error: "Enter a valid recipient email." };
  }

  const link = await createDocReviewLink(projectId, kind, targetId);
  if ("error" in link) return { error: link.error };

  // Persist recipient + due date on the link so reminders can find it.
  const dueDate = input.dueDate?.trim() || null;
  const supabase = createClient();
  await supabase
    .from("review_links")
    .update({ recipient: to, due_date: dueDate })
    .eq("token", link.token);

  const noun = DOC_NOUN[kind] ?? "document";
  const url = `${emailOrigin()}/r/${link.token}`;
  const subject =
    input.subject.trim() || `${ctx.studio.name} shared a ${noun} for review`;
  const lines = input.message?.trim()
    ? [input.message.trim()]
    : [
        `${ctx.studio.name} shared a ${noun} with you to review.`,
        "Open it below to view, leave pinned comments, and approve or request changes. No login needed.",
      ];
  if (dueDate) lines.push(`Please respond by ${longDate(dueDate)}.`);

  const { html, text } = renderEmail({
    heading: subject,
    lines,
    ctaLabel: `View ${noun}`,
    ctaUrl: url,
  });

  const result = await sendEmail({ to, subject, html, text });
  if (!result.ok) return { error: result.error ?? "The email could not be sent." };
  return { ok: true };
}

export async function revokeReviewLink(
  projectId: string,
  linkId: string
): Promise<ShareState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("review_links")
    .update({ revoked: true })
    .eq("id", linkId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return null;
}
