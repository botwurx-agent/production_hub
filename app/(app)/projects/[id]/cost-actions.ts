"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { logWrite, reportError } from "@/lib/log";
import { generateReviewToken } from "@/lib/review-links";
import { costStatus, MAX_COST_DOC_BYTES } from "@/lib/costs";

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath(`/projects/${projectId}`);
}

export type CostInput = {
  vendor: string;
  description: string;
  amount: number;
  budgetLineId: string | null;
  contactId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  status: string;
  notes: string | null;
};

/**
 * Every write here goes through requireStudioContext, and project_costs is
 * gated on is_studio_member, so a project collaborator is refused at the DB
 * even if they somehow reached the action.
 */
function clean(input: CostInput) {
  return {
    vendor: input.vendor.trim().slice(0, 200),
    description: input.description.trim().slice(0, 500),
    // Money is never trusted from the client: a NaN or an Infinity would
    // otherwise poison every total on the page.
    amount: Number.isFinite(input.amount) ? Math.round(input.amount * 100) / 100 : 0,
    budget_line_id: input.budgetLineId || null,
    contact_id: input.contactId || null,
    invoice_number: input.invoiceNumber?.trim().slice(0, 100) || null,
    invoice_date: input.invoiceDate || null,
    due_date: input.dueDate || null,
    status: costStatus(input.status),
    notes: input.notes?.trim().slice(0, 2000) || null,
  };
}

export async function addCost(
  projectId: string,
  input: CostInput
): Promise<{ error: string } | { ok: true; id: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("project_costs")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      created_by: ctx.userId,
      ...clean(input),
    })
    .select("id")
    .single();

  if (error || !data) {
    reportError("addCost/project_costs", error);
    return { error: "Could not save that cost. Try again." };
  }
  rp(projectId);
  return { ok: true, id: data.id };
}

export async function updateCost(
  projectId: string,
  costId: string,
  input: CostInput
): Promise<{ error: string } | { ok: true }> {
  await requireStudioContext();
  const supabase = createClient();

  const { error } = await supabase
    .from("project_costs")
    .update({ ...clean(input), updated_at: new Date().toISOString() })
    .eq("id", costId);

  if (error) {
    reportError("updateCost/project_costs", error);
    return { error: "Could not save that change." };
  }
  rp(projectId);
  return { ok: true };
}

/** The one-field write behind the status chip, so it does not need the modal. */
export async function setCostStatus(
  projectId: string,
  costId: string,
  status: string
): Promise<{ error: string } | { ok: true }> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("project_costs")
    .update({ status: costStatus(status), updated_at: new Date().toISOString() })
    .eq("id", costId);
  if (error) {
    reportError("setCostStatus/project_costs", error);
    return { error: "Could not update that status." };
  }
  rp(projectId);
  return { ok: true };
}

export async function deleteCost(
  projectId: string,
  costId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();

  // Read the path first: once the row is gone we have no way to find the blob,
  // and an orphaned invoice PDF sitting in storage is exactly the kind of
  // financial document that should not outlive its record.
  const { data: cost } = await supabase
    .from("project_costs")
    .select("storage_path")
    .eq("id", costId)
    .maybeSingle();

  await logWrite(
    "deleteCost/project_costs",
    supabase.from("project_costs").delete().eq("id", costId)
  );
  if (cost?.storage_path) {
    await supabase.storage.from("assets").remove([cost.storage_path]);
  }
  rp(projectId);
}

/**
 * Attaches the invoice document to an existing cost row. Separate from addCost
 * so the form can save without a file, and so a file can be added or replaced
 * later without retyping the row.
 */
export async function uploadCostDoc(
  projectId: string,
  costId: string,
  formData: FormData
): Promise<{ error: string } | { ok: true }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file selected." };
  }
  if (file.size > MAX_COST_DOC_BYTES) {
    return { error: "That file is too large (8MB max for an invoice)." };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "invoice";
  const path = `${ctx.studio.id}/costs/${projectId}/${generateReviewToken()}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("assets")
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    reportError("uploadCostDoc.upload", upErr);
    return { error: "Could not upload that file. Try again." };
  }

  // Replacing a document should not leave the old one behind.
  const { data: prev } = await supabase
    .from("project_costs")
    .select("storage_path")
    .eq("id", costId)
    .maybeSingle();

  const { error } = await supabase
    .from("project_costs")
    .update({
      storage_path: path,
      file_name: file.name.slice(0, 200),
      updated_at: new Date().toISOString(),
    })
    .eq("id", costId);

  if (error) {
    await supabase.storage.from("assets").remove([path]);
    reportError("uploadCostDoc/project_costs", error);
    return { error: "Could not attach that file." };
  }
  if (prev?.storage_path && prev.storage_path !== path) {
    await supabase.storage.from("assets").remove([prev.storage_path]);
  }
  rp(projectId);
  return { ok: true };
}

/**
 * Signs the stored invoice on demand rather than signing every document on
 * page load: most rows are never opened, and a short-lived URL is safer for a
 * document carrying someone's rates and bank details.
 */
export async function getCostDocUrl(
  costId: string
): Promise<{ url: string } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();

  const { data: cost } = await supabase
    .from("project_costs")
    .select("storage_path")
    .eq("id", costId)
    .maybeSingle();
  if (!cost?.storage_path) return { error: "No document on this cost." };

  const { data, error } = await supabase.storage
    .from("assets")
    .createSignedUrl(cost.storage_path, 60 * 10);
  if (error || !data?.signedUrl) {
    reportError("getCostDocUrl.sign", error);
    return { error: "Could not open that document." };
  }
  return { url: data.signedUrl };
}
