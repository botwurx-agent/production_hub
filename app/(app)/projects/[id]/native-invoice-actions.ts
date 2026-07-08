"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import type { BillingProfile } from "@/lib/database.types";

export type DocState = { error?: string; id?: string } | null;

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/invoices`);
  revalidatePath(`/projects/${projectId}`);
}

// Load the studio's billing profile, creating a default row on first use.
async function ensureProfile(
  supabase: ReturnType<typeof createClient>,
  studioId: string,
): Promise<BillingProfile> {
  const { data } = await supabase
    .from("billing_profiles")
    .select("*")
    .eq("studio_id", studioId)
    .maybeSingle();
  if (data) return data as BillingProfile;
  const { data: created } = await supabase
    .from("billing_profiles")
    .insert({ studio_id: studioId })
    .select("*")
    .single();
  return created as BillingProfile;
}

export async function createBillingDocument(
  projectId: string,
  kind: "invoice" | "estimate",
): Promise<DocState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const profile = await ensureProfile(supabase, ctx.studio.id);

  const isEstimate = kind === "estimate";
  const n = isEstimate ? profile.next_estimate_no : profile.next_invoice_no;
  const prefix = isEstimate ? profile.estimate_prefix : profile.invoice_prefix;
  const number = `${prefix}${n}`;

  await supabase
    .from("billing_profiles")
    .update(
      isEstimate ? { next_estimate_no: n + 1 } : { next_invoice_no: n + 1 },
    )
    .eq("id", profile.id);

  const { data: doc, error } = await supabase
    .from("billing_documents")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      kind,
      number,
      terms: profile.default_terms,
      notes: profile.default_notes,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !doc) return { error: error?.message ?? "Could not create document." };

  // Seed one empty line so the editor isn't blank.
  await supabase.from("billing_document_lines").insert({
    document_id: doc.id,
    studio_id: ctx.studio.id,
    position: 0,
  });

  rp(projectId);
  return { id: doc.id };
}

export async function updateBillingDocument(
  projectId: string,
  id: string,
  patch: {
    number?: string;
    status?: string;
    issue_date?: string;
    due_date?: string | null;
    bill_to_name?: string | null;
    bill_to_company?: string | null;
    bill_to_email?: string | null;
    bill_to_address?: string | null;
    reference?: string | null;
    discount?: number;
    notes?: string | null;
    terms?: string | null;
  },
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("billing_documents").update(patch).eq("id", id);
  rp(projectId);
}

export async function setDocumentRecipient(
  projectId: string,
  id: string,
  contactId: string,
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: c } = await supabase
    .from("contacts")
    .select("name, email, company")
    .eq("id", contactId)
    .maybeSingle();
  if (c) {
    await supabase
      .from("billing_documents")
      .update({
        bill_to_name: c.name,
        bill_to_email: c.email,
        bill_to_company: c.company,
      })
      .eq("id", id);
  }
  rp(projectId);
}

export async function deleteBillingDocument(
  projectId: string,
  id: string,
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("billing_documents").delete().eq("id", id);
  rp(projectId);
}

export async function addDocLine(
  projectId: string,
  documentId: string,
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("billing_document_lines")
    .select("position")
    .eq("document_id", documentId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("billing_document_lines")
    .insert({
      document_id: documentId,
      studio_id: ctx.studio.id,
      position: (last?.position ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add line." };
  rp(projectId);
  return { id: data.id };
}

export async function updateDocLine(
  projectId: string,
  lineId: string,
  patch: { description?: string; rate?: number; qty?: number; tax_rate?: number },
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("billing_document_lines").update(patch).eq("id", lineId);
  rp(projectId);
}

export async function deleteDocLine(
  projectId: string,
  lineId: string,
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("billing_document_lines").delete().eq("id", lineId);
  rp(projectId);
}
