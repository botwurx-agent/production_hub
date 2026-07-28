// Server-only AI helpers for the AI layer (Phase 4).
// Provider-agnostic: uses Anthropic (Claude) or OpenAI depending on which API
// key is set on the server, so the same features work while testing on one
// provider and running on the other in production. Features gate on
// aiConfigured() and show an "add a key" prompt until one is set.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const ANTHROPIC_MODEL = "claude-opus-4-8";
// Short, cheap rewrites (the composer's Polish button) run on the small model.
// A polish is a few hundred tokens in and out and gets pressed many times a
// day, so it should cost close to nothing; the summary and draft features stay
// on the main model.
export const ANTHROPIC_FAST_MODEL = "claude-haiku-4-5-20251001";
// OpenAI model is overridable so a different account/tier can swap it without a
// code change. Default targets the Chat Completions API.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

// GPT-5 and o-series are reasoning models: they use max_completion_tokens
// (not max_tokens), only allow the default temperature, and accept
// reasoning_effort. Detect them so the request shape is correct.
function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model);
}

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
- When linked email threads are included, read them to capture what has been discussed, agreed, requested, or is awaiting a reply, and reflect that in "Waiting on:" and "Next action:". Attribute who said what when it matters.
- If the project is early or thin on data, say so plainly rather than padding.
- Keep the whole thing under about 180 words.
- Plain text only: start item lines with "- ". No markdown headers, no bold, no tables.
- Do not use em dashes. Use commas, colons, or parentheses instead.`;

function summaryUserMessage(context: string): string {
  return `Here is the current state of the project. Summarize where it stands.\n\n${context}`;
}

// Per-call overrides. `fast` swaps in the small model for short tasks that do
// not need reasoning depth (a rewrite of text the user already wrote). It only
// applies to the Anthropic path: OPENAI_MODEL already defaults to a small model
// (gpt-5-mini), so there is nothing to swap down to there.
type CompleteOpts = { fast?: boolean; maxTokens?: number };

// --- Anthropic (Claude) path -------------------------------------------------
async function anthropicComplete(
  system: string,
  user: string,
  opts: CompleteOpts = {}
): Promise<string> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const messages = [{ role: "user" as const, content: user }];
  const maxTokens = opts.maxTokens ?? 3000;

  // Adaptive thinking and effort control are main-model features, so the fast
  // path sends a plain request rather than one the small model would reject.
  const message = opts.fast
    ? await client.messages.create({
        model: ANTHROPIC_FAST_MODEL,
        max_tokens: maxTokens,
        system,
        messages,
      })
    : await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system,
        messages,
      });

  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// --- OpenAI path (Chat Completions) -----------------------------------------
async function openaiComplete(
  system: string,
  user: string,
  opts: CompleteOpts = {}
): Promise<string> {
  const reasoning = isReasoningModel(OPENAI_MODEL);
  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    // Higher cap than the visible summary needs: reasoning models spend part of
    // this budget on internal reasoning tokens before the answer.
    max_completion_tokens: opts.maxTokens ?? 2000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  // Keep reasoning shallow for a short status summary (cheaper, faster).
  if (reasoning) body.reasoning_effort = "low";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = data.choices?.[0];
  const content = (choice?.message?.content ?? "").trim();
  // A reasoning model can burn the whole budget thinking and return nothing at
  // all. Say that plainly rather than letting it surface as "returned nothing",
  // which reads like a fault the user cannot act on.
  if (!content && choice?.finish_reason === "length") {
    throw new Error("That was too long to finish. Try it in smaller pieces.");
  }
  return content;
}

const CLIENT_UPDATE_SYSTEM = `You are drafting a short progress update that a producer at a boutique commercial production studio will send to their client. It goes out under the producer's name, so write it as the producer.

Write a warm, professional, concise update from the project data provided.

Rules:
- Optional short greeting, then a couple of sentences (or a few short bullets) on what has progressed and what is coming next.
- If something is needed from the client (a review, an approval, an answer), ask for it clearly and specifically.
- Client-facing tone: no internal jargon, no internal-only notes, nothing that would read as complaining about the client.
- Never invent facts that are not in the data. If the project is early, keep it brief and forward-looking.
- Keep it under about 150 words.
- Plain text only. No markdown headers, no bold. Do not use em dashes; use commas, colons, or parentheses instead.
- End with a simple sign-off line like "Best," on its own line (no name; the producer adds theirs).
- This is a draft the producer will review and edit before sending, so do not include placeholders like [client name] unless the data does not provide one.`;

function clientUpdateUserMessage(context: string): string {
  return `Draft a client-facing progress update for this project.\n\n${context}`;
}

// Dispatch a system+user completion to the configured provider.
async function complete(
  system: string,
  user: string,
  opts: CompleteOpts = {}
): Promise<string> {
  const provider = aiProvider();
  if (provider === "openai") return openaiComplete(system, user, opts);
  if (provider === "anthropic") return anthropicComplete(system, user, opts);
  throw new Error("No AI provider configured.");
}

// Generates the "where does this project stand" summary from a prepared
// context string, using whichever provider is configured.
export async function generateProjectSummary(context: string): Promise<string> {
  return complete(SUMMARY_SYSTEM, summaryUserMessage(context));
}

// Generates a client-ready progress update draft from the project context.
export async function generateClientUpdate(context: string): Promise<string> {
  return complete(CLIENT_UPDATE_SYSTEM, clientUpdateUserMessage(context));
}

const OUTREACH_SYSTEM = `You are drafting an outreach or follow-up message that a producer at a boutique commercial production studio will send to a prospect (a lead). It goes out under the producer's name.

