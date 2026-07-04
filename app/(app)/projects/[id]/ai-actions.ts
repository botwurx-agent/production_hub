"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { aiConfigured, generateProjectSummary, AI_MODEL } from "@/lib/ai";
import { gatherProjectContext } from "@/lib/project-context";

export type SummaryResult =
  | { error: string }
  | { content: string; createdAt: string };

// Generates (or regenerates) the "where does this project stand" summary and
// stores it as the project's single current summary.
export async function summarizeProject(
  projectId: string
): Promise<SummaryResult> {
  const ctx = await requireStudioContext();
  if (!aiConfigured()) {
    return {
      error:
        "Add an ANTHROPIC_API_KEY to the deployment to turn on AI summaries.",
    };
  }

  const supabase = createClient();
  const context = await gatherProjectContext(supabase, projectId);
  if (!context) return { error: "Project not found." };

  try {
    const content = await generateProjectSummary(context);
    if (!content) {
      return { error: "The model returned an empty summary. Please try again." };
    }
    const createdAt = new Date().toISOString();
    const { error } = await supabase.from("project_summaries").upsert(
      {
        studio_id: ctx.studio.id,
        project_id: projectId,
        content,
        model: AI_MODEL,
        created_by: ctx.userId,
        created_at: createdAt,
      },
      { onConflict: "project_id" }
    );
    if (error) return { error: error.message };

    revalidatePath(`/projects/${projectId}`);
    return { content, createdAt };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not generate summary.",
    };
  }
}
