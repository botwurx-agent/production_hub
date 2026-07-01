"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PROJECT_STATUS_ORDER } from "@/lib/status";
import type { ProjectStatus } from "@/lib/database.types";

export type FormState = { error?: string } | null;

function isStatus(v: unknown): v is ProjectStatus {
  return PROJECT_STATUS_ORDER.includes(v as ProjectStatus);
}

export async function createProject(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the project a title." };

  const clientRaw = String(formData.get("client_id") ?? "");
  const client_id = clientRaw || null;
  const statusRaw = String(formData.get("status") ?? "pre_pro");
  const status: ProjectStatus = isStatus(statusRaw) ? statusRaw : "pre_pro";
  const due_date = String(formData.get("due_date") ?? "") || null;
  const shoot_date = String(formData.get("shoot_date") ?? "") || null;

  const { data, error } = await supabase
    .from("projects")
    .insert({
      studio_id: ctx.studio.id,
      title,
      client_id,
      status,
      due_date,
      shoot_date,
      owner_id: ctx.userId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
) {
  await requireStudioContext();
  if (!isStatus(status)) return;
  const supabase = createClient();
  await supabase.from("projects").update({ status }).eq("id", projectId);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

export async function updateProject(
  projectId: string,
  patch: {
    title?: string;
    client_id?: string | null;
    status?: ProjectStatus;
    due_date?: string | null;
    shoot_date?: string | null;
    notes?: string | null;
  }
) {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("projects").update(patch).eq("id", projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}
