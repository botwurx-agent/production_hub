"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/card";
import { BoardsIcon } from "@/components/app-shell/nav-icons";
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
  registerUploadedBoardItems,
  addNote,
  addTodoItem,
  addColumn,
  addLine,
  addColorItem,
  addHeadingItem,
  addShapeItem,
  addVideoItem,
  addLinkItem,
  addDriveItems,
  updateItemText,
  updateItemHue,
  updateItemName,
  deleteItem,
  duplicateItem,
  getBoardShare,
  createBoardShare,
  revokeBoardShare,
  restoreBoardState,
  type BoardItemView,
  type BoardConnection,
} from "@/app/(app)/boards/actions";
import { useBoardHistory } from "@/lib/use-board-history";
import { toast } from "@/components/ui/toast";
import {
  parseLineData,
  LINE_COLORS,
  LINE_WEIGHTS,
  type LineData,
} from "@/lib/board-line";
import {
  parseNoteStyle,
  serializeNoteStyle,
  noteColorVars,
  NOTE_COLORS,
} from "@/lib/board-note-style";
import {
  parseHeadingStyle,
  serializeHeadingStyle,
  type HeadingStyle,
} from "@/lib/board-heading";
import {
  SHAPES,
  shapePaths,
  shapeFill,
  parseShapeData,
  serializeShapeData,
} from "@/lib/board-shape";
import { parseTodo, serializeTodo, type TodoRow } from "@/lib/board-todo";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

const MAX_UPLOAD_MB = 40;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "image";
}
import { videoEmbed } from "@/lib/video-embed";
import { parseMediaMeta, serializeMediaMeta } from "@/lib/board-media";
import type { Board } from "@/lib/database.types";

type ProjectRef = { id: string; title: string };

