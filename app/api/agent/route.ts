// The assistant's turn loop.
//
// A Route Handler rather than a Server Action, for one concrete reason:
// maxDuration is a property of the route segment, and a Server Action inherits
// it from whichever page called it. The assistant is reachable from every page
// in the app, so as a Server Action its time limit would be whatever the
// current page happened to declare, and a three-hop answer would die on some
// routes and not others. Here it owns its own budget.
//
// The response is a stream of newline-delimited JSON events rather than one
// JSON body, so the browser can say "reading Hint's budget" while it happens.
// The final answer text is not token-streamed (that means accumulating partial
// tool-call fragments on both providers, which is a lot of fiddly code for a
// paragraph); what is streamed is the STEPS, which is where the wait actually
// is.
import { NextResponse } from "next/server";
import { getStudioContext } from "@/lib/studio";
import { createClient } from "@/lib/supabase/server";
import { canUseRunner } from "@/lib/agent/access";
import { aiConfigured } from "@/lib/ai";
import { runTurn, type AgentMessage, type ToolCall } from "@/lib/agent/loop";
import { dropOrphanToolResults } from "@/lib/agent/messages";
import { ALL_TOOLS, cardKindFromTool, systemPrompt } from "@/lib/agent/tools";
import { buildCard, isCardError, isCardKind, type ActionCard } from "@/lib/agent/cards";
import {
  search,
  getProject,
  getMoney,
  getCrm,
  getAttention,
  query,
} from "@/lib/agent/read-tools";
import { reportError } from "@/lib/log";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// How many times the model may go back for more before it has to answer. Six
// is generous for the questions this thing gets asked (search, then two or
// three reads) and low enough that a confused model cannot spin.
const MAX_STEPS = 6;

// Tool results are model input. A ledger with three hundred rows helps nobody
// and costs real money, so an oversized result is truncated with a note saying
// so, which the model can act on by narrowing its query.
const MAX_RESULT_CHARS = 24_000;

// Only the tail of a long conversation is replayed. Everything before it is
// still on screen and still in the database, it just stops being context.
const HISTORY_LIMIT = 40;

type ReadFn = (args: Record<string, unknown>) => Promise<unknown>;

const READERS: Record<string, ReadFn> = {
  search,
  get_project: getProject,
  get_money: getMoney,
  get_crm: getCrm,
  get_attention: () => getAttention(),
  query,
};

// What the browser shows while a tool runs. Named for the producer, not for
// the function.
const STEP_LABEL: Record<string, string> = {
  search: "Looking that up",
  get_project: "Reading the project",
  get_money: "Checking the money",
  get_crm: "Checking the pipeline",
  get_attention: "Checking what needs you",
  query: "Querying",
};

type ClientRequest = {
  text?: string;
  threadId?: string | null;
  projectId?: string | null;
};

