// Server-only AI helpers for the AI layer (Phase 4).
// Provider-agnostic: uses Anthropic (Claude) or OpenAI depending on which API
// key is set on the server, so the same features work while testing on one
// provider and running on the other in production. Features gate on
// aiConfigured() and show an "add a key" prompt until one is set.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { parseShotDocDraft, type ShotDocDraft } from "@/lib/shot-doc";
export type { ShotDocDraft, ShotDocRow, ShotDocPage } from "@/lib/shot-doc";

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

// --- Document reading (invoice extraction) -----------------------------------
// The only multimodal path in the app. Both providers take the bytes inline as
// base64 rather than an uploaded file id, so nothing has to be cleaned up
// afterwards and the document never lands anywhere but the request.
//
// VERIFIED: the Anthropic shape is checked against the installed SDK's own
// types (@anthropic-ai/sdk 0.110.0 DocumentBlockParam / Base64PDFSource /
// Base64ImageSource). The OpenAI shape comes from their file-input docs and has
// NOT been exercised against the live API from this repo, since no key is
// present outside Vercel. If a real invoice ever fails on the OpenAI path,
// suspect this shape first.

export type AiDocument = {
  /** Raw file bytes, base64 encoded (no data: prefix). */
  base64: string;
  /** "application/pdf" or an image/* type. */
  mediaType: string;
  fileName: string;
};

function anthropicDocBlock(doc: AiDocument): Anthropic.ContentBlockParam {
  if (doc.mediaType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: doc.base64 },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      // The SDK's union is narrower than "any image/*", so anything unexpected
      // is sent as png rather than failing the type check with a cast.
      media_type: (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
        doc.mediaType
      )
        ? doc.mediaType
        : "image/png") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: doc.base64,
    },
  };
}

async function anthropicReadDocument(
  system: string,
  user: string,
  doc: AiDocument,
  maxTokens: number
): Promise<string> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [
      { role: "user", content: [anthropicDocBlock(doc), { type: "text", text: user }] },
    ],
  });
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function openaiReadDocument(
  system: string,
  user: string,
  doc: AiDocument,
  maxTokens: number
): Promise<string> {
  const dataUrl = `data:${doc.mediaType};base64,${doc.base64}`;
  // Chat Completions takes a PDF as a "file" part and an image as an
  // "image_url" part. It does not accept a remote file URL (that is Responses
  // API only), which is why the bytes are inlined.
  const filePart =
    doc.mediaType === "application/pdf"
      ? { type: "file", file: { filename: doc.fileName, file_data: dataUrl } }
      : { type: "image_url", image_url: { url: dataUrl } };

  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: [filePart, { type: "text", text: user }] },
    ],
  };
  if (isReasoningModel(OPENAI_MODEL)) body.reasoning_effort = "low";

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
  if (!content && choice?.finish_reason === "length") {
    throw new Error("That document was too long to finish reading.");
  }
  return content;
}

const INVOICE_SYSTEM = `You read a vendor invoice for a commercial production studio and return only the facts printed on it.

You are filling in a form that a producer will check before saving, so accuracy matters far more than completeness. A field you are unsure about must be null. A guess that looks plausible is worse than nothing, because the producer may not catch it.

Return ONLY a JSON object, no prose, no code fences, with exactly these keys:
{
  "vendor": string or null,          // who is BILLING (the sender / "from" party), never the studio being billed
  "description": string or null,     // one short line for what the invoice covers, under 80 characters
  "amount": number or null,          // the TOTAL AMOUNT DUE, as a plain number: no currency symbol, no thousands separators
  "days": number or null,            // days billed, ONLY if the invoice bills by the day and states a quantity of days
  "currency": string or null,        // 3-letter code if one is shown
  "invoiceNumber": string or null,
  "invoiceDate": string or null,     // YYYY-MM-DD
  "dueDate": string or null,         // YYYY-MM-DD
  "budgetLineId": string or null,    // the id of the best-matching budget line from the list given, or null if none clearly fits
  "notes": string or null,           // anything a producer would want flagged (payment terms, deposit, partial billing), else null
  "unreadable": boolean              // true if this is not a readable invoice at all
}

Rules:
- The amount is the final total due, after tax and after any deposit already paid. If the invoice shows both a subtotal and a total, take the total.
- days is only for day-rate work with a stated quantity ("3 days @ $800", "2 x shoot day"). A flat fee, a kit rental, or a licence has no day count, so return null. Never divide the total by a rate to invent one.
- If several dates appear, invoiceDate is the issue date, not the service date or the period covered.
- An ambiguous date format (03/04/2026) should be read using other clues on the document; if it stays ambiguous, return null rather than picking one.
- Only return a budgetLineId that appears verbatim in the list provided. If nothing clearly fits, null.
- If the document is not an invoice (a contract, a photo of something else, a blank page), set unreadable to true and every other field to null.
- Do not use em dashes in any text you return.`;

