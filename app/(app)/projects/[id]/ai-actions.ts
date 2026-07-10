"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import {
  aiConfigured,
  generateProjectSummary,
  generateClientUpdate,
  aiModel,
} from "@/lib/ai";
import {
  gatherProjectContext,
  gatherProjectEmailContext,
} from "@/lib/project-context";

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
        "Add an OpenAI or Anthropic API key to the deployment to turn on AI summaries.",
    };
  }

  const supabase = createClient();
  const context = await gatherProjectContext(supabase, projectId);
  if (!context) return { error: "Project not found." };
  // Pull the actual content of linked Gmail threads so the summary reflects what
  // has been discussed, agreed, or is awaiting a reply (best-effort).
  const email = await gatherProjectEmailContext(supabase, projectId);
  const fullContext = email ? `${context}\n\n${email}` : context;

  try {
    const content = await generateProjectSummary(fullContext);
    if (!content) {
      return { error: "The model returned an empty summary. Please try again." };
    }
    const createdAt = new Date().toISOString();
    const { error } = await supabase.from("project_summaries").upsert(
      {
        studio_id: ctx.studio.id,
        project_id: projectId,
        content,
        model: aiModel(),
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

export type DraftResult = { error: string } | { draft: string };

// Drafts a client-facing progress update from the project state. Ephemeral:
// the producer edits it in place, then sends via a linked channel.
export async function draftClientUpdate(
  projectId: string
): Promise<DraftResult> {
  await requireStudioContext();
  if (!aiConfigured()) {
    return {
      error:
        "Add an OpenAI or Anthropic API key to the deployment to turn on AI drafts.",
    };
  }

  const supabase = createClient();
  const context = await gatherProjectContext(supabase, projectId);
  if (!context) return { error: "Project not found." };
  const email = await gatherProjectEmailContext(supabase, projectId);
  const fullContext = email ? `${context}\n\n${email}` : context;

  try {
    const draft = await generateClientUpdate(fullContext);
    if (!draft) {
      return { error: "The model returned an empty draft. Please try again." };
    }
    return { draft };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not generate draft.",
    };
  }
}
