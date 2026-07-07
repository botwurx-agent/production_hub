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
  addUploadItems,
  addNote,
  addDriveItems,
  type BoardItemView,
} from "@/app/(app)/boards/actions";
import type { Board } from "@/lib/database.types";

type ProjectRef = { id: string; title: string };

export function BoardsWorkspace({
  initialBoards,
  projects,
  driveConnected,
  figmaConnected,
  scope = { kind: "general" },
  noun = "board",
}: {
  initialBoards: Board[];
  projects: ProjectRef[];
  driveConnected: boolean;
  figmaConnected: boolean;
  // What new boards belong to: a project-scoped kind, or the global scratch.
  scope?: { kind?: string; projectId?: string };
  noun?: string;
}) {
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [activeId, setActiveId] = useState<string | null>(
    initialBoards[0]?.id ?? null
  );
  const [items, setItems] = useState<BoardItemView[]>([]);
  const [loading, startLoad] = useTransition();
  const [busy, startBusy] = useTransition();

  const [assetOpen, setAssetOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Board | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [driveSel, setDriveSel] = useState<PickedDriveFile[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = boards.find((b) => b.id === activeId) ?? null;

  const reload = useCallback((id: string) => {
    startLoad(async () => {
      const res = await getBoardItems(id);
      if (!("error" in res)) setItems(res.items);
    });
  }, []);

  useEffect(() => {
    if (activeId) reload(activeId);
    else setItems([]);
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
      await addNote(activeId, 80, 80);
      reload(activeId);
    });
  }

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
    <div className="flex h-[calc(100vh-8rem)] flex-col">
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
            <button className={toolBtn} onClick={() => fileRef.current?.click()} disabled={busy}>
              Upload
            </button>
            <button className={toolBtn} onClick={() => setAssetOpen(true)}>
              Project assets
            </button>
            {driveConnected && (
              <button className={toolBtn} onClick={() => setDriveOpen(true)}>
                Drive
              </button>
            )}
            {figmaConnected && (
              <button className={toolBtn} onClick={() => setFigmaOpen(true)}>
                Figma
              </button>
            )}
            <button className={toolBtn} onClick={addNoteToBoard} disabled={busy}>
              + Note
            </button>
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

          {/* Canvas */}
          <div className="min-h-0 flex-1">
            <BoardCanvas
              boardId={active.id}
              items={items}
              setItems={setItems}
              background={active.background ?? "dots"}
              onDropFiles={onDropFiles}
            />
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
