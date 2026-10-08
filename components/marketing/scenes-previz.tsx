"use client";

import type { ReactNode } from "react";
import { ActionLabel, Burst, Chip, Cursor, Window, arrive, clamp01, easeInOut, easeOut, lerp, ramp, spring, typed } from "./scene-kit";

/*
 * The Scene builder page's scenes (and its home page panel). Same contract as
 * every scene: a 640x440 drawing, a pure function of t.
 *
 * THE PICTURE IS PROJECTED, NOT FAKED. A tiny pinhole camera below projects a
 * set built in metres (walls, a counter, a person, a light) through a focal
 * length and a sensor width, the same relationship the real builder uses
 * (lib/previz/optics.ts). So when a scene changes the lens from 24mm to 85mm
 * the framing genuinely tightens, and a full-frame body on the same lens
 * genuinely sees wider. A marketing loop that claims "real lens maths" should
 * not be a hand-drawn zoom.
 *
 * Everything shown is in the product today: presets, real bodies and primes,
 * depth of field, the storyboard overlay, named fixtures with modifiers and
 * diffusion frames, the meter in stops, supports and A/B camera moves, clip
 * recording, Save frame, and the phone viewfinder with location stills. The
 * picture inside the viewport uses fixed colours on purpose: it is the
 * rendered image, which does not follow the site's theme in the app either.
 */

/* ---------------------------------------------------------------- PROJECTOR */

type V3 = [number, number, number];
type Cam = { pos: V3; yaw: number; pitch: number; focal: number; sensor: number };
type P2 = { x: number; y: number; z: number };

const D = Math.PI / 180;

function projector(cam: Cam, w: number, h: number) {
  const cy = Math.cos(cam.yaw * D);
  const sy = Math.sin(cam.yaw * D);
  const cp = Math.cos(cam.pitch * D);
  const sp = Math.sin(cam.pitch * D);
  const F: V3 = [sy * cp, sp, -cy * cp];
  const R: V3 = [cy, 0, sy];
  const U: V3 = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]];
  const k = (cam.focal / cam.sensor) * w;
  const p = (q: V3): P2 => {
    const d: V3 = [q[0] - cam.pos[0], q[1] - cam.pos[1], q[2] - cam.pos[2]];
    const X = d[0] * R[0] + d[1] * R[1] + d[2] * R[2];
    const Y = d[0] * U[0] + d[1] * U[1] + d[2] * U[2];
    const Z = Math.max(0.05, d[0] * F[0] + d[1] * F[1] + d[2] * F[2]);
    return { x: w / 2 + (k * X) / Z, y: h / 2 - (k * Y) / Z, z: Z };
  };
  return { p, k };
}

const pts = (a: P2[]) => a.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");

export const fovOf = (focal: number, sensor: number) => (2 * Math.atan(sensor / (2 * focal))) / D;

/* -------------------------------------------------------------- THE VIEWPORT */

type Room = "kitchen" | "seamless" | "bedroom" | "empty";

type Person = {
  x: number;
  z: number;
  pose?: "standing" | "seated";
  top: string;
  bottom: string;
  hair?: string;
};

type Look = {
  room: Room;
  /** 0..1 the set rising in (walls, then furniture), for the preset beat. */
  build?: number;
  people?: Person[];
  /** 0..1, a light switching on; position in metres. */
  light?: { on: number; pos: V3; soft?: number };
  /** A second, softer source from the other side. */
  fill?: number;
  /** Background blur in px, from a wide aperture. */
  blur?: number;
  chair?: number;
  bottle?: number;
  /** The storyboard frame drawn over the lens, 0..1. */
  overlay?: number;
  overlayCam?: Cam;
  /** Letterbox to this aspect inside the 16:9 box. */
  aspect?: number;
  flash?: number;
};

const SEAT = 0.47;

function personShapes(pr: Person, p: (q: V3) => P2, k: number, seat = SEAT) {
  const { x, z } = pr;
  const seated = pr.pose === "seated";
  const base = seated ? seat + 0.06 : 0.92;
  const sh = base + 0.52;
  const head = p([x, sh + 0.17, z]);
  const r = (k * 0.11) / head.z;
  const torso = [p([x - 0.2, sh, z]), p([x + 0.2, sh, z]), p([x + 0.15, base, z]), p([x - 0.15, base, z])];
  const legs = seated
    ? [
        [p([x - 0.15, base, z]), p([x - 0.13, seat + 0.06, z + 0.42]), p([x - 0.12, 0, z + 0.46])],
        [p([x + 0.15, base, z]), p([x + 0.13, seat + 0.06, z + 0.42]), p([x + 0.12, 0, z + 0.46])],
      ]
    : [
        [p([x - 0.12, base, z]), p([x - 0.1, 0.45, z]), p([x - 0.1, 0, z])],
        [p([x + 0.12, base, z]), p([x + 0.1, 0.45, z]), p([x + 0.1, 0, z])],
      ];
  const arms = [
    [p([x - 0.2, sh - 0.02, z]), p([x - 0.26, base + 0.02, z + (seated ? 0.12 : 0)])],
    [p([x + 0.2, sh - 0.02, z]), p([x + 0.26, base + 0.02, z + (seated ? 0.12 : 0)])],
  ];
  const lw = (k * 0.12) / torso[0].z;
  return { head, r, torso, legs, arms, lw };
}

function Box({ p, min, max, cam, top, front, side, op = 1 }: { p: (q: V3) => P2; min: V3; max: V3; cam: Cam; top: string; front: string; side: string; op?: number }) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const sideX = cam.pos[0] > x1 ? x1 : cam.pos[0] < x0 ? x0 : null;
  return (
    <g opacity={op}>
      {sideX !== null ? (
        <polygon points={pts([p([sideX, y0, z0]), p([sideX, y0, z1]), p([sideX, y1, z1]), p([sideX, y1, z0])])} fill={side} />
      ) : null}
      {cam.pos[1] > y1 ? <polygon points={pts([p([x0, y1, z0]), p([x1, y1, z0]), p([x1, y1, z1]), p([x0, y1, z1])])} fill={top} /> : null}
      <polygon points={pts([p([x0, y0, z1]), p([x1, y0, z1]), p([x1, y1, z1]), p([x0, y1, z1])])} fill={front} />
    </g>
  );
}

