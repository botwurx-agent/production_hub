"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { finalizeUpload, discardUpload } from "@/lib/upload-ticket";
import { assetStorage } from "@/lib/asset-storage";
import { generateReviewToken } from "@/lib/review-links";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { isEmailAddress } from "@/lib/contact";
import { reportError } from "@/lib/log";
import { siteOrigin } from "@/lib/site-url";

type Ok = { ok: true } | { error: string };

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}`);
}

/** A deliverable id from the browser, accepted only when it is on this project. */
async function deliverableOnProject(
  projectId: string,
  deliverableId: string | null
): Promise<string | null | false> {
  if (!deliverableId) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("deliverables")
    .select("id")
    .eq("id", deliverableId)
    .eq("project_id", projectId)
    .maybeSingle();
  return data ? data.id : false;
}

/**
 * File final deliverables that the browser has already uploaded direct to
 * Storage on the `delivery_file` scope. Every path is re-checked by
 * finalizeUpload (shape + real size) before a row points at it.
 */
export async function addDeliveryFiles(
  projectId: string,
  files: { path: string; name: string; deliverableId: string | null }[]
): Promise<{ added: number; failed: string[] } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, studio_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const rows: {
    studio_id: string;
    project_id: string;
    deliverable_id: string | null;
    storage_path: string;
    file_name: string;
    size_bytes: number;
    mime_type: string | null;
    created_by: string;
  }[] = [];
  const failed: string[] = [];
  for (const f of files.slice(0, 50)) {
    const done = await finalizeUpload({ kind: "delivery_file", projectId }, f.path);
    if ("error" in done) {
      failed.push(f.name);
      continue;
    }
    const d = await deliverableOnProject(projectId, f.deliverableId);
    rows.push({
      studio_id: project.studio_id,
      project_id: projectId,
      deliverable_id: d === false ? null : d,
      storage_path: f.path,
      file_name: (f.name || "file").slice(0, 200),
      size_bytes: done.size,
      mime_type: done.mimeType,
      created_by: ctx.userId,
    });
  }
  if (rows.length) {
    const { error } = await supabase.from("delivery_files").insert(rows);
    if (error) {
      reportError("addDeliveryFiles", error);
      await Promise.all(rows.map((r) => discardUpload(r.storage_path)));
      return { error: error.message };
    }
  }
  rp(projectId);
  return { added: rows.length, failed };
}

/** Move a final file onto a different deliverable, or off all of them. */
export async function setDeliveryFileDeliverable(
  projectId: string,
  fileId: string,
  deliverableId: string | null
): Promise<Ok> {
  await requireStudioContext();
  const d = await deliverableOnProject(projectId, deliverableId);
  if (d === false) return { error: "That deliverable is not on this project." };
  const supabase = createClient();
  const { error } = await supabase
    .from("delivery_files")
    .update({ deliverable_id: d })
    .eq("id", fileId)
    .eq("project_id", projectId);
  if (error) return { error: error.message };
  rp(projectId);
  return { ok: true };
}

/** Remove a final file: the row (under RLS, which is the check) then the bytes. */
export async function deleteDeliveryFile(projectId: string, fileId: string): Promise<Ok> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: row } = await supabase
    .from("delivery_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!row) return { error: "That file could not be found." };
  const { error } = await supabase.from("delivery_files").delete().eq("id", row.id);
  if (error) return { error: error.message };
  await discardUpload(row.storage_path);
  rp(projectId);
  return { ok: true };
}

/** A short-lived link for the studio to open or download one of its finals. */
export async function getDeliveryFileUrl(
  fileId: string,
  download = false
): Promise<{ url: string } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: row } = await supabase
    .from("delivery_files")
    .select("storage_path, file_name")
    .eq("id", fileId)
    .maybeSingle();
  if (!row) return { error: "That file could not be found." };
  const { data, error } = await assetStorage().createSignedUrl(
    row.storage_path,
    60 * 60,
    download ? { download: row.file_name } : undefined
  );
  if (error || !data?.signedUrl) return { error: "Could not open the file." };
  return { url: data.signedUrl };
}

// ---- The client's download link ---------------------------------------------

/**
 * The project's delivery link, created on first ask. A live link is returned
 * as it is; one that was turned off is reissued with a NEW token, so the old
 * address stays dead (the client portal's contract).
 */
export async function ensureDeliveryLink(
  projectId: string
): Promise<{ token: string } | { error: string }> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Only the studio can send the deliverables." };
  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { data: existing } = await supabase
    .from("delivery_links")
    .select("id, token, revoked_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing && !existing.revoked_at) return { token: existing.token };

  const token = generateReviewToken();
  const { error } = existing
    ? await supabase
        .from("delivery_links")
        .update({ token, revoked_at: null, last_viewed_at: null })
        .eq("id", existing.id)
    : await supabase.from("delivery_links").insert({
        studio_id: ctx.studio.id,
        project_id: projectId,
        token,
        created_by: ctx.userId,
      });
  if (error) {
    reportError("ensureDeliveryLink", error);
    return { error: error.message };
  }
  rp(projectId);
  return { token };
}

export async function revokeDeliveryLink(projectId: string): Promise<Ok> {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) return { error: "Only the studio can turn this link off." };
  const supabase = createClient();
  const { error } = await supabase
    .from("delivery_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .is("revoked_at", null);
  if (error) return { error: error.message };
  rp(projectId);
  return { ok: true };
}

export async function emailDeliveryLink(
  projectId: string,
  input: { to: string; subject: string; message?: string }
): Promise<Ok> {
  const ctx = await requireStudioContext();
  if (!emailConfigured()) return { error: "Email is not set up yet." };
  const to = input.to.trim();
  if (!isEmailAddress(to)) return { error: "Enter a valid recipient email." };

  const link = await ensureDeliveryLink(projectId);
  if ("error" in link) return { error: link.error };

  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle();
  const title = project?.title ?? "your project";
  const subject = input.subject.trim() || `${title}: your final deliverables`;
  const lines = input.message?.trim()
    ? [input.message.trim()]
    : [
        `${ctx.studio.name} has delivered the final files for ${title}.`,
        "Everything is in one place, ready to download. No login needed.",
      ];
  const { html, text } = renderEmail({
    heading: subject,
    lines,
    ctaLabel: "Download the deliverables",
    ctaUrl: `${siteOrigin()}/dl/${link.token}`,
  });
  const result = await sendEmail({ to, subject, html, text });
  if (!result.ok) return { error: result.error ?? "The email could not be sent." };
  return { ok: true };
}
