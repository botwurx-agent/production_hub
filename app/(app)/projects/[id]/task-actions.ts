"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";

export type TaskResult = { error?: string } | null;

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath("/dashboard");
}

export async function addProjectTask(
  projectId: string,
  title: string,
  dueDate?: string | null
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const clean = title.trim();
  if (!clean) return { error: "Add a task title." };

  const supabase = createClient();
  // Derive studio_id from the project itself (RLS-gated read) so a task always
  // carries the project's real studio, not the caller's context.
  const { data: project } = await supabase
    .from("projects")
    .select("studio_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { data, error } = await supabase
    .from("project_tasks")
    .insert({
      studio_id: project.studio_id,
      project_id: projectId,
      title: clean,
      due_date: dueDate || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) {
    reportError("addProjectTask", error);
    return { error: "Could not add the task. Try again." };
  }
  refresh(projectId);
  return { id: data.id };
}

export async function toggleProjectTask(
  projectId: string,
  id: string,
  done: boolean
): Promise<TaskResult> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("project_tasks")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    reportError("toggleProjectTask", error);
    return { error: "Could not update the task. Try again." };
  }
  refresh(projectId);
  return null;
}

export async function updateProjectTask(
  projectId: string,
  id: string,
  patch: { title?: string; due_date?: string | null; notes?: string | null }
): Promise<TaskResult> {
  await requireStudioContext();
  const clean: typeof patch = { ...patch };
  if (clean.title !== undefined) {
    const t = clean.title.trim();
    if (!t) return { error: "Task title can't be empty." };
    clean.title = t;
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("project_tasks")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    reportError("updateProjectTask", error);
    return { error: "Could not save the task. Try again." };
  }
  refresh(projectId);
  return null;
}

export async function deleteProjectTask(
  projectId: string,
  id: string
): Promise<TaskResult> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase.from("project_tasks").delete().eq("id", id);
  if (error) {
    reportError("deleteProjectTask", error);
    return { error: "Could not delete the task. Try again." };
  }
  refresh(projectId);
  return null;
}
