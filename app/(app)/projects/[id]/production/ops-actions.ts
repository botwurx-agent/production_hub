"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";

export type OpsState = { error?: string } | null;

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/gear`);
  revalidatePath(`/projects/${projectId}/delivery`);
  revalidatePath(`/projects/${projectId}`);
}

// ---- Gear & crew ------------------------------------------------------------

export async function addGearItem(
  projectId: string,
  category = "Camera"
): Promise<OpsState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("gear_items")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("gear_items").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    position: (last?.position ?? -1) + 1,
    category,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function updateGearItem(
  projectId: string,
  id: string,
  patch: { category?: string; name?: string; qty?: number; confirmed?: boolean; notes?: string }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("gear_items").update(patch).eq("id", id);
  rp(projectId);
}

export async function deleteGearItem(projectId: string, id: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("gear_items").delete().eq("id", id);
  rp(projectId);
}

export async function renameGearCategory(
  projectId: string,
  from: string,
  to: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("gear_items")
    .update({ category: to || "Other" })
    .eq("project_id", projectId)
    .eq("category", from);
  rp(projectId);
}

// ---- Deliverables -----------------------------------------------------------

export async function addDeliverable(projectId: string): Promise<OpsState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("deliverables")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("deliverables").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    position: (last?.position ?? -1) + 1,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function updateDeliverable(
  projectId: string,
  id: string,
  patch: {
    name?: string;
    spec?: string;
    due_date?: string | null;
    status?: string;
    link?: string;
    notes?: string;
  }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("deliverables").update(patch).eq("id", id);
  rp(projectId);
}

export async function deleteDeliverable(projectId: string, id: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("deliverables").delete().eq("id", id);
  rp(projectId);
}

// ---- Billing ----------------------------------------------------------------

export async function saveBilling(
  projectId: string,
  patch: { status?: string; amount?: number | null; invoice_no?: string | null; notes?: string | null }
): Promise<OpsState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase.from("project_billing").upsert(
    {
      studio_id: ctx.studio.id,
      project_id: projectId,
      ...patch,
      updated_at: new Date().toISOString(),
      created_by: ctx.userId,
    },
    { onConflict: "project_id" }
  );
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}
