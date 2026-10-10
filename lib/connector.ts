import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { hashConnectorToken, looksLikeToken } from "@/lib/connector-token";
import { READ_TOOLS } from "@/lib/agent/tools";
import { SCHEMA_CATALOG, allowedColumns } from "@/lib/agent/schema-map";
import {
  search,
  getProject,
  getMoney,
  getCrm,
  getAttention,
  query,
} from "@/lib/agent/read-tools";
import type { McpTool } from "@/lib/mcp";

/**
 * The AI connector's server half: who a link belongs to, a session as that
 * person, and the tools. READ ONLY, deliberately and by construction: only
 * Runner's read tools are offered and none of them has a code path that
 * writes. Over MCP the tool call IS the action (the host shows a generic
 * "allow this tool?" over JSON rather than our readable card), so writes wait
 * until there is a confirmation a producer can actually check.
 */

export type ConnectorOwner = {
  tokenId: string;
  studioId: string;
  studioName: string;
  userId: string;
};

/**
 * A live link and its owner, or null. The owner must STILL be a studio member
 * (a membership row, so never a project collaborator): removing somebody from
 * the studio kills every link they made, with nothing to remember to revoke.
 */
export async function resolveConnectorToken(token: string): Promise<ConnectorOwner | null> {
  if (!serviceConfigured() || !looksLikeToken(token)) return null;
  const svc = createServiceClient();
  const { data: row } = await svc
    .from("connector_tokens")
    .select("id, studio_id, user_id, revoked_at, last_used_at")
    .eq("token_hash", hashConnectorToken(token))
    .maybeSingle();
  if (!row || row.revoked_at) return null;

  const [{ data: member }, { data: studio }] = await Promise.all([
    svc
      .from("memberships")
      .select("id")
      .eq("studio_id", row.studio_id)
      .eq("user_id", row.user_id)
      .maybeSingle(),
    svc.from("studios").select("name").eq("id", row.studio_id).maybeSingle(),
  ]);
  if (!member || !studio) return null;

  // "Last used" is for spotting a link nobody uses any more, so minute-level
  // freshness is pointless; one write per ten minutes at most.
  const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
  if (Date.now() - last > 10 * 60_000) {
    await svc
      .from("connector_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id);
  }
  return { tokenId: row.id, studioId: row.studio_id, studioName: studio.name, userId: row.user_id };
}

// --- a session as the link's owner -------------------------------------------

type Cached = { access: string; expiresAt: number };
const sessions = new Map<string, Cached>();

/**
 * Signs in as the owner, server side, with no email sent: an admin magic link
 * is generated and immediately exchanged for a session. That gives a REAL
 * user JWT, so every read below runs under the same RLS as the app, rather
 * than a service-role client that would have to re-derive tenancy by hand.
 *
 * Cached per user on the warm instance until five minutes before expiry, so a
 * conversation of thirty tool calls is one sign-in, not thirty.
 */
async function accessTokenFor(userId: string): Promise<string> {
  const hit = sessions.get(userId);
  if (hit && hit.expiresAt - Date.now() > 5 * 60_000) return hit.access;

  const svc = createServiceClient();
  const { data: user, error: userErr } = await svc.auth.admin.getUserById(userId);
  const email = user?.user?.email;
  if (userErr || !email) throw new Error("The person who made this link could not be found.");

  const { data: link, error: linkErr } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hashed = link?.properties?.hashed_token;
  if (linkErr || !hashed) throw new Error("Could not open a session for this link.");

  const anon = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashed,
  });
  const session = verified?.session;
  if (verifyErr || !session) throw new Error("Could not open a session for this link.");

  const expiresAt = (session.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000;
  sessions.set(userId, { access: session.access_token, expiresAt });
  return session.access_token;
}

export async function userClient(userId: string): Promise<SupabaseClient<Database>> {
  const access = await accessTokenFor(userId);
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${access}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  );
}

// --- tools -------------------------------------------------------------------

const CATALOG_NOTE =
  "Tables you can read, as name(columns). `:num` marks a number, [a|b] lists the allowed values:\n";

/**
 * Runner's read tools, unchanged except that `query` carries the schema in its
 * own description: Runner gets it from a system prompt, and a host that drops
 * the server instructions (some do) would otherwise be querying blind.
 */
export const CONNECTOR_TOOLS: McpTool[] = READ_TOOLS.map((t) => ({
  name: t.name,
  description:
    t.name === "query"
      ? t.description.replace("The schema is in your instructions.", "") + "\n\n" + CATALOG_NOTE + SCHEMA_CATALOG
      : t.description,
  inputSchema: t.parameters,
  annotations: { readOnlyHint: true, openWorldHint: false },
}));

type ReadFn = (args: Record<string, unknown>) => Promise<unknown>;

const READERS: Record<string, ReadFn> = {
  search,
  get_project: getProject,
  get_money: getMoney,
  get_crm: getCrm,
  get_attention: () => getAttention(),
  query,
};

/**
 * Runs one tool. `query` is pinned to the link's studio, because RLS scopes
 * rows to the PERSON, and a person in two studios would otherwise get a
 * blend of both in answer to a question about one.
 */
export async function runConnectorTool(
  owner: ConnectorOwner,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const fn = READERS[name];
  if (!fn) return { error: `Unknown tool "${name}".` };
  if (name === "query") {
    const table = String(args.table ?? "");
    const col = table === "studios" ? "id" : "studio_id";
    if (allowedColumns(table).includes(col)) {
      const filters = Array.isArray(args.filters) ? args.filters : [];
      args = { ...args, filters: [...filters, { column: col, op: "eq", value: owner.studioId }] };
    }
  }
  return fn(args);
}

export function connectorInstructions(owner: ConnectorOwner): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `You are connected to Studio Flows, the production hub for ${owner.studioName}, a commercial production studio. Today is ${today}.`,
    "This connection is READ ONLY. You can look things up; you cannot create, change or send anything. If the producer asks for a change, tell them what to do in Studio Flows instead of claiming it is done.",
    "Start with `search` when they name a project, client, deal or person, so you have its id. `get_project` takes only the sections you need. `get_money` is what is owed, billed and the margin. `get_crm` is the sales side. `get_attention` is what is at risk right now. `query` reads any listed table when nothing else fits.",
    "Money amounts are US dollars. Dates are YYYY-MM-DD. Speak in production terms (projects, shoots, deliverables, call sheets, approvals), not table names.",
  ].join("\n\n");
}
