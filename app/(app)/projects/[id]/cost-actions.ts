"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { logWrite, reportError } from "@/lib/log";
import { generateReviewToken } from "@/lib/review-links";
import {
  costStatus,
  depositSplit,
  isCostDocType,
  MAX_COST_DOC_BYTES,
} from "@/lib/costs";
import { aiConfigured, extractInvoice, type InvoiceDraft } from "@/lib/ai";
import { getAttachmentBytes, getAccessToken } from "@/lib/gmail";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/budget`);
  revalidatePath(`/projects/${projectId}`);
}

export type CostInput = {
  vendor: string;
  description: string;
  amount: number;
  days: number | null;
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
    days:
      input.days !== null && Number.isFinite(input.days) && input.days > 0
        ? Math.round(input.days * 100) / 100
        : null,
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

/**
 * Drafts a cost from an invoice that arrived as a Gmail attachment, which is
 * how freelancers actually send them. Nothing is written and nothing is stored:
 * the bytes are fetched, read, and discarded, and the producer confirms the
 * result in the same modal as a hand-entered cost.
 *
 * The budget lines and roster come back with the draft because this is called
 * from the Communication module, which has no reason to have loaded either.
 */
export async function draftCostFromAttachment(
  projectId: string,
  gmailMessageId: string,
  attachmentId: string,
  filename: string,
  mimeType: string
): Promise<
  | { error: string }
  | {
      ok: true;
      draft: InvoiceDraft | null;
      contactId: string | null;
      vendorMatch: string | null;
      lines: { id: string; category: string; description: string }[];
      roster: {
        id: string;
        name: string;
        company: string | null;
        role: string | null;
        rate: number | null;
      }[];
    }
> {
  await requireStudioContext();
  const supabase = createClient();

  const [{ data: lines }, { data: roster }] = await Promise.all([
    supabase
      .from("budget_lines")
      .select("id, category, description")
      .eq("project_id", projectId)
      .order("position", { ascending: true }),
    supabase
      .from("contacts")
      .select("id, name, company, role, rate")
      .eq("project_id", projectId)
      .order("name", { ascending: true }),
  ]);

  const context = {
    lines: lines ?? [],
    roster: (roster ?? []) as {
      id: string;
      name: string;
      company: string | null;
      role: string | null;
      rate: number | null;
    }[],
  };

  // Without a provider the form still opens, just empty. The producer types the
  // cost in and the invoice is still filed against it, which is most of the
  // value; extraction only removes the typing.
  if (!aiConfigured() || !isCostDocType(mimeType)) {
    return { ok: true, draft: null, contactId: null, vendorMatch: null, ...context };
  }

  let bytes: Buffer;
  try {
    bytes = await getAttachmentForCost(supabase, gmailMessageId, attachmentId);
  } catch (e) {
    reportError("draftCostFromAttachment/gmail", e);
    return { error: "Could not open that attachment from Gmail." };
  }
  if (bytes.length > MAX_COST_DOC_BYTES) {
    return { ok: true, draft: null, contactId: null, vendorMatch: null, ...context };
  }

  let draft: InvoiceDraft;
  try {
    draft = await extractInvoice(
      { base64: bytes.toString("base64"), mediaType: mimeType, fileName: filename },
      context.lines.map((l) => ({
        id: l.id,
        label: `${l.category || "General"}: ${l.description || "Untitled"}`,
      }))
    );
  } catch (e) {
    reportError("draftCostFromAttachment/ai", e);
    return { ok: true, draft: null, contactId: null, vendorMatch: null, ...context };
  }

  if (draft.unreadable) {
    return { ok: true, draft: null, contactId: null, vendorMatch: null, ...context };
  }

  const match = draft.vendor ? matchVendor(draft.vendor, context.roster) : null;
  return {
    ok: true,
    draft,
    contactId: match?.id ?? null,
    vendorMatch: match?.name ?? null,
    ...context,
  };
}

/**
 * Files the Gmail attachment against a cost that was just saved. The bytes are
 * fetched a second time rather than being parked in storage during the draft
 * step, so abandoning the form leaves no orphaned invoice behind.
 */
export async function attachEmailInvoice(
  projectId: string,
  costId: string,
  gmailMessageId: string,
  attachmentId: string,
  filename: string,
  mimeType: string
): Promise<{ error: string } | { ok: true }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  let bytes: Buffer;
  try {
    bytes = await getAttachmentForCost(supabase, gmailMessageId, attachmentId);
  } catch (e) {
    reportError("attachEmailInvoice/gmail", e);
    return { error: "Could not fetch that attachment from Gmail." };
  }

  const safeName = filename.replace(/[^\w.\-]+/g, "_").slice(-120) || "invoice";
  const path = `${ctx.studio.id}/costs/${projectId}/${generateReviewToken()}_${safeName}`;
  const { error: upErr } = await supabase.storage
    .from("assets")
    .upload(path, bytes, {
      contentType: mimeType || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    reportError("attachEmailInvoice.upload", upErr);
    return { error: "Could not store that attachment." };
  }

  const { error } = await supabase
    .from("project_costs")
    .update({
      storage_path: path,
      file_name: filename.slice(0, 200),
      updated_at: new Date().toISOString(),
    })
    .eq("id", costId);
  if (error) {
    await supabase.storage.from("assets").remove([path]);
    reportError("attachEmailInvoice/project_costs", error);
    return { error: "Could not attach that file to the cost." };
  }
  rp(projectId);
  return { ok: true };
}

async function getAttachmentForCost(
  supabase: SupabaseClient<Database>,
  gmailMessageId: string,
  attachmentId: string
): Promise<Buffer> {
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry, email, scope")
    .eq("provider", "google")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!account) throw new Error("Gmail is not connected.");
  const token = await getAccessToken(supabase, account);
  return getAttachmentBytes(token, gmailMessageId, attachmentId);
}

// --- Payment schedule --------------------------------------------------------
// A cost is the commitment; these are the payments against it. Everything here
// inherits project_costs' is_studio_member gating via cost_payments' own
// policy, so a collaborator cannot read or write a payment.

export type PaymentInput = {
  label: string;
  amount: number;
  dueDate: string | null;
  paid: boolean;
  method: string | null;
  notes: string | null;
};

function cleanPayment(input: PaymentInput) {
  return {
    label: input.label.trim().slice(0, 120),
    amount: Number.isFinite(input.amount) ? Math.round(input.amount * 100) / 100 : 0,
    due_date: input.dueDate || null,
    method: input.method?.trim().slice(0, 60) || null,
    notes: input.notes?.trim().slice(0, 500) || null,
  };
}

export async function addPayment(
  projectId: string,
  costId: string,
  input: PaymentInput
): Promise<{ error: string } | { ok: true }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { error } = await supabase.from("cost_payments").insert({
    studio_id: ctx.studio.id,
    cost_id: costId,
    created_by: ctx.userId,
    ...cleanPayment(input),
    paid_at: input.paid ? new Date().toISOString() : null,
  });
  if (error) {
    reportError("addPayment/cost_payments", error);
    return { error: "Could not add that payment." };
  }
  rp(projectId);
  return { ok: true };
}

/**
 * Builds the whole schedule in one go from a deposit percentage, which is how
 * a vendor states it ("25% up front, balance on delivery"). The balance is the
 * remainder rather than a second percentage, so the two always add back to the
 * commitment exactly.
 */
export async function scheduleDeposit(
  projectId: string,
  costId: string,
  opts: {
    percent: number;
    depositDue: string | null;
    balanceDue: string | null;
    depositPaid: boolean;
  }
): Promise<{ error: string } | { ok: true }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: cost } = await supabase
    .from("project_costs")
    .select("amount")
    .eq("id", costId)
    .maybeSingle();
  if (!cost) return { error: "That cost no longer exists." };

  const split = depositSplit(Number(cost.amount), opts.percent);
  if (!split) {
    return { error: "Set the cost's total amount first, and a deposit between 1 and 99 percent." };
  }

  // Replacing rather than appending: this action builds a whole schedule, and
  // running it twice should not leave the old halves behind alongside the new.
  const { error: delErr } = await supabase
    .from("cost_payments")
    .delete()
    .eq("cost_id", costId);
  if (delErr) {
    reportError("scheduleDeposit.clear", delErr);
    return { error: "Could not replace the existing schedule." };
  }

  const { error } = await supabase.from("cost_payments").insert([
    {
      studio_id: ctx.studio.id,
      cost_id: costId,
      created_by: ctx.userId,
      label: `Deposit ${opts.percent}%`,
      amount: split.deposit,
      due_date: opts.depositDue || null,
      paid_at: opts.depositPaid ? new Date().toISOString() : null,
    },
    {
      studio_id: ctx.studio.id,
      cost_id: costId,
      created_by: ctx.userId,
      label: "Balance",
      amount: split.balance,
      due_date: opts.balanceDue || null,
      paid_at: null,
    },
  ]);
  if (error) {
    reportError("scheduleDeposit/cost_payments", error);
    return { error: "Could not build that schedule." };
  }
  rp(projectId);
  return { ok: true };
}

/** Toggles a payment between scheduled and sent. */
export async function setPaymentPaid(
  projectId: string,
  paymentId: string,
  paid: boolean
): Promise<{ error: string } | { ok: true }> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("cost_payments")
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq("id", paymentId);
  if (error) {
    reportError("setPaymentPaid/cost_payments", error);
    return { error: "Could not update that payment." };
  }
  rp(projectId);
  return { ok: true };
}

export async function deletePayment(
  projectId: string,
  paymentId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await logWrite(
    "deletePayment/cost_payments",
    supabase.from("cost_payments").delete().eq("id", paymentId)
  );
  rp(projectId);
}
