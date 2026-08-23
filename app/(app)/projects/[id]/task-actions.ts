"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { assetStorage } from "@/lib/asset-storage";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/attachment-limits";
import {
  parseChecklist,
  taskPhase,
  taskStatus,
  type ChecklistItem,
} from "@/lib/tasks";
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
  /** Everyone on the card. Empty means unassigned. */
  assignees?: string[];
  /** Which board column it is being added to. Defaults to To do. */
  status?: string | null;
  sort?: number;
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
      status: taskStatus(input.status),
      // New cards land at the top of their column. A task you just typed is the
      // one you are thinking about, and burying it under a month of older work
      // is how a board stops being looked at.
      sort: input.sort ?? -Date.now() / 1e6,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) {
    reportError("addProjectTask", error);
    return { error: "Could not add the task. Try again." };
  }

  // Assignees are their own rows, so they go in after the task exists. A
  // failure here leaves the task without names rather than losing the task,
  // which is the right way round: the title is the thing being captured.
  const people = (input.assignees ?? []).filter(Boolean);
  if (people.length > 0) {
    const { error: aErr } = await supabase
      .from("project_task_assignees")
      .insert(
        people.map((user_id) => ({
          studio_id: project.studio_id,
          task_id: data.id,
          user_id,
        }))
      );
    if (aErr) reportError("addProjectTask:assignees", aErr);
  }

  refresh(projectId);
  return { id: data.id };
}

/**
 * Tick or untick a task.
 *
 * Writes STATUS, not `done`: since migration 0095 `done` is a generated column
 * derived from the status, and Postgres refuses a write to one. That is the
 * point, since it makes it impossible to tick a task without moving its card.
 *
 * Unticking returns it to To do rather than to whatever column it was in
 * before, because we do not keep a previous column and guessing would be worse
 * than the honest default.
 */