export async function POST(req: Request) {
  const ctx = await getStudioContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  // This is one of the two real gates (the other is confirmCard). Hiding the
  // nav row is presentation; a request still has to pass here.
  if (!canUseRunner(ctx)) {
    return NextResponse.json(
      {
        error: aiConfigured()
          ? "Runner is not available on this account."
          : "No AI provider is configured on this deployment.",
      },
      { status: aiConfigured() ? 403 : 503 }
    );
  }

  let body: ClientRequest;
  try {
    body = (await req.json()) as ClientRequest;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const text = (body.text ?? "").trim().slice(0, 4000);
  if (!text) {
    return NextResponse.json({ error: "Say something first." }, { status: 400 });
  }

  const supabase = createClient();

  // Resolve the selected project. Read it back rather than trusting the id from
  // the browser, both to get its title for the prompt and to confirm it is one
  // this user can actually see.
  let project: { id: string; title: string } | null = null;
  if (body.projectId) {
    const { data } = await supabase
      .from("projects")
      .select("id, title")
      .eq("id", body.projectId)
      .maybeSingle();
    if (data) project = { id: data.id, title: data.title };
  }

  // Thread: continue the one named, or open a new one titled with the question.
  let threadId = body.threadId ?? null;
  if (threadId) {
    const { data } = await supabase
      .from("agent_threads")
      .select("id")
      .eq("id", threadId)
      .maybeSingle();
    if (!data) threadId = null;
  }
  if (!threadId) {
    const { data, error } = await supabase
      .from("agent_threads")
      .insert({
        studio_id: ctx.studio.id,
        user_id: ctx.userId,
        project_id: project?.id ?? null,
        title: text.slice(0, 80),
      })
      .select("id")
      .single();
    if (error || !data) {
      reportError("agent/thread-insert", error);
      return NextResponse.json(
        { error: "Could not start that conversation." },
        { status: 500 }
      );
    }
    threadId = data.id;
  }

  const history = await loadHistory(supabase, threadId);
  const messages: AgentMessage[] = [...history, { role: "user", content: text }];

  await saveMessage(supabase, {
    threadId,
    studioId: ctx.studio.id,
    userId: ctx.userId,
    role: "user",
    content: text,
  });

  // Stamp the thread as used. Without this updated_at stays at creation time,
  // and the rule that decides whether to resume a conversation ("was this used
  // in the last few hours") would be answering about when it STARTED, so a
  // thread opened this morning and used all day would stop being resumable
  // halfway through the afternoon.
  await supabase
    .from("agent_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  const system = systemPrompt({
    studioName: ctx.studio.name,
    userEmail: ctx.email,
    today: new Date().toISOString().slice(0, 10),
    project,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      send({ type: "thread", threadId });

      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const turn = await runTurn({ system, messages, tools: ALL_TOOLS });

          if (!turn.toolCalls.length) {
            const answer =
              turn.text ||
              "I did not get anywhere with that. Try asking it a different way.";
            await saveMessage(supabase, {
              threadId,
              studioId: ctx.studio.id,
              userId: ctx.userId,
              role: "assistant",
              content: answer,
            });
            send({ type: "text", text: answer });
            send({ type: "done" });
            controller.close();
            return;
          }

          // Announce every step before running any of them, so the browser
          // shows the whole batch rather than one line at a time.
          for (const call of turn.toolCalls) {
            send({
              type: "step",
              tool: call.name,
              label: stepLabel(call),
            });
          }

          const results: { call: ToolCall; content: string }[] = [];
          const cards: ActionCard[] = [];

          for (const call of turn.toolCalls) {
            const outcome = await runTool(call);
            if (outcome.card) {
              cards.push(outcome.card);
              send({ type: "card", card: outcome.card });
            }
            results.push({ call, content: outcome.content });
          }

          await saveMessage(supabase, {
            threadId,
            studioId: ctx.studio.id,
            userId: ctx.userId,
            role: "assistant",
            content: turn.text,
            toolCalls: turn.toolCalls,
            cards: cards.length ? cards : null,
          });
          if (turn.text.trim()) send({ type: "text", text: turn.text });

          messages.push({
            role: "assistant",
            content: turn.text,
            toolCalls: turn.toolCalls,
          });

          for (const r of results) {
            await saveMessage(supabase, {
              threadId,
              studioId: ctx.studio.id,
              userId: ctx.userId,
              role: "tool",
              content: r.content,
              callId: r.call.id,
              toolName: r.call.name,
            });
            messages.push({
              role: "tool",
              callId: r.call.id,
              name: r.call.name,
              content: r.content,
            });
          }
        }

        // Ran out of steps. Say so rather than going quiet: it means the model
        // kept reaching for more instead of answering, and the honest move is
        // to hand it back rather than pretend that was an answer.
        const stuck =
          "I went round a few times without landing on an answer. Try narrowing the question.";
        await saveMessage(supabase, {
          threadId,
          studioId: ctx.studio.id,
          userId: ctx.userId,
          role: "assistant",
          content: stuck,
        });
        send({ type: "text", text: stuck });
        send({ type: "done" });
        controller.close();
      } catch (e) {
        reportError("agent/turn", e);
        send({
          type: "error",
          message:
            e instanceof Error ? e.message : "Something went wrong answering that.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Proxies that buffer would defeat the point of streaming the steps.
      "X-Accel-Buffering": "no",
    },
  });
}

