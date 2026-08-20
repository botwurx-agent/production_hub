// Action cards: the whole write side of the agent.
//
// The contract, which is the thing that makes this trustworthy rather than a
// demo: the model NEVER performs a write. It proposes one. A propose tool does
// not touch the database at all, it validates the arguments and returns a card
// describing exactly what would happen. The producer reads it and presses
// Create, and only then does confirmCard call the ordinary server action that
// the UI would have called.
//
// Two consequences worth keeping in mind before adding a tool here:
//  - A card has to be readable in two seconds. If a proposed change cannot be
//    summarised in a handful of labelled fields, it does not belong here,
//    because a confirmation you cannot actually check is not a confirmation.
//  - The payload round-trips through the browser, so nothing in it is trusted.
//    confirmCard revalidates and the underlying action does its own auth. The
//    card is a display object, not an authorisation.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { costStatus } from "@/lib/costs";
import { PROJECT_STATUS, DEAL_STAGE, CRM_MANUAL_ACTIVITY } from "@/lib/status";
import { amount, count, date, str, uuid } from "@/lib/agent/values";
import { isMealKey, mealLabel, cutoffLabel } from "@/lib/meals";
import { isFetchableUrl } from "@/lib/unfurl";

export const CARD_KINDS = [
  "log_cost",
  "add_payment",
  "mark_paid",
  "create_task",
  "log_activity",
  "add_deliverable",
  "move_project_stage",
  "move_deal_stage",
  "create_deal",
  "add_contact",
  "add_event",
  "send_meal_round",
] as const;

export type CardKind = (typeof CARD_KINDS)[number];

export function isCardKind(v: unknown): v is CardKind {
  return typeof v === "string" && (CARD_KINDS as readonly string[]).includes(v);
}

export type CardField = { label: string; value: string };

export type ActionCard = {
  /** Stable within a conversation so the browser can mark one as done. */
  id: string;
  kind: CardKind;
  /** Button label and heading, e.g. "Log a cost". */
  title: string;
  /** One line describing the whole thing, e.g. "$2,500 to Marcus on Hint". */
  summary: string;
  /** What actually gets written, spelled out for checking. */
  fields: CardField[];
  /** Validated arguments, revalidated again on confirm. */
  payload: Record<string, unknown>;
};

type Args = Record<string, unknown>;
type Built = ActionCard | { error: string };

export function isCardError(v: Built): v is { error: string } {
  return "error" in v;
}

// Argument helpers live in lib/agent/values.ts so confirmCard can reuse the
// exact same parsers on the way back in.

function field(label: string, value: string | number | null | undefined): CardField | null {
  if (value === null || value === undefined || value === "") return null;
  return { label, value: String(value) };
}

function fields(...list: (CardField | null)[]): CardField[] {
  return list.filter((f): f is CardField => f !== null);
}

let cardSeq = 0;
function cardId(kind: string): string {
  cardSeq += 1;
  return `${kind}-${Date.now().toString(36)}-${cardSeq}`;
}

// --- lookups used to make a card readable ------------------------------------
// A card that says "project 6f2a..." is not checkable, so every id is resolved
// to the name a human would recognise before it is shown.

async function projectName(id: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return data?.title ?? null;
}

async function costRow(id: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("project_costs")
    .select("id, project_id, vendor, description, amount, status")
    .eq("id", id)
    .maybeSingle();
  return data;
}

// --- the cards ---------------------------------------------------------------

async function buildLogCost(args: Args): Promise<Built> {
  const projectId = uuid(args.project_id);
  if (!projectId) return { error: "I need to know which project this cost is on." };
  const title = await projectName(projectId);
  if (!title) return { error: "That project is not one I can see." };

  const vendor = str(args.vendor, 160);
  if (!vendor) return { error: "A cost needs a vendor or payee." };

  const value = amount(args.amount);
  if (value === null) return { error: "I could not read the amount." };

  const payload = {
    projectId,
    vendor,
    description: str(args.description, 300) ?? "",
    amount: value,
    // Nullable on purpose: a flat fee, a rental and a licence have no day
    // count, and guessing one by dividing the total by a rate would fire a
    // false "over rate" flag on every kit fee.
    days: amount(args.days),
    budgetLineId: uuid(args.budget_line_id),
    contactId: uuid(args.contact_id),
    invoiceNumber: str(args.invoice_number, 60),
    invoiceDate: date(args.invoice_date),
    dueDate: date(args.due_date),
    status: costStatus(str(args.status, 20) ?? "received"),
    notes: str(args.notes, 500),
  };

  return {
    id: cardId("log_cost"),
    kind: "log_cost",
    title: "Log a cost",
    summary: `${money(value)} to ${vendor} on ${title}`,
    fields: fields(
      field("Project", title),
      field("Vendor", vendor),
      field("Amount", money(value)),
      field("Description", payload.description),
      field("Days", payload.days),
      field("Invoice no.", payload.invoiceNumber),
      field("Invoice date", payload.invoiceDate),
      field("Due", payload.dueDate),
      field("Status", payload.status),
      field("Notes", payload.notes)
    ),
    payload,
  };
}

