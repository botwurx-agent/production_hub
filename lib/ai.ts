// Server-only AI helpers for the AI layer (Phase 4).
// Provider-agnostic: uses Anthropic (Claude) or OpenAI depending on which API
// key is set on the server, so the same features work while testing on one
// provider and running on the other in production. Features gate on
// aiConfigured() and show an "add a key" prompt until one is set.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const ANTHROPIC_MODEL = "claude-opus-4-8";
// OpenAI model is overridable so a different account/tier can swap it without a
// code change. Default targets the Chat Completions API.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export type AiProvider = "anthropic" | "openai" | null;

// Resolve the active provider. Precedence: an explicit AI_PROVIDER override
// (when its key exists), then Anthropic if its key is set (the app default),
// then OpenAI. Returns null when nothing is configured.
export function aiProvider(): AiProvider {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (forced === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export function aiConfigured(): boolean {
  return aiProvider() !== null;
}

export function aiModel(): string {
  return aiProvider() === "openai" ? OPENAI_MODEL : ANTHROPIC_MODEL;
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

function summaryUserMessage(context: string): string {
  return `Here is the current state of the project. Summarize where it stands.\n\n${context}`;
}

// --- Anthropic (Claude) path -------------------------------------------------
async function anthropicComplete(
  system: string,
  user: string
): Promise<string> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 3000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system,
    messages: [{ role: "user", content: user }],
  });
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// --- OpenAI path (Chat Completions) -----------------------------------------
async function openaiComplete(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 900,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

// Generates the "where does this project stand" summary from a prepared
// context string, using whichever provider is configured.
export async function generateProjectSummary(context: string): Promise<string> {
  const provider = aiProvider();
  const user = summaryUserMessage(context);
  if (provider === "openai") return openaiComplete(SUMMARY_SYSTEM, user);
  if (provider === "anthropic") return anthropicComplete(SUMMARY_SYSTEM, user);
  throw new Error("No AI provider configured.");
}
