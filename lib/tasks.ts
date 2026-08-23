import type { ProjectStatus, ProjectTask } from "@/lib/database.types";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/lib/status";
import { stageLabel } from "@/lib/project-types";
import type { Hue } from "@/components/status-tag";

/**
 * What a project's task list is made of.
 *
 * A task carries TWO independent axes, and the board can be grouped by either.
 *
 * STATUS is progress, and it is what you drag across: To do, In progress,
 * Waiting, Done. Waiting is the one worth having and the reason this is not a
 * generic kanban: on a real job a large share of tasks are not blocked by the
 * studio at all, they are sitting with a client, an agency, a vendor or a
 * location owner. A board without that column pushes all of it into "in
 * progress" and misreports where the job actually is.
 *
 * PHASE is which part of the production a task belongs to: pre-pro, production,
 * post, delivery. It reuses the project_status values the lifecycle stepper and
 * the project board already use, so it renames itself per job type (an AI
 * project's middle phase is Generation, a live-action one's is Shoot). Grouping
 * the board by phase answers a different question than grouping by status, and
 * no competitor's board can relabel itself to the job.
 */

/** A task with no phase set. Not a phase, and deliberately last. */
export const NO_PHASE = "anytime" as const;

export type TaskPhase = ProjectStatus | typeof NO_PHASE;

export type ChecklistItem = { id: string; text: string; done: boolean };

/**
 * A NAMED list of steps. A card routinely carries more than one: "Write the
 * script" and "Deliver the cutdowns" are separate runs of work on the same
 * task, and one flat list makes them read as a single sequence.
 */
export type ChecklistGroup = {
  id: string;
  name: string;
  items: ChecklistItem[];
};

/**
 * A task as the board reads it: the row plus who is on it.
 *
 * Assignees live in their own table since migration 0096, because a card
 * routinely has more than one name on it (a shoot-day setup is the DP and the
 * gaffer). The page flattens the embedded rows to user ids, so nothing below
 * this line has to know how they are stored.
 */
export type TaskFile = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Signed for an hour. Absent if signing failed. */
  url: string | null;
  /** A resized copy, images only, so a card of snaps is not full-size bytes. */
  thumbUrl: string | null;
};

export type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  /** Best available identity for the author, resolved the same way as people. */
  author: string;
  /** Whether the viewer wrote it: only your own can be removed. */
  mine: boolean;
};

export type BoardTask = ProjectTask & {
  assignees: string[];
  files: TaskFile[];
  comments: TaskComment[];
};

/** Ordered lanes: the four production phases, then the unphased catch-all. */
export const TASK_PHASE_ORDER: TaskPhase[] = [
  ...PROJECT_STATUS_ORDER,
  NO_PHASE,
];

/**
 * The lane's name and colour for a given project.
 *
 * `projectType` is threaded through rather than looked up, because the label
 * for the middle phase depends on it and a task list that says "Shoot" on a
 * generated job is wrong in the one place the vocabulary matters.
 */
export function phaseMeta(
  phase: TaskPhase,
  projectType: string | null | undefined
): { label: string; hue: Hue; hint: string } {
  if (phase === NO_PHASE) {
    return {
      label: "Anytime",
      hue: "cyan",
      hint: "Not tied to a phase of the job",
    };
  }
  return {
    label: stageLabel(phase, projectType),
    hue: PROJECT_STATUS[phase].hue,
    hint: "",
  };
}

/** Narrow an untrusted value (a form field, a Runner argument) to a phase. */
export function taskPhase(v: string | null | undefined): ProjectStatus | null {
  return v && (PROJECT_STATUS_ORDER as string[]).includes(v)
    ? (v as ProjectStatus)
    : null;
}

/**
 * The trust boundary between a jsonb column and the page.
 *
 * Same job as parseWardrobe: whatever is in the column may have been written by
 * an older shape of this code, so nothing here may assume a field exists. Caps
 * are there so one bad row cannot render a thousand checkboxes.
 */
const MAX_GROUPS = 12;
const MAX_ITEMS = 60;
const MAX_ITEM_CHARS = 200;
const MAX_NAME_CHARS = 80;

/** The name a flat list gets when it is read forward into a group. */
export const DEFAULT_CHECKLIST_NAME = "Steps";

