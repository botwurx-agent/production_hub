// Overhead rigging for the Scene Setup prototype: a studio pipe grid, a wall
// spreader and a polecat. Each one is an ordinary set item (lib/previz/
// catalog.ts) that `hangs`, so its `raise` is the height of the pipe's centre.
// A light hung from one keeps a reference to it (LightSpec.hangFrom) and is
// drawn on the nearest point of its pipes, with a clamp and a drop instead of
// a stand. Pure, no three.js, so it can be tested.
//
// Real sizes, so a gaffer reading the map is not misled: a grid's pipes are
// usually on 4 or 5 ft centres; a polecat is a spring-loaded pole that tops
// out around 12 ft; a wall spreader is a 2x4 (or speed rail) cut to the room,
// held by a spreader end at each wall, so it spans whatever the room does.
import type { ItemSpec } from "./catalog";

const FT = 0.3048;

export const RIG_KINDS = ["grid", "spreader", "polecat"] as const;
export type RigKind = (typeof RIG_KINDS)[number];

export function isRig(kind: string): kind is RigKind {
  return (RIG_KINDS as readonly string[]).includes(kind);
}

export const GRID_SPACINGS = [4 * FT, 5 * FT, 6 * FT];
export const DEFAULT_SPACING = 4 * FT;
/** The longest a polecat reaches; past this it is a wall spreader's job. */
export const POLECAT_MAX = 12 * FT;
export const POLECAT_MIN = 2 * FT;

/** What hangs under a pipe before the light starts: the clamp and a junior pin. */
export const CLAMP_DROP = 0.12;

export type Pipe = { ax: number; az: number; bx: number; bz: number };

/** A point in an item's own frame, in world x/z (same convention as footprint). */
function toWorld(s: ItemSpec, lx: number, lz: number) {
  const r = (s.rot * Math.PI) / 180;
  return { x: s.x + lx * Math.cos(r) + lz * Math.sin(r), z: s.z - lx * Math.sin(r) + lz * Math.cos(r) };
}

/** Pipe positions along one side of a grid, edges included, evenly spread. */
export function gridLines(span: number, spacing: number): number[] {
  const n = Math.max(1, Math.round(span / Math.max(0.3, spacing)));
  return Array.from({ length: n + 1 }, (_, i) => -span / 2 + (i * span) / n);
}

/** Every pipe a light could clamp to, in world x/z. */
export function rigPipes(s: ItemSpec): Pipe[] {
  const seg = (a: { x: number; z: number }, b: { x: number; z: number }): Pipe => ({ ax: a.x, az: a.z, bx: b.x, bz: b.z });
  if (s.kind === "grid") {
    const sp = s.spacing ?? DEFAULT_SPACING;
    const out: Pipe[] = [];
    for (const z of gridLines(s.d, sp)) out.push(seg(toWorld(s, -s.w / 2, z), toWorld(s, s.w / 2, z)));
    for (const x of gridLines(s.w, sp)) out.push(seg(toWorld(s, x, -s.d / 2), toWorld(s, x, s.d / 2)));
    return out;
  }
  return [seg(toWorld(s, -s.w / 2, 0), toWorld(s, s.w / 2, 0))];
}

/** The closest point on any of an item's pipes. */
export function nearestOnRig(s: ItemSpec, x: number, z: number): { x: number; z: number; dist: number } {
  let best = { x: s.x, z: s.z, dist: Infinity };
  for (const p of rigPipes(s)) {
    const dx = p.bx - p.ax;
    const dz = p.bz - p.az;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - p.ax) * dx + (z - p.az) * dz) / len2)) : 0;
    const qx = p.ax + dx * t;
    const qz = p.az + dz * t;
    const dist = Math.hypot(qx - x, qz - z);
    if (dist < best.dist) best = { x: qx, z: qz, dist };
  }
  return best;
}

/** The height of a rig's pipe centre. */
export function rigHeight(s: ItemSpec): number {
  return s.raise ?? 2.4;
}

/**
 * Where a light hung from `rig` actually sits: on the pipe nearest where it
 * was put, and below the clamp however high it was asked to go. `minDrop` is
 * the light's own distance from its centre up to the spigot.
 */
export function hangOn(rig: ItemSpec, x: number, z: number, y: number, minDrop: number): { x: number; z: number; y: number; pipeY: number } {
  const p = nearestOnRig(rig, x, z);
  const pipeY = rigHeight(rig);
  const top = pipeY - CLAMP_DROP - minDrop;
  return { x: p.x, z: p.z, y: Math.max(0.3, Math.min(y, top)), pipeY };
}

type Side = "back" | "left" | "right" | "front";

/**
 * The span from wall to wall through an item's centre along its length, for
 * a spreader or a polecat, and which wall each end lands on. Null when the
 * line never meets two sides (it is outside the room). The bounds are the
 * room's inside faces; `open` says which of those sides is NOT a wall (a
 * kitchen open to the camera side), since a spreader cannot push against air.
 */
export function wallToWall(
  s: { x: number; z: number; rot: number },
  b: { minX: number; maxX: number; minZ: number; maxZ: number },
  walls: Partial<Record<Side, boolean>> = {},
): { x: number; z: number; w: number; open: Side[] } | null {
  if (s.x <= b.minX || s.x >= b.maxX || s.z <= b.minZ || s.z >= b.maxZ) return null;
  const r = (s.rot * Math.PI) / 180;
  const ux = Math.cos(r);
  const uz = -Math.sin(r);
  // How far along +u or -u until the line leaves the box, and through which side.
  const reach = (sign: number): { t: number; side: Side } => {
    let best: { t: number; side: Side } = { t: Infinity, side: "back" };
    const dx = ux * sign;
    const dz = uz * sign;
    const tryT = (t: number, side: Side) => { if (t < best.t) best = { t, side }; };
    if (dx > 1e-9) tryT((b.maxX - s.x) / dx, "right");
    if (dx < -1e-9) tryT((b.minX - s.x) / dx, "left");
    if (dz > 1e-9) tryT((b.maxZ - s.z) / dz, "front");
    if (dz < -1e-9) tryT((b.minZ - s.z) / dz, "back");
    return best;
  };
  const p = reach(1);
  const n = reach(-1);
  if (!Number.isFinite(p.t) || !Number.isFinite(n.t)) return null;
  const mid = (p.t - n.t) / 2;
  const open = [p.side, n.side].filter((w) => walls[w] === false);
  return { x: s.x + ux * mid, z: s.z + uz * mid, w: p.t + n.t, open };
}

/** A sentence about a rig's span, or null when there is nothing to say. */
export function spanNote(s: ItemSpec, fits: boolean | null, wallSpan: number | null = null, open: string[] = []): string | null {
  if (s.kind !== "grid" && open.length) return `The ${open[0]} side of this room is open, so there is no wall there to hold that end. Turn it to run between two walls, or use a studio grid.`;
  if (s.kind === "polecat" && s.w > POLECAT_MAX + 0.01) return "Longer than a polecat goes (about 12 ft). Use a wall spreader across this one.";
  if (s.kind === "polecat" && fits === false && wallSpan !== null && wallSpan > POLECAT_MAX + 0.01) return "The walls here are further apart than a polecat reaches (about 12 ft). Use a wall spreader.";
  if (s.kind === "polecat" && s.w < POLECAT_MIN - 0.01) return "Shorter than the smallest polecat (about 2 ft).";
  if (s.kind !== "grid" && fits === false) return "Not touching two walls. It needs a wall at each end to hold.";
  return null;
}
