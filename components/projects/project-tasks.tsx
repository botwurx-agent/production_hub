"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addProjectTask,
  toggleProjectTask,
  updateProjectTask,
  moveTask,
  setTaskChecklist,
  setTaskAssignees,
  addTaskFile,
  deleteTaskFile,
  addTaskComment,
  deleteTaskComment,
  deleteProjectTask,
} from "@/app/(app)/projects/[id]/task-actions";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { TaskDetailModal } from "@/components/projects/task-detail-modal";
import { shortDate } from "@/lib/format";
import { personInitials, type Person } from "@/lib/people";
import {
  NO_PHASE,
  TASK_STATUS,
  boardColumns,
  checklistProgress,
  parseChecklist,
  sortKeyFor,
  summarizeTasks,
  taskState,
  taskStatus,
  type BoardTask,
  type ChecklistGroup,
  type GroupBy,
} from "@/lib/tasks";
import type { ProjectStatus } from "@/lib/database.types";

/**
 * The project's task board.
 *
 * COLUMNS ARE PROGRESS BY DEFAULT and you drag cards across them, the motion
 * the rest of this app already uses on the Projects board and the deal
 * pipeline. What makes it ours rather than a generic kanban is two things.
 *
 * WAITING is a first-class column. On a real job a large share of tasks are not
 * blocked by the studio: they are sitting with a client, an agency, a vendor or
 * a location owner. A board without that column pushes all of it into "in
 * progress" and misreports where the job is.
 *
 * GROUP BY PHASE re-columns the same board into the production's own phases,
 * which rename themselves per job type (an AI project reads Concept and
 * Generation). Same cards, same drag, a different question answered.
 *
 * Drag is native HTML5, the same as the call sheet's block reordering, so there
 * is no drag library in the bundle. Dropping computes a MIDPOINT sort key, so
 * one row is written rather than renumbering a column.
 */

const VIEW_KEY = "tasks.groupBy";
const LAYOUT_KEY = "tasks.layout";

type Layout = "board" | "list";

/**
 * Who is on a card.
 *
 * SPACED, NOT OVERLAPPED, which is worth saying because overlapping is what
 * every avatar stack does and it is wrong here. Stacks overlap because they
 * hold photographs, which stay recognisable with a third hidden. These hold two
 * letters, and a 7px overlap ate the first one: PR rendered as R. Initials need
 * their whole width.
 *
 * Capped at three plus a +N. A card is a glance; past three you are counting
 * rather than recognising, and the full list is one click away.
 */
