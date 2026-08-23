"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { parseChecklist, taskPhase, type ChecklistItem } from "@/lib/tasks";
import type { ProjectStatus } from "@/lib/database.types";

export type TaskResult = { error?: string } | null;

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath("/dashboard");
}

export type NewTask = {
  title: string;
  dueDate?: string | null;
  phase?: string | null;
  assigneeId?: string | null;
};

export async function addProjectTask(
  projectId: string,
  input: NewTask
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const clean = input.title.trim();
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
      due_date: input.dueDate || null,
      // Narrowed rather than trusted: the phase arrives from a form field, and
      // an unknown value should land the task in Anytime rather than be
      // refused by the enum with an error nobody can act on.
      phase: taskPhase(input.phase),
      assignee_id: input.assigneeId || null,
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
  patch: {
    title?: string;
    due_date?: string | null;
    notes?: string | null;
    phase?: string | null;
    assignee_id?: string | null;
  }
): Promise<TaskResult> {
  await requireStudioContext();

  const write: {
    title?: string;
    due_date?: string | null;
    notes?: string | null;
    phase?: ProjectStatus | null;
    assignee_id?: string | null;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { error: "Task title can't be empty." };
    write.title = t;
  }
  if (patch.due_date !== undefined) write.due_date = patch.due_date || null;
  if (patch.notes !== undefined) write.notes = patch.notes?.trim() || null;
  if (patch.phase !== undefined) write.phase = taskPhase(patch.phase);
  if (patch.assignee_id !== undefined)
    write.assignee_id = patch.assignee_id || null;

  const supabase = createClient();
  const { error } = await supabase
    .from("project_tasks")
    .update(write)
    .eq("id", id);
  if (error) {
    reportError("updateProjectTask", error);
    return { error: "Could not save the task. Try again." };
  }
  refresh(projectId);
  return null;
}

/**
 * The sub-steps, written whole rather than per item.
 *
 * A checklist is small, always read with its parent, and only ever edited by
 * one person looking at one task, so the read-modify-write a per-item action
 * would need buys nothing over sending the list. It goes back through
 * parseChecklist so what is stored is the same shape the page will read, and so
 * the caps apply on the way in as well as out.
 */
export async function setTaskChecklist(
  projectId: string,
  id: string,
  items: ChecklistItem[]
): Promise<TaskResult> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("project_tasks")
    .update({
      checklist: parseChecklist(items),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    reportError("setTaskChecklist", error);
    return { error: "Could not save the steps. Try again." };
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