Write a warm, brief, human note from the lead data provided. Not salesy.

Rules:
- If there is prior email history, write a natural follow-up that moves things forward. If the lead is brand new, write a short, specific introduction.
- Include one clear, low-friction next step (a quick call, a specific question, or sharing relevant work).
- Address the contact by first name if the data gives one; otherwise keep it general (no [placeholder] tokens).
- Never invent facts (past meetings, promises, project details) that are not in the data.
- Keep it under about 130 words.
- Plain text only. No markdown headers, no bold. Do not use em dashes; use commas, colons, or parentheses instead.
- End with a simple sign-off line like "Best," on its own line (no name; the producer adds theirs).
- This is a draft the producer will review and edit before sending.`;

function outreachUserMessage(context: string): string {
  return `Draft an outreach or follow-up message for this lead.\n\n${context}`;
}

// Generates an outreach/follow-up draft for a lead from its context.
export async function generateOutreach(context: string): Promise<string> {
  return complete(OUTREACH_SYSTEM, outreachUserMessage(context));
}

// --- Polish: rewrite what the producer already typed ---------------------------
// Deliberately different from the draft features above: this one is handed the
// user's own words and rewrites them. It is never given project data and it must
// never add facts, because the result goes to a client under the producer's name
// after they read it and press send themselves.

export const POLISH_INTENTS = ["polish", "shorten", "warm", "firm"] as const;
export type PolishIntent = (typeof POLISH_INTENTS)[number];
export type PolishChannel = "email" | "chat";

export function isPolishIntent(v: unknown): v is PolishIntent {
  return POLISH_INTENTS.includes(v as PolishIntent);
}

const INTENT_RULE: Record<PolishIntent, string> = {
  polish:
    "Fix grammar, spelling, punctuation, and awkward phrasing. Improve flow and clarity. Keep roughly the same length and every point the writer made.",
  shorten:
    "Cut it to the essentials. Remove filler, throat-clearing, and repetition. Keep every request, fact, and deadline intact. The result should be clearly shorter than the original.",
  warm:
    "Make the tone warmer and more personable while staying professional. Do not add flattery, enthusiasm, or apologies that were not already there.",
  firm: "Make it clearer and more direct. State plainly what is needed and by when. Stay polite and professional: direct is not blunt, rude, or passive aggressive.",
};

const CHANNEL_RULE: Record<PolishChannel, string> = {
  email:
    "This is an email. Keep the greeting and sign-off if the writer included them, and do not add ones they left out. Never add a subject line and never add a name to the sign-off.",
  chat: "This is a chat message (Slack or Google Chat). Keep it short and conversational. No greeting, no sign-off, no email formatting.",
};

function polishSystem(intent: PolishIntent, channel: PolishChannel): string {
  return `You are a writing assistant inside a pre-production hub used by a boutique commercial production studio. A producer has written a message to a client, agency, or crew member and asked you to rewrite it before they send it.

Your task: ${INTENT_RULE[intent]}

${CHANNEL_RULE[channel]}

Hard rules:
- Rewrite ONLY what you are given. Never add information that is not in the message: no new dates, times, numbers, prices, names, deliverables, promises, or commitments.
- Preserve every fact, name, date, number, file name, and URL exactly as written. If something is ambiguous, leave it as the writer had it rather than guessing.
- Keep the writer's voice. This is a small studio talking to people they work with, not a corporate memo. Do not make it stiff or formal.
- Never invent placeholders like [name] or [date]. If the writer did not name someone, do not add a name.
- Write in the same language as the original message.
- Plain text only. No markdown, no headings, no bold.
- Do not use em dashes. Use commas, colons, or parentheses instead.
- If the message is already well written, return it close to unchanged. Do not pad it to look like you did work.

Return ONLY the rewritten message. No preamble, no explanation, no quotation marks around it, no notes about what you changed.`;
}

// Rewrites a composer draft. Runs on the fast model: it is a short rewrite of
// existing text, pressed often, and does not need reasoning depth.
export async function polishMessage(opts: {
  text: string;
  intent: PolishIntent;
  channel: PolishChannel;
}): Promise<string> {
  const user = `Rewrite the message between the markers.\n\n---BEGIN MESSAGE---\n${opts.text}\n---END MESSAGE---`;
  // Generous cap on purpose. The rewrite is about as long as the original (up to
  // the action's 8000-character limit, roughly 2000 tokens), and on a reasoning
  // model this budget also covers the internal reasoning tokens spent before the
  // answer. Too low and a long email comes back truncated mid-sentence.
  return complete(polishSystem(opts.intent, opts.channel), user, {
    fast: true,
    maxTokens: 4000,
  });
}
