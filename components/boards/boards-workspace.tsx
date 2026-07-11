"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { BoardCanvas } from "@/components/boards/board-canvas";
import { BoardAssetPicker } from "@/components/boards/board-asset-picker";
import { BoardFigmaModal } from "@/components/boards/board-figma-modal";
import { DrivePickerModal, type PickedDriveFile } from "@/components/projects/drive-browser";
import {
  createBoard,
  renameBoard,
  deleteBoard,
  setBoardProject,
  setBoardBackground,
  getBoardItems,
  getBoardConnections,
  addUploadItems,
  addNote,
  addTodoItem,
  addColumn,
  addLine,
  addLinkItem,
  addDriveItems,
  updateItemText,
  updateItemHue,
  deleteItem,
  type BoardItemView,
  type BoardConnection,
} from "@/app/(app)/boards/actions";
import {
  parseLineData,
  LINE_COLORS,
  LINE_WEIGHTS,
  type LineData,
} from "@/lib/board-line";
import {
  parseNoteStyle,
  serializeNoteStyle,
  NOTE_COLORS,
} from "@/lib/board-note-style";
import { parseTodo, serializeTodo, type TodoRow } from "@/lib/board-todo";
import { SendToReviewButton } from "@/components/projects/send-to-review-button";
import type { Board } from "@/lib/database.types";

type ProjectRef = { id: string; title: string };