export type InvoiceDraft = {
  vendor: string | null;
  description: string | null;
  amount: number | null;
  days: number | null;
  currency: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  budgetLineId: string | null;
  notes: string | null;
  unreadable: boolean;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function day(v: unknown): string | null {
  const s = str(v, 10);
  if (!s || !ISO_DAY.test(s)) return null;
  // A syntactically valid string can still be an impossible date (2026-02-31),
  // and Date would silently roll it forward into March.
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const ok =
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  return ok ? s : null;
}

/**
 * The model's JSON is untrusted input: it can be malformed, wrapped in a code
 * fence, or carry a hallucinated budget line id. Everything is validated here,
 * and anything that fails becomes null rather than reaching a money field.
 */
export function parseInvoiceDraft(raw: string, validLineIds: string[]): InvoiceDraft {
  const empty: InvoiceDraft = {
    vendor: null,
    description: null,
    amount: null,
    days: null,
    currency: null,
    invoiceNumber: null,
    invoiceDate: null,
    dueDate: null,
    budgetLineId: null,
    notes: null,
    unreadable: true,
  };

  // Models sometimes wrap JSON in a fence despite being told not to.
  const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return empty;

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return empty;
  }

  // Accept a number, or a string the model formatted anyway ("1,250.00", "$900").
  let amount: number | null = null;
  const rawAmount = obj.amount;
  if (typeof rawAmount === "number") {
    amount = rawAmount;
  } else if (typeof rawAmount === "string") {
    const digits = rawAmount.replace(/[^0-9.\-]/g, "");
    // Number("") is 0, so a string with no digits at all ("n/a", "see below")
    // would otherwise land in a money field as $0.00 and read as a real zero
    // cost rather than as nothing extracted.
    const n = digits === "" ? NaN : Number(digits);
    amount = Number.isFinite(n) ? n : null;
  }
  // A negative or absurd total is a misread, not a cost.
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1e9)) {
    amount = null;
  }
  if (amount !== null) amount = Math.round(amount * 100) / 100;

  // A day count is only useful when it is a plausible number of days; anything
  // else means the model inferred rather than read it.
  const rawDays = typeof obj.days === "number" ? obj.days : Number(obj.days);
  const days =
    Number.isFinite(rawDays) && rawDays > 0 && rawDays <= 500
      ? Math.round(rawDays * 100) / 100
      : null;

  const lineId = str(obj.budgetLineId, 64);

  return {
    vendor: str(obj.vendor, 200),
    description: str(obj.description, 200),
    amount,
    days,
    currency: str(obj.currency, 8),
    invoiceNumber: str(obj.invoiceNumber, 100),
    invoiceDate: day(obj.invoiceDate),
    dueDate: day(obj.dueDate),
    // A hallucinated id would silently file the cost against the wrong line.
    budgetLineId: lineId && validLineIds.includes(lineId) ? lineId : null,
    notes: str(obj.notes, 500),
    unreadable: obj.unreadable === true,
  };
}

