"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { logWrite, reportError } from "@/lib/log";
import { generateReviewToken } from "@/lib/review-links";
import { costStatus, isCostDocType, MAX_COST_DOC_BYTES } from "@/lib/costs";
import { aiConfigured, extractInvoice, type InvoiceDraft } from "@/lib/ai";

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
    return { error: "That file is too large (4MB max for an invoice)." };
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

/**
 * Reads an uploaded invoice into a DRAFT for the add-cost form.
 *
 * This never writes anything. Extraction fills a form the producer then checks
 * and submits, the same contract as the composer's Polish button: the model
 * assists, the human commits. A financial record is never created from a model
 * reading a document unattended.
 */
export async function extractInvoiceDraft(
  projectId: string,
  formData: FormData
): Promise<
  | { error: string }
  | { ok: true; draft: InvoiceDraft; contactId: string | null; vendorMatch: string | null }
> {
  await requireStudioContext();
  if (!aiConfigured()) {
    return { error: "No AI provider is set up, so invoices cannot be read here." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file selected." };
  }
  if (!isCostDocType(file.type)) {
    return { error: "Only a PDF or a photo of an invoice can be read." };
  }
  if (file.size > MAX_COST_DOC_BYTES) {
    return { error: "That file is too large to read (4MB max)." };
  }

  const supabase = createClient();
  // The line list is passed to the model so it can suggest a home for the cost,
  // and is also the whitelist the returned id is checked against.
  const { data: lines } = await supabase
    .from("budget_lines")
    .select("id, category, description")
    .eq("project_id", projectId);

  const budgetLines = (lines ?? []).map((l) => ({
    id: l.id,
    label: `${l.category || "General"}: ${l.description || "Untitled"}`,
  }));

  let draft: InvoiceDraft;
  try {
    draft = await extractInvoice(
      {
        base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mediaType: file.type,
        fileName: file.name,
      },
      budgetLines
    );
  } catch (e) {
    reportError("extractInvoiceDraft/ai", e);
    return { error: "Could not read that invoice. Fill the form in by hand." };
  }

  if (draft.unreadable) {
    return { error: "That did not look like an invoice. Fill the form in by hand." };
  }

  // Vendor matching is deliberately deterministic rather than another model
  // call: it is a string comparison against a list we already hold, so it
  // should be exact, repeatable, and free.
  const { data: roster } = await supabase
    .from("contacts")
    .select("id, name, company")
    .eq("project_id", projectId);

  const match = draft.vendor ? matchVendor(draft.vendor, roster ?? []) : null;

  return {
    ok: true,
    draft,
    contactId: match?.id ?? null,
    vendorMatch: match?.name ?? null,
  };
}

/**
 * Finds the roster contact an invoice came from. Exact match first, then a
 * containment check either way, so "Jane Doe" matches "Jane Doe Lighting LLC"
 * and vice versa. Anything looser would start guessing, and filing a cost
 * against the wrong crew member is worse than leaving it unassigned.
 */
function matchVendor(
  vendor: string,
  roster: { id: string; name: string | null; company: string | null }[]
): { id: string; name: string } | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const target = norm(vendor);
  if (!target) return null;

  const candidates = roster.flatMap((r) =>
    [r.name, r.company]
      .filter((v): v is string => Boolean(v?.trim()))
      .map((v) => ({ id: r.id, display: r.name ?? v, key: norm(v) }))
  );

  const exact = candidates.find((c) => c.key === target);
  if (exact) return { id: exact.id, name: exact.display };

  // Require a few characters before allowing containment, or a two-letter
  // company name would match half the roster.
  const partial = candidates.find(
    (c) =>
      c.key.length >= 4 &&
      target.length >= 4 &&
      (c.key.includes(target) || target.includes(c.key))
  );
  return partial ? { id: partial.id, name: partial.display } : null;
}
