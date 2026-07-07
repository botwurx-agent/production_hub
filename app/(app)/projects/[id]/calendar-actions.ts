"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";

export type EventState = { error?: string } | null;

export type EventInput = {
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string | null;
  kind: string;
  notes?: string | null;
};

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t || null;
}

function validate(input: EventInput): string | null {
  if (!input.title.trim()) return "Give the date a title.";
  if (!input.date) return "Pick a date.";
  if (input.endDate && input.endDate < input.date)
    return "End date can't be before the start.";
  return null;
}

export async function addProjectEvent(
  projectId: string,
  input: EventInput
): Promise<EventState> {
  const ctx = await requireStudioContext();
  const err = validate(input);
  if (err) return { error: err };

  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { error } = await supabase.from("project_events").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    title: input.title.trim(),
    date: input.date,
    end_date: clean(input.endDate),
    kind: input.kind || "other",
    notes: clean(input.notes),
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/calendar`);
  revalidatePath(`/projects/${projectId}`);
  return null;
}

export async function updateProjectEvent(
  projectId: string,
  eventId: string,
  input: EventInput
): Promise<EventState> {
  await requireStudioContext();
  const err = validate(input);
  if (err) return { error: err };

  const supabase = createClient();
  const { error } = await supabase
    .from("project_events")
    .update({
      title: input.title.trim(),
      date: input.date,
      end_date: clean(input.endDate),
      kind: input.kind || "other",
      notes: clean(input.notes),
    })
    .eq("id", eventId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/calendar`);
  revalidatePath(`/projects/${projectId}`);
  return null;
}

export async function deleteProjectEvent(
  projectId: string,
  eventId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("project_events").delete().eq("id", eventId);
  revalidatePath(`/projects/${projectId}/calendar`);
  revalidatePath(`/projects/${projectId}`);
}
