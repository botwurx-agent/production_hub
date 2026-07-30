// The tool registry and the system prompt.
//
// Read tools run for real. Write tools are PROPOSALS: they are named
// propose_* and they do not touch the database, they hand back a card. That
// naming is not decoration, it is the main defence against the failure mode
// where the model reports "I have logged that" and nothing happened.
import "server-only";
import type { ToolSchema } from "@/lib/agent/loop";
import { CARD_KINDS } from "@/lib/agent/cards";
import { SCHEMA_CATALOG } from "@/lib/agent/schema-map";

export const PROPOSE_PREFIX = "propose_";

/** JSON Schema helper: a plain string property. */
const s = (description: string) => ({ type: "string", description });
const n = (description: string) => ({ type: "number", description });
const b = (description: string) => ({ type: "boolean", description });

function obj(
  properties: Record<string, unknown>,
  required: string[] = []
): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false };
}

// --- read tools --------------------------------------------------------------

export const READ_TOOLS: ToolSchema[] = [
  {
    name: "search",
    description:
      "Find a project, client/account, deal, contact or agreement by name. Use this first when the producer names something, so you have its id for the other tools. Matches on name only; use `query` to search other columns.",
    parameters: obj(
      {
        query: s("Part of the name to look for."),
        kinds: {
          type: "array",
          items: {
            type: "string",
            enum: ["projects", "clients", "deals", "contacts", "agreements"],
          },
          description: "Limit which kinds are searched. Omit to search all.",
        },
      },
      ["query"]
    ),
  },
  {
    name: "get_project",
    description:
      "The state of one project. Ask for only the sections you need: overview is always included, the rest cost time. Sections: deliverables, review (what is waiting on a sign-off or a client), budget (estimated vs actual), costs (the cost ledger), agreements (SOWs, NDAs), contacts (the crew/talent roster), comms (linked email threads), events (shoot and delivery dates), activity (recent log).",
    parameters: obj(
      {
        project_id: s("The project's id, from search."),
        sections: {
          type: "array",
          items: {
            type: "string",
            enum: [
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
            ],
          },
          description: "Which sections to include.",
        },
      },
      ["project_id"]
    ),
  },
  {
    name: "get_money",
    description:
      "What is owed, what was billed, and the margin. Omit project_id for the whole studio (archived projects excluded). Owed accounts for partial payments, so a cost with a paid deposit reports only its balance.",
    parameters: obj({
      project_id: s("Limit to one project. Omit for a studio-wide total."),
    }),
  },
  {
    name: "get_crm",
    description:
      "The sales side: accounts, open deals, open tasks and recent relationship activity. Narrow with account_id or deal_id.",
    parameters: obj({
      account_id: s("Limit to one account (a client or prospect company)."),
      deal_id: s("Limit to one deal."),
      open_only: b("Only open deals. Defaults to true."),
    }),
  },
  {
    name: "get_attention",
    description:
      "What is going wrong or going cold right now, across everything: stalled reviews, clients who have not responded by their due date, overdue payments, projects past their due date, and tasks that are due. Use this for 'what is at risk' style questions.",
    parameters: obj({}),
  },
  {
    name: "query",
    description:
      "Read any table directly when the tools above do not fit. This is the escape hatch: use it for anything specific, comparative, or historical (counts, averages, 'which client does X most', filtering on a column no other tool exposes). Read-only. The schema is in your instructions.",
    parameters: obj(
      {
        table: s("Table name from the schema list."),
        select: s(
          "Comma-separated columns. Omit for all readable columns on that table."
        ),
        filters: {
          type: "array",
          description: "Conditions, combined with AND.",
          items: obj(
            {
              column: s("Column name."),
              op: {
                type: "string",
                enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in"],
                description:
                  "Comparison. Use ilike with % wildcards for text search, is for null checks, in for a list.",
              },
              value: {
                description: "Value to compare against. For `in`, an array.",
              },
            },
            ["column", "op"]
          ),
        },
        order: s("Column to sort by."),
        descending: b("Sort descending. Defaults to ascending."),
        limit: n("Row cap, up to 200. Defaults to 50."),
      },
      ["table"]
    ),
  },
];

// --- write (propose) tools ---------------------------------------------------

const PROPOSE_NOTE =
  "This does NOT save anything. It shows the producer a card they must confirm. Never tell them it is done; say you have put it up for them to confirm.";

