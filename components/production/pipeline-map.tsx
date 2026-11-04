"use client";

// The pipeline map: the whole AI job as a graph you can pan, zoom and
// rearrange. Read only as far as the job's data goes (it organizes, never
// generates); the only thing it writes is WHERE things sit, through
// onPositionsChange, so a page can keep that wherever it likes.
//
// Interaction:
//   drag empty canvas  pan          wheel / pinch   zoom under the pointer
//   drag a node        move it      drag a shot     moves its whole lane
//   alt-drag a shot    the shot alone
//   click a node       light up everything it came from and everything it fed

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildMap,
  edgeHue,
  edgeLabel,
  lineage,
  withPositions,
  type MapEdge,
  type MapInput,
  type MapNode,
  type MapPositions,
} from "@/lib/pipeline-map";

export type PipelineMapProps = {
  input: MapInput;
  /** Signed thumbnail per generation id (resized copy preferred). */
  thumbs: Record<string, string>;
  /** Playable URL per video generation id, drawn as its first frame. */
  videos?: Record<string, string>;
  /** Signed sheet image per element id, if any. */
  elementThumbs?: Record<string, string>;
  cutThumb?: string | null;
  positions: MapPositions;
  onPositionsChange: (next: MapPositions) => void;
  /** Jump to a shot's cockpit in the pipeline. */
  onOpenShot?: (shotId: string) => void;
  /**
   * Make a new candidate on Higgsfield from a node. Absent when the viewer has
   * no Higgsfield connection or cannot edit, so the buttons simply do not show.
   */
  onGenerate?: (ask: GenerateAsk) => void;
  heightClass?: string;
};

/**
 * What a press on the map asks for. The page turns it into the window's
 * request, since only the page knows prompts, thumbnails and elements.
 *   take   a video take, starting from `fromGenId` (a still) when given
 *   again  another candidate like `fromGenId`, same prompt and inputs
 *   still  a new still for the shot
 */
export type GenerateAsk = {
  mode: "take" | "again" | "still";
  shotId: string;
  fromGenId: string | null;
  /** The words already typed on a stage panel, which win over the saved prompt. */
  prompt?: string;
};

const MIN_Z = 0.2;
const MAX_Z = 2;
// Pictures load only for cards on screen (plus this margin, in map units), so
// a job of a hundred takes holds a screenful of images rather than all of
// them. A phone that held them all ran out of memory and lost the tab.
const MEDIA_MARGIN = 360;
// A <video> is a decoder each, and a phone gets none: a take with no still of
// its own shows its start frame, or a play mark.
const MAX_VIDEOS = 8;

