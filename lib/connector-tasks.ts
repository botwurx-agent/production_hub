/**
 * The pure half of the connector's task tool: reading the tasks an assistant
 * sent. NOT `server-only` and free of `@/` imports, so it is unit tested; the
 * assistant's arguments are the trust boundary, the same as in
 * lib/connector-shots.ts.
 *
 * Words are read the way a producer says them ("pre-production", "in
 * progress") rather than only as the stored keys, because an assistant writes
 * what the producer said. Anything unreadable lands the task in its default
 * column and is NAMED in `skipped`, never refuses the task: a task in the
 * wrong lane is one drag from right, and a dropped one is forgotten work.
 */

/** Tasks per call. Text only, so this can be generous. */
export const MAX_TASKS = 30;
const MAX_TITLE = 200;
const MAX_NOTES = 2000;
const MAX_STEPS = 60;
const MAX_STEP = 200;
const MAX_ASSIGNEES = 8;

export type TaskPhaseKey = "pre_pro" | "shoot" | "post" | "delivered";
export type TaskStatusKey = "todo" | "doing" | "waiting" | "done";

export type TaskEntry = {
  title: string;
  notes: string | null;
  dueDate: string | null;
  phase: TaskPhaseKey | null;
  status: TaskStatusKey;
  steps: string[];
  assignees: string[];
};

const PHASES: Record<string, TaskPhaseKey | null> = {
  pre_pro: "pre_pro",
  prepro: "pre_pro",
  preproduction: "pre_pro",
  pre: "pre_pro",
  concept: "pre_pro",
  shoot: "shoot",
  production: "shoot",
  generation: "shoot",
  shooting: "shoot",
  post: "post",
  postproduction: "post",
  edit: "post",
  delivered: "delivered",
  delivery: "delivered",
  anytime: null,
  none: null,
};

const STATUSES: Record<string, TaskStatusKey> = {
  todo: "todo",
  open: "todo",
  doing: "doing",
  inprogress: "doing",
  started: "doing",
  waiting: "waiting",
  blocked: "waiting",
  onhold: "waiting",
  done: "done",
  complete: "done",
  completed: "done",
};

function str(v: unknown, max: number): string {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function oneLine(v: unknown, max: number): string {
  return str(v, max * 2).replace(/\s+/g, " ").slice(0, max);
}

/** "Pre-production" and "pre_pro" both become "preproduction"/"prepro". */
function word(v: unknown): string {
  return str(v, 40).toLowerCase().replace(/[^a-z]/g, "");
}

/** A real calendar day, so 2026-02-31 is refused rather than rolled into March. */
export function realDate(v: unknown): string | null {
  const s = str(v, 40);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
    ? `${m[1]}-${m[2]}-${m[3]}`
    : null;
}

export function parseTasks(raw: unknown): { tasks: TaskEntry[]; skipped: string[] } {
  const tasks: TaskEntry[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const [i, item] of list.entries()) {
    const n = i + 1;
    if (tasks.length >= MAX_TASKS) {
      skipped.push(`Task ${n}: over the ${MAX_TASKS} per call limit, send it in another call.`);
      continue;
    }
    // A bare string is a title, which is the commonest way to list tasks.
    const o: Record<string, unknown> =
      typeof item === "string" ? { title: item } : item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const title = oneLine(o.title, MAX_TITLE);
    if (!title) {
      skipped.push(`Task ${n}: no title.`);
      continue;
    }
    const label = `"${title.length > 40 ? `${title.slice(0, 40)}...` : title}"`;

    const rawDue = str(o.due_date, 40);
    const dueDate = realDate(rawDue);
    if (rawDue && !dueDate) skipped.push(`${label}: the due date was not a real YYYY-MM-DD date; added with no due date.`);

    let phase: TaskPhaseKey | null = null;
    const pw = word(o.phase);
    if (pw) {
      if (pw in PHASES) phase = PHASES[pw];
      else skipped.push(`${label}: the phase "${str(o.phase, 40)}" is not one of pre_pro, shoot, post, delivered; put under Anytime.`);
    }

    let status: TaskStatusKey = "todo";
    const sw = word(o.status);
    if (sw) {
      if (sw in STATUSES) status = STATUSES[sw];
      else skipped.push(`${label}: the status "${str(o.status, 40)}" is not one of todo, doing, waiting, done; put under To do.`);
    }

    const steps: string[] = [];
    const rawSteps = Array.isArray(o.checklist) ? o.checklist : [];
    for (const s of rawSteps) {
      const t = oneLine(typeof s === "object" && s ? (s as Record<string, unknown>).text : s, MAX_STEP);
      if (t) steps.push(t);
      if (steps.length >= MAX_STEPS) break;
    }

    const assignees: string[] = [];
    const rawWho = Array.isArray(o.assignees) ? o.assignees : typeof o.assignees === "string" ? [o.assignees] : [];
    for (const w of rawWho) {
      const t = oneLine(w, 200).toLowerCase();
      if (t && !assignees.includes(t)) assignees.push(t);
      if (assignees.length >= MAX_ASSIGNEES) break;
    }

    tasks.push({ title, notes: str(o.notes, MAX_NOTES) || null, dueDate, phase, status, steps, assignees });
  }
  return { tasks, skipped };
}

/** Words that mean the person the link belongs to. */
export const SELF_WORDS = new Set(["me", "myself", "you", "self", "i"]);

/**
 * Who an assignee word names, against the project's people. An email matches
 * exactly; "me" is the link's owner. Nothing fuzzier: putting a task on the
 * wrong person is worse than leaving it unassigned and saying so.
 */
export function matchAssignee(
  who: string,
  people: { userId: string; label: string }[],
  selfId: string
): string | null {
  const w = who.trim().toLowerCase();
  if (SELF_WORDS.has(w)) return selfId;
  const hit = people.filter((p) => p.label.toLowerCase() === w);
  return hit.length === 1 ? hit[0].userId : null;
}

/** The jsonb the board reads: one named group of unticked steps. */
export function checklistJson(steps: string[], idFor: (i: number) => string) {
  if (!steps.length) return [];
  return [{ id: idFor(-1), name: "Steps", items: steps.map((text, i) => ({ id: idFor(i), text, done: false })) }];
}