export function BoardsWorkspace({
  initialBoards,
  projects,
  driveConnected,
  figmaConnected,
  scope = { kind: "general" },
  noun = "board",
  reviewKind,
  reviewedIds = [],
}: {
  initialBoards: Board[];
  projects: ProjectRef[];
  driveConnected: boolean;
  figmaConnected: boolean;
  // What new boards belong to: a project-scoped kind, or the global scratch.
  scope?: { kind?: string; projectId?: string };
  noun?: string;
  // When set (with a project scope), the active board can be sent to review as
  // this doc kind (e.g. "moodboard").
  reviewKind?: "moodboard" | "storyboard";
  // Board ids already in the review cycle.
  reviewedIds?: string[];
}) {
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [activeId, setActiveId] = useState<string | null>(
    initialBoards[0]?.id ?? null
  );
  const [items, setItems] = useState<BoardItemView[]>([]);
  const [connections, setConnections] = useState<BoardConnection[]>([]);
  const [loading, startLoad] = useTransition();
  const [busy, startBusy] = useTransition();

  const [assetOpen, setAssetOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Board | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [driveSel, setDriveSel] = useState<PickedDriveFile[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // First-use hint: a small anchored note the first time each card type is used.
  const [hint, setHint] = useState<{ kind: string; itemId: string } | null>(null);
  const seenHintsRef = useRef<Set<string> | null>(null);
  if (seenHintsRef.current === null) {
    let seen = new Set<string>();
    try {
      if (typeof window !== "undefined")
        seen = new Set(JSON.parse(localStorage.getItem("board.hints.v1") || "[]"));
    } catch {}
    seenHintsRef.current = seen;
  }
  function maybeHint(kind: string, itemId: string) {
    if (seenHintsRef.current?.has(kind)) return;
    setHint({ kind, itemId });
  }
  function dismissHint() {
    if (hint) {
      seenHintsRef.current?.add(hint.kind);
      try {
        localStorage.setItem(
          "board.hints.v1",
          JSON.stringify([...(seenHintsRef.current ?? [])])
        );
      } catch {}
    }
    setHint(null);
  }

  const active = boards.find((b) => b.id === activeId) ?? null;

  const reload = useCallback((id: string) => {
    startLoad(async () => {
      const [res, conns] = await Promise.all([
        getBoardItems(id),
        getBoardConnections(id),
      ]);
      if (!("error" in res)) setItems(res.items);
      if (!("error" in conns)) setConnections(conns.connections);
    });
  }, []);

  useEffect(() => {
    setSelectedLineId(null);
    setSelectedId(null);
    if (activeId) reload(activeId);
    else {
      setItems([]);
      setConnections([]);
    }
  }, [activeId, reload]);

  function newBoard() {
    startBusy(async () => {
      const res = await createBoard(undefined, scope.projectId, scope.kind);
      if ("board" in res) {
        setBoards((prev) => [...prev, res.board]);
        setActiveId(res.board.id);
      }
    });
  }

  function onUpload(files: FileList | null) {
    if (!files || !activeId) return;
    const fd = new FormData();
    fd.set("boardId", activeId);
    fd.set("x", "60");
    fd.set("y", "60");
    for (const f of Array.from(files)) fd.append("files", f);
    if (fileRef.current) fileRef.current.value = "";
    startBusy(async () => {
      await addUploadItems(fd);
      reload(activeId);
    });
  }

  function addNoteToBoard() {
    if (!activeId) return;
    startBusy(async () => {
      const res = await addNote(activeId, 80, 80);
      reload(activeId);
      if ("id" in res) maybeHint("note", res.id);
    });
  }

  function addTodoToBoard() {
    if (!activeId) return;
    startBusy(async () => {
      const res = await addTodoItem(activeId, 80, 80);
      reload(activeId);
      if ("id" in res) maybeHint("todo", res.id);
    });
  }

  function addColumnToBoard() {
    if (!activeId) return;
    startBusy(async () => {
      const res = await addColumn(activeId, 80, 80);
      reload(activeId);
      if ("id" in res) maybeHint("column", res.id);
    });
  }

  function addLineToBoard() {
    if (!activeId) return;
    startBusy(async () => {
      const res = await addLine(activeId, 140, 160, 340, 220);
      reload(activeId);
      if ("id" in res) {
        setSelectedLineId(res.id);
        maybeHint("line", res.id);
      }
    });
  }

  // Dropped a rail tool onto the canvas: create it at the drop point.
  function onDropTool(kind: string, x: number, y: number) {
    if (!activeId) return;
    startBusy(async () => {
      if (kind === "note") {
        const res = await addNote(activeId, x, y);
        reload(activeId);
        if ("id" in res) maybeHint("note", res.id);
      } else if (kind === "todo") {
        const res = await addTodoItem(activeId, x, y);
        reload(activeId);
        if ("id" in res) maybeHint("todo", res.id);
      } else if (kind === "column") {
        const res = await addColumn(activeId, x, y);
        reload(activeId);
        if ("id" in res) maybeHint("column", res.id);
      } else if (kind === "line") {
        const res = await addLine(activeId, x, y, x + 200, y + 60);
        reload(activeId);
        if ("id" in res) {
          setSelectedLineId(res.id);
          maybeHint("line", res.id);
        }
      }
    });
  }

  const selectedLine = selectedLineId
    ? items.find((i) => i.id === selectedLineId && i.kind === "line") ?? null
    : null;

  function updateLineStyle(patch: Partial<LineData>) {
    if (!selectedLine) return;
    const text = JSON.stringify({ ...parseLineData(selectedLine.text), ...patch });
    setItems((prev) =>
      prev.map((p) => (p.id === selectedLine.id ? { ...p, text } : p))
    );
    void updateItemText(selectedLine.id, text);
  }

  function deleteLine() {
    const id = selectedLineId;
    if (!id) return;
    setItems((prev) => prev.filter((p) => p.id !== id));
    setSelectedLineId(null);
    void deleteItem(id);
  }

  // The selected card (for its contextual panel), and its edit handlers.
  const selectedItem = selectedId
    ? items.find((i) => i.id === selectedId) ?? null
    : null;
  const selectedNote = selectedItem?.kind === "note" ? selectedItem : null;
  const selectedTodo = selectedItem?.kind === "todo" ? selectedItem : null;
  const selectedColumn = selectedItem?.kind === "column" ? selectedItem : null;

  function setCardHue(hue: string) {
    if (!selectedItem) return;
    setItems((prev) =>
      prev.map((p) => (p.id === selectedItem.id ? { ...p, hue } : p))
    );
    void updateItemHue(selectedItem.id, hue);
  }
  // Rewrite the selected to-do's rows (optimistic + persisted).
  function mutateSelectedTodo(fn: (rows: TodoRow[]) => TodoRow[]) {
    if (!selectedTodo) return;
    const text = serializeTodo(fn(parseTodo(selectedTodo.text)));
    setItems((prev) =>
      prev.map((p) => (p.id === selectedTodo.id ? { ...p, text } : p))
    );
    void updateItemText(selectedTodo.id, text);
  }
  function deleteSelectedCard() {
    const id = selectedId;
    if (!id) return;
    // A column deletes its children too (DB cascades on parent_id).
    setItems((prev) => prev.filter((p) => p.id !== id && p.parentId !== id));
    setSelectedId(null);
    void deleteItem(id).then(() => activeId && reload(activeId));
  }

  // Delete/Backspace removes the selected line (not while typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selectedLineId) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      e.preventDefault();
      deleteLine();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLineId]);

  function onDropFiles(files: FileList, x: number, y: number) {
    if (!activeId) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    const fd = new FormData();
    fd.set("boardId", activeId);
    fd.set("x", String(x));
    fd.set("y", String(y));
    for (const f of imgs) fd.append("files", f);
    startBusy(async () => {
      await addUploadItems(fd);
      reload(activeId);
    });
  }

  function chooseBackground(bg: string) {
    if (!active) return;
    setBoards((prev) =>
      prev.map((b) => (b.id === active.id ? { ...b, background: bg } : b))
    );
    void setBoardBackground(active.id, bg);
  }

  function startRename(b: Board) {
    setEditingId(b.id);
    setEditName(b.name);
  }
  function commitRename(b: Board) {
    const name = editName.trim() || b.name;
    setBoards((prev) => prev.map((x) => (x.id === b.id ? { ...x, name } : x)));
    setEditingId(null);
    void renameBoard(b.id, name);
  }

  function doDelete(b: Board) {
    startBusy(async () => {
      await deleteBoard(b.id);
      const rest = boards.filter((x) => x.id !== b.id);
      setBoards(rest);
      if (activeId === b.id) setActiveId(rest[0]?.id ?? null);
      setDeleteConfirm(null);
    });
  }

  function toggleDrive(f: PickedDriveFile) {
    setDriveSel((prev) =>
      prev.some((x) => x.id === f.id)
        ? prev.filter((x) => x.id !== f.id)
        : [...prev, f]
    );
  }
  function commitDrive() {
    setDriveOpen(false);
    if (!activeId || driveSel.length === 0) {
      setDriveSel([]);
      return;
    }
    const chosen = driveSel;
    setDriveSel([]);
    startBusy(async () => {
      await addDriveItems(activeId, chosen);
      reload(activeId);
    });
  }

  const toolBtn =
    "inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-50";

  return (
    <div className="flex h-[calc(100vh-8rem)] min-w-0 flex-col overflow-hidden">
      {/* Tabs */}
      <div className="mb-3 flex items-center gap-1 overflow-x-auto border-b border-border pb-2">
        {boards.map((b) => {
          const isActive = b.id === activeId;
          return (
            <div
              key={b.id}
              className={`flex shrink-0 items-center rounded-[10px] py-1.5 pl-3 text-sm font-semibold transition ${
                isActive
                  ? "bg-accent-soft text-accent pr-1.5"
                  : "pr-3 text-text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {editingId === b.id ? (
                <input
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(b)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(b);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-28 rounded-[6px] border border-border bg-surface px-1.5 py-0.5 text-sm font-semibold text-text outline-none focus:border-border-strong"
                />
              ) : (
                <button
                  onClick={() => setActiveId(b.id)}
                  onDoubleClick={() => startRename(b)}
                  title="Double-click to rename"
                >
                  {b.name}
                </button>
              )}
              {isActive && editingId !== b.id && (
                <button
                  onClick={() => setDeleteConfirm(b)}
                  className="ml-1.5 grid h-5 w-5 place-items-center rounded-[6px] text-accent/70 transition hover:bg-red-bg hover:text-red"
                  aria-label="Delete board"
                  title="Delete board"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={newBoard}
          disabled={busy}
          className="shrink-0 rounded-[10px] px-3 py-1.5 text-sm font-semibold text-text-faint transition hover:bg-surface-2 hover:text-text"
        >
          + New {noun}
        </button>
      </div>

      {!active ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="mb-3 text-sm text-text-muted">
              No {noun}s yet. Create one to start collecting visuals.
            </p>
            <Button onClick={newBoard} disabled={busy}>
              Create your first {noun}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <div className="ml-auto flex items-center gap-2">
              {loading && <span className="text-xs text-text-faint">loading...</span>}
              <div className="inline-flex items-center gap-0.5 rounded-[9px] border border-border bg-surface p-0.5">
                {(["dots", "grid", "plain"] as const).map((bg) => (
                  <button
                    key={bg}
                    onClick={() => chooseBackground(bg)}
                    className={`rounded-[7px] px-2 py-1 text-xs font-semibold capitalize transition ${
                      (active.background ?? "dots") === bg
                        ? "bg-accent-soft text-accent"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
              {reviewKind && scope.projectId && (
                <SendToReviewButton
                  projectId={scope.projectId}
                  kind={reviewKind}
                  targetId={active.id}
                  inReview={reviewedIds.includes(active.id)}
                />
              )}
              <button className={toolBtn} onClick={() => setSettingsOpen(true)}>
                Board settings
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onUpload(e.target.files)}
            />
          </div>

          {/* Left tool rail (Milanote-style) + canvas. When a line is selected,
              a style panel slides over the rail. */}
          <div className="flex min-h-0 min-w-0 flex-1 gap-3">
            {selectedNote ? (
              <NotePanel
                key={selectedNote.id}
                note={selectedNote}
                onHue={setCardHue}
                onDelete={deleteSelectedCard}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedTodo ? (
              <TodoPanel
                key={selectedTodo.id}
                todo={selectedTodo}
                onHue={setCardHue}
                onMutate={mutateSelectedTodo}
                onDelete={deleteSelectedCard}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedColumn ? (
              <ColumnPanel
                key={selectedColumn.id}
                column={selectedColumn}
                onHue={setCardHue}
                onDelete={deleteSelectedCard}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedLine ? (
              <LineStylePanel
                key={selectedLine.id}
                line={selectedLine}
                onChange={updateLineStyle}
                onDelete={deleteLine}
                onClose={() => setSelectedLineId(null)}
              />
            ) : (
              <div className="flex w-[52px] shrink-0 flex-col items-center gap-1 self-start rounded-[14px] border border-border bg-surface py-2">
                <RailBtn label="Note" disabled={busy} dragKind="note" onClick={addNoteToBoard}>
                  <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h5" />
                </RailBtn>
                <RailBtn label="To-do list" disabled={busy} dragKind="todo" onClick={addTodoToBoard}>
                  <path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
                </RailBtn>
                <RailBtn label="Column" disabled={busy} dragKind="column" onClick={addColumnToBoard}>
                  <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 9v11" />
                </RailBtn>
                <RailBtn label="Line / arrow" disabled={busy} dragKind="line" onClick={addLineToBoard}>
                  <path d="M5 19 19 5" /><path d="M11 5h8v8" />
                </RailBtn>
                <RailBtn label="Link" onClick={() => setLinkOpen(true)}>
                  <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
                </RailBtn>
                <RailBtn label="Upload image" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                </RailBtn>

                <div className="my-1 h-px w-6 bg-border" />

                <RailBtn label="Project assets" onClick={() => setAssetOpen(true)}>
                  <path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                </RailBtn>
                {driveConnected && (
                  <RailBtn label="Google Drive" onClick={() => setDriveOpen(true)}>
                    <path d="M8 3h8l5 9H13zM3 21l4-7h11l-4 7zM8 3 3 14" />
                  </RailBtn>
                )}
                {figmaConnected && (
                  <RailBtn label="Figma" onClick={() => setFigmaOpen(true)}>
                    <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" />
                  </RailBtn>
                )}
              </div>
            )}

            <div className="min-h-0 min-w-0 flex-1">
              <BoardCanvas
                boardId={active.id}
                items={items}
                setItems={setItems}
                connections={connections}
                background={active.background ?? "dots"}
                onDropFiles={onDropFiles}
                onDropTool={onDropTool}
                onReload={() => reload(active.id)}
                selected={selectedId}
                onSelect={setSelectedId}
                selectedLineId={selectedLineId}
                onSelectLine={setSelectedLineId}
                hint={hint}
                onDismissHint={dismissHint}
              />
            </div>
          </div>
        </>
      )}

      {active && (
        <>
          <BoardAssetPicker
            boardId={active.id}
            open={assetOpen}
            onClose={() => setAssetOpen(false)}
            onAdded={() => {
              setAssetOpen(false);
              reload(active.id);
            }}
          />
          <BoardFigmaModal
            boardId={active.id}
            open={figmaOpen}
            onClose={() => setFigmaOpen(false)}
            onAdded={() => {
              setFigmaOpen(false);
              reload(active.id);
            }}
          />
          <DrivePickerModal
            open={driveOpen}
            onClose={commitDrive}
            mode="select"
            selectedIds={new Set(driveSel.map((f) => f.id))}
            onToggle={toggleDrive}
          />
          <LinkModal
            boardId={active.id}
            open={linkOpen}
            onClose={() => setLinkOpen(false)}
            onAdded={(id) => {
              reload(active.id);
              if (id) maybeHint("link", id);
            }}
          />
          <BoardSettings
            board={active}
            projects={projects}
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            onSaved={(next) =>
              setBoards((prev) => prev.map((b) => (b.id === next.id ? next : b)))
            }
            onDeleted={() => {
              setSettingsOpen(false);
              setBoards((prev) => {
                const rest = prev.filter((b) => b.id !== active.id);
                setActiveId(rest[0]?.id ?? null);
                return rest;
              });
            }}
          />
        </>
      )}

      <Modal
        open={Boolean(deleteConfirm)}
        onClose={() => setDeleteConfirm(null)}
        title="Delete board?"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Delete{" "}
            <span className="font-semibold text-text">
              {deleteConfirm?.name}
            </span>
            ? This removes the board and everything on it. This can&apos;t be
            undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && doDelete(deleteConfirm)}
              disabled={busy}
            >
              {busy ? "Deleting..." : "Delete board"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function NotePanel({
  note,
  onHue,
  onDelete,
  onClose,
}: {
  note: BoardItemView;
  onHue: (hue: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"text" | "box">("text");
  // The note's color key for the "match note" first text-color swatch. Falls
  // back to a token hue (never a raw hex or "none", which aren't valid --h vars).
  const noteHueKey = (() => {
    const c = parseNoteStyle(note.hue).color;
    return c && !c.startsWith("#") ? c : "yellow";
  })();

  // Apply formatting to the note's contentEditable (kept focused via preventDefault).
  function exec(cmd: string, val?: string) {
    const el = document.querySelector(
      `[data-item-id="${note.id}"] [contenteditable="true"]`
    ) as HTMLElement | null;
    el?.focus();
    document.execCommand(cmd, false, val);
  }
  // Resolve a CSS var to a concrete color (theme-aware at apply time) so
  // execCommand color commands get a real value.
  function resolveColor(cssVar: string): string {
    const probe = document.createElement("span");
    probe.style.color = cssVar;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color || cssVar;
    probe.remove();
    return resolved;
  }
  function focusNote() {
    const el = document.querySelector(
      `[data-item-id="${note.id}"] [contenteditable="true"]`
    ) as HTMLElement | null;
    el?.focus();
  }
  function applyTextColor(cssVar: string) {
    const resolved = resolveColor(cssVar);
    focusNote();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, resolved);
  }
  function applyHighlight(cssVar: string | null) {
    focusNote();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("hiliteColor", false, cssVar ? resolveColor(cssVar) : "transparent");
  }
  const textColors = [
    `var(--h-${noteHueKey})`,
    "var(--text)",
    "var(--h-red)",
    "var(--h-amber)",
    "var(--h-green)",
    "var(--h-blue)",
    "var(--h-purple)",
    "var(--h-pink)",
  ];
  const highlights = [
    "var(--h-yellow-bg)",
    "var(--h-blue-bg)",
    "var(--h-green-bg)",
    "var(--h-amber-bg)",
    "var(--h-pink-bg)",
    "var(--h-purple-bg)",
  ];
  // Milanote-style block presets (execCommand formatBlock; PRE = code, BLOCKQUOTE
  // = quote). Small text uses an inline size.
  const styles: { label: string; run: () => void }[] = [
    { label: "Large heading", run: () => exec("formatBlock", "H1") },
    { label: "Heading", run: () => exec("formatBlock", "H2") },
    { label: "Normal text", run: () => exec("formatBlock", "P") },
    { label: "Small text", run: () => exec("fontSize", "2") },
    { label: "Code block", run: () => exec("formatBlock", "PRE") },
    { label: "Quote block", run: () => exec("formatBlock", "BLOCKQUOTE") },
  ];
  const hold = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };
  const fmt =
    "grid h-8 flex-1 place-items-center rounded-[8px] border border-border text-[13px] font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text";
  const tabBtn = (active: boolean) =>
    `flex-1 rounded-[7px] px-2 py-1 text-xs font-bold transition ${
      active ? "bg-surface text-text shadow-sm" : "text-text-muted"
    }`;

  return (
    <div className="flex w-[184px] shrink-0 flex-col gap-3 self-start rounded-[14px] border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-text-faint">Note</span>
        <button onClick={onClose} className="text-text-faint hover:text-text" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex gap-0.5 rounded-[9px] bg-surface-2 p-0.5">
        <button className={tabBtn(tab === "text")} onClick={() => setTab("text")}>Text</button>
        <button className={tabBtn(tab === "box")} onClick={() => setTab("box")}>Box</button>
      </div>

      {tab === "text" ? (
        <>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">
              Text style
            </p>
            <div className="flex flex-col gap-1">
              {styles.map((s) => (
                <button
                  key={s.label}
                  title={s.label}
                  onMouseDown={hold(s.run)}
                  className="rounded-[8px] border border-border px-2 py-1.5 text-left text-[12px] font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button className={fmt} style={{ fontWeight: 800 }} title="Bold" onMouseDown={hold(() => exec("bold"))}>B</button>
            <button className={`${fmt} italic`} title="Italic" onMouseDown={hold(() => exec("italic"))}>I</button>
            <button className={`${fmt} underline`} title="Underline" onMouseDown={hold(() => exec("underline"))}>U</button>
            <button className={`${fmt} line-through`} title="Strikethrough" onMouseDown={hold(() => exec("strikeThrough"))}>S</button>
          </div>
          <div className="flex gap-1.5">
            <button className={fmt} title="Bulleted list" onMouseDown={hold(() => exec("insertUnorderedList"))}>• List</button>
            <button className={fmt} title="Numbered list" onMouseDown={hold(() => exec("insertOrderedList"))}>1. List</button>
          </div>
          <button
            className={`${fmt} w-full`}
            title="Add link"
            onMouseDown={hold(() => {
              const url = window.prompt("Link URL (https://…)");
              if (url) exec("createLink", /^https?:\/\//i.test(url) ? url : `https://${url}`);
            })}
          >
            🔗 Link
          </button>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">
              Text color
            </p>
            <div className="flex flex-wrap gap-1.5">
              {textColors.map((cv, i) => (
                <button
                  key={i}
                  title={i === 0 ? "Default" : "Text color"}
                  onMouseDown={hold(() => applyTextColor(cv))}
                  className="h-6 w-6 rounded-full ring-1 ring-black/10 transition hover:scale-110"
                  style={{ backgroundColor: cv }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">
              Highlight
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {highlights.map((cv, i) => (
                <button
                  key={i}
                  title="Highlight"
                  onMouseDown={hold(() => applyHighlight(cv))}
                  className="h-6 w-6 rounded-full ring-1 ring-black/10 transition hover:scale-110"
                  style={{ backgroundColor: cv }}
                />
              ))}
              <button
                title="No highlight"
                onMouseDown={hold(() => applyHighlight(null))}
                className="grid h-6 w-6 place-items-center rounded-full ring-1 ring-black/10 transition hover:scale-110"
                style={{ backgroundColor: "var(--surface)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-text-faint"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <button className={`${fmt} w-full`} title="Clear formatting" onMouseDown={hold(() => exec("removeFormat"))}>
            Clear formatting
          </button>
        </>
      ) : (
        <BoxOptions rawHue={note.hue} onHue={onHue} />
      )}

      <button
        onClick={onDelete}
        className="mt-0.5 flex items-center justify-center gap-1.5 rounded-[9px] border border-border px-2 py-1.5 text-xs font-semibold text-red transition hover:bg-red-bg"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
        </svg>
        Delete note
      </button>
    </div>
  );
}

function TodoPanel({
  todo,
  onHue,
  onMutate,
  onDelete,
  onClose,
}: {
  todo: BoardItemView;
  onHue: (hue: string) => void;
  onMutate: (fn: (rows: TodoRow[]) => TodoRow[]) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const rows = parseTodo(todo.text);
  const total = rows.length;
  const done = rows.filter((r) => r.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;
  const hue = todo.hue ?? "blue";

  const row =
    "flex w-full items-center gap-2 rounded-[9px] border border-border px-2 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex w-[184px] shrink-0 flex-col gap-3 self-start rounded-[14px] border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-text-faint">To-do</span>
        <button onClick={onClose} className="text-text-faint hover:text-text" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Progress */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-text-muted">
          <span>Progress</span>
          <span>{done}/{total}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: `var(--h-${hue})` }}
          />
        </div>
      </div>

      {/* Row actions */}
      <div className="flex flex-col gap-1.5">
        <button
          className={row}
          onClick={() => onMutate((rs) => [...rs, { id: crypto.randomUUID(), text: "", done: false }])}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add item
        </button>
        <button
          className={row}
          disabled={total === 0}
          onClick={() => onMutate((rs) => rs.map((r) => ({ ...r, done: !allDone })))}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>
          {allDone ? "Uncheck all" : "Check all"}
        </button>
        <button
          className={row}
          disabled={done === 0}
          onClick={() => onMutate((rs) => rs.filter((r) => !r.done))}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></svg>
          Clear completed
        </button>
      </div>

      {/* Header color */}
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">Header color</p>
        <div className="flex flex-wrap gap-1.5">
          {NOTE_COLORS.map((h) => (
            <button
              key={h}
              onClick={() => onHue(h)}
              aria-label={h}
              className="grid h-7 w-7 place-items-center rounded-[8px] ring-1 ring-black/10 transition hover:scale-105"
              style={{
                backgroundColor: `var(--h-${h}-bg)`,
                boxShadow: hue === h ? "0 0 0 2px var(--accent)" : undefined,
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `var(--h-${h})` }} />
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onDelete}
        className="mt-0.5 flex items-center justify-center gap-1.5 rounded-[9px] border border-border px-2 py-1.5 text-xs font-semibold text-red transition hover:bg-red-bg"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
        </svg>
        Delete checklist
      </button>
    </div>
  );
}

// Milanote-style "box" appearance options (Background / Top strip / color /
// none / custom), shared by the Note and Column panels. Reads/writes the item's
// hue string via lib/board-note-style.
function BoxOptions({
  rawHue,
  onHue,
}: {
  rawHue: string | null;
  onHue: (hue: string) => void;
}) {
  const ns = parseNoteStyle(rawHue);
  const styled = !!rawHue;
  const mode = styled ? ns.mode : "fill";
  const isCustom = !!ns.color && ns.color.startsWith("#");
  // Apply a color while preserving the current strip/fill mode.
  const pickColor = (color: string) =>
    onHue(serializeNoteStyle({ mode: mode === "strip" ? "strip" : "fill", color }));
  const seg = (active: boolean) =>
    `flex-1 rounded-[7px] px-2 py-1 text-xs font-bold transition ${
      active ? "bg-surface text-text shadow-sm" : "text-text-muted"
    }`;
  return (
    <div className="flex flex-col gap-3">
      {/* Background vs Top strip */}
      <div className="flex gap-0.5 rounded-[9px] bg-surface-2 p-0.5">
        <button
          className={seg(mode !== "strip")}
          onClick={() => onHue(serializeNoteStyle({ mode: "fill", color: ns.color ?? "yellow" }))}
        >
          Background
        </button>
        <button
          className={seg(mode === "strip")}
          onClick={() => onHue(serializeNoteStyle({ mode: "strip", color: ns.color ?? "yellow" }))}
        >
          Top strip
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {/* None / transparent */}
        <button
          onClick={() => onHue("none")}
          aria-label="No color"
          title="No color"
          className="grid h-7 w-7 place-items-center rounded-[8px] ring-1 ring-black/10 transition hover:scale-105"
          style={{
            backgroundImage:
              "linear-gradient(45deg,var(--surface-2) 25%,transparent 25%,transparent 75%,var(--surface-2) 75%),linear-gradient(45deg,var(--surface-2) 25%,var(--surface) 25%,var(--surface) 75%,var(--surface-2) 75%)",
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0,4px 4px",
            boxShadow: styled && ns.mode === "none" ? "0 0 0 2px var(--accent)" : undefined,
          }}
        />
        {NOTE_COLORS.map((h) => {
          const active = styled && ns.mode !== "none" && ns.color === h;
          return (
            <button
              key={h}
              onClick={() => pickColor(h)}
              aria-label={h}
              className="grid h-7 w-7 place-items-center rounded-[8px] ring-1 ring-black/10 transition hover:scale-105"
              style={{
                backgroundColor: `var(--h-${h}-bg)`,
                boxShadow: active ? "0 0 0 2px var(--accent)" : undefined,
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `var(--h-${h})` }} />
            </button>
          );
        })}
      </div>

      {/* Custom color */}
      <label
        className={`flex cursor-pointer items-center gap-2 rounded-[9px] border px-2 py-1.5 text-xs font-semibold transition hover:bg-surface-2 ${
          isCustom ? "border-accent text-accent" : "border-border text-text-muted"
        }`}
      >
        <span
          className="h-4 w-4 rounded-full ring-1 ring-black/10"
          style={{
            background: isCustom
              ? (ns.color as string)
              : "conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)",
          }}
        />
        Custom color
        <input
          type="color"
          className="sr-only"
          defaultValue={isCustom ? (ns.color as string) : "#5b8def"}
          onChange={(e) => pickColor(e.target.value)}
        />
      </label>
    </div>
  );
}

function ColumnPanel({
  column,
  onHue,
  onDelete,
  onClose,
}: {
  column: BoardItemView;
  onHue: (hue: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex w-[184px] shrink-0 flex-col gap-3 self-start rounded-[14px] border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-text-faint">Column</span>
        <button onClick={onClose} className="text-text-faint hover:text-text" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <BoxOptions rawHue={column.hue} onHue={onHue} />

      <button
        onClick={onDelete}
        className="mt-0.5 flex items-center justify-center gap-1.5 rounded-[9px] border border-border px-2 py-1.5 text-xs font-semibold text-red transition hover:bg-red-bg"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
        </svg>
        Delete column
      </button>
    </div>
  );
}

function LineStylePanel({
  line,
  onChange,
  onDelete,
  onClose,
}: {
  line: BoardItemView;
  onChange: (patch: Partial<LineData>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const d = parseLineData(line.text);
  const label =
    "mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint";
  const chip = (active: boolean) =>
    `flex-1 rounded-[8px] border px-2 py-1.5 text-xs font-semibold transition ${
      active
        ? "border-accent bg-accent-soft text-accent"
        : "border-border text-text-muted hover:text-text"
    }`;

  return (
    <div className="flex w-[176px] shrink-0 flex-col gap-3 self-start rounded-[14px] border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-text-faint">
          Line
        </span>
        <button onClick={onClose} className="text-text-faint hover:text-text" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div>
        <p className={label}>Color</p>
        <div className="flex flex-wrap gap-1.5">
          {LINE_COLORS.map((c) => (
            <button
              key={c.key}
              onClick={() => onChange({ color: c.key })}
              aria-label={c.key}
              className="h-5 w-5 rounded-full ring-1 ring-black/10 transition hover:scale-110"
              style={{
                backgroundColor: c.var,
                boxShadow: d.color === c.key ? "0 0 0 2px var(--accent)" : undefined,
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className={label}>Arrowheads</p>
        <div className="flex gap-1.5">
          <button className={chip(d.startArrow)} onClick={() => onChange({ startArrow: !d.startArrow })}>
            Start
          </button>
          <button className={chip(d.endArrow)} onClick={() => onChange({ endArrow: !d.endArrow })}>
            End
          </button>
        </div>
      </div>

      <div>
        <p className={label}>Style</p>
        <button className={`w-full ${chip(d.dashed)}`} onClick={() => onChange({ dashed: !d.dashed })}>
          {d.dashed ? "Dashed" : "Solid"}
        </button>
      </div>

      <div>
        <p className={label}>Weight</p>
        <div className="flex gap-1.5">
          {LINE_WEIGHTS.map((w) => (
            <button
              key={w}
              onClick={() => onChange({ weight: w })}
              className="flex h-8 flex-1 items-center justify-center rounded-[8px] border transition"
              style={{ borderColor: d.weight === w ? "var(--accent)" : "var(--border)" }}
            >
              <span style={{ height: w, width: 20, background: "var(--text-muted)", borderRadius: 3 }} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={label}>Label</p>
        <input
          defaultValue={d.label}
          onBlur={(e) => onChange({ label: e.target.value })}
          placeholder="Optional"
          className="w-full rounded-[8px] border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-border-strong"
        />
      </div>

      {(d.bendX !== 0 || d.bendY !== 0) && (
        <button
          onClick={() => onChange({ bendX: 0, bendY: 0 })}
          className="text-[11px] font-semibold text-accent hover:underline"
        >
          Straighten
        </button>
      )}

      <button
        onClick={onDelete}
        className="mt-0.5 flex items-center justify-center gap-1.5 rounded-[9px] border border-border px-2 py-1.5 text-xs font-semibold text-red transition hover:bg-red-bg"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
        </svg>
        Delete line
      </button>
    </div>
  );
}

function RailBtn({
  label,
  onClick,
  disabled,
  dragKind,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  // When set, the tool can also be dragged onto the board to place it at the
  // drop point (in addition to click-to-add).
  dragKind?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      draggable={Boolean(dragKind)}
      onDragStart={
        dragKind
          ? (e) => {
              e.dataTransfer.setData("application/x-board-tool", dragKind);
              e.dataTransfer.effectAllowed = "copy";
            }
          : undefined
      }
      className={`group relative grid h-10 w-10 place-items-center rounded-[10px] text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40 ${
        dragKind ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
      <span className="pointer-events-none absolute left-full z-40 ml-2 hidden whitespace-nowrap rounded-[7px] bg-text px-2 py-1 text-[11px] font-semibold text-bg shadow-md group-hover:block">
        {label}
      </span>
    </button>
  );
}

function LinkModal({
  boardId,
  open,
  onClose,
  onAdded,
}: {
  boardId: string;
  open: boolean;
  onClose: () => void;
  onAdded: (id: string | null) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl("");
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    const u = url.trim();
    if (!u) return;
    setBusy(true);
    setErr(null);
    const res = await addLinkItem(boardId, u, 80, 80);
    setBusy(false);
    if ("error" in res) {
      setErr(res.error);
      return;
    }
    onAdded("id" in res ? res.id : null);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a link">
      <div className="space-y-3">
        <p className="text-sm text-text-muted">
          Paste any URL. We&apos;ll pull a preview (title and image) and drop a link
          card on the board.
        </p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          autoFocus
          placeholder="https://…"
          className="w-full rounded-[11px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
        />
        {err && (
          <p className="rounded-[9px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !url.trim()}>
            {busy ? "Fetching preview…" : "Add link"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BoardSettings({
  board,
  projects,
  open,
  onClose,
  onSaved,
  onDeleted,
}: {
  board: Board;
  projects: ProjectRef[];
  open: boolean;
  onClose: () => void;
  onSaved: (b: Board) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(board.name);
  const [projectId, setProjectId] = useState(board.project_id ?? "");
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (open) {
      setName(board.name);
      setProjectId(board.project_id ?? "");
      setConfirm(false);
    }
  }, [open, board]);

  function save() {
    start(async () => {
      await renameBoard(board.id, name);
      await setBoardProject(board.id, projectId || null);
      onSaved({ ...board, name: name.trim() || "Untitled board", project_id: projectId || null });
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Board settings">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-text-faint">
            Name
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
        </div>
        {projects.length > 0 && (
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-text-faint">
              Linked project (optional)
            </label>
            <Select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1.5"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-4">
          {confirm ? (
            <button
              onClick={() => start(async () => { await deleteBoard(board.id); onDeleted(); })}
              className="text-xs font-semibold text-red hover:underline"
            >
              Confirm delete
            </button>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              className="text-xs font-semibold text-red hover:underline"
            >
              Delete board
            </button>
          )}
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
