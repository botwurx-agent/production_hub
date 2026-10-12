/**
 * The pure half of the connector's CRM tools (add_deal, log_crm): reading what
 * an assistant sent. NOT `server-only` and free of `@/` imports so it can be
 * unit tested, the same as lib/connector-records.ts, whose money, date and
 * name rules it reuses so a deal's value is read exactly like a cost's.
 *
 * A deal made here is always OPEN. Winning or losing one is a change to a deal
 * that exists (it activates the account, closes the deal, asks for a reason),
 * and the connector does not change things, so "awarded" and "lost" are
 * refused with a sentence rather than written.
 */
import { moneyOf, nameKey, realDate } from "./connector-records";

export const MAX_ACTIVITIES = 20;
export const MAX_FOLLOW_UPS = 20;
/** A deal larger than this is a misread, not a job. */
export const MAX_DEAL_VALUE = 100_000_000;

export type OpenStage = "inbound" | "qualifying" | "bidding";
export type ActivityKind = "note" | "call" | "meeting" | "email";

export type DealInput = {
  title: string;
  value: number | null;
  probability: number | null;
  stage: OpenStage;
  expectedClose: string | null;
  source: string | null;
  notes: string | null;
};

export type ActivityInput = { kind: ActivityKind; body: string; occurredAt: string | null };
export type FollowUpInput = { title: string; dueDate: string | null; notes: string | null };

function str(v: unknown, max: number): string {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}
function oneLine(v: unknown, max: number): string {
  return str(v, max * 2).replace(/\s+/g, " ").slice(0, max);
}

const STAGE_WORDS: Record<string, OpenStage | "awarded" | "lost"> = {
  inbound: "inbound",
  new: "inbound",
  lead: "inbound",
  qualifying: "qualifying",
  qualified: "qualifying",
  contacted: "qualifying",
  discovery: "qualifying",
  bidding: "bidding",
  bid: "bidding",
  proposal: "bidding",
  quoting: "bidding",
  quoted: "bidding",
  estimate: "bidding",
  awarded: "awarded",
  won: "awarded",
  lost: "lost",
};

/** A stage as a producer says it. Null when it is not one. */
export function stageOf(v: unknown): OpenStage | "awarded" | "lost" | null {
  const w = str(v, 40).toLowerCase().replace(/[^a-z]/g, "");
  return w ? STAGE_WORDS[w] ?? null : null;
}

const KIND_WORDS: Record<string, ActivityKind> = {
  note: "note",
  notes: "note",
  call: "call",
  phone: "call",
  phonecall: "call",
  meeting: "meeting",
  meet: "meeting",
  zoom: "meeting",
  lunch: "meeting",
  coffee: "meeting",
  email: "email",
  mail: "email",
  emailed: "email",
};

export function kindOf(v: unknown): ActivityKind | null {
  const w = str(v, 40).toLowerCase().replace(/[^a-z]/g, "");
  return w ? KIND_WORDS[w] ?? null : null;
}

export function parseDeal(args: Record<string, unknown>): { deal: DealInput | null; skipped: string[] } {
  const skipped: string[] = [];
  const title = oneLine(args.title, 200);
  if (!title) return { deal: null, skipped };

  let stage: OpenStage = "inbound";
  const rawStage = str(args.stage, 40);
  if (rawStage) {
    const s = stageOf(rawStage);
    if (s === "awarded" || s === "lost") {
      skipped.push(`Stage "${rawStage}": a deal is added open (Inbound). Mark it ${s === "awarded" ? "won" : "lost"} on its page in Studio Flows.`);
    } else if (s) stage = s;
    else skipped.push(`Stage "${rawStage}" is not inbound, qualifying or bidding; added as Inbound.`);
  }

  let value: number | null = null;
  const m = moneyOf(args.value, MAX_DEAL_VALUE);
  if (m.ok) value = m.value;
  else skipped.push(`Value "${str(args.value, 40)}" could not be read as an amount; left blank.`);

  let probability: number | null = null;
  const rawP = str(args.probability, 20).replace(/%$/, "").trim();
  if (rawP) {
    const p = Number(rawP);
    if (Number.isFinite(p) && p >= 0 && p <= 100) probability = Math.round(p);
    else skipped.push(`Probability "${str(args.probability, 20)}" is not 0 to 100; left blank.`);
  }

  const rawClose = str(args.expected_close_date, 40);
  const expectedClose = realDate(rawClose);
  if (rawClose && !expectedClose) skipped.push(`Expected close "${rawClose}" is not a real YYYY-MM-DD date; left blank.`);

  return {
    deal: {
      title,
      value,
      probability,
      stage,
      expectedClose,
      source: oneLine(args.source, 120) || null,
      notes: str(args.notes, 4000) || null,
    },
    skipped,
  };
}

/** A date or a timestamp. A bare date is noon UTC so no timezone moves its day. */
export function occurredAt(v: unknown): string | null {
  const raw = str(v, 60);
  if (!raw) return null;
  const day = realDate(raw);
  if (!day) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${day}T12:00:00.000Z`;
  const t = new Date(raw);
  return Number.isNaN(t.getTime()) ? `${day}T12:00:00.000Z` : t.toISOString();
}

export function parseActivities(raw: unknown): { activities: ActivityInput[]; skipped: string[] } {
  const activities: ActivityInput[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const [i, item] of list.entries()) {
    const n = i + 1;
    if (activities.length >= MAX_ACTIVITIES) {
      skipped.push(`Entry ${n}: over the ${MAX_ACTIVITIES} per call limit.`);
      continue;
    }
    const o: Record<string, unknown> =
      typeof item === "string" ? { body: item } : item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const body = str(o.body ?? o.text ?? o.summary, 4000);
    if (!body) {
      skipped.push(`Entry ${n}: nothing to write.`);
      continue;
    }
    let kind: ActivityKind = "note";
    if (str(o.kind, 40)) {
      const k = kindOf(o.kind);
      if (k) kind = k;
      else skipped.push(`Entry ${n}: "${str(o.kind, 40)}" is not a note, call, meeting or email; logged as a note.`);
    }
    const rawAt = str(o.occurred_at ?? o.date, 60);
    const at = occurredAt(rawAt);
    if (rawAt && !at) skipped.push(`Entry ${n}: "${rawAt}" is not a real date; logged as today.`);
    activities.push({ kind, body, occurredAt: at });
  }
  return { activities, skipped };
}

export function parseFollowUps(raw: unknown): { followUps: FollowUpInput[]; skipped: string[] } {
  const followUps: FollowUpInput[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const [i, item] of list.entries()) {
    const n = i + 1;
    if (followUps.length >= MAX_FOLLOW_UPS) {
      skipped.push(`Follow-up ${n}: over the ${MAX_FOLLOW_UPS} per call limit.`);
      continue;
    }
    const o: Record<string, unknown> =
      typeof item === "string" ? { title: item } : item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const title = oneLine(o.title, 200);
    if (!title) {
      skipped.push(`Follow-up ${n}: no title.`);
      continue;
    }
    const rawDue = str(o.due_date, 40);
    const dueDate = realDate(rawDue);
    if (rawDue && !dueDate) skipped.push(`${title}: "${rawDue}" is not a real YYYY-MM-DD date; no due date set.`);
    followUps.push({ title, dueDate, notes: str(o.notes, 2000) || null });
  }
  return { followUps, skipped };
}

/** Same kind, same words, same day: the second run of one request. */
export function activityKey(kind: string, body: string, at: string | null): string {
  return `${kind}|${nameKey(body)}|${(at ?? "").slice(0, 10)}`;
}
