"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BoardItemView } from "@/app/(app)/boards/actions";
import type { BoardSnapshot } from "@/lib/use-board-history";
import {
  parseLineData,
  lineColorVar,
  lineSvgPath,
  lineMidPoint,
  type LineData,
} from "@/lib/board-line";
import { parseNoteStyle, noteColorVars } from "@/lib/board-note-style";
import {
  parseHeadingStyle,
  headingCss,
  HEADING_FONT_SIZE,
} from "@/lib/board-heading";
import {
  parseShapeData,
  shapePaths,
  shapeFill,
  shapeLabelColor,
} from "@/lib/board-shape";
import { parseTodo, type TodoRow } from "@/lib/board-todo";
import { videoEmbed } from "@/lib/video-embed";
import { parseMediaMeta, serializeMediaMeta } from "@/lib/board-media";
import {
  moveItem,
  resizeItem,
  bringToFront,
  updateItemText,
  updateItemName,
  addNote,
  addTodoItem,
  attachToColumn,
  detachFromColumn,
  setColumnOrder,
  addConnection,
  deleteConnection,
  deleteItem,
  type BoardConnection,
} from "@/app/(app)/boards/actions";

// One-time "here's what this is" hint shown the first time a card type is used,
// anchored to the freshly created item (Milanote-style).
const HINT_TEXT: Record<string, { title: string; body: string }> = {
  note: { title: "Note", body: "Click to type. The left panel styles the text and the box." },
  todo: { title: "To-do", body: "A checklist. Add items and tick them off as you go." },
  column: { title: "Column", body: "Columns group cards together. Drag cards inside to stack them." },
  line: { title: "Line", body: "Drag either end to reconnect, or the middle to bend it." },
  link: { title: "Link", body: "A saved web link with a preview. Click it to open the page." },
  image: { title: "Image", body: "Drop images anywhere, or import from assets, Drive, or Figma." },
  color: { title: "Color", body: "A palette swatch. Pick any hex in the panel on the left." },
  heading: { title: "Heading", body: "A big section label to organize areas of the board. Just type." },
  shape: { title: "Shape", body: "Drag to move, pull the corner to resize. Swap the shape, color, and label in the left panel." },
  video: { title: "Video", body: "Plays inline from a YouTube, Vimeo, or Loom link." },
};

// Normalize a stored hex ("#abc", "abcdef") to "#RRGGBB"-ish; fall back to accent.
function normalizeHex(raw: string | null): string {
  const s = (raw ?? "").trim();
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(s);
  if (!m) return "#6366F1";
  return s.startsWith("#") ? s : `#${s}`;
}
// Is a hex color light enough to want dark text on top?
function isLightHex(hex: string): boolean {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

function domainOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const CANVAS_W = 2400;
const CANVAS_H = 1600;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2;

/** Which corner a resize is being dragged from. */
type ResizeCorner = "nw" | "ne" | "sw" | "se";

type DragRef = {
  id: string;
  kind: string;
  mode: "move" | "resize";
  corner?: ResizeCorner;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
} | null;

// Is the point inside any rendered column (other than excludeId)? Used to drop
// a dragged card into a column. Reads DOM rects so it ignores z-occlusion.
function columnAtPoint(
  clientX: number,
  clientY: number,
  excludeId: string
): string | null {
  const els = document.querySelectorAll("[data-column-id]");
  for (const el of Array.from(els)) {
    const id = el.getAttribute("data-column-id");
    if (!id || id === excludeId) continue;
    const r = el.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom)
      return id;
  }
  return null;
}

// Top-level card under a screen point (for drawing a connection to it).
function itemAtPoint(
  clientX: number,
  clientY: number,
  excludeId: string
): string | null {
  const els = document.querySelectorAll("[data-item-id]");
  for (const el of Array.from(els)) {
    const id = el.getAttribute("data-item-id");
    if (!id || id === excludeId) continue;
    const r = el.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom)
      return id;
  }
  return null;
}

// Point on the border of a box (center cx,cy; half-size hw,hh) in the direction
// of (tx,ty), so an arrow meets the card edge instead of its center.
function edgePoint(cx: number, cy: number, hw: number, hh: number, tx: number, ty: number) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

function bgStyle(background: string): React.CSSProperties {
  if (background === "grid") {
    return {
      backgroundImage:
        "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
      backgroundSize: "24px 24px",
    };
  }
  if (background === "plain") return {};
  return {
    backgroundImage: "radial-gradient(var(--border) 1.2px, transparent 1.2px)",
    backgroundSize: "24px 24px",
  };
}

