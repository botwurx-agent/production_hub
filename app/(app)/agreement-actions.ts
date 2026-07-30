"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { logWrite, reportError } from "@/lib/log";
import { generateReviewToken } from "@/lib/review-links";
import { agreementDirection, agreementKind } from "@/lib/agreements";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/attachment-limits";

/**
 * Agreements hang off either an account or a project, so revalidation covers
 * both rather than guessing which page the caller came from.
 */
function rp(opts: { projectId?: string | null; clientId?: string | null }) {
  if (opts.projectId) {
    revalidatePath(`/projects/${opts.projectId}/agreements`);
    revalidatePath(`/projects/${opts.projectId}`);
  }
  if (opts.clientId) revalidatePath(`/clients/${opts.clientId}`);
}

export type AgreementInput = {
  kind: string;
  direction: string;
  title: string;
  reference: string | null;
  counterparty: string | null;
  effectiveDate: string | null;
  expiresDate: string | null;
  ourSignerName: string | null;
  ourSignedAt: string | null;
  theirSignerName: string | null;
  theirSignedAt: string | null;
  value: number | null;
  notes: string | null;
  parentId: string | null;
  clientId: string | null;
  projectId: string | null;
};

function clean(input: AgreementInput) {
  return {
    kind: agreementKind(input.kind),
    direction: agreementDirection(input.direction),
    title: input.title.trim().slice(0, 300),
    reference: input.reference?.trim().slice(0, 100) || null,
    counterparty: input.counterparty?.trim().slice(0, 200) || null,
    effective_date: input.effectiveDate || null,
    expires_date: input.expiresDate || null,
    our_signer_name: input.ourSignerName?.trim().slice(0, 200) || null,
    our_signed_at: input.ourSignedAt || null,
    their_signer_name: input.theirSignerName?.trim().slice(0, 200) || null,
    their_signed_at: input.theirSignedAt || null,
    // Never trust a money figure from the client: NaN would poison any total.
    value:
      input.value !== null && Number.isFinite(input.value) && input.value >= 0
        ? Math.round(input.value * 100) / 100
        : null,
    notes: input.notes?.trim().slice(0, 4000) || null,
    parent_id: input.parentId || null,
    client_id: input.clientId || null,
    project_id: input.projectId || null,
  };
}

export async function addAgreement(
  input: AgreementInput
): Promise<{ error: string } | { ok: true; id: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("agreements")
    .insert({ studio_id: ctx.studio.id, created_by: ctx.userId, ...clean(input) })
    .select("id")
    .single();

  if (error || !data) {
    reportError("addAgreement/agreements", error);
    return { error: "Could not save that agreement. Try again." };
  }
  rp(input);
  return { ok: true, id: data.id };
}

export async function updateAgreement(
  id: string,
  input: AgreementInput
): Promise<{ error: string } | { ok: true }> {
  await requireStudioContext();
  const supabase = createClient();

  const { error } = await supabase
    .from("agreements")
    .update({ ...clean(input), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    reportError("updateAgreement/agreements", error);
    return { error: "Could not save that change." };
  }
  rp(input);
  return { ok: true };
}

export async function deleteAgreement(
  id: string,
  scope: { projectId?: string | null; clientId?: string | null }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();

  // Read the path first: once the row is gone there is no way to find the blob,
  // and a signed contract should not outlive its record in storage.
  const { data: row } = await supabase
    .from("agreements")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  await logWrite(
    "deleteAgreement/agreements",
    supabase.from("agreements").delete().eq("id", id)
  );
  if (row?.storage_path) {
    await supabase.storage.from("assets").remove([row.storage_path]);
  }
  rp(scope);
}

/**
 * Stores the signed PDF against an agreement. Separate from addAgreement so a
 * record can exist before the countersigned copy comes back, which is the
 * normal sequence: you sign, then wait for theirs.
 */
export async function uploadAgreementFile(
  id: string,
  scope: { projectId?: string | null; clientId?: string | null },
  formData: FormData
): Promise<{ error: string } | { ok: true }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file selected." };
  }
  // Crosses a Server Action, so the ~4.5MB request body is the real ceiling.
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `That file is ${formatBytes(file.size)}, over the ${formatBytes(
        MAX_UPLOAD_BYTES
      )} upload limit.`,
    };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "agreement";
  const path = `${ctx.studio.id}/agreements/${generateReviewToken()}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("assets")
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    reportError("uploadAgreementFile.upload", upErr);
    return { error: "Could not upload that file. Try again." };
  }

  const { data: prev } = await supabase
    .from("agreements")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("agreements")
    .update({
      storage_path: path,
      file_name: file.name.slice(0, 200),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    await supabase.storage.from("assets").remove([path]);
    reportError("uploadAgreementFile/agreements", error);
    return { error: "Could not attach that file." };
  }
  // Replacing a document should not leave the old one behind.
  if (prev?.storage_path && prev.storage_path !== path) {
    await supabase.storage.from("assets").remove([prev.storage_path]);
  }
  rp(scope);
  return { ok: true };
}

/**
 * Signs the stored document on demand rather than on page load: most rows are
 * never opened, and a short-lived URL suits a contract better than a long one.
 */
export async function getAgreementFileUrl(
  id: string
): Promise<{ url: string } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();

  const { data: row } = await supabase
    .from("agreements")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!row?.storage_path) return { error: "No document on this agreement." };

  const { data, error } = await supabase.storage
    .from("assets")
    .createSignedUrl(row.storage_path, 60 * 10);
  if (error || !data?.signedUrl) {
    reportError("getAgreementFileUrl.sign", error);
    return { error: "Could not open that document." };
  }
  return { url: data.signedUrl };
}