/**
 * Reads an invoice document into a DRAFT. Nothing here writes anything: the
 * producer confirms every field before it becomes a financial record.
 */
export async function extractInvoice(
  doc: AiDocument,
  budgetLines: { id: string; label: string }[]
): Promise<InvoiceDraft> {
  const lineList = budgetLines.length
    ? `Budget lines available on this project (use the exact id, or null):\n${budgetLines
        .map((l) => `- id ${l.id}: ${l.label}`)
        .join("\n")}`
    : "This project has no budget lines yet, so budgetLineId must be null.";

  const user = `Read this invoice and return the JSON object.\n\n${lineList}`;
  const provider = aiProvider();
  const maxTokens = 4000;

  const raw =
    provider === "openai"
      ? await openaiReadDocument(INVOICE_SYSTEM, user, doc, maxTokens)
      : provider === "anthropic"
        ? await anthropicReadDocument(INVOICE_SYSTEM, user, doc, maxTokens)
        : (() => {
            throw new Error("No AI provider configured.");
          })();

  return parseInvoiceDraft(raw, budgetLines.map((l) => l.id));
}

// --- SOW reading (an inbound statement of work) ------------------------------
// A received SOW is a source of truth about what the studio promised: named
// deliverables at named prices on named dates. Retyping that into the project
// is exactly the work this removes.
//
// Prompt shaped from two real documents: one from a brand (deliverables as
// prose, an initial payment and a total) and one from a production company
// hiring the studio as a sub (a milestone table and a per-deliverable fee table
// summing to a stated total). It has to handle both.

const SOW_SYSTEM = `You read a Statement of Work and return only what is printed on it.

A producer will check every field before it is saved, so accuracy matters far more than completeness. Anything you are unsure about must be null. A plausible guess is worse than nothing, because it may not get caught.

Return ONLY a JSON object, no prose, no code fences, with exactly these keys:
{
  "title": string or null,           // the project or engagement name, not the words "Statement of Work"
  "reference": string or null,       // the document's own number if shown, e.g. "SOW #1"
  "counterparty": string or null,    // the OTHER party: who is commissioning or hiring. Never the service provider or subcontractor
  "governedBy": string or null,      // the parent agreement named, e.g. "Master Services Agreement dated 1/28/2026"
  "effectiveDate": string or null,   // YYYY-MM-DD, the date the SOW takes effect or is dated
  "total": number or null,           // the TOTAL fee for the whole engagement, as a plain number
  "paymentTerms": string or null,    // payment structure in one or two plain sentences, e.g. "50% on execution, 50% net 20"
  "ourSignerName": string or null,   // printed name of whoever signed for the service provider, if filled in
  "ourSignedAt": string or null,     // YYYY-MM-DD
  "theirSignerName": string or null,
  "theirSignedAt": string or null,
  "deliverables": [                  // one entry per deliverable or line the document names
    {
      "name": string,                // short, e.g. "OLV :30 16x9" or "Moco Crew"
      "spec": string or null,        // format, duration, quantity if stated
      "dueDate": string or null,     // YYYY-MM-DD if a delivery date is given for this line
      "amount": number or null       // the fee for THIS line, if the document breaks fees out per line
    }
  ],
  "unreadable": boolean              // true if this is not a readable statement of work
}

Rules:
- total is the whole engagement. If the document shows an initial payment and a total, take the TOTAL, and describe the split in paymentTerms.
- Only fill a deliverable's amount when the document states a fee for that specific line. If it gives one lump sum, leave every amount null and put the sum in total.
- deliverables is for what gets delivered or supplied. Include line items from a fee table even when they read as resources (crew, equipment, stage), because that is how the fee is broken out.
- A date range like "6/09/26 - 6/11/26" should use the LAST date as dueDate.
- An ambiguous date format should be read from other clues on the document; if it stays ambiguous, return null.
- Never invent a fee, a date, or a deliverable that is not printed.
- If the document is not a statement of work, set unreadable to true and everything else to null or empty.
- Do not use em dashes in any text you return.`;

