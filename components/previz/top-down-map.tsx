"use client";

// The live top-down map in the corner of the Scene Setup prototype: the room's
// walls with their windows and doors, every item on the set at its real
// footprint, the people and where they walk to, the cameras with their field
// of view and what they stand on, and the lights and boards. Everything on it
// drags, and a selected item turns from its white handle. It is the gaffer's
// lighting diagram, generated rather than drawn.
import { useEffect, useRef, useState } from "react";
import { BODIES, fovDeg, imagedArea } from "@/lib/previz/optics";
import { bodyDrop, supportFootprint, type SupportOpts } from "@/lib/previz/camera-model";
import { FIXTURES, FT, lightOutput, resolveSource } from "@/lib/previz/lighting";
import type { GripSpec, LightSpec } from "@/lib/previz/light-build";
import type { TalentSpec } from "@/lib/previz/scene-build";
import { catalogOf, footprint, type ItemSpec } from "@/lib/previz/catalog";
import { isRig, rigPipes } from "@/lib/previz/rigging";
import { WALLS, clampOpening, wallLength, type RoomSpec, type SetSpec, type WallId } from "@/lib/previz/room";
import type { Shot, Vec3 } from "./setup";

export const SHOT_HUES = ["#6b7cff", "#e0884f", "#3fb68b", "#c26be0", "#d6b03a", "#3bb2d0"];
const rad = (d: number) => (d * Math.PI) / 180;

export type MapPick =
  | { kind: "camera" | "talent" | "light" | "grip" | "item" | "mark"; id: string }
  | { kind: "daylight" | "room" };

type Selected = { kind: string; id?: string };

type Bounds = { x0: number; x1: number; z0: number; z1: number };

/** The area worth showing: the room or the stage, and everything on it. */
function sceneBounds(set: SetSpec, pts: { x: number; z: number }[]): Bounds {
  const b: Bounds = set.kind === "room"
    ? { x0: set.room.x, x1: set.room.x + set.room.width, z0: set.room.z, z1: set.room.z + set.room.depth }
    : { x0: -4, x1: 4, z0: -2.5, z1: 4.8 };
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    b.x0 = Math.min(b.x0, p.x);
    b.x1 = Math.max(b.x1, p.x);
    b.z0 = Math.min(b.z0, p.z);
    b.z1 = Math.max(b.z1, p.z);
  }
  const pad = 0.6;
  return { x0: b.x0 - pad, x1: b.x1 + pad, z0: b.z0 - pad, z1: b.z1 + pad };
}

/** A wall's ends in world x/z, inside face. */
function wallEnds(r: RoomSpec, w: WallId) {
  const x0 = r.x, x1 = r.x + r.width, z0 = r.z, z1 = r.z + r.depth;
  if (w === "back") return { a: { x: x0, z: z0 }, b: { x: x1, z: z0 } };
  if (w === "front") return { a: { x: x0, z: z1 }, b: { x: x1, z: z1 } };
  if (w === "left") return { a: { x: x0, z: z0 }, b: { x: x0, z: z1 } };
  return { a: { x: x1, z: z0 }, b: { x: x1, z: z1 } };
}