async function buildAddPayment(args: Args): Promise<Built> {
  const costId = uuid(args.cost_id);
  if (!costId) return { error: "I need to know which cost this payment is against." };
  const cost = await costRow(costId);
  if (!cost) return { error: "That cost is not one I can see." };

  const value = amount(args.amount);
  if (value === null) return { error: "I could not read the payment amount." };

  const paid = args.paid === true;
  const payload = {
    projectId: cost.project_id,
    costId,
    label: str(args.label, 120) ?? (paid ? "Payment" : "Scheduled payment"),
    amount: value,
    dueDate: date(args.due_date),
    method: str(args.method, 60),
    notes: str(args.notes, 500),
    paid,
  };

  return {
    id: cardId("add_payment"),
    kind: "add_payment",
    title: paid ? "Record a payment" : "Schedule a payment",
    summary: `${money(value)} against ${cost.vendor} (${money(Number(cost.amount))} committed)`,
    fields: fields(
      field("Cost", `${cost.vendor}: ${cost.description || "no description"}`),
      field("Committed", money(Number(cost.amount))),
      field("This payment", money(value)),
      field("Label", payload.label),
      field("Due", payload.dueDate),
      field("Already sent", paid ? "yes" : "no"),
      field("Method", payload.method),
      field("Notes", payload.notes)
    ),
    payload,
  };
}

async function buildMarkPaid(args: Args): Promise<Built> {
  const costId = uuid(args.cost_id);
  if (!costId) return { error: "I need to know which cost to update." };
  const cost = await costRow(costId);
  if (!cost) return { error: "That cost is not one I can see." };

  const status = costStatus(str(args.status, 20) ?? "paid");
  if (status === cost.status) {
    return { error: `That cost is already marked "${status}".` };
  }

  return {
    id: cardId("mark_paid"),
    kind: "mark_paid",
    title: "Change a cost status",
    summary: `${cost.vendor}: ${cost.status} to ${status}`,
    fields: fields(
      field("Cost", `${cost.vendor}: ${cost.description || "no description"}`),
      field("Amount", money(Number(cost.amount))),
      field("From", cost.status),
      field("To", status)
    ),
    payload: { projectId: cost.project_id, costId, status },
  };
}

async function buildCreateTask(args: Args): Promise<Built> {
  const title = str(args.title, 200);
  if (!title) return { error: "A task needs a title." };

  const projectId = uuid(args.project_id);
  const accountId = uuid(args.account_id);
  const dealId = uuid(args.deal_id);
  const due = date(args.due_date);

  // A task hangs off exactly one thing. A project task lives on the project
  // page; a CRM task lives on the account or deal it belongs to.
  if (projectId) {
    const title2 = await projectName(projectId);
    if (!title2) return { error: "That project is not one I can see." };
    return {
      id: cardId("create_task"),
      kind: "create_task",
      title: "Create a task",
      summary: `"${title}" on ${title2}`,
      fields: fields(
        field("Task", title),
        field("On", `project: ${title2}`),
        field("Due", due)
      ),
      payload: { scope: "project", projectId, title, dueDate: due },
    };
  }

  if (!accountId && !dealId) {
    return {
      error:
        "A task has to hang off a project, an account, or a deal. Which one?",
    };
  }

  return {
    id: cardId("create_task"),
    kind: "create_task",
    title: "Create a task",
    summary: `"${title}"`,
    fields: fields(
      field("Task", title),
      field("On", dealId ? "a deal" : "an account"),
      field("Due", due)
    ),
    payload: { scope: "crm", accountId, dealId, title, dueDate: due },
  };
}

