// The agent's read side.
//
// Two kinds of tool live here and the split is deliberate:
//
//   Five FAT tools answer the questions a producer actually asks, in one hop.
//   Fat rather than granular because every tool call is a network round trip:
//   eight small reads is eight sequential hops before the first word appears.
//
//   One OPEN tool (query) can reach any table in the catalog with any filter,
//   so a question nobody anticipated still gets answered instead of hitting a
//   wall built out of whichever tools happened to seem useful in July.
//
// Everything runs through the caller's ordinary RLS client. That is the whole
// security model for reads: a collaborator asking about crew day rates gets
// nothing back because Postgres refuses (migration 0074 moved those columns to
// is_studio_member tables), not because a prompt asked the model to be careful.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOutstanding } from "@/lib/outstanding";
import { summarizePayments, rollUpActual, marginOf } from "@/lib/costs";
import { computeTotals } from "@/lib/billing-doc";
import { allowedColumns, isQueryableTable } from "@/lib/agent/schema-map";

type Json = Record<string, unknown>;

// Results are model input, so they are trimmed hard. A hundred rows of raw
// table dump is slower, costlier, and no more useful than the twenty that
// actually answer the question.
const LIST_CAP = 25;
const QUERY_CAP = 200;

function num(v: unknown): number {
  // Postgres numeric arrives from PostgREST as a STRING. A plain + would
  // concatenate, which is how "200.50" + "99.50" becomes "200.5099.50".
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- search ------------------------------------------------------------------

export async function search(args: Json) {
  const q = String(args.query ?? "").trim();
  if (!q) return { error: "Give me something to search for." };
  const like = `%${q}%`;
  const supabase = createClient();

  const kinds = Array.isArray(args.kinds)
    ? (args.kinds as string[])
    : ["projects", "clients", "deals", "contacts", "agreements"];
  const want = (k: string) => kinds.includes(k);

  const [projects, clients, deals, contacts, agreements] = await Promise.all([
    want("projects")
      ? supabase
          .from("projects")
          .select("id, title, status, project_type, due_date, shoot_date, archived_at, client:clients(id, name)")
          .ilike("title", like)
          .limit(8)
      : null,
    want("clients")
      ? supabase
          .from("clients")
          .select("id, name, type, account_status")
          .ilike("name", like)
          .limit(8)
      : null,
    want("deals")
      ? supabase
          .from("deals")
          .select("id, title, stage, value, expected_close_date, account:clients(id, name)")
          .ilike("title", like)
          .limit(8)
      : null,
    want("contacts")
      ? supabase
          .from("contacts")
          .select("id, name, role, company, email, phone, type, project_id, client_id")
          .ilike("name", like)
          .limit(8)
      : null,
    want("agreements")
      ? supabase
          .from("agreements")
          .select("id, title, kind, counterparty, effective_date, expires_date, our_signed_at, their_signed_at, project_id, client_id")
          .ilike("title", like)
          .limit(8)
      : null,
  ]);

  return {
    projects: projects?.data ?? [],
    clients: clients?.data ?? [],
    deals: deals?.data ?? [],
    contacts: contacts?.data ?? [],
    agreements: agreements?.data ?? [],
    note: "Nothing matched by name? Try the query tool, which can search any column.",
  };
}

// --- get_project -------------------------------------------------------------

const PROJECT_SECTIONS = [
  "overview",
  "deliverables",
  "review",
  "budget",
  "costs",
  "agreements",
  "contacts",
  "comms",
  "activity",
  "events",
] as const;

export async function getProject(args: Json) {
  const projectId = String(args.project_id ?? "").trim();
  if (!projectId) return { error: "I need a project id. Use search first." };

  const supabase = createClient();
  const requested = Array.isArray(args.sections)
    ? (args.sections as string[]).filter((s) =>
        (PROJECT_SECTIONS as readonly string[]).includes(s)
      )
    : ["overview"];
  const sections = requested.length ? requested : ["overview"];
  const want = (s: string) => sections.includes(s);

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, title, status, project_type, due_date, shoot_date, notes, color, archived_at, created_at, client:clients(id, name, type)"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return { error: "No project with that id is visible to you." };
  }

  const out: Json = { project };

  if (want("deliverables")) {
    const { data } = await supabase
      .from("deliverables")
      .select("id, name, spec, status, due_date, qty, link, notes")
      .eq("project_id", projectId)
      .order("position");
    out.deliverables = data ?? [];
  }

  if (want("review")) {
    const [assets, docs] = await Promise.all([
      supabase
        .from("assets")
        .select("id, name, type, status, updated_at")
        .eq("project_id", projectId)
        .in("status", ["in_review", "needs_changes", "approved"])
        .limit(LIST_CAP),
      supabase
        .from("doc_reviews")
        .select("id, target_type, target_id, status, updated_at")
        .eq("project_id", projectId)
        .limit(LIST_CAP),
    ]);
    const outstanding = (await getOutstanding()).filter(
      (o) => o.projectId === projectId
    );
    out.review = {
      assets_in_cycle: assets.data ?? [],
      doc_reviews: docs.data ?? [],
      waiting_on: outstanding,
    };
  }

  if (want("budget") || want("costs")) {
    const [lines, costs] = await Promise.all([
      supabase
        .from("budget_lines")
        .select("id, category, description, estimated, actual")
        .eq("project_id", projectId)
        .order("position"),
      supabase
        .from("project_costs")
        .select(
          "id, vendor, description, amount, days, status, invoice_number, invoice_date, due_date, budget_line_id"
        )
        .eq("project_id", projectId)
        .order("due_date", { nullsFirst: false }),
    ]);
    const lineRows = lines.data ?? [];
    const costRows = costs.data ?? [];

    if (want("budget")) {
      out.budget = {
        lines: lineRows,
        estimated_total: lineRows.reduce((s, l) => s + num(l.estimated), 0),
        actual_total: rollUpActual(lineRows, costRows),
      };
    }
    if (want("costs")) {
      out.costs = costRows.slice(0, LIST_CAP);
      out.costs_note =
        costRows.length > LIST_CAP
          ? `showing ${LIST_CAP} of ${costRows.length}`
          : undefined;
    }
  }

  if (want("agreements")) {
    const { data } = await supabase
      .from("agreements")
      .select(
        "id, title, kind, direction, counterparty, effective_date, expires_date, our_signer_name, our_signed_at, their_signer_name, their_signed_at, value, notes"
      )
      .eq("project_id", projectId);
    out.agreements = data ?? [];
  }

  if (want("contacts")) {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, role, type, company, email, phone")
      .eq("project_id", projectId)
      .limit(LIST_CAP);
    out.contacts = data ?? [];
  }

  if (want("comms")) {
    const { data } = await supabase
      .from("email_threads")
      .select("id, subject, last_message_at, last_read_at")
      .eq("project_id", projectId)
      .order("last_message_at", { ascending: false })
      .limit(10);
    out.email_threads = data ?? [];
  }

  if (want("events")) {
    const { data } = await supabase
      .from("project_events")
      .select("id, title, date, end_date, kind, notes")
      .eq("project_id", projectId)
      .order("date");
    out.events = data ?? [];
  }

  if (want("activity")) {
    const { data } = await supabase
      .from("activity")
      .select("id, type, content, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(15);
    out.activity = data ?? [];
  }

  return out;
}

// --- get_money ---------------------------------------------------------------

/**
 * What a job cost, what was billed, and what is still owed. "Owed" is summed
 * from summarizePayments rather than the cost's own status chip, so a
 * part-paid commitment reports only its remainder (the deposit-plus-balance
 * case from migration 0072).
 */
export async function getMoney(args: Json) {
  const projectId = String(args.project_id ?? "").trim() || null;
  const supabase = createClient();

  let costQuery = supabase
    .from("project_costs")
    .select(
      "id, project_id, vendor, description, amount, status, due_date, invoice_number"
    );
  if (projectId) costQuery = costQuery.eq("project_id", projectId);
  const { data: costRows } = await costQuery;

  // Projects are looked up separately rather than joined: project_costs carries
  // no declared relationship to projects in the generated types, and a studio
  // has few enough projects that one extra read is cheaper than fighting it.
  const { data: projectRows } = await supabase
    .from("projects")
    .select("id, title, archived_at");
  const projectsById = new Map(
    (projectRows ?? []).map((p) => [p.id, p] as const)
  );

  // Archived projects are dropped from a studio-wide total: their bills are
  // still owed, but they are not what a producer is being chased about this
  // week. Asking about one project by name still shows it.
  const costs = (costRows ?? []).filter(
    (c) => projectId || !projectsById.get(c.project_id)?.archived_at
  );

  const { data: paymentRows } = await supabase
    .from("cost_payments")
    .select("id, cost_id, label, amount, due_date, paid_at");
  const byCost = new Map<string, typeof paymentRows>();
  for (const p of paymentRows ?? []) {
    const list = byCost.get(p.cost_id) ?? [];
    list.push(p);
    byCost.set(p.cost_id, list);
  }

  const today = todayIso();
  let owedTotal = 0;
  let committedTotal = 0;
  const open: Json[] = [];

  for (const c of costs) {
    const payments = (byCost.get(c.id) ?? []).map((p) => ({
      amount: num(p.amount),
      due_date: p.due_date,
      paid_at: p.paid_at,
    }));
    const s = summarizePayments(num(c.amount), payments, c.status);
    committedTotal += num(c.amount);
    owedTotal += s.owed;
    if (s.owed > 0.005) {
      const due = s.nextDue ?? c.due_date ?? null;
      open.push({
        cost_id: c.id,
        project_id: c.project_id,
        project: projectsById.get(c.project_id)?.title ?? null,
        vendor: c.vendor,
        description: c.description,
        committed: num(c.amount),
        owed: s.owed,
        state: s.state,
        due_date: due,
        overdue: Boolean(due && due < today),
      });
    }
  }

  open.sort((a, b) => String(a.due_date ?? "9999").localeCompare(String(b.due_date ?? "9999")));

  // Billed comes from real invoices only. An estimate or a proposal is what you
  // hoped to charge, not what you charged.
  let billed = 0;
  let billedSource = "no invoices yet";
  let docQuery = supabase
    .from("billing_documents")
    .select("id, project_id, kind, number, status, discount, paid_at")
    .eq("kind", "invoice");
  if (projectId) docQuery = docQuery.eq("project_id", projectId);
  const { data: docs } = await docQuery;

  if ((docs ?? []).length) {
    const ids = (docs ?? []).map((d) => d.id);
    const { data: lines } = await supabase
      .from("billing_document_lines")
      .select("document_id, rate, qty, tax_rate")
      .in("document_id", ids);
    for (const d of docs ?? []) {
      const docLines = (lines ?? [])
        .filter((l) => l.document_id === d.id)
        .map((l) => ({
          description: "",
          rate: num(l.rate),
          qty: num(l.qty),
          tax_rate: num(l.tax_rate),
        }));
      billed += computeTotals(docLines, num(d.discount)).total;
    }
    billedSource = `${(docs ?? []).length} invoice(s) in the app`;
  } else if (projectId) {
    const { data: manual } = await supabase
      .from("project_billing")
      .select("amount, status, invoice_no")
      .eq("project_id", projectId)
      .maybeSingle();
    if (manual?.amount != null) {
      billed = num(manual.amount);
      billedSource = "the manual figure on the delivery page";
    }
  }

  const cost = projectId
    ? committedTotal
    : costs.reduce((s, c) => s + num(c.amount), 0);

  return {
    scope: projectId ? "one project" : "the whole studio (archived excluded)",
    still_owed: Math.round(owedTotal * 100) / 100,
    committed_total: Math.round(committedTotal * 100) / 100,
    open_commitments: open.slice(0, LIST_CAP),
    overdue_count: open.filter((o) => o.overdue).length,
    billed: Math.round(billed * 100) / 100,
    billed_source: billedSource,
    margin: projectId ? marginOf(billed, cost) : undefined,
    margin_note: projectId
      ? "pct is margin on revenue (profit / billed), null when nothing is billed"
      : "margin is per project, ask about one project to get it",
  };
}

// --- get_crm -----------------------------------------------------------------

export async function getCrm(args: Json) {
  const supabase = createClient();
  const accountId = String(args.account_id ?? "").trim() || null;
  const dealId = String(args.deal_id ?? "").trim() || null;

  let dealQuery = supabase
    .from("deals")
    .select(
      "id, title, stage, value, probability, expected_close_date, source, closed_at, lost_reason, account:clients(id, name, account_status)"
    )
    .order("sort");
  if (accountId) dealQuery = dealQuery.eq("account_id", accountId);
  if (dealId) dealQuery = dealQuery.eq("id", dealId);
  if (args.open_only !== false && !dealId) {
    dealQuery = dealQuery.in("stage", ["inbound", "qualifying", "bidding"]);
  }
  const { data: deals } = await dealQuery.limit(LIST_CAP);

  let taskQuery = supabase
    .from("crm_tasks")
    .select("id, title, due_date, done, account_id, deal_id, notes")
    .eq("done", false)
    .order("due_date", { nullsFirst: false });
  if (accountId) taskQuery = taskQuery.eq("account_id", accountId);
  if (dealId) taskQuery = taskQuery.eq("deal_id", dealId);
  const { data: tasks } = await taskQuery.limit(LIST_CAP);

  let activityQuery = supabase
    .from("crm_activities")
    .select("id, kind, body, occurred_at, account_id, deal_id")
    .order("occurred_at", { ascending: false });
  if (accountId) activityQuery = activityQuery.eq("account_id", accountId);
  if (dealId) activityQuery = activityQuery.eq("deal_id", dealId);
  const { data: activity } = await activityQuery.limit(15);

  const out: Json = {
    deals: deals ?? [],
    open_pipeline_value: (deals ?? []).reduce((s, d) => s + num(d.value), 0),
    open_tasks: tasks ?? [],
    recent_activity: activity ?? [],
  };

  if (!accountId && !dealId) {
    const { data: accounts } = await supabase
      .from("clients")
      .select("id, name, type, account_status")
      .order("name")
      .limit(LIST_CAP);
    out.accounts = accounts ?? [];
  }

  return out;
}

// --- get_attention -----------------------------------------------------------

/**
 * The one question that spans everything: what is going to bite this week.
 * Reuses lib/outstanding.ts, which already computes the review side of it for
 * the dashboard, so the agent and the "Needs you" widget cannot disagree.
 */
export async function getAttention() {
  const supabase = createClient();
  const today = todayIso();

  const [outstanding, money, links, tasks, projects, projectTasks] =
    await Promise.all([
      getOutstanding(),
      getMoney({}),
      supabase
        .from("review_links")
        .select("id, project_id, recipient, due_date, reminder_count, target_type, revoked")
        .eq("revoked", false)
        .not("due_date", "is", null)
        .lt("due_date", today)
        .limit(LIST_CAP),
      supabase
        .from("crm_tasks")
        .select("id, title, due_date, account_id, deal_id")
        .eq("done", false)
        .not("due_date", "is", null)
        .lte("due_date", today)
        .limit(LIST_CAP),
      supabase
        .from("projects")
        .select("id, title, status, due_date, shoot_date")
        .is("archived_at", null)
        .not("due_date", "is", null)
        .lt("due_date", today)
        .neq("status", "delivered")
        .limit(LIST_CAP),
      supabase
        .from("project_tasks")
        .select("id, project_id, title, due_date")
        .eq("done", false)
        .not("due_date", "is", null)
        .lte("due_date", today)
        .limit(LIST_CAP),
    ]);

  const moneyOut = money as { open_commitments?: Json[] };

  return {
    today,
    stalled_reviews: outstanding.filter((o) => o.stalled),
    waiting_reviews: outstanding.filter((o) => !o.stalled).slice(0, 10),
    overdue_client_reviews: links.data ?? [],
    overdue_payments: (moneyOut.open_commitments ?? []).filter((c) => c.overdue),
    overdue_projects: projects.data ?? [],
    due_crm_tasks: tasks.data ?? [],
    due_project_tasks: projectTasks.data ?? [],
  };
}

// --- query (the open-ended one) ---------------------------------------------

const OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in"] as const;
type Op = (typeof OPS)[number];

function isOp(v: unknown): v is Op {
  return typeof v === "string" && (OPS as readonly string[]).includes(v);
}

/**
 * Reaches any table in the catalog with any filter. This is what stops the
 * agent being capped at whatever questions seemed worth a tool on the day it
 * was written: "which client asks for the most revision rounds" needs no new
 * code, it just needs a query.
 *
 * Three things bound it, and only one of them is Postgres:
 *  - RLS scopes every row to the caller, so this cannot cross a studio or read
 *    a collaborator's forbidden columns. That is the real boundary.
 *  - The catalog is a whitelist of tables AND columns, so the credential
 *    tables and share tokens are unreachable even though RLS would return
 *    them to a studio member quite happily. That boundary is ours.
 *  - It is select-only by construction. There is no code path here that writes.
 */
export async function query(args: Json) {
  const table = String(args.table ?? "").trim();
  if (!isQueryableTable(table)) {
    return {
      error: `"${table}" is not a table you can query. Check the schema list in your instructions.`,
    };
  }

  const allowed = allowedColumns(table);
  const allow = (col: string) => allowed.includes(col);

  // Never "*": the catalog is the whitelist, so a column added to the database
  // without being added there is simply not readable. Failing closed is the
  // right direction to be wrong in when the thing being withheld might be a
  // token or a day rate.
  let select = allowed.join(", ");
  if (typeof args.select === "string" && args.select.trim() && args.select.trim() !== "*") {
    const asked = args.select.split(",").map((c) => c.trim()).filter(Boolean);
    const bad = asked.filter((c) => !allow(c));
    if (bad.length) {
      return { error: `Cannot read these columns on ${table}: ${bad.join(", ")}.` };
    }
    if (asked.length) select = asked.join(", ");
  }

  const supabase = createClient();
  // The table name is a runtime string that has already been checked against
  // the catalog, so the cast asserts what isQueryableTable just proved.
  type TableName = Parameters<typeof supabase.from>[0];
  let q = supabase.from(table as TableName).select(select);

  const filters = Array.isArray(args.filters) ? args.filters : [];
  for (const raw of filters) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Json;
    const column = String(f.column ?? "");
    const op = f.op;
    if (!allow(column)) {
      return { error: `Cannot filter ${table} on "${column}".` };
    }
    if (!isOp(op)) {
      return { error: `"${String(op)}" is not a filter I can use. Use one of: ${OPS.join(", ")}.` };
    }
    const value = f.value;
    if (op === "is") {
      // Only null makes sense here, and passing anything else through would be
      // a syntax error from PostgREST rather than a useful answer.
      q = q.is(column, null);
    } else if (op === "in") {
      const list = Array.isArray(value) ? value : String(value ?? "").split(",");
      q = q.in(column, list.map((v) => String(v).trim()));
    } else {
      q = q.filter(column, op, value as string | number | boolean);
    }
  }

  if (typeof args.order === "string" && args.order.trim()) {
    const col = args.order.trim();
    if (!allow(col)) return { error: `Cannot order ${table} by "${col}".` };
    q = q.order(col, { ascending: args.descending !== true, nullsFirst: false });
  }

  const limit = Math.min(
    Math.max(1, Number(args.limit) || 50),
    QUERY_CAP
  );
  q = q.limit(limit);

  const { data, error } = await q;
  if (error) {
    // Hand the real message back: the model can usually correct a bad column
    // name or operator on the next turn if it is told what was wrong.
    return { error: `Query failed: ${error.message}` };
  }

  return {
    table,
    count: data?.length ?? 0,
    truncated: (data?.length ?? 0) >= limit,
    rows: data ?? [],
  };
}