export function PipelineMap({
  input,
  thumbs,
  videos = {},
  elementThumbs = {},
  cutThumb = null,
  positions,
  onPositionsChange,
  onOpenShot,
  onGenerate,
  heightClass = "h-[calc(100dvh-220px)] min-h-[520px]",
}: PipelineMapProps) {
  const [showRejected, setShowRejected] = useState(false);
  const [showElements, setShowElements] = useState(true);
  const [shotId, setShotId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const auto = useMemo(
    () => buildMap(input, { showRejected, showElements, shotId }),
    [input, showRejected, showElements, shotId]
  );

  // Live drag positions sit over the saved ones so a drag paints every frame
  // without telling the page about each pixel; the page hears once, on release.
  const [live, setLive] = useState<MapPositions | null>(null);
  const graph = useMemo(() => withPositions(auto, { ...positions, ...(live ?? {}) }), [auto, positions, live]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const lit = useMemo(() => (selected && byId.has(selected) ? lineage(selected, graph.edges) : null), [selected, byId, graph.edges]);

  // ---------------------------------------------------------------- view --
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 0.8 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    try {
      setCoarse(window.matchMedia("(pointer: coarse)").matches);
    } catch {}
  }, []);
  // The visible part of the map, in map units, with a margin either side.
  const seen = {
    l: -view.x / view.z - MEDIA_MARGIN,
    t: -view.y / view.z - MEDIA_MARGIN,
    r: (stageSize.w - view.x) / view.z + MEDIA_MARGIN,
    b: (stageSize.h - view.y) / view.z + MEDIA_MARGIN,
  };
  const onScreen = (n: MapNode) =>
    stageSize.w > 0 && n.x + n.w >= seen.l && n.x <= seen.r && n.y + n.h >= seen.t && n.y <= seen.b;

  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const g = graph;
    // Fit the WIDTH and start at the top. A long job fitted to height ends up
    // at 30%, where nothing is readable; scrolling down a job is fine.
    const whole = Math.min((r.width - 40) / g.width, (r.height - 40) / g.height);
    const z = Math.max(MIN_Z, Math.min(1, whole >= 0.6 ? whole : Math.max(0.6, (r.width - 40) / g.width)));
    const x = Math.max(20, (r.width - g.width * z) / 2);
    const y = g.height * z < r.height - 40 ? (r.height - g.height * z) / 2 : 20;
    setView({ z, x, y });
  }, [graph]);

  // Fit once when the map first has something in it.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !graph.nodes.length) return;
    fitted.current = true;
    fit();
  }, [graph.nodes.length, fit]);

  // Wheel must be non-passive or a trackpad pinch zooms the whole page.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const v = viewRef.current;
      // Pinch (ctrlKey) and a mouse wheel zoom; a plain two-finger scroll pans.
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (e.ctrlKey || (Math.abs(dy) >= 50 && e.deltaX === 0)) {
        const factor = Math.abs(dy) >= 50 ? (dy > 0 ? 1 / 1.2 : 1.2) : Math.exp(-dy * 0.01);
        const z = Math.max(MIN_Z, Math.min(MAX_Z, v.z * factor));
        if (z === v.z) return;
        setView({ z, x: px - ((px - v.x) / v.z) * z, y: py - ((py - v.y) / v.z) * z });
      } else {
        setView({ ...v, x: v.x - e.deltaX, y: v.y - dy });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (f: number) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const v = viewRef.current;
    const z = Math.max(MIN_Z, Math.min(MAX_Z, v.z * f));
    const cx = r.width / 2;
    const cy = r.height / 2;
    setView({ z, x: cx - ((cx - v.x) / v.z) * z, y: cy - ((cy - v.y) / v.z) * z });
  };

  // ------------------------------------------------------------- dragging --
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<
    | { kind: "pinch"; d0: number; z0: number; mx: number; my: number; vx: number; vy: number }
    | { kind: "pan"; sx: number; sy: number; vx: number; vy: number; moved: boolean }
    | { kind: "node"; sx: number; sy: number; ids: string[]; start: MapPositions; moved: boolean; clicked: string }
    | null
  >(null);

  // Every finger is tracked before a card sees it, so a second finger turns
  // whatever the first one started into a pinch.
  const onStageDownCapture = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size !== 2) return;
    e.stopPropagation();
    const el = stageRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const [a, b] = [...pointers.current.values()];
    const r = el.getBoundingClientRect();
    const v = viewRef.current;
    setLive(null);
    drag.current = {
      kind: "pinch",
      d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      z0: v.z,
      mx: (a.x + b.x) / 2 - r.left,
      my: (a.y + b.y) / 2 - r.top,
      vx: v.x,
      vy: v.y,
    };
  };

  const onStageDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onNodeDown = (e: React.PointerEvent, n: MapNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // A shot carries its lane, so rearranging the job is moving shots, not
    // forty thumbnails one at a time. Alt moves the shot alone.
    const ids =
      n.type === "shot" && !e.altKey
        ? graph.nodes.filter((m) => m.id === n.id || (m.shotId === n.shotId && m.type !== "shot" && m.type !== "element")).map((m) => m.id)
        : [n.id];
    const start: MapPositions = {};
    for (const id of ids) {
      const m = byId.get(id);
      if (m) start[id] = { x: m.x, y: m.y };
    }
    drag.current = { kind: "node", sx: e.clientX, sy: e.clientY, ids, start, moved: false, clicked: n.id };
    stageRef.current?.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pinch") {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts;
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const z = Math.max(MIN_Z, Math.min(MAX_Z, d.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / d.d0)));
      const mx = (a.x + b.x) / 2 - r.left;
      const my = (a.y + b.y) / 2 - r.top;
      // The point under the fingers stays under them, and moving both pans.
      setView({ z, x: mx - ((d.mx - d.vx) / d.z0) * z, y: my - ((d.my - d.vy) / d.z0) * z });
      return;
    }
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    d.moved = true;
    if (d.kind === "pan") {
      setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
    } else {
      const z = viewRef.current.z;
      const next: MapPositions = {};
      for (const id of d.ids) next[id] = { x: Math.round(d.start[id].x + dx / z), y: Math.round(d.start[id].y + dy / z) };
      setLive(next);
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d?.kind === "pinch") {
      // Lifting one finger ends the pinch; the other does nothing until lifted.
      if (pointers.current.size === 0) drag.current = null;
      return;
    }
    drag.current = null;
    if (!d) return;
    if (d.kind === "pan") {
      if (!d.moved) setSelected(null);
      return;
    }
    if (!d.moved) {
      setSelected((cur) => (cur === d.clicked ? null : d.clicked));
      setLive(null);
      return;
    }
    if (live) onPositionsChange({ ...positions, ...live });
    setLive(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const arranged = Object.keys(positions).some((k) => byId.has(k));
  const sel = selected ? byId.get(selected) ?? null : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={shotId ?? ""}
          onChange={(e) => {
            setShotId(e.target.value || null);
            fitted.current = false;
          }}
          className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-text"
        >
          <option value="">All shots</option>
          {[...input.shots].sort((a, b) => a.position - b.position).map((s) => (
            <option key={s.id} value={s.id}>
              {s.position + 1}. {s.title || "Untitled shot"}
            </option>
          ))}
        </select>
        <Toggle on={showElements} onChange={setShowElements}>Elements</Toggle>
        <Toggle on={showRejected} onChange={setShowRejected}>
          Rejected{!showRejected && auto.hiddenRejected ? ` (${auto.hiddenRejected} hidden)` : ""}
        </Toggle>
        <div className="ml-auto flex items-center gap-1">
          {arranged && (
            <button
              type="button"
              onClick={() => {
                onPositionsChange({});
                fitted.current = false;
              }}
              className="h-8 rounded-md border border-border bg-surface px-2.5 text-text-muted hover:text-text"
              title="Put everything back in its automatic place"
            >
              Tidy up
            </button>
          )}
          <button type="button" onClick={() => zoomBy(1 / 1.2)} className="h-8 w-8 rounded-md border border-border bg-surface text-text-muted hover:text-text" aria-label="Zoom out">
            -
          </button>
          <button type="button" onClick={fit} className="h-8 min-w-[56px] rounded-md border border-border bg-surface px-2 tabular-nums text-text-muted hover:text-text" title="Fit everything">
            {Math.round(view.z * 100)}%
          </button>
          <button type="button" onClick={() => zoomBy(1.2)} className="h-8 w-8 rounded-md border border-border bg-surface text-text-muted hover:text-text" aria-label="Zoom in">
            +
          </button>
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-xl border border-border bg-surface-2 ${heightClass}`}>
        {/* Column heads, fixed to the top of the stage, scrolled with the view */}
        <div
          ref={stageRef}
          className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
          style={{
            backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)",
            backgroundSize: `${20 * view.z}px ${20 * view.z}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
          onPointerDownCapture={onStageDownCapture}
          onPointerDown={onStageDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, width: graph.width, height: graph.height }}
          >
            <Edges edges={graph.edges} byId={byId} lit={lit?.edges ?? null} />
            {(() => {
              let videoSlots = coarse ? 0 : MAX_VIDEOS;
              return graph.nodes.map((n) => {
                const visible = onScreen(n);
                const thumb = visible ? thumbFor(n, thumbs, elementThumbs, cutThumb) : null;
                let video: string | null = null;
                if (visible && !thumb && videoSlots > 0 && n.id.startsWith("gen:")) {
                  video = videos[n.id.slice(4)] ?? null;
                  if (video) videoSlots -= 1;
                }
                return (
                  <NodeCard
                    key={n.id}
                    node={n}
                    thumb={thumb}
                    video={video}
                    selected={selected === n.id}
                    dim={!!lit && !lit.nodes.has(n.id)}
                    onPointerDown={(e) => onNodeDown(e, n)}
                  />
                );
              });
            })()}
          </div>
        </div>

        {!graph.nodes.length && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center text-sm text-text-muted">
            Nothing on the pipeline yet. Add a shot and its references, images and takes appear here.
          </div>
        )}

        <Legend />

        {sel && <Detail node={sel} edges={graph.edges} byId={byId} onOpenShot={onOpenShot} onGenerate={onGenerate} onClose={() => setSelected(null)} />}
      </div>
      <p className="text-xs text-text-faint">
        Drag to pan, pinch or scroll to zoom. Drag a shot to move its whole row (hold Alt to move the shot alone). Click anything to trace where it came from and what it fed.
      </p>
    </div>
  );
}

