import "server-only";
// One open MCP session on the CALLER's own Higgsfield account, and one tool
// call on it. Shared by "Make it real" in the Scene builder and the AI
// pipeline's "From Higgsfield" picker. The connection is looked up by user,
// so whatever it reads or spends is the caller's own plan.
import { createClient } from "@/lib/supabase/server";
import { getHiggsfieldToken, HiggsfieldMcp } from "@/lib/higgsfield-mcp";
import { resultData, resultText, type ToolResult } from "@/lib/higgsfield-result";

/** An open MCP session on the caller's own Higgsfield account. */
export async function openHiggsfield(userId: string): Promise<{ mcp: HiggsfieldMcp } | { error: string; notConnected?: true }> {
  const supabase = createClient();
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry, external_ref")
    .eq("provider", "higgsfield")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!account) return { error: "Connect Higgsfield in Settings, Connections first.", notConnected: true };
  let token: string;
  try {
    token = await getHiggsfieldToken(supabase, account);
  } catch {
    return { error: "Higgsfield needs reconnecting in Settings, Connections.", notConnected: true };
  }
  const mcp = new HiggsfieldMcp(token);
  const init = await mcp.open();
  if (!init.message?.result) {
    return init.status === 401
      ? { error: "Higgsfield needs reconnecting in Settings, Connections.", notConnected: true }
      : { error: `Higgsfield did not answer (HTTP ${init.status}). Try again in a moment.` };
  }
  return { mcp };
}

/** One tool call. A tool that reports a failure comes back as its own sentence. */
export async function callTool(mcp: HiggsfieldMcp, name: string, args: unknown): Promise<{ data: unknown; text: string } | { error: string }> {
  const r = await mcp.request("tools/call", { name, arguments: args });
  if (!r.message) return { error: `Higgsfield sent back something unreadable (HTTP ${r.status}).` };
  if (r.message.error) return { error: r.message.error.message || `Higgsfield refused ${name}.` };
  const result = r.message.result as ToolResult | undefined;
  const text = resultText(result);
  if (result?.isError) return { error: text.slice(0, 400) || `Higgsfield refused ${name}.` };
  return { data: resultData(result), text };
}