export type SowDeliverable = {
  name: string;
  spec: string | null;
  dueDate: string | null;
  amount: number | null;
};

export type SowDraft = {
  title: string | null;
  reference: string | null;
  counterparty: string | null;
  governedBy: string | null;
  effectiveDate: string | null;
  total: number | null;
  paymentTerms: string | null;
  ourSignerName: string | null;
  ourSignedAt: string | null;
  theirSignerName: string | null;
  theirSignedAt: string | null;
  deliverables: SowDeliverable[];
  unreadable: boolean;
};

/** Shared with the invoice parser: a money value that cannot be trusted raw. */
function money(v: unknown): number | null {
  let n: number | null = null;
  if (typeof v === "number") {
    n = v;
  } else if (typeof v === "string") {
    const digits = v.replace(/[^0-9.\-]/g, "");
    // Number("") is 0, so a string with no digits would otherwise land as a
    // real zero fee rather than as nothing extracted.
    n = digits === "" ? NaN : Number(digits);
  }
  if (n === null || !Number.isFinite(n) || n < 0 || n > 1e9) return null;
  return Math.round(n * 100) / 100;
}

/**
 * The trust boundary between model output and a contract record. Everything is
 * validated, and anything that fails becomes null rather than being written.
 */
export function parseSowDraft(raw: string): SowDraft {
  const empty: SowDraft = {
    title: null,
    reference: null,
    counterparty: null,
    governedBy: null,
    effectiveDate: null,
    total: null,
    paymentTerms: null,
    ourSignerName: null,
    ourSignedAt: null,
    theirSignerName: null,
    theirSignedAt: null,
    deliverables: [],
    unreadable: true,
  };

  const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return empty;

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return empty;
  }

  const rawList = Array.isArray(obj.deliverables) ? obj.deliverables : [];
  const deliverables: SowDeliverable[] = [];
  // Capped: a runaway list would be a misread, not a real SOW, and each entry
  // becomes a row in the project.
  for (const item of rawList.slice(0, 60)) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    const name = str(row.name, 200);
    // A deliverable with no name cannot be filed against anything.
    if (!name) continue;
    deliverables.push({
      name,
      spec: str(row.spec, 300),
      dueDate: day(row.dueDate),
      amount: money(row.amount),
    });
  }

  return {
    title: str(obj.title, 300),
    reference: str(obj.reference, 100),
    counterparty: str(obj.counterparty, 200),
    governedBy: str(obj.governedBy, 300),
    effectiveDate: day(obj.effectiveDate),
    total: money(obj.total),
    paymentTerms: str(obj.paymentTerms, 1000),
    ourSignerName: str(obj.ourSignerName, 200),
    ourSignedAt: day(obj.ourSignedAt),
    theirSignerName: str(obj.theirSignerName, 200),
    theirSignedAt: day(obj.theirSignedAt),
    deliverables,
    unreadable: obj.unreadable === true,
  };
}

/**
 * Reads a received SOW into a DRAFT. Writes nothing: the producer confirms
 * every field, and the deliverables are applied only if they choose to.
 */
export async function extractSow(doc: AiDocument): Promise<SowDraft> {
  const provider = aiProvider();
  const user =
    "Read this Statement of Work and return the JSON object described in the instructions.";
  // Generous: a SOW with a long fee table produces a lot of JSON, and on a
  // reasoning model this budget also covers the reasoning tokens.
  const maxTokens = 8000;

  const raw =
    provider === "openai"
      ? await openaiReadDocument(SOW_SYSTEM, user, doc, maxTokens)
      : provider === "anthropic"
        ? await anthropicReadDocument(SOW_SYSTEM, user, doc, maxTokens)
        : (() => {
            throw new Error("No AI provider configured.");
          })();

  return parseSowDraft(raw);
}

// ------------------------------------------------ shot list / storyboard in --