export const WRITE_TOOLS: ToolSchema[] = [
  {
    name: "propose_log_cost",
    description: `Propose logging a cost (an invoice or a commitment) against a project's budget. ${PROPOSE_NOTE}`,
    parameters: obj(
      {
        project_id: s("Project the cost belongs to."),
        vendor: s("Who is being paid."),
        description: s("What it is for."),
        amount: n("Total amount in dollars."),
        days: n("Number of days billed, ONLY if the invoice states a quantity."),
        budget_line_id: s("Budget line to file it under, if known."),
        contact_id: s("Roster contact this vendor matches, if known."),
        invoice_number: s("Invoice number."),
        invoice_date: s("Invoice date, YYYY-MM-DD."),
        due_date: s("Payment due date, YYYY-MM-DD."),
        status: s("received, approved or paid. Defaults to received."),
        notes: s("Anything else worth recording."),
      },
      ["project_id", "vendor", "amount"]
    ),
  },
  {
    name: "propose_add_payment",
    description: `Propose a payment against an existing cost: a deposit, a balance, or recording that money went out. Use this for "25% up front, balance on delivery". ${PROPOSE_NOTE}`,
    parameters: obj(
      {
        cost_id: s("The cost this payment is against."),
        label: s("What this payment is, e.g. Deposit or Balance."),
        amount: n("Amount in dollars."),
        due_date: s("When it is due, YYYY-MM-DD."),
        paid: b("True if this money has already been sent."),
        method: s("How it was or will be paid."),
        notes: s("Anything else."),
      },
      ["cost_id", "amount"]
    ),
  },
  {
    name: "propose_mark_paid",
    description: `Propose moving a cost's status (received, approved, paid). ${PROPOSE_NOTE}`,
    parameters: obj(
      {
        cost_id: s("The cost to update."),
        status: s("received, approved or paid."),
      },
      ["cost_id", "status"]
    ),
  },
  {
    name: "propose_create_task",
    description: `Propose a task or reminder. Give project_id for work on a job, or account_id/deal_id for sales follow-up. ${PROPOSE_NOTE}`,
    parameters: obj(
      {
        title: s("What needs doing."),
        due_date: s("When, YYYY-MM-DD."),
        project_id: s("Project this task is on."),
        account_id: s("Account this task is on."),
        deal_id: s("Deal this task is on."),
      },
      ["title"]
    ),
  },
  {
    name: "propose_log_activity",
    description: `Propose a note on an account or deal's relationship timeline: a call, a meeting, an email, or a plain note. ${PROPOSE_NOTE}`,
    parameters: obj(
      {
        body: s("What happened."),
        kind: s("note, call, meeting or email. Defaults to note."),
        account_id: s("Account it belongs to."),
        deal_id: s("Deal it belongs to."),
        occurred_at: s("When it happened, YYYY-MM-DD. Defaults to now."),
      },
      ["body"]
    ),
  },
  {
    name: "propose_add_deliverable",
    description: `Propose a deliverable on a project (a cut, a set of stills, a social edit). ${PROPOSE_NOTE}`,
    parameters: obj(
      {
        project_id: s("Project it belongs to."),
        name: s("What the deliverable is."),
        spec: s("Format, duration, aspect ratio."),
        qty: n("How many."),
        due_date: s("When it is due, YYYY-MM-DD."),
        notes: s("Anything else."),
      },
      ["project_id", "name"]
    ),
  },
  {
    name: "propose_move_project_stage",
    description: `Propose moving a project to a different stage: pre_pro, shoot, post or delivered. ${PROPOSE_NOTE}`,
    parameters: obj(
      { project_id: s("Project to move."), status: s("pre_pro, shoot, post or delivered.") },
      ["project_id", "status"]
    ),
  },
  {
    name: "propose_move_deal_stage",
    description: `Propose moving a deal: inbound, qualifying, bidding, awarded or lost. Marking a deal lost needs a reason. ${PROPOSE_NOTE}`,
    parameters: obj(
      {
        deal_id: s("Deal to move."),
        stage: s("inbound, qualifying, bidding, awarded or lost."),
        lost_reason: s("Why it was lost. Required when stage is lost."),
      },
      ["deal_id", "stage"]
    ),
  },
  {
    name: "propose_create_deal",
    description: `Propose a new deal in the pipeline, for an existing company or a new prospect. ${PROPOSE_NOTE}`,
    parameters: obj(
      {
        title: s("What the job is."),
        account_id: s("Existing company's id."),
        new_account_name: s("Name of a new company, if it is not on file yet."),
        value: n("Estimated value in dollars."),
        stage: s("inbound, qualifying or bidding. Defaults to inbound."),
        expected_close_date: s("When it should close, YYYY-MM-DD."),
        source: s("Where it came from."),
        notes: s("Anything else."),
      },
      ["title"]
    ),
  },
  {
    name: "propose_add_contact",
    description: `Propose adding someone to a project's roster (crew, talent, extras, vendor or client). ${PROPOSE_NOTE}`,
    parameters: obj(
      {
        project_id: s("Project whose roster this is."),
        name: s("Their name."),
        role: s("Their position, e.g. Gaffer, 1st AD."),
        type: s("crew, talent, extras, vendor or client. Defaults to crew."),
        company: s("Company they are with."),
        email: s("Email."),
        phone: s("Phone."),
        rate: n("Agreed day rate in dollars."),
        notes: s("Anything else."),
      },
      ["project_id", "name"]
    ),
  },
  {
    name: "propose_add_event",
    description: `Propose a date on a project's calendar: a shoot day, a review, a delivery. ${PROPOSE_NOTE}`,
    parameters: obj(
      {
        project_id: s("Project the date is on."),
        title: s("What it is."),
        date: s("Start date, YYYY-MM-DD."),
        end_date: s("End date for a multi-day event, YYYY-MM-DD."),
        kind: s("prepro, shoot, review, delivery or other."),
        notes: s("Anything else."),
      },
      ["project_id", "title", "date"]
    ),
  },
];