export function BoardCanvas({
  boardId,
  items,
  setItems,
  connections,
  background,
  onDropFiles,
  onDropTool,
  onReload,
  selected,
  onSelect,
  selectedLineId,
  onSelectLine,
  hint,
  onDismissHint,
  placementRef,
  onBeforeChange,
  readOnly = false,
}: {
  boardId: string;
  items: BoardItemView[];
  setItems: React.Dispatch<React.SetStateAction<BoardItemView[]>>;
  connections: BoardConnection[];
  background: string;
  onDropFiles: (files: FileList, x: number, y: number) => void;
  onDropTool: (kind: string, x: number, y: number) => void;
  onReload: () => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
  selectedLineId: string | null;
  onSelectLine: (id: string | null) => void;
  hint: { kind: string; itemId: string } | null;
  onDismissHint: () => void;
  placementRef?: React.MutableRefObject<(() => { x: number; y: number }) | null>;
  // Called with the PRE-edit snapshot right before a gesture/op is persisted, so
  // the parent can record an undo step. Absent in the read-only share view.
  onBeforeChange?: (before: BoardSnapshot) => void;
  // Public share view: render the board but disable all editing/interaction.
  readOnly?: boolean;
}) {
  const setSelected = onSelect;
  const [scale, setScale] = useState(1);
  const [dropActive, setDropActive] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Connection drawing: the item we're dragging an arrow FROM, and the live
  // cursor point (in canvas coords). selectedConn is the clicked arrow.
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [connCursor, setConnCursor] = useState<{ x: number; y: number } | null>(null);
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const drag = useRef<DragRef>(null);
  const lineDrag = useRef<{
    id: string;
    mode: "a" | "b" | "move" | "mid";
    startX: number;
    startY: number;
    orig: LineData;
  } | null>(null);
  const scaleRef = useRef(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;
  scaleRef.current = scale;

  // Undo support: snapshot the pre-gesture state when a drag/resize/line-drag
  // begins, but only push it to history (via onBeforeChange) once the gesture
  // actually persists a change on pointer-up. A plain click never pushes.
  const beforeRef = useRef<BoardSnapshot | null>(null);
  const captureBefore = () => {
    beforeRef.current = {
      items: items.map((i) => ({ ...i })),
      connections: connections.map((c) => ({ ...c })),
    };
  };
  // Snapshot the current state for a discrete (non-drag) mutation.
  const snapshotNow = (): BoardSnapshot => ({
    items: items.map((i) => ({ ...i })),
    connections: connections.map((c) => ({ ...c })),
  });

  useEffect(() => {
    // Pointer events can fire at 120-240Hz on a fast mouse, far above the
    // display's frame rate. Coalesce them through requestAnimationFrame so a
    // drag re-renders once per frame, not once per input event.
    let raf = 0;
    let lastEvent: PointerEvent | null = null;
    function applyMove(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const s = scaleRef.current;
      const dx = (e.clientX - d.startX) / s;
      const dy = (e.clientY - d.startY) / s;
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== d.id) return it;
          if (d.mode === "move") {
            return { ...it, x: Math.max(0, d.origX + dx), y: Math.max(0, d.origY + dy) };
          }
          // Corner-aware resize: a west corner moves x and shrinks w, a north
          // corner moves y and shrinks h, so the OPPOSITE corner stays pinned.
          // Sizes clamp first and the position is derived from the clamped
          // size, so hitting the minimum cannot make the card creep.
          const c = d.corner ?? "se";
          const fromW = c === "nw" || c === "sw";
          const fromN = c === "nw" || c === "ne";
          const w = Math.max(80, fromW ? d.origW - dx : d.origW + dx);
          const h = Math.max(60, fromN ? d.origH - dy : d.origH + dy);
          const x = fromW ? Math.max(0, d.origX + (d.origW - w)) : d.origX;
          const y = fromN ? Math.max(0, d.origY + (d.origH - h)) : d.origY;
          return {
            ...it,
            x,
            y,
            // At the canvas edge the position clamps, so the size is re-derived
            // from it to keep the pinned edge pinned.
            w: fromW ? d.origX + d.origW - x : w,
            h: fromN ? d.origY + d.origH - y : h,
          };
        })
      );
    }
    function onMove(e: PointerEvent) {
      if (!drag.current) return;
      lastEvent = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (lastEvent) applyMove(lastEvent);
      });
    }
    function onUp(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      // Apply the release point exactly, so the persisted position can never
      // trail the cursor by a coalesced frame.
      applyMove(e);
      drag.current = null;
      // Did the pointer actually travel? A plain click (select) must not persist
      // a no-op or record a junk history step that undo can't visibly reverse.
      const s = scaleRef.current;
      const moved =
        Math.abs((e.clientX - d.startX) / s) > 0.5 ||
        Math.abs((e.clientY - d.startY) / s) > 0.5;

      if (d.mode === "resize") {
        if (!moved) {
          beforeRef.current = null;
          return;
        }
        if (beforeRef.current) {
          onBeforeChange?.(beforeRef.current);
          beforeRef.current = null;
        }
        setItems((prev) => {
          const cur = prev.find((x) => x.id === d.id);
          if (cur) {
            void resizeItem(cur.id, cur.w, cur.h);
            // A north or west corner moved the card while resizing it, so the
            // position persists too or a reload snaps it back.
            if (cur.x !== d.origX || cur.y !== d.origY) {
              void moveItem(cur.id, cur.x, cur.y);
            }
          }
          return prev;
        });
        return;
      }
      // Move: if dropped over a column, file it into that column instead.
      const colId =
        moved && d.kind !== "column"
          ? columnAtPoint(e.clientX, e.clientY, d.id)
          : null;
      if (colId) {
        if (beforeRef.current) {
          onBeforeChange?.(beforeRef.current);
          beforeRef.current = null;
        }
        void attachToColumn(d.id, colId).then(() => onReloadRef.current());
        return;
      }
      if (!moved) {
        beforeRef.current = null;
        return;
      }
      if (beforeRef.current) {
        onBeforeChange?.(beforeRef.current);
        beforeRef.current = null;
      }
      setItems((prev) => {
        const cur = prev.find((x) => x.id === d.id);
        if (cur) void moveItem(cur.id, cur.x, cur.y);
        return prev;
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [setItems]);

  // Drawing a connection: while a "from" item is armed, track the cursor and, on
  // release over another card, create the arrow.
  useEffect(() => {
    if (!connectFrom) return;
    function move(e: PointerEvent) {
      setConnCursor(canvasCoords(e.clientX, e.clientY));
    }
    function up(e: PointerEvent) {
      const target = itemAtPoint(e.clientX, e.clientY, connectFrom as string);
      if (target) {
        onBeforeChange?.(snapshotNow());
        void addConnection(boardId, connectFrom as string, target).then(() =>
          onReloadRef.current()
        );
      }
      setConnectFrom(null);
      setConnCursor(null);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectFrom, boardId]);

  // Delete/Backspace removes the selected card or connection (not while typing).
  useEffect(() => {
    if (readOnly) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      if (selected) {
        e.preventDefault();
        const it = items.find((i) => i.id === selected);
        if (it?.kind === "column") deleteColumn(selected);
        else remove(selected);
      } else if (selectedConn) {
        e.preventDefault();
        deleteConn(selectedConn);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedConn, items, readOnly]);

  // Dragging a line's endpoint or whole body (rAF-coalesced like card drags).
  useEffect(() => {
    let raf = 0;
    let lastEvent: PointerEvent | null = null;
    function applyLine(e: PointerEvent) {
      const d = lineDrag.current;
      if (!d) return;
      const p = canvasCoords(e.clientX, e.clientY);
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== d.id) return it;
          const data = { ...d.orig };
          if (d.mode === "a") {
            data.ax = Math.round(p.x);
            data.ay = Math.round(p.y);
          } else if (d.mode === "b") {
            data.bx = Math.round(p.x);
            data.by = Math.round(p.y);
          } else if (d.mode === "mid") {
            // Bend: store the offset of the dragged point from the straight mid.
            const midx = (d.orig.ax + d.orig.bx) / 2;
            const midy = (d.orig.ay + d.orig.by) / 2;
            data.bendX = Math.round(p.x - midx);
            data.bendY = Math.round(p.y - midy);
          } else {
            const dx = p.x - d.startX;
            const dy = p.y - d.startY;
            data.ax = Math.round(d.orig.ax + dx);
            data.ay = Math.round(d.orig.ay + dy);
            data.bx = Math.round(d.orig.bx + dx);
            data.by = Math.round(d.orig.by + dy);
          }
          return { ...it, text: JSON.stringify(data) };
        })
      );
    }
    function move(e: PointerEvent) {
      if (!lineDrag.current) return;
      lastEvent = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (lastEvent) applyLine(lastEvent);
      });
    }
    function up(e: PointerEvent) {
      const d = lineDrag.current;
      if (!d) return;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      applyLine(e);
      lineDrag.current = null;
      if (beforeRef.current) {
        onBeforeChange?.(beforeRef.current);
        beforeRef.current = null;
      }
      setItems((prev) => {
        const cur = prev.find((x) => x.id === d.id);
        if (cur?.text) void updateItemText(cur.id, cur.text);
        return prev;
      });
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [setItems]);

  function zoomBy(delta: number) {
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2))));
  }
  // Zoom anchored to a point: remember which canvas point sat under (sx, sy) in
  // the scroller, then restore it there after the scale is applied. Without
  // this every zoom is toward the canvas origin and the view jumps.
  const zoomAnchor = useRef<{ sx: number; sy: number; wx: number; wy: number } | null>(null);
  function anchorAt(clientX: number, clientY: number) {
    const sc = scrollRef.current;
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    const s = scaleRef.current;
    zoomAnchor.current = {
      sx,
      sy,
      wx: (sc.scrollLeft + sx) / s,
      wy: (sc.scrollTop + sy) / s,
    };
  }
  function anchorCenter() {
    const sc = scrollRef.current;
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    anchorAt(r.left + sc.clientWidth / 2, r.top + sc.clientHeight / 2);
  }
  function zoomAtCenter(delta: number) {
    anchorCenter();
    zoomBy(delta);
  }
  function setZoom(pct: number) {
    anchorCenter();
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(pct / 100).toFixed(2))));
  }
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const sc = scrollRef.current;
    if (!a || !sc) return;
    zoomAnchor.current = null;
    sc.scrollLeft = a.wx * scale - a.sx;
    sc.scrollTop = a.wy * scale - a.sy;
  }, [scale]);

  // Ctrl/Cmd + wheel zooms at the cursor. A NATIVE non-passive listener, not
  // React's onWheel: React attaches wheel passively, so preventDefault there is
  // ignored and the browser's own page zoom fights the canvas zoom.
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    function onWheelNative(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      anchorAt(e.clientX, e.clientY);
      zoomBy(e.deltaY > 0 ? -0.1 : 0.1);
    }
    sc.addEventListener("wheel", onWheelNative, { passive: false });
    return () => sc.removeEventListener("wheel", onWheelNative);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit every top-level item into the viewport and center it.
  function scaleToFit() {
    const sc = scrollRef.current;
    if (!sc) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const it of items) {
      if (it.parentId) continue;
      if (it.kind === "line") {
        const d = parseLineData(it.text);
        minX = Math.min(minX, d.ax, d.bx);
        minY = Math.min(minY, d.ay, d.by);
        maxX = Math.max(maxX, d.ax, d.bx);
        maxY = Math.max(maxY, d.ay, d.by);
      } else {
        minX = Math.min(minX, it.x);
        minY = Math.min(minY, it.y);
        maxX = Math.max(maxX, it.x + (it.w || 220));
        maxY = Math.max(maxY, it.y + (it.h || 160));
      }
    }
    if (!Number.isFinite(minX)) return;
    const pad = 60;
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2;
    const vw = sc.clientWidth;
    const vh = sc.clientHeight;
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, +Math.min(vw / bw, vh / bh).toFixed(2)));
    setScale(s);
    requestAnimationFrame(() => {
      const sc2 = scrollRef.current;
      if (!sc2) return;
      const contentW = bw * s;
      const contentH = bh * s;
      const offX = Math.max(0, (vw - contentW) / 2);
      const offY = Math.max(0, (vh - contentH) / 2);
      sc2.scrollLeft = Math.max(0, (minX - pad) * s - offX);
      sc2.scrollTop = Math.max(0, (minY - pad) * s - offY);
    });
  }

  // Presentation mode: fullscreen the board (its chrome siblings vanish) and
  // drop the dot grid for a clean view. Esc exits.
  function togglePresent() {
    setZoomOpen(false);
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }
  useEffect(() => {
    function onFs() {
      setPresenting(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function canvasCoords(clientX: number, clientY: number) {
    const rect = contentRef.current?.getBoundingClientRect();
    const s = scaleRef.current;
    if (!rect) return { x: 60, y: 60 };
    return {
      x: Math.max(0, (clientX - rect.left) / s),
      y: Math.max(0, (clientY - rect.top) / s),
    };
  }
  // Canvas coords at the center of the currently visible viewport, so new items
  // (uploads, clicked tools) land where the user is looking, not off-screen.
  function viewportCenter() {
    const r = scrollRef.current?.getBoundingClientRect();
    if (!r) return { x: 80, y: 80 };
    const c = canvasCoords(r.left + r.width / 2, r.top + r.height / 2);
    return { x: Math.round(c.x), y: Math.round(c.y) };
  }
  if (placementRef) placementRef.current = viewportCenter;
  // Persist a caption (HTML) onto an image / video card, preserving its fit.
  function saveMediaCaption(it: BoardItemView, html: string) {
    const text = serializeMediaMeta({ ...parseMediaMeta(it.text), caption: html });
    onBeforeChange?.(snapshotNow());
    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, text } : p)));
    void updateItemText(it.id, text);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropActive(false);
    if (readOnly) return;
    const tool = e.dataTransfer.getData("application/x-board-tool");
    if (tool) {
      const { x, y } = canvasCoords(e.clientX, e.clientY);
      onDropTool(tool, Math.round(x), Math.round(y));
      return;
    }
    if (e.dataTransfer.files?.length) {
      const { x, y } = canvasCoords(e.clientX, e.clientY);
      onDropFiles(e.dataTransfer.files, Math.round(x), Math.round(y));
    }
  }

  function startMove(e: React.PointerEvent, it: BoardItemView) {
    if (readOnly) return;
    const target = e.target as HTMLElement;
    if (
      target.dataset.resize ||
      ["TEXTAREA", "INPUT", "BUTTON", "A"].includes(target.tagName)
    )
      return;
    setSelected(it.id);
    onSelectLine(null);
    captureBefore();
    drag.current = {
      id: it.id,
      kind: it.kind,
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      origX: it.x,
      origY: it.y,
      origW: it.w,
      origH: it.h,
    };
    // Already the sole top card? Skip the z bump: it would be a DB write and a
    // full re-render on every plain click of the same card.
    const maxZ = Math.max(0, ...items.map((p) => p.z));
    const alreadyTop =
      it.z === maxZ && items.every((p) => p.id === it.id || p.z < maxZ);
    if (!alreadyTop) {
      setItems((prev) => {
        const mz = Math.max(0, ...prev.map((p) => p.z));
        return prev.map((p) => (p.id === it.id ? { ...p, z: mz + 1 } : p));
      });
      void bringToFront(it.id, boardId);
    }
  }

  function startResize(
    e: React.PointerEvent,
    it: BoardItemView,
    corner: ResizeCorner = "se"
  ) {
    if (readOnly) return;
    e.stopPropagation();
    setSelected(it.id);
    captureBefore();
    drag.current = {
      id: it.id,
      kind: it.kind,
      mode: "resize",
      corner,
      startX: e.clientX,
      startY: e.clientY,
      origX: it.x,
      origY: it.y,
      origW: it.w,
      origH: it.h,
    };
  }

  function remove(id: string) {
    onBeforeChange?.(snapshotNow());
    setItems((prev) => prev.filter((p) => p.id !== id));
    setSelected(null);
    void deleteItem(id);
  }
  // Checklist edits. persist=false for keystrokes (persisted on blur); true for
  // discrete actions (toggle / add / remove).
  function mutateTodo(
    it: BoardItemView,
    fn: (rows: TodoRow[]) => TodoRow[],
    persist: boolean
  ) {
    if (readOnly) return;
    const text = JSON.stringify(fn(parseTodo(it.text)));
    // Only discrete ops (toggle / add / remove, persist=true) become undo steps;
    // per-keystroke edits (persist=false) are captured on blur, not here.
    if (persist) onBeforeChange?.(snapshotNow());
    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, text } : p)));
    if (persist) void updateItemText(it.id, text);
  }

  // ---- Column helpers ----
  function editColName(id: string, name: string) {
    if (readOnly) return;
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }
  function addChild(kind: "note" | "todo", colId: string) {
    if (readOnly) return;
    const fn = kind === "note" ? addNote : addTodoItem;
    void fn(boardId, 0, 0, colId).then(() => onReloadRef.current());
  }
  function reorderChild(kids: BoardItemView[], idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= kids.length) return;
    onBeforeChange?.(snapshotNow());
    const arr = [...kids];
    const [moved] = arr.splice(idx, 1);
    arr.splice(j, 0, moved);
    const ids = arr.map((k) => k.id);
    setItems((prev) =>
      prev.map((p) => {
        const ni = ids.indexOf(p.id);
        return ni >= 0 ? { ...p, sort: ni } : p;
      })
    );
    void setColumnOrder(ids);
  }
  function popOut(child: BoardItemView, col: BoardItemView) {
    const x = col.x + col.w + 24;
    const y = col.y;
    onBeforeChange?.(snapshotNow());
    setItems((prev) =>
      prev.map((p) => (p.id === child.id ? { ...p, parentId: null, x, y, sort: 0 } : p))
    );
    void detachFromColumn(child.id, x, y);
  }
  function deleteColumn(id: string) {
    onBeforeChange?.(snapshotNow());
    setSelected(null);
    setItems((prev) => prev.filter((p) => p.id !== id && p.parentId !== id));
    void deleteItem(id).then(() => onReloadRef.current());
  }
  function startConnect(e: React.PointerEvent, it: BoardItemView) {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedConn(null);
    setConnectFrom(it.id);
    setConnCursor({ x: it.x + it.w, y: it.y + it.h / 2 });
  }
  function deleteConn(id: string) {
    onBeforeChange?.(snapshotNow());
    setSelectedConn(null);
    void deleteConnection(id).then(() => onReloadRef.current());
  }
  function startLineDrag(
    e: React.PointerEvent,
    it: BoardItemView,
    mode: "a" | "b" | "move" | "mid"
  ) {
    if (readOnly) return;
    e.stopPropagation();
    setSelected(null);
    setSelectedConn(null);
    onSelectLine(it.id);
    const p = canvasCoords(e.clientX, e.clientY);
    captureBefore();
    lineDrag.current = {
      id: it.id,
      mode,
      startX: p.x,
      startY: p.y,
      orig: parseLineData(it.text),
    };
  }

  // Compact card rendering for an item that lives inside a column.
  function renderChild(child: BoardItemView, idx: number, kids: BoardItemView[], col: BoardItemView) {
    const ctrls = (
      <div className="flex items-center gap-0.5 border-t border-border px-1 py-0.5 text-text-faint">
        <button className={childBtn} title="Move up" onClick={() => reorderChild(kids, idx, -1)} disabled={idx === 0}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
        </button>
        <button className={childBtn} title="Move down" onClick={() => reorderChild(kids, idx, 1)} disabled={idx === kids.length - 1}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <button className={`${childBtn} ml-auto`} title="Pop out to canvas" onClick={() => popOut(child, col)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>
        </button>
        <button className={`${childBtn} hover:text-red`} title="Delete" onClick={() => remove(child.id)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
    );

    let body: React.ReactNode;
    if (child.kind === "note") {
      // Parse the full note style: hue can be "strip:blue", "none", or a
      // custom hex, and interpolating it raw produced an invalid CSS var
      // (a styled note dropped into a column silently lost its color).
      const cns = parseNoteStyle(child.hue);
      const cnc = noteColorVars(cns.color);
      // ContentEditable, not a textarea: note text is HTML (rich text), and a
      // textarea here showed the raw markup and flattened it to plain text on
      // save, destroying the note's formatting.
      body = (
        <div
          contentEditable={!readOnly}
          suppressContentEditableWarning
          data-placeholder="Note…"
          onBlur={(e) => {
            const html = e.currentTarget.innerHTML;
            if (html === (child.text ?? "")) return;
            setItems((prev) =>
              prev.map((p) => (p.id === child.id ? { ...p, text: html } : p))
            );
            void updateItemText(child.id, html);
          }}
          dangerouslySetInnerHTML={{ __html: child.text ?? "" }}
          className="rte min-h-[56px] w-full px-2 py-1.5 text-[13px] outline-none"
          style={{
            backgroundColor: cns.mode === "fill" ? cnc.bg : "transparent",
            color: cns.mode === "fill" ? cnc.accent : "var(--text)",
          }}
        />
      );
    } else if (child.kind === "todo") {
      const rows = parseTodo(child.text);
      body = (
        <div className="space-y-1 px-2 py-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-1.5">
              <input
                type="checkbox"
                checked={r.done}
                onChange={() =>
                  mutateTodo(child, (rs) => rs.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)), true)
                }
                className="mt-1 shrink-0 accent-accent"
              />
              <input
                value={r.text}
                placeholder="Item…"
                onChange={(e) =>
                  mutateTodo(child, (rs) => rs.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)), false)
                }
                onBlur={() => void updateItemText(child.id, child.text ?? "[]")}
                className={`min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none ${r.done ? "text-text-faint line-through" : ""}`}
              />
            </div>
          ))}
          <button
            onClick={() => mutateTodo(child, (rs) => [...rs, { id: crypto.randomUUID(), text: "", done: false }], true)}
            className="text-[11px] font-semibold text-accent hover:underline"
          >
            + Add item
          </button>
        </div>
      );
    } else if (child.kind === "link") {
      const dom = domainOf(child.url);
      body = (
        <div>
          {child.thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={child.thumbUrl} alt="" className="h-24 w-full object-cover" />
          )}
          <div className="px-2 py-1.5">
            <div className="line-clamp-2 text-[12px] font-bold text-text">{child.name || dom}</div>
            {child.url && (
              <a href={child.url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-accent hover:underline">
                {dom || "Open"} ↗
              </a>
            )}
          </div>
        </div>
      );
    } else if (child.kind === "heading") {
      // A heading dragged into a column keeps its styling, capped so it reads
      // as a section label within the column rather than a banner.
      const hs = parseHeadingStyle(child.hue);
      body = (
        <div
          className="px-2 py-1.5 font-extrabold leading-tight tracking-tight"
          style={{ ...headingCss(hs), fontSize: Math.min(HEADING_FONT_SIZE[hs.size], 20) }}
        >
          {child.text || <span className="font-semibold text-text-faint">Heading</span>}
        </div>
      );
    } else if (child.kind === "color") {
      const hex = normalizeHex(child.text);
      body = (
        <div className="flex h-12 items-end px-2 py-1.5" style={{ backgroundColor: hex }}>
          <span
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color: isLightHex(hex) ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.94)" }}
          >
            {hex}
          </span>
        </div>
      );
    } else if (child.kind === "shape") {
      const sd = parseShapeData(child.text);
      const paths = shapePaths(sd.shape, 200, 100);
      body = (
        <div className="relative px-2 py-2">
          <svg width="100%" viewBox="0 0 200 100" style={{ display: "block" }}>
            {paths.map((p, i) => (
              <path key={i} d={p.d} fill={p.overlay ? "rgba(255,255,255,0.35)" : shapeFill(child.hue)} />
            ))}
          </svg>
          {child.name && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-3">
              <span className="text-[12px] font-bold" style={{ color: shapeLabelColor(child.hue) }}>
                {child.name}
              </span>
            </div>
          )}
        </div>
      );
    } else {
      const isImg =
        child.signedUrl &&
        (child.mimeType?.startsWith("image/") ||
          /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(child.name ?? ""));
      body = isImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={child.signedUrl!} alt={child.name ?? ""} className="max-h-40 w-full object-cover" />
      ) : (
        <div className="px-2 py-2 text-[12px] font-semibold text-text-muted">
          {child.name ?? "File"}
          {child.signedUrl && (
            <a href={child.signedUrl} target="_blank" rel="noreferrer" className="ml-1 text-accent hover:underline">
              Open
            </a>
          )}
        </div>
      );
    }

    return (
      <div key={child.id} className="overflow-hidden rounded-[9px] border border-border bg-surface">
        {body}
        {ctrls}
      </div>
    );
  }

  const zoomBtn =
    "grid h-7 w-7 place-items-center rounded-[8px] text-text-muted transition hover:bg-surface-2 hover:text-text";
  const childBtn =
    "grid h-5 w-5 place-items-center rounded-[5px] transition hover:bg-surface-2 hover:text-text disabled:opacity-30";

  // Split into top-level (absolutely placed) items and column children (flowed
  // inside their column, ordered by sort). Memoized: these run on every drag
  // frame otherwise.
  const { childrenByParent, cardItems, lineItems, byId } = useMemo(() => {
    const kidMap = new Map<string, BoardItemView[]>();
    for (const it of items) {
      if (it.parentId) {
        const arr = kidMap.get(it.parentId) ?? [];
        arr.push(it);
        kidMap.set(it.parentId, arr);
      }
    }
    for (const arr of kidMap.values()) arr.sort((a, b) => a.sort - b.sort);
    const top = items.filter((i) => !i.parentId);
    const cards = top.filter((i) => i.kind !== "line");
    return {
      childrenByParent: kidMap,
      cardItems: cards,
      lineItems: top.filter((i) => i.kind === "line"),
      byId: new Map(cards.map((i) => [i.id, i])),
    };
  }, [items]);

  // Connection segments: edge-to-edge, so arrows meet card borders. Skips a
  // connection whose endpoints aren't both top-level items on this board.
  const connSegments = useMemo(
    () =>
      connections
        .map((c) => {
          const a = byId.get(c.fromItemId);
          const b = byId.get(c.toItemId);
          if (!a || !b) return null;
          const acx = a.x + a.w / 2;
          const acy = a.y + a.h / 2;
          const bcx = b.x + b.w / 2;
          const bcy = b.y + b.h / 2;
          const p1 = edgePoint(acx, acy, a.w / 2, a.h / 2, bcx, bcy);
          const p2 = edgePoint(bcx, bcy, b.w / 2, b.h / 2, acx, acy);
          return { id: c.id, p1, p2, mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } };
        })
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [connections, byId]
  );
  const connFromItem = connectFrom ? byId.get(connectFrom) : null;

  return (
    <div ref={rootRef} className="relative h-full w-full bg-bg">
      <div
        ref={scrollRef}
        className={`h-full w-full overflow-auto border bg-surface transition-colors ${
          presenting ? "rounded-none" : "rounded-[14px]"
        } ${dropActive ? "border-accent" : "border-border"}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dropActive) setDropActive(true);
        }}
        onDragLeave={(e) => {
          if (e.target === e.currentTarget) setDropActive(false);
        }}
        onDrop={onDrop}
      >
        {/* Sizer drives the scroll area at the current zoom. */}
        <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
          <div
            ref={contentRef}
            className="relative"
            data-readonly={readOnly ? "1" : undefined}
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
              ...bgStyle(presenting ? "plain" : background),
            }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                setSelected(null);
                setSelectedConn(null);
                onSelectLine(null);
              }
            }}
            onPointerMove={(e) => {
              if (readOnly || drag.current || connectFrom) return;
              // The browser already hit-tested for us: the event target is the
              // topmost element under the cursor. Walking up to the owning card
              // is O(depth); scanning every card's DOM rect per mouse move was
              // an O(items) forced-layout pass and lagged big boards.
              const el = (e.target as HTMLElement).closest?.("[data-item-id]");
              setHovered(el ? el.getAttribute("data-item-id") : null);
            }}
            onPointerLeave={() => setHovered(null)}
          >
            {/* Connection arrows (behind cards) */}
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={CANVAS_W}
              height={CANVAS_H}
              style={{ zIndex: 0 }}
            >
              <defs>
                <marker id="bc-arrow" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L7,3 L0,6 Z" fill="var(--border-strong)" />
                </marker>
                <marker id="bc-arrow-sel" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L7,3 L0,6 Z" fill="var(--accent)" />
                </marker>
              </defs>
              {connSegments.map((s) => {
                const sel = selectedConn === s.id;
                return (
                  <path
                    key={s.id}
                    d={`M ${s.p1.x} ${s.p1.y} L ${s.p2.x} ${s.p2.y}`}
                    stroke={sel ? "var(--accent)" : "var(--border-strong)"}
                    strokeWidth={sel ? 3 : 2}
                    fill="none"
                    markerEnd={`url(#${sel ? "bc-arrow-sel" : "bc-arrow"})`}
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedConn(s.id);
                      setSelected(null);
                      onSelectLine(null);
                    }}
                  />
                );
              })}
              {connFromItem && connCursor && (
                <path
                  d={`M ${connFromItem.x + connFromItem.w / 2} ${connFromItem.y + connFromItem.h / 2} L ${connCursor.x} ${connCursor.y}`}
                  stroke="var(--accent)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  fill="none"
                  markerEnd="url(#bc-arrow-sel)"
                />
              )}
            </svg>

            {cardItems.map((it) => {
              const isSel = selected === it.id;
              const common: React.CSSProperties = {
                position: "absolute",
                left: it.x,
                top: it.y,
                width: it.w,
                height: it.h,
                zIndex: it.z,
              };
              const ring = isSel
                ? "0 0 0 2px var(--accent)"
                : "0 1px 3px rgba(0,0,0,.12)";

              if (it.kind === "column") {
                const kids = childrenByParent.get(it.id) ?? [];
                // Box appearance (Milanote-style), shared encoding with notes. A
                // column with no hue keeps the neutral default look.
                const cs = it.hue ? parseNoteStyle(it.hue) : null;
                const cc = cs ? noteColorVars(cs.color) : null;
                const colBg =
                  !cs
                    ? undefined
                    : cs.mode === "fill"
                    ? cc!.bg
                    : cs.mode === "strip"
                    ? "var(--surface-2)"
                    : "transparent";
                const stripBg = cs?.mode === "strip" ? cc!.accent : undefined;
                const headText =
                  cs?.mode === "fill" ? cc!.accent : cs?.mode === "strip" ? "#fff" : undefined;
                return (
                  <div
                    key={it.id}
                    data-column-id={it.id}
                    data-item-id={it.id}
                    style={{
                      position: "absolute",
                      left: it.x,
                      top: it.y,
                      width: it.w,
                      zIndex: it.z,
                      boxShadow: ring,
                      backgroundColor: colBg,
                    }}
                    className={`flex flex-col rounded-[12px] border border-border ${
                      cs ? "" : "bg-surface-2/70"
                    }`}
                  >
                    <div
                      className="flex h-8 shrink-0 cursor-move items-center gap-1 rounded-t-[12px] px-1.5"
                      style={{ touchAction: "none", backgroundColor: stripBg, color: headText }}
                      onPointerDown={(e) => startMove(e, it)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" opacity="0.4" aria-hidden>
                        <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
                      </svg>
                      <input
                        value={it.name ?? ""}
                        placeholder="Column"
                        onChange={(e) => editColName(it.id, e.target.value)}
                        onBlur={() => void updateItemName(it.id, it.name ?? "")}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
                        style={{ color: headText ?? "var(--text)" }}
                      />
                      <span
                        className="shrink-0 text-[11px] font-semibold"
                        style={{ color: headText ?? "var(--text-faint)", opacity: headText ? 0.85 : 1 }}
                      >
                        {kids.length}
                      </span>
                    </div>
                    <div className="space-y-2 p-2">
                      {kids.length === 0 ? (
                        <p className="rounded-[8px] border border-dashed border-border py-6 text-center text-[11px] text-text-faint">
                          Drag cards here, or use + below
                        </p>
                      ) : (
                        kids.map((c, i) => renderChild(c, i, kids, it))
                      )}
                      <div className="flex items-center gap-1 pt-0.5">
                        <button
                          onClick={() => addChild("note", it.id)}
                          className="rounded-[7px] border border-border px-2 py-1 text-[11px] font-semibold text-text-muted transition hover:bg-surface hover:text-text"
                        >
                          + Note
                        </button>
                        <button
                          onClick={() => addChild("todo", it.id)}
                          className="rounded-[7px] border border-border px-2 py-1 text-[11px] font-semibold text-text-muted transition hover:bg-surface hover:text-text"
                        >
                          + To-do
                        </button>
                      </div>
                    </div>
                    <span
                      data-resize="1"
                      onPointerDown={(e) => startResize(e, it)}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                      style={{ touchAction: "none" }}
                    />
                  </div>
                );
              }

              if (it.kind === "note") {
                const ns = parseNoteStyle(it.hue);
                const nc = noteColorVars(ns.color);
                const noteBg =
                  ns.mode === "fill" ? nc.bg : ns.mode === "strip" ? "var(--surface)" : "transparent";
                const bodyColor = ns.mode === "fill" ? nc.accent : "var(--text)";
                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    style={{
                      ...common,
                      backgroundColor: noteBg,
                      boxShadow: ring,
                      border: ns.mode === "none" ? "1px solid var(--border)" : undefined,
                    }}
                    className="group flex flex-col overflow-hidden rounded-[10px]"
                  >
                    {/* Header bar (the editor can't be dragged), matching the
                        To-do / Column headers: grip dots + a type label. Colored
                        per box mode. */}
                    <div
                      className="flex h-7 shrink-0 cursor-move items-center gap-1.5 px-2"
                      style={{
                        backgroundColor: ns.mode === "strip" ? nc.accent : "transparent",
                        color:
                          ns.mode === "strip"
                            ? "#fff"
                            : ns.mode === "fill"
                            ? nc.accent
                            : "var(--text-muted)",
                        touchAction: "none",
                      }}
                      onPointerDown={(e) => startMove(e, it)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden opacity="0.5">
                        <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
                        <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
                        <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
                      </svg>
                      <span className="text-[11px] font-extrabold uppercase tracking-wide">Note</span>
                    </div>
                    <NoteBody
                      itemId={it.id}
                      initial={it.text ?? ""}
                      color={bodyColor}
                      editable={!readOnly}
                      onFocus={() => setSelected(it.id)}
                      onSave={(html) => {
                        onBeforeChange?.(snapshotNow());
                        setItems((prev) =>
                          prev.map((p) => (p.id === it.id ? { ...p, text: html } : p))
                        );
                        void updateItemText(it.id, html);
                      }}
                    />
                    <span
                      data-resize="1"
                      onPointerDown={(e) => startResize(e, it)}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                      style={{ touchAction: "none" }}
                    />
                  </div>
                );
              }

              if (it.kind === "link") {
                const dom = domainOf(it.url);
                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    style={{ ...common, boxShadow: ring }}
                    className="group flex flex-col overflow-hidden rounded-[10px] border border-border bg-surface"
                    onPointerDown={(e) => startMove(e, it)}
                  >
                    <div className="grid flex-1 place-items-center overflow-hidden bg-surface-2">
                      {it.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.thumbUrl}
                          alt=""
                          draggable={false}
                          className="h-full w-full select-none object-cover"
                        />
                      ) : (
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
                          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
                        </svg>
                      )}
                    </div>
                    <div className="shrink-0 border-t border-border px-2.5 py-2">
                      <div className="line-clamp-2 text-xs font-bold text-text">
                        {it.name || dom || it.url}
                      </div>
                      {it.url && (
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          onPointerDown={(e) => e.stopPropagation()}
                          className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                        >
                          {dom || "Open"} ↗
                        </a>
                      )}
                    </div>
                    <span
                      data-resize="1"
                      onPointerDown={(e) => startResize(e, it)}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                      style={{ touchAction: "none" }}
                    />
                  </div>
                );
              }

              if (it.kind === "todo") {
                const rows = parseTodo(it.text);
                // Resolves a hue token OR a custom #hex (noteColorVars handles
                // both), so the header can go off-palette.
                const tc = noteColorVars(it.hue ?? "blue");
                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    style={{ ...common, boxShadow: ring }}
                    className="group flex flex-col overflow-hidden rounded-[10px] border border-border bg-surface"
                  >
                    <div
                      className="flex h-7 shrink-0 cursor-move items-center justify-between px-2"
                      style={{ backgroundColor: tc.bg, color: tc.accent, touchAction: "none" }}
                      onPointerDown={(e) => startMove(e, it)}
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
                        </svg>
                        To-do
                      </span>
                    </div>
                    <div className="flex-1 space-y-1 overflow-auto px-2 py-2">
                      {rows.map((r) => (
                        <div key={r.id} className="flex items-start gap-1.5">
                          <input
                            type="checkbox"
                            checked={r.done}
                            onPointerDown={(e) => e.stopPropagation()}
                            onChange={() =>
                              mutateTodo(
                                it,
                                (rs) => rs.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)),
                                true
                              )
                            }
                            className="mt-1 shrink-0 accent-accent"
                          />
                          <input
                            value={r.text}
                            placeholder="Item…"
                            onPointerDown={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              mutateTodo(
                                it,
                                (rs) => rs.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)),
                                false
                              )
                            }
                            onBlur={() => void updateItemText(it.id, it.text ?? "[]")}
                            className={`min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none ${
                              r.done ? "text-text-faint line-through" : ""
                            }`}
                          />
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => mutateTodo(it, (rs) => rs.filter((x) => x.id !== r.id), true)}
                            className="mt-0.5 text-text-faint hover:text-red"
                            aria-label="Remove item"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() =>
                          mutateTodo(
                            it,
                            (rs) => [...rs, { id: crypto.randomUUID(), text: "", done: false }],
                            true
                          )
                        }
                        className="mt-0.5 text-[12px] font-semibold text-accent hover:underline"
                      >
                        + Add item
                      </button>
                    </div>
                    <span
                      data-resize="1"
                      onPointerDown={(e) => startResize(e, it)}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                      style={{ touchAction: "none" }}
                    />
                  </div>
                );
              }

              if (it.kind === "video") {
                const emb = videoEmbed(it.url);
                const vmeta = parseMediaMeta(it.text);
                const showVCap = isSel || !!vmeta.caption;
                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    style={{ ...common, boxShadow: ring }}
                    className="group flex flex-col overflow-hidden rounded-[10px] border border-border bg-black"
                  >
                    {/* Drag handle so the player controls stay usable */}
                    <div
                      className="flex h-5 shrink-0 cursor-move items-center bg-surface px-1.5 text-text-faint"
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => startMove(e, it)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" opacity="0.5" aria-hidden>
                        <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
                      </svg>
                    </div>
                    {emb ? (
                      emb.provider === "file" ? (
                        <video
                          src={emb.embedUrl}
                          controls
                          playsInline
                          preload="metadata"
                          onPointerDown={(e) => e.stopPropagation()}
                          className="min-h-0 w-full flex-1 object-contain"
                          style={{ background: "#000" }}
                        />
                      ) : (
                        <iframe
                          src={emb.embedUrl}
                          title={emb.title}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="min-h-0 w-full flex-1"
                          style={{ border: 0 }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                          allowFullScreen
                        />
                      )
                    ) : (
                      <a
                        href={it.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        onPointerDown={(e) => e.stopPropagation()}
                        className="flex flex-1 flex-col items-center justify-center gap-1 bg-surface p-3 text-center"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.6"><path d="m10 8 6 4-6 4V8z" /><rect x="2" y="4" width="20" height="16" rx="3" /></svg>
                        <span className="text-[11px] font-semibold text-accent">Open video ↗</span>
                        <span className="text-[10px] text-text-faint">Unrecognized link</span>
                      </a>
                    )}
                    {showVCap && (
                      <div className="shrink-0 border-t border-border bg-surface" onPointerDown={(e) => e.stopPropagation()}>
                        <CaptionBody
                          itemId={it.id}
                          initial={vmeta.caption}
                          editable={!readOnly}
                          onFocus={() => setSelected(it.id)}
                          onSave={(html) => saveMediaCaption(it, html)}
                        />
                      </div>
                    )}
                    <span
                      data-resize="1"
                      onPointerDown={(e) => startResize(e, it)}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                      style={{ touchAction: "none" }}
                    />
                  </div>
                );
              }

              if (it.kind === "color") {
                const hex = normalizeHex(it.text);
                const light = isLightHex(hex);
                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    style={{ ...common, boxShadow: ring, backgroundColor: hex }}
                    className="group flex cursor-move flex-col justify-end overflow-hidden rounded-[10px] border border-border"
                    onPointerDown={(e) => startMove(e, it)}
                  >
                    <div className="px-2.5 py-2">
                      <span
                        className="text-[12px] font-bold uppercase tracking-wide"
                        style={{ color: light ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.94)" }}
                      >
                        {hex}
                      </span>
                    </div>
                    <span
                      data-resize="1"
                      onPointerDown={(e) => startResize(e, it)}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                      style={{ touchAction: "none" }}
                    />
                  </div>
                );
              }

              if (it.kind === "shape") {
                const sd = parseShapeData(it.text);
                const fill = shapeFill(it.hue);
                const paths = shapePaths(sd.shape, it.w, it.h);
                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    style={{
                      ...common,
                      // No box: the SVG silhouette IS the card, so the resting
                      // drop shadow the boxed cards use would draw a floating
                      // rectangle around nothing. Selection is an outline.
                      outline: isSel ? "2px solid var(--accent)" : undefined,
                      outlineOffset: 3,
                      borderRadius: 6,
                      touchAction: "none",
                    }}
                    className="group cursor-move"
                    onPointerDown={(e) => startMove(e, it)}
                  >
                    <svg
                      width="100%"
                      height="100%"
                      viewBox={`0 0 ${it.w} ${it.h}`}
                      style={{ display: "block" }}
                      aria-label={it.name || "Shape"}
                    >
                      {paths.map((p, i) => (
                        <path
                          key={i}
                          d={p.d}
                          fill={p.overlay ? "rgba(255,255,255,0.35)" : fill}
                        />
                      ))}
                    </svg>
                    {it.name && (
                      <div className="pointer-events-none absolute inset-0 grid place-items-center px-3">
                        <span
                          className="max-w-full break-words text-center text-[13px] font-bold leading-snug"
                          style={{ color: shapeLabelColor(it.hue) }}
                        >
                          {it.name}
                        </span>
                      </div>
                    )}
                    <span
                      data-resize="1"
                      onPointerDown={(e) => startResize(e, it)}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                      style={{ touchAction: "none" }}
                    />
                  </div>
                );
              }

              if (it.kind === "heading") {
                const hstyle = parseHeadingStyle(it.hue);
                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    style={{
                      position: "absolute",
                      left: it.x,
                      top: it.y,
                      width: it.w,
                      zIndex: it.z,
                      outline: isSel ? "2px solid var(--accent)" : undefined,
                      outlineOffset: 4,
                      borderRadius: 4,
                    }}
                    className="group"
                  >
                    {/* Drag grip (the text is editable, so it can't be dragged) */}
                    <div
                      className="absolute -left-5 top-1 hidden h-6 w-5 cursor-move place-items-center rounded-[5px] text-text-faint group-hover:grid"
                      style={{ touchAction: "none", boxShadow: isSel ? "0 0 0 2px var(--accent)" : undefined }}
                      onPointerDown={(e) => startMove(e, it)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" opacity="0.6" aria-hidden>
                        <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
                      </svg>
                    </div>
                    <HeadingBody
                      itemId={it.id}
                      initial={it.text ?? ""}
                      css={headingCss(hstyle)}
                      editable={!readOnly}
                      onFocus={() => setSelected(it.id)}
                      onSave={(html) => {
                        onBeforeChange?.(snapshotNow());
                        setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, text: html } : p)));
                        void updateItemText(it.id, html);
                      }}
                    />
                  </div>
                );
              }

              const isVideo =
                it.signedUrl &&
                (it.mimeType?.startsWith("video/") ||
                  /\.(mp4|webm|mov|m4v|ogv)$/i.test(it.name ?? ""));
              if (isVideo) {
                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    style={{ ...common, boxShadow: ring }}
                    className="group flex flex-col overflow-hidden rounded-[10px] border border-border bg-black"
                  >
                    {/* Drag handle so the video's own controls stay clickable */}
                    <div
                      className="flex h-5 shrink-0 cursor-move items-center bg-surface px-1.5 text-text-faint"
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => startMove(e, it)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" opacity="0.5" aria-hidden>
                        <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
                      </svg>
                    </div>
                    <video
                      src={it.signedUrl!}
                      controls
                      playsInline
                      preload="metadata"
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`min-h-0 w-full flex-1 ${it.text === "contain" ? "object-contain" : "object-cover"}`}
                      style={{ background: "#000" }}
                    />
                    <span
                      data-resize="1"
                      onPointerDown={(e) => startResize(e, it)}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                      style={{ touchAction: "none" }}
                    />
                  </div>
                );
              }

              const isImage =
                it.signedUrl &&
                (it.mimeType?.startsWith("image/") ||
                  /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(it.name ?? ""));
              const media = parseMediaMeta(it.text);
              const showCap = isSel || !!media.caption;

              return (
                <div
                  key={it.id}
                  data-item-id={it.id}
                  style={{ ...common, boxShadow: ring }}
                  className="group flex flex-col overflow-hidden rounded-[10px] bg-surface"
                  onPointerDown={(e) => startMove(e, it)}
                >
                  <div className="relative min-h-0 flex-1">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.signedUrl!}
                        alt={it.name ?? ""}
                        draggable={false}
                        className={`h-full w-full select-none ${
                          media.fit === "contain" ? "object-contain" : "object-cover"
                        }`}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-text-muted">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6" />
                        </svg>
                        <span className="line-clamp-2 text-xs font-semibold">
                          {it.name ?? "File"}
                        </span>
                        {it.signedUrl && (
                          <a
                            href={it.signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-accent hover:underline"
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            Open
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  {showCap && (
                    <div className="shrink-0 border-t border-border bg-surface" onPointerDown={(e) => e.stopPropagation()}>
                      <CaptionBody
                        itemId={it.id}
                        initial={media.caption}
                        editable={!readOnly}
                        onFocus={() => setSelected(it.id)}
                        onSave={(html) => saveMediaCaption(it, html)}
                      />
                    </div>
                  )}
                  <span
                    data-resize="1"
                    onPointerDown={(e) => startResize(e, it)}
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
                    style={{ touchAction: "none" }}
                  />
                </div>
              );
            })}

            {/* Standalone line/arrow objects (above cards, but only the stroke +
                endpoints are interactive so cards stay clickable). */}
            {lineItems.length > 0 && (
              <svg
                className="absolute left-0 top-0"
                width={CANVAS_W}
                height={CANVAS_H}
                style={{ zIndex: 4000, pointerEvents: "none" }}
              >
                <defs>
                  <marker id="ln-end" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L6,3 L0,6 Z" fill="context-stroke" />
                  </marker>
                  <marker id="ln-start" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth">
                    <path d="M0,0 L6,3 L0,6 Z" fill="context-stroke" />
                  </marker>
                </defs>
                {lineItems.map((it) => {
                  const d = parseLineData(it.text);
                  const sel = selectedLineId === it.id;
                  const stroke = lineColorVar(d.color);
                  const path = lineSvgPath(d);
                  const mid = lineMidPoint(d);
                  return (
                    <g key={it.id}>
                      {/* Fat invisible hit area for easy select/drag */}
                      <path
                        d={path}
                        stroke="transparent"
                        strokeWidth={Math.max(14, d.weight + 12)}
                        fill="none"
                        style={{ pointerEvents: "stroke", cursor: "move" }}
                        onPointerDown={(e) => startLineDrag(e, it, "move")}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLine(it.id);
                        }}
                      />
                      <path
                        d={path}
                        stroke={stroke}
                        strokeWidth={d.weight}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={d.dashed ? `${d.weight * 2.5} ${d.weight * 2.5}` : undefined}
                        markerStart={d.startArrow ? "url(#ln-start)" : undefined}
                        markerEnd={d.endArrow ? "url(#ln-end)" : undefined}
                        style={{ pointerEvents: "none" }}
                      />
                      {d.label && (
                        <g style={{ pointerEvents: "none" }}>
                          <rect x={mid.x - d.label.length * 3.4 - 6} y={mid.y - 10} width={d.label.length * 6.8 + 12} height={20} rx={5} fill="var(--surface)" stroke="var(--border)" />
                          <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">
                            {d.label}
                          </text>
                        </g>
                      )}
                      {sel && (
                        <>
                          {/* Bend handle at the curve midpoint */}
                          <circle
                            cx={mid.x}
                            cy={mid.y}
                            r={5.5}
                            fill="var(--accent)"
                            stroke="white"
                            strokeWidth={2}
                            style={{ pointerEvents: "auto", cursor: "grab" }}
                            onPointerDown={(e) => startLineDrag(e, it, "mid")}
                          />
                          <circle cx={d.ax} cy={d.ay} r={6} fill="white" stroke="var(--accent)" strokeWidth={2} style={{ pointerEvents: "auto", cursor: "grab" }} onPointerDown={(e) => startLineDrag(e, it, "a")} />
                          <circle cx={d.bx} cy={d.by} r={6} fill="white" stroke="var(--accent)" strokeWidth={2} style={{ pointerEvents: "auto", cursor: "grab" }} onPointerDown={(e) => startLineDrag(e, it, "b")} />
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Resize handles: VISIBLE squares on all four corners of the
                hovered or selected card. The old affordance was one invisible
                16px hotspot in the bottom-right, which the operator called
                "almost impossible to find" (and the connect anchor sat right
                next to it on a short card). The invisible per-card hotspot
                stays as an extra hit area; these are the discoverable ones. */}
            {(() => {
              if (readOnly || connectFrom) return null;
              const id = hovered ?? selected;
              const it = id ? byId.get(id) : null;
              // Lines drag by their endpoints, and a column child is not
              // absolutely positioned, so neither gets corner handles.
              if (!it || it.kind === "line" || it.parentId) return null;
              const corners: {
                c: ResizeCorner;
                x: number;
                y: number;
                cursor: string;
              }[] = [
                { c: "nw", x: it.x, y: it.y, cursor: "nwse-resize" },
                { c: "ne", x: it.x + it.w, y: it.y, cursor: "nesw-resize" },
                { c: "sw", x: it.x, y: it.y + it.h, cursor: "nesw-resize" },
                { c: "se", x: it.x + it.w, y: it.y + it.h, cursor: "nwse-resize" },
              ];
              return (
                <span key="handles">
                  {/* A hairline box joining the four handles, so they read as
                      one resizable frame rather than four loose dots. A
                      SELECTED card already carries its own accent ring, so
                      this only draws on hover. */}
                  {id !== selected && (
                    <span
                      className="pointer-events-none absolute rounded-[10px]"
                      style={{
                        left: it.x,
                        top: it.y,
                        width: it.w,
                        height: it.h,
                        zIndex: 9998,
                        boxShadow: "0 0 0 1.5px var(--accent)",
                        opacity: 0.55,
                      }}
                    />
                  )}
                  {corners.map((k) => (
                    <span
                      key={k.c}
                      data-resize="1"
                      title="Drag to resize"
                      onPointerDown={(e) => startResize(e, it, k.c)}
                      onPointerMove={(e) => e.stopPropagation()}
                      // Keeps the handle alive while the pointer crosses from
                      // the card onto the handle itself (the card's leave
                      // fires first).
                      onPointerEnter={() => setHovered(it.id)}
                      style={{
                        position: "absolute",
                        left: k.x - 8,
                        top: k.y - 8,
                        zIndex: 9999,
                        touchAction: "none",
                        cursor: k.cursor,
                      }}
                      // Filled accent on a white collar, the same treatment the
                      // connect anchor already uses: an outlined handle in the
                      // card's own colours was too easy to miss, which is how
                      // resizing stayed hidden in the first place.
                      className="h-4 w-4 rounded-[5px] border-2 border-white bg-accent shadow-md transition hover:scale-125"
                    />
                  ))}
                </span>
              );
            })()}

            {/* Connect handle: appears on the hovered or selected card; drag it
                onto another card to draw an arrow. */}
            {(() => {
              const anchorId = connectFrom ? null : hovered ?? selected;
              const sel = anchorId ? byId.get(anchorId) : null;
              if (!sel) return null;
              return (
                <button
                  title="Drag to connect to another card"
                  onPointerDown={(e) => startConnect(e, sel)}
                  onPointerMove={(e) => e.stopPropagation()}
                  onPointerEnter={() => setHovered(sel.id)}
                  style={{
                    position: "absolute",
                    left: sel.x + sel.w - 11,
                    top: sel.y + sel.h / 2 - 11,
                    zIndex: 9999,
                    touchAction: "none",
                  }}
                  className="group/anchor grid h-[22px] w-[22px] cursor-crosshair place-items-center rounded-full border-2 border-white bg-accent text-white shadow-md transition hover:scale-110"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
                    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
                  </svg>
                  <span className="pointer-events-none absolute left-full ml-1.5 hidden whitespace-nowrap rounded-[6px] bg-text px-1.5 py-0.5 text-[10px] font-semibold text-bg group-hover/anchor:block">
                    Drag to connect
                  </span>
                </button>
              );
            })()}

            {/* Delete control for the selected connection */}
            {selectedConn &&
              (() => {
                const s = connSegments.find((x) => x.id === selectedConn);
                if (!s) return null;
                return (
                  <button
                    onClick={() => deleteConn(selectedConn)}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Delete connection"
                    style={{
                      position: "absolute",
                      left: s.mid.x - 11,
                      top: s.mid.y - 11,
                      zIndex: 9998,
                    }}
                    className="grid h-[22px] w-[22px] place-items-center rounded-full border border-border bg-surface text-red shadow-md hover:bg-red-bg"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                );
              })()}
            {hint &&
              (() => {
                const it = items.find((i) => i.id === hint.itemId);
                const info = HINT_TEXT[hint.kind];
                if (!it || !info) return null;
                let left: number;
                let top: number;
                if (it.kind === "line") {
                  const d = parseLineData(it.text);
                  left = Math.max(d.ax, d.bx) + 16;
                  top = (d.ay + d.by) / 2 - 20;
                } else {
                  left = it.x + (it.w || 220) + 16;
                  top = it.y;
                }
                return (
                  <div
                    style={{
                      position: "absolute",
                      left,
                      top,
                      transform: `scale(${1 / scale})`,
                      transformOrigin: "0 0",
                      zIndex: 9999,
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div
                      className="relative w-[212px] rounded-[12px] p-3 shadow-lg"
                      style={{ background: "var(--text)", color: "var(--surface)" }}
                    >
                      <span
                        className="absolute left-[-4px] top-4 h-2.5 w-2.5 rotate-45"
                        style={{ background: "var(--text)" }}
                      />
                      <button
                        onClick={onDismissHint}
                        aria-label="Dismiss"
                        className="absolute right-2 top-2 opacity-60 transition hover:opacity-100"
                        style={{ color: "var(--surface)" }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                      <p className="mb-1 pr-4 text-[13px] font-bold">{info.title}</p>
                      <p className="text-[12px] leading-snug opacity-90">{info.body}</p>
                      <button
                        onClick={onDismissHint}
                        className="mt-2 text-[11px] font-bold uppercase tracking-wide opacity-70 transition hover:opacity-100"
                      >
                        Got it
                      </button>
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      </div>

      {/* Zoom + present popover */}
      <div className="absolute bottom-3 right-3 z-20">
        {zoomOpen && (
          <>
            <div className="fixed inset-0 z-0" onClick={() => setZoomOpen(false)} />
            <div className="absolute bottom-11 right-0 z-10 w-64 rounded-[14px] border border-border bg-surface p-3 shadow-lg">
              <p className="text-sm font-bold text-text">Zoom</p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                Tip: hold ⌘ / Ctrl and use the mouse wheel to zoom.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button className={zoomBtn} onClick={() => zoomAtCenter(-0.1)} aria-label="Zoom out">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14" /></svg>
                </button>
                <input
                  type="range"
                  min={Math.round(MIN_SCALE * 100)}
                  max={Math.round(MAX_SCALE * 100)}
                  value={Math.round(scale * 100)}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="h-1 flex-1 cursor-pointer accent-accent"
                />
                <button className={zoomBtn} onClick={() => zoomAtCenter(0.1)} aria-label="Zoom in">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </button>
              </div>
              <button
                onClick={() => { scaleToFit(); setZoomOpen(false); }}
                className="mt-2.5 w-full rounded-[9px] border border-border py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
              >
                Scale to fit
              </button>
              <div className="my-3 h-px bg-border" />
              <p className="text-sm font-bold text-text">Presentation mode</p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                Go full-screen and hide the toolbar and dot grid.
              </p>
              <button
                onClick={togglePresent}
                className="mt-2.5 w-full rounded-[9px] bg-text py-2 text-xs font-bold text-bg transition hover:opacity-90"
              >
                {presenting ? "Exit presentation" : "Present"}
              </button>
            </div>
          </>
        )}
        <div className="flex items-center gap-0.5 rounded-[10px] border border-border bg-surface/95 p-1 shadow-sm backdrop-blur">
          <button className={zoomBtn} onClick={() => zoomAtCenter(-0.1)} aria-label="Zoom out">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
          <button
            className="min-w-[3rem] rounded-[8px] px-1 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
            onClick={() => setZoomOpen((o) => !o)}
            title="Zoom and presentation options"
          >
            {Math.round(scale * 100)}%
          </button>
          <button className={zoomBtn} onClick={() => zoomAtCenter(0.1)} aria-label="Zoom in">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>

      {presenting && (
        <button
          onClick={togglePresent}
          className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-[10px] border border-border bg-surface/95 px-3 py-1.5 text-xs font-semibold text-text-muted shadow-sm backdrop-blur transition hover:text-text"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          Exit (Esc)
        </button>
      )}

      {dropActive && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[14px] bg-accent-soft/40">
          <span className="rounded-pill bg-surface px-4 py-2 text-sm font-semibold text-accent shadow">
            Drop here to add
          </span>
        </div>
      )}
    </div>
  );
}

// Rich-text body for a note card (contentEditable storing HTML). Seeded once on
// mount; saves HTML on blur. Formatting is applied from the Note style panel via
// document.execCommand while this stays focused.
function NoteBody({
  itemId,
  initial,
  color,
  onFocus,
  onSave,
  editable = true,
}: {
  itemId: string;
  initial: string;
  color: string;
  onFocus: () => void;
  onSave: (html: string) => void;
  editable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initial || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);
  return (
    <div
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      onFocus={onFocus}
      onBlur={() => onSave(ref.current?.innerHTML ?? "")}
      data-placeholder="Note…"
      className={`rte min-h-0 w-full flex-1 overflow-auto px-2 pb-2 text-sm outline-none ${editable ? "cursor-text" : ""}`}
      style={{ color }}
    />
  );
}

// Large section-heading text (contentEditable, plain text). Transparent, no
// box. Size / alignment / italic / underline / color arrive as concrete CSS
// from lib/board-heading's headingCss, driven by the Heading panel.
function HeadingBody({
  itemId,
  initial,
  css,
  onFocus,
  onSave,
  editable = true,
}: {
  itemId: string;
  initial: string;
  css: React.CSSProperties;
  onFocus: () => void;
  onSave: (text: string) => void;
  editable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.textContent = initial || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);
  return (
    <div
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      onFocus={onFocus}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => onSave(ref.current?.textContent ?? "")}
      data-placeholder="Heading"
      className={`ce-ph w-full font-extrabold leading-tight tracking-tight outline-none ${editable ? "cursor-text" : ""}`}
      style={css}
    />
  );
}

// Rich-text caption under an image / video card. Formatting is applied from the
// card's panel (which finds this via the card's data-item-id).
function CaptionBody({
  itemId,
  initial,
  onFocus,
  onSave,
  editable = true,
}: {
  itemId: string;
  initial: string;
  onFocus: () => void;
  onSave: (html: string) => void;
  editable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initial || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);
  return (
    <div
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      onFocus={onFocus}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => onSave(ref.current?.innerHTML ?? "")}
      data-placeholder="Add a caption"
      className={`rte w-full px-2.5 py-2 text-[13px] text-text outline-none ${editable ? "cursor-text" : ""}`}
    />
  );
}
