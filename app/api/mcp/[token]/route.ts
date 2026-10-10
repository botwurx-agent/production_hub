import { NextResponse } from "next/server";
import { handleBody } from "@/lib/mcp";
import {
  CONNECTOR_TOOLS,
  connectorInstructions,
  resolveConnectorToken,
  runConnectorTool,
  userClient,
} from "@/lib/connector";
import { runAsUser } from "@/lib/supabase/run-as";
import { allow } from "@/lib/rate-limit";
import { hashConnectorToken } from "@/lib/connector-token";
import { reportError } from "@/lib/log";

// The AI connector: an MCP server that Claude or ChatGPT reaches at
// /api/mcp/<token>. Public in the middleware because the link IS the
// credential; everything below resolves it before anything is read.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_RESULT_CHARS = 24_000;

function rpcError(status: number, message: string) {
  // Deliberately never 401: a 401 makes the host start an OAuth sign-in this
  // server does not offer, and the producer sees a login loop instead of the
  // sentence that says the link was turned off.
  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message } },
    { status }
  );
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const token = params.token ?? "";
  // Per link, not per IP: the host's servers make the calls, and a busy
  // assistant chaining tools is the normal case, a thousand a minute is not.
  if (!allow(`mcp:${hashConnectorToken(token).slice(0, 16)}`, 120, 60_000)) {
    return rpcError(429, "Too many requests on this link. Wait a minute and try again.");
  }

  const owner = await resolveConnectorToken(token);
  if (!owner) {
    return rpcError(
      404,
      "This Studio Flows link is not active. Make a new one in Studio Flows, Settings, AI connector."
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } },
      { status: 400 }
    );
  }

  // The session is only opened when a tool actually runs: initialize and
  // tools/list happen on every connect and need nothing from the database.
  let client: Awaited<ReturnType<typeof userClient>> | null = null;
  const res = await handleBody(body, {
    serverName: "Studio Flows",
    serverVersion: "1.0.0",
    instructions: connectorInstructions(owner),
    tools: CONNECTOR_TOOLS,
    maxResultChars: MAX_RESULT_CHARS,
    callTool: async (name, args) => {
      try {
        client ??= await userClient(owner.userId);
        const c = client;
        return await runAsUser(c, () => runConnectorTool(owner, name, args));
      } catch (e) {
        reportError(`mcp/tool/${name}`, e);
        throw e;
      }
    },
  });

  if (res === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(res);
}

// No server-to-client stream and no session to end: say so plainly, which is
// what the spec asks of a server that only answers POSTs.
export function GET() {
  return new NextResponse("This is an MCP endpoint. Add it to Claude or ChatGPT as a connector.", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
