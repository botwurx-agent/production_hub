"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";

export type ProdState = { error?: string } | null;

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/production`);
}

// ---- Shots ------------------------------------------------------------------

export async function addShot(projectId: string): Promise<ProdState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("shots")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("shots").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    position: (last?.position ?? -1) + 1,
    description: "",
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function updateShot(
  projectId: string,
  id: string,
  patch: {
    scene?: string;
    description?: string;
    setup?: string;
    notes?: string;
    status?: string;
  }
): Promise<ProdState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase.from("shots").update(patch).eq("id", id);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function deleteShot(projectId: string, id: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("shots").delete().eq("id", id);
  rp(projectId);
}

// Swap positions of two shots (used by up/down reordering).
export async function swapShots(
  projectId: string,
  a: { id: string; position: number },
  b: { id: string; position: number }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("shots").update({ position: b.position }).eq("id", a.id);
  await supabase.from("shots").update({ position: a.position }).eq("id", b.id);
  rp(projectId);
}

// ---- Call sheet -------------------------------------------------------------

export type CallSheetPatch = {
  shoot_date?: string | null;
  call_time?: string | null;
  location?: string | null;
  notes?: string | null;
  production_title?: string | null;
  day_of?: string | null;
  crew_call?: string | null;
  shoot_call?: string | null;
  lunch?: string | null;
  wrap?: string | null;
  weather?: string | null;
  sunrise?: string | null;
  sunset?: string | null;
  parking?: string | null;
  hospital?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  company_website?: string | null;
  company_phone?: string | null;
  producer?: string | null;
  producer_phone?: string | null;
  director?: string | null;
  director_phone?: string | null;
  pm?: string | null;
  pm_phone?: string | null;
  breakfast?: string | null;
};

export async function saveCallSheet(
  projectId: string,
  patch: CallSheetPatch
): Promise<ProdState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase.from("call_sheets").upsert(
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

async function ensureCallSheet(
  projectId: string
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("call_sheets")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing) return { id: existing.id };
  const { data, error } = await supabase
    .from("call_sheets")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function addCallSheetEntry(
  projectId: string,
  kind: "cast" | "crew" = "crew"
): Promise<ProdState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const cs = await ensureCallSheet(projectId);
  if ("error" in cs) return cs;
  const { data: last } = await supabase
    .from("call_sheet_entries")
    .select("position")
    .eq("call_sheet_id", cs.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("call_sheet_entries").insert({
    studio_id: ctx.studio.id,
    call_sheet_id: cs.id,
    position: (last?.position ?? -1) + 1,
    name: "",
    kind,
  });
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function updateCallSheetEntry(
  projectId: string,
  id: string,
  patch: { name?: string; role?: string; call_time?: string; contact?: string }
): Promise<ProdState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("call_sheet_entries")
    .update(patch)
    .eq("id", id);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function deleteCallSheetEntry(
  projectId: string,
  id: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("call_sheet_entries").delete().eq("id", id);
  rp(projectId);
}
