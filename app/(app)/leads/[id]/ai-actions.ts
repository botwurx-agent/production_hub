"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { aiConfigured, generateOutreach } from "@/lib/ai";
import { gatherLeadContext } from "@/lib/lead-context";

export type OutreachResult = { error: string } | { draft: string };

// Drafts an outreach/follow-up message for a lead. Ephemeral: the producer
// edits it, then sends via a linked channel or copies it.
export async function draftOutreach(leadId: string): Promise<OutreachResult> {
  await requireStudioContext();
  if (!aiConfigured()) {
    return {
      error:
        "Add an OpenAI or Anthropic API key to the deployment to turn on AI drafts.",
    };
  }

  const supabase = createClient();
  const context = await gatherLeadContext(supabase, leadId);
  if (!context) return { error: "Lead not found." };

  try {
    const draft = await generateOutreach(context);
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