export function BoardsWorkspace({
  studioId,
  initialBoards,
  projects,
  driveConnected,
  figmaConnected,
  scope = { kind: "general" },
  noun = "board",
  reviewKind,
  reviewedIds = [],
}: {
  studioId: string;
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
  const history = useBoardHistory();

  const [assetOpen, setAssetOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [shapesOpen, setShapesOpen] = useState(false);
  // Flashes the picker's "drag a shape" heading when a tile is clicked.
  const [shapeNudge, setShapeNudge] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }
  const [deleteConfirm, setDeleteConfirm] = useState<Board | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [driveSel, setDriveSel] = useState<PickedDriveFile[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // Set by BoardCanvas; returns canvas coords at the center of the visible
  // viewport so new items land where the user is looking (not off-screen).
  const placeRef = useRef<(() => { x: number; y: number }) | null>(null);
  function spot() {
    return placeRef.current?.() ?? { x: 80, y: 80 };
  }

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

  // Every reload re-signs storage URLs server-side, and a fresh token makes the
  // browser treat each image as a brand-new resource: after every small
  // mutation (add a note, tick a to-do) the whole board's images refetched and
  // flashed. Reuse the URL a path already has while it is comfortably inside
  // the 1h signature TTL; take the fresh one only when the cached one is old.
  const URL_REUSE_MS = 45 * 60 * 1000;
  const urlCache = useRef(
    new Map<string, { signedUrl: string | null; thumbUrl: string | null; at: number }>()
  );
  const withStableUrls = useCallback((list: BoardItemView[]) => {
    const now = Date.now();
    if (urlCache.current.size > 800) urlCache.current.clear();
    return list.map((it) => {
      if (!it.storagePath) return it;
      const c = urlCache.current.get(it.storagePath);
      if (c && now - c.at < URL_REUSE_MS) {
        return { ...it, signedUrl: c.signedUrl, thumbUrl: c.thumbUrl };
      }
      urlCache.current.set(it.storagePath, {
        signedUrl: it.signedUrl,
        thumbUrl: it.thumbUrl,
        at: now,
      });
      return it;
    });
  }, [URL_REUSE_MS]);

  const reload = useCallback(
    (id: string) => {
      startLoad(async () => {
        const [res, conns] = await Promise.all([
          getBoardItems(id),
          getBoardConnections(id),
        ]);
        if (!("error" in res)) setItems(withStableUrls(res.items));
        if (!("error" in conns)) setConnections(conns.connections);
      });
    },
    [withStableUrls]
  );

  // Record the pre-edit board state so it can be undone. Called at the top of
  // every mutation entry point in this component; the canvas captures its own
  // gesture-level snapshots via onBeforeChange.
  const pushHistory = () => history.capture({ items, connections });

  // Apply a history snapshot (undo or redo) to local state, then persist the
  // whole board and reload to refresh signed URLs.
  function doUndo() {
    if (!activeId) return;
    const snap = history.undo({ items, connections });
    if (!snap) return;
    setItems(snap.items);
    setConnections(snap.connections);
    startBusy(async () => {
      const res = await restoreBoardState(activeId, snap.items, snap.connections);
      if (res?.error) showNotice(res.error);
      else reload(activeId);
    });
    toast("Undone");
  }
  function doRedo() {
    if (!activeId) return;
    const snap = history.redo({ items, connections });
    if (!snap) return;
    setItems(snap.items);
    setConnections(snap.connections);
    startBusy(async () => {
      const res = await restoreBoardState(activeId, snap.items, snap.connections);
      if (res?.error) showNotice(res.error);
      else reload(activeId);
    });
    toast("Redone");
  }

  useEffect(() => {
    setSelectedLineId(null);
    setSelectedId(null);
    // Undo history is per-board; clear it so undo never crosses boards.
    history.reset();
    if (activeId) reload(activeId);
    else {
      setItems([]);
      setConnections([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, reload]);

  // Copy / paste / duplicate for board objects.
  //
  // The buffer holds the source item's ID, not a copy of its values: the server
  // action reads the stored row and copies it there, so a card the browser
  // never had the right to write cannot be conjured by pasting. Consequence to
  // know: copy, delete the original, then paste reports that the card is gone,
  // which is the honest answer rather than a silent empty card.
  const clipRef = useRef<string | null>(null);

  const pasteCopy = useCallback(
    (sourceId: string) => {
      if (!activeId) return;
      pushHistory();
      startBusy(async () => {
        const res = await duplicateItem(sourceId);
        if ("error" in res) {
          showNotice(res.error);
          return;
        }
        reload(activeId);
        setSelectedId(res.id);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, items, connections, reload]
  );

  // Cmd/Ctrl+C copies the selected card, Cmd/Ctrl+D duplicates it on the spot.
  // Both are ignored while typing so the browser's own copy still works in a
  // note, a title field, or a caption.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "c" && key !== "d") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      // A text selection means the user is copying words, not the card.
      if (key === "c" && (window.getSelection()?.toString() ?? "")) return;
      if (!selectedId) return;
      e.preventDefault();
      if (key === "c") {
        clipRef.current = selectedId;
        toast("Copied");
      } else {
        pasteCopy(selectedId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, pasteCopy]);

  // Paste an image straight onto the board (e.g. copied from an email or the web).
  // Ignored while typing in a field or a card's editor so normal paste still works.
  useEffect(() => {
    if (!activeId) return;
    function onPaste(e: ClipboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      const dt = e.clipboardData;
      if (!dt) return;
      const files: File[] = [];
      for (const item of Array.from(dt.items || [])) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length === 0 && dt.files?.length) {
        for (const f of Array.from(dt.files)) {
          if (f.type.startsWith("image/")) files.push(f);
        }
      }
      if (files.length === 0) {
        // Nothing image-shaped on the system clipboard, so this is a paste of a
        // card copied inside the app. Handled HERE rather than in the keydown
        // above so Cmd+V has exactly one owner and the two cannot both fire.
        if (clipRef.current) {
          e.preventDefault();
          pasteCopy(clipRef.current);
        }
        return;
      }
      e.preventDefault();
      uploadImageFiles(files, spot());
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, pasteCopy]);

  function newBoard() {
    startBusy(async () => {
      const res = await createBoard(undefined, scope.projectId, scope.kind);
      if ("board" in res) {
        setBoards((prev) => [...prev, res.board]);
        setActiveId(res.board.id);
      }
    });
  }

  // Upload image files at a canvas point (shared by the upload button, drag-drop,
  // and clipboard paste).
  function uploadImageFiles(files: File[], at: { x: number; y: number }) {
    if (!activeId || files.length === 0) return;
    const over = files.filter((f) => f.size > MAX_UPLOAD_BYTES);
    const ok = files.filter((f) => f.size <= MAX_UPLOAD_BYTES);
    if (over.length > 0) {
      showNotice(
        over.length === 1
          ? `"${over[0].name || "Image"}" is over the ${MAX_UPLOAD_MB} MB limit and was skipped.`
          : `${over.length} images are over the ${MAX_UPLOAD_MB} MB limit and were skipped.`
      );
    }
    if (ok.length === 0) return;
    const boardId = activeId;
    pushHistory();
    startBusy(async () => {
      // Upload the bytes straight to Storage (bypasses the serverless body cap),
      // then record the board items in one small server call.
      const supabase = createBrowserSupabase();
      const uploaded: { path: string; name: string; mime: string | null }[] = [];
      for (const f of ok) {
        const path = `${studioId}/boards/${boardId}/${crypto.randomUUID()}-${safeFileName(f.name)}`;
        const { error } = await supabase.storage
          .from("assets")
          .upload(path, f, { contentType: f.type || undefined, upsert: false });
        if (error) {
          showNotice(`Couldn't upload "${f.name || "image"}": ${error.message}`);
          continue;
        }
        uploaded.push({ path, name: f.name || "image", mime: f.type || null });
      }
      if (uploaded.length > 0) {
        const res = await registerUploadedBoardItems(boardId, uploaded, at.x, at.y);
        if (res?.error) showNotice(res.error);
        reload(boardId);
      }
    });
  }

  function onUpload(files: FileList | null) {
    if (!files || !activeId) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileRef.current) fileRef.current.value = "";
    uploadImageFiles(imgs, spot());
  }

  function addNoteToBoard() {
    if (!activeId) return;
    const at = spot();
    pushHistory();
    startBusy(async () => {
      const res = await addNote(activeId, at.x, at.y);
      reload(activeId);
      if ("id" in res) maybeHint("note", res.id);
    });
  }

  function addTodoToBoard() {
    if (!activeId) return;
    const at = spot();
    pushHistory();
    startBusy(async () => {
      const res = await addTodoItem(activeId, at.x, at.y);
      reload(activeId);
      if ("id" in res) maybeHint("todo", res.id);
    });
  }

  function addColumnToBoard() {
    if (!activeId) return;
    const at = spot();
    pushHistory();
    startBusy(async () => {
      const res = await addColumn(activeId, at.x, at.y);
      reload(activeId);
      if ("id" in res) maybeHint("column", res.id);
    });
  }

  function addLineToBoard() {
    if (!activeId) return;
    const at = spot();
    pushHistory();
    startBusy(async () => {
      const res = await addLine(activeId, at.x, at.y + 20, at.x + 200, at.y + 80);
      reload(activeId);
      if ("id" in res) {
        setSelectedLineId(res.id);
        maybeHint("line", res.id);
      }
    });
  }

  function addColorToBoard() {
    if (!activeId) return;
    const at = spot();
    pushHistory();
    startBusy(async () => {
      const res = await addColorItem(activeId, at.x, at.y);
      reload(activeId);
      if ("id" in res) {
        setSelectedId(res.id);
        maybeHint("color", res.id);
      }
    });
  }

  function addHeadingToBoard() {
    if (!activeId) return;
    const at = spot();
    pushHistory();
    startBusy(async () => {
      const res = await addHeadingItem(activeId, at.x, at.y);
      reload(activeId);
      if ("id" in res) {
        setSelectedId(res.id);
        maybeHint("heading", res.id);
      }
    });
  }

  function addShapeToBoard(shape: string, at = spot()) {
    if (!activeId) return;
    pushHistory();
    startBusy(async () => {
      const res = await addShapeItem(activeId, shape, at.x, at.y);
      reload(activeId);
      if ("id" in res) {
        setSelectedId(res.id);
        maybeHint("shape", res.id);
      }
    });
  }

  // Dropped a rail tool onto the canvas: create it at the drop point.
  function onDropTool(kind: string, x: number, y: number) {
    if (!activeId) return;
    // Shape tiles carry which shape they are ("shape:star").
    if (kind.startsWith("shape:")) {
      setShapesOpen(false);
      addShapeToBoard(kind.slice("shape:".length), { x, y });
      return;
    }
    pushHistory();
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
      } else if (kind === "color") {
        const res = await addColorItem(activeId, x, y);
        reload(activeId);
        if ("id" in res) {
          setSelectedId(res.id);
          maybeHint("color", res.id);
        }
      } else if (kind === "heading") {
        const res = await addHeadingItem(activeId, x, y);
        reload(activeId);
        if ("id" in res) {
          setSelectedId(res.id);
          maybeHint("heading", res.id);
        }
      }
    });
  }

  const selectedLine = selectedLineId
    ? items.find((i) => i.id === selectedLineId && i.kind === "line") ?? null
    : null;

  function updateLineStyle(patch: Partial<LineData>) {
    if (!selectedLine) return;
    pushHistory();
    const text = JSON.stringify({ ...parseLineData(selectedLine.text), ...patch });
    setItems((prev) =>
      prev.map((p) => (p.id === selectedLine.id ? { ...p, text } : p))
    );
    void updateItemText(selectedLine.id, text);
  }

  function deleteLine() {
    const id = selectedLineId;
    if (!id) return;
    pushHistory();
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
  const selectedLink = selectedItem?.kind === "link" ? selectedItem : null;
  const selectedImage = selectedItem?.kind === "image" ? selectedItem : null;
  const selectedColor = selectedItem?.kind === "color" ? selectedItem : null;
  const selectedShape = selectedItem?.kind === "shape" ? selectedItem : null;
  const selectedHeading = selectedItem?.kind === "heading" ? selectedItem : null;
  const selectedVideo = selectedItem?.kind === "video" ? selectedItem : null;

  function setSelectedName(name: string) {
    if (!selectedItem) return;
    pushHistory();
    setItems((prev) =>
      prev.map((p) => (p.id === selectedItem.id ? { ...p, name } : p))
    );
    void updateItemName(selectedItem.id, name);
  }
  function setSelectedText(text: string) {
    if (!selectedItem) return;
    pushHistory();
    setItems((prev) =>
      prev.map((p) => (p.id === selectedItem.id ? { ...p, text } : p))
    );
    void updateItemText(selectedItem.id, text);
  }

  function setCardHue(hue: string) {
    if (!selectedItem) return;
    pushHistory();
    setItems((prev) =>
      prev.map((p) => (p.id === selectedItem.id ? { ...p, hue } : p))
    );
    void updateItemHue(selectedItem.id, hue);
  }
  // Rewrite the selected to-do's rows (optimistic + persisted).
  function mutateSelectedTodo(fn: (rows: TodoRow[]) => TodoRow[]) {
    if (!selectedTodo) return;
    pushHistory();
    const text = serializeTodo(fn(parseTodo(selectedTodo.text)));
    setItems((prev) =>
      prev.map((p) => (p.id === selectedTodo.id ? { ...p, text } : p))
    );
    void updateItemText(selectedTodo.id, text);
  }
  function deleteSelectedCard() {
    const id = selectedId;
    if (!id) return;
    pushHistory();
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

  // Undo (Cmd/Ctrl+Z) and redo (Cmd/Ctrl+Shift+Z or Ctrl+Y). Ignored while
  // typing in a field or a card's editor so native undo still works there.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        doRedo();
      } else if (key === "z") {
        e.preventDefault();
        doUndo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, items, connections]);

  function onDropFiles(files: FileList, x: number, y: number) {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    uploadImageFiles(imgs, { x, y });
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
    pushHistory();
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
        <div className="flex flex-1 items-center justify-center [&>div]:w-full">
          <EmptyState
            hue="purple"
            icon={<BoardsIcon className="h-7 w-7" />}
            title={`No ${noun}s yet`}
            description={`A ${noun} is a freeform canvas: drop in references, arrange them, connect them, and write on top.`}
            action={
              <Button onClick={newBoard} disabled={busy}>
                Create your first {noun}
              </Button>
            }
            steps={[
              {
                title: "Collect",
                text: "Upload images, paste a link, or pull straight from Drive, Figma, or the project's assets.",
              },
              {
                title: "Arrange",
                text: "Drag, resize, and group into columns. Draw arrows between anything to show the thinking.",
              },
              {
                title: "Share",
                text: "Send it for review and collect pinned comments on the exact frame.",
              },
            ]}
          />
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={doUndo}
                disabled={!history.canUndo}
                title="Undo (Cmd/Ctrl+Z)"
                aria-label="Undo"
                className="grid h-8 w-8 place-items-center rounded-[9px] border border-border bg-surface text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={doRedo}
                disabled={!history.canRedo}
                title="Redo (Cmd/Ctrl+Shift+Z)"
                aria-label="Redo"
                className="grid h-8 w-8 place-items-center rounded-[9px] border border-border bg-surface text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h4" />
                </svg>
              </button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {loading && <span className="text-xs text-text-faint">loading...</span>}
              <button
                className="inline-flex items-center gap-1.5 rounded-[9px] border border-accent bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent transition hover:brightness-95"
                onClick={() => setShareOpen(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
                </svg>
                Share
              </button>
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

          {/* Left tool rail (Milanote-style) + canvas. Selecting a card swaps
              the rail's CONTENTS for that card's tools, in the same 52px
              footprint, so the canvas never shifts and nothing is covered;
              each tool's options open in a flyout beside the rail. */}
          <div className="flex min-h-0 min-w-0 flex-1 gap-3">
            {selectedNote ? (
              <NotePanel
                key={selectedNote.id}
                note={selectedNote}
                onHue={setCardHue}
                onDelete={deleteSelectedCard}
                onDuplicate={() => selectedId && pasteCopy(selectedId)}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedTodo ? (
              <TodoPanel
                key={selectedTodo.id}
                todo={selectedTodo}
                onHue={setCardHue}
                onMutate={mutateSelectedTodo}
                onDelete={deleteSelectedCard}
                onDuplicate={() => selectedId && pasteCopy(selectedId)}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedColumn ? (
              <ColumnPanel
                key={selectedColumn.id}
                column={selectedColumn}
                onHue={setCardHue}
                onDelete={deleteSelectedCard}
                onDuplicate={() => selectedId && pasteCopy(selectedId)}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedLink ? (
              <LinkPanel
                key={selectedLink.id}
                link={selectedLink}
                onTitle={setSelectedName}
                onDelete={deleteSelectedCard}
                onDuplicate={() => selectedId && pasteCopy(selectedId)}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedVideo ? (
              <VideoPanel
                key={selectedVideo.id}
                video={selectedVideo}
                onDelete={deleteSelectedCard}
                onDuplicate={() => selectedId && pasteCopy(selectedId)}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedImage ? (
              <ImagePanel
                key={selectedImage.id}
                image={selectedImage}
                onFit={setSelectedText}
                onDelete={deleteSelectedCard}
                onDuplicate={() => selectedId && pasteCopy(selectedId)}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedColor ? (
              <ColorPanel
                key={selectedColor.id}
                color={selectedColor}
                onHex={setSelectedText}
                onDelete={deleteSelectedCard}
                onDuplicate={() => selectedId && pasteCopy(selectedId)}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedShape ? (
              <ShapePanel
                key={selectedShape.id}
                item={selectedShape}
                onShape={(k) => setSelectedText(serializeShapeData({ shape: k }))}
                onHue={setCardHue}
                onLabel={setSelectedName}
                onDelete={deleteSelectedCard}
                onDuplicate={() => selectedId && pasteCopy(selectedId)}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedHeading ? (
              <HeadingPanel
                key={selectedHeading.id}
                heading={selectedHeading}
                onHue={setCardHue}
                onDelete={deleteSelectedCard}
                onDuplicate={() => selectedId && pasteCopy(selectedId)}
                onClose={() => setSelectedId(null)}
              />
            ) : selectedLine ? (
              <LineStylePanel
                key={selectedLine.id}
                line={selectedLine}
                onChange={updateLineStyle}
                onDelete={deleteLine}
                onDuplicate={() => selectedLineId && pasteCopy(selectedLineId)}
                onClose={() => setSelectedLineId(null)}
              />
            ) : (
              <div className="relative flex w-[52px] shrink-0 flex-col items-center gap-1 self-start rounded-[14px] border border-border bg-surface py-2">
                <RailBtn label="Note" disabled={busy} dragKind="note" dragOnly onClick={addNoteToBoard}>
                  <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h5" />
                </RailBtn>
                <RailBtn label="Heading" disabled={busy} dragKind="heading" dragOnly onClick={addHeadingToBoard}>
                  <path d="M6 4v16M18 4v16M6 12h12" />
                </RailBtn>
                <RailBtn label="To-do list" disabled={busy} dragKind="todo" dragOnly onClick={addTodoToBoard}>
                  <path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
                </RailBtn>
                <RailBtn label="Column" disabled={busy} dragKind="column" dragOnly onClick={addColumnToBoard}>
                  <rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 9v11" />
                </RailBtn>
                <RailBtn label="Shape" disabled={busy} dragKind="shape:rect" onClick={() => setShapesOpen((o) => !o)}>
                  <rect x="3" y="9" width="12" height="12" rx="2" /><circle cx="16.5" cy="8.5" r="5" />
                </RailBtn>
                <RailBtn label="Line / arrow" disabled={busy} dragKind="line" dragOnly onClick={addLineToBoard}>
                  <path d="M5 19 19 5" /><path d="M11 5h8v8" />
                </RailBtn>
                <RailBtn label="Link" onClick={() => setLinkOpen(true)}>
                  <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
                </RailBtn>
                <RailBtn label="Video (paste a link)" onClick={() => setVideoOpen(true)}>
                  <rect x="2" y="4" width="20" height="16" rx="3" /><path d="m10 8 6 4-6 4V8z" />
                </RailBtn>
                <RailBtn label="Upload image" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                </RailBtn>
                <RailBtn label="Color swatch" disabled={busy} dragKind="color" dragOnly onClick={addColorToBoard}>
                  <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="10.5" r="2.5" /><circle cx="8.5" cy="7.5" r="2.5" /><path d="M12 22a10 10 0 1 1 0-20 8 8 0 0 1 0 16h-1.5a1.5 1.5 0 0 0 0 3z" />
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

                {/* Shape picker: drag a tile onto the board to place it, the
                    same rule the creation tools follow. */}
                {shapesOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShapesOpen(false)} />
                    <div className="absolute left-full top-0 z-30 ml-2 w-[248px] rounded-[14px] border border-border bg-surface p-2.5 shadow-lg">
                      <p
                        className={`mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wide transition ${
                          shapeNudge ? "text-accent" : "text-text-faint"
                        }`}
                      >
                        Drag a shape onto the board
                      </p>
                      <div className="grid grid-cols-4 gap-1">
                        {SHAPES.map((s) => (
                          <button
                            key={s.key}
                            title={`Drag "${s.label}" onto the board`}
                            aria-label={s.label}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("application/x-board-tool", `shape:${s.key}`);
                              e.dataTransfer.effectAllowed = "copy";
                              setShapeNudge(false);
                            }}
                            onClick={() => {
                              // Drag-only, like the rail's creation tools: a
                              // click just points at the heading above.
                              setShapeNudge(true);
                              window.setTimeout(() => setShapeNudge(false), 1900);
                            }}
                            className="grid h-12 cursor-grab place-items-center rounded-[9px] transition hover:bg-surface-2 active:cursor-grabbing"
                          >
                            <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden>
                              {shapePaths(s.key, 34, 26).map((p, i) => (
                                <path
                                  key={i}
                                  d={p.d}
                                  fill={p.overlay ? "rgba(255,255,255,0.35)" : "var(--h-blue)"}
                                />
                              ))}
                            </svg>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
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
                placementRef={placeRef}
                onBeforeChange={(before) => history.capture(before)}
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
              // Capture the pre-add state (items not yet reloaded) for undo.
              pushHistory();
              setAssetOpen(false);
              reload(active.id);
            }}
          />
          <BoardFigmaModal
            boardId={active.id}
            open={figmaOpen}
            onClose={() => setFigmaOpen(false)}
            onAdded={() => {
              pushHistory();
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
              pushHistory();
              reload(active.id);
              if (id) maybeHint("link", id);
            }}
          />
          <VideoModal
            boardId={active.id}
            open={videoOpen}
            spot={spot}
            onClose={() => setVideoOpen(false)}
            onAdded={(id) => {
              pushHistory();
              reload(active.id);
              if (id) {
                setSelectedId(id);
                maybeHint("video", id);
              }
            }}
          />
          <ShareBoardModal
            boardId={active.id}
            boardName={active.name}
            open={shareOpen}
            onClose={() => setShareOpen(false)}
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

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-[12px] border border-border bg-surface px-4 py-3 text-sm text-text shadow-lg">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--h-amber)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" />
            </svg>
            <span className="flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} className="shrink-0 text-text-faint hover:text-text" aria-label="Dismiss">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotePanel({
  note,
  onHue,
  onDelete,
  onDuplicate,
  onClose,
}: {
  note: BoardItemView;
  onHue: (hue: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
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
  // The custom text-color picker opens a native dialog, which blurs the note
  // and can drop the selection the color was meant for. Capture the range on
  // mousedown (before the dialog opens) and restore it before applying.
  const savedRange = useRef<Range | null>(null);
  function rememberSelection() {
    const sel = window.getSelection();
    savedRange.current =
      sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
  }
  function applyCustomTextColor(hex: string) {
    focusNote();
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, hex);
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

  return (
    <CardRail label="Note" onClose={onClose}>
      <RailTool id="style" label="Text style" icon={ICON.textStyle}>
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
      </RailTool>

      <RailTool id="format" label="Formatting" icon={ICON.bold}>
        <div className="flex gap-1.5">
          <button className={fmt} style={{ fontWeight: 800 }} title="Bold" onMouseDown={hold(() => exec("bold"))}>B</button>
          <button className={`${fmt} italic`} title="Italic" onMouseDown={hold(() => exec("italic"))}>I</button>
          <button className={`${fmt} underline`} title="Underline" onMouseDown={hold(() => exec("underline"))}>U</button>
          <button className={`${fmt} line-through`} title="Strikethrough" onMouseDown={hold(() => exec("strikeThrough"))}>S</button>
        </div>
        <div className="flex gap-1.5">
          <button className={fmt} title="Bulleted list" onMouseDown={hold(() => exec("insertUnorderedList"))}>List</button>
          <button className={fmt} title="Numbered list" onMouseDown={hold(() => exec("insertOrderedList"))}>1. List</button>
        </div>
        <button
          className={`${fmt} w-full`}
          title="Add link"
          onMouseDown={hold(() => {
            const url = window.prompt("Link URL (https://...)");
            if (url) exec("createLink", /^https?:\/\//i.test(url) ? url : `https://${url}`);
          })}
        >
          Add a link
        </button>
        <button className={`${fmt} w-full`} title="Clear formatting" onMouseDown={hold(() => exec("removeFormat"))}>
          Clear formatting
        </button>
      </RailTool>

      <RailTool id="textcolor" label="Text color" icon={ICON.textColor}>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">Color</p>
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
            <label
              title="Custom color"
              onMouseDown={rememberSelection}
              className="h-6 w-6 cursor-pointer rounded-full ring-1 ring-black/10 transition hover:scale-110"
              style={{ background: "conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)" }}
            >
              <input type="color" className="sr-only" onChange={(e) => applyCustomTextColor(e.target.value)} />
            </label>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">Highlight</p>
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
      </RailTool>

      <RailTool id="box" label="Note color" icon={ICON.palette}>
        <BoxOptions rawHue={note.hue} onHue={onHue} />
      </RailTool>

      <CardTools onDuplicate={onDuplicate} onDelete={onDelete} deleteLabel="Delete note" />
    </CardRail>
  );
}

function TodoPanel({
  todo,
  onHue,
  onMutate,
  onDelete,
  onDuplicate,
  onClose,
}: {
  todo: BoardItemView;
  onHue: (hue: string) => void;
  onMutate: (fn: (rows: TodoRow[]) => TodoRow[]) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const rows = parseTodo(todo.text);
  const total = rows.length;
  const done = rows.filter((r) => r.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;
  const hue = todo.hue ?? "blue";
  const hueIsCustom = hue.startsWith("#");

  const row =
    "flex w-full items-center gap-2 rounded-[9px] border border-border px-2 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-40";

  return (
    <CardRail label="To-do" onClose={onClose}>
      <RailTool id="items" label="Items" icon={ICON.checklist}>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-text-muted">
            <span>Progress</span>
            <span>{done}/{total}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: noteColorVars(hue).accent }}
            />
          </div>
        </div>
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
      </RailTool>

      <RailTool id="color" label="Header color" icon={ICON.palette}>
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
        <CustomColorButton active={hueIsCustom} value={hue} onPick={onHue} />
      </RailTool>

      <CardTools onDuplicate={onDuplicate} onDelete={onDelete} deleteLabel="Delete checklist" />
    </CardRail>
  );
}

// The Duplicate row every card panel carries. Keyboard users get Cmd/Ctrl+D,
// but a canvas feature that exists only as a shortcut is a feature most people
// never find, so it is also a button.
function DuplicateButton({ onDuplicate }: { onDuplicate: () => void }) {
  return (
    <button
      onClick={onDuplicate}
      title="Duplicate (Cmd/Ctrl+D)"
      className="flex items-center justify-center gap-1.5 rounded-[9px] border border-border px-2 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      Duplicate
    </button>
  );
}

// "Custom color" row: a native color input behind a labelled swatch. Shared by
// every panel that offers a palette, so any of them can go off-palette.
function CustomColorButton({
  active,
  value,
  onPick,
}: {
  // Whether the current color IS a custom hex (highlights the row + seeds the input).
  active: boolean;
  value: string | null;
  onPick: (hex: string) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-[9px] border px-2 py-1.5 text-xs font-semibold transition hover:bg-surface-2 ${
        active ? "border-accent text-accent" : "border-border text-text-muted"
      }`}
    >
      <span
        className="h-4 w-4 rounded-full ring-1 ring-black/10"
        style={{
          background:
            active && value
              ? value
              : "conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)",
        }}
      />
      Custom color
      <input
        type="color"
        className="sr-only"
        defaultValue={active && value && value.length === 7 ? value : "#5b8def"}
        onChange={(e) => onPick(e.target.value)}
      />
    </label>
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

      <CustomColorButton active={isCustom} value={ns.color} onPick={pickColor} />
    </div>
  );
}

function ColumnPanel({
  column,
  onHue,
  onDelete,
  onDuplicate,
  onClose,
}: {
  column: BoardItemView;
  onHue: (hue: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  return (
    <CardRail label="Column" onClose={onClose}>
      <RailTool id="color" label="Column color" icon={ICON.palette}>
        <BoxOptions rawHue={column.hue} onHue={onHue} />
      </RailTool>
      <CardTools onDuplicate={onDuplicate} onDelete={onDelete} deleteLabel="Delete column" />
    </CardRail>
  );
}

function LinkPanel({
  link,
  onTitle,
  onDelete,
  onDuplicate,
  onClose,
}: {
  link: BoardItemView;
  onTitle: (name: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  return (
    <CardRail label="Link" onClose={onClose}>
      {link.url && (
        <RailTool
          label="Open link"
          icon={ICON.open}
          onClick={() => window.open(link.url as string, "_blank", "noopener,noreferrer")}
        />
      )}
      <RailTool id="title" label="Title" icon={ICON.textStyle}>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">Title</p>
          <input
            defaultValue={link.name ?? ""}
            onBlur={(e) => onTitle(e.target.value)}
            placeholder="Link title"
            className="w-full rounded-[8px] border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-border-strong"
          />
        </div>
        {link.url && (
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">Destination</p>
            <p className="break-all rounded-[8px] bg-surface-2 px-2 py-1.5 text-[11px] text-text-muted">{link.url}</p>
          </div>
        )}
      </RailTool>
      <CardTools onDuplicate={onDuplicate} onDelete={onDelete} deleteLabel="Delete link" />
    </CardRail>
  );
}

function ImagePanel({
  image,
  onFit,
  onDelete,
  onDuplicate,
  onClose,
}: {
  image: BoardItemView;
  onFit: (fit: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const isImg =
    !!image.signedUrl &&
    (image.mimeType?.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(image.name ?? ""));
  const isVid =
    !!image.signedUrl &&
    (image.mimeType?.startsWith("video/") ||
      /\.(mp4|webm|mov|m4v|ogv)$/i.test(image.name ?? ""));
  const label = isImg ? "Image" : isVid ? "Video" : "File";
  const meta = parseMediaMeta(image.text);
  const chip = (active: boolean) =>
    `flex-1 rounded-[8px] border px-2 py-1.5 text-xs font-semibold transition ${
      active ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted hover:text-text"
    }`;
  return (
    <CardRail label={label} onClose={onClose}>
      {(isImg || isVid) && (
        <RailTool id="fit" label="Fit" icon={ICON.fit}>
          <div className="flex gap-1.5">
            <button className={chip(meta.fit === "cover")} onClick={() => onFit(serializeMediaMeta({ ...meta, fit: "cover" }))} title="Crop to fill the frame">Fill</button>
            <button className={chip(meta.fit === "contain")} onClick={() => onFit(serializeMediaMeta({ ...meta, fit: "contain" }))} title="Show the whole image">Fit</button>
          </div>
        </RailTool>
      )}
      <RailTool id="caption" label="Caption" icon={ICON.caption}>
        <CaptionTools itemId={image.id} />
      </RailTool>
      {image.signedUrl && (
        <RailTool
          label="Open full size"
          icon={ICON.open}
          onClick={() => window.open(image.signedUrl as string, "_blank", "noopener,noreferrer")}
        />
      )}
      <CardTools onDuplicate={onDuplicate} onDelete={onDelete} deleteLabel="Delete" />
    </CardRail>
  );
}

// Rich-text tools for an image / video card's caption. Applies formatting to the
// caption contentEditable inside the selected card (found by its data-item-id).
function CaptionTools({ itemId }: { itemId: string }) {
  function exec(cmd: string, val?: string) {
    const el = document.querySelector(
      `[data-item-id="${itemId}"] [contenteditable="true"]`
    ) as HTMLElement | null;
    el?.focus();
    document.execCommand(cmd, false, val);
  }
  const hold = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };
  const fmt =
    "grid h-8 flex-1 place-items-center rounded-[8px] border border-border text-[13px] font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text";
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">Caption</p>
      <div className="flex gap-1.5">
        <button className={fmt} style={{ fontWeight: 800 }} title="Bold" onMouseDown={hold(() => exec("bold"))}>B</button>
        <button className={`${fmt} italic`} title="Italic" onMouseDown={hold(() => exec("italic"))}>I</button>
        <button className={`${fmt} underline`} title="Underline" onMouseDown={hold(() => exec("underline"))}>U</button>
        <button className={`${fmt} line-through`} title="Strikethrough" onMouseDown={hold(() => exec("strikeThrough"))}>S</button>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <button className={fmt} title="Align left" onMouseDown={hold(() => exec("justifyLeft"))}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h10M4 18h13" /></svg>
        </button>
        <button className={fmt} title="Align center" onMouseDown={hold(() => exec("justifyCenter"))}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M6 18h12" /></svg>
        </button>
        <button
          className={fmt}
          title="Add link"
          onMouseDown={hold(() => {
            const url = window.prompt("Link URL (https://…)");
            if (url) exec("createLink", /^https?:\/\//i.test(url) ? url : `https://${url}`);
          })}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" /></svg>
        </button>
      </div>
    </div>
  );
}

function VideoPanel({
  video,
  onDelete,
  onDuplicate,
  onClose,
}: {
  video: BoardItemView;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const emb = videoEmbed(video.url);
  return (
    <CardRail label="Video" onClose={onClose}>
      <RailTool id="caption" label="Caption" icon={ICON.caption}>
        <CaptionTools itemId={video.id} />
      </RailTool>
      {video.url && (
        <RailTool
          label="Open original"
          icon={ICON.open}
          onClick={() => window.open(video.url as string, "_blank", "noopener,noreferrer")}
        />
      )}
      {video.url && (
        <RailTool id="link" label="Link" icon={ICON.link}>
          {emb && (
            <p className="rounded-[8px] bg-surface-2 px-2 py-1.5 text-[11px] font-semibold text-text-muted">
              {emb.title}
            </p>
          )}
          <p className="break-all rounded-[8px] bg-surface-2 px-2 py-1.5 text-[11px] text-text-muted">{video.url}</p>
        </RailTool>
      )}
      <CardTools onDuplicate={onDuplicate} onDelete={onDelete} deleteLabel="Delete video" />
    </CardRail>
  );
}

function ColorPanel({
  color,
  onHex,
  onDelete,
  onDuplicate,
  onClose,
}: {
  color: BoardItemView;
  onHex: (hex: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const hex = /^#?[0-9a-fA-F]{3,8}$/.test((color.text ?? "").trim())
    ? (color.text ?? "").trim().startsWith("#")
      ? (color.text as string).trim()
      : `#${(color.text as string).trim()}`
    : "#6366F1";
  const swatches = [
    "#111827", "#6B7280", "#EF4444", "#F97316", "#F59E0B",
    "#10B981", "#06B6D4", "#3B82F6", "#6366F1", "#EC4899",
  ];
  return (
    <CardRail label="Color" onClose={onClose}>
      <RailTool id="color" label="Color" icon={ICON.palette}>
        <div className="h-14 w-full rounded-[9px] ring-1 ring-black/10" style={{ backgroundColor: hex }} />
        <div className="flex flex-wrap gap-1.5">
          {swatches.map((s) => (
            <button
              key={s}
              onClick={() => onHex(s)}
              aria-label={s}
              className="h-7 w-7 rounded-[8px] ring-1 ring-black/10 transition hover:scale-105"
              style={{
                backgroundColor: s,
                boxShadow: hex.toUpperCase() === s.toUpperCase() ? "0 0 0 2px var(--accent)" : undefined,
              }}
            />
          ))}
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">Hex</p>
          <div className="flex items-center gap-1.5">
            <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-[8px] ring-1 ring-black/10" style={{ backgroundColor: hex }}>
              <input type="color" value={hex.length === 7 ? hex : "#6366F1"} onChange={(e) => onHex(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <input
              key={hex}
              defaultValue={hex}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (/^#?[0-9a-fA-F]{3,8}$/.test(v)) onHex(v.startsWith("#") ? v : `#${v}`);
              }}
              className="min-w-0 flex-1 rounded-[8px] border border-border bg-surface px-2 py-1.5 text-xs uppercase text-text outline-none focus:border-border-strong"
            />
          </div>
        </div>
      </RailTool>
      <CardTools onDuplicate={onDuplicate} onDelete={onDelete} deleteLabel="Delete swatch" />
    </CardRail>
  );
}

function ShapePanel({
  item,
  onShape,
  onHue,
  onLabel,
  onDelete,
  onDuplicate,
  onClose,
}: {
  item: BoardItemView;
  onShape: (key: string) => void;
  onHue: (hue: string) => void;
  onLabel: (label: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const current = parseShapeData(item.text).shape;
  const hue = item.hue ?? "blue";
  const isCustom = hue.startsWith("#");
  return (
    <CardRail label="Shape" onClose={onClose}>
      {/* Swap the shape in place; size, color, label, and connections stay. */}
      <RailTool id="shape" label="Shape" icon={ICON.shape} wide>
        <div className="grid grid-cols-4 gap-1">
          {SHAPES.map((s) => (
            <button
              key={s.key}
              title={s.label}
              aria-label={s.label}
              onClick={() => onShape(s.key)}
              className={`grid h-9 place-items-center rounded-[8px] transition hover:bg-surface-2 ${
                current === s.key ? "bg-accent-soft ring-1 ring-accent" : ""
              }`}
            >
              <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden>
                {shapePaths(s.key, 26, 20).map((p, i) => (
                  <path
                    key={i}
                    d={p.d}
                    fill={
                      p.overlay
                        ? "rgba(255,255,255,0.35)"
                        : current === s.key
                        ? "var(--accent)"
                        : "var(--text-faint)"
                    }
                  />
                ))}
              </svg>
            </button>
          ))}
        </div>
      </RailTool>

      <RailTool id="fill" label="Fill" icon={ICON.palette}>
        <div className="flex flex-wrap gap-1.5">
          {NOTE_COLORS.map((h) => (
            <button
              key={h}
              onClick={() => onHue(h)}
              aria-label={h}
              className="h-6 w-6 rounded-full ring-1 ring-black/10 transition hover:scale-110"
              style={{
                backgroundColor: `var(--h-${h})`,
                boxShadow: hue === h ? "0 0 0 2px var(--accent)" : undefined,
              }}
            />
          ))}
        </div>
        <CustomColorButton active={isCustom} value={hue} onPick={onHue} />
      </RailTool>

      <RailTool id="label" label="Label" icon={ICON.label}>
        <input
          defaultValue={item.name ?? ""}
          onBlur={(e) => onLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Text on the shape"
          className="w-full rounded-[8px] border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-border-strong"
        />
      </RailTool>

      <CardTools onDuplicate={onDuplicate} onDelete={onDelete} deleteLabel="Delete shape" />
    </CardRail>
  );
}

function HeadingPanel({
  heading,
  onHue,
  onDelete,
  onDuplicate,
  onClose,
}: {
  heading: BoardItemView;
  onHue: (hue: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  // A heading's whole look lives in its hue string (lib/board-heading), so
  // every control below is a patch-and-reserialize through onHue.
  const style = parseHeadingStyle(heading.hue);
  const patch = (p: Partial<HeadingStyle>) =>
    onHue(serializeHeadingStyle({ ...style, ...p }));
  const seg = (active: boolean) =>
    `flex-1 rounded-[7px] px-1 py-1 text-xs font-bold transition ${
      active ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
    }`;
  const fmt = (active: boolean) =>
    `grid h-8 flex-1 place-items-center rounded-[8px] border text-[13px] font-semibold transition ${
      active
        ? "border-accent bg-accent-soft text-accent"
        : "border-border text-text-muted hover:bg-surface-2 hover:text-text"
    }`;

  return (
    <CardRail label="Heading" onClose={onClose}>
      <RailTool id="text" label="Size and style" icon={ICON.size}>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">Size</p>
          <div className="flex gap-0.5 rounded-[9px] bg-surface-2 p-0.5">
            <button className={seg(style.size === "sm")} onClick={() => patch({ size: "sm" })} title="Small">
              <span className="text-[11px]">S</span>
            </button>
            <button className={seg(style.size === "md")} onClick={() => patch({ size: "md" })} title="Medium">
              <span className="text-[13px]">M</span>
            </button>
            <button className={seg(style.size === "lg")} onClick={() => patch({ size: "lg" })} title="Large">
              <span className="text-[15px]">L</span>
            </button>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            className={`${fmt(style.italic)} italic`}
            title="Italic"
            onClick={() => patch({ italic: !style.italic })}
          >
            I
          </button>
          <button
            className={`${fmt(style.underline)} underline`}
            title="Underline"
            onClick={() => patch({ underline: !style.underline })}
          >
            U
          </button>
        </div>
      </RailTool>

      <RailTool id="align" label="Align" icon={ICON.align}>
        <div className="flex gap-1.5">
          <button className={fmt(style.align === "left")} title="Align left" onClick={() => patch({ align: "left" })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h10M4 18h13" /></svg>
          </button>
          <button className={fmt(style.align === "center")} title="Align center" onClick={() => patch({ align: "center" })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M6 18h12" /></svg>
          </button>
          <button className={fmt(style.align === "right")} title="Align right" onClick={() => patch({ align: "right" })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M10 12h10M7 18h13" /></svg>
          </button>
        </div>
      </RailTool>

      <RailTool id="color" label="Text color" icon={ICON.palette}>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => patch({ color: null })}
            aria-label="Default"
            title="Default"
            className="grid h-7 w-7 place-items-center rounded-[8px] ring-1 ring-black/10 transition hover:scale-105"
            style={{
              backgroundColor: "var(--surface-2)",
              boxShadow: !style.color ? "0 0 0 2px var(--accent)" : undefined,
            }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--text)" }} />
          </button>
          {NOTE_COLORS.map((h) => (
            <button
              key={h}
              onClick={() => patch({ color: h })}
              aria-label={h}
              className="grid h-7 w-7 place-items-center rounded-[8px] ring-1 ring-black/10 transition hover:scale-105"
              style={{
                backgroundColor: `var(--h-${h}-bg)`,
                boxShadow: style.color === h ? "0 0 0 2px var(--accent)" : undefined,
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `var(--h-${h})` }} />
            </button>
          ))}
        </div>
        <CustomColorButton
          active={Boolean(style.color?.startsWith("#"))}
          value={style.color}
          onPick={(hex) => patch({ color: hex })}
        />
      </RailTool>

      <CardTools onDuplicate={onDuplicate} onDelete={onDelete} deleteLabel="Delete heading" />
    </CardRail>
  );
}

function LineStylePanel({
  line,
  onChange,
  onDelete,
  onDuplicate,
  onClose,
}: {
  line: BoardItemView;
  onChange: (patch: Partial<LineData>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
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
    <CardRail label="Line" onClose={onClose}>
      <RailTool id="color" label="Color" icon={ICON.palette}>
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
        <CustomColorButton
          active={d.color.startsWith("#")}
          value={d.color}
          onPick={(hex) => onChange({ color: hex })}
        />
      </RailTool>

      <RailTool id="style" label="Style" icon={ICON.line}>
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
          <p className={label}>Line</p>
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
      </RailTool>

      <RailTool id="label" label="Label" icon={ICON.label}>
        <input
          defaultValue={d.label}
          onBlur={(e) => onChange({ label: e.target.value })}
          placeholder="Optional"
          className="w-full rounded-[8px] border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-border-strong"
        />
        {(d.bendX !== 0 || d.bendY !== 0) && (
          <button
            onClick={() => onChange({ bendX: 0, bendY: 0 })}
            className="text-[11px] font-semibold text-accent hover:underline"
          >
            Straighten
          </button>
        )}
      </RailTool>

      <CardTools onDuplicate={onDuplicate} onDelete={onDelete} deleteLabel="Delete line" />
    </CardRail>
  );
}

/* -------------------------------------------------------------------------
   The contextual card rail.

   Selecting a card swaps what the RAIL holds, in the same 52px footprint,
   rather than opening a wider panel beside it. Two earlier layouts were both
   wrong in ways worth remembering: a wider in-flow panel pushed the whole
   canvas sideways on every select (cards appeared to jump), and floating that
   same panel over the canvas covered the work you were trying to edit. Milanote
   gets this right: the rail keeps its footprint, its contents change, and each
   tool's options open in a small flyout beside it, on demand.
   ------------------------------------------------------------------------- */

const ICON = {
  back: <path d="M15 18l-6-6 6-6" />,
  textStyle: (
    <>
      <path d="M4 7V5h16v2" />
      <path d="M12 5v14" />
      <path d="M9 19h6" />
    </>
  ),
  bold: (
    <>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" />
      <path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" />
    </>
  ),
  textColor: (
    <>
      <path d="M5 20h14" />
      <path d="m8 16 4-11 4 11" />
      <path d="M9.5 13h5" />
    </>
  ),
  palette: (
    <>
      <circle cx="13.5" cy="6.5" r="1.6" />
      <circle cx="17.5" cy="10.5" r="1.6" />
      <circle cx="8.5" cy="7.5" r="1.6" />
      <path d="M12 22a10 10 0 1 1 0-20 8 8 0 0 1 0 16h-1.5a1.5 1.5 0 0 0 0 3z" />
    </>
  ),
  checklist: (
    <>
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
    </>
  ),
  caption: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15h7" />
    </>
  ),
  fit: (
    <>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M2 6h14a2 2 0 0 1 2 2v14" />
    </>
  ),
  shape: (
    <>
      <rect x="3" y="9" width="12" height="12" rx="2" />
      <circle cx="16.5" cy="8.5" r="5" />
    </>
  ),
  label: (
    <>
      <path d="M20.6 13.4 12 22l-9-9V3h10z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </>
  ),
  align: <path d="M4 6h16M4 12h10M4 18h13" />,
  size: (
    <>
      <path d="M3 8V6h8v2" />
      <path d="M7 6v12" />
      <path d="M5 18h4" />
      <path d="M13 12v-1h8v1" />
      <path d="M17 11v7" />
      <path d="M15 18h4" />
    </>
  ),
  line: (
    <>
      <path d="M5 19 19 5" />
      <path d="M11 5h8v8" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
    </>
  ),
  open: (
    <>
      <path d="M15 3h6v6M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  duplicate: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  trash: (
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
  ),
};

// Which tool's flyout is open. Held by the rail so opening one closes the last,
// and so switching cards (the rail is keyed by item id) starts closed.
const RailFlyoutCtx = createContext<{
  open: string | null;
  setOpen: (key: string | null) => void;
}>({ open: null, setOpen: () => {} });

function CardRail({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a click anywhere outside the rail (including on the canvas), so a
  // flyout never sits over the board once you have moved on. A listener rather
  // than a backdrop element: a backdrop would swallow the click that opens the
  // NEXT tool, making every switch take two clicks.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <RailFlyoutCtx.Provider value={{ open, setOpen }}>
      <div
        ref={ref}
        className="relative z-30 flex w-[52px] shrink-0 flex-col items-center gap-1 self-start rounded-[14px] border border-border bg-surface py-2"
      >
        <button
          onClick={onClose}
          aria-label="Back to tools"
          className="group relative grid h-10 w-10 place-items-center rounded-[10px] text-text-muted transition hover:bg-surface-2 hover:text-text"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            {ICON.back}
          </svg>
          <span className="pointer-events-none absolute left-full z-40 ml-2 hidden whitespace-nowrap rounded-[7px] bg-text px-2 py-1 text-[11px] font-semibold text-bg shadow-md group-hover:block">
            Back to tools
          </span>
        </button>
        <span className="px-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-text-faint">
          {label}
        </span>
        <div className="my-1 h-px w-6 bg-border" />
        {children}
      </div>
    </RailFlyoutCtx.Provider>
  );
}

function RailTool({
  id,
  label,
  icon,
  onClick,
  danger,
  wide,
  children,
}: {
  /** Set when the tool opens a flyout; omit for a plain action. */
  id?: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  /** A wider flyout, for the shape grid. */
  wide?: boolean;
  children?: React.ReactNode;
}) {
  const { open, setOpen } = useContext(RailFlyoutCtx);
  const isOpen = Boolean(id) && open === id;
  return (
    <div className="relative">
      <button
        // Keeps focus (and the text selection) inside a note or caption while
        // its formatting tools are used: execCommand acts on whatever is
        // selected, and focusing the button first would throw that away.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (id && children ? setOpen(isOpen ? null : id) : onClick?.())}
        aria-label={label}
        aria-expanded={id ? isOpen : undefined}
        className={`group relative grid h-10 w-10 place-items-center rounded-[10px] transition ${
          danger
            ? "text-text-faint hover:bg-red-bg hover:text-red"
            : isOpen
              ? "bg-accent-soft text-accent"
              : "text-text-muted hover:bg-surface-2 hover:text-text"
        }`}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
        {!isOpen && (
          <span className="pointer-events-none absolute left-full z-40 ml-2 hidden whitespace-nowrap rounded-[7px] bg-text px-2 py-1 text-[11px] font-semibold text-bg shadow-md group-hover:block">
            {label}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute left-full top-0 z-40 ml-2 rounded-[14px] border border-border bg-surface p-3 shadow-lg ${
            wide ? "w-[248px]" : "w-[210px]"
          }`}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-text-faint">
            {label}
          </p>
          <div className="flex flex-col gap-3">{children}</div>
        </div>
      )}
    </div>
  );
}

/** Duplicate and delete, which every card panel ends with. */
function CardTools({
  onDuplicate,
  onDelete,
  deleteLabel,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
  deleteLabel: string;
}) {
  return (
    <>
      <div className="my-1 h-px w-6 bg-border" />
      <RailTool label="Duplicate (Cmd/Ctrl+D)" icon={ICON.duplicate} onClick={onDuplicate} />
      <RailTool label={deleteLabel} icon={ICON.trash} onClick={onDelete} danger />
    </>
  );
}

function RailBtn({
  label,
  onClick,
  disabled,
  dragKind,
  dragOnly,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  // When set, the tool can be dragged onto the board to place it at the drop
  // point.
  dragKind?: string;
  // Creation tools are DRAG-ONLY (Milanote's rule). Clicking one used to drop
  // the card at a default spot, which routinely landed on top of whatever was
  // already there and then had to be dug out and moved. Dragging puts it
  // exactly where it belongs, so a click just says so.
  dragOnly?: boolean;
  children: React.ReactNode;
}) {
  const [nudge, setNudge] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function press() {
    if (dragOnly) {
      setNudge(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setNudge(false), 1900);
      return;
    }
    onClick();
  }

  return (
    <button
      onClick={press}
      disabled={disabled}
      aria-label={label}
      draggable={Boolean(dragKind)}
      onDragStart={
        dragKind
          ? (e) => {
              e.dataTransfer.setData("application/x-board-tool", dragKind);
              e.dataTransfer.effectAllowed = "copy";
              setNudge(false);
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
      <span
        className={`pointer-events-none absolute left-full z-40 ml-2 whitespace-nowrap rounded-[7px] px-2 py-1 text-[11px] font-semibold shadow-md ${
          nudge
            ? "block bg-accent text-accent-fg"
            : "hidden bg-text text-bg group-hover:block"
        }`}
      >
        {nudge ? `Drag "${label}" onto the board` : label}
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

function VideoModal({
  boardId,
  open,
  spot,
  onClose,
  onAdded,
}: {
  boardId: string;
  open: boolean;
  spot: () => { x: number; y: number };
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
    if (!videoEmbed(u)) {
      setErr("Paste a YouTube, Vimeo, or Loom link (or a direct video file URL).");
      return;
    }
    setBusy(true);
    setErr(null);
    const at = spot();
    const res = await addVideoItem(boardId, u, at.x, at.y);
    setBusy(false);
    if ("error" in res) {
      setErr(res.error);
      return;
    }
    onAdded("id" in res ? res.id : null);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a video">
      <div className="space-y-3">
        <p className="text-sm text-text-muted">
          Paste a YouTube, Vimeo, or Loom link. It plays inline on the board.
        </p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          autoFocus
          placeholder="https://youtube.com/watch?v=…"
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
            {busy ? "Adding…" : "Add video"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ShareBoardModal({
  boardId,
  boardName,
  open,
  onClose,
}: {
  boardId: string;
  boardName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setCopied(false);
    getBoardShare(boardId).then((s) => {
      setToken(s && !s.revoked ? s.token : null);
      setLoading(false);
    });
  }, [open, boardId]);

  const link = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/b/${token}` : "";

  async function enable() {
    setBusy(true);
    const res = await createBoardShare(boardId);
    setBusy(false);
    if ("token" in res) setToken(res.token);
  }
  async function disable() {
    setBusy(true);
    await revokeBoardShare(boardId);
    setBusy(false);
    setToken(null);
    setCopied(false);
  }
  function copy() {
    if (!link) return;
    void navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal open={open} onClose={onClose} title="Share board">
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Share <span className="font-semibold text-text">{boardName}</span> with a
          public, view-only link. Anyone with the link can see the board (no login),
          but can&apos;t edit it.
        </p>

        {loading ? (
          <p className="text-sm text-text-faint">Loading…</p>
        ) : token ? (
          <>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-xs text-text outline-none"
              />
              <Button onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green">
                <span className="h-2 w-2 rounded-full bg-green" /> Link is on
              </span>
              <button
                onClick={disable}
                disabled={busy}
                className="text-xs font-semibold text-red hover:underline disabled:opacity-50"
              >
                Turn off link
              </button>
            </div>
          </>
        ) : (
          <div className="flex justify-end">
            <Button onClick={enable} disabled={busy}>
              {busy ? "Creating…" : "Create share link"}
            </Button>
          </div>
        )}
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
  const [background, setBackground] = useState(board.background ?? "dots");
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (open) {
      setName(board.name);
      setProjectId(board.project_id ?? "");
      setBackground(board.background ?? "dots");
      setConfirm(false);
    }
  }, [open, board]);

  function save() {
    start(async () => {
      await renameBoard(board.id, name);
      await setBoardProject(board.id, projectId || null);
      await setBoardBackground(board.id, background);
      onSaved({
        ...board,
        name: name.trim() || "Untitled board",
        project_id: projectId || null,
        background,
      });
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
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-text-faint">
            Canvas background
          </label>
          <div className="mt-1.5 inline-flex items-center gap-0.5 rounded-[9px] border border-border bg-surface-2 p-0.5">
            {(["dots", "grid", "plain"] as const).map((bg) => (
              <button
                key={bg}
                onClick={() => setBackground(bg)}
                className={`rounded-[7px] px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  background === bg ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>
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