export async function toggleProjectTask(
  projectId: string,
  id: string,
  done: boolean
): Promise<TaskResult> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("project_tasks")
    .update({
      status: done ? "done" : "todo",
      done_at: done ? new Date().toISOString() : null,
    })
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
    status?: string | null;
  }
): Promise<TaskResult> {
  await requireStudioContext();

  const write: {
    title?: string;
    due_date?: string | null;
    notes?: string | null;
    phase?: ProjectStatus | null;
    status?: string;
    done_at?: string | null;
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
  if (patch.status !== undefined) {
    const next = taskStatus(patch.status);
    write.status = next;
    // done_at is a plain column, so it is stamped here rather than derived.
    write.done_at = next === "done" ? new Date().toISOString() : null;
  }

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
 * A card dropped somewhere: which column it landed in, and where in it.
 *
 * One row is written, because the caller computed a midpoint sort key rather
 * than a position, so the rest of the column is untouched. `groupBy` decides
 * which axis the drop meant: on a board grouped by status, dragging across
 * changes what is happening to the task; grouped by phase, it changes which
 * part of the production it belongs to. Sending the axis rather than inferring
 * it keeps the server from having to guess what the board was showing.
 */
export async function moveTask(
  projectId: string,
  id: string,
  groupBy: "status" | "phase",
  column: string | null,
  sort: number
): Promise<TaskResult> {
  await requireStudioContext();
  if (!Number.isFinite(sort)) return { error: "Could not place that card." };

  const write: {
    sort: number;
    status?: string;
    done_at?: string | null;
    phase?: ProjectStatus | null;
    updated_at: string;
  } = { sort, updated_at: new Date().toISOString() };

  if (groupBy === "status") {
    const next = taskStatus(column);
    write.status = next;
    write.done_at = next === "done" ? new Date().toISOString() : null;
  } else {
    write.phase = taskPhase(column);
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("project_tasks")
    .update(write)
    .eq("id", id);
  if (error) {
    reportError("moveTask", error);
    return { error: "Could not move the task. Try again." };
  }
  refresh(projectId);
  return null;
}

/**
 * Who is on a card, written as the whole set.
 *
 * Same reasoning as the checklist: the list is small, always read with its
 * task, and only ever edited by one person looking at one card, so replacing it
 * is simpler than diffing and cannot leave a half-applied change. The delete
 * and the insert are two statements rather than one transaction, so a failure
 * between them would clear the card; the insert error is reported and the page
 * refreshes either way, which shows the truth rather than an optimistic lie.
 */
export async function setTaskAssignees(
  projectId: string,
  taskId: string,
  userIds: string[]
): Promise<TaskResult> {
  await requireStudioContext();
  const supabase = createClient();

  const { data: task } = await supabase
    .from("project_tasks")
    .select("studio_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { error: "Task not found." };

  const { error: delErr } = await supabase
    .from("project_task_assignees")
    .delete()
    .eq("task_id", taskId);
  if (delErr) {
    reportError("setTaskAssignees:clear", delErr);
    return { error: "Could not update who is on this. Try again." };
  }

  const wanted = [...new Set(userIds.filter(Boolean))];
  if (wanted.length > 0) {
    const { error } = await supabase.from("project_task_assignees").insert(
      wanted.map((user_id) => ({
        studio_id: task.studio_id,
        task_id: taskId,
        user_id,
      }))
    );
    if (error) {
      reportError("setTaskAssignees", error);
      refresh(projectId);
      return { error: "Could not update who is on this. Try again." };
    }
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


/* ------------------------------------------------------- files ------------ */

/**
 * A file dropped on a card.
 *
 * The bytes cross a Server Action, so the ~4.5MB serverless request body
 * applies and MAX_UPLOAD_BYTES is the only cap that can actually fire: over the
 * platform ceiling the request dies at the edge with nothing for us to report.
 * The composer mirrors the check so it is caught before the upload rather than
 * appearing to do nothing.
 *
 * Stored through assetStorage() rather than the caller's client, because the
 * bucket policy is scoped to a studio FOLDER which a project collaborator does
 * not satisfy. The access gate is one layer up: the task read below is
 * RLS-gated, so reaching this point already proves access.
 */
export async function addTaskFile(
  projectId: string,
  taskId: string,
  formData: FormData
): Promise<TaskResult> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: task } = await supabase
    .from("project_tasks")
    .select("studio_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { error: "Task not found." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file selected." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `That file is ${formatBytes(file.size)}, over the ${formatBytes(
        MAX_UPLOAD_BYTES
      )} limit for an upload.`,
    };
  }

  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
  const path = `${task.studio_id}/tasks/${taskId}/${crypto.randomUUID()}-${safe}`;
  const { error: upErr } = await assetStorage().upload(
    path,
    Buffer.from(await file.arrayBuffer()),
    { contentType: file.type || "application/octet-stream", upsert: false }
  );
  if (upErr) {
    reportError("addTaskFile:upload", upErr);
    return { error: "Could not upload that file. Try again." };
  }

  const { error } = await supabase.from("project_task_files").insert({
    studio_id: task.studio_id,
    task_id: taskId,
    name: file.name.slice(0, 200),
    storage_path: path,
    mime_type: file.type || null,
    size_bytes: file.size,
    created_by: ctx.userId,
  });
  if (error) {
    reportError("addTaskFile", error);
    return { error: "Could not attach that file. Try again." };
  }
  refresh(projectId);
  return null;
}

/**
 * Removes the row AND the blob, in that order.
 *
 * The row first, because it is the RLS-gated half: if it is refused, nothing
 * was deleted. A storage failure afterwards leaves an orphaned blob nobody can
 * reach, which is waste rather than a leak, so it is reported and swallowed.
 */
export async function deleteTaskFile(
  projectId: string,
  fileId: string
): Promise<TaskResult> {
  await requireStudioContext();
  const supabase = createClient();

  const { data: file } = await supabase
    .from("project_task_files")
    .select("storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return { error: "File not found." };

  const { error } = await supabase
    .from("project_task_files")
    .delete()
    .eq("id", fileId);
  if (error) {
    reportError("deleteTaskFile", error);
    return { error: "Could not remove that file. Try again." };
  }
  const { error: rmErr } = await assetStorage().remove([file.storage_path]);
  if (rmErr) reportError("deleteTaskFile:storage", rmErr);

  refresh(projectId);
  return null;
}

/* ---------------------------------------------------- comments ------------ */

const MAX_COMMENT = 4000;

export async function addTaskComment(
  projectId: string,
  taskId: string,
  body: string
): Promise<TaskResult> {
  const ctx = await requireStudioContext();
  const clean = body.trim().slice(0, MAX_COMMENT);
  if (!clean) return { error: "Write something first." };

  const supabase = createClient();
  const { data: task } = await supabase
    .from("project_tasks")
    .select("studio_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { error: "Task not found." };

  const { error } = await supabase.from("project_task_comments").insert({
    studio_id: task.studio_id,
    task_id: taskId,
    author_id: ctx.userId,
    body: clean,
  });
  if (error) {
    reportError("addTaskComment", error);
    return { error: "Could not post that. Try again." };
  }
  refresh(projectId);
  return null;
}

/**
 * Only your own, and admins are deliberately NOT special-cased, matching the
 * rule review comments already follow: silently rewriting or removing a
 * colleague's note is worse than asking them to.
 */
export async function deleteTaskComment(
  projectId: string,
  commentId: string
): Promise<TaskResult> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("project_task_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", ctx.userId);
  if (error) {
    reportError("deleteTaskComment", error);
    return { error: "Could not remove that. Try again." };
  }
  refresh(projectId);
  return null;
}