function parseItems(v: unknown): ChecklistItem[] {
  if (!Array.isArray(v)) return [];
  const out: ChecklistItem[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) continue;
    out.push({
      // An id is only needed to key a row and target a toggle. A missing one is
      // a shape from before this existed, not a reason to drop the step.
      id: typeof item.id === "string" && item.id ? item.id : `i${out.length}`,
      text: text.slice(0, MAX_ITEM_CHARS),
      done: item.done === true,
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/**
 * Reads the column into NAMED groups, accepting both shapes it has ever had.
 *
 * A flat `[{id, text, done}]` is everything written before checklists got
 * names, and it comes back as one group called Steps. That is why there is no
 * migration for this: the old shape is not wrong, it is a group nobody named,
 * and a backfill would have had to guess at a name anyway.
 *
 * Same trust-boundary job as parseWardrobe. Nothing may assume a field exists,
 * and the caps stop one bad row rendering a thousand checkboxes.
 */
export function parseChecklist(v: unknown): ChecklistGroup[] {
  if (!Array.isArray(v) || v.length === 0) return [];

  // The old shape: an array of items rather than of groups. Detected by the
  // presence of `text`, since a group has `items` and never has text.
  const looksFlat = v.some(
    (raw) => raw && typeof raw === "object" && "text" in (raw as object)
  );
  if (looksFlat) {
    const items = parseItems(v);
    return items.length
      ? [{ id: "g0", name: DEFAULT_CHECKLIST_NAME, items }]
      : [];
  }

  const out: ChecklistGroup[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const g = raw as Record<string, unknown>;
    const items = parseItems(g.items);
    const name =
      typeof g.name === "string" && g.name.trim()
        ? g.name.trim().slice(0, MAX_NAME_CHARS)
        : DEFAULT_CHECKLIST_NAME;
    // An EMPTY group is kept, unlike an empty item: somebody named it and is
    // about to fill it, and dropping it on the round trip would delete a list
    // the moment it was created.
    out.push({
      id: typeof g.id === "string" && g.id ? g.id : `g${out.length}`,
      name,
      items,
    });
    if (out.length >= MAX_GROUPS) break;
  }
  return out;
}

/** Across every group, since the card shows one bar for the whole task. */
export function checklistProgress(groups: ChecklistGroup[]): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const g of groups) {
    for (const i of g.items) {
      total++;
      if (i.done) done++;
    }
  }
  return { done, total };
}

export type TaskState = "done" | "overdue" | "due" | "open";

/**
 * `todayIso` is passed in, never read from the clock here, matching the slate
 * and the payment schedule: the server decides what today is, so an overdue
 * chip cannot render one way on the server and another after hydration.
 */
export function taskState(
  task: Pick<ProjectTask, "done" | "due_date">,
  todayIso: string
): TaskState {
  if (task.done) return "done";
  if (!task.due_date) return "open";
  if (task.due_date < todayIso) return "overdue";
  if (task.due_date === todayIso) return "due";
  return "open";
}

export type TaskFilter = "open" | "mine" | "overdue" | "done";

export function matchesFilter(
  task: Pick<BoardTask, "done" | "due_date" | "assignees">,
  filter: TaskFilter,
  todayIso: string,
  viewerId: string | null
): boolean {
  switch (filter) {
    case "done":
      return task.done;
    case "overdue":
      return taskState(task, todayIso) === "overdue";
    case "mine":
      // Unassigned work is nobody's "mine". Showing it here would make the
      // filter mean "open" on a solo studio, which is no filter at all.
      return !task.done && !!viewerId && task.assignees.includes(viewerId);
    case "open":
    default:
      return !task.done;
  }
}

/**
 * Within a lane: soonest first, then dated before undated, then oldest first.
 *
 * Undated last is the important one. A task with no due date is not urgent by
 * virtue of having no date, and sorting nulls first would put every vague
 * intention above tomorrow's delivery.
 */
export function compareTasks(a: BoardTask, b: BoardTask): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.due_date && b.due_date && a.due_date !== b.due_date)
    return a.due_date < b.due_date ? -1 : 1;
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

export type TaskGroup = {
  phase: TaskPhase;
  tasks: BoardTask[];
  /** Open tasks in this lane BEFORE the filter ran, so the count is stable. */
  open: number;
  overdue: number;
};

/**
 * Every lane is returned, including empty ones, so the page shows the shape of
 * the job rather than only the parts that happen to have work in them. An empty
 * Post lane is information: nobody has planned post yet.
 */
