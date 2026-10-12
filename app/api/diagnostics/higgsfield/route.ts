import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStudioContext } from "@/lib/studio";
import { getHiggsfieldToken, hfRef, HiggsfieldMcp } from "@/lib/higgsfield-mcp";

// THE HIGGSFIELD PROBE, built before any feature, for the reason the BILL one
// was: an MCP tool is described for an AI agent rather than published as an
// API, so its name and its input shape are learned by asking the live server,
// never from memory. This prints exactly what Higgsfield answers.
//
// READ ONLY. It opens a session, lists the tools, and can call a tool only from
// READ_ONLY below, so pressing it can never spend a credit. A generation test
// is a separate, deliberate step and does not live here.
//
// Pressing it: open /api/diagnostics/higgsfield while signed in to Studio
// Flows with Higgsfield connected in Settings. ?call=<tool>&args=<json> runs
// one more read-only tool. Add &x=N with a new N each press, since a browser
// can serve a GET from its cache and a stale answer looks like a real one.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROBE = "2026-10-12-a";

// Tools whose names say they only read. Checked against the live list too: a
// tool is called only if it is here AND the server lists it.
const READ_ONLY = new Set([
  "balance",
  "show_plans_and_credits",
  "list_workspaces",
  "show_reference_elements",
  "show_generations",
  "models_explore",
  "get_preferences",
  "list_projects",
]);

type Tool = {
  name?: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown>; required?: string[] };
  annotations?: Record<string, unknown>;
};

export async function GET(req: Request) {
  const ctx = await getStudioContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (ctx.isCollaborator) {
    return NextResponse.json({ error: "Not available on this account." }, { status: 403 });
  }

  const url = new URL(req.url);
  const supabase = createClient();
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, email, access_token, refresh_token, token_expiry, external_ref, created_at")
    .eq("provider", "higgsfield")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({
      probe: PROBE,
      reading: "No Higgsfield connection for this user. Connect it in Settings, Connections, then press this again.",
    });
  }

  const steps: Record<string, unknown> = {
    account: {
      email: account.email,
      connected: account.created_at,
      tokenExpiry: account.token_expiry,
      hasRefreshToken: Boolean(account.refresh_token),
      clientId: hfRef(account.external_ref)?.client_id ?? null,
    },
  };

  let token: string;
  try {
    token = await getHiggsfieldToken(supabase, account);
    steps.token = "ok";
  } catch (e) {
    return NextResponse.json({
      probe: PROBE,
      reading: "Could not get a working token. Reconnecting Higgsfield in Settings is the fix.",
      steps: { ...steps, token: e instanceof Error ? e.message : String(e) },
    });
  }

  const mcp = new HiggsfieldMcp(token);
  try {
    const init = await mcp.open();
    steps.initialize = {
      status: init.status,
      contentType: init.contentType,
      result: init.message?.result ?? null,
      error: init.message?.error ?? null,
      raw: init.message ? undefined : init.raw,
    };
    if (!init.message?.result) {
      return NextResponse.json({
        probe: PROBE,
        reading: `Higgsfield refused to open a session (HTTP ${init.status}). The raw body is under steps.initialize.`,
        steps,
      });
    }

    // Every page of the tool list, since a server may paginate it.
    const tools: Tool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const r = await mcp.request("tools/list", cursor ? { cursor } : {});
      const result = r.message?.result as { tools?: Tool[]; nextCursor?: string } | undefined;
      if (!result) {
        steps.toolsList = { status: r.status, error: r.message?.error ?? null, raw: r.raw };
        break;
      }
      tools.push(...(result.tools ?? []));
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    steps.tools = tools.map((t) => ({
      name: t.name,
      readOnly: t.annotations?.readOnlyHint ?? null,
      destructive: t.annotations?.destructiveHint ?? null,
      takes: Object.keys(t.inputSchema?.properties ?? {}),
      required: t.inputSchema?.required ?? [],
      about: (t.description ?? "").replace(/\s+/g, " ").slice(0, 240),
    }));

    // The tools a "make this frame real" button would lean on, in full, so
    // their exact input shape is on the page rather than guessed.
    const watch = ["generate_image", "media_upload", "media_confirm", "media_import_url", "jobs_wait", "show_generation_by_ids", "balance"];
    steps.watchedSchemas = Object.fromEntries(
      tools
        .filter((t) => t.name && watch.includes(t.name))
        .map((t) => [t.name, { inputSchema: t.inputSchema, annotations: t.annotations ?? null }])
    );

    const listed = new Set(tools.map((t) => t.name));
    const call = url.searchParams.get("call") ?? (listed.has("balance") ? "balance" : null);
    if (call) {
      if (!READ_ONLY.has(call)) {
        steps.call = { refused: `${call} is not on this probe's read-only list.` };
      } else if (!listed.has(call)) {
        steps.call = { refused: `Higgsfield does not list a tool called ${call}.` };
      } else {
        let args: unknown = {};
        try {
          args = JSON.parse(url.searchParams.get("args") ?? "{}");
        } catch {
          args = {};
        }
        const r = await mcp.request("tools/call", { name: call, arguments: args });
        steps.call = {
          name: call,
          status: r.status,
          result: r.message?.result ?? null,
          error: r.message?.error ?? null,
          raw: r.message ? undefined : r.raw,
        };
      }
    }

    return NextResponse.json({
      probe: PROBE,
      reading: `Session opened and ${tools.length} tools listed.`,
      steps,
    });
  } catch (e) {
    return NextResponse.json({
      probe: PROBE,
      reading: "The request to Higgsfield failed before an answer came back.",
      steps: { ...steps, failure: e instanceof Error ? e.message : String(e) },
    });
  } finally {
    await mcp.close();
  }
}
