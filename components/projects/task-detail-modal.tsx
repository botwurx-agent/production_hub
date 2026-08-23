"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { longDate, shortDate } from "@/lib/format";
import { formatBytes, MAX_UPLOAD_BYTES } from "@/lib/attachment-limits";
import { personInitials, type Person } from "@/lib/people";
import { openInvite } from "@/components/app-shell/invite-open";
import {
  NO_PHASE,
  TASK_PHASE_ORDER,
  TASK_STATUS,
  TASK_STATUS_ORDER,
  checklistProgress,
  parseChecklist,
  phaseMeta,
  taskStatus,
  DEFAULT_CHECKLIST_NAME,
  type BoardTask,
  type ChecklistGroup,
} from "@/lib/tasks";

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
  onAssignees,
  onAddFile,
  onRemoveFile,
  onComment,
  onDeleteComment,
  onDelete,
  busy,
  canInvite = false,
  pendingInvites = [],
}: {
  task: BoardTask | null;
  people: Person[];
  projectType: string | null;
  /**
   * Whether to offer an invite. Decided on the server: a collaborator cannot
   * invite anyone, the panel is not mounted for them, and offering it would be
   * a button that does nothing.
   */
  canInvite?: boolean;
  /** Invited but not yet accepted. Shown, never assignable: an invite creates
   *  no user until it is accepted, so there is nothing to assign to. */
  pendingInvites?: string[];
  onClose: () => void;
  onPatch: (patch: Record<string, string | null>) => void;
  onChecklist: (groups: ChecklistGroup[]) => void;
  onAssignees: (userIds: string[]) => void;
  onAddFile: (formData: FormData) => void;
  onRemoveFile: (fileId: string) => void;
  onComment: (body: string) => void;
  onDeleteComment: (id: string) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  // Keyed by checklist, so typing in one does not clear another.
  const [stepText, setStepText] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-seed when a DIFFERENT card is opened, not on every render of the same
  // one: keying on the id means a background refresh cannot wipe what is
  // half-typed in the notes box.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setStepText({});
    setComment("");
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(
    () => parseChecklist(task?.checklist ?? []),
    [task?.checklist]
  );
  const progress = checklistProgress(groups);
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

        <div className="grid gap-3 sm:grid-cols-3">
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
          <span className={label}>On this task</span>
          {/* Everyone at once rather than a dropdown you reopen per person:
              assigning two people is the common case this exists for, and a
              select would make the second name cost as much as the first. */}
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => {
              const on = task.assignees.includes(p.userId);
              return (
                <button
                  key={p.userId}
                  disabled={busy}
                  onClick={() =>
                    onAssignees(
                      on
                        ? task.assignees.filter((id) => id !== p.userId)
                        : [...task.assignees, p.userId]
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-pill border py-1 pl-1 pr-2.5 text-[12px] font-semibold transition ${
                    on
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border text-text-muted hover:border-border-strong hover:text-text"
                  }`}
                  title={p.scope === "project" ? "On this project only" : "Studio member"}
                >
                  <span
                    className="grid h-[20px] w-[20px] place-items-center rounded-pill text-[9.5px] font-bold"
                    style={{
                      backgroundColor: on ? "var(--surface)" : "var(--surface-2)",
                      color: on ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {personInitials(p.label)}
                  </span>
                  <span className="max-w-[150px] truncate">
                    {p.isSelf ? "You" : p.label}
                  </span>
                </button>
              );
            })}
            {/* The invite lives HERE, not only in the topbar, because "there is
                nobody else to put on this" is realised while looking at this
                list. There is a button for it on every page, and nobody hunting
                for a way to add a colleague looks in the utility tray. */}
            {canInvite && (
              <button
                onClick={openInvite}
                className="inline-flex items-center gap-1.5 rounded-pill border border-dashed border-border px-2.5 py-1 text-[12px] font-semibold text-text-muted transition hover:border-accent hover:text-accent"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M19 8v6M22 11h-6" />
                </svg>
                Invite someone
              </button>
            )}
          </div>
          {task.assignees.length === 0 && (
            <p className="mt-1.5 text-[11.5px] text-text-faint">
              Nobody on it yet.
              {people.length <= 1 && canInvite
                ? " Invite a teammate or crew member to put a name on it."
                : ""}
            </p>
          )}
          {pendingInvites.length > 0 && (
            <p className="mt-1.5 text-[11.5px] text-text-faint">
              Waiting to accept:{" "}
              <span className="font-medium">{pendingInvites.join(", ")}</span>.
              They can be put on a task once they are in.
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="text-[11px] font-semibold text-text-muted">
              Checklists {groups.length > 0 ? groups.length : ""}
            </span>
            {progress.total > 0 && (
              <span className="text-[11px] font-bold text-text-faint">
                {progress.done}/{progress.total} done
              </span>
            )}
          </div>
          {progress.total > 0 && (
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-pill bg-surface-2">
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

          <div className="space-y-3">
            {groups.map((g) => {
              const gp = g.items.filter((i) => i.done).length;
              return (
                <div key={g.id} className="rounded-[10px] border border-border p-2.5">
                  <div className="group/g mb-1.5 flex items-center gap-2">
                    {/* The name is edited in place: a list called "Write the
                        script" is only useful if renaming it costs nothing. */}
                    <input
                      defaultValue={g.name}
                      disabled={busy}
                      onBlur={(e) => {
                        const n = e.target.value.trim();
                        if (!n || n === g.name) {
                          e.target.value = g.name;
                          return;
                        }
                        onChecklist(
                          groups.map((x) => (x.id === g.id ? { ...x, name: n } : x))
                        );
                      }}
                      className="min-w-0 flex-1 rounded-[7px] border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] font-bold text-text outline-none transition hover:border-border focus:border-accent"
                      aria-label="Checklist name"
                    />
                    <span className="shrink-0 text-[10.5px] font-semibold text-text-faint">
                      {gp}/{g.items.length}
                    </span>
                    <button
                      onClick={() =>
                        onChecklist(groups.filter((x) => x.id !== g.id))
                      }
                      disabled={busy}
                      aria-label={`Remove ${g.name}`}
                      className="shrink-0 text-text-faint opacity-0 transition hover:text-red group-hover/g:opacity-100"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {g.items.length > 0 && (
                    <ul className="mb-1.5 space-y-0.5">
                      {g.items.map((it) => (
                        <li key={it.id} className="group/step flex items-center gap-2">
                          <button
                            onClick={() =>
                              onChecklist(
                                groups.map((x) =>
                                  x.id === g.id
                                    ? {
                                        ...x,
                                        items: x.items.map((y) =>
                                          y.id === it.id
                                            ? { ...y, done: !y.done }
                                            : y
                                        ),
                                      }
                                    : x
                                )
                              )
                            }
                            disabled={busy}
                            className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border transition"
                            style={{
                              borderColor: it.done
                                ? "var(--h-green)"
                                : "var(--border-strong)",
                              backgroundColor: it.done
                                ? "var(--h-green)"
                                : "transparent",
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
                              it.done
                                ? "text-text-faint line-through"
                                : "text-text-muted"
                            }`}
                          >
                            {it.text}
                          </span>
                          <button
                            onClick={() =>
                              onChecklist(
                                groups.map((x) =>
                                  x.id === g.id
                                    ? {
                                        ...x,
                                        items: x.items.filter((y) => y.id !== it.id),
                                      }
                                    : x
                                )
                              )
                            }
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
                    value={stepText[g.id] ?? ""}
                    onChange={(e) =>
                      setStepText((prev) => ({ ...prev, [g.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const t = (stepText[g.id] ?? "").trim();
                      if (!t) return;
                      setStepText((prev) => ({ ...prev, [g.id]: "" }));
                      onChecklist(
                        groups.map((x) =>
                          x.id === g.id
                            ? {
                                ...x,
                                items: [
                                  ...x.items,
                                  { id: newId(), text: t, done: false },
                                ],
                              }
                            : x
                        )
                      );
                    }}
                    placeholder="Add a step, then Enter"
                    className="py-1 text-[12.5px]"
                  />
                </div>
              );
            })}
          </div>

          <button
            onClick={() =>
              onChecklist([
                ...groups,
                {
                  id: newId(),
                  name: groups.length === 0 ? DEFAULT_CHECKLIST_NAME : "New checklist",
                  items: [],
                },
              ])
            }
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-[9px] border border-dashed border-border px-2.5 py-1.5 text-[12px] font-semibold text-text-muted transition hover:border-accent hover:text-accent"
          >
            + Add a checklist
          </button>
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

        <div>
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="text-[11px] font-semibold text-text-muted">
              Files
            </span>
            <span className="text-[11px] text-text-faint">
              References for whoever picks this up. Up to{" "}
              {formatBytes(MAX_UPLOAD_BYTES)} each.
            </span>
          </div>
          {task.files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {task.files.map((f) => (
                <div
                  key={f.id}
                  className="group/file relative w-[104px] overflow-hidden rounded-[9px] border border-border bg-surface-2"
                >
                  {f.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.thumbUrl}
                      alt={f.name}
                      loading="lazy"
                      className="h-[72px] w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-[72px] w-full place-items-center text-text-faint">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    </div>
                  )}
                  <div className="px-1.5 py-1">
                    {f.url ? (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-[10.5px] font-semibold text-text hover:text-accent"
                        title={f.name}
                      >
                        {f.name}
                      </a>
                    ) : (
                      <span className="block truncate text-[10.5px] font-semibold text-text-faint">
                        {f.name}
                      </span>
                    )}
                    {f.sizeBytes != null && (
                      <span className="block text-[9.5px] text-text-faint">
                        {formatBytes(f.sizeBytes)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveFile(f.id)}
                    disabled={busy}
                    aria-label={`Remove ${f.name}`}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-pill bg-surface/90 text-text-faint opacity-0 transition hover:text-red group-hover/file:opacity-100"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              // Copy the FileList BEFORE clearing the input: it is a live view
              // of the selection, and resetting value empties it. The email
              // composer shipped this bug once already.
              const picked = e.target.files ? Array.from(e.target.files) : [];
              if (fileRef.current) fileRef.current.value = "";
              for (const file of picked) {
                if (file.size > MAX_UPLOAD_BYTES) continue;
                const fd = new FormData();
                fd.append("file", file);
                onAddFile(fd);
              }
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-dashed border-border px-2.5 py-1.5 text-[12px] font-semibold text-text-muted transition hover:border-accent hover:text-accent"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 1 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49" />
            </svg>
            Attach a file
          </button>
        </div>

        <div>
          <span className={label}>
            Notes to the team {task.comments.length > 0 ? `(${task.comments.length})` : ""}
          </span>
          {task.comments.length > 0 && (
            <ul className="mb-2 space-y-2">
              {task.comments.map((c) => (
                <li key={c.id} className="group/c rounded-[9px] bg-surface-2 p-2.5">
                  <div className="mb-0.5 flex items-baseline gap-2">
                    <span className="text-[11.5px] font-bold text-text">
                      {c.author}
                    </span>
                    <span className="text-[10.5px] text-text-faint">
                      {shortDate(c.createdAt)}
                    </span>
                    {/* Only your own. Admins are deliberately not special-cased,
                        the same rule review comments follow. */}
                    {c.mine && (
                      <button
                        onClick={() => onDeleteComment(c.id)}
                        disabled={busy}
                        className="ml-auto text-[10.5px] font-semibold text-text-faint opacity-0 transition hover:text-red group-hover/c:opacity-100"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[12.5px] text-text-muted">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Textarea
            value={comment}
            disabled={busy}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              // Enter posts, Shift+Enter breaks the line: a note here is
              // usually one sentence.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const t = comment.trim();
                if (!t) return;
                setComment("");
                onComment(t);
              }
            }}
            placeholder="Leave a note. Enter to post, Shift+Enter for a new line."
            className="min-h-[56px] text-[13px]"
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-[11px] text-text-faint">
            Added {longDate(task.created_at)}
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