export function TopDownMap({
  talent, items, shots, rawShots, activeId, aspectRatio, set, winOn, lights, grips, selected,
  supportOf, aimOfLight, effLight,
  onTalent, onMark, onItem, onItemRot, onCamera, onAim, onRigYaw, onRobotBase, onLight, onLightAim, onGrip, onGripAim, onPick,
}: {
  talent: TalentSpec[];
  items: ItemSpec[];
  shots: Shot[];
  rawShots: Shot[];
  activeId: string;
  aspectRatio: number;
  set: SetSpec;
  winOn: boolean;
  lights: LightSpec[];
  grips: GripSpec[];
  selected: Selected;
  supportOf: (s: Shot, at: Vec3) => { yaw: number; opts: SupportOpts };
  aimOfLight: (p: LightSpec | GripSpec) => { yaw: number; pitch: number };
  effLight: (l: LightSpec) => LightSpec;
  onTalent: (id: string, x: number, z: number) => void;
  onMark: (id: string, x: number, z: number) => void;
  onItem: (id: string, x: number, z: number) => void;
  onItemRot: (id: string, rot: number) => void;
  /** `together`: shift held, so a motion control arm's base moves with the camera. */
  onCamera: (id: string, x: number, z: number, together?: boolean) => void;
  onAim: (id: string, yaw: number) => void;
  /** Turns a Dana or Fisher track without panning the head. */
  onRigYaw: (id: string, yaw: number) => void;
  /** Puts a motion control arm's base at a point on the floor. */
  onRobotBase: (id: string, x: number, z: number) => void;
  onLight: (id: string, x: number, z: number) => void;
  onLightAim: (id: string, yaw: number) => void;
  onGrip: (id: string, x: number, z: number) => void;
  onGripAim: (id: string, yaw: number) => void;
  onPick: (p: MapPick) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Drawn after mount only: the geometry is computed with trig whose last
  // digit differs between the server and the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [size, setSize] = useState<"min" | "small" | "big">("small");
  // Where the panel sits, how see-through it is, and the room it has. The
  // position is an offset from the stage's bottom-right corner, so it stays in
  // its corner when the window resizes; both are a per-person preference.
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<MapView>(DEFAULT_VIEW);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [self, setSelf] = useState({ w: 0, h: 0 });
  const moveRef = useRef<{ x: number; y: number; r: number; b: number } | null>(null);
  useEffect(() => setView(readView()), []);
  useEffect(() => {
    // The untouched default is never written: on mount it would overwrite the
    // stored position before readView's result had landed.
    if (view === DEFAULT_VIEW) return;
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch { /* private window */ }
  }, [view]);
  useEffect(() => {
    const el = rootRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const ro = new ResizeObserver(() => {
      setStage({ w: parent.clientWidth, h: parent.clientHeight });
      setSelf({ w: el.offsetWidth, h: el.offsetHeight });
    });
    ro.observe(parent);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted]);
  const drag = useRef<(MapPick & { aim?: boolean; rot?: boolean; rig?: boolean; base?: boolean }) | null>(null);
  const grab = useRef({ dx: 0, dz: 0 });
  // The view is held still while something is dragged, so the map does not
  // rescale under the cursor as a thing is pulled toward its edge.
  const frozen = useRef<Bounds | null>(null);

  const live = sceneBounds(set, [
    ...items.flatMap((i) => footprint(i)),
    ...talent.flatMap((t) => [t, ...(t.mark ? [t.mark] : [])]),
    ...shots.map((s) => ({ x: s.pos.x, z: s.pos.z })),
    ...lights, ...grips,
  ]);
  const B = frozen.current ?? live;

  const toWorld = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const w = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.max(B.x0 - 2, Math.min(B.x1 + 2, w.x)), z: Math.max(B.z0 - 2, Math.min(B.z1 + 2, w.y)) };
  };
  const start = (p: MapPick & { aim?: boolean; rot?: boolean; rig?: boolean; base?: boolean }, anchor?: { x: number; z: number }) => (e: React.PointerEvent) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    frozen.current = live;
    if (anchor) {
      const w = toWorld(e);
      grab.current = { dx: anchor.x - w.x, dz: anchor.z - w.z };
    } else grab.current = { dx: 0, dz: 0 };
    drag.current = p;
    onPick(p);
  };
  const end = () => {
    drag.current = null;
    frozen.current = null;
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.kind === "daylight" || d.kind === "room") return;
    const w = toWorld(e);
    const yawTo = (px: number, pz: number) => (Math.atan2(-(w.x - px), -(w.z - pz)) * 180) / Math.PI;
    const gx = w.x + grab.current.dx;
    const gz = w.z + grab.current.dz;
    if (d.kind === "item") {
      const it = items.find((x) => x.id === d.id);
      if (it && d.rot) onItemRot(d.id, Math.round((Math.atan2(w.x - it.x, w.z - it.z) * 180) / Math.PI));
      else onItem(d.id, gx, gz);
    } else if (d.kind === "talent") onTalent(d.id, gx, gz);
    else if (d.kind === "mark") onMark(d.id, gx, gz);
    else if (d.kind === "light") {
      const l = lights.find((x) => x.id === d.id);
      if (l && d.aim) onLightAim(d.id, yawTo(l.x, l.z));
      else onLight(d.id, gx, gz);
    } else if (d.kind === "grip") {
      const g = grips.find((x) => x.id === d.id);
      if (g && d.aim) onGripAim(d.id, yawTo(g.x, g.z));
      else onGrip(d.id, gx, gz);
    } else if (d.kind === "camera" && d.rig) {
      const s = shots.find((x) => x.id === d.id);
      if (s) {
        // Settles onto the lens, or onto the room's square, when close.
        let y = yawTo(s.pos.x, s.pos.z);
        const near = (a: number) => Math.abs(((((y - a) % 360) + 540) % 360) - 180) < 4;
        if (near(s.yaw)) y = s.yaw;
        else for (const q of [-180, -90, 0, 90, 180]) if (near(q)) y = q;
        onRigYaw(d.id, y);
      }
    } else if (d.kind === "camera" && d.base) onRobotBase(d.id, gx, gz);
    else if (d.kind === "camera" && d.aim) {
      const s = shots.find((x) => x.id === d.id);
      if (s) onAim(d.id, yawTo(s.pos.x, s.pos.z));
    } else if (d.kind === "camera") onCamera(d.id, gx, gz, e.shiftKey);
  };

  // Kept inside the stage whatever its size: an offset that would push the
  // panel past an edge is pulled back, so it can never be dragged or grown out
  // of reach.
  const clampR = (r: number) => Math.max(MARGIN, Math.min(r, stage.w - self.w - MARGIN));
  const clampB = (b: number) => Math.max(MARGIN, Math.min(b, stage.h - self.h - MARGIN));
  const right = stage.w ? clampR(view.r) : view.r;
  const bottom = stage.h ? clampB(view.b) : view.b;
  const startMove = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    moveRef.current = { x: e.clientX, y: e.clientY, r: right, b: bottom };
  };
  const doMove = (e: React.PointerEvent) => {
    const m = moveRef.current;
    if (!m) return;
    setView((v) => ({ ...v, r: clampR(m.r - (e.clientX - m.x)), b: clampB(m.b - (e.clientY - m.y)) }));
  };
  const endMove = () => { moveRef.current = null; };
  // The width and the drawing's height both yield to the stage, so "Bigger"
  // is as big as fits rather than a fixed size that runs off the top.
  const wantW = size === "big" ? 460 : size === "small" ? 230 : 150;
  const panelW = stage.w ? Math.max(150, Math.min(wantW, stage.w - 2 * MARGIN)) : wantW;
  const chrome = 26 + (size === "big" ? 22 : 0);
  const wantH = size === "big" ? 560 : 300;
  const svgMaxH = stage.h ? Math.max(80, Math.min(wantH, stage.h - 2 * MARGIN - chrome)) : wantH;

  if (!mounted) return null;
  const W = B.x1 - B.x0;
  const H = B.z1 - B.z0;
  // Text and strokes scale with the map, so a 20 metre warehouse reads as
  // well as a 4 metre kitchen.
  const k = Math.max(1, Math.max(W, H) / 9);
  const isSel = (kind: string, id?: string) => selected.kind === kind && (id === undefined || selected.id === id);
  const room = set.kind === "room" ? set.room : null;
  const sortedItems = [...items].sort((a, b) => b.w * b.d - a.w * a.d);

  return (
    <div
      ref={rootRef}
      data-previz-map
      className="absolute z-30 overflow-hidden rounded-[12px] border border-white/10 shadow-lg"
      style={{ right, bottom, width: panelW }}
    >
      <div
        title="Drag to move the map. Double-click to put it back in the corner."
        onPointerDown={startMove}
        onPointerMove={doMove}
        onPointerUp={endMove}
        onPointerCancel={endMove}
        onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest("button, input")) setView((v) => ({ ...v, r: MARGIN, b: MARGIN })); }}
        className="flex cursor-move touch-none select-none items-center justify-between gap-2 bg-black/85 px-2.5 py-1 text-[11px] font-semibold text-white/90"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <GripDots />
          <span className="truncate">{size === "big" ? "Top-down map" : "Map"}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {size !== "min" ? (
            <label className="flex items-center gap-1 text-white/70" title={`Map opacity, ${Math.round(view.opacity * 100)}%`}>
              <OpacityIcon />
              <input
                aria-label="Map opacity"
                type="range" min={0.2} max={1} step={0.05} value={view.opacity}
                onChange={(e) => setView((v) => ({ ...v, opacity: Number(e.target.value) }))}
                className="h-1 w-14 cursor-pointer accent-white"
              />
            </label>
          ) : null}
          {size !== "min" ? (
            <button type="button" onClick={() => setSize(size === "big" ? "small" : "big")} className="text-white/70 hover:text-white">
              {size === "big" ? "Smaller" : "Bigger"}
            </button>
          ) : null}
          <button type="button" onClick={() => setSize(size === "min" ? "small" : "min")} className="text-white/70 hover:text-white">
            {size === "min" ? "Show" : "Hide"}
          </button>
        </span>
      </div>
      <div style={{ opacity: view.opacity, background: "#f4f1ea" }}>
      <svg
        style={{ display: size === "min" ? "none" : undefined, maxHeight: svgMaxH }}
        ref={svgRef}
        viewBox={`${B.x0} ${B.z0} ${W} ${H}`}
        className="mx-auto block w-full touch-none select-none"
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* floor grid, one metre */}
        {Array.from({ length: Math.ceil(W) + 1 }, (_, i) => {
          const x = Math.floor(B.x0) + i;
          return <line key={`gx${i}`} x1={x} y1={B.z0} x2={x} y2={B.z1} stroke="#d9d3c6" strokeWidth={0.015 * k} />;
        })}
        {Array.from({ length: Math.ceil(H) + 1 }, (_, i) => {
          const z = Math.floor(B.z0) + i;
          return <line key={`gz${i}`} x1={B.x0} y1={z} x2={B.x1} y2={z} stroke="#d9d3c6" strokeWidth={0.015 * k} />;
        })}

        {/* the room: walls, windows and doors */}
        {room ? (
          <g>
            <rect
              x={room.x} y={room.z} width={room.width} height={room.depth}
              fill="#ece6da" stroke="none" className="cursor-pointer"
              onPointerDown={(e) => { e.stopPropagation(); onPick({ kind: "room" }); }}
            />
            {WALLS.filter((w) => room.walls[w.id]).map(({ id: w }) => {
              const { a, b } = wallEnds(room, w);
              const L = wallLength(room, w);
              const dir = { x: (b.x - a.x) / L, z: (b.z - a.z) / L };
              return (
                <g key={w} className="cursor-pointer" onPointerDown={(e) => { e.stopPropagation(); onPick({ kind: "room" }); }}>
                  <line x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke={isSel("room") ? "#1d1d1f" : "#5a5148"} strokeWidth={0.12 * k} strokeLinecap="square" />
                  {room.openings.filter((o) => o.wall === w).map((raw) => {
                    const o = clampOpening(room, raw);
                    const p0 = { x: a.x + dir.x * (o.at - o.width / 2), z: a.z + dir.z * (o.at - o.width / 2) };
                    const p1 = { x: a.x + dir.x * (o.at + o.width / 2), z: a.z + dir.z * (o.at + o.width / 2) };
                    return o.kind === "window" ? (
                      <line
                        key={o.id} x1={p0.x} y1={p0.z} x2={p1.x} y2={p1.z}
                        stroke={winOn ? "#4f97d8" : "#9aa0a6"} strokeWidth={0.16 * k}
                        onPointerDown={(e) => { e.stopPropagation(); onPick({ kind: "daylight" }); }}
                      />
                    ) : (
                      <line key={o.id} x1={p0.x} y1={p0.z} x2={p1.x} y2={p1.z} stroke="#ece6da" strokeWidth={0.14 * k} />
                    );
                  })}
                </g>
              );
            })}
          </g>
        ) : null}

        {/* items on the set, biggest first so small ones stay on top */}
        {sortedItems.map((it) => {
          const c = catalogOf(it.kind);
          const sel = isSel("item", it.id);
          const small = Math.max(it.w, it.d) < 0.25;
          const stroke = sel ? "#1d1d1f" : "#6f6a60";
          const sw = (sel ? 0.04 : 0.02) * k;
          const lamp = !!it.light;
          if (isRig(it.kind)) {
            // Overhead pipe: drawn as pipe, see-through, so the floor plan
            // under a grid still reads. Only the pipes take a drag.
            const pipes = rigPipes(it);
            const col = it.kind === "spreader" ? "#a87c45" : "#7d848c";
            return (
              <g key={it.id}>
                <g className="cursor-move" onPointerDown={start({ kind: "item", id: it.id }, { x: it.x, z: it.z })}>
                  {pipes.map((p, i) => (
                    <g key={i}>
                      <line x1={p.ax} y1={p.az} x2={p.bx} y2={p.bz} stroke="transparent" strokeWidth={0.22 * k} />
                      <line x1={p.ax} y1={p.az} x2={p.bx} y2={p.bz} stroke={sel ? "#1d1d1f" : col} strokeOpacity={sel ? 0.9 : 0.6} strokeWidth={(it.kind === "grid" ? 0.035 : 0.06) * k} strokeDasharray={it.kind === "grid" ? undefined : `${0.12 * k} ${0.05 * k}`} pointerEvents="none" />
                    </g>
                  ))}
                </g>
                {it.kind !== "grid" ? [pipes[0]].map((p) => (
                  <g key="ends" pointerEvents="none">
                    <rect x={p.ax - 0.06 * k} y={p.az - 0.06 * k} width={0.12 * k} height={0.12 * k} fill="#1c1c1e" />
                    <rect x={p.bx - 0.06 * k} y={p.bz - 0.06 * k} width={0.12 * k} height={0.12 * k} fill="#1c1c1e" />
                  </g>
                )) : null}
                <text x={it.kind === "grid" ? it.x : (pipes[0].ax + pipes[0].bx) / 2} y={(it.kind === "grid" ? it.z - it.d / 2 : (pipes[0].az + pipes[0].bz) / 2) - 0.12 * k} textAnchor="middle" fontSize={0.14 * k} fontWeight={700} fill="#5a5148" pointerEvents="none">
                  {it.name}
                </text>
              </g>
            );
          }
          return (
            <g key={it.id}>
              <g
                transform={`translate(${it.x} ${it.z}) rotate(${-it.rot})`}
                className="cursor-move"
                onPointerDown={start({ kind: "item", id: it.id }, { x: it.x, z: it.z })}
              >
                {small ? (
                  <circle r={Math.max(0.07 * k, it.w / 2)} fill={it.kind === "bottle" ? "#2f6f62" : it.color} stroke="#fff" strokeWidth={0.025 * k} />
                ) : c.round ? (
                  <ellipse rx={it.w / 2} ry={it.d / 2} fill={it.color} fillOpacity={0.85} stroke={stroke} strokeWidth={sw} />
                ) : (
                  <rect x={-it.w / 2} y={-it.d / 2} width={it.w} height={it.d} fill={it.color} fillOpacity={c.category === "backdrop" ? 0.9 : 0.8} stroke={stroke} strokeWidth={sw} />
                )}
                {it.kind === "seamless" || it.kind === "cyc" ? (
                  <line x1={-it.w / 2} y1={-it.d / 2} x2={it.w / 2} y2={-it.d / 2} stroke="#5a5148" strokeWidth={0.08 * k} />
                ) : null}
                {lamp ? <circle r={0.09 * k} fill={it.light?.on ? "#ffd28f" : "#cfcac0"} stroke="#b9891d" strokeWidth={0.02 * k} /> : null}
                {!small && it.d > 0.2 ? (
                  // Which side is the front.
                  <line x1={0} y1={it.d / 2 - 0.12 * Math.min(1, it.d)} x2={0} y2={it.d / 2} stroke={stroke} strokeWidth={0.03 * k} />
                ) : null}
              </g>
              {!small && it.w * it.d > 0.3 ? (
                <text x={it.x} y={it.z + 0.05 * k} textAnchor="middle" fontSize={0.15 * k} fontWeight={700} fill="#4a443b" pointerEvents="none">
                  {it.name}
                </text>
              ) : null}
              {sel ? (() => {
                const r = rad(it.rot);
                const reach = it.d / 2 + 0.35 * k;
                const hx = it.x + Math.sin(r) * reach;
                const hz = it.z + Math.cos(r) * reach;
                return (
                  <g>
                    <line x1={it.x} y1={it.z} x2={hx} y2={hz} stroke="#1d1d1f" strokeWidth={0.02 * k} strokeDasharray={`${0.06 * k} ${0.05 * k}`} />
                    <circle cx={hx} cy={hz} r={0.09 * k} fill="#fff" stroke="#1d1d1f" strokeWidth={0.03 * k} className="cursor-crosshair" onPointerDown={start({ kind: "item", id: it.id, rot: true })} />
                  </g>
                );
              })() : null}
            </g>
          );
        })}

        {/* bounce boards and flags, edge on, with the side that works facing out */}
        {grips.map((g) => {
          const a = aimOfLight(g);
          const y = rad(a.yaw);
          const half = (g.sizeFt * FT * Math.cos(rad(a.pitch))) / 2 || 0.05;
          const px = Math.cos(y) * Math.max(half, 0.12);
          const pz = -Math.sin(y) * Math.max(half, 0.12);
          const hx = g.x - Math.sin(y) * 0.6 * k;
          const hz = g.z - Math.cos(y) * 0.6 * k;
          const sel = isSel("grip", g.id);
          const col = g.kind === "flag" ? "#1d1d1f" : g.kind === "silver" ? "#8b9097" : "#ffffff";
          return (
            <g key={g.id}>
              <line x1={g.x} y1={g.z} x2={hx} y2={hz} stroke="#8b8478" strokeWidth={0.02 * k} strokeDasharray={`${0.06 * k} ${0.05 * k}`} />
              <circle cx={hx} cy={hz} r={0.08 * k} fill="#fff" stroke="#6b645a" strokeWidth={0.03 * k} className="cursor-crosshair" onPointerDown={start({ kind: "grip", id: g.id, aim: true })} />
              <line
                x1={g.x - px} y1={g.z - pz} x2={g.x + px} y2={g.z + pz}
                stroke={sel ? "#1d1d1f" : "#6b645a"} strokeWidth={0.14 * k} strokeLinecap="round"
                className="cursor-move" onPointerDown={start({ kind: "grip", id: g.id }, g)}
              />
              <line x1={g.x - px} y1={g.z - pz} x2={g.x + px} y2={g.z + pz} stroke={col} strokeWidth={0.08 * k} strokeLinecap="round" pointerEvents="none" />
            </g>
          );
        })}

        {/* lights: the beam they throw, a drag handle, and a white dot to aim */}
        {lights.map((raw) => {
          const l = effLight(raw);
          const a = aimOfLight(l);
          const y = rad(a.yaw);
          const f = FIXTURES.find((x) => x.id === l.fixtureId) ?? FIXTURES[0];
          const src = resolveSource(f, l.modifierId, lightOutput(l, f), l.beamDeg, l.frame);
          const half = rad(Math.min(src.omni ? 180 : src.shownBeamDeg, 150) / 2);
          const R = (src.omni ? 0.7 : 1.5) * k;
          const ray = (q: number) => `${l.x - Math.sin(y + q) * R} ${l.z - Math.cos(y + q) * R}`;
          const hx = l.x - Math.sin(y) * 0.7 * k;
          const hz = l.z - Math.cos(y) * 0.7 * k;
          const sel = isSel("light", l.id);
          const fill = l.on ? "#f3c64a" : "#b7b1a6";
          return (
            <g key={l.id}>
              {l.on ? (
                src.omni
                  ? <circle cx={l.x} cy={l.z} r={R} fill={fill} fillOpacity={0.12} />
                  : <path d={`M${l.x} ${l.z} L${ray(half)} L${ray(-half)} Z`} fill={fill} fillOpacity={sel ? 0.22 : 0.12} />
              ) : null}
              {!src.omni ? (
                <>
                  <line x1={l.x} y1={l.z} x2={hx} y2={hz} stroke="#b9891d" strokeWidth={0.025 * k} />
                  <circle cx={hx} cy={hz} r={0.08 * k} fill="#fff" stroke="#b9891d" strokeWidth={0.03 * k} className="cursor-crosshair" onPointerDown={start({ kind: "light", id: l.id, aim: true })} />
                </>
              ) : null}
              {l.frame && !src.omni ? (
                <line
                  x1={l.x - Math.sin(y) * l.frame.distM + Math.cos(y) * (l.frame.sizeFt * FT) / 2}
                  y1={l.z - Math.cos(y) * l.frame.distM - Math.sin(y) * (l.frame.sizeFt * FT) / 2}
                  x2={l.x - Math.sin(y) * l.frame.distM - Math.cos(y) * (l.frame.sizeFt * FT) / 2}
                  y2={l.z - Math.cos(y) * l.frame.distM + Math.sin(y) * (l.frame.sizeFt * FT) / 2}
                  stroke="#f2efe8" strokeWidth={0.07 * k} pointerEvents="none"
                />
              ) : null}
              <g className="cursor-move" onPointerDown={start({ kind: "light", id: l.id }, l)}>
                {l.hungY != null ? (
                  // Hung overhead: a square clamp mark round it.
                  <rect x={l.x - 0.21 * k} y={l.z - 0.21 * k} width={0.42 * k} height={0.42 * k} fill="none" stroke="#1c1c1e" strokeWidth={0.03 * k} strokeDasharray={`${0.07 * k} ${0.05 * k}`} />
                ) : null}
                <circle cx={l.x} cy={l.z} r={0.15 * k} fill={fill} stroke={sel ? "#1d1d1f" : "#b9891d"} strokeWidth={(sel ? 0.05 : 0.025) * k} />
                <text x={l.x} y={l.z + 0.06 * k} textAnchor="middle" fontSize={0.15 * k} fontWeight={800} fill="#4a3a10">{l.role[0]}</text>
              </g>
              <text x={l.x + 0.2 * k} y={l.z - 0.16 * k} fontSize={0.17 * k} fontWeight={700} fill="#7a5b14" pointerEvents="none">{l.role}</text>
            </g>
          );
        })}

        {/* cameras, with their horizontal field of view */}
        {shots.map((s, i) => {
          const b = BODIES.find((x) => x.id === s.bodyId) ?? BODIES[0];
          const half = rad(fovDeg(imagedArea(b, aspectRatio).w, s.focal) / 2);
          const y = rad(s.yaw);
          const L = 4.2 * k;
          const ray = (a: number) => `${s.pos.x - Math.sin(y + a) * L} ${s.pos.z - Math.cos(y + a) * L}`;
          const col = SHOT_HUES[i % SHOT_HUES.length];
          const isA = s.id === activeId;
          const hx = s.pos.x - Math.sin(y) * 0.7 * k;
          const hz = s.pos.z - Math.cos(y) * 0.7 * k;
          const raw = rawShots.find((x) => x.id === s.id) ?? s;
          const sp = supportOf(raw, s.pos);
          const ty = rad(sp.yaw);
          const fp = supportFootprint(s.support, s.pos.y, bodyDrop(s.bodyId), sp.opts);
          const loc = (lx: number, lz: number) => ({ x: s.pos.x + lx * Math.cos(ty) + lz * Math.sin(ty), z: s.pos.z - lx * Math.sin(ty) + lz * Math.cos(ty) });
          const rails = fp.track
            ? [-fp.track.gauge / 2, fp.track.gauge / 2].map((o) => {
                const t = fp.track!;
                const a = t.axis === "x" ? loc(t.from, o) : loc(o, t.from);
                const bb = t.axis === "x" ? loc(t.to, o) : loc(o, t.to);
                return { a, b: bb };
              })
            : [];
          const base = fp.base ? loc(fp.base.x, fp.base.z) : null;
          // The turn handle sits off the front of the track, so turning it
          // never means grabbing the camera by mistake.
          const turn = isA && fp.track
            ? (fp.track.axis === "z" ? loc(0, fp.track.from - 0.3 * k) : loc(0, -0.6 * k))
            : null;
          return (
            <g key={s.id} opacity={isA ? 1 : 0.55}>
              {rails.map((r, j) => (
                <line key={j} x1={r.a.x} y1={r.a.z} x2={r.b.x} y2={r.b.z} stroke="#6f747b" strokeWidth={0.035 * k} strokeLinecap="round" pointerEvents="none" />
              ))}
              {base && fp.base ? (
                <g className="cursor-move" data-map-robot-base={s.id} onPointerDown={start({ kind: "camera", id: s.id, base: true }, base)}>
                  <line x1={base.x} y1={base.z} x2={s.pos.x} y2={s.pos.z} stroke="#2a2c30" strokeOpacity={0.5} strokeWidth={0.05 * k} strokeLinecap="round" pointerEvents="none" />
                  <circle cx={base.x} cy={base.z} r={Math.max(fp.base.r, 0.3 * k)} fill="#2a2c30" fillOpacity={0.35} stroke="#2a2c30" strokeWidth={0.02 * k} />
                  <text x={base.x} y={base.z + 0.06 * k} textAnchor="middle" fontSize={0.15 * k} fontWeight={800} fill="#fff" pointerEvents="none">ARM</text>
                </g>
              ) : null}
              {turn ? (
                <g className="cursor-grab" data-map-rig-turn={s.id} onPointerDown={start({ kind: "camera", id: s.id, rig: true })}>
                  <title>Turn the track. The head keeps its pan.</title>
                  <line x1={s.pos.x} y1={s.pos.z} x2={turn.x} y2={turn.z} stroke="#6f747b" strokeWidth={0.02 * k} strokeDasharray={`${0.05 * k} ${0.05 * k}`} pointerEvents="none" />
                  <circle cx={turn.x} cy={turn.z} r={0.13 * k} fill="#fff" stroke="#6f747b" strokeWidth={0.035 * k} />
                  <path
                    d={`M${turn.x - 0.06 * k} ${turn.z + 0.02 * k} A ${0.065 * k} ${0.065 * k} 0 1 1 ${turn.x + 0.06 * k} ${turn.z + 0.02 * k}`}
                    fill="none" stroke="#6f747b" strokeWidth={0.025 * k} pointerEvents="none"
                  />
                </g>
              ) : null}
              {raw.move ? (
                <g pointerEvents="none">
                  <line x1={raw.pos.x} y1={raw.pos.z} x2={raw.move.end.pos.x} y2={raw.move.end.pos.z} stroke={col} strokeWidth={0.035 * k} strokeDasharray={`${0.08 * k} ${0.06 * k}`} />
                  <circle cx={raw.move.end.pos.x} cy={raw.move.end.pos.z} r={0.08 * k} fill="none" stroke={col} strokeWidth={0.03 * k} />
                  <circle cx={raw.pos.x} cy={raw.pos.z} r={0.05 * k} fill={col} />
                  {isA && !sameSpot(raw.pos, raw.move.end.pos) ? (
                    <>
                      <MapLetter x={raw.pos.x} z={raw.pos.z} k={k} letter="A" color="var(--h-green)" />
                      <MapLetter x={raw.move.end.pos.x} z={raw.move.end.pos.z} k={k} letter="B" color="var(--h-blue)" />
                    </>
                  ) : null}
                </g>
              ) : null}
              <path d={`M${s.pos.x} ${s.pos.z} L${ray(half)} L${ray(-half)} Z`} fill={col} fillOpacity={isA ? 0.16 : 0.07} stroke={col} strokeWidth={0.02 * k} pointerEvents="none" />
              <line x1={s.pos.x} y1={s.pos.z} x2={hx} y2={hz} stroke={col} strokeWidth={0.03 * k} />
              <circle cx={hx} cy={hz} r={0.09 * k} fill="#fff" stroke={col} strokeWidth={0.03 * k} className="cursor-crosshair" onPointerDown={start({ kind: "camera", id: s.id, aim: true })} />
              <g transform={`translate(${s.pos.x} ${s.pos.z}) rotate(${-s.yaw}) scale(${k})`} className="cursor-move" data-map-camera={s.id} onPointerDown={start({ kind: "camera", id: s.id }, { x: s.pos.x, z: s.pos.z })}>
                {/* The body is a few pixels on a small map; this is what you actually grab. */}
                <circle r={0.38} fill="transparent" />
                <rect x={-0.14} y={-0.05} width={0.28} height={0.32} rx={0.04} fill={col} stroke="#1d1d1f" strokeWidth={isA ? 0.04 : 0.02} />
                <rect x={-0.07} y={-0.15} width={0.14} height={0.12} fill="#1d1d1f" />
              </g>
              <text x={s.pos.x + 0.22 * k} y={s.pos.z + 0.3 * k} fontSize={0.2 * k} fontWeight={700} fill="#1d1d1f">{s.code}</text>
            </g>
          );
        })}

        {/* talent: where they walk to, then the person */}
        {talent.map((t) => t.mark ? (
          <g key={`m${t.id}`}>
            <line x1={t.x} y1={t.z} x2={t.mark.x} y2={t.mark.z} stroke={t.top} strokeWidth={0.04 * k} strokeDasharray={`${0.1 * k} ${0.07 * k}`} pointerEvents="none" />
            <g className="cursor-move" onPointerDown={start({ kind: "mark", id: t.id }, t.mark)}>
              <circle cx={t.mark.x} cy={t.mark.z} r={0.2 * k} fill="#fff" fillOpacity={0.6} stroke={t.top} strokeWidth={0.04 * k} strokeDasharray={`${0.07 * k} ${0.04 * k}`} />
              <line
                x1={t.mark.x} y1={t.mark.z}
                x2={t.mark.x + Math.sin(rad(t.mark.facing)) * 0.32 * k} y2={t.mark.z + Math.cos(rad(t.mark.facing)) * 0.32 * k}
                stroke={t.top} strokeWidth={0.04 * k} strokeLinecap="round"
              />
            </g>
            <text x={t.mark.x} y={t.mark.z + 0.42 * k} textAnchor="middle" fontSize={0.16 * k} fontWeight={700} fill="#4a443b" pointerEvents="none">{t.name}&apos;s mark</text>
          </g>
        ) : null)}
        {talent.map((t) => {
          const f = rad(t.facing);
          return (
            <g key={t.id} className="cursor-move" onPointerDown={start({ kind: "talent", id: t.id }, t)}>
              <circle cx={t.x} cy={t.z} r={0.22 * k} fill={t.top} stroke={isSel("talent", t.id) ? "#1d1d1f" : "#fff"} strokeWidth={0.03 * k} />
              <line x1={t.x} y1={t.z} x2={t.x + Math.sin(f) * 0.36 * k} y2={t.z + Math.cos(f) * 0.36 * k} stroke="#1d1d1f" strokeWidth={0.05 * k} strokeLinecap="round" />
              <text x={t.x} y={t.z + 0.48 * k} textAnchor="middle" fontSize={0.2 * k} fontWeight={700} fill="#1d1d1f">{t.name}</text>
            </g>
          );
        })}
      </svg>
      {size === "big" ? (
        <p className="bg-black/80 px-2.5 py-1 text-[10px] text-white/75">
          Drag anything to move it. Drag a white dot to aim a light or a camera, or to turn the selected piece.
        </p>
      ) : null}
      </div>
    </div>
  );
}