async function buildLogActivity(args: Args): Promise<Built> {
  const body = str(args.body, 2000);
  if (!body) return { error: "What should the note say?" };

  const accountId = uuid(args.account_id);
  const dealId = uuid(args.deal_id);
  if (!accountId && !dealId) {
    return { error: "I need the account or deal this note belongs to." };
  }

  const kindRaw = str(args.kind, 20) ?? "note";
  const kind = (CRM_MANUAL_ACTIVITY as readonly string[]).includes(kindRaw)
    ? kindRaw
    : "note";

  return {
    id: cardId("log_activity"),
    kind: "log_activity",
    title: "Log to the timeline",
    summary: `${kind}: ${body.slice(0, 60)}${body.length > 60 ? "..." : ""}`,
    fields: fields(
      field("Type", kind),
      field("Note", body),
      field("On", dealId ? "a deal" : "an account"),
      field("When", date(args.occurred_at))
    ),
    payload: {
      accountId,
      dealId,
      kind,
      body,
      occurredAt: date(args.occurred_at),
    },
  };
}

async function buildAddDeliverable(args: Args): Promise<Built> {
  const projectId = uuid(args.project_id);
  if (!projectId) return { error: "Which project is this deliverable for?" };
  const title = await projectName(projectId);
  if (!title) return { error: "That project is not one I can see." };

  const name = str(args.name, 200);
  if (!name) return { error: "A deliverable needs a name." };

  const payload = {
    projectId,
    name,
    spec: str(args.spec, 300) ?? "",
    dueDate: date(args.due_date),
    qty: count(args.qty),
    notes: str(args.notes, 500) ?? "",
  };

  return {
    id: cardId("add_deliverable"),
    kind: "add_deliverable",
    title: "Add a deliverable",
    summary: `"${name}" on ${title}`,
    fields: fields(
      field("Project", title),
      field("Deliverable", name),
      field("Spec", payload.spec),
      field("Quantity", payload.qty),
      field("Due", payload.dueDate),
      field("Notes", payload.notes)
    ),
    payload,
  };
}

async function buildMoveProjectStage(args: Args): Promise<Built> {
  const projectId = uuid(args.project_id);
  if (!projectId) return { error: "Which project should move?" };

  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title, status, project_type")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "That project is not one I can see." };

  const status = str(args.status, 20) ?? "";
  if (!(status in PROJECT_STATUS)) {
    return {
      error: `"${status}" is not a stage. Use one of: ${Object.keys(PROJECT_STATUS).join(", ")}.`,
    };
  }
  if (status === project.status) {
    return { error: `${project.title} is already in that stage.` };
  }

  return {
    id: cardId("move_project_stage"),
    kind: "move_project_stage",
    title: "Move the stage",
    summary: `${project.title}: ${project.status} to ${status}`,
    fields: fields(
      field("Project", project.title),
      field("From", PROJECT_STATUS[project.status as keyof typeof PROJECT_STATUS]?.label ?? project.status),
      field("To", PROJECT_STATUS[status as keyof typeof PROJECT_STATUS]?.label ?? status)
    ),
    payload: { projectId, status },
  };
}

async function buildMoveDealStage(args: Args): Promise<Built> {
  const dealId = uuid(args.deal_id);
  if (!dealId) return { error: "Which deal should move?" };

  const supabase = createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("title, stage, value")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return { error: "That deal is not one I can see." };

  const stage = str(args.stage, 20) ?? "";
  if (!(stage in DEAL_STAGE)) {
    return {
      error: `"${stage}" is not a stage. Use one of: ${Object.keys(DEAL_STAGE).join(", ")}.`,
    };
  }
  if (stage === deal.stage) return { error: "That deal is already at that stage." };

  const lostReason = str(args.lost_reason, 300);
  if (stage === "lost" && !lostReason) {
    return { error: "Marking a deal lost needs a reason." };
  }

  return {
    id: cardId("move_deal_stage"),
    kind: "move_deal_stage",
    title: "Move the deal",
    summary: `${deal.title}: ${deal.stage} to ${stage}`,
    fields: fields(
      field("Deal", deal.title),
      field("Value", deal.value ? money(Number(deal.value)) : null),
      field("From", DEAL_STAGE[deal.stage as keyof typeof DEAL_STAGE]?.label ?? deal.stage),
      field("To", DEAL_STAGE[stage as keyof typeof DEAL_STAGE]?.label ?? stage),
      field("Reason", lostReason)
    ),
    payload: { dealId, stage, lostReason },
  };
}

