"use server";

// Saves where somebody arranged the pipeline map. Deliberately NO
// revalidatePath: the map holds its positions client-side, and a revalidate
// per drag would refetch the whole pipeline route under the person dragging
// (the moodboard #482 lesson).

import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { parsePositions } from "@/lib/pipeline-map";
import { reportError } from "@/lib/log";
import type { Json } from "@/lib/database.types";

export async function saveMapLayout(projectId: string, raw: unknown): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  // The project read under RLS is the access check; the write is checked again
  // by the table's own policy (can_edit_project for collaborators).
  const { data: project } = await supabase.from("projects").select("id, studio_id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "Project not found." };
  const positions = parsePositions(raw);
  const { error } = await supabase.from("ai_map_layouts").upsert(
    {
      studio_id: project.studio_id,
      project_id: project.id,
      positions: positions as unknown as Json,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );
  if (error) {
    reportError("saveMapLayout", error);
    return { error: "Could not save the arrangement. You may only have review access to this project." };
  }
  return { ok: true };
}