function stepLabel(call: ToolCall): string {
  const kind = cardKindFromTool(call.name);
  if (kind) return "Putting that up to confirm";
  if (call.name === "query") {
    const table = typeof call.args.table === "string" ? call.args.table : "";
    return table ? `Querying ${table.replace(/_/g, " ")}` : "Querying";
  }
  return STEP_LABEL[call.name] ?? "Working";
}

/**
 * Runs one tool call. A read really runs. A propose_* call builds a card and
 * writes nothing, and the string handed back to the model says so in as many
 * words, because the one thing that must never happen is the model believing
 * it has saved something.
 */
async function runTool(
  call: ToolCall
): Promise<{ content: string; card?: ActionCard }> {
  const kind = cardKindFromTool(call.name);

  if (kind) {
    if (!isCardKind(kind)) {
      return { content: `There is no "${call.name}" action.` };
    }
    try {
      const built = await buildCard(kind, call.args);
      if (isCardError(built)) {
        return { content: `Could not propose that: ${built.error}` };
      }
      return {
        content: `PROPOSED, not saved: ${built.summary}. The producer now has a card to confirm or cancel. Tell them what is waiting for them; do not say it is done.`,
        card: built,
      };
    } catch (e) {
      reportError(`agent/propose/${kind}`, e);
      return { content: "That proposal failed to build." };
    }
  }

  const reader = READERS[call.name];
  if (!reader) return { content: `There is no tool called "${call.name}".` };

  try {
    const result = await reader(call.args);
    const json = JSON.stringify(result ?? null);
    if (json.length > MAX_RESULT_CHARS) {
      return {
        content:
          json.slice(0, MAX_RESULT_CHARS) +
          '\n\n[truncated: too much data. Narrow it with filters or a smaller limit.]',
      };
    }
    return { content: json };
  } catch (e) {
    reportError(`agent/read/${call.name}`, e);
    return {
      content: `That lookup failed: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }
}

type Db = ReturnType<typeof createClient>;

async function loadHistory(supabase: Db, threadId: string): Promise<AgentMessage[]> {
  const { data } = await supabase
    .from("agent_messages")
    .select("role, content, tool_calls, call_id, tool_name, seq")
    .eq("thread_id", threadId)
    .order("seq", { ascending: false })
    .limit(HISTORY_LIMIT);

  const rows = (data ?? []).slice().reverse();
  const out: AgentMessage[] = [];

  for (const r of rows) {
    if (r.role === "user") {
      out.push({ role: "user", content: r.content });
    } else if (r.role === "assistant") {
      out.push({
        role: "assistant",
        content: r.content,
        toolCalls: Array.isArray(r.tool_calls) ? (r.tool_calls as ToolCall[]) : [],
      });
    } else if (r.role === "tool" && r.call_id) {
      out.push({
        role: "tool",
        callId: r.call_id,
        name: r.tool_name ?? "",
        content: r.content,
      });
    }
  }

  return dropOrphanToolResults(out);
}

async function saveMessage(
  supabase: Db,
  row: {
    threadId: string;
    studioId: string;
    userId: string;
    role: "user" | "assistant" | "tool";
    content: string;
    toolCalls?: ToolCall[];
    callId?: string;
    toolName?: string;
    cards?: ActionCard[] | null;
  }
) {
  const { error } = await supabase.from("agent_messages").insert({
    thread_id: row.threadId,
    studio_id: row.studioId,
    user_id: row.userId,
    role: row.role,
    content: row.content ?? "",
    tool_calls: row.toolCalls?.length ? JSON.parse(JSON.stringify(row.toolCalls)) : null,
    call_id: row.callId ?? null,
    tool_name: row.toolName ?? null,
    cards: row.cards ? JSON.parse(JSON.stringify(row.cards)) : null,
  });
  if (error) reportError("agent/message-insert", error);
}
