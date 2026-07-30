// Conversation shape conversion, kept out of loop.ts so it can be exercised
// on its own. This is the part most likely to be quietly wrong: both providers
// reject a history that is structurally invalid, and the failure arrives as a
// 400 from an API rather than as anything readable.
//
// No "server-only" here on purpose. There is no I/O and no secret in this
// file, and being importable is what makes it testable.

/** A tool as described to the model. `parameters` is a JSON Schema object. */
export type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** One call the model wants made. `args` is already parsed from JSON. */
export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

/**
 * The normalized conversation. A "tool" message is the result we handed back
 * for a specific call, keyed by callId so both providers can re-associate it.
 */
export type AgentMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: ToolCall[] }
  | { role: "tool"; callId: string; name: string; content: string };

export type TurnResult = { text: string; toolCalls: ToolCall[] };

/** Parse a tool-call argument blob without letting bad JSON kill the turn. */
export function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // A malformed argument string is the model's mistake, not a server fault.
    // An empty object makes the tool reject it and say why, which the model can
    // then correct on the next turn.
    return {};
  }
}

// Loose structural types for the two provider payloads. Deliberately not the
// SDK's own types: this file describes the shape being built, and loop.ts casts
// to the SDK type at the call site.
export type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicBlock[];
};

/**
 * Anthropic carries tool calls as content BLOCKS inside the assistant message,
 * and expects every result for that turn back in a SINGLE user message. Sending
 * one user message per result is rejected, which is why the run of consecutive
 * tool messages is consumed together rather than mapped one to one.
 */
export function toAnthropicMessages(messages: AgentMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  let i = 0;

  while (i < messages.length) {
    const m = messages[i];

    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
      i++;
      continue;
    }

    if (m.role === "assistant") {
      const blocks: AnthropicBlock[] = [];
      if (m.content.trim()) blocks.push({ type: "text", text: m.content });
      for (const call of m.toolCalls) {
        blocks.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.args,
        });
      }
      // An assistant turn with neither text nor tools cannot be sent, and
      // dropping it is harmless because it carried nothing.
      if (blocks.length) out.push({ role: "assistant", content: blocks });
      i++;
      continue;
    }

    const results: AnthropicBlock[] = [];
    while (i < messages.length && messages[i].role === "tool") {
      const t = messages[i] as Extract<AgentMessage, { role: "tool" }>;
      results.push({
        type: "tool_result",
        tool_use_id: t.callId,
        content: t.content,
      });
      i++;
    }
    out.push({ role: "user", content: results });
  }

  return out;
}

export type OpenAiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
};

/**
 * OpenAI carries tool calls as a FIELD on the assistant message and expects
 * each result as its own message with role "tool". Content is null rather than
 * "" on a pure tool-calling turn, which is what the API returns and what it
 * expects back.
 */
export function toOpenAiMessages(
  system: string,
  messages: AgentMessage[]
): OpenAiMessage[] {
  const out: OpenAiMessage[] = [{ role: "system", content: system }];

  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      out.push({
        role: "assistant",
        content: m.content || null,
        ...(m.toolCalls.length
          ? {
              tool_calls: m.toolCalls.map((c) => ({
                id: c.id,
                type: "function" as const,
                function: { name: c.name, arguments: JSON.stringify(c.args) },
              })),
            }
          : {}),
      });
      continue;
    }
    out.push({ role: "tool", tool_call_id: m.callId, content: m.content });
  }

  return out;
}

/**
 * A history window can cut mid-turn, leaving tool results whose assistant
 * message fell off the front. Both providers reject that, so the orphans are
 * dropped before the history is sent.
 */
export function dropOrphanToolResults(messages: AgentMessage[]): AgentMessage[] {
  const out = messages.slice();
  while (out.length && out[0].role === "tool") out.shift();
  return out;
}