async function buildCreateDeal(args: Args): Promise<Built> {
  const title = str(args.title, 200);
  if (!title) return { error: "A deal needs a title." };

  const accountId = uuid(args.account_id);
  const newAccount = str(args.new_account_name, 160);
  if (!accountId && !newAccount) {
    return { error: "Which company is this for? Name an existing one or a new one." };
  }

  let accountLabel = newAccount ? `${newAccount} (new prospect)` : "";
  if (accountId) {
    const supabase = createClient();
    const { data } = await supabase
      .from("clients")
      .select("name")
      .eq("id", accountId)
      .maybeSingle();
    if (!data) return { error: "That company is not one I can see." };
    accountLabel = data.name;
  }

  const value = amount(args.value);
  const stage = str(args.stage, 20) ?? "inbound";

  return {
    id: cardId("create_deal"),
    kind: "create_deal",
    title: "Create a deal",
    summary: `${title} for ${accountLabel}`,
    fields: fields(
      field("Deal", title),
      field("Company", accountLabel),
      field("Value", value !== null ? money(value) : null),
      field("Stage", stage in DEAL_STAGE ? stage : "inbound"),
      field("Expected close", date(args.expected_close_date)),
      field("Source", str(args.source, 80)),
      field("Notes", str(args.notes, 500))
    ),
    payload: {
      title,
      accountId,
      newAccount,
      value,
      stage: stage in DEAL_STAGE ? stage : "inbound",
      expectedCloseDate: date(args.expected_close_date),
      source: str(args.source, 80),
      notes: str(args.notes, 500),
    },
  };
}

async function buildAddContact(args: Args): Promise<Built> {
  const projectId = uuid(args.project_id);
  if (!projectId) return { error: "Which project's roster is this for?" };
  const title = await projectName(projectId);
  if (!title) return { error: "That project is not one I can see." };

  const name = str(args.name, 160);
  if (!name) return { error: "A contact needs a name." };

  const payload = {
    projectId,
    name,
    role: str(args.role, 120),
    type: str(args.type, 20) ?? "crew",
    company: str(args.company, 160),
    email: str(args.email, 200),
    phone: str(args.phone, 60),
    rate: amount(args.rate),
    notes: str(args.notes, 500),
  };

  return {
    id: cardId("add_contact"),
    kind: "add_contact",
    title: "Add to the roster",
    summary: `${name}${payload.role ? `, ${payload.role}` : ""} on ${title}`,
    fields: fields(
      field("Project", title),
      field("Name", name),
      field("Position", payload.role),
      field("Category", payload.type),
      field("Company", payload.company),
      field("Email", payload.email),
      field("Phone", payload.phone),
      field("Day rate", payload.rate !== null ? `${money(payload.rate)}/day` : null),
      field("Notes", payload.notes)
    ),
    payload,
  };
}

async function buildAddEvent(args: Args): Promise<Built> {
  const projectId = uuid(args.project_id);
  if (!projectId) return { error: "Which project is this date on?" };
  const title = await projectName(projectId);
  if (!title) return { error: "That project is not one I can see." };

  const name = str(args.title, 200);
  if (!name) return { error: "The date needs a title." };

  const day = date(args.date);
  if (!day) return { error: "I need a real date (YYYY-MM-DD) for that." };

  const end = date(args.end_date);
  if (end && end < day) return { error: "The end date is before the start date." };

  const KINDS = ["prepro", "shoot", "review", "delivery", "other"];
  const kindRaw = str(args.kind, 20) ?? "other";
  const kind = KINDS.includes(kindRaw) ? kindRaw : "other";

  return {
    id: cardId("add_event"),
    kind: "add_event",
    title: "Add a date",
    summary: `${name} on ${title}, ${day}${end ? ` to ${end}` : ""}`,
    fields: fields(
      field("Project", title),
      field("What", name),
      field("Date", day),
      field("Ends", end),
      field("Kind", kind),
      field("Notes", str(args.notes, 500))
    ),
    payload: {
      projectId,
      title: name,
      date: day,
      endDate: end,
      kind,
      notes: str(args.notes, 500),
    },
  };
}


/**
 * The one card that reaches OUTSIDE the studio.
 *
 * Every other card writes a row. This one puts email in front of crew, which is
 * why it spells out the headcount and names the first few people: the thing the
 * producer is actually confirming is "these humans are about to be emailed",
 * not "a database row will change".
 *
 * It is deliberately the first outward action Runner may take, and a narrow
 * one: internal recipients already on the call sheet, a link the producer
 * pasted, no money, and nothing that cannot be repeated harmlessly.
 */