function Assignees({ people }: { people: Person[] }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, 3);
  const rest = people.length - shown.length;
  return (
    <span className="flex shrink-0 items-center gap-[3px]">
      {shown.map((p) => (
        <span
          key={p.userId}
          className="grid h-[22px] w-[22px] place-items-center rounded-pill text-[10px] font-bold"
          style={{
            backgroundColor: p.isSelf ? "var(--accent-soft)" : "var(--surface-2)",
            color: p.isSelf ? "var(--accent)" : "var(--text-muted)",
          }}
          title={p.isSelf ? `${p.label} (you)` : p.label}
        >
          {personInitials(p.label)}
        </span>
      ))}
      {rest > 0 && (
        <span
          className="text-[10.5px] font-bold text-text-faint"
          title={people.slice(3).map((p) => p.label).join(", ")}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

/**
 * One task as a ROW.
 *
 * The list is not a second way to work, it is a second way to READ: a board
 * answers "where is everything", a list answers "what is next", and on a job
 * with forty tasks the second question is the one you ask on a phone. Same
 * cards, same modal, same grouping, so nothing has to be kept in step.
 */
function TaskRow({
  task,
  people,
  todayIso,
  onOpen,
  onToggle,
  busy,
  showStatus,
}: {
  task: BoardTask;
  people: Person[];
  todayIso: string;
  onOpen: () => void;
  onToggle: () => void;
  busy: boolean;
  /** Only when the sections are NOT already the statuses, or it repeats the
   *  heading on every row. */
  showStatus: boolean;
}) {
  const progress = checklistProgress(parseChecklist(task.checklist));
  const state = taskState(task, todayIso);
  const on = people.filter((p) => task.assignees.includes(p.userId));
  const st = TASK_STATUS[taskStatus(task.status)];

  return (
    <li className="flex items-center gap-2.5 rounded-[10px] border border-transparent px-2.5 py-2 transition hover:border-border hover:bg-surface-2">
      <button
        onClick={onToggle}
        disabled={busy}
        className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[5px] border transition"
        style={{
          borderColor: task.done ? "var(--h-green)" : "var(--border-strong)",
          backgroundColor: task.done ? "var(--h-green)" : "transparent",
        }}
        aria-label={task.done ? "Mark not done" : "Mark done"}
      >
        {task.done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </button>

      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span
          className={`block truncate text-[13.5px] ${
            task.done ? "text-text-faint line-through" : "text-text"
          }`}
        >
          {task.title}
        </span>
      </button>

      {/* The column becomes a chip here, since a row has no column to sit in.
          Dropped when the sections already are the columns. */}
      {showStatus && (
        <span
          className="hidden shrink-0 rounded-pill px-2 py-0.5 text-[10.5px] font-bold sm:inline"
          style={{
            backgroundColor: `var(--h-${st.hue}-bg)`,
            color: `var(--h-${st.hue})`,
          }}
        >
          {st.label}
        </span>
      )}

      {progress.total > 0 && (
        <span className="hidden shrink-0 text-[10.5px] font-semibold text-text-faint sm:inline">
          {progress.done}/{progress.total}
        </span>
      )}
      {task.files.length > 0 && (
        <span className="shrink-0 text-[10.5px] font-semibold text-text-faint" title={`${task.files.length} attached`}>
          {task.files.length} file{task.files.length === 1 ? "" : "s"}
        </span>
      )}
      {task.due_date && (
        <span
          className="shrink-0 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold"
          style={
            state === "overdue"
              ? { backgroundColor: "var(--h-red-bg)", color: "var(--h-red)" }
              : state === "due"
                ? { backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }
                : { color: "var(--text-faint)" }
          }
        >
          {state === "due" ? "Today" : shortDate(task.due_date)}
        </span>
      )}
      <Assignees people={on} />
    </li>
  );
}

function TaskCard({
  task,
  people,
  todayIso,
  dragging,
  onOpen,
  onToggle,
  onDragStart,
  onDragEnd,
}: {
  task: BoardTask;
  people: Person[];
  todayIso: string;
  dragging: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const items = parseChecklist(task.checklist);
  const progress = checklistProgress(items);
  const state = taskState(task, todayIso);
  const on = people.filter((p) => task.assignees.includes(p.userId));
  const pct = progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        // Some browsers refuse to start a drag with an empty payload.
        e.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`cursor-grab rounded-[11px] border border-border bg-surface p-2.5 text-left shadow-sm transition hover:-translate-y-px hover:border-border-strong hover:shadow active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="mt-[3px] grid h-[16px] w-[16px] shrink-0 place-items-center rounded-[5px] border transition"
          style={{
            borderColor: task.done ? "var(--h-green)" : "var(--border-strong)",
            backgroundColor: task.done ? "var(--h-green)" : "transparent",
          }}
          aria-label={task.done ? "Mark not done" : "Mark done"}
        >
          {task.done && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </button>
        <span
          className={`min-w-0 flex-1 text-[13px] font-semibold leading-snug ${
            task.done ? "text-text-faint line-through" : "text-text"
          }`}
        >
          {task.title}
        </span>
      </div>

      {/* Images preview on the face of the card. The whole reason to put a
          wardrobe snap or a location photo on a task is to see it without
          opening anything. Non-images stay as a count below. */}
      {task.files.some((f) => f.thumbUrl) && (
        <div className="mt-2 flex gap-1 pl-[24px]">
          {task.files
            .filter((f) => f.thumbUrl)
            .slice(0, 3)
            .map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f.id}
                src={f.thumbUrl as string}
                alt=""
                loading="lazy"
                className="h-11 w-11 rounded-[7px] border border-border object-cover"
              />
            ))}
        </div>
      )}

      {progress.total > 0 && (
        <div className="mt-2 pl-[24px]">
          <div className="flex items-center gap-1.5">
            <span className="text-[10.5px] font-bold text-text-faint">
              {progress.done}/{progress.total}
            </span>
            <span className="text-[10.5px] text-text-faint">{pct}%</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-pill bg-surface-2">
            <div
              className="h-full rounded-pill"
              style={{
                width: `${pct}%`,
                backgroundColor:
                  pct === 100 ? "var(--h-green)" : "var(--h-amber)",
              }}
            />
          </div>
        </div>
      )}

      {(task.due_date || on.length > 0 || task.files.length > 0 || task.comments.length > 0) && (
        <div className="mt-2 flex items-center gap-2 pl-[24px]">
          {task.due_date && (
            <span
              className="rounded-pill px-1.5 py-0.5 text-[10.5px] font-semibold"
              style={
                state === "overdue"
                  ? { backgroundColor: "var(--h-red-bg)", color: "var(--h-red)" }
                  : state === "due"
                    ? { backgroundColor: "var(--h-amber-bg)", color: "var(--h-amber)" }
                    : { color: "var(--text-faint)" }
              }
            >
              {state === "due" ? "Today" : shortDate(task.due_date)}
            </span>
          )}
          {/* Counts, not contents: a card says there is a reference and a
              conversation, and opening it is how you read either. */}
          {task.files.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-text-faint" title={`${task.files.length} attached`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 1 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49" />
              </svg>
              {task.files.length}
            </span>
          )}
          {task.comments.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-text-faint" title={`${task.comments.length} notes`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {task.comments.length}
            </span>
          )}
          <span className="ml-auto">
            <Assignees people={on} />
          </span>
        </div>
      )}
    </div>
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
  canInvite = false,
  canAssign = true,
  pendingInvites = [],
}: {
  projectId: string;
  projectType: string | null;
  /** The stage the job is in, which seeds a new task's phase. */
  projectStatus: ProjectStatus;
  tasks: BoardTask[];
  people: Person[];
  /** Resolved on the server, so an overdue chip cannot differ after hydration. */
  todayIso: string;
  viewerId: string | null;
  /** Staff only: a collaborator cannot invite anyone. */
  canInvite?: boolean;
  /** Staff only: since migration 0100 a collaborator's RLS only lets them
   *  add or remove THEMSELVES, so the picker is read-only for them rather
   *  than a row of toggles that would be refused. */
  canAssign?: boolean;
  /** Invited but not yet accepted, so not assignable yet. */
  pendingInvites?: string[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();

  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [layout, setLayout] = useState<Layout>("board");
  const [mineOnly, setMineOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  // Which axis the board is grouped by is a per-person view preference, the
  // same call as the slate's week count: a browser value, not a migration.
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "status" || v === "phase") setGroupBy(v);
      const l = localStorage.getItem(LAYOUT_KEY);
      if (l === "board" || l === "list") setLayout(l);
    } catch {}
  }, []);
  function pickLayout(v: Layout) {
    setLayout(v);
    try {
      localStorage.setItem(LAYOUT_KEY, v);
    } catch {}
  }
  function pickGroupBy(v: GroupBy) {
    setGroupBy(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  }

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

  const visible = useMemo(
    () =>
      mineOnly && viewerId
        ? tasks.filter((t) => t.assignees.includes(viewerId))
        : tasks,
    [tasks, mineOnly, viewerId]
  );

  const columns = useMemo(
    () => boardColumns(visible, groupBy, projectType),
    [visible, groupBy, projectType]
  );
  const summary = useMemo(
    () => summarizeTasks(tasks, todayIso),
    [tasks, todayIso]
  );
  const mineCount = tasks.filter(
    (t) => !t.done && viewerId !== null && t.assignees.includes(viewerId)
  ).length;

  const open = tasks.find((t) => t.id === openId) ?? null;

  /**
   * A card dropped on a column, at `index` within it.
   *
   * The dragged card is removed from the target column BEFORE the midpoint is
   * computed, otherwise dropping a card back next to itself would average its
   * own key with a neighbour's and it would appear not to move.
   */
  function drop(columnKey: string, index: number) {
    const id = dragId;
    setDragId(null);
    setDropCol(null);
    if (!id) return;
    const col = columns.find((c) => c.key === columnKey);
    if (!col) return;
    const without = col.tasks.filter((t) => t.id !== id);
    const at = Math.min(index, without.length);
    const key = sortKeyFor(without, at);
    const value = columnKey === NO_PHASE ? null : columnKey;
    run(() => moveTask(projectId, id, groupBy, value, key));
  }

  function addTo(columnKey: string) {
    const t = newTitle.trim();
    if (!t) {
      setAddingTo(null);
      return;
    }
    setNewTitle("");
    start(async () => {
      const res = await addProjectTask(projectId, {
        title: t,
        // The column you typed into decides one axis; the other takes its
        // sensible default, which for a phase is where the job actually is.
        status: groupBy === "status" ? columnKey : "todo",
        phase:
          groupBy === "phase"
            ? columnKey === NO_PHASE
              ? null
              : columnKey
            : projectStatus,
      });
      if ("error" in res) {
        toast(res.error, "error");
        return;
      }
      router.refresh();
    });
  }

  const toggleClass = (on: boolean) =>
    `rounded-pill px-2.5 py-1 text-xs font-semibold transition ${
      on
        ? "bg-surface text-text shadow-sm"
        : "text-text-muted hover:text-text"
    }`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-pill bg-surface-2 p-1">
          <button onClick={() => pickLayout("board")} className={toggleClass(layout === "board")}>
            Board
          </button>
          <button onClick={() => pickLayout("list")} className={toggleClass(layout === "list")}>
            List
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-pill bg-surface-2 p-1">
          <button onClick={() => pickGroupBy("status")} className={toggleClass(groupBy === "status")}>
            By status
          </button>
          <button onClick={() => pickGroupBy("phase")} className={toggleClass(groupBy === "phase")}>
            By phase
          </button>
        </div>

        {people.length > 1 && (
          <div className="flex items-center gap-1 rounded-pill bg-surface-2 p-1">
            <button onClick={() => setMineOnly(false)} className={toggleClass(!mineOnly)}>
              Everyone
            </button>
            <button onClick={() => setMineOnly(true)} className={toggleClass(mineOnly)}>
              Mine {mineCount > 0 ? mineCount : ""}
            </button>
          </div>
        )}

        <span className="ml-auto text-xs font-medium text-text-faint">
          {summary.open} open
          {summary.overdue > 0 && (
            <>
              {" · "}
              <span style={{ color: "var(--h-red)" }} className="font-bold">
                {summary.overdue} overdue
              </span>
            </>
          )}
        </span>
      </div>

      {/* An EMPTY BOARD IS STILL THE BOARD, and it used to be replaced by a
          rich empty state whose "Add the first task" button set the
          add-a-card state on a column that was not rendered, so pressing it
          did nothing at all. The lesson is the general one: never put the only
          way in behind a branch that hides the thing it acts on.
          Four labelled columns with their own add buttons explain themselves
          better than a blank slate with an explainer would, and this is where
          Waiting gets noticed. So the board always renders and an empty one
          just gets a line of context above it. */}
      {tasks.length === 0 && (
        <p className="mb-4 rounded-[12px] border border-dashed border-border bg-surface-2 px-3.5 py-3 text-[13px] text-text-muted">
          <span className="font-semibold text-text">Nothing on the board yet.</span>{" "}
          Add what this job still needs to a column, then drag a card as the
          work moves. Waiting is its own column, because a lot of production is
          waiting on somebody else.
        </p>
      )}

      {layout === "list" ? (
        // The SAME columns, read as sections. Grouping is shared with the
        // board on purpose: switching layout should change how the work looks,
        // never what it is grouped by, or the toggle becomes two settings.
        <div className="space-y-5">
          {columns.map((col) => (
            <section key={col.key}>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--h-${col.hue})` }}
                />
                <h3 className="text-[12.5px] font-bold uppercase tracking-wide text-text-muted">
                  {col.label}
                </h3>
                <span className="text-[11.5px] font-semibold text-text-faint">
                  {col.tasks.length}
                </span>
                <button
                  onClick={() => {
                    setNewTitle("");
                    setAddingTo(col.key);
                  }}
                  className="ml-auto text-[11.5px] font-semibold text-text-faint transition hover:text-accent"
                >
                  + Add task
                </button>
              </div>
              {addingTo === col.key && (
                <Input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onBlur={() => addTo(col.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTo(col.key);
                    if (e.key === "Escape") {
                      setNewTitle("");
                      setAddingTo(null);
                    }
                  }}
                  placeholder="What needs doing?"
                  className="mb-1 py-1.5 text-[13px]"
                />
              )}
              {col.tasks.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-border px-3 py-2.5 text-[12.5px] text-text-faint">
                  {col.hint || "Nothing here"}
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {col.tasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      people={people}
                      todayIso={todayIso}
                      busy={busy}
                      showStatus={groupBy !== "status"}
                      onOpen={() => setOpenId(t.id)}
                      onToggle={() =>
                        run(() => toggleProjectTask(projectId, t.id, !t.done))
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : (
      /* Columns FILL the width when they fit and scroll when they do not,
         which matters because grouping by phase adds a fifth. min-w keeps a
         card readable rather than letting five columns squeeze to nothing. */
      <div className="-mx-1 flex items-stretch gap-3 overflow-x-auto px-1 pb-2">
          {columns.map((col) => {
            const over = dropCol === col.key;
            return (
              <div
                key={col.key}
                className="flex min-w-[236px] flex-1 flex-col"
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropCol(col.key);
                }}
                onDragLeave={(e) => {
                  // Only clear when the pointer actually left the column, not
                  // when it crossed onto a card inside it.
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setDropCol((c) => (c === col.key ? null : c));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(col.key, col.tasks.length);
                }}
              >
                <div
                  className="mb-2 flex items-center gap-2 rounded-[11px] px-3 py-2"
                  style={{ backgroundColor: `var(--h-${col.hue}-bg)` }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: `var(--h-${col.hue})` }}
                    aria-hidden="true"
                  />
                  <span
                    className="truncate text-sm font-extrabold"
                    style={{ color: `var(--h-${col.hue})` }}
                  >
                    {col.label}
                  </span>
                  <span
                    className="ml-auto rounded-pill px-2 py-0.5 text-xs font-bold"
                    style={{
                      backgroundColor: "var(--surface)",
                      color: `var(--h-${col.hue})`,
                    }}
                  >
                    {col.tasks.length}
                  </span>
                </div>

                <div
                  className={`flex min-h-[120px] flex-1 flex-col gap-2 rounded-[16px] border-t-2 p-2 transition ${
                    over ? "bg-accent-soft" : "bg-surface-2"
                  }`}
                  style={{ borderColor: `var(--h-${col.hue})` }}
                >
                  {col.tasks.map((t, i) => (
                    <div
                      key={t.id}
                      onDragOver={(e) => {
                        if (!dragId || dragId === t.id) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setDropCol(col.key);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        drop(col.key, i);
                      }}
                    >
                      <TaskCard
                        task={t}
                        people={people}
                        todayIso={todayIso}
                        dragging={dragId === t.id}
                        onOpen={() => setOpenId(t.id)}
                        onToggle={() =>
                          run(() => toggleProjectTask(projectId, t.id, !t.done))
                        }
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => {
                          setDragId(null);
                          setDropCol(null);
                        }}
                      />
                    </div>
                  ))}

                  {col.tasks.length === 0 && !over && (
                    <p className="px-2 py-5 text-center text-[11.5px] text-text-faint">
                      {col.hint || "Nothing here"}
                    </p>
                  )}

                  {addingTo === col.key ? (
                    <Input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onBlur={() => addTo(col.key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addTo(col.key);
                        if (e.key === "Escape") {
                          setNewTitle("");
                          setAddingTo(null);
                        }
                      }}
                      placeholder="What needs doing?"
                      className="py-1.5 text-[13px]"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setNewTitle("");
                        setAddingTo(col.key);
                      }}
                      className="rounded-[9px] px-2 py-1.5 text-left text-[12.5px] font-semibold text-text-faint transition hover:bg-surface hover:text-text"
                    >
                      + Add task
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
      )}

      <TaskDetailModal
        task={open}
        people={people}
        projectType={projectType}
        canInvite={canInvite}
        canAssign={canAssign}
        pendingInvites={pendingInvites}
        busy={busy}
        onClose={() => setOpenId(null)}
        onPatch={(patch) =>
          run(() => updateProjectTask(projectId, open!.id, patch))
        }
        onChecklist={(groups: ChecklistGroup[]) =>
          run(() => setTaskChecklist(projectId, open!.id, groups))
        }
        onAssignees={(ids: string[]) =>
          run(() => setTaskAssignees(projectId, open!.id, ids))
        }
        onAddFile={(fd: FormData) => run(() => addTaskFile(projectId, open!.id, fd))}
        onRemoveFile={(fileId: string) => run(() => deleteTaskFile(projectId, fileId))}
        onComment={(body: string) =>
          run(() => addTaskComment(projectId, open!.id, body))
        }
        onDeleteComment={(id: string) =>
          run(() => deleteTaskComment(projectId, id))
        }
        onDelete={() => {
          const id = open!.id;
          setOpenId(null);
          run(() => deleteProjectTask(projectId, id));
        }}
      />
    </div>
  );
}
