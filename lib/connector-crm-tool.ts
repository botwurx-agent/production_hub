import "server-only";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { nameKey } from "@/lib/connector-records";
import {
  activityKey,
  MAX_ACTIVITIES,
  MAX_FOLLOW_UPS,
  parseActivities,
  parseDeal,
  parseFollowUps,
  type ActivityInput,
  type FollowUpInput,
} from "@/lib/connector-crm";
import type { ConnectorOwner } from "@/lib/connector";
import type { McpTool } from "@/lib/mcp";

/**
 * add_deal and log_crm over the connector: the sales side of Studio Flows.
 *
 * They insert the rows createDeal, logActivity and addTask write, through the
 * owner's borrowed RLS client, so the boundary is the same; they cannot call
 * those actions because each needs a cookie session.
 *
 * ADD ONLY, and a second run of the same request adds nothing twice: an open
 * deal with the same title on the same account is returned rather than made
 * again, a timeline entry with the same kind, words and day is skipped, and an
 * open follow-up with the same title is skipped. An entry ALWAYS carries the
 * account, derived from the deal when one is given, so the account's timeline
 * rolls up its deals' entries exactly as the app's own do.
 */

type Json = Record<string, unknown>;
const s = (description: string) => ({ type: "string", description });
const ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

const ACTIVITIES_SCHEMA = {
  type: "array",
  description: `Entries for the relationship timeline, up to ${MAX_ACTIVITIES}.`,
  items: {
    type: "object",
    properties: {
      kind: s("note (default), call, meeting or email."),
      body: s("What happened or what was said, in the producer's words."),
      occurred_at: s("When it happened, YYYY-MM-DD (or a timestamp). Defaults to now."),
    },
    required: ["body"],
    additionalProperties: false,
  },
};

const FOLLOW_UPS_SCHEMA = {
  type: "array",
  description: `Follow-ups (reminders), up to ${MAX_FOLLOW_UPS}, assigned to the producer.`,
  items: {
    type: "object",
    properties: {
      title: s("The follow-up, e.g. 'Chase the PO', 'Send the treatment'."),
      due_date: s("YYYY-MM-DD."),
      notes: s("Anything to remember."),
    },
    required: ["title"],
    additionalProperties: false,
  },
};

export const DEAL_TOOL: McpTool = {
  name: "add_deal",
  description:
    "Add a deal (a job being pursued) to the sales pipeline, on a client. Name the client by client_id, or by its exact name; a name that matches no client adds it as a PROSPECT, so search first. A deal is added OPEN (inbound, qualifying or bidding); winning or losing one is done on its page. If an open deal with the same title is already on that client it is returned instead of made twice. Can also log timeline entries and follow-ups on the new deal in the same call. Adds only; nobody is emailed.",
  inputSchema: {
    type: "object",
    properties: {
      client_id: s("The client's id, from search."),
      client_name: s("Or the client's exact name. A new name is added as a prospect."),
      title: s("The deal, e.g. 'Hint holiday spot'."),
      value: { type: ["number", "string"], description: "What the job is worth in US dollars, e.g. 45000 or '$45k'." },
      stage: s("inbound (default, just arrived), qualifying or bidding."),
      probability: { type: ["number", "string"], description: "Chance of winning, 0 to 100." },
      expected_close_date: s("YYYY-MM-DD."),
      source: s("Where it came from, e.g. 'Referral from Sam', 'Inbound email'."),
      notes: s("Anything worth keeping on the deal."),
      activities: ACTIVITIES_SCHEMA,
      follow_ups: FOLLOW_UPS_SCHEMA,
    },
    required: ["title"],
    additionalProperties: false,
  },
  annotations: { title: "Add a deal", ...ANNOTATIONS },
};

export const CRM_LOG_TOOL: McpTool = {
  name: "log_crm",
  description:
    "Log on a client's or a deal's relationship timeline (notes, calls, meetings, emails) and add follow-ups (reminders with a due date). Give deal_id to log on a deal (it also shows on its client), or client_id for the client alone. An entry with the same kind, words and day, or an open follow-up with the same title, is skipped, so a repeat adds nothing. Adds only.",
  inputSchema: {
    type: "object",
    properties: {
      deal_id: s("The deal's id, from search or get_crm."),
      client_id: s("The client's id, when it is not about one deal."),
      activities: ACTIVITIES_SCHEMA,
      follow_ups: FOLLOW_UPS_SCHEMA,
    },
    additionalProperties: false,
  },
  annotations: { title: "Log on the CRM", ...ANNOTATIONS },
};

