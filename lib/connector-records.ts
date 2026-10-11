/**
 * The pure half of the connector's record tools: add_client, create_project,
 * add_costs and add_props. NOT `server-only` and free of `@/` imports, so it
 * is unit tested; the assistant's arguments are the trust boundary, the same
 * as in lib/connector-tasks.ts.
 *
 * Words are read the way a producer says them ("live action", "pre-pro",
 * "agency"). Anything unreadable is NAMED in `skipped` and the record still
 * lands with the default, never refused for a cosmetic field. MONEY is the
 * exception: an amount that cannot be read is never guessed and never $0,
 * the rule every extractor here keeps.
 */

export const MAX_CLIENT_CONTACTS = 20;
export const MAX_DELIVERABLES = 40;
export const MAX_EVENTS = 30;
export const MAX_COSTS = 30;
export const MAX_PROPS = 25;
export const MAX_PROP_OPTIONS = 8;
/** A brief is read as plain text and stored as simple HTML. */
const MAX_BRIEF = 20_000;
/** One cost above this is a misread (a budget total, a typo), never a line. */
const MAX_COST = 5_000_000;
const MAX_DELIVERABLE_PRICE = 5_000_000;

function str(v: unknown, max: number): string {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function oneLine(v: unknown, max: number): string {
  return str(v, max * 2).replace(/\s+/g, " ").slice(0, max);
}

function word(v: unknown): string {
  return str(v, 40).toLowerCase().replace(/[^a-z]/g, "");
}

/** A real calendar day, so 2026-02-31 is refused rather than rolled into March. */
export function realDate(v: unknown): string | null {
  const m = str(v, 40).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
    ? `${m[1]}-${m[2]}-${m[3]}`
    : null;
}

function dateField(v: unknown, label: string, skipped: string[]): string | null {
  const raw = str(v, 40);
  const d = realDate(raw);
  if (raw && !d) skipped.push(`${label}: "${raw}" is not a real YYYY-MM-DD date; left blank.`);
  return d;
}

/**
 * Dollars from "$1,250.50", "1.2k", "3,959.83 USD" or a number. `ok: false`
 * is an amount that was given and could not be read; "n/a" is that case,
 * never $0. Absent is `value: null`.
 */
export function moneyOf(v: unknown, max: number): { ok: true; value: number | null } | { ok: false } {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v === "number") {
    return Number.isFinite(v) && v >= 0 && v <= max ? { ok: true, value: Math.round(v * 100) / 100 } : { ok: false };
  }
  const s = str(v, 60).toLowerCase().replace(/[$,\s]/g, "").replace(/(usd|dollars?)\.?$/, "");
  if (!s) return { ok: true, value: null };
  const m = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(s);
  if (!m) return { ok: false };
  let n = Number(m[1]);
  if (m[2] === "k") n *= 1_000;
  if (m[2] === "m") n *= 1_000_000;
  if (!Number.isFinite(n) || n > max) return { ok: false };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export function emailOf(v: unknown): string | null {
  const s = str(v, 200).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

/** Case, spacing and punctuation do not make two names different. */
export function nameKey(v: unknown): string {
  return str(v, 300).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/* ------------------------------------------------------------- clients */

export type ClientKind = "brand" | "agency";
export type AccountStatusKey = "prospect" | "active" | "past";

export type ClientContactEntry = {
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
};

export type ClientEntry = {
  name: string;
  type: ClientKind;
  status: AccountStatusKey;
  notes: string | null;
  contacts: ClientContactEntry[];
};

const CLIENT_TYPES: Record<string, ClientKind> = {
  brand: "brand",
  client: "brand",
  company: "brand",
  direct: "brand",
  agency: "agency",
  creativeagency: "agency",
  adagency: "agency",
};

const ACCOUNT_STATUSES: Record<string, AccountStatusKey> = {
  prospect: "prospect",
  lead: "prospect",
  potential: "prospect",
  active: "active",
  client: "active",
  current: "active",
  past: "past",
  former: "past",
  inactive: "past",
};

export function parseClient(args: Record<string, unknown>): { client: ClientEntry | null; skipped: string[] } {
  const skipped: string[] = [];
  const name = oneLine(args.name, 200);
  if (!name) return { client: null, skipped: ["The client has no name."] };

  let type: ClientKind = "brand";
  if (word(args.type)) {
    const t = CLIENT_TYPES[word(args.type)];
    if (t) type = t;
    else skipped.push(`"${str(args.type, 40)}" is not brand or agency; saved as a brand.`);
  }
  let status: AccountStatusKey = "active";
  if (word(args.status)) {
    const s = ACCOUNT_STATUSES[word(args.status)];
    if (s) status = s;
    else skipped.push(`"${str(args.status, 40)}" is not prospect, active or past; saved as active.`);
  }

  const contacts: ClientContactEntry[] = [];
  const seen = new Set<string>();
  const list = Array.isArray(args.contacts) ? args.contacts : [];
  for (const [i, item] of list.entries()) {
    if (contacts.length >= MAX_CLIENT_CONTACTS) {
      skipped.push(`Contact ${i + 1}: over the ${MAX_CLIENT_CONTACTS} per call limit.`);
      continue;
    }
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const cname = oneLine(o.name, 120);
    if (!cname) {
      skipped.push(`Contact ${i + 1}: no name.`);
      continue;
    }
    const rawEmail = str(o.email, 200);
    const email = emailOf(rawEmail);
    if (rawEmail && !email) skipped.push(`${cname}: "${rawEmail}" is not an email address; added without one.`);
    const key = email ? `e:${email}` : `n:${nameKey(cname)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    contacts.push({ name: cname, role: oneLine(o.role, 80) || null, email, phone: oneLine(o.phone, 40) || null });
  }

  return { client: { name, type, status, notes: str(args.notes, 4000) || null, contacts }, skipped };
}

/* ------------------------------------------------------------ projects */

export type ProjectTypeKey = "general" | "live_action" | "commercial" | "ai_video" | "cgi_vfx";
export type ProjectStageKey = "pre_pro" | "shoot" | "post" | "delivered";
export type EventKindKey = "prepro" | "shoot" | "review" | "delivery" | "other";

const PROJECT_TYPE_WORDS: Record<string, ProjectTypeKey> = {
  general: "general",
  other: "general",
  liveaction: "live_action",
  live: "live_action",
  shoot: "live_action",
  photo: "live_action",
  photography: "live_action",
  commercial: "commercial",
  spot: "commercial",
  tvc: "commercial",
  ad: "commercial",
  aivideo: "ai_video",
  ai: "ai_video",
  generated: "ai_video",
  cgi: "cgi_vfx",
  vfx: "cgi_vfx",
  cgivfx: "cgi_vfx",
  cg: "cgi_vfx",
  animation: "cgi_vfx",
};

const STAGE_WORDS: Record<string, ProjectStageKey> = {
  prepro: "pre_pro",
  preproduction: "pre_pro",
  pre: "pre_pro",
  concept: "pre_pro",
  shoot: "shoot",
  production: "shoot",
  shooting: "shoot",
  generation: "shoot",
  post: "post",
  postproduction: "post",
  edit: "post",
  delivered: "delivered",
  delivery: "delivered",
};

const EVENT_WORDS: Record<string, EventKindKey> = {
  prepro: "prepro",
  preproduction: "prepro",
  prelight: "prepro",
  scout: "prepro",
  fitting: "prepro",
  meeting: "prepro",
  ppm: "prepro",
  shoot: "shoot",
  shootday: "shoot",
  production: "shoot",
  review: "review",
  approval: "review",
  firstcut: "review",
  cut: "review",
  delivery: "delivery",
  deliver: "delivery",
  due: "delivery",
  deadline: "delivery",
  other: "other",
};

export type DeliverableEntry = {
  name: string;
  spec: string | null;
  qty: number;
  dueDate: string | null;
  price: number | null;
};

export type EventEntry = {
  title: string;
  date: string;
  endDate: string | null;
  kind: EventKindKey;
  notes: string | null;
};

export type ProjectEntry = {
  title: string;
  type: ProjectTypeKey;
  stage: ProjectStageKey;
  shootDate: string | null;
  dueDate: string | null;
  brief: string | null;
  deliverables: DeliverableEntry[];
  events: EventEntry[];
};

export function parseProject(args: Record<string, unknown>): { project: ProjectEntry | null; skipped: string[] } {
  const skipped: string[] = [];
  const title = oneLine(args.title, 200);
  if (!title) return { project: null, skipped: ["The project has no title."] };

  let type: ProjectTypeKey = "general";
  if (word(args.project_type)) {
    const t = PROJECT_TYPE_WORDS[word(args.project_type)];
    if (t) type = t;
    else skipped.push(`"${str(args.project_type, 40)}" is not a project type (live action, commercial, AI video, CGI/VFX, general); saved as general.`);
  }
  let stage: ProjectStageKey = "pre_pro";
  if (word(args.stage)) {
    const s = STAGE_WORDS[word(args.stage)];
    if (s) stage = s;
    else skipped.push(`"${str(args.stage, 40)}" is not a stage; started in pre-production.`);
  }

  const deliverables: DeliverableEntry[] = [];
  const dlist = Array.isArray(args.deliverables) ? args.deliverables : [];
  for (const [i, item] of dlist.entries()) {
    if (deliverables.length >= MAX_DELIVERABLES) {
      skipped.push(`Deliverable ${i + 1}: over the ${MAX_DELIVERABLES} per call limit.`);
      continue;
    }
    const o: Record<string, unknown> =
      typeof item === "string" ? { name: item } : item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const name = oneLine(o.name, 300);
    if (!name) {
      skipped.push(`Deliverable ${i + 1}: no name.`);
      continue;
    }
    const q = Number(o.qty);
    const qty = Number.isInteger(q) && q >= 1 && q <= 999 ? q : 1;
    if (o.qty !== undefined && o.qty !== null && str(o.qty, 10) !== "" && qty !== q) {
      skipped.push(`${name}: quantity "${str(o.qty, 20)}" could not be read; set to 1.`);
    }
    const price = moneyOf(o.price, MAX_DELIVERABLE_PRICE);
    if (!price.ok) skipped.push(`${name}: the price "${str(o.price, 40)}" could not be read; added without one.`);
    deliverables.push({
      name,
      spec: oneLine(o.spec, 300) || null,
      qty,
      dueDate: dateField(o.due_date, name, skipped),
      price: price.ok ? price.value : null,
    });
  }

  const events: EventEntry[] = [];
  const elist = Array.isArray(args.dates) ? args.dates : [];
  for (const [i, item] of elist.entries()) {
    if (events.length >= MAX_EVENTS) {
      skipped.push(`Date ${i + 1}: over the ${MAX_EVENTS} per call limit.`);
      continue;
    }
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const etitle = oneLine(o.title, 200);
    const date = realDate(o.date);
    if (!etitle || !date) {
      skipped.push(`Date ${i + 1}: needs a title and a real YYYY-MM-DD date.`);
      continue;
    }
    let endDate = dateField(o.end_date, etitle, skipped);
    if (endDate && endDate < date) {
      skipped.push(`${etitle}: ends before it starts; kept as one day.`);
      endDate = null;
    }
    if (endDate === date) endDate = null;
    let kind: EventKindKey = "other";
    if (word(o.kind)) {
      const k = EVENT_WORDS[word(o.kind)];
      if (k) kind = k;
      else skipped.push(`${etitle}: "${str(o.kind, 40)}" is not prepro, shoot, review or delivery; saved as other.`);
    }
    events.push({ title: etitle, date, endDate, kind, notes: str(o.notes, 2000) || null });
  }

  return {
    project: {
      title,
      type,
      stage,
      shootDate: dateField(args.shoot_date, "Shoot date", skipped),
      dueDate: dateField(args.due_date, "Due date", skipped),
      brief: str(args.brief, MAX_BRIEF) || null,
      deliverables,
      events,
    },
    skipped,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Plain text into the brief editor's HTML: blank lines separate paragraphs,
 * runs of "- " or "* " lines become a list, and everything is escaped, since
 * the editor renders the stored HTML as is.
 */
export function briefHtml(text: string): string {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.every((l) => /^[-*•]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
    })
    .join("");
}

/* --------------------------------------------------------------- costs */

export type CostKindKey = "invoice" | "estimate" | "receipt";
export type CostStatusKey = "received" | "approved" | "paid";

export type CostEntry = {
  vendor: string;
  description: string;
  amount: number;
  kind: CostKindKey;
  status: CostStatusKey;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  days: number | null;
  budgetLine: string | null;
  notes: string | null;
};

const COST_KINDS: Record<string, CostKindKey> = {
  invoice: "invoice",
  bill: "invoice",
  estimate: "estimate",
  quote: "estimate",
  bid: "estimate",
  receipt: "receipt",
  purchase: "receipt",
};

const COST_STATUSES: Record<string, CostStatusKey> = {
  received: "received",
  owed: "received",
  unpaid: "received",
  open: "received",
  approved: "approved",
  paid: "paid",
  settled: "paid",
};

export function parseCosts(raw: unknown): { costs: CostEntry[]; skipped: string[] } {
  const costs: CostEntry[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const [i, item] of list.entries()) {
    const n = i + 1;
    if (costs.length >= MAX_COSTS) {
      skipped.push(`Cost ${n}: over the ${MAX_COSTS} per call limit, send it in another call.`);
      continue;
    }
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const vendor = oneLine(o.vendor, 200);
    const label = vendor || `Cost ${n}`;
    const amount = moneyOf(o.amount, MAX_COST);
    // Money is never guessed: no readable amount, no cost.
    if (!amount.ok || amount.value === null || amount.value <= 0) {
      skipped.push(`${label}: no amount that can be read ("${str(o.amount, 40)}"); not added. A cost needs its total.`);
      continue;
    }
    if (!vendor) {
      skipped.push(`Cost ${n}: no vendor; not added.`);
      continue;
    }

    let kind: CostKindKey = "invoice";
    if (word(o.kind)) {
      const k = COST_KINDS[word(o.kind)];
      if (k) kind = k;
      else skipped.push(`${label}: "${str(o.kind, 40)}" is not invoice, estimate or receipt; read as an invoice.`);
    }
    // A receipt is money already spent, so it is paid whatever else was said.
    let status: CostStatusKey = kind === "receipt" ? "paid" : "received";
    if (kind !== "receipt" && word(o.status)) {
      const s = COST_STATUSES[word(o.status)];
      if (s) status = s;
      else skipped.push(`${label}: "${str(o.status, 40)}" is not received, approved or paid; left as received.`);
    }

    const d = Number(o.days);
    const days = o.days !== undefined && o.days !== null && str(o.days, 10) !== "" && Number.isFinite(d) && d > 0 && d <= 365
      ? Math.round(d * 100) / 100
      : null;

    costs.push({
      vendor,
      description: oneLine(o.description, 500),
      amount: amount.value,
      kind,
      status,
      invoiceNumber: oneLine(o.invoice_number, 100) || null,
      invoiceDate: dateField(o.invoice_date, label, skipped),
      // An estimate's "valid for 30 days" is not a payment date.
      dueDate: kind === "receipt" ? null : dateField(o.due_date, label, skipped),
      days,
      budgetLine: oneLine(o.budget_line, 200) || null,
      notes: str(o.notes, 2000) || null,
    });
  }
  return { costs, skipped };
}

/** How a cost is recognised as already on the ledger. */
export function costKey(c: { vendor: string; amount: number; invoiceNumber?: string | null; invoiceDate?: string | null }): string {
  const v = nameKey(c.vendor);
  if (c.invoiceNumber) return `i:${v}:${nameKey(c.invoiceNumber)}`;
  return `a:${v}:${Math.round(c.amount * 100)}:${c.invoiceDate ?? ""}`;
}

/** A budget line named by id, or by its category or description exactly. */
export function matchBudgetLine(
  want: string | null,
  lines: { id: string; category: string; description: string }[],
): string | null {
  if (!want) return null;
  const byId = lines.find((l) => l.id === want);
  if (byId) return byId.id;
  const k = nameKey(want);
  if (!k) return null;
  const hits = lines.filter((l) => nameKey(l.description) === k || nameKey(l.category) === k);
  if (hits.length === 1) return hits[0].id;
  // A category with several lines under it is ambiguous: say which, not guess.
  return null;
}

/* --------------------------------------------------------------- props */

export type PropOptionEntry = {
  imageUrl: string | null;
  link: string | null;
  name: string | null;
  source: string | null;
  notes: string | null;
};

export type PropEntry = {
  name: string;
  category: string | null;
  qty: number;
  source: string | null;
  notes: string | null;
  options: PropOptionEntry[];
};

function httpUrl(v: unknown): string | null {
  const s = str(v, 2000);
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
}

export function parseProps(raw: unknown): { props: PropEntry[]; skipped: string[] } {
  const props: PropEntry[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const [i, item] of list.entries()) {
    const n = i + 1;
    if (props.length >= MAX_PROPS) {
      skipped.push(`Prop ${n}: over the ${MAX_PROPS} per call limit, send it in another call.`);
      continue;
    }
    const o: Record<string, unknown> =
      typeof item === "string" ? { name: item } : item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const name = oneLine(o.name, 200);
    if (!name) {
      skipped.push(`Prop ${n}: no name.`);
      continue;
    }
    const q = Number(o.qty);
    const qty = Number.isInteger(q) && q >= 1 && q <= 9999 ? q : 1;

    const options: PropOptionEntry[] = [];
    const olist = Array.isArray(o.options) ? o.options : [];
    for (const [j, opt] of olist.entries()) {
      if (options.length >= MAX_PROP_OPTIONS) {
        skipped.push(`${name}: option ${j + 1} is over the ${MAX_PROP_OPTIONS} per prop limit.`);
        continue;
      }
      const p = opt && typeof opt === "object" ? (opt as Record<string, unknown>) : {};
      const imageUrl = httpUrl(p.image_url);
      const link = httpUrl(p.link);
      if (!imageUrl && !link) {
        skipped.push(`${name}: option ${j + 1} has no picture link or page link.`);
        continue;
      }
      options.push({
        imageUrl,
        link,
        name: oneLine(p.name, 200) || null,
        source: oneLine(p.source, 200) || null,
        notes: str(p.notes, 1000) || null,
      });
    }

    props.push({
      name,
      category: oneLine(o.category, 60) || null,
      qty,
      source: oneLine(o.source, 200) || null,
      notes: str(o.notes, 2000) || null,
      options,
    });
  }
  return { props, skipped };
}