const SHOTDOC_SYSTEM = `You read a document from a film or commercial production and pull out its shot list and any storyboard captions.

Return ONLY a JSON object:
{
  "kind": "shot_list" | "storyboard" | "both" | "neither",
  "title": string | null,          // what the document calls itself
  "shots": [
    {
      "code": string | null,       // shot number or code exactly as printed, e.g. "1A", "12"
      "description": string | null,
      "size": string | null,       // WIDE, MS, CU, ECU, OTS, etc, as printed
      "type": string | null,       // the angle or setup, if given separately
      "movement": string | null,   // STATIC, PAN, DOLLY, HANDHELD, CRANE, etc
      "day": string | null,        // shoot day, if the document assigns one
      "notes": string | null,
      "page": number | null        // 1-based page this row came from
    }
  ],
  "pages": [
    { "page": number, "panels": number | null, "cols": number | null, "rows": number | null,
      "captions": [ string ] }
  ],
  "unreadable": boolean
}

Rules:
- Copy values as printed. Do not translate "MS" to "medium shot" or expand an abbreviation.
- Leave a field null rather than guessing it. A shot list with no movement column should return movement null on every row, not invented values.
- Never invent a shot. Every row you return must correspond to something written in the document.
- A creative treatment or a script counts. Much of this work arrives as a deck rather than a table: a numbered list of desired shots, or a script whose beats each describe one setup ("We see a closeup of the label, water dripping down"). Return one row per written beat or numbered item, description copied from the document, and leave size, type and movement null unless they are actually stated. Do not merge several written beats into one row or split one into several.
- On-screen text is not a shot. A SUPER, a title card, an end card or a line of voice over goes in notes, as printed, on the beat it is printed with. If a written beat is nothing but on-screen text, it earns no row of its own.
- Return every list the document holds. A script's beats and a separate list of desired shots or stills are different lists and both belong. Keep them in the order the document presents them, script first.
- The one exception is alternate CUTS of the same film, for example a :30 and a :15 of the same script. Those are the same shots trimmed to length, so return the longest cut only. A list of desired shots or stills is not an alternate cut and is always kept.
- pages describes the storyboard PANEL LAYOUT per page, when the document has drawn panels: how many panels, and the grid if it is regular. Give captions in reading order, left to right then down, one string per panel, empty string for a panel with no caption.
- If a page has no drawn panels, omit it from pages.
- kind is "both" when the document has drawn panels AND a shot table.
- If this is not a shot list or a storyboard, set unreadable true and return empty arrays.
- Do not use em dashes in any text you return.`;

/**
 * Read a production document.
 *
 * Takes either the PDF's extracted TEXT (cheap, exact, and what a digital PDF
 * gives us for free) or rendered page images when the PDF has no text layer,
 * which is what a scan or an image-only export produces.
 */
export async function extractShotDoc(
  input: { text: string } | { docs: AiDocument[] }
): Promise<ShotDocDraft> {
  const provider = aiProvider();
  const maxTokens = 12000;

  const raw = await (async () => {
    if ("text" in input) {
      const user = `Read this production document and return the JSON described in the instructions.\n\n${input.text.slice(0, 120000)}`;
      if (provider === "openai") return openaiComplete(SHOTDOC_SYSTEM, user, { maxTokens });
      if (provider === "anthropic") return anthropicComplete(SHOTDOC_SYSTEM, user, { maxTokens });
      throw new Error("No AI provider configured.");
    }
    // Image path: one call per page would be several round trips, so the pages
    // go in together and the model tags each row with the page it came from.
    const doc = input.docs[0];
    if (!doc) throw new Error("Nothing to read.");
    const user =
      "Read this production document and return the JSON described in the instructions.";
    if (provider === "openai")
      return openaiReadDocument(SHOTDOC_SYSTEM, user, doc, maxTokens);
    if (provider === "anthropic")
      return anthropicReadDocument(SHOTDOC_SYSTEM, user, doc, maxTokens);
    throw new Error("No AI provider configured.");
  })();

  return parseShotDocDraft(raw);
}