type Supa = ReturnType<typeof createClient>;

/** Write timeline entries and follow-ups, skipping what is already there. */
async function writeEntries(
  supabase: Supa,
  owner: ConnectorOwner,
  accountId: string,
  dealId: string | null,
  activities: ActivityInput[],
  followUps: FollowUpInput[],
  skipped: string[]
): Promise<{ logged: string[]; followUpsAdded: string[] }> {
  const logged: string[] = [];
  const followUpsAdded: string[] = [];
  const now = new Date().toISOString();

  if (activities.length) {
    let q = supabase.from("crm_activities").select("kind, body, occurred_at").eq("account_id", accountId);
    q = dealId ? q.eq("deal_id", dealId) : q.is("deal_id", null);
    const { data: prior } = await q;
    const taken = new Set((prior ?? []).map((p) => activityKey(p.kind, p.body ?? "", p.occurred_at)));
    const rows = activities.filter((a) => {
      const k = activityKey(a.kind, a.body, a.occurredAt ?? now);
      if (taken.has(k)) {
        skipped.push(`"${a.body.slice(0, 60)}": already on the timeline.`);
        return false;
      }
      taken.add(k);
      return true;
    });
    if (rows.length) {
      const { error } = await supabase.from("crm_activities").insert(
        rows.map((a) => ({
          studio_id: owner.studioId,
          account_id: accountId,
          deal_id: dealId,
          kind: a.kind,
          body: a.body,
          author_id: owner.userId,
          occurred_at: a.occurredAt ?? now,
        }))
      );
      if (error) skipped.push("The timeline entries could not be saved.");
      else logged.push(...rows.map((a) => `${a.kind}: ${a.body.slice(0, 80)}`));
    }
  }

  if (followUps.length) {
    let q = supabase.from("crm_tasks").select("title").eq("account_id", accountId).eq("done", false);
    q = dealId ? q.eq("deal_id", dealId) : q.is("deal_id", null);
    const { data: open } = await q;
    const taken = new Set((open ?? []).map((t) => nameKey(t.title)));
    const rows = followUps.filter((f) => {
      const k = nameKey(f.title);
      if (taken.has(k)) {
        skipped.push(`${f.title}: already an open follow-up.`);
        return false;
      }
      taken.add(k);
      return true;
    });
    if (rows.length) {
      const { error } = await supabase.from("crm_tasks").insert(
        rows.map((f) => ({
          studio_id: owner.studioId,
          account_id: accountId,
          deal_id: dealId,
          title: f.title,
          due_date: f.dueDate,
          notes: f.notes,
          assignee_id: owner.userId,
          created_by: owner.userId,
        }))
      );
      if (error) skipped.push("The follow-ups could not be saved.");
      else followUpsAdded.push(...rows.map((f) => (f.dueDate ? `${f.title} (due ${f.dueDate})` : f.title)));
    }
  }
  return { logged, followUpsAdded };
}

/* ---------------------------------------------------------------- deal */

