import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { isFetchableUrl } from "@/lib/unfurl";
import { matchRosterVendor } from "@/lib/payment-details";
import { inBatches, storeImage } from "@/lib/connector-write";
import {
  briefHtml,
  costKey,
  emailOf,
  matchBudgetLine,
  MAX_CLIENT_CONTACTS,
  MAX_COSTS,
  MAX_DELIVERABLES,
  MAX_EVENTS,
  MAX_PROP_OPTIONS,
  MAX_PROPS,
  nameKey,
  parseClient,
  parseCosts,
  parseProject,
  parseProps,
} from "@/lib/connector-records";
import type { ConnectorOwner } from "@/lib/connector";
import type { McpTool } from "@/lib/mcp";

/**
 * add_client, create_project, add_costs and add_props over the connector.
 *
 * They insert the same rows the app's own forms do (createClient,
 * createProject, saveBrief, applySowDeliverables, addProjectEvent, addCost,
 * addProp, addPropOption*), through the owner's borrowed RLS client, so the
 * boundary is the same. They cannot call those actions: each goes through
 * requireStudioContext, which needs a cookie session the connector does not
 * have.
 *
 * ADD ONLY, like every connector tool. Each is also built so a SECOND RUN of
 * the same request adds nothing twice, because add-only means a duplicate
 * cannot be cleaned up from the chat: a client or project with the same name
 * is reported rather than made again, a cost already on the ledger is
 * recognised by its invoice number (or vendor, amount and date), and a prop
 * that already exists takes the new options instead of becoming a second row.
 */

const s = (description: string) => ({ type: "string", description });
const MONEY = (description: string) => ({ type: ["number", "string"], description });
const ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

/** Pictures fetched per add_props call: each is a download within one minute. */
const MAX_PROP_IMAGES = 12;