export const ALL_TOOLS: ToolSchema[] = [...READ_TOOLS, ...WRITE_TOOLS];

/** propose_log_cost -> log_cost, or null when the name is not a write tool. */
export function cardKindFromTool(name: string): string | null {
  if (!name.startsWith(PROPOSE_PREFIX)) return null;
  const kind = name.slice(PROPOSE_PREFIX.length);
  return (CARD_KINDS as readonly string[]).includes(kind) ? kind : null;
}

// --- system prompt -----------------------------------------------------------

export function systemPrompt(opts: {
  studioName: string;
  userEmail: string | null;
  today: string;
  project?: { id: string; title: string } | null;
}): string {
  return `You are the assistant inside Studio Flows, a production hub used by a boutique commercial production studio. You are talking to a producer at ${opts.studioName}${opts.userEmail ? ` (${opts.userEmail})` : ""}.

Today is ${opts.today}. Resolve any relative date the producer says ("Friday", "next week", "end of the month") against that, and always pass dates to tools as YYYY-MM-DD.

${
  opts.project
    ? `The producer currently has the project "${opts.project.title}" selected (id ${opts.project.id}). When they say "this job", "the project" or name nothing at all, they mean that one.`
    : `No project is selected. If a request needs one and it is ambiguous, ask which.`
}

HOW YOU WORK

Reading: use the tools freely and answer in your own words. Prefer the specific tool (get_project, get_money, get_crm, get_attention) for the questions it covers, because it answers in one step. Use the query tool for anything else: comparisons, counts, history, or a column no other tool exposes. Never guess at data you have not read.

Writing: you cannot change anything. The propose_* tools put a card in front of the producer with Create and Cancel buttons, and nothing happens until they press Create. So never say "I have logged that" or "done". Say what you have put up for them to confirm. If a proposal comes back with a problem, tell them what is missing and ask.

When you genuinely cannot do something, say so plainly and name where in the app it lives. Do not improvise a workaround and do not pretend. "I can't build a call sheet from here, that's on the call sheet page" is a good answer.

STYLE

Talk like a colleague who knows the job, not a chatbot. Short sentences. Lead with the answer, then the detail that matters. No preamble ("Sure!", "Great question"), no summarising what you are about to do, no offering three follow-ups at the end of every reply.

Use production language: pre-production, shoot, post, delivery, brief, boards, call sheet, deliverable, approval. A "deal" is a job you are bidding on. A "cost" is money out to a vendor or crew member.

Plain text. Short lists are fine, use "- " for bullets. No markdown headings, no bold, no tables. Do not use em dashes, use commas, colons or parentheses instead.

Money is dollars. Be exact with figures and never round silently.

THE DATABASE

These are the tables the query tool can read, with their columns. Enum columns list their legal values in square brackets, and a filter using a value not in that list will simply return nothing.

${SCHEMA_CATALOG}

Notes on the model, so your queries make sense:
- A project belongs to a client (clients.id = projects.client_id). Clients are also "accounts" on the sales side: account_status tells you whether a company is a prospect, active or past.
- deals are the sales pipeline. stage doubles as status: awarded means won, lost means lost, the rest are open.
- An asset holds versions; versions is where the actual files and their numbers live. approvals and review_comments hang off a version, or off a document target via target_type/target_id.
- budget_lines hold the estimate. project_costs are the real invoices, and cost_payments are the individual payments against a cost, so a cost with a deposit has two payment rows. A payment with paid_at set is money gone; null means scheduled.
- contacts with a project_id are the production roster. Their day rates live in contact_rates, and are only visible to studio members.
- Some tables you may expect are missing on purpose: the ones holding OAuth credentials, plus share tokens and signature images. If a question needs those, say it is not something you can read.`;
}