export async function addDealTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const { deal, skipped } = parseDeal(args);
  if (!deal) return { error: "The deal needs a title.", skipped };
  const { activities, skipped: s1 } = parseActivities(args.activities);
  const { followUps, skipped: s2 } = parseFollowUps(args.follow_ups);
  skipped.push(...s1, ...s2);

  // The account: by id, else by exact name, else a new prospect.
  let account: { id: string; name: string } | null = null;
  let accountNew = false;
  const clientId = typeof args.client_id === "string" ? args.client_id.trim() : "";
  const clientName = typeof args.client_name === "string" ? args.client_name.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  if (clientId) {
    const { data } = await supabase.from("clients").select("id, name, studio_id").eq("id", clientId).maybeSingle();
    if (!data || data.studio_id !== owner.studioId) return { error: "That client was not found in this studio.", skipped };
    account = { id: data.id, name: data.name };
  } else if (clientName) {
    const { data } = await supabase.from("clients").select("id, name").eq("studio_id", owner.studioId);
    const match = (data ?? []).filter((c) => nameKey(c.name) === nameKey(clientName));
    if (match.length > 1) return { error: `There are ${match.length} clients called "${clientName}". Use one of their ids.`, clients: match, skipped };
    if (match.length === 1) account = match[0];
    else {
      const { data: made, error } = await supabase
        .from("clients")
        .insert({ studio_id: owner.studioId, name: clientName, account_status: "prospect", owner_id: owner.userId })
        .select("id, name")
        .single();
      if (error || !made) return { error: "The new client could not be saved.", skipped };
      account = made;
      accountNew = true;
    }
  } else {
    return { error: "Say which client the deal is for (client_id, or client_name).", skipped };
  }

  // An open deal with this title on this account is the same deal.
  const { data: existing } = await supabase
    .from("deals")
    .select("id, title, stage")
    .eq("account_id", account.id)
    .in("stage", ["inbound", "qualifying", "bidding"]);
  const same = (existing ?? []).find((d) => nameKey(d.title) === nameKey(deal.title));

  let dealId: string;
  let dealNew = false;
  if (same) {
    dealId = same.id;
    skipped.push(`"${same.title}" is already an open deal on ${account.name}, so no new deal was made; its details were left as they are.`);
  } else {
    const { data: made, error } = await supabase
      .from("deals")
      .insert({
        studio_id: owner.studioId,
        account_id: account.id,
        title: deal.title,
        value: deal.value,
        probability: deal.probability,
        stage: deal.stage,
        closed_at: null,
        expected_close_date: deal.expectedClose,
        source: deal.source,
        notes: deal.notes,
        owner_id: owner.userId,
      })
      .select("id")
      .single();
    if (error || !made) return { error: "The deal could not be saved.", skipped };
    dealId = made.id;
    dealNew = true;
    await supabase.from("crm_activities").insert({
      studio_id: owner.studioId,
      account_id: account.id,
      deal_id: dealId,
      kind: "created",
      body: "Deal created",
      author_id: owner.userId,
    });
  }

  const { logged, followUpsAdded } = await writeEntries(supabase, owner, account.id, dealId, activities, followUps, skipped);

  return {
    deal: {
      id: dealId,
      title: same ? same.title : deal.title,
      new: dealNew,
      stage: same ? same.stage : deal.stage,
      value: dealNew ? deal.value : undefined,
    },
    client: { id: account.id, name: account.name, new_prospect: accountNew },
    logged,
    follow_ups_added: followUpsAdded,
    skipped,
    open: `${siteOrigin()}/pipeline/${dealId}`,
  };
}

/* ----------------------------------------------------------------- log */

export async function logCrmTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const { activities, skipped } = parseActivities(args.activities);
  const { followUps, skipped: s2 } = parseFollowUps(args.follow_ups);
  skipped.push(...s2);
  if (!activities.length && !followUps.length) return { error: "Nothing to log: give activities or follow_ups.", skipped };

  const dealIdArg = typeof args.deal_id === "string" ? args.deal_id.trim() : "";
  const clientIdArg = typeof args.client_id === "string" ? args.client_id.trim() : "";
  let accountId: string;
  let dealId: string | null = null;
  let open: string;
  let about: string;

  if (dealIdArg) {
    const { data } = await supabase.from("deals").select("id, title, account_id, studio_id").eq("id", dealIdArg).maybeSingle();
    if (!data || data.studio_id !== owner.studioId) return { error: "That deal was not found in this studio.", skipped };
    if (!data.account_id) return { error: "That deal has no client to log against.", skipped };
    if (clientIdArg && clientIdArg !== data.account_id) skipped.push("client_id was ignored: the deal's own client was used.");
    accountId = data.account_id;
    dealId = data.id;
    about = `deal "${data.title}"`;
    open = `${siteOrigin()}/pipeline/${data.id}`;
  } else if (clientIdArg) {
    const { data } = await supabase.from("clients").select("id, name, studio_id").eq("id", clientIdArg).maybeSingle();
    if (!data || data.studio_id !== owner.studioId) return { error: "That client was not found in this studio.", skipped };
    accountId = data.id;
    about = `client "${data.name}"`;
    open = `${siteOrigin()}/clients/${data.id}`;
  } else {
    return { error: "Say where to log it: deal_id or client_id.", skipped };
  }

  const { logged, followUpsAdded } = await writeEntries(supabase, owner, accountId, dealId, activities, followUps, skipped);
  return { on: about, logged, follow_ups_added: followUpsAdded, skipped, open };
}
