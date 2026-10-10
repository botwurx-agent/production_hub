"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { generateReviewToken } from "@/lib/review-links";
import { assetStorage } from "@/lib/asset-storage";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { isEmailAddress } from "@/lib/contact";
import { parseRequestFiles } from "@/lib/job-request";
import { reportError } from "@/lib/log";
import { siteOrigin } from "@/lib/site-url";

type LinkResult = { token: string } | { error: string };

/**
 * The client's request link, created on first ask. One per client: a live
 * link is returned as it is, so the brand keeps one stable address; a link
 * that was turned off is reissued with a NEW token, so the old one stays dead.
 * Same contract as the project's client portal.
 */
export async function ensureRequestLink(clientId: string): Promise<LinkResult> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Only the studio can share a request link." };
  const supabase = createClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return { error: "Client not found." };

  const { data: existing } = await supabase
    .from("request_links")
    .select("id, token, revoked_at")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing && !existing.revoked_at) return { token: existing.token };

  const token = generateReviewToken();
  const { error } = existing
    ? await supabase.from("request_links").update({ token, revoked_at: null }).eq("id", existing.id)
    : await supabase.from("request_links").insert({
        studio_id: ctx.studio.id,
        client_id: clientId,
        token,
        created_by: ctx.userId,
      });
  if (error) {
    reportError("ensureRequestLink", error);
    return { error: error.message };
  }
  revalidatePath(`/clients/${clientId}`);
  return { token };
}

/** Turn the request link off. Requests already sent stay as they are. */
export async function revokeRequestLink(clientId: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Only the studio can turn this off." };
  const { error } = await createClient()
    .from("request_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .is("revoked_at", null);
  if (error) {
    reportError("revokeRequestLink", error);
    return { error: error.message };
  }
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

/** Email the request link to someone at the client. */
export async function emailRequestLink(
  clientId: string,
  input: { to: string; subject: string; message?: string }
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  if (!emailConfigured()) return { error: "Email is not set up yet." };
  const to = input.to.trim();
  if (!isEmailAddress(to)) return { error: "Enter a valid recipient email." };
  const link = await ensureRequestLink(clientId);
  if ("error" in link) return { error: link.error };

  const subject = input.subject.trim() || `Send ${ctx.studio.name} your next job`;
  const lines = input.message?.trim()
    ? [input.message.trim()]
    : [
        `This is your link for sending ${ctx.studio.name} new work. Keep it: it works for every job.`,
        "Say what you need, add a deadline, a budget and any files, and it goes straight onto our board. No login needed.",
      ];
  const { html, text } = renderEmail({
    heading: subject,
    lines,
    ctaLabel: "Request new work",
    ctaUrl: `${siteOrigin()}/request/${link.token}`,
  });
  const result = await sendEmail({ to, subject, html, text });
  if (!result.ok) return { error: result.error ?? "The email could not be sent." };
  return { ok: true };
}

/**
 * Open a file a client attached to a request. Signed on CLICK, like a cost
 * document, and only for a path the request row itself lists, so a caller
 * cannot hand in any path in the bucket and have it signed.
 */
export async function getRequestFileUrl(
  requestId: string,
  path: string
): Promise<{ url: string } | { error: string }> {
  await requireStudioContext();
  const { data: request } = await createClient()
    .from("job_requests")
    .select("files")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { error: "That request could not be found." };
  const file = parseRequestFiles(request.files).find((f) => f.path === path);
  if (!file) return { error: "That file is not part of this request." };
  // Not forced to download: a brief or a reference PDF is read in the
  // browser's own viewer, and anything it cannot show downloads anyway.
  const { data, error } = await assetStorage().createSignedUrl(file.path, 60 * 10);
  if (error || !data) return { error: "The file could not be opened." };
  return { url: data.signedUrl };
}
