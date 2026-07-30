// The tool loop. This is the one piece of genuinely new AI infrastructure the
// agent needs: everything else in lib/ai.ts is one-shot string in, string out,
// which cannot express "call a tool, read the result, decide what to do next".
//
// Provider-agnostic in the same way complete() is, but the two shapes differ
// more than they do for a plain completion:
//   Anthropic returns tool_use CONTENT BLOCKS inside the assistant message, and
//   expects results back as tool_result blocks inside a USER message.
//   OpenAI returns tool_calls as a FIELD on the assistant message, and expects
//   results back as separate messages with role "tool".
// So the conversation is held in one normalized shape (AgentMessage) and each
// provider converts on the way out. Nothing above this file knows which
// provider is running.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { aiProvider, ANTHROPIC_MODEL, OPENAI_MODEL } from "@/lib/ai";
import {
  parseArgs,
  toAnthropicMessages,
  toOpenAiMessages,
  type AgentMessage,
  type ToolCall,
  type ToolSchema,
  type TurnResult,
} from "@/lib/agent/messages";

export type {
  ToolSchema,
  ToolCall,
  AgentMessage,
  TurnResult,
} from "@/lib/agent/messages";

/**
 * The agent runs a harder task than the rest of the AI layer: it picks from
 * roughly twenty tools and often chains two or three. That is worth a better
 * model than a composer rewrite, but not worth silently spending more than the
 * deployment already budgets for, so it defaults to the configured model and
 * takes an explicit override.
 */
export function agentModel(): string {
  if (aiProvider() === "openai") {
    return process.env.OPENAI_AGENT_MODEL || OPENAI_MODEL;
  }
  return process.env.ANTHROPIC_AGENT_MODEL || ANTHROPIC_MODEL;
}

// Tool selection is reasoning, not recall, so this defaults higher than the
// "low" the status summary uses. Overridable because it trades latency for
// accuracy and the right point on that curve depends on the model in use.
const AGENT_EFFORT = process.env.OPENAI_AGENT_EFFORT || "medium";

function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model);
}

async function anthropicTurn(
  system: string,
  messages: AgentMessage[],
  tools: ToolSchema[]
): Promise<TurnResult> {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: agentModel(),
    max_tokens: 4000,
    system,
    // The converter builds the shape the API documents; the cast is to the
    // SDK's narrower union, which messages.ts deliberately does not depend on
    // so that it stays testable without the SDK.
    messages: toAnthropicMessages(messages) as Anthropic.MessageParam[],
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    })),
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const toolCalls = res.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map((b) => ({
      id: b.id,
      name: b.name,
      args: parseArgs(b.input),
    }));

  return { text, toolCalls };
}

// --- OpenAI (Chat Completions) ----------------------------------------------

async function openaiTurn(
  system: string,
  messages: AgentMessage[],
  tools: ToolSchema[]
): Promise<TurnResult> {
  const model = agentModel();
  const body: Record<string, unknown> = {
    model,
    max_completion_tokens: 4000,
    messages: toOpenAiMessages(system, messages),
    tools: tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    })),
  };
  if (isReasoningModel(model)) body.reasoning_effort = AGENT_EFFORT;

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
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: {
          id: string;
          function?: { name?: string; arguments?: string };
        }[];
      };
      finish_reason?: string;
    }[];
  };

  const choice = data.choices?.[0];
  const text = (choice?.message?.content ?? "").trim();
  const toolCalls = (choice?.message?.tool_calls ?? []).map((c) => ({
    id: c.id,
    name: c.function?.name ?? "",
    args: parseArgs(c.function?.arguments),
  }));

  // A reasoning model can spend the whole budget thinking and return nothing.
  // Say that plainly rather than showing an empty bubble.
  if (!text && !toolCalls.length && choice?.finish_reason === "length") {
    throw new Error("That answer ran too long to finish. Try asking for less at once.");
  }

  return { text, toolCalls };
}

/**
 * One round trip to the model. Returns whatever it said plus whatever tools it
 * wants called; the caller runs the tools and calls this again with the results
 * appended. The loop itself lives in the route handler so it can report each
 * step to the browser as it happens.
 */
export async function runTurn(opts: {
  system: string;
  messages: AgentMessage[];
  tools: ToolSchema[];
}): Promise<TurnResult> {
  const provider = aiProvider();
  if (provider === "openai") return openaiTurn(opts.system, opts.messages, opts.tools);
  if (provider === "anthropic")
    return anthropicTurn(opts.system, opts.messages, opts.tools);
  throw new Error("No AI provider configured.");
}
