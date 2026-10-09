"use server";

import { requireStudioContext } from "@/lib/studio";
import { voiceFolder } from "@/lib/voice-note";
import { storeVoice } from "@/lib/voice-store";

/**
 * Upload a voice note before the review comment that carries it. Anyone who
 * can comment can record one, collaborators included (review comments stay
 * writable for every project role). The folder is this user's own, which is
 * the only place addReviewCommentAt and addDocReviewCommentAt will accept a
 * path from.
 */
export async function uploadVoiceNote(
  form: FormData
): Promise<{ path: string } | { error: string }> {
  const ctx = await requireStudioContext();
  return storeVoice(form, voiceFolder(ctx.studio.id, { userId: ctx.userId }));
}
