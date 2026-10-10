/**
 * The Model Context Protocol, the small part of it this connector speaks.
 *
 * Hand-written rather than pulled in as an SDK because the surface is tiny
 * (initialize, ping, tools/list, tools/call over one HTTP POST that answers
 * with JSON) and the SDK's server transport assumes a long-lived Node server,
 * which a Vercel function is not. Streamable HTTP explicitly allows a server
 * to answer a POST with a plain JSON body, so no SSE stream is needed.
 *
 * NOT `server-only` and free of app imports, so it is unit tested.
 */

export const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const LATEST_VERSION = SUPPORTED_VERSIONS[0];

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

export type RpcRequest = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

export type RpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | {
      jsonrpc: "2.0";
      id: string | number | null;
      error: { code: number; message: string };
    };

export type McpDeps = {
  serverName: string;
  serverVersion: string;
  instructions: string;
  tools: McpTool[];
  /** Runs a tool. Throwing is reported to the model as a tool error. */
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Tool results are model input; anything longer is cut with a note. */
  maxResultChars: number;
};

/** The version the client asked for when we speak it, else our latest. */
export function negotiateVersion(asked: unknown): string {
  return typeof asked === "string" &&
    (SUPPORTED_VERSIONS as readonly string[]).includes(asked)
    ? asked
    : LATEST_VERSION;
}

function validId(id: unknown): id is string | number {
  return typeof id === "string" || (typeof id === "number" && Number.isFinite(id));
}

function err(id: string | number | null, code: number, message: string): RpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return (
    text.slice(0, max) +
    `\n\n[Cut at ${max} characters. Narrow the request (fewer sections, a filter, a lower limit) to see the rest.]`
  );
}

/**
 * One JSON-RPC message in, one response out, or null for a notification
 * (a message with no id), which gets no reply by definition.
 */
export async function handleRpc(msg: unknown, deps: McpDeps): Promise<RpcResponse | null> {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
    return err(null, -32600, "Invalid request.");
  }
  const m = msg as RpcRequest;
  const isNotification = !("id" in m) || m.id === undefined;
  if (typeof m.method !== "string") {
    return isNotification ? null : err(validId(m.id) ? m.id : null, -32600, "Invalid request.");
  }
  if (isNotification) return null;
  if (!validId(m.id)) return err(null, -32600, "Invalid request id.");
  const id = m.id;
  const params = (m.params && typeof m.params === "object" ? m.params : {}) as Record<string, unknown>;

  switch (m.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negotiateVersion(params.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: deps.serverName, version: deps.serverVersion },
          instructions: deps.instructions,
        },
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: deps.tools } };
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      if (!deps.tools.some((t) => t.name === name)) {
        return err(id, -32602, `Unknown tool "${name}".`);
      }
      const args =
        params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
          ? (params.arguments as Record<string, unknown>)
          : {};
      // A tool failure is a RESULT with isError, not a protocol error: the
      // model is meant to read it and try again, the same contract Runner's
      // tools have always had.
      try {
        const out = await deps.callTool(name, args);
        const text = clip(JSON.stringify(out ?? null), deps.maxResultChars);
        const isError =
          !!out && typeof out === "object" && "error" in (out as Record<string, unknown>);
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text }], isError },
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : "The tool failed.";
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: `Error: ${message}` }], isError: true },
        };
      }
    }
    // Capabilities we do not declare, answered politely rather than with
    // "method not found", since some clients probe them regardless.
    case "resources/list":
      return { jsonrpc: "2.0", id, result: { resources: [] } };
    case "prompts/list":
      return { jsonrpc: "2.0", id, result: { prompts: [] } };
    default:
      return err(id, -32601, `Method "${m.method}" is not supported.`);
  }
}

/** A POST body is one message or a batch (2025-03-26 and earlier). */
export async function handleBody(
  body: unknown,
  deps: McpDeps
): Promise<RpcResponse | RpcResponse[] | null> {
  if (Array.isArray(body)) {
    if (!body.length) return err(null, -32600, "Empty batch.");
    const out = (await Promise.all(body.map((m) => handleRpc(m, deps)))).filter(
      (r): r is RpcResponse => r !== null
    );
    return out.length ? out : null;
  }
  return handleRpc(body, deps);
}
