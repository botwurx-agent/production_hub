import type { ProjectStatus, ProjectTask } from "@/lib/database.types";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "@/lib/status";
import { stageLabel } from "@/lib/project-types";
import type { Hue } from "@/components/status-tag";

/**
 * What a project's task list is made of.
 *
 * The organising idea, and the reason this is not a kanban board: a task's
 * COLUMN is the phase of the production it belongs to, not a status somebody
 * invented. To do / Doing / Done are the same three words on every board in
 * every industry and mean whatever each person decides they mean. Pre-pro /
 * Shoot / Post / Delivery already mean something precise to a producer, this
 * app already speaks in them (the lifecycle stepper, the project board, the
 * slate), and they rename themselves per job type: an AI project's middle phase
 * is Generation, a live-action one's is Shoot.
 *
 * Done stays a checkbox rather than a fifth column, because finishing a task
 * does not move it to a different part of the production, and because a Done
 * column is where a board goes to accumulate.
 */

/** A task with no phase set. Not a phase, and deliberately last. */
export const NO_PHASE = "anytime" as const;

export type TaskPhase = ProjectStatus | typeof NO_PHASE;

export type ChecklistItem = { id: string; text: string; done: boolean };

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
const MAX_CHECKLIST = 40;
const MAX_ITEM_CHARS = 200;

export function parseChecklist(v: unknown): ChecklistItem[] {
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
    if (out.length >= MAX_CHECKLIST) break;
  }
  return out;
}

export function checklistProgress(items: ChecklistItem[]): {
  done: number;
  total: number;
} {
  return { done: items.filter((i) => i.done).length, total: items.length };
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
  task: Pick<ProjectTask, "done" | "due_date" | "assignee_id">,
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
      return !task.done && !!viewerId && task.assignee_id === viewerId;
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
export function compareTasks(a: ProjectTask, b: ProjectTask): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.due_date && b.due_date && a.due_date !== b.due_date)
    return a.due_date < b.due_date ? -1 : 1;
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

export type TaskGroup = {
  phase: TaskPhase;
  tasks: ProjectTask[];
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
  tasks: ProjectTask[],
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
  tasks: ProjectTask[],
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