function PersonFigure({ pr, p, k, lit, side, overlay = false }: { pr: Person; p: (q: V3) => P2; k: number; lit: number; side: number; overlay?: boolean }) {
  const s = personShapes(pr, p, k);
  if (overlay) {
    const st = { fill: "none", stroke: "#fff", strokeWidth: 1.6, strokeDasharray: "4 3", strokeLinecap: "round" as const };
    return (
      <g opacity={0.95}>
        <circle cx={s.head.x} cy={s.head.y} r={s.r} {...st} />
        <polygon points={pts(s.torso)} {...st} />
        {s.legs.map((l, i) => (
          <polyline key={i} points={pts(l)} {...st} />
        ))}
      </g>
    );
  }
  const id = `g${Math.round(pr.x * 100)}${Math.round(pr.z * 100)}${side > 0 ? "r" : "l"}`;
  const hi = 0.25 + 0.75 * lit;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1={side > 0 ? "1" : "0"} y1="0" x2={side > 0 ? "0" : "1"} y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={0.55 * lit} />
          <stop offset="0.55" stopColor="#fff" stopOpacity={0.08 * lit} />
          <stop offset="1" stopColor="#000" stopOpacity={0.35 * (1 - 0.4 * lit)} />
        </linearGradient>
      </defs>
      <g style={{ filter: `brightness(${hi})` }}>
        {s.legs.map((l, i) => (
          <polyline key={i} points={pts(l)} fill="none" stroke={pr.bottom} strokeWidth={s.lw} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {s.arms.map((a, i) => (
          <polyline key={i} points={pts(a)} fill="none" stroke={pr.top} strokeWidth={s.lw * 0.7} strokeLinecap="round" />
        ))}
        <polyline points={pts([s.head, { x: (s.torso[0].x + s.torso[1].x) / 2, y: s.torso[0].y, z: s.head.z }])} fill="none" stroke="#b9876a" strokeWidth={s.lw * 0.5} strokeLinecap="round" />
        <polygon points={pts(s.torso)} fill={pr.top} stroke={pr.top} strokeWidth={s.lw * 0.9} strokeLinejoin="round" />
        <circle cx={s.head.x} cy={s.head.y - s.r * 0.12} r={s.r * 1.05} fill={pr.hair ?? "#3b2a22"} />
        <ellipse cx={s.head.x} cy={s.head.y + s.r * 0.12} rx={s.r * 0.86} ry={s.r * 0.92} fill="#c99b7c" />
      </g>
      <polygon points={pts(s.torso)} fill={`url(#${id})`} />
      <ellipse cx={s.head.x} cy={s.head.y + s.r * 0.12} rx={s.r * 0.86} ry={s.r * 0.92} fill={`url(#${id})`} />
    </g>
  );
}

/**
 * The rendered picture through one camera. A set is a handful of boxes and
 * quads in metres; the order they are drawn in is back to front by hand, which
 * is enough for a set this small.
 */
export function Viewport({ cam, look, w, h, uid }: { cam: Cam; look: Look; w: number; h: number; uid: string }) {
  const { p, k } = projector(cam, w, h);
  const build = look.build ?? 1;
  const walls = easeOut(ramp(build * 1000, 0, 500));
  const furn = spring(ramp(build * 1000, 450, 450));
  const light = look.light;
  const on = light ? easeOut(clamp01(light.on)) : 0;
  const fill = clamp01(look.fill ?? 0);
  const ambient = 0.55 + 0.3 * on + 0.15 * fill;
  const nearZ = Math.min(2.8, cam.pos[2] - 0.45);
  const room = look.room;
  const W = room === "bedroom" ? 2.6 : 3;
  const H = 2.8;
  const back = -3;
  const wallH = H * walls;
  const people = look.people ?? [];
  const side = light ? (light.pos[0] >= 0 ? 1 : -1) : 1;
  const blur = look.blur ?? 0;

  const bg = (
    <g style={{ filter: blur > 0.05 ? `blur(${blur}px)` : undefined }}>
      {room === "seamless" ? (
        <>
          <polygon points={pts([p([-1.9, 0, -1.2]), p([1.9, 0, -1.2]), p([1.9, 0, back + 0.4]), p([-1.9, 0, back + 0.4])])} fill="#c9cdd2" opacity={walls} />
          <polygon points={pts([p([-1.9, 0, back + 0.4]), p([1.9, 0, back + 0.4]), p([1.9, 2.7 * walls, back]), p([-1.9, 2.7 * walls, back])])} fill="#d5d8dc" />
        </>
      ) : room === "empty" && build <= 0 ? null : (
        <>
          <polygon points={pts([p([-W, 0, back]), p([W, 0, back]), p([W, wallH, back]), p([-W, wallH, back])])} fill={room === "bedroom" ? "#b9c4c9" : "#ddd2c1"} />
          <polygon points={pts([p([-W, 0, back]), p([-W, 0, nearZ]), p([-W, wallH, nearZ]), p([-W, wallH, back])])} fill={room === "bedroom" ? "#a9b4ba" : "#cdbfac"} />
          <polygon points={pts([p([W, 0, back]), p([W, 0, nearZ]), p([W, wallH, nearZ]), p([W, wallH, back])])} fill={room === "bedroom" ? "#a3aeb4" : "#c6b8a4"} />
          <polygon points={pts([p([-W, 0, back]), p([W, 0, back]), p([W, 0, nearZ]), p([-W, 0, nearZ])])} fill={room === "bedroom" ? "#8c7a68" : "#9a7d61"} opacity={Math.max(0.4, walls)} />
          {room !== "empty" ? (
            <>
              <polygon
                points={pts([p([-1.7, 1.0, back + 0.01]), p([-0.5, 1.0, back + 0.01]), p([-0.5, 1.0 + 1.2 * furn, back + 0.01]), p([-1.7, 1.0 + 1.2 * furn, back + 0.01])])}
                fill="#f3efe4"
                opacity={walls}
              />
              <polyline points={pts([p([-1.1, 1.0, back + 0.02]), p([-1.1, 1.0 + 1.2 * furn, back + 0.02])])} stroke="#cbbfa9" strokeWidth={2} opacity={walls} />
            </>
          ) : null}
        </>
      )}
      {room === "kitchen" ? (
        <>
          <Box p={p} cam={cam} min={[0.2, 1.5, -3]} max={[2.6, 1.5 + 0.6 * furn, -2.65]} top="#e6ddcf" front="#d8ccba" side="#c9bca9" op={furn} />
          <Box p={p} cam={cam} min={[-1.4, 0, -2.75]} max={[1.4, 0.92 * furn, -2.05]} top="#f1ece4" front="#b49a7c" side="#a38a6d" op={Math.min(1, furn * 1.4)} />
        </>
      ) : null}
      {room === "bedroom" ? (
        <>
          <Box p={p} cam={cam} min={[-1.0, 0, -3]} max={[1.0, 1.05 * furn, -2.9]} top="#7d6a59" front="#7d6a59" side="#6d5b4c" op={furn} />
          <Box p={p} cam={cam} min={[-0.9, 0, -2.9]} max={[0.9, 0.55 * furn, -1.0]} top="#eae6df" front="#d9d2c6" side="#cbc3b6" op={furn} />
          <Box p={p} cam={cam} min={[-1.5, 0, -2.9]} max={[-1.05, 0.6 * furn, -2.45]} top="#8a7563" front="#7a6553" side="#6d5949" op={furn} />
        </>
      ) : null}
    </g>
  );

  const pool = light && on > 0 ? p([people[0]?.x ?? 0, 0.02, people[0]?.z ?? -1.4]) : null;
  const src = light ? p(light.pos) : null;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <radialGradient id={`pool-${uid}`}>
          <stop offset="0" stopColor="#fff3dc" stopOpacity={0.55 * on} />
          <stop offset="1" stopColor="#fff3dc" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="#1c1e23" />
      {bg}
      <rect width={w} height={h} fill="#000" opacity={1 - ambient} />
      {pool ? <ellipse cx={pool.x} cy={pool.y} rx={(k * 1.3) / pool.z} ry={(k * 0.45) / pool.z} fill={`url(#pool-${uid})`} /> : null}
      {look.chair ? (
        <g opacity={clamp01(look.chair * 1.5)} transform={`translate(0 ${(1 - spring(clamp01(look.chair))) * -30})`}>
          {people[0] ? (
            <>
              <Box p={p} cam={cam} min={[people[0].x - 0.36, 0, people[0].z - 0.4]} max={[people[0].x + 0.36, 0.95, people[0].z - 0.22]} top="#5f7e88" front="#5f7e88" side="#516c75" />
              <Box p={p} cam={cam} min={[people[0].x - 0.36, 0, people[0].z - 0.22]} max={[people[0].x + 0.36, SEAT, people[0].z + 0.3]} top="#6f8f99" front="#587680" side="#4f6a73" />
              <Box p={p} cam={cam} min={[people[0].x - 0.44, 0, people[0].z - 0.4]} max={[people[0].x - 0.34, 0.66, people[0].z + 0.3]} top="#6f8f99" front="#587680" side="#4f6a73" />
              <Box p={p} cam={cam} min={[people[0].x + 0.34, 0, people[0].z - 0.4]} max={[people[0].x + 0.44, 0.66, people[0].z + 0.3]} top="#6f8f99" front="#587680" side="#4f6a73" />
            </>
          ) : null}
        </g>
      ) : null}
      {look.bottle ? (
        (() => {
          const b0 = p([0.75, 0.92, -2.35]);
          const b1 = p([0.75, 0.92 + 0.3, -2.35]);
          const bw = (k * 0.085) / b0.z;
          const drop = (1 - spring(clamp01(look.bottle))) * 30;
          return (
            <g opacity={clamp01(look.bottle * 2)} transform={`translate(0 ${-drop})`}>
              <rect x={b1.x - bw / 2} y={b1.y} width={bw} height={b0.y - b1.y} rx={bw * 0.3} fill="#3f8e9c" />
              <rect x={b1.x - bw / 2} y={b1.y + (b0.y - b1.y) * 0.42} width={bw} height={(b0.y - b1.y) * 0.34} fill="#f5efe1" />
              <rect x={b1.x - bw * 0.2} y={b1.y - bw * 0.5} width={bw * 0.4} height={bw * 0.55} fill="#2a3b44" />
            </g>
          );
        })()
      ) : null}
      {people.map((pr, i) => (
        <PersonFigure key={i} pr={pr} p={p} k={k} lit={Math.min(1, 0.35 + on * 0.75 + fill * 0.2)} side={side} />
      ))}
      {src && on > 0 && src.z > 0.2 ? (
        <g opacity={on}>

          <circle cx={src.x} cy={src.y} r={Math.max(3, (k * 0.16) / src.z)} fill="#fffaf0" style={{ filter: `blur(${1 + (light?.soft ?? 0) * 3}px)` }} />
        </g>
      ) : null}
      {look.overlay && look.overlayCam && people[0] ? (
        (() => {
          const o = projector(look.overlayCam, w, h);
          return (
            <g opacity={look.overlay}>
              <rect width={w} height={h} fill="#ffffff" opacity={0.06} />
              {people.map((pr, i) => (
                <PersonFigure key={i} pr={pr} p={o.p} k={o.k} lit={0} side={1} overlay />
              ))}
              <rect x={6} y={6} width={58} height={16} rx={4} fill="#ffffff" opacity={0.9} />
              <text x={35} y={17.5} fontSize={9.5} fontWeight={800} textAnchor="middle" fill="#1c1e23">
                BOARD 1C
              </text>
            </g>
          );
        })()
      ) : null}
      {look.aspect ? (
        (() => {
          const ih = Math.min(h, w / look.aspect);
          const bar = (h - ih) / 2;
          return (
            <>
              <rect width={w} height={bar} fill="#000" opacity={0.82} />
              <rect y={h - bar} width={w} height={bar} fill="#000" opacity={0.82} />
            </>
          );
        })()
      ) : null}
      {look.flash ? <rect width={w} height={h} fill="#fff" opacity={look.flash} /> : null}
    </svg>
  );
}

/* ------------------------------------------------------------------- KIT */

const BODIES = {
  mini: { name: "ARRI Alexa Mini", fmt: "Super 35", sensor: 23.8 },
  venice: { name: "Sony Venice 2", fmt: "Full frame", sensor: 36 },
  zr: { name: "Nikon ZR", fmt: "Full frame", sensor: 35.9 },
  fx3: { name: "Sony FX3", fmt: "Full frame", sensor: 35.6 },
};

/** Lens changes glide in log space, the way a zoom ring feels. */
const glideFocal = (t: number, steps: { at: number; f: number }[], dur = 650) => {
  let f = steps[0].f;
  for (let i = 1; i < steps.length; i++) {
    const p = easeInOut(ramp(t, steps[i].at, dur));
    if (p > 0) f = Math.exp(lerp(Math.log(steps[i - 1].f), Math.log(steps[i].f), p));
  }
  return f;
};

/** The shot list's own vocabulary, from how much of the person fills the frame. */
function shotSize(cam: Cam, pr: Person, w: number, h: number) {
  const { p } = projector(cam, w, h);
  const top = p([pr.x, 1.75, pr.z]).y;
  const foot = p([pr.x, 0, pr.z]).y;
  const fill = (foot - top) / h;
  if (fill < 0.55) return "Wide";
  if (fill < 1.05) return "Full";
  if (fill < 1.7) return "Medium";
  if (fill < 2) return "Medium close-up";
  return "Close-up";
}

function Panel({ title, children, style }: { title: string; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="rounded-[12px] border border-border bg-bg p-2.5" style={style}>
      <p className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-text-faint">{title}</p>
      {children}
    </div>
  );
}

function Row({ k, v, hi }: { k: string; v: ReactNode; hi?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-[2px] text-[11px]">
      <span className="text-text-muted">{k}</span>
      <span className="font-extrabold tabular-nums" style={{ color: hi ? "var(--accent)" : "var(--text)" }}>
        {v}
      </span>
    </div>
  );
}

function Btn({ children, press, on, tone = "quiet", style }: { children: ReactNode; press?: boolean; on?: boolean; tone?: "accent" | "quiet"; style?: React.CSSProperties }) {
  return (
    <span
      className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold"
      style={{
        background: tone === "accent" ? "var(--accent)" : on ? "var(--accent-soft)" : "var(--surface)",
        color: tone === "accent" ? "white" : on ? "var(--accent)" : "var(--text-muted)",
        border: tone === "accent" ? "none" : `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
        transform: `scale(${press ? 0.93 : 1})`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

const pressed = (t: number, at: number) => t >= at && t < at + 160;

/** A frame around a viewport, with the tiny monitor burn-in. */
function Monitor({ x, y, w, h, children, label, edge }: { x: number; y: number; w: number; h: number; children: ReactNode; label?: string; edge?: string }) {
  return (
    <div className="absolute overflow-hidden rounded-[10px]" style={{ left: x, top: y, width: w, height: h, boxShadow: edge ? `0 0 0 2.5px ${edge}` : "0 0 0 1px var(--border)" }}>
      {children}
      {label ? (
        <span className="absolute bottom-1.5 left-2 rounded-[5px] bg-black/60 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-white">{label}</span>
      ) : null}
    </div>
  );
}

const KITCHEN_PEOPLE: Person[] = [{ x: 0.05, z: -1.45, top: "#b5563c", bottom: "#33373f" }];

/* ================================================================ THE HERO */

export const PV_HERO_MS = 15000;

const H_VP = { x: 16, y: 64, w: 408, h: 230 };
const H_CARDS = [
  { code: "1A", size: "Wide", focal: 24, yaw: 0, at: 0 },
  { code: "1B", size: "Medium", focal: 50, yaw: 0, at: 2200 },
  { code: "1C", size: "Close-up", focal: 85, yaw: -2.6, at: 4400 },
];
const H_LIGHT = 6600;
const H_BOARD = 9400;
const H_MATCH = 10400;
const H_SAVE = 12800;

const heroCam = (focal: number, yaw = 0, pitch = -3): Cam => ({ pos: [0, 1.5, 3.1], yaw, pitch, focal, sensor: 23.8 });

export function PrevizHeroScene({ t }: { t: number }) {
  const focal = glideFocal(t, H_CARDS.map((c) => ({ at: c.at, f: c.focal })));
  const active = t >= H_CARDS[2].at ? 2 : t >= H_CARDS[1].at ? 1 : 0;
  const matchP = easeInOut(ramp(t, H_MATCH, 900));
  const yaw = active === 2 ? lerp(-2.6, 0, matchP) : 0;
  const pitch = active === 2 ? lerp(lerp(-3, 0.2, easeInOut(ramp(t, H_CARDS[2].at, 650))), 0.8, matchP) : -3;
  const cam = heroCam(focal, yaw, pitch);
  const stop = active === 2 ? "f/2" : "f/4";
  const blur = active === 2 ? 2.2 * easeOut(ramp(t, H_CARDS[2].at + 200, 700)) : 0;
  const on = ramp(t, H_LIGHT, 700);
  const overlay = ramp(t, H_BOARD, 400) * (1 - ramp(t, H_SAVE - 500, 300));
  const flash = (1 - ramp(t, H_SAVE + 60, 450)) * (t >= H_SAVE ? 1 : 0) * 0.85;
  const look: Look = {
    room: "kitchen",
    people: KITCHEN_PEOPLE,
    light: { on, pos: [1.7, 2.1, 0.2], soft: 0.7 },
    blur,
    overlay,
    overlayCam: heroCam(85, 0, 0.8),
    bottle: 1,
    flash,
  };
  const fov = fovOf(focal, 23.8);
  return (
    <Window title="Scene builder" sub="Bright Water · Kitchen setup" right={<Chip tone="indigo" t={t} since={H_CARDS[active].at}>{H_CARDS[active].code} · {H_CARDS[active].size}</Chip>}>
      <Monitor x={H_VP.x} y={H_VP.y} w={H_VP.w} h={H_VP.h} label={`${BODIES.mini.name} · ${Math.round(focal)}mm · ${stop}`}>
        <Viewport cam={cam} look={look} w={H_VP.w} h={H_VP.h} uid="hero" />
      </Monitor>
      {matchP >= 1 && t < H_SAVE + 900 ? (
        <span className="absolute" style={{ left: H_VP.x + H_VP.w - 128, top: H_VP.y + 10, ...arrive(t, H_MATCH + 900) }}>
          <Chip tone="green" t={t} since={H_MATCH + 900}>Matches board 1C</Chip>
        </span>
      ) : null}
      {t >= H_SAVE ? (
        <span className="absolute" style={{ left: H_VP.x + H_VP.w - 142, top: H_VP.y + 10, ...arrive(t, H_SAVE + 300) }}>
          <Chip tone="green" t={t} since={H_SAVE + 300}>1C_previz.png saved</Chip>
        </span>
      ) : null}

      {/* The shots strip: each card is that camera's own view. */}
      {H_CARDS.map((c, i) => {
        const x = 16 + i * 140;
        const on2 = i === active;
        return (
          <div
            key={c.code}
            className="absolute rounded-[10px] border bg-surface p-1.5"
            style={{ left: x, top: 306, width: 128, borderColor: on2 ? "var(--accent)" : "var(--border)", boxShadow: on2 ? "0 0 0 2px var(--accent-soft)" : undefined }}
          >
            <div className="overflow-hidden rounded-[6px]">
              <Viewport cam={heroCam(c.focal, i === 2 && active === 2 ? yaw : 0, i === 2 ? (active === 2 ? pitch : 0.8) : -3)} look={{ room: "kitchen", people: KITCHEN_PEOPLE, bottle: 1, light: { on, pos: [1.7, 2.1, 0.2] } }} w={114} h={64} uid={`hc${i}`} />
            </div>
            <p className="mt-1 flex items-center justify-between text-[10.5px] font-extrabold">
              <span>{c.code} · {c.size}</span>
              <span className="text-text-faint">{c.focal}mm</span>
            </p>
          </div>
        );
      })}
      <div className="absolute flex gap-2" style={{ left: 16, top: 400 }}>
        <Btn press={pressed(t, H_LIGHT)} on={t >= H_LIGHT}>+ Light</Btn>
        <Btn press={pressed(t, H_BOARD)} on={overlay > 0}>Board overlay</Btn>
        <Btn press={pressed(t, H_SAVE)} tone="accent">Save frame</Btn>
      </div>

      {/* Inspector */}
      <div className="absolute space-y-2" style={{ left: 440, top: 64, width: 184 }}>
        <Panel title="Camera">
          <Row k="Body" v="Alexa Mini" />
          <Row k="Lens" v={`${Math.round(focal)}mm`} hi={ramp(t, H_CARDS[active].at, 700) < 1 && active > 0} />
          <Row k="Stop" v={stop} />
          <Row k="Field of view" v={`${fov.toFixed(1)}°`} />
          <Row k="Shot size" v={shotSize(cam, KITCHEN_PEOPLE[0], H_VP.w, H_VP.h)} />
        </Panel>
        <Panel title="Key light" style={{ opacity: t >= H_LIGHT ? 1 : 0.45 }}>
          <Row k="Fixture" v="LS 600d" />
          <Row k="Modifier" v="Light Dome" />
          <Row k="Diffusion" v="4x4 · ½ grid" />
          <div className="mt-1.5">
            {t >= H_LIGHT + 900 ? (
              <Chip tone="green" t={t} since={H_LIGHT + 900}>Reads {stop}, on the stop</Chip>
            ) : (
              <Chip tone="muted" t={t}>{t >= H_LIGHT ? "Metering" : "Off"}</Chip>
            )}
          </div>
        </Panel>
      </div>

      <ActionLabel t={t} at={H_CARDS[1].at} x={220} y={330} text="Another camera, 50mm" />
      <ActionLabel t={t} at={H_CARDS[2].at} x={360} y={330} text="85mm at f/2" />
      <ActionLabel t={t} at={H_LIGHT} x={40} y={404} text="Add a key light" tone="amber" />
      <ActionLabel t={t} at={H_BOARD} x={120} y={404} text="Lay the board over the lens" tone="purple" />
      <ActionLabel t={t} at={H_SAVE} x={200} y={404} text="Save the frame" tone="green" />
      <Cursor
        t={t}
        path={[
          { t: 300, x: 300, y: 200 },
          { t: H_CARDS[1].at, x: 220, y: 338, click: true },
          { t: H_CARDS[2].at, x: 360, y: 338, click: true },
          { t: H_LIGHT, x: 40, y: 410, click: true },
          { t: H_BOARD, x: 118, y: 410, click: true },
          { t: H_MATCH + 200, x: 260, y: 170 },
          { t: H_SAVE, x: 205, y: 410, click: true },
          { t: PV_HERO_MS - 400, x: 300, y: 250 },
        ]}
      />
    </Window>
  );
}

/* =========================================================== CAMERA + LENS */

export const PV_CAM_MS = 14000;

const C_VP = { x: 16, y: 64, w: 400, h: 225 };
const C_LENSES = [18, 24, 35, 50, 65, 85, 100];
const C_STEPS = [
  { at: 0, f: 24 },
  { at: 1800, f: 50 },
  { at: 3600, f: 85 },
];
const C_STOP = 5400;
const C_BODY = 8400;
const C_SIZE_AT = (i: number) => C_STEPS[i].at;

const lensX = (f: number) => 16 + C_LENSES.indexOf(f) * 57 + 25;

export function PrevizCameraScene({ t }: { t: number }) {
  const focal = glideFocal(t, C_STEPS);
  const ff = ramp(t, C_BODY, 1);
  const body = ff >= 1 ? BODIES.venice : BODIES.mini;
  const sensor = lerp(BODIES.mini.sensor, BODIES.venice.sensor, easeInOut(ramp(t, C_BODY, 700)));
  const cam: Cam = { pos: [0, 1.5, 3.1], yaw: 0, pitch: -3, focal, sensor };
  const stopP = easeInOut(ramp(t, C_STOP, 1600));
  const fstop = Math.exp(lerp(Math.log(8), Math.log(1.4), stopP));
  const fs = fstop >= 7.5 ? "f/8" : fstop >= 5.2 ? "f/5.6" : fstop >= 3.6 ? "f/4" : fstop >= 2.5 ? "f/2.8" : fstop >= 1.8 ? "f/2" : "f/1.4";
  const blur = 3 * stopP * (focal / 85);
  const fov = fovOf(focal, sensor);
  const size = shotSize(cam, KITCHEN_PEOPLE[0], C_VP.w, C_VP.h);
  const sel = C_STEPS.filter((s) => t >= s.at).pop()!.f;
  return (
    <Window title="Camera 1A" sub="Real bodies, real primes, real depth of field" right={<Chip tone="indigo" t={t} since={C_STEPS.filter((s) => t >= s.at).pop()!.at}>{size}</Chip>}>
      <Monitor x={C_VP.x} y={C_VP.y} w={C_VP.w} h={C_VP.h} label={`${body.name} · ${Math.round(focal)}mm · ${fs}`}>
        <Viewport cam={cam} look={{ room: "kitchen", people: KITCHEN_PEOPLE, bottle: 1, blur, light: { on: 1, pos: [1.7, 2.1, 0.2] } }} w={C_VP.w} h={C_VP.h} uid="cam" />
      </Monitor>
      <div className="absolute" style={{ left: 16, top: 302, width: 400 }}>
        <p className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Primes</p>
        <div className="flex gap-[7px]">
          {C_LENSES.map((f) => (
            <span
              key={f}
              className="grid h-[34px] w-[50px] place-items-center rounded-[8px] border text-[12px] font-extrabold"
              style={{
                borderColor: sel === f ? "var(--accent)" : "var(--border)",
                background: sel === f ? "var(--accent-soft)" : "var(--surface)",
                color: sel === f ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute" style={{ left: 16, top: 360, width: 400 }}>
        <div className="mb-1 flex justify-between text-[10px] font-extrabold text-text-faint">
          <span>APERTURE</span>
          <span style={{ color: "var(--text)" }}>{fs}</span>
        </div>
        <div className="relative h-[6px] rounded-full bg-surface-2">
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(1 - stopP) * 100}%`, background: "var(--accent)" }} />
          <span className="absolute top-1/2 h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `${(1 - stopP) * 100}%`, background: "var(--accent)", boxShadow: "0 2px 6px rgba(0,0,0,.25)" }} />
        </div>
        <p className="mt-2 text-[11px] font-semibold text-text-muted">
          {stopP < 0.05 ? "Deep focus: the kitchen stays sharp." : stopP < 1 ? "Opening up..." : "The background falls off behind her, the way the lens would."}
        </p>
      </div>
      <div className="absolute space-y-2" style={{ left: 432, top: 64, width: 192 }}>
        <Panel title="Body">
          {[BODIES.mini, BODIES.venice, BODIES.zr, BODIES.fx3].map((b) => (
            <div
              key={b.name}
              className="mb-1 flex items-center justify-between rounded-[7px] px-2 py-1 text-[11px] font-bold"
              style={{ background: b === body ? "var(--accent-soft)" : "transparent", color: b === body ? "var(--accent)" : "var(--text-muted)" }}
            >
              <span>{b.name}</span>
              <span className="text-[9.5px] opacity-75">{b.fmt}</span>
            </div>
          ))}
        </Panel>
        <Panel title="What the lens sees">
          <Row k="Horizontal FOV" v={`${fov.toFixed(1)}°`} hi={t >= C_BODY && t < C_BODY + 1500} />
          <Row k="Sensor width" v={`${sensor.toFixed(1)}mm`} />
          <Row k="Shot size" v={size} />
          {t >= C_BODY + 800 ? (
            <p className="mt-1.5 text-[10.5px] font-semibold leading-snug" style={{ color: "var(--h-indigo)", ...arrive(t, C_BODY + 800) }}>
              Same 85mm, wider on full frame.
            </p>
          ) : null}
        </Panel>
      </div>
      <ActionLabel t={t} at={C_STEPS[1].at} x={lensX(50)} y={310} text="Swap to a 50" />
      <ActionLabel t={t} at={C_STEPS[2].at} x={lensX(85)} y={310} text="Now an 85" />
      <ActionLabel t={t} at={C_STOP} x={360} y={364} text="Open to f/1.4" tone="purple" />
      <ActionLabel t={t} at={C_BODY} x={600} y={196} text="Same lens, full frame body" tone="amber" />
      <Cursor
        t={t}
        path={[
          { t: 200, x: 250, y: 200 },
          { t: C_SIZE_AT(1), x: lensX(50), y: 322, click: true },
          { t: C_SIZE_AT(2), x: lensX(85), y: 322, click: true },
          { t: C_STOP, x: 412, y: 378, click: true },
          { t: C_STOP + 1600, x: 20, y: 378 },
          { t: C_BODY, x: 520, y: 117, click: true },
          { t: PV_CAM_MS - 400, x: 300, y: 240 },
        ]}
      />
    </Window>
  );
}

/* =================================================================== LIGHT */

export const PV_LIGHT_MS = 15000;

const L_VP = { x: 232, y: 64, w: 392, h: 220 };
const L_MAP = { x: 16, y: 64, w: 200, h: 220 };
const L_DRAG = 900;
const L_DOME = 3600;
const L_FRAME = 5600;
const L_ND = 8000;
const L_FILL = 10400;

export function PrevizLightScene({ t }: { t: number }) {
  const dragP = easeInOut(ramp(t, L_DRAG, 1100));
  const lightOn = ramp(t, L_DRAG + 1100, 400);
  const lx = lerp(-0.2, 1.7, dragP);
  const soft = ramp(t, L_DOME, 500) * 0.5 + ramp(t, L_FRAME, 500) * 0.5;
  const fill = ramp(t, L_FILL + 400, 600);
  const cam: Cam = { pos: [0, 1.5, 3.1], yaw: 0, pitch: -3, focal: 40, sensor: 23.8 };
  const over = t < L_ND + 600 && t >= L_DRAG + 1500;
  const meter =
    t < L_DRAG + 1500
      ? null
      : t < L_FRAME + 700
        ? { tone: "amber" as const, txt: "Key reads f/8 · 2 stops over" }
        : t < L_ND + 600
          ? { tone: "amber" as const, txt: "Key reads f/5.6 · 1 stop over" }
          : { tone: "green" as const, txt: "Key reads f/4 · on the stop" };
  // Map coordinates: room is the map rect; person near the back, camera at the bottom.
  const mapPx = (x: number, z: number) => ({ x: L_MAP.x + L_MAP.w / 2 + (x / 3) * (L_MAP.w / 2 - 12), y: L_MAP.y + 22 + ((z + 3) / 6.2) * (L_MAP.h - 34) });
  const person = mapPx(0.05, -1.45);
  const camP = mapPx(0, 3.1);
  const keyP = mapPx(lx, 0.2);
  const fillP = mapPx(-1.8, 0.4);
  const keyScreen = keyP;
  return (
    <Window title="Lighting · Kitchen setup" sub="Named fixtures, modifiers and diffusion, metered in stops" right={meter ? <Chip tone={meter.tone} t={t} since={over ? L_DRAG + 1500 : L_ND + 600}>{meter.txt}</Chip> : null}>
      <div className="absolute overflow-hidden rounded-[10px] border border-border bg-bg" style={{ left: L_MAP.x, top: L_MAP.y, width: L_MAP.w, height: L_MAP.h }}>
        <span className="absolute left-2 top-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Top-down</span>
        <svg className="absolute inset-0" width={L_MAP.w} height={L_MAP.h}>
          <rect x={12} y={22} width={L_MAP.w - 24} height={L_MAP.h - 34} rx={3} fill="var(--surface)" stroke="var(--border)" />
          <rect x={L_MAP.w * 0.22} y={28} width={L_MAP.w * 0.56} height={14} rx={2} fill="var(--surface-2)" />
          <polygon points={`${camP.x - L_MAP.x},${camP.y - L_MAP.y} ${person.x - L_MAP.x - 46},${person.y - L_MAP.y - 30} ${person.x - L_MAP.x + 46},${person.y - L_MAP.y - 30}`} fill="var(--h-indigo)" opacity={0.12} />
        </svg>
        {lightOn > 0 ? (
          <svg className="absolute inset-0" width={L_MAP.w} height={L_MAP.h} style={{ opacity: lightOn }}>
            <path d={`M ${keyP.x - L_MAP.x} ${keyP.y - L_MAP.y} L ${person.x - L_MAP.x + 5} ${person.y - L_MAP.y + 3}`} stroke="var(--h-amber)" strokeWidth={1.6} strokeDasharray="4 3" />
            {t >= L_FRAME ? <rect x={lerp(keyP.x, person.x, 0.45) - L_MAP.x - 9} y={lerp(keyP.y, person.y, 0.45) - L_MAP.y - 2} width={18} height={4} rx={1} fill="var(--text-faint)" transform={`rotate(-38 ${lerp(keyP.x, person.x, 0.45) - L_MAP.x} ${lerp(keyP.y, person.y, 0.45) - L_MAP.y})`} style={{ opacity: ramp(t, L_FRAME, 300) }} /> : null}
          </svg>
        ) : null}
        {fill > 0 ? (
          <svg className="absolute inset-0" width={L_MAP.w} height={L_MAP.h} style={{ opacity: fill }}>
            <path d={`M ${fillP.x - L_MAP.x} ${fillP.y - L_MAP.y} L ${person.x - L_MAP.x - 5} ${person.y - L_MAP.y + 3}`} stroke="var(--h-blue)" strokeWidth={1.6} strokeDasharray="4 3" />
          </svg>
        ) : null}
        <span className="absolute h-[12px] w-[12px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: person.x - L_MAP.x, top: person.y - L_MAP.y, background: "var(--h-orange)" }} />
        <span className="absolute h-[10px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-[3px]" style={{ left: camP.x - L_MAP.x, top: camP.y - L_MAP.y - 8, background: "var(--h-indigo)" }} />
        {t >= L_DRAG - 200 ? (
          <span className="absolute grid h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white" style={{ left: keyScreen.x - L_MAP.x, top: keyScreen.y - L_MAP.y, background: "var(--h-amber)", boxShadow: "0 2px 6px rgba(0,0,0,.25)" }} />
        ) : null}
        {fill > 0 ? (
          <span className="absolute h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: fillP.x - L_MAP.x, top: fillP.y - L_MAP.y, background: "var(--h-blue)", opacity: fill }} />
        ) : null}
      </div>
      <Monitor x={L_VP.x} y={L_VP.y} w={L_VP.w} h={L_VP.h} label={`Alexa Mini · 40mm · f/4${t >= L_ND + 600 ? " · ND .3" : ""}`}>
        <Viewport cam={cam} look={{ room: "kitchen", people: KITCHEN_PEOPLE, bottle: 1, light: { on: lightOn * (t >= L_ND + 600 ? 0.85 : 1), pos: [lx, 2.1, 0.2], soft }, fill: fill * 0.6 }} w={L_VP.w} h={L_VP.h} uid="light" />
      </Monitor>

      <div className="absolute grid grid-cols-2 gap-2" style={{ left: 16, top: 298, width: 608 }}>
        <Panel title="Key · Aputure LS 600d" style={{ opacity: lightOn > 0 ? 1 : 0.45 }}>
          <Row k="Modifier" v={t >= L_DOME ? "Light Dome" : "Reflector"} hi={t >= L_DOME && t < L_DOME + 1200} />
          <Row k="Diffusion frame" v={t >= L_FRAME ? "4x4 · ½ grid cloth" : "None"} hi={t >= L_FRAME && t < L_FRAME + 1200} />
          <Row k="Colour" v="5600K" />
          <div className="mt-1.5 flex gap-1.5">
            <Btn press={pressed(t, L_DOME)} on={t >= L_DOME}>Dome</Btn>
            <Btn press={pressed(t, L_FRAME)} on={t >= L_FRAME}>+ Frame</Btn>
          </div>
        </Panel>
        <Panel title="Exposure">
          <Row k="Stop · ISO" v="f/4 · 800" />
          <Row k="ND" v={t >= L_ND + 600 ? "ND .3" : "None"} hi={t >= L_ND + 600 && t < L_ND + 1800} />
          <Row k="Key to fill" v={fill >= 1 ? "4:1" : "No fill"} hi={fill >= 1 && t < L_FILL + 2400} />
          <div className="mt-1.5 flex gap-1.5">
            <Btn press={pressed(t, L_ND)} on={t >= L_ND}>Set ND to match</Btn>
            <Btn press={pressed(t, L_FILL)} on={t >= L_FILL}>+ SkyPanel fill</Btn>
          </div>
        </Panel>
      </div>

      <ActionLabel t={t} at={L_DRAG + 1100} x={keyP.x} y={keyP.y} text="Drop the key, camera right" tone="amber" after={900} />
      <ActionLabel t={t} at={L_DOME} x={30} y={384} text="Soften it" tone="purple" />
      <ActionLabel t={t} at={L_FRAME} x={84} y={384} text="Diffusion in front" tone="purple" />
      <ActionLabel t={t} at={L_ND} x={340} y={384} text="Bring it back to the stop" tone="green" />
      <ActionLabel t={t} at={L_FILL} x={450} y={384} text="A soft fill opposite" tone="blue" />
      <Cursor
        t={t}
        path={[
          { t: 300, x: 120, y: 120 },
          { t: L_DRAG, x: mapPx(-0.2, 0.2).x, y: mapPx(-0.2, 0.2).y, click: true },
          { t: L_DRAG + 1100, x: mapPx(1.7, 0.2).x, y: mapPx(1.7, 0.2).y },
          { t: L_DOME, x: 48, y: 391, click: true },
          { t: L_FRAME, x: 100, y: 391, click: true },
          { t: L_ND, x: 360, y: 391, click: true },
          { t: L_FILL, x: 470, y: 391, click: true },
          { t: PV_LIGHT_MS - 400, x: 420, y: 200 },
        ]}
      />
    </Window>
  );
}

/* ===================================================================== SET */

export const PV_SET_MS = 14000;

const S_VP = { x: 216, y: 64, w: 408, h: 230 };
const S_PRESETS = ["Empty room", "Talent on seamless", "Kitchen", "Bathroom", "Bedroom"];
const S_PICK = 1400;
const S_ADD = 4400;
const S_TYPE = 5000;
const S_DROP = 6800;
const S_SIT = 8000;
const S_PHOTO = 10000;

export function PrevizSetScene({ t }: { t: number }) {
  const picked = t >= S_PICK;
  const build = picked ? clamp01((t - S_PICK - 200) / 1000) : 0;
  const chair = ramp(t, S_DROP, 500);
  const seated = t >= S_SIT;
  const cam: Cam = { pos: [0.1, 1.45, 3.1], yaw: 0, pitch: -4, focal: 30, sensor: 23.8 };
  const people: Person[] = picked && build > 0.6 ? [{ x: 0.05, z: -1.15, pose: seated ? "seated" : "standing", top: "#4a6b5d", bottom: "#2e3138" }] : [];
  const searchOpen = t >= S_ADD && t < S_DROP + 200;
  const q = typed("armchair", t, S_TYPE, 70);
  return (
    <Window title="New setup" sub="Start from a room, then build on it" right={picked ? <Chip tone="green" t={t} since={S_PICK}>Kitchen</Chip> : null}>
      <div className="absolute" style={{ left: 16, top: 64, width: 184 }}>
        <Panel title="Presets">
          {S_PRESETS.map((n) => {
            const on = picked && n === "Kitchen";
            return (
              <div key={n} className="mb-1 rounded-[7px] px-2 py-[5px] text-[11.5px] font-bold" style={{ background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--text-muted)" }}>
                {n}
              </div>
            );
          })}
          <p className="mt-1 text-[10px] font-semibold leading-snug text-text-faint">Each starts with one person, one camera and one key.</p>
        </Panel>
        <div className="mt-2 space-y-1.5">
          <Btn press={pressed(t, S_ADD)} on={searchOpen} style={{ width: "100%" }}>+ Add to the set</Btn>
          <Btn press={pressed(t, S_SIT)} on={seated} style={{ width: "100%" }}>Pose: {seated ? "Seated" : "Standing"}</Btn>
          <Btn press={pressed(t, S_PHOTO)} on={t >= S_PHOTO} style={{ width: "100%" }}>Product from a photo</Btn>
        </div>
      </div>
      <Monitor x={S_VP.x} y={S_VP.y} w={S_VP.w} h={S_VP.h} label="1A · Alexa Mini · 30mm">
        <Viewport cam={cam} look={{ room: picked ? "kitchen" : "empty", build, people, chair, bottle: ramp(t, S_PHOTO + 600, 500), light: { on: build, pos: [1.7, 2.1, 0.2] } }} w={S_VP.w} h={S_VP.h} uid="set" />
        {!picked ? <span className="absolute inset-0 grid place-items-center text-[12px] font-bold text-white/60">Pick a room to start</span> : null}
      </Monitor>
      {searchOpen ? (
        <div className="absolute rounded-[12px] border border-border bg-surface p-2 shadow-xl" style={{ left: 216, top: 120, width: 220, ...arrive(t, S_ADD) }}>
          <div className="rounded-[8px] border border-border bg-bg px-2 py-1.5 text-[12px] font-bold">
            {q}
            <span className="ml-px inline-block h-[13px] w-px translate-y-[2px] bg-text" style={{ opacity: Math.floor(t / 400) % 2 }} />
          </div>
          {q.length >= 3
            ? ["Armchair", "Sofa", "Dining chair"].map((n, i) => (
                <div key={n} className="mt-1 flex items-center justify-between rounded-[7px] px-2 py-1 text-[11.5px] font-bold" style={{ background: i === 0 && t >= S_DROP - 300 ? "var(--accent-soft)" : "transparent", color: i === 0 ? "var(--text)" : "var(--text-muted)" }}>
                  <span>{n}</span>
                  <span className="text-[9.5px] text-text-faint">Furniture</span>
                </div>
              ))
            : null}
        </div>
      ) : null}
      {t >= S_PHOTO ? (
        <div className="absolute flex items-center gap-2 rounded-[10px] border border-border bg-surface p-1.5 pr-2.5 shadow-lg" style={{ left: 440, top: 228, ...arrive(t, S_PHOTO) }}>
          <span className="grid h-[30px] w-[22px] place-items-center rounded-[4px]" style={{ background: "#3f8e9c" }}>
            <span className="h-[9px] w-full" style={{ background: "#f5efe1" }} />
          </span>
          <span className="text-[11px] font-extrabold">bottle-label.jpg</span>
        </div>
      ) : null}
      <div className="absolute grid grid-cols-3 gap-2" style={{ left: 216, top: 308, width: 408 }}>
        {[
          { t: "Rooms to size", d: "Width, depth, ceiling, windows and doors." },
          { t: "Over fifty pieces", d: "Backdrops, furniture, practicals, props." },
          { t: "Your own models", d: "GLB, OBJ or STL, at true size." },
        ].map((c, i) => (
          <div key={c.t} className="rounded-[10px] border border-border bg-bg p-2" style={arrive(t, 600 + i * 150)}>
            <p className="text-[11.5px] font-extrabold">{c.t}</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-text-muted">{c.d}</p>
          </div>
        ))}
      </div>
      <ActionLabel t={t} at={S_PICK} x={110} y={166} text="Start from a kitchen" />
      <ActionLabel t={t} at={S_ADD} x={150} y={298} text="Add a piece" />
      <ActionLabel t={t} at={S_DROP} x={250} y={160} text="It lands where she stands" tone="green" />
      <ActionLabel t={t} at={S_SIT} x={150} y={330} text="She sits on it" tone="purple" />
      <ActionLabel t={t} at={S_PHOTO} x={150} y={363} text="The real label, wrapped on" tone="amber" />
      <Cursor
        t={t}
        path={[
          { t: 300, x: 300, y: 200 },
          { t: S_PICK, x: 80, y: 173, click: true },
          { t: S_ADD, x: 120, y: 312, click: true },
          { t: S_DROP, x: 260, y: 167, click: true },
          { t: S_SIT, x: 120, y: 345, click: true },
          { t: S_PHOTO, x: 120, y: 377, click: true },
          { t: PV_SET_MS - 400, x: 400, y: 220 },
        ]}
      />
    </Window>
  );
}

/* ==================================================================== MOVE */

export const PV_MOVE_MS = 15000;

const M_VP = { x: 16, y: 64, w: 408, h: 230 };
const M_SUPPORTS = ["Sticks", "Dana Dolly", "Fisher dolly", "Motion arm"];
const M_SUP = 900;
const M_A = 2400;
const M_FRAME = 3600;
const M_B = 5200;
const M_PLAY = 6800;
const M_REC = 10200;
const M_MOVE_LEN = 3000;

export function PrevizMoveScene({ t }: { t: number }) {
  const sup = t >= M_SUP ? 2 : 0;
  const framing = t >= M_FRAME && t < M_B;
  const draftP = easeInOut(ramp(t, M_FRAME, 1200));
  const playP = t >= M_REC ? easeInOut(ramp(t, M_REC + 300, M_MOVE_LEN)) : easeInOut(ramp(t, M_PLAY, M_MOVE_LEN));
  const atEnd = t >= M_B && t < M_PLAY;
  const z = framing ? lerp(3.1, 1.3, draftP) : atEnd ? 1.3 : t >= M_PLAY ? lerp(3.1, 1.3, playP) : 3.1;
  const cam: Cam = { pos: [0, 1.5, z], yaw: 0, pitch: -3, focal: 32, sensor: 23.8 };
  const playing = t >= M_PLAY && playP < 1 && !(t >= M_PLAY + M_MOVE_LEN && t < M_REC);
  const recording = t >= M_REC + 300 && t < M_REC + 300 + M_MOVE_LEN;
  const edge = framing ? "var(--h-amber)" : recording ? "var(--h-red)" : playing ? undefined : atEnd ? "var(--h-blue)" : t >= M_A && t < M_FRAME ? "var(--h-green)" : undefined;
  const scrub = t >= M_PLAY ? playP : atEnd || framing ? (framing ? draftP : 1) : 0;
  return (
    <Window title="Shot 1A · Push in" sub="Supports, A and B frames, a clip of the move" right={recording ? <Chip tone="red" t={t} since={M_REC + 300}>Recording</Chip> : t >= M_REC + 300 + M_MOVE_LEN ? <Chip tone="green" t={t} since={M_REC + 300 + M_MOVE_LEN}>1A_move.mp4 saved</Chip> : null}>
      <Monitor x={M_VP.x} y={M_VP.y} w={M_VP.w} h={M_VP.h} edge={edge} label={framing ? "Unsaved framing" : `Fisher dolly · 32mm${t >= M_PLAY ? ` · ${(scrub * 4).toFixed(1)}s` : ""}`}>
        <Viewport cam={cam} look={{ room: "kitchen", people: KITCHEN_PEOPLE, bottle: 1, light: { on: 1, pos: [1.7, 2.1, 0.2] } }} w={M_VP.w} h={M_VP.h} uid="move" />
      </Monitor>
      <div className="absolute" style={{ left: 16, top: 306, width: 408 }}>
        <div className="flex items-center gap-2">
          <FrameCard label="A" color="var(--h-green)" set={t >= M_A} />
          <div className="relative h-[8px] flex-1 rounded-full bg-surface-2">
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${scrub * 100}%`, background: "linear-gradient(90deg, var(--h-green), var(--h-blue))" }} />
            <span className="absolute top-1/2 h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" style={{ left: `${scrub * 100}%`, background: "var(--text)" }} />
          </div>
          <FrameCard label="B" color="var(--h-blue)" set={t >= M_B} />
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <Btn press={pressed(t, M_A)} on={t >= M_A}>Set as start</Btn>
          <Btn press={pressed(t, M_B)} on={t >= M_B}>Set as end</Btn>
          <Btn press={pressed(t, M_PLAY)} on={playing && !recording}>Play</Btn>
          <Btn press={pressed(t, M_REC)} tone="accent">Record clip</Btn>
        </div>
        <p className="mt-2 text-[11px] font-semibold text-text-muted">
          {t >= M_B ? "Push in · 1.8 m of track over 4 s · 0.45 m/s average" : framing ? "Framing the end. Nothing changes until you set it." : "Frame the start, then the end."}
        </p>
      </div>
      <div className="absolute space-y-2" style={{ left: 440, top: 64, width: 184 }}>
        <Panel title="Camera on">
          {M_SUPPORTS.map((s, i) => (
            <div key={s} className="mb-1 rounded-[7px] px-2 py-[5px] text-[11.5px] font-bold" style={{ background: i === sup ? "var(--accent-soft)" : "transparent", color: i === sup ? "var(--accent)" : "var(--text-muted)" }}>
              {s}
            </div>
          ))}
        </Panel>
        <Panel title="Track">
          <svg width={160} height={86} style={{ display: "block" }}>
            <rect x={6} y={6} width={148} height={74} rx={4} fill="var(--surface)" stroke="var(--border)" />
            <circle cx={80} cy={22} r={5} fill="var(--h-orange)" />
            {t >= M_SUP ? (
              <>
                <line x1={74} y1={36} x2={74} y2={74} stroke="var(--text-faint)" strokeWidth={1.5} />
                <line x1={86} y1={36} x2={86} y2={74} stroke="var(--text-faint)" strokeWidth={1.5} />
              </>
            ) : null}
            <text x={80} y={(t >= M_A ? 72 : 72) + 0} fontSize={9} fontWeight={800} textAnchor="middle" fill="var(--h-green)" opacity={t >= M_A ? 1 : 0}>A</text>
            <text x={66} y={44} fontSize={9} fontWeight={800} textAnchor="middle" fill="var(--h-blue)" opacity={t >= M_B ? 1 : 0}>B</text>
            <rect x={75} y={lerp(64, 38, z === 3.1 ? 0 : (3.1 - z) / 1.8)} width={10} height={8} rx={2} fill="var(--h-indigo)" />
          </svg>
        </Panel>
      </div>
      <ActionLabel t={t} at={M_SUP} x={530} y={110} text="Put it on a Fisher" />
      <ActionLabel t={t} at={M_A} x={40} y={344} text="This is the start" tone="green" />
      <ActionLabel t={t} at={M_FRAME} x={220} y={150} text="Push in to the end frame" tone="amber" after={900} />
      <ActionLabel t={t} at={M_B} x={120} y={344} text="This is the end" tone="blue" />
      <ActionLabel t={t} at={M_PLAY} x={200} y={344} text="Play the move" />
      <ActionLabel t={t} at={M_REC} x={250} y={344} text="Record it as a clip" tone="red" />
      <Cursor
        t={t}
        path={[
          { t: 300, x: 300, y: 200 },
          { t: M_SUP, x: 520, y: 132, click: true },
          { t: M_A, x: 50, y: 352, click: true },
          { t: M_FRAME, x: 220, y: 170, click: true },
          { t: M_FRAME + 1200, x: 220, y: 120 },
          { t: M_B, x: 128, y: 352, click: true },
          { t: M_PLAY, x: 196, y: 352, click: true },
          { t: M_REC, x: 262, y: 352, click: true },
          { t: PV_MOVE_MS - 400, x: 320, y: 240 },
        ]}
      />
    </Window>
  );
}

function FrameCard({ label, color, set }: { label: string; color: string; set: boolean }) {
  return (
    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] text-[11px] font-extrabold" style={{ background: set ? color : "var(--surface-2)", color: set ? "white" : "var(--text-faint)" }}>
      {label}
    </span>
  );
}

/* ============================================================== VIEWFINDER */

export const PV_FINDER_MS = 16000;

const F_LENS = [24, 35, 50, 85];
const F_PICK = 1500;
const F_LEVEL = 3000;
const F_SHOOT = 5000;
const F_FLY = 5600;
const F_BUILD = 9000;
const F_READY = 10800;

/** The location as the phone sees it: a drawn room, not a photograph. */
function LocationPicture({ w, h, alt = false }: { w: number; h: number; alt?: boolean }) {
  if (alt)
    return (
      <svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block" }}>
        <rect width="100" height="58" fill="#b9cfdc" />
        <rect y="58" width="100" height="42" fill="#7d8a6a" />
        <rect x="22" y="26" width="46" height="34" fill="#e7e1d6" />
        <polygon points="18,28 45,10 72,28" fill="#8a5a46" />
        <rect x="40" y="40" width="10" height="20" fill="#5c4a3d" />
        <rect x="27" y="34" width="9" height="9" fill="#9fb8c6" />
        <rect x="54" y="34" width="9" height="9" fill="#9fb8c6" />
      </svg>
    );
  return (
    <svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block" }}>
      <rect width="100" height="62" fill="#d8cfbf" />
      <rect y="62" width="100" height="38" fill="#9a7d61" />
      <rect x="12" y="14" width="26" height="34" fill="#f2eee4" />
      <line x1="25" y1="14" x2="25" y2="48" stroke="#c9bda8" strokeWidth="1" />
      <rect x="46" y="50" width="48" height="16" fill="#b49a7c" />
      <rect x="46" y="48" width="48" height="3" fill="#efe9df" />
      <rect x="58" y="10" width="34" height="12" fill="#cfc2ae" />
      <rect x="80" y="40" width="3" height="8" rx="1" fill="#3f8e9c" />
      <circle cx="30" cy="70" r="0" />
    </svg>
  );
}

export function PrevizFinderScene({ t }: { t: number }) {
  const lens = t >= F_PICK ? 35 : 24;
  const tilt = lerp(-9, -4, easeInOut(ramp(t, F_LEVEL - 600, 900)));
  const roll = lerp(3.2, 0, easeInOut(ramp(t, F_LEVEL - 600, 900)));
  const level = Math.abs(roll) < 0.4;
  const flash = t >= F_SHOOT ? (1 - ramp(t, F_SHOOT, 350)) * 0.9 : 0;
  // The phone: portrait, the frame is a 2.39:1 crop of what the phone sees.
  const PH = { x: 24, y: 84, w: 176, h: 344 };
  const view = { x: PH.x + 10, y: PH.y + 40, w: PH.w - 20, h: 180 };
  const scale = lens === 24 ? 0.94 : lerp(0.94, 0.66, easeOut(ramp(t, F_PICK, 500)));
  const fw = view.w * scale;
  const fh = fw / 2.39;
  const fly = easeInOut(ramp(t, F_FLY, 900));
  const building = t >= F_BUILD;
  const bp = clamp01((t - F_BUILD - 300) / 1200);
  const cam: Cam = { pos: [0.05, 1.5, 3.1], yaw: 0, pitch: -4, focal: 35, sensor: 23.8 };
  return (
    <Window title="Location stills" sub="Framed on the phone, built on the computer">
      {/* The phone */}
      <div className="absolute rounded-[26px] border-[3px] bg-[#0d0e10]" style={{ left: PH.x, top: PH.y, width: PH.w, height: PH.h, borderColor: "#2a2c31" }}>
        <div className="absolute left-1/2 top-2 h-[5px] w-[44px] -translate-x-1/2 rounded-full bg-[#2a2c31]" />
        <p className="absolute left-0 right-0 top-[18px] text-center font-mono text-[9.5px] font-bold text-white/80">Alexa Mini · {lens}mm · 2.39:1</p>
        <div className="absolute overflow-hidden" style={{ left: view.x - PH.x, top: view.y - PH.y, width: view.w, height: view.h }}>
          <div style={{ transform: `rotate(${roll}deg) scale(1.08)`, transformOrigin: "center" }}>
            <LocationPicture w={view.w} h={view.h} />
          </div>
          {/* Dim outside the frame, like a cine monitor. */}
          <div className="absolute" style={{ left: (view.w - fw) / 2, top: (view.h - fh) / 2, width: fw, height: fh, boxShadow: "0 0 0 400px rgba(0,0,0,.55)", outline: "1.5px solid rgba(255,255,255,.9)" }} />
          <div className="absolute left-1/2 top-1/2 h-px -translate-x-1/2" style={{ width: fw * 0.5, background: level ? "#4ade80" : "#fbbf24", transform: `translate(-50%, 0) rotate(${-roll * 3}deg)` }} />
          <div className="absolute inset-0 bg-white" style={{ opacity: flash }} />
        </div>
        <p className="absolute left-0 right-0 text-center text-[10px] font-bold" style={{ top: view.y - PH.y + view.h + 8, color: level ? "#4ade80" : "#fbbf24" }}>
          Tilt {Math.abs(tilt).toFixed(0)}° down · {level ? "level" : `${roll.toFixed(1)}° off level`}
        </p>
        <div className="absolute left-0 right-0 flex justify-center gap-1.5" style={{ top: view.y - PH.y + view.h + 30 }}>
          {F_LENS.map((f) => (
            <span key={f} className="grid h-[24px] w-[30px] place-items-center rounded-[6px] text-[10.5px] font-extrabold" style={{ background: f === lens ? "#fff" : "rgba(255,255,255,.12)", color: f === lens ? "#111" : "rgba(255,255,255,.75)" }}>
              {f}
            </span>
          ))}
        </div>
        <span className="absolute left-1/2 grid h-[42px] w-[42px] -translate-x-1/2 place-items-center rounded-full border-[3px] border-white" style={{ bottom: 14, transform: `translateX(-50%) scale(${pressed(t, F_SHOOT) ? 0.88 : 1})` }}>
          <span className="h-[30px] w-[30px] rounded-full bg-white" />
        </span>
      </div>
      <span className="absolute rounded-full px-2 py-0.5 text-[9.5px] font-bold" style={{ left: PH.x + 6, top: PH.y - 21, background: "var(--h-green-bg)", color: "var(--h-green)" }}>
        Calibrated · like a 24.8mm
      </span>

      {/* The flying still */}
      {t >= F_FLY && fly < 1 ? (
        <div className="absolute overflow-hidden rounded-[6px] shadow-xl" style={{ left: lerp(view.x + (view.w - fw) / 2, 236, fly), top: lerp(view.y + (view.h - fh) / 2, 86, fly), width: lerp(fw, 176, fly), height: lerp(fh, 74, fly) }}>
          <LocationPicture w={176} h={74} />
        </div>
      ) : null}

      {/* The stills grid on the computer */}
      <div className="absolute" style={{ left: 224, top: 64, width: 400 }}>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => {
            const mine = i === 0;
            if (mine && t < F_FLY + 900) return <div key={i} className="h-[150px] rounded-[10px] border border-dashed border-border" />;
            return (
              <div key={i} className="overflow-hidden rounded-[10px] border border-border bg-surface" style={mine ? arrive(t, F_FLY + 900) : undefined}>
                <div className="h-[74px] overflow-hidden bg-[#111]"><LocationPicture w={196} h={74} alt={!mine} /></div>
                <div className="p-2">
                  <p className="text-[11px] font-extrabold">{mine ? "35mm · Alexa Mini · 2.39:1" : "50mm · Venice 2 · 16:9"}</p>
                  <p className="text-[10px] text-text-muted">{mine ? "Tilt 4° down · level" : "Tilt 2° up · level"}</p>
                  <div className="mt-1.5">
                    {mine ? <Btn press={pressed(t, F_BUILD)} tone={building ? "quiet" : "accent"} on={building}>{building ? (bp < 1 ? "Building..." : "Open its scene") : "Build a scene"}</Btn> : <Btn>Build a scene</Btn>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {building ? (
          <div className="mt-2" style={arrive(t, F_BUILD + 200)}>
            <div className="relative overflow-hidden rounded-[10px]" style={{ boxShadow: "0 0 0 1px var(--border)" }}>
              <Viewport cam={cam} look={{ room: "kitchen", build: bp, people: [], light: { on: bp, pos: [1.7, 2.1, 0.2] }, aspect: 2.39, overlay: 0 }} w={400} h={150} uid="finder" />
              <span className="absolute bottom-1.5 left-2 rounded-[5px] bg-black/60 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-white">1A · Alexa Mini · 35mm · tilt 4° down</span>
            </div>
            {t >= F_READY ? (
              <div className="mt-1.5 flex gap-1.5" style={arrive(t, F_READY)}>
                <Chip tone="green" t={t} since={F_READY}>Same camera, lens and tilt</Chip>
                <Chip tone="purple" t={t} since={F_READY + 250}>Still laid over the lens</Chip>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <ActionLabel t={t} at={F_PICK} x={PH.x + 60} y={view.y + view.h + 28} text="The lens you will shoot" />
      <ActionLabel t={t} at={F_LEVEL} x={PH.x + 30} y={view.y + view.h - 10} text="Level it" tone="green" />
      <ActionLabel t={t} at={F_SHOOT} x={PH.x + 110} y={PH.y + PH.h - 50} text="Take the still" tone="amber" />
      <ActionLabel t={t} at={F_BUILD} x={258} y={196} text="Turn it into a 3D scene" tone="purple" />
      <Burst t={t} at={F_READY} x={420} y={300} />
      <Cursor
        t={t}
        path={[
          { t: 400, x: 140, y: 300 },
          { t: F_PICK, x: PH.x + 73, y: view.y + view.h + 42, click: true },
          { t: F_SHOOT, x: PH.x + PH.w / 2, y: PH.y + PH.h - 35, click: true },
          { t: F_BUILD, x: 270, y: 202, click: true },
          { t: PV_FINDER_MS - 400, x: 470, y: 330 },
        ]}
      />
    </Window>
  );
}
