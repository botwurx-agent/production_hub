"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addProjectTask,
  toggleProjectTask,
  updateProjectTask,
  setTaskChecklist,
  deleteProjectTask,
} from "@/app/(app)/projects/[id]/task-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { shortDate } from "@/lib/format";
import { personInitials, type Person } from "@/lib/people";
import {
  NO_PHASE,
  TASK_PHASE_ORDER,
  checklistProgress,
  groupTasks,
  parseChecklist,
  phaseMeta,
  summarizeTasks,
  taskState,
  type ChecklistItem,
  type TaskFilter,
  type TaskPhase,
} from "@/lib/tasks";
import type { ProjectStatus, ProjectTask } from "@/lib/database.types";

/**
 * The project's task list, grouped by the phase of the production.
 *
 * DELIBERATELY NOT A BOARD. The reference for this was a competitor's kanban:
 * drag cards between columns you name yourself. Two reasons not to copy it.
 * First, To do / Doing / Done are the same three words on every board in every
 * industry and carry no meaning until each team invents one, which fails the
 * bar in section 4.1 about modelling production rather than generic software.
 * Second, this app already groups work this way in three places (the Review
 * page's status buckets, the contacts roster's folder tabs, the hub's phase
 * bands), so a grouped list is what Studio Flows looks like and a kanban board
 * is what everything else looks like.
 *
 * Moving a task between phases is a menu on the row, not a drag. Slower by a
 * fraction of a second, works on a phone and with a keyboard, and needs no
 * drag library.
 */

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "mine", label: "Mine" },
  { key: "overdue", label: "Overdue" },
  { key: "done", label: "Done" },
];

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `i${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}

function AssigneeChip({ person }: { person: Person | undefined }) {
  if (!person) return null;
  return (
    <span
      className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-pill text-[10px] font-bold"
      style={{
        backgroundColor: person.isSelf ? "var(--accent-soft)" : "var(--surface-2)",
        color: person.isSelf ? "var(--accent)" : "var(--text-muted)",
      }}
      title={person.isSelf ? `${person.label} (you)` : person.label}
    >
      {personInitials(person.label)}
    </span>
  );
}

function PeopleOptions({ people }: { people: Person[] }) {
  return (
    <>
      <option value="">Unassigned</option>
      {people.map((p) => (
        <option key={p.userId} value={p.userId}>
          {p.isSelf ? `${p.label} (you)` : p.label}
        </option>
      ))}
    </>
  );
}

function PhaseOptions({ projectType }: { projectType: string | null }) {
  return (
    <>
      {TASK_PHASE_ORDER.map((p) => (
        <option key={p} value={p === NO_PHASE ? "" : p}>
          {phaseMeta(p, projectType).label}
        </option>
      ))}
    </>
  );
}

function TaskRow({
  task,
  projectId,
  projectType,
  people,
  todayIso,
  canEdit,
  busy,
  run,
}: {
  task: ProjectTask;
  projectId: string;
  projectType: string | null;
  people: Person[];
  todayIso: string;
  canEdit: boolean;
  busy: boolean;
  run: (fn: () => Promise<{ error?: string } | null | void>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [stepText, setStepText] = useState("");

  const items = useMemo(() => parseChecklist(task.checklist), [task.checklist]);
  const progress = checklistProgress(items);
  const state = taskState(task, todayIso);
  const assignee = people.find((p) => p.userId === task.assignee_id);

  function saveSteps(next: ChecklistItem[]) {
    run(() => setTaskChecklist(projectId, task.id, next));
  }

  const dueStyle =
    state === "overdue"
      ? { backgroundColor: "var(--h-red-bg)", color: "var(--h-red)" }
      : state === "due"
        ? { backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }
        : { color: "var(--text-faint)" };

  return (
    <li
      className={`rounded-[11px] border transition ${
        open
          ? "border-border bg-surface shadow-sm"
          : "border-transparent hover:border-border hover:bg-surface-2/50"
      }`}
    >
      <div className="group flex items-center gap-2.5 px-2.5 py-2">
        <button
          onClick={() => run(() => toggleProjectTask(projectId, task.id, !task.done))}
          disabled={busy || !canEdit}
          className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition"
          style={{
            borderColor: task.done ? "var(--h-green)" : "var(--border-strong)",
            backgroundColor: task.done ? "var(--h-green)" : "transparent",
          }}
          aria-label={task.done ? "Mark not done" : "Mark done"}
        >
          {task.done && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </button>

        <button
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          <span
            className={`block truncate text-sm ${
              task.done ? "text-text-faint line-through" : "text-text"
            }`}
          >
            {task.title}
          </span>
          {!open && (task.notes || progress.total > 0) && (
            <span className="mt-0.5 flex items-center gap-2 text-[11px] text-text-faint">
              {progress.total > 0 && (
                <span className="font-semibold">
                  {progress.done}/{progress.total} steps
                </span>
              )}
              {task.notes && <span className="truncate">{task.notes}</span>}
            </span>
          )}
        </button>

        <AssigneeChip person={assignee} />

        {task.due_date && (
          <span
            className="shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-semibold"
            style={dueStyle}
          >
            {state === "due" ? "Today" : shortDate(task.due_date)}
          </span>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-[7px] p-1 text-text-faint transition hover:text-text"
          aria-label={open ? "Collapse" : "Expand"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? "rotate(180deg)" : undefined }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border px-2.5 py-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-text-muted">
                Phase
              </span>
              <Select
                value={task.phase ?? ""}
                disabled={busy || !canEdit}
                onChange={(e) =>
                  run(() =>
                    updateProjectTask(projectId, task.id, {
                      phase: e.target.value || null,
                    })
                  )
                }
                className="py-1.5 text-[13px]"
              >
                <PhaseOptions projectType={projectType} />
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-text-muted">
                Owner
              </span>
              <Select
                value={task.assignee_id ?? ""}
                disabled={busy || !canEdit}
                onChange={(e) =>
                  run(() =>
                    updateProjectTask(projectId, task.id, {
                      assignee_id: e.target.value || null,
                    })
                  )
                }
                className="py-1.5 text-[13px]"
              >
                <PeopleOptions people={people} />
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-text-muted">
                Due
              </span>
              <Input
                type="date"
                value={task.due_date ?? ""}
                disabled={busy || !canEdit}
                onChange={(e) =>
                  run(() =>
                    updateProjectTask(projectId, task.id, {
                      due_date: e.target.value || null,
                    })
                  )
                }
                className="py-1.5 text-[13px]"
              />
            </label>
          </div>

          <div>
            <span className="mb-1 block text-[11px] font-semibold text-text-muted">
              Steps
            </span>
            {items.length > 0 && (
              <ul className="mb-1.5 space-y-0.5">
                {items.map((it) => (
                  <li key={it.id} className="group/step flex items-center gap-2">
                    <button
                      onClick={() =>
                        saveSteps(
                          items.map((x) =>
                            x.id === it.id ? { ...x, done: !x.done } : x
                          )
                        )
                      }
                      disabled={busy || !canEdit}
                      className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border transition"
                      style={{
                        borderColor: it.done ? "var(--h-green)" : "var(--border-strong)",
                        backgroundColor: it.done ? "var(--h-green)" : "transparent",
                      }}
                      aria-label={it.done ? "Mark step not done" : "Mark step done"}
                    >
                      {it.done && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                    <span
                      className={`min-w-0 flex-1 truncate text-[13px] ${
                        it.done ? "text-text-faint line-through" : "text-text-muted"
                      }`}
                    >
                      {it.text}
                    </span>
                    <button
                      onClick={() => saveSteps(items.filter((x) => x.id !== it.id))}
                      disabled={busy || !canEdit}
                      className="shrink-0 text-text-faint opacity-0 transition hover:text-red group-hover/step:opacity-100"
                      aria-label="Remove step"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <Input
                value={stepText}
                onChange={(e) => setStepText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const t = stepText.trim();
                  if (!t) return;
                  setStepText("");
                  saveSteps([...items, { id: newId(), text: t, done: false }]);
                }}
                placeholder="Add a step, then Enter"
                className="py-1.5 text-[13px]"
              />
            )}
          </div>

          <div>
            <span className="mb-1 block text-[11px] font-semibold text-text-muted">
              Notes
            </span>
            <Textarea
              value={notes}
              disabled={busy || !canEdit}
              onChange={(e) => setNotes(e.target.value)}
              // Saved on blur, not on every keystroke, so a paragraph is one
              // write and one revalidate rather than two hundred.
              onBlur={() => {
                if ((task.notes ?? "") === notes.trim()) return;
                run(() => updateProjectTask(projectId, task.id, { notes }));
              }}
              placeholder="Anything the person doing this needs to know."
              className="min-h-[64px] text-[13px]"
            />
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={() => run(() => deleteProjectTask(projectId, task.id))}
                disabled={busy}
                className="text-[11.5px] font-semibold text-text-faint transition hover:text-red"
              >
                Delete task
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function ProjectTasks({
  projectId,
  projectType,
  projectStatus,
  tasks,
  people,
  todayIso,
  viewerId,
  canEdit = true,
}: {
  projectId: string;
  projectType: string | null;
  /** The stage the job is in, which seeds the composer's phase. */
  projectStatus: ProjectStatus;
  tasks: ProjectTask[];
  people: Person[];
  /** Resolved on the server, so an overdue chip cannot differ after hydration. */
  todayIso: string;
  viewerId: string | null;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [filter, setFilter] = useState<TaskFilter>("open");

  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  // Seeded from where the job actually is. Most tasks somebody types during
  // pre-pro are pre-pro tasks, so this is right more often than empty is, and
  // it is one menu to correct when it is not.
  const [phase, setPhase] = useState<string>(projectStatus);
  const [assignee, setAssignee] = useState<string>("");

  function run(fn: () => Promise<{ error?: string } | null | void>) {
    start(async () => {
      const res = await fn();
      if (res && typeof res === "object" && "error" in res && res.error) {
        toast(res.error, "error");
        return;
      }
      router.refresh();
    });
  }

  function add() {
    const t = title.trim();
    if (!t) return;
    start(async () => {
      const res = await addProjectTask(projectId, {
        title: t,
        dueDate: due || null,
        phase: phase || null,
        assigneeId: assignee || null,
      });
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      setTitle("");
      setDue("");
      // Phase and owner deliberately persist between adds. Tasks arrive in
      // runs ("three more things for the shoot"), so clearing them would make
      // the second and third add cost two extra choices each.
      router.refresh();
    });
  }

  const summary = useMemo(
    () => summarizeTasks(tasks, todayIso),
    [tasks, todayIso]
  );
  const groups = useMemo(
    () => groupTasks(tasks, todayIso, filter, viewerId),
    [tasks, todayIso, filter, viewerId]
  );

  const counts: Record<TaskFilter, number> = {
    open: summary.open,
    mine: tasks.filter((t) => !t.done && t.assignee_id === viewerId).length,
    overdue: summary.overdue,
    done: summary.done,
  };

  const shown = groups.reduce((n, g) => n + g.tasks.length, 0);

  if (tasks.length === 0) {
    return (
      <>
        {canEdit && (
          <Composer
            title={title}
            setTitle={setTitle}
            due={due}
            setDue={setDue}
            phase={phase}
            setPhase={setPhase}
            assignee={assignee}
            setAssignee={setAssignee}
            people={people}
            projectType={projectType}
            busy={busy}
            add={add}
          />
        )}
        <div className="mt-5">
          <EmptyState
            hue="purple"
            title="Nothing on the list yet"
            description="Everything this job still needs, sorted into the phase it belongs to."
            steps={[
              {
                title: "Put it in a phase",
                text: "Pre-pro, production, post or delivery, the same phases the job runs on.",
              },
              {
                title: "Give it an owner",
                text: "Anyone on the studio or on this project. Filter to Mine to see only yours.",
              },
              {
                title: "Break it down",
                text: "Open a task to add steps and notes for whoever picks it up.",
              },
            ]}
          />
        </div>
      </>
    );
  }

  return (
    <div>
      {canEdit && (
        <Composer
          title={title}
          setTitle={setTitle}
          due={due}
          setDue={setDue}
          phase={phase}
          setPhase={setPhase}
          assignee={assignee}
          setAssignee={setAssignee}
          people={people}
          projectType={projectType}
          busy={busy}
          add={add}
        />
      )}

      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold transition ${
                on
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-text-muted hover:border-border-strong hover:text-text"
              }`}
            >
              {f.label}
              <span
                className={`text-[11px] font-bold ${
                  on ? "text-accent" : "text-text-faint"
                }`}
              >
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {shown === 0 ? (
        <p className="mt-5 rounded-[12px] border border-dashed border-border py-8 text-center text-sm text-text-faint">
          Nothing here under this filter.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map((g) => {
            // A lane with nothing in it under the current filter is hidden, but
            // a lane that is genuinely empty for the whole job still shows, so
            // the list reads as the shape of the production rather than only
            // the parts somebody has got to.
            if (g.tasks.length === 0 && g.open > 0) return null;
            if (g.tasks.length === 0 && filter !== "open") return null;
            const meta = phaseMeta(g.phase as TaskPhase, projectType);
            return (
              <section key={g.phase}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: `var(--h-${meta.hue})` }}
                  />
                  <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-text-muted">
                    {meta.label}
                  </h3>
                  <span className="text-[11.5px] font-semibold text-text-faint">
                    {g.open > 0 ? `${g.open} open` : "clear"}
                  </span>
                  {g.overdue > 0 && (
                    <span
                      className="rounded-pill px-1.5 py-0.5 text-[10.5px] font-bold"
                      style={{ backgroundColor: "var(--h-red-bg)", color: "var(--h-red)" }}
                    >
                      {g.overdue} overdue
                    </span>
                  )}
                </div>
                {g.tasks.length === 0 ? (
                  <p className="rounded-[10px] border border-dashed border-border px-3 py-2.5 text-[12.5px] text-text-faint">
                    Nothing planned here yet.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {g.tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        projectId={projectId}
                        projectType={projectType}
                        people={people}
                        todayIso={todayIso}
                        canEdit={canEdit}
                        busy={busy}
                        run={run}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Composer({
  title,
  setTitle,
  due,
  setDue,
  phase,
  setPhase,
  assignee,
  setAssignee,
  people,
  projectType,
  busy,
  add,
}: {
  title: string;
  setTitle: (v: string) => void;
  due: string;
  setDue: (v: string) => void;
  phase: string;
  setPhase: (v: string) => void;
  assignee: string;
  setAssignee: (v: string) => void;
  people: Person[];
  projectType: string | null;
  busy: boolean;
  add: () => void;
}) {
  return (
    <div className="rounded-[13px] border border-border bg-surface-2/40 p-2.5">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
        }}
        placeholder="Add a task, e.g. Send the treatment to Dana"
      />
      {/* Widths live on WRAPPERS, not on the controls. The shared field style
          sets w-full, and a w-auto passed through className does not reliably
          beat it: which wins is decided by the order the two rules end up in
          the built stylesheet, not by the order of the class string. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="w-[140px]">
          <Select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            aria-label="Phase"
            className="py-1.5 text-[13px]"
          >
            <PhaseOptions projectType={projectType} />
          </Select>
        </div>
        {/* Only offered when there is somebody else to offer. On a solo studio
            a picker with one name in it is a control that cannot be wrong, so
            it is only noise. */}
        {people.length > 1 && (
          <div className="w-[190px]">
            <Select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              aria-label="Owner"
              className="py-1.5 text-[13px]"
            >
              <PeopleOptions people={people} />
            </Select>
          </div>
        )}
        <div className="w-[150px]">
          <Input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Due date"
            className="py-1.5 text-[13px]"
          />
        </div>
        <Button
          size="sm"
          onClick={add}
          disabled={busy || !title.trim()}
          className="ml-auto"
        >
          Add task
        </Button>
      </div>
    </div>
  );
}