function thumbFor(n: MapNode, thumbs: Record<string, string>, el: Record<string, string>, cut: string | null): string | null {
  if (n.id.startsWith("gen:")) return thumbs[n.id.slice(4)] ?? null;
  if (n.id.startsWith("el:")) return el[n.id.slice(3)] ?? null;
  if (n.type === "cut") return cut;
  return null;
}

function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 ${
        on ? "border-accent bg-accent-soft text-text" : "border-border bg-surface text-text-muted hover:text-text"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-accent" : "bg-border-strong"}`} />
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ edges --

function Edges({ edges, byId, lit }: { edges: MapEdge[]; byId: Map<string, MapNode>; lit: Set<string> | null }) {
  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" width="100%" height="100%">
      <defs>
        <marker id="pm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
        </marker>
      </defs>
      {edges.map((e) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        // Leave from the right edge, arrive on the left; if a node was dragged
        // behind its source, run the other way so the curve does not loop.
        const forward = b.x >= a.x + a.w / 2;
        const x1 = forward ? a.x + a.w : a.x;
        const y1 = a.y + a.h / 2;
        const x2 = forward ? b.x : b.x + b.w;
        const y2 = b.y + b.h / 2;
        const bend = Math.max(40, Math.abs(x2 - x1) / 2) * (forward ? 1 : -1);
        const d = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
        const hue = edgeHue(e.role);
        const color = hue ? `var(--h-${hue})` : "var(--border-strong)";
        const on = !lit || lit.has(e.id);
        const label = edgeLabel(e.role);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        return (
          <g key={e.id} opacity={on ? 1 : 0.12}>
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={lit && on ? 2.5 : e.role === "prompt" || e.role === "ref" ? 1.25 : 1.75}
              strokeDasharray={e.role === "prompt" ? "4 4" : undefined}
              markerEnd="url(#pm-arrow)"
            />
            {label && (
              <g transform={`translate(${mx} ${my})`}>
                <rect x={-label.length * 3.4 - 7} y={-9} width={label.length * 6.8 + 14} height={18} rx={9} fill="var(--surface)" stroke={color} />
                <text textAnchor="middle" dominantBaseline="central" fontSize="10.5" fontWeight={600} fill="var(--text)">
                  {label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------ nodes --

const TYPE_WORD: Record<string, string> = {
  element: "Element",
  shot: "Shot",
  image: "Image",
  video: "Video",
  audio: "Voiceover",
  cut: "Master cut",
};

function NodeCard({
  node: n,
  thumb,
  video = null,
  selected,
  dim,
  onPointerDown,
}: {
  node: MapNode;
  thumb: string | null;
  video?: string | null;
  selected: boolean;
  dim: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const media = n.type === "image" || n.type === "video" || n.type === "audio" || n.type === "cut";
  const rejected = n.state?.label === "Rejected";
  return (
    <div
      data-node-id={n.id}
      onPointerDown={onPointerDown}
      className={`absolute cursor-pointer overflow-hidden rounded-lg border bg-surface shadow-sm transition-[opacity,box-shadow] ${
        selected ? "border-accent ring-2 ring-accent" : "border-border hover:border-border-strong hover:shadow-md"
      }`}
      style={{ left: n.x, top: n.y, width: n.w, height: n.h, opacity: dim ? 0.22 : rejected ? 0.6 : 1 }}
    >
      {media ? (
        <div className="flex h-full flex-col">
          <div className="relative min-h-0 flex-1 bg-surface-2">
            {!thumb && video ? (
              // The first frame, not playback: metadata only, so a map of
              // forty takes does not download forty clips.
              <video src={`${video}#t=0.1`} preload="metadata" muted playsInline draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
            ) : thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" draggable={false} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-xs text-text-faint">{TYPE_WORD[n.type]}</div>
            )}
            {(n.type === "video" || n.type === "cut") && (
              <span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[rgba(0,0,0,.55)] text-[9px] text-white">▶</span>
            )}
            {n.starred && (
              <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[rgba(0,0,0,.55)] text-[11px] text-[var(--h-amber)]" title="Shortlisted">
                ★
              </span>
            )}
          </div>
          <div className="px-2 py-1.5">
            <div className="truncate text-[12px] font-semibold text-text">{n.title}</div>
            {n.state && <StateLine state={n.state} />}
          </div>
        </div>
      ) : (
        <div className="flex h-full items-stretch">
          <span className="w-1 shrink-0" style={{ background: n.type === "shot" ? "var(--h-purple)" : "var(--h-cyan)" }} />
          {n.type === "element" && thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" draggable={false} className="my-2 ml-2 h-10 w-10 shrink-0 self-center rounded-md object-cover" />
          )}
          <div className="min-w-0 flex-1 px-2.5 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-text-faint">{TYPE_WORD[n.type]}</div>
            <div className={`font-semibold text-text ${n.type === "shot" ? "line-clamp-2 text-[13px] leading-snug" : "truncate text-[12.5px] leading-snug"}`} title={n.title}>{n.title}</div>
            {n.type === "shot" && n.sub && <div className="truncate text-[11px] text-text-muted">{n.sub}</div>}
            {n.state && n.type === "shot" && <StateLine state={n.state} />}
            {n.type === "element" && <div className="truncate text-[11px] text-text-muted">{n.state?.label}</div>}
            {n.type === "element" && n.sub && <div className="truncate text-[11px] text-text-faint">{n.sub}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// Words in the text colour, hue on the dot: hue-on-tint text fails contrast.
function StateLine({ state }: { state: { label: string; hue: string } }) {
  return (
    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `var(--h-${state.hue})` }} />
      <span className="truncate">{state.label}</span>
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["Start", "green"],
    ["End", "blue"],
    ["Motion", "orange"],
    ["Style", "purple"],
    ["Character", "pink"],
    ["Uses", "cyan"],
    ["Into the cut", "indigo"],
  ];
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 hidden flex-wrap gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-text-muted shadow-sm sm:flex">
      {items.map(([l, h]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: `var(--h-${h})` }} />
          {l}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0 w-4 border-t border-dashed border-border-strong" />
        From the prompt
      </span>
    </div>
  );
}

function Detail({
  node: n,
  edges,
  byId,
  onOpenShot,
  onGenerate,
  onClose,
}: {
  node: MapNode;
  edges: MapEdge[];
  byId: Map<string, MapNode>;
  onOpenShot?: (shotId: string) => void;
  onGenerate?: (ask: GenerateAsk) => void;
  onClose: () => void;
}) {
  const genId = n.id.startsWith("gen:") ? n.id.slice(4) : null;
  const rejected = n.state?.label === "Rejected";
  const asks: { label: string; ask: GenerateAsk }[] = [];
  if (onGenerate && n.shotId && !rejected) {
    if (n.type === "shot") {
      asks.push({ label: "Generate a still", ask: { mode: "still", shotId: n.shotId, fromGenId: null } });
      asks.push({ label: "Generate a video take", ask: { mode: "take", shotId: n.shotId, fromGenId: null } });
    } else if (n.type === "image" && genId) {
      asks.push({ label: "Make a video take from this", ask: { mode: "take", shotId: n.shotId, fromGenId: genId } });
      asks.push({ label: "Another still like this", ask: { mode: "again", shotId: n.shotId, fromGenId: genId } });
    } else if (n.type === "video" && genId) {
      asks.push({ label: "Another take like this", ask: { mode: "again", shotId: n.shotId, fromGenId: genId } });
    }
  }
  const ins = edges.filter((e) => e.to === n.id).map((e) => ({ e, node: byId.get(e.from) })).filter((x) => x.node);
  const outs = edges.filter((e) => e.from === n.id).map((e) => ({ e, node: byId.get(e.to) })).filter((x) => x.node);
  return (
    <div
      className="absolute right-3 top-3 max-h-[calc(100%-24px)] w-[280px] max-w-[calc(100%-24px)] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-lg"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-faint">{TYPE_WORD[n.type]}</div>
          <div className="text-sm font-semibold text-text">{n.title}</div>
          {n.state && <StateLine state={n.state} />}
        </div>
        <button type="button" onClick={onClose} className="-mr-1 -mt-1 rounded p-1 text-text-faint hover:text-text" aria-label="Close">
          ✕
        </button>
      </div>
      {n.sub && n.type !== "shot" && n.type !== "element" && <p className="mt-2 line-clamp-4 text-xs text-text-muted">{n.sub}</p>}
      <Links title="Built from" list={ins} />
      <Links title="Fed into" list={outs} />
      {asks.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="text-[11px] font-semibold text-text-faint">Generate on Higgsfield</div>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {asks.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => onGenerate?.(a.ask)}
                className="inline-flex h-8 items-center justify-between rounded-md border border-border bg-surface px-2.5 text-sm text-text hover:border-border-strong"
              >
                {a.label}
                <span className="text-xs text-text-faint">price first</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {n.shotId && onOpenShot && (
        <button
          type="button"
          onClick={() => onOpenShot(n.shotId as string)}
          className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-fg hover:bg-accent-strong"
        >
          Open in pipeline
        </button>
      )}
    </div>
  );
}

function Links({ title, list }: { title: string; list: { e: MapEdge; node?: MapNode }[] }) {
  if (!list.length) return null;
  return (
    <div className="mt-3">
      <div className="text-[11px] font-semibold text-text-faint">{title}</div>
      <ul className="mt-1 space-y-0.5">
        {list.slice(0, 8).map(({ e, node }) => (
          <li key={e.id} className="flex items-center gap-1.5 text-xs text-text">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: edgeHue(e.role) ? `var(--h-${edgeHue(e.role)})` : "var(--border-strong)" }} />
            <span className="truncate">
              {edgeLabel(e.role) ? `${edgeLabel(e.role)}: ` : ""}
              {node?.title}
            </span>
          </li>
        ))}
        {list.length > 8 && <li className="text-xs text-text-faint">and {list.length - 8} more</li>}
      </ul>
    </div>
  );
}