type MapView = { r: number; b: number; opacity: number };
const VIEW_KEY = "previz.mapView";
const MARGIN = 12;
const DEFAULT_VIEW: MapView = { r: MARGIN, b: MARGIN, opacity: 1 };
function readView(): MapView {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null");
    if (v && Number.isFinite(v.r) && Number.isFinite(v.b) && Number.isFinite(v.opacity)) {
      return { r: Math.max(0, v.r), b: Math.max(0, v.b), opacity: Math.max(0.2, Math.min(1, v.opacity)) };
    }
  } catch { /* nothing stored */ }
  return DEFAULT_VIEW;
}

function GripDots() {
  return (
    <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden className="shrink-0 text-white/50">
      {[2, 6].flatMap((x) => [2, 6, 10].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />))}
    </svg>
  );
}

function OpacityIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
      <circle cx="6" cy="6" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 1.2a4.8 4.8 0 0 1 0 9.6z" fill="currentColor" />
    </svg>
  );
}

const sameSpot = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z) < 0.05;

/** The A or B tag beside one end of a move, in the same colours as the timeline. */
function MapLetter({ x, z, k, letter, color }: { x: number; z: number; k: number; letter: string; color: string }) {
  const r = 0.13 * k;
  return (
    <g transform={`translate(${x - 0.3 * k} ${z - 0.3 * k})`}>
      <circle r={r} style={{ fill: color }} />
      <text textAnchor="middle" dy={0.055 * k} fontSize={0.15 * k} fontWeight={700} fill="#fff">{letter}</text>
    </g>
  );
}
