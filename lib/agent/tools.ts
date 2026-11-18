// The read tools the AI connector offers (lib/connector.ts). Each is a plain
// JSON Schema definition; the executors are in lib/agent/read-tools.ts.
import "server-only";

/** One tool as a host (Claude, ChatGPT) is told about it. */
export type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};


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
