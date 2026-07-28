"use server";

import { requireStudioContext } from "@/lib/studio";
import {
  aiConfigured,
  isPolishIntent,
  polishMessage,
  type PolishChannel,
  type PolishIntent,
} from "@/lib/ai";
import { reportError } from "@/lib/log";

export type PolishResult = { text: string } | { error: string };

// Long enough for a real client email with quoted context, short enough that a
// pasted document cannot run up a bill on a button press.
const MAX_CHARS = 8000;

// Rewrites the text currently sitting in a composer. Nothing is sent, nothing is
// stored: the caller drops the result back into the box for the producer to read
// and edit before they press send themselves.
export async function polishDraft(input: {
  text: string;
  intent: string;
  channel: PolishChannel;
}): Promise<PolishResult> {
  await requireStudioContext();

  if (!aiConfigured()) {
    return {
      error:
        "Add an OpenAI or Anthropic API key to the deployment to turn on AI writing help.",
    };
  }

  const text = input.text.trim();
  if (!text) return { error: "Write something first, then polish it." };
  if (text.length > MAX_CHARS) {
    return { error: "That message is too long to polish. Try it in pieces." };
  }

  const intent: PolishIntent = isPolishIntent(input.intent)
    ? input.intent
    : "polish";
  const channel: PolishChannel = input.channel === "chat" ? "chat" : "email";

  try {
    const polished = await polishMessage({ text, intent, channel });
    if (!polished) {
      return { error: "The model returned nothing. Please try again." };
    }
    return { text: polished };
  } catch (e) {
    reportError("polishDraft", e);
    return {
      error: e instanceof Error ? e.message : "Could not rewrite that message.",
    };
  }
}