export const CLIENT_TOOL: McpTool = {
  name: "add_client",
  description:
    `Add a client (a brand or an agency) to the studio, with its people. If a client with the same name already exists nothing new is made: its id is returned and any NEW people are added to it, so search first and use that client when it is the same company. Up to ${MAX_CLIENT_CONTACTS} people per call. Adds only; nobody is emailed.`,
  inputSchema: {
    type: "object",
    properties: {
      name: s("The company name, e.g. 'Hint Water'."),
      type: s("brand (default) or agency."),
      status: s("active (default, a client you work with), prospect (not won yet) or past."),
      notes: s("Anything worth keeping on the client's page."),
      contacts: {
        type: "array",
        description: "People at the client.",
        items: {
          type: "object",
          properties: {
            name: s("Full name."),
            role: s("Their title, e.g. 'Brand manager', 'Producer'."),
            email: s("Email address."),
            phone: s("Phone number as written."),
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  annotations: ANNOTATIONS,
};

export const PROJECT_TOOL: McpTool = {
  name: "create_project",
  description:
    `Start a new project (a job), optionally with its brief, deliverables and key dates, and get back its id for the other tools. Name the client by client_id (from search or add_client) or by its exact name; a client that does not exist yet is added with add_client first. If a live project with the same title already exists for that client, nothing new is made and its id is returned. Up to ${MAX_DELIVERABLES} deliverables and ${MAX_EVENTS} dates. Leave out anything the producer did not say.`,
  inputSchema: {
    type: "object",
    properties: {
      title: s("The project's name, e.g. 'Hint Treat Yourself'."),
      client_id: s("The client's id (table clients)."),
      client: s("Or the client's exact name, when you do not have the id."),
      project_type: s("live action, commercial, AI video, CGI/VFX, or general (default)."),
      stage: s("pre-production (default), production, post or delivered."),
      shoot_date: s("YYYY-MM-DD, the (first) shoot day."),
      due_date: s("YYYY-MM-DD, when it delivers."),
      brief: s("The creative brief as plain text. Blank lines separate paragraphs; lines starting '- ' become a list."),
      deliverables: {
        type: "array",
        description: "What the job delivers, e.g. ':30 hero spot', '3 x :15 cutdowns'.",
        items: {
          type: "object",
          properties: {
            name: s("The deliverable."),
            spec: s("Format or spec, e.g. '16:9 ProRes 4444', '1080x1920'."),
            qty: { type: "number", description: "How many, default 1." },
            due_date: s("YYYY-MM-DD."),
            price: MONEY("What the client is charged for it, only when stated. Kept studio-only."),
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      dates: {
        type: "array",
        description: "Key dates for the project calendar: prelight, shoot days, review, delivery.",
        items: {
          type: "object",
          properties: {
            title: s("e.g. 'Prelight', 'Shoot', 'First cut to client', 'Final delivery'."),
            date: s("YYYY-MM-DD."),
            end_date: s("YYYY-MM-DD, for a run of days."),
            kind: s("prepro, shoot, review, delivery or other."),
            notes: s("Detail, if any."),
          },
          required: ["title", "date"],
          additionalProperties: false,
        },
      },
    },
    required: ["title"],
    additionalProperties: false,
  },
  annotations: ANNOTATIONS,
};

export const COST_TOOL: McpTool = {
  name: "add_costs",
  description:
    `Add costs to a project's budget (its cost ledger): vendor invoices, estimates being committed to, and receipts. Up to ${MAX_COSTS} per call. A receipt is money already spent, so it lands as paid. Every cost needs its total, including tax; one with no amount you can read is not added. A cost already on the ledger (same vendor and invoice number, or the same vendor, amount and date) is skipped. The document itself is not attached: tell the producer to add it on the cost in Studio Flows if they want it filed. Adds only; nothing is paid and nobody is emailed. Read the project's budget lines first (query on budget_lines) to file each cost on one.`,
  inputSchema: {
    type: "object",
    properties: {
      project_id: s("The project's id, from search."),
      costs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            vendor: s("Who it is from: the person or company being paid, or the shop on a receipt."),
            amount: MONEY("The total in dollars, including tax and tip, e.g. 3959.83 or '$3,959.83'."),
            description: s("What it is for, e.g. 'Prop styling, 3 days'."),
            kind: s("invoice (default), estimate (what you are committing to) or receipt (already paid)."),
            status: s("received (default), approved or paid. Ignored for a receipt."),
            invoice_number: s("As printed."),
            invoice_date: s("YYYY-MM-DD, or the purchase date on a receipt."),
            due_date: s("YYYY-MM-DD, only a printed due date. Not computed from 'net 30'."),
            days: { type: "number", description: "Days billed, only when one person's day rate times days is the total." },
            budget_line: s("A budget line's id, or its exact name or category."),
            notes: s("Payment terms, tax, card used, anything else."),
          },
          required: ["vendor", "amount"],
          additionalProperties: false,
        },
      },
    },
    required: ["project_id", "costs"],
    additionalProperties: false,
  },
  annotations: ANNOTATIONS,
};

export const PROPS_TOOL: McpTool = {
  name: "add_props",
  description:
    `Add props to a project's prop list, each with options to choose between (a picture by public image link, a supplier's page link, or both). Up to ${MAX_PROPS} props and ${MAX_PROP_IMAGES} pictures per call, ${MAX_PROP_OPTIONS} options per prop. A prop already on the list (same name) keeps its row and gets the new options added to it. The client approves options through the review link the producer shares from Studio Flows. Adds only; nothing is booked or bought.`,
  inputSchema: {
    type: "object",
    properties: {
      project_id: s("The project's id, from search."),
      props: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: s("What is needed, e.g. 'Wine glasses', 'Linen napkins'."),
            category: s("e.g. Glassware, Tableware, Linens, Furnishings, Set dressing, Hero product, Hand prop, Food styling, Plants."),
            qty: { type: "number", description: "How many are needed, default 1." },
            source: s("Where it is coming from, e.g. a prop house."),
            notes: s("Detail, e.g. 'stemless, clear, no logos'."),
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  image_url: s("A public link to a picture of this option."),
                  link: s("A supplier or product page for it."),
                  name: s("e.g. 'Riedel O stemless'."),
                  source: s("Where this option comes from."),
                  notes: s("Price talk does not go here; costs belong on the budget."),
                },
                additionalProperties: false,
              },
            },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
    },
    required: ["project_id", "props"],
    additionalProperties: false,
  },
  annotations: ANNOTATIONS,
};

type Json = Record<string, unknown>;

async function readProject(owner: ConnectorOwner, projectId: string) {
  if (!projectId) return null;
  const { data } = await createClient()
    .from("projects")
    .select("id, title, studio_id")
    .eq("id", projectId)
    .maybeSingle();
  return data && data.studio_id === owner.studioId ? data : null;
}

const NO_PROJECT = { error: "No project with that id is visible here. Use search first." };

/* -------------------------------------------------------------- client */

export async function addClientTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const { client, skipped } = parseClient(args);
  if (!client) return { error: "The client needs a name.", skipped };

  const { data: existing } = await supabase
    .from("clients")
    .select("id, name")
    .eq("studio_id", owner.studioId);
  const match = (existing ?? []).filter((c) => nameKey(c.name) === nameKey(client.name));

  let clientId: string;
  let clientName: string;
  let created = false;
  if (match.length > 1) {
    return {
      error: `There are ${match.length} clients called "${client.name}" already. Use one of their ids.`,
      clients: match,
    };
  }
  if (match.length === 1) {
    clientId = match[0].id;
    clientName = match[0].name;
    skipped.push(`"${clientName}" already exists, so no new client was made; its details were left as they are.`);
  } else {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        studio_id: owner.studioId,
        name: client.name,
        type: client.type,
        account_status: client.status,
        notes: client.notes,
        owner_id: owner.userId,
      })
      .select("id, name")
      .single();
    if (error || !data) return { error: "The client could not be saved.", skipped };
    clientId = data.id;
    clientName = data.name;
    created = true;
  }

  // People, deduped against the client's own list by email, else by name.
  let added: string[] = [];
  if (client.contacts.length) {
    const { data: people } = await supabase.from("contacts").select("name, email").eq("client_id", clientId);
    const taken = new Set(
      (people ?? []).map((p) => {
        const e = emailOf(p.email);
        return e ? `e:${e}` : `n:${nameKey(p.name)}`;
      })
    );
    const rows = client.contacts.filter((c) => {
      const k = c.email ? `e:${c.email}` : `n:${nameKey(c.name)}`;
      if (taken.has(k)) {
        skipped.push(`${c.name}: already on ${clientName}'s list.`);
        return false;
      }
      taken.add(k);
      return true;
    });
    if (rows.length) {
      const { error } = await supabase.from("contacts").insert(
        rows.map((c) => ({
          studio_id: owner.studioId,
          client_id: clientId,
          name: c.name,
          role: c.role,
          email: c.email,
          phone: c.phone,
        }))
      );
      if (error) skipped.push("The client is saved but its people could not be; add them on the client's page.");
      else added = rows.map((c) => c.name);
    }
  }

  return {
    client: { id: clientId, name: clientName, new: created, type: created ? client.type : undefined, status: created ? client.status : undefined },
    people_added: added,
    skipped,
    open: `${siteOrigin()}/clients/${clientId}`,
  };
}

