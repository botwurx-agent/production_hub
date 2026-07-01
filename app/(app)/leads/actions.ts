"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as db } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { LEAD_STAGE_ORDER } from "@/lib/status";
import type { LeadStage } from "@/lib/database.types";

export type FormState = { error?: string } | null;

function isStage(v: unknown): v is LeadStage {
  return LEAD_STAGE_ORDER.includes(v as LeadStage);
}

export async function createLead(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const ctx = await requireStudioContext();
  const supabase = db();

  const company = String(formData.get("company") ?? "").trim();
  if (!company) return { error: "Company name is required." };
  const stageRaw = String(formData.get("stage") ?? "new");
  const stage: LeadStage = isStage(stageRaw) ? stageRaw : "new";

  const { error } = await supabase.from("leads").insert({
    studio_id: ctx.studio.id,
    company,
    stage,
    source: String(formData.get("source") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    owner_id: ctx.userId,
  });
  if (error) return { error: error.message };

  revalidatePath("/leads");
  return null;
}

export async function updateLeadStage(leadId: string, stage: LeadStage) {
  await requireStudioContext();
  if (!isStage(stage)) return;
  const supabase = db();
  await supabase.from("leads").update({ stage }).eq("id", leadId);
  revalidatePath("/leads");
}

export async function addLeadContact(
  leadId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const ctx = await requireStudioContext();
  const supabase = db();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Contact name is required." };

  const { error } = await supabase.from("contacts").insert({
    studio_id: ctx.studio.id,
    lead_id: leadId,
    name,
    role: String(formData.get("role") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/leads/${leadId}`);
  return null;
}

// Convert a won lead into a client: create the client, move the lead's
// contacts onto it, mark the lead converted, then land on the client so the
// operator can start a project in one continuous flow.
export async function convertLead(leadId: string) {
  const ctx = await requireStudioContext();
  const supabase = db();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, company, notes, converted_client_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return;

  if (lead.converted_client_id) {
    redirect(`/clients/${lead.converted_client_id}`);
  }

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      studio_id: ctx.studio.id,
      name: lead.company,
      type: "brand",
      notes: lead.notes,
    })
    .select("id")
    .single();
  if (error || !client) return;

  await supabase
    .from("contacts")
    .update({ client_id: client.id, lead_id: null })
    .eq("lead_id", leadId);

  await supabase
    .from("leads")
    .update({
      stage: "won",
      converted_client_id: client.id,
      converted_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  revalidatePath("/leads");
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}
