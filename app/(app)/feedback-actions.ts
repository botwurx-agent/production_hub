"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";

export type FeedbackState = { error?: string; ok?: boolean } | null;

// Beta feedback from the in-app widget. RLS lets a signed-in user insert their
// own row; the operator reads submissions via the Supabase dashboard.
export async function submitFeedback(
  message: string,
  page?: string | null
): Promise<FeedbackState> {
  const ctx = await requireStudioContext();
  const text = message.trim();
  if (!text) return { error: "Write a message first." };
  if (text.length > 5000) return { error: "That message is a bit long." };

  const supabase = createClient();
  const { error } = await supabase.from("feedback").insert({
    studio_id: ctx.studio.id,
    user_id: ctx.userId,
    email: ctx.email,
    message: text,
    page: page ?? null,
    user_agent: headers().get("user-agent"),
  });
  if (error) {
    reportError("submitFeedback", error);
    return { error: "Could not send feedback. Try again." };
  }
  return { ok: true };
}