/* ------------------------------------------------------------- project */

export async function createProjectTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const { project, skipped } = parseProject(args);
  if (!project) return { error: "The project needs a title.", skipped };

  // The client, by id or by exact name, always pinned to this studio.
  let clientId: string | null = null;
  let clientName: string | null = null;
  const wantId = String(args.client_id ?? "").trim();
  const wantName = String(args.client ?? "").trim();
  if (wantId || wantName) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .eq("studio_id", owner.studioId);
    const all = clients ?? [];
    const hits = wantId
      ? all.filter((c) => c.id === wantId)
      : all.filter((c) => nameKey(c.name) === nameKey(wantName));
    if (hits.length === 0) {
      return {
        error: wantId
          ? "No client with that id in this studio. Use search, or add_client to add it."
          : `No client called "${wantName}". Add it with add_client first, or search for the name it was saved under.`,
        skipped,
      };
    }
    if (hits.length > 1) {
      return { error: `Several clients are called "${wantName}". Pass client_id instead.`, clients: hits, skipped };
    }
    clientId = hits[0].id;
    clientName = hits[0].name;
  }

  // A second run of the same request must not make a second job.
  let dupQuery = supabase
    .from("projects")
    .select("id, title, client_id")
    .eq("studio_id", owner.studioId)
    .is("archived_at", null);
  dupQuery = clientId ? dupQuery.eq("client_id", clientId) : dupQuery.is("client_id", null);
  const { data: sameClient } = await dupQuery;
  const dup = (sameClient ?? []).find((p) => nameKey(p.title) === nameKey(project.title));
  if (dup) {
    return {
      error: `"${dup.title}" already exists${clientName ? ` for ${clientName}` : ""}, so no new project was made. Use its id for the other tools.`,
      project: { id: dup.id, title: dup.title },
      open: `${siteOrigin()}/projects/${dup.id}`,
      skipped,
    };
  }

  const { data: made, error } = await supabase
    .from("projects")
    .insert({
      studio_id: owner.studioId,
      title: project.title,
      client_id: clientId,
      status: project.stage,
      shoot_date: project.shootDate,
      due_date: project.dueDate,
      project_type: project.type,
      owner_id: owner.userId,
    })
    .select("id, title")
    .single();
  if (error || !made) return { error: "The project could not be saved.", skipped };
  const pid = made.id;

  // Everything after the project row is best effort: the job exists, and a
  // missing brief or date is one thing to fill rather than a lost project.
  let brief = false;
  if (project.brief) {
    const html = briefHtml(project.brief);
    const { error: bErr } = await supabase
      .from("briefs")
      .upsert({ studio_id: owner.studioId, project_id: pid, content: html }, { onConflict: "project_id" });
    if (bErr) skipped.push("The project was made but its brief could not be saved; paste it into the Brief page.");
    else brief = true;
  }

  let deliverables = 0;
  if (project.deliverables.length) {
    const rows = project.deliverables.map((d, i) => ({
      id: randomUUID(),
      studio_id: owner.studioId,
      project_id: pid,
      position: i,
      name: d.name,
      spec: d.spec,
      qty: d.qty,
      due_date: d.dueDate,
      status: "planned",
      created_by: owner.userId,
    }));
    const { error: dErr } = await supabase.from("deliverables").insert(rows);
    if (dErr) skipped.push("The project was made but its deliverables could not be saved.");
    else {
      deliverables = rows.length;
      // Prices to the studio-only side table (0074), never onto the row.
      const priced = project.deliverables
        .map((d, i) => ({ d, id: rows[i].id }))
        .filter((x) => x.d.price !== null && x.d.price > 0);
      if (priced.length) {
        const { error: pErr } = await supabase.from("deliverable_pricing").insert(
          priced.map((x) => ({ studio_id: owner.studioId, deliverable_id: x.id, rate: x.d.price as number }))
        );
        if (pErr) skipped.push("The deliverables were added but their prices could not be saved.");
      }
    }
  }

  let dates = 0;
  if (project.events.length) {
    const { error: eErr } = await supabase.from("project_events").insert(
      project.events.map((e) => ({
        studio_id: owner.studioId,
        project_id: pid,
        title: e.title,
        date: e.date,
        end_date: e.endDate,
        kind: e.kind,
        notes: e.notes,
        created_by: owner.userId,
      }))
    );
    if (eErr) skipped.push("The project was made but its dates could not be saved.");
    else dates = project.events.length;
  }

  return {
    project: { id: pid, title: made.title, client: clientName, type: project.type, stage: project.stage },
    added: { brief, deliverables, dates },
    skipped,
    open: `${siteOrigin()}/projects/${pid}`,
  };
}

