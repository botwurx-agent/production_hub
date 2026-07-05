"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";

export type BudgetState = { error?: string } | null;

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/production`);
}

export async function addBudgetLine(
  projectId: string,
  category = "General"
): Promise<BudgetState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: last } = await supabase
    .from("budget_lines")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("budget_lines").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    position: (last?.position ?? -1) + 1,
    category,
    description: "",
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function updateBudgetLine(
  projectId: string,
  id: string,
  patch: {
    category?: string;
    description?: string;
    estimated?: number;
    actual?: number;
    notes?: string;
  }
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("budget_lines").update(patch).eq("id", id);
  rp(projectId);
}

export async function renameBudgetCategory(
  projectId: string,
  from: string,
  to: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("budget_lines")
    .update({ category: to || "General" })
    .eq("project_id", projectId)
    .eq("category", from);
  rp(projectId);
}

export async function deleteBudgetLine(
  projectId: string,
  id: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("budget_lines").delete().eq("id", id);
  rp(projectId);
}
