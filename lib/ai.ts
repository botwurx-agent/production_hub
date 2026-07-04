// Server-only Claude API helpers for the AI layer (Phase 4).
// The Anthropic API key lives in ANTHROPIC_API_KEY on the server; features gate
// on aiConfigured() and show a "add your key" prompt until it is set.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = "claude-opus-4-8";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client(): Anthropic {
  // Reads ANTHROPIC_API_KEY from the environment.
  return new Anthropic();
}

// Pulls the plain text out of a Messages response, ignoring thinking blocks.
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

const SUMMARY_SYSTEM = `You are the status assistant inside a pre-production hub used by a boutique commercial production studio. A busy producer clicks "Where does this project stand?" and you answer from the project data provided.

Write a tight, scannable status read for someone who has twenty seconds.

Rules:
- Open with a single one-sentence status line (no label, just the sentence).
- Then short bullet groups, each on its own line, only the ones that apply: "What's done:", "In progress:", "Waiting on:", "Next action:", "Watch:". Put the group label at the start of the line, then the items.
- Be concrete: reference real asset names, statuses, dates, and people from the data. Never invent facts that are not in the data.
- If the project is early or thin on data, say so plainly rather than padding.
- Keep the whole thing under about 180 words.
- Plain text only: start item lines with "- ". No markdown headers, no bold, no tables.
- Do not use em dashes. Use commas, colons, or parentheses instead.`;

// Generates the "where does this project stand" summary from a prepared
// context string. Returns the summary text. Throws on API failure.
export async function generateProjectSummary(context: string): Promise<string> {
  const message = await client().messages.create({
    model: AI_MODEL,
    max_tokens: 3000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: SUMMARY_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Here is the current state of the project. Summarize where it stands.\n\n${context}`,
      },
    ],
  });
  return textOf(message);
}