/* --------------------------------------------------------------- costs */

export async function addCostsTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const project = await readProject(owner, String(args.project_id ?? "").trim());
  if (!project) return NO_PROJECT;

  const { costs, skipped } = parseCosts(args.costs);
  if (!costs.length) return { error: "No costs that can be added.", skipped };

  const [{ data: existing }, { data: lines }, { data: roster }] = await Promise.all([
    supabase.from("project_costs").select("vendor, amount, invoice_number, invoice_date").eq("project_id", project.id),
    supabase.from("budget_lines").select("id, category, description").eq("project_id", project.id),
    supabase.from("contacts").select("id, name, email, type").eq("project_id", project.id),
  ]);
  const taken = new Set(
    (existing ?? []).map((c) =>
      costKey({ vendor: c.vendor, amount: Number(c.amount), invoiceNumber: c.invoice_number, invoiceDate: c.invoice_date })
    )
  );
  const budget = (lines ?? []).map((l) => ({ id: l.id, category: l.category ?? "", description: l.description ?? "" }));
  const lineName = new Map(budget.map((l) => [l.id, [l.category, l.description].filter(Boolean).join(", ")]));

  const rows: {
    entry: (typeof costs)[number];
    lineId: string | null;
    contactId: string | null;
  }[] = [];
  for (const c of costs) {
    const key = costKey(c);
    if (taken.has(key)) {
      skipped.push(`${c.vendor} $${c.amount.toFixed(2)}${c.invoiceNumber ? ` (#${c.invoiceNumber})` : ""}: already on the budget; not added again.`);
      continue;
    }
    taken.add(key);
    const lineId = matchBudgetLine(c.budgetLine, budget);
    if (c.budgetLine && !lineId) {
      skipped.push(`${c.vendor}: no single budget line matches "${c.budgetLine}"; added unassigned.`);
    }
    // Linked to a roster person only on an exact, unique name: the link is
    // what the remittance email writes to, so a wrong one tells a stranger.
    const person = matchRosterVendor(c.vendor, roster ?? []);
    rows.push({ entry: c, lineId, contactId: person?.id ?? null });
  }
  if (!rows.length) return { error: "Every cost given is already on the budget.", skipped };

  const { error } = await supabase.from("project_costs").insert(
    rows.map(({ entry: c, lineId, contactId }) => ({
      studio_id: owner.studioId,
      project_id: project.id,
      created_by: owner.userId,
      vendor: c.vendor,
      description: c.description,
      amount: c.amount,
      days: c.days,
      budget_line_id: lineId,
      contact_id: contactId,
      invoice_number: c.invoiceNumber,
      invoice_date: c.invoiceDate,
      due_date: c.dueDate,
      status: c.status,
      notes: c.notes,
    }))
  );
  if (error) return { error: "The costs could not be saved.", skipped };

  const total = rows.reduce((sum, r) => sum + r.entry.amount, 0);
  return {
    added: rows.map(({ entry: c, lineId, contactId }) => ({
      vendor: c.vendor,
      amount: c.amount,
      kind: c.kind,
      status: c.status,
      budget_line: lineId ? lineName.get(lineId) ?? lineId : null,
      linked_to_contact: contactId !== null,
    })),
    total: Math.round(total * 100) / 100,
    project: project.title,
    note: "The documents themselves are not attached; add one on the cost in Studio Flows to file it.",
    skipped,
    open: `${siteOrigin()}/projects/${project.id}/budget`,
  };
}

/* --------------------------------------------------------------- props */

export async function addPropsTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const project = await readProject(owner, String(args.project_id ?? "").trim());
  if (!project) return NO_PROJECT;

  const { props, skipped } = parseProps(args.props);
  if (!props.length) return { error: "No props that can be added.", skipped };

  const { data: existing } = await supabase
    .from("props")
    .select("id, name, position")
    .eq("project_id", project.id);
  const byName = new Map((existing ?? []).map((p) => [nameKey(p.name), p.id]));
  let position = Math.max(-1, ...(existing ?? []).map((p) => p.position ?? 0)) + 1;

  // New props first, with ids minted here so options attach without trusting
  // the order the insert returns rows in. Two entries with one name are one prop.
  const plan: { entry: (typeof props)[number]; id: string; isNew: boolean }[] = [];
  const newRows: Record<string, unknown>[] = [];
  for (const p of props) {
    const key = nameKey(p.name);
    const found = byName.get(key);
    if (found) {
      plan.push({ entry: p, id: found, isNew: false });
      continue;
    }
    const id = randomUUID();
    byName.set(key, id);
    plan.push({ entry: p, id, isNew: true });
    newRows.push({
      id,
      studio_id: owner.studioId,
      project_id: project.id,
      position: position++,
      name: p.name,
      category: p.category,
      qty: p.qty,
      notes: p.notes,
      source: p.source,
      status: "needed",
      created_by: owner.userId,
    });
  }
  if (newRows.length) {
    const { error } = await supabase.from("props").insert(newRows as never);
    if (error) return { error: "The props could not be saved.", skipped };
  }

  // Options. Pictures are fetched (SSRF-guarded) into the prop's own folder,
  // the folder the app's own upload uses; a page link is checked the same way.
  type Job = { propId: string; propName: string; opt: (typeof props)[number]["options"][number] };
  const jobs: Job[] = plan.flatMap((p) => p.entry.options.map((opt) => ({ propId: p.id, propName: p.entry.name, opt })));
  let images = 0;
  const results = await inBatches(jobs, 4, async (job) => {
    const { opt } = job;
    let storage: { path: string; mime: string } | null = null;
    if (opt.imageUrl) {
      if (images >= MAX_PROP_IMAGES) {
        skipped.push(`${job.propName}: over the ${MAX_PROP_IMAGES} pictures per call limit; ${opt.link ? "added as a link only" : "not added"}.`);
      } else {
        images++;
        const got = await storeImage(owner.studioId, `props/${job.propId}`, opt.imageUrl);
        if (got.ok) storage = { path: got.path, mime: got.mime };
        else skipped.push(`${job.propName}: the picture ${got.reason}${opt.link ? "; added as a link only" : "; not added"}.`);
      }
    }
    const link = opt.link && isFetchableUrl(opt.link) ? opt.link : null;
    if (opt.link && !link) skipped.push(`${job.propName}: "${opt.link}" is not a link that can be used.`);
    if (!storage && !link) return null;
    return {
      prop_id: job.propId,
      studio_id: owner.studioId,
      name: opt.name,
      source: opt.source,
      notes: opt.notes,
      url: link,
      storage_path: storage?.path ?? null,
      mime_type: storage?.mime ?? null,
      created_by: owner.userId,
    };
  });
  const optionRows = results.filter((r): r is NonNullable<typeof r> => r !== null);

  let optionsAdded = 0;
  if (optionRows.length) {
    // Numbered after whatever each prop already has, so "option 2" keeps
    // meaning the same thing to a client who has already seen the list.
    const ids = [...new Set(optionRows.map((r) => r.prop_id))];
    const { data: had } = await supabase.from("prop_options").select("prop_id, position").in("prop_id", ids);
    const next = new Map<string, number>();
    for (const h of had ?? []) next.set(h.prop_id, Math.max(next.get(h.prop_id) ?? 0, (h.position ?? 0) + 1));
    const rows = optionRows.map((r) => {
      const pos = next.get(r.prop_id) ?? 0;
      next.set(r.prop_id, pos + 1);
      return { ...r, position: pos };
    });
    const { error } = await supabase.from("prop_options").insert(rows);
    if (error) skipped.push("The props were added but their options could not be saved.");
    else {
      optionsAdded = rows.length;
      // Options in moves a prop off "needed", and only ever forward, as in the app.
      await supabase
        .from("props")
        .update({ status: "options", updated_at: new Date().toISOString() })
        .in("id", ids)
        .eq("status", "needed");
    }
  }

  return {
    added: plan.map((p) => ({ name: p.entry.name, new: p.isNew })),
    new_props: newRows.length,
    options_added: optionsAdded,
    project: project.title,
    skipped,
    open: `${siteOrigin()}/projects/${project.id}/props`,
  };
}
