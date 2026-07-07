"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { generateReviewToken } from "@/lib/review-links";

export type CallSheetState = { error?: string } | null;

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
  title?: string | null;
  status?: string;
};

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/callsheet`);
  revalidatePath(`/projects/${projectId}/production/callsheet`);
  revalidatePath(`/projects/${projectId}`);
}

// Create a new call sheet for the project (multiple are allowed).
export async function createCallSheet(
  projectId: string,
  title?: string
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { data: last } = await supabase
    .from("call_sheets")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("call_sheets")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      title: title?.trim() || "Call sheet",
      status: "draft",
      position: (last?.position ?? -1) + 1,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  rp(projectId);
  return { id: data.id };
}

export async function saveCallSheet(
  projectId: string,
  callSheetId: string,
  patch: CallSheetPatch
): Promise<CallSheetState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("call_sheets")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", callSheetId);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function renameCallSheet(
  projectId: string,
  callSheetId: string,
  title: string
): Promise<CallSheetState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("call_sheets")
    .update({ title: title.trim() || "Call sheet" })
    .eq("id", callSheetId);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function setCallSheetStatus(
  projectId: string,
  callSheetId: string,
  status: string
): Promise<CallSheetState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("call_sheets")
    .update({ status })
    .eq("id", callSheetId);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

// Persist the block layout (order / hidden / custom text blocks).
export async function saveCallSheetLayout(
  projectId: string,
  callSheetId: string,
  layout: unknown
): Promise<CallSheetState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("call_sheets")
    .update({ layout: layout as never, updated_at: new Date().toISOString() })
    .eq("id", callSheetId);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function saveCallSheetAccent(
  projectId: string,
  callSheetId: string,
  accent: string | null
): Promise<CallSheetState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("call_sheets")
    .update({ accent })
    .eq("id", callSheetId);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function deleteCallSheet(
  projectId: string,
  callSheetId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("call_sheets").delete().eq("id", callSheetId);
  rp(projectId);
}

// ---- Entries (cast / crew rows on a specific call sheet) --------------------

export async function addCallSheetEntry(
  projectId: string,
  callSheetId: string,
  kind: "cast" | "crew" = "crew"
): Promise<CallSheetState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("call_sheet_entries")
    .select("position")
    .eq("call_sheet_id", callSheetId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("call_sheet_entries").insert({
    studio_id: ctx.studio.id,
    call_sheet_id: callSheetId,
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
): Promise<CallSheetState> {
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

// ---- Recipients (send + track) ---------------------------------------------

export async function addCallSheetRecipient(
  projectId: string,
  callSheetId: string,
  name: string,
  email?: string
): Promise<{ token: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const clean = name.trim();
  if (!clean) return { error: "Add a name." };
  const supabase = createClient();
  const token = generateReviewToken();
  const { error } = await supabase.from("call_sheet_recipients").insert({
    studio_id: ctx.studio.id,
    call_sheet_id: callSheetId,
    name: clean,
    email: email?.trim() || null,
    token,
  });
  if (error) return { error: error.message };
  rp(projectId);
  return { token };
}

// Add several recipients at once (e.g. picked from the project contacts list).
export async function addCallSheetRecipients(
  projectId: string,
  callSheetId: string,
  people: { name: string; email?: string | null }[]
): Promise<{ added: number } | { error: string }> {
  const ctx = await requireStudioContext();
  const rows = people
    .map((p) => ({ name: p.name.trim(), email: p.email?.trim() || null }))
    .filter((p) => p.name)
    .map((p) => ({
      studio_id: ctx.studio.id,
      call_sheet_id: callSheetId,
      name: p.name,
      email: p.email,
      token: generateReviewToken(),
    }));
  if (rows.length === 0) return { added: 0 };

  const supabase = createClient();
  const { error } = await supabase.from("call_sheet_recipients").insert(rows);
  if (error) return { error: error.message };
  rp(projectId);
  return { added: rows.length };
}

export async function deleteCallSheetRecipient(
  projectId: string,
  recipientId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("call_sheet_recipients").delete().eq("id", recipientId);
  rp(projectId);
}