async function buildSendMealRound(args: Args): Promise<Built> {
  const projectId = uuid(args.project_id);
  if (!projectId) return { error: "Which project is the shoot on?" };
  const title = await projectName(projectId);
  if (!title) return { error: "That project is not one I can see." };

  const url = str(args.order_url, 500);
  if (!url || !isFetchableUrl(url)) {
    return { error: "I need the ordering link as a full web address." };
  }

  const mealRaw = str(args.meal, 20) ?? "lunch";
  const meal = isMealKey(mealRaw) ? mealRaw : "lunch";

  const supabase = createClient();

  // Which sheet: the one named, else the project's next shoot day, since a
  // producer asking about lunch means the shoot they are standing on.
  let callSheetId = uuid(args.call_sheet_id);
  let sheet: { id: string; title: string | null; shoot_date: string | null } | null = null;
  if (callSheetId) {
    const { data } = await supabase
      .from("call_sheets")
      .select("id, title, shoot_date, project_id")
      .eq("id", callSheetId)
      .maybeSingle();
    if (!data || data.project_id !== projectId) {
      return { error: "That call sheet is not on this project." };
    }
    sheet = data;
  } else {
    const { data } = await supabase
      .from("call_sheets")
      .select("id, title, shoot_date, project_id")
      .eq("project_id", projectId)
      .order("shoot_date", { ascending: true })
      .limit(20);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = (data ?? []).filter((d) => !d.shoot_date || d.shoot_date >= today);
    const pick = upcoming[0] ?? (data ?? [])[0];
    if (!pick) {
      return {
        error: `${title} has no call sheet yet, and a meal order hangs off one.`,
      };
    }
    sheet = pick;
    callSheetId = pick.id;
  }

  const { data: people } = await supabase
    .from("call_sheet_recipients")
    .select("id, name, email")
    .eq("call_sheet_id", callSheetId as string)
    .order("created_at", { ascending: true });

  const withEmail = (people ?? []).filter((r) => r.email);
  if (withEmail.length === 0) {
    return {
      error:
        "Nobody on that call sheet has an email address, so there is no one to send the order to.",
    };
  }

  // A cutoff is a moment, not a day, so it does not go through date(). Junk is
  // dropped rather than rejected: a meal round without a deadline still works,
  // it just cannot be chased.
  const cutoffRaw = str(args.cutoff_at, 40);
  const cutoffMs = cutoffRaw ? Date.parse(cutoffRaw) : NaN;
  const cutoff = Number.isNaN(cutoffMs) ? null : new Date(cutoffMs).toISOString();
  const names = withEmail.slice(0, 4).map((r) => r.name).join(", ");
  const rest = withEmail.length - Math.min(4, withEmail.length);

  return {
    id: cardId("send_meal_round"),
    kind: "send_meal_round",
    title: `Email the ${mealLabel(meal).toLowerCase()} order`,
    summary: `${mealLabel(meal)} link to ${withEmail.length} on ${sheet?.title || title}`,
    fields: fields(
      field("Emails", `${withEmail.length} people`),
      field("Who", rest > 0 ? `${names} and ${rest} more` : names),
      field("Meal", mealLabel(meal)),
      field("Link", url),
      field("Orders close", cutoffLabel(cutoff) ?? "not set"),
      field("Budget", args.budget_per_head ? `$${amount(args.budget_per_head)} per person` : null),
      field("Instructions", str(args.instructions, 400)),
    ),
    payload: {
      projectId,
      callSheetId,
      meal,
      orderUrl: url,
      cutoffAt: cutoff,
      budgetPerHead: amount(args.budget_per_head),
      instructions: str(args.instructions, 400),
      recipientIds: withEmail.map((r) => r.id),
    },
  };
}

const BUILDERS: Record<CardKind, (args: Args) => Promise<Built>> = {
  log_cost: buildLogCost,
  add_payment: buildAddPayment,
  mark_paid: buildMarkPaid,
  create_task: buildCreateTask,
  log_activity: buildLogActivity,
  add_deliverable: buildAddDeliverable,
  move_project_stage: buildMoveProjectStage,
  move_deal_stage: buildMoveDealStage,
  create_deal: buildCreateDeal,
  add_contact: buildAddContact,
  add_event: buildAddEvent,
  send_meal_round: buildSendMealRound,
};

/**
 * Turns a proposed write into a card, or into a message explaining what is
 * missing. Nothing here writes: the worst a bad proposal can do is produce a
 * card the producer cancels.
 */
export async function buildCard(kind: CardKind, args: Args): Promise<Built> {
  return BUILDERS[kind](args);
}