export function groupTasks(
  tasks: BoardTask[],
  todayIso: string,
  filter: TaskFilter,
  viewerId: string | null
): TaskGroup[] {
  return TASK_PHASE_ORDER.map((phase) => {
    const inPhase = tasks.filter(
      (t) => (t.phase ?? NO_PHASE) === phase
    );
    return {
      phase,
      tasks: inPhase
        .filter((t) => matchesFilter(t, filter, todayIso, viewerId))
        .sort(compareTasks),
      open: inPhase.filter((t) => !t.done).length,
      overdue: inPhase.filter((t) => taskState(t, todayIso) === "overdue")
        .length,
    };
  });
}

export function summarizeTasks(
  tasks: BoardTask[],
  todayIso: string
): { open: number; overdue: number; done: number; total: number } {
  let open = 0;
  let overdue = 0;
  let done = 0;
  for (const t of tasks) {
    if (t.done) done++;
    else {
      open++;
      if (taskState(t, todayIso) === "overdue") overdue++;
    }
  }
  return { open, overdue, done, total: tasks.length };
}

/* ---------------------------------------------------------------- status --
 * The board's default columns: what is happening to a task right now.
 */

export const TASK_STATUS_ORDER = ["todo", "doing", "waiting", "done"] as const;
export type TaskStatus = (typeof TASK_STATUS_ORDER)[number];

export const TASK_STATUS: Record<
  TaskStatus,
  { label: string; hue: Hue; hint: string }
> = {
  todo: { label: "To do", hue: "cyan", hint: "Not started" },
  doing: { label: "In progress", hue: "blue", hint: "Being worked on now" },
  // Amber, matching every other "someone else owes us something" signal in the
  // app, because that is exactly what this column is.
  waiting: {
    label: "Waiting",
    hue: "amber",
    hint: "Sitting with a client, a vendor or the crew",
  },
  done: { label: "Done", hue: "green", hint: "Finished" },
};

/** Narrow an untrusted value to a column. Anything unknown is unstarted. */
export function taskStatus(v: string | null | undefined): TaskStatus {
  return (TASK_STATUS_ORDER as readonly string[]).includes(v ?? "")
    ? (v as TaskStatus)
    : "todo";
}

/* ----------------------------------------------------------- the board ---- */

export type GroupBy = "status" | "phase";

export type BoardColumn = {
  /** The value written when a card is dropped here. Null is the Anytime lane. */
  key: string;
  label: string;
  hue: Hue;
  hint: string;
  tasks: BoardTask[];
};

/**
 * Columns for whichever axis is being grouped by, every column always present.
 *
 * An empty column is information on a board in a way it is not in a list: it
 * says nothing is waiting on anyone, or that nobody has planned post yet.
 */
export function boardColumns(
  tasks: BoardTask[],
  groupBy: GroupBy,
  projectType: string | null | undefined
): BoardColumn[] {
  const inColumn = (key: string) =>
    tasks
      .filter((t) =>
        groupBy === "status"
          ? taskStatus(t.status) === key
          : (t.phase ?? NO_PHASE) === key
      )
      .sort(compareForBoard);

  if (groupBy === "status") {
    return TASK_STATUS_ORDER.map((key) => ({
      key,
      ...TASK_STATUS[key],
      tasks: inColumn(key),
    }));
  }
  return TASK_PHASE_ORDER.map((key) => {
    const meta = phaseMeta(key, projectType);
    return { key, label: meta.label, hue: meta.hue, hint: meta.hint, tasks: inColumn(key) };
  });
}

/**
 * Order inside a column: the hand-placed position first, then the due date.
 *
 * `sort` starts at 0 for every task that existed before the board did, so a
 * column nobody has dragged in still reads soonest-first rather than in
 * whatever order Postgres returned.
 */
export function compareForBoard(a: BoardTask, b: BoardTask): number {
  if (a.sort !== b.sort) return a.sort - b.sort;
  return compareTasks(a, b);
}

/**
 * The sort key for a card dropped at `index` within `column`.
 *
 * Midpoint insertion: only the dragged card is written, so a drop is one row
 * update rather than renumbering the column. `column` must NOT include the card
 * being moved, or dropping a card next to itself computes a midpoint against
 * its own key and it does not move.
 *
 * Floats do run out of precision if you drop repeatedly into the same gap
 * (about fifty times from a gap of 1), at which point two cards share a key and
 * compareForBoard falls through to the due date. Worth knowing, not worth a
 * renumbering pass: the failure is a pair of cards in a stable but unintended
 * order, not lost work.
 */
export function sortKeyFor(column: BoardTask[], index: number): number {
  const before = index > 0 ? column[index - 1]?.sort : undefined;
  const after = column[index]?.sort;
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return (after as number) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}
