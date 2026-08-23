"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { longDate } from "@/lib/format";
import { personInitials, type Person } from "@/lib/people";
import {
  NO_PHASE,
  TASK_PHASE_ORDER,
  TASK_STATUS,
  TASK_STATUS_ORDER,
  checklistProgress,
  parseChecklist,
  phaseMeta,
  taskStatus,
  type ChecklistItem,
} from "@/lib/tasks";
import type { ProjectTask } from "@/lib/database.types";

/**
 * A card opened up.
 *
 * The board shows what a card IS at a glance; this is where it gets filled in.
 * A modal rather than the inline expander the list used, because on a board an
 * expanding card would reflow the column under the cursor you just dropped
 * with.
 *
 * Every control writes on change and there is no Save button, matching the
 * budget, the call sheet and the shot list. The one exception is the two text
 * fields, which save on blur so a paragraph is one write rather than one per
 * keystroke.
 */

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `i${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}

export function TaskDetailModal({
  task,
  people,
  projectType,
  onClose,
  onPatch,
  onChecklist,
  onDelete,
  busy,
}: {
  task: ProjectTask | null;
  people: Person[];
  projectType: string | null;
  onClose: () => void;
  onPatch: (patch: Record<string, string | null>) => void;
  onChecklist: (items: ChecklistItem[]) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [stepText, setStepText] = useState("");

  // Re-seed when a DIFFERENT card is opened, not on every render of the same
  // one: keying on the id means a background refresh cannot wipe what is
  // half-typed in the notes box.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setStepText("");
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(
    () => parseChecklist(task?.checklist ?? []),
    [task?.checklist]
  );
  const progress = checklistProgress(items);
  const status = taskStatus(task?.status);
  const meta = TASK_STATUS[status];

  if (!task) return null;

  const label = "mb-1 block text-[11px] font-semibold text-text-muted";

  return (
    <Modal open onClose={onClose} title="" size="lg">
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-bold"
              style={{
                backgroundColor: `var(--h-${meta.hue}-bg)`,
                color: `var(--h-${meta.hue})`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: `var(--h-${meta.hue})` }}
              />
              {meta.label}
            </span>
            <span className="text-[11.5px] text-text-faint">{meta.hint}</span>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const t = title.trim();
              if (!t || t === task.title) {
                setTitle(task.title);
                return;
              }
              onPatch({ title: t });
            }}
            className="w-full rounded-[9px] border border-transparent bg-transparent px-1.5 py-0.5 font-display text-xl font-extrabold tracking-tight text-text outline-none transition hover:border-border focus:border-accent"
            aria-label="Task title"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={label}>Column</span>
            <Select
              value={status}
              disabled={busy}
              onChange={(e) => onPatch({ status: e.target.value })}
              className="py-1.5 text-[13px]"
            >
              {TASK_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS[s].label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className={label}>Phase of the job</span>
            <Select
              value={task.phase ?? ""}
              disabled={busy}
              onChange={(e) => onPatch({ phase: e.target.value || null })}
              className="py-1.5 text-[13px]"
            >
              {TASK_PHASE_ORDER.map((p) => (
                <option key={p} value={p === NO_PHASE ? "" : p}>
                  {phaseMeta(p, projectType).label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className={label}>Owner</span>
            <Select
              value={task.assignee_id ?? ""}
              disabled={busy}
              onChange={(e) => onPatch({ assignee_id: e.target.value || null })}
              className="py-1.5 text-[13px]"
            >
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.isSelf ? `${p.label} (you)` : p.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className={label}>Due</span>
            <Input
              type="date"
              value={task.due_date ?? ""}
              disabled={busy}
              onChange={(e) => onPatch({ due_date: e.target.value || null })}
              className="py-1.5 text-[13px]"
            />
          </label>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="text-[11px] font-semibold text-text-muted">
              Steps
            </span>
            {progress.total > 0 && (
              <span className="text-[11px] font-bold text-text-faint">
                {progress.done}/{progress.total}
              </span>
            )}
          </div>
          {progress.total > 0 && (
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface-2">
              <div
                className="h-full rounded-pill transition-all"
                style={{
                  width: `${Math.round((progress.done / progress.total) * 100)}%`,
                  backgroundColor:
                    progress.done === progress.total
                      ? "var(--h-green)"
                      : "var(--h-amber)",
                }}
              />
            </div>
          )}
          {items.length > 0 && (
            <ul className="mb-1.5 space-y-0.5">
              {items.map((it) => (
                <li key={it.id} className="group/step flex items-center gap-2">
                  <button
                    onClick={() =>
                      onChecklist(
                        items.map((x) =>
                          x.id === it.id ? { ...x, done: !x.done } : x
                        )
                      )
                    }
                    disabled={busy}
                    className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border transition"
                    style={{
                      borderColor: it.done
                        ? "var(--h-green)"
                        : "var(--border-strong)",
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
                    className={`min-w-0 flex-1 text-[13px] ${
                      it.done ? "text-text-faint line-through" : "text-text-muted"
                    }`}
                  >
                    {it.text}
                  </span>
                  <button
                    onClick={() => onChecklist(items.filter((x) => x.id !== it.id))}
                    disabled={busy}
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
          <Input
            value={stepText}
            onChange={(e) => setStepText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const t = stepText.trim();
              if (!t) return;
              setStepText("");
              onChecklist([...items, { id: newId(), text: t, done: false }]);
            }}
            placeholder="Add a step, then Enter"
            className="py-1.5 text-[13px]"
          />
        </div>

        <div>
          <span className={label}>Notes</span>
          <Textarea
            value={notes}
            disabled={busy}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if ((task.notes ?? "") === notes.trim()) return;
              onPatch({ notes });
            }}
            placeholder="Anything the person doing this needs to know."
            className="min-h-[80px] text-[13px]"
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-[11px] text-text-faint">
            Added {longDate(task.created_at)}
            {task.assignee_id &&
              people.find((p) => p.userId === task.assignee_id) && (
                <>
                  {" · "}
                  {personInitials(
                    people.find((p) => p.userId === task.assignee_id)!.label
                  )}
                </>
              )}
          </span>
          <button
            onClick={onDelete}
            disabled={busy}
            className="text-[11.5px] font-semibold text-text-faint transition hover:text-red"
          >
            Delete task
          </button>
        </div>
      </div>
    </Modal>
  );
}
