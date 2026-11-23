// The trust boundary between a model reading a location scout photo and the
// Scene Setup prototype. The model ESTIMATES a room from one photo: its size,
// the walls and openings it can see, the furniture in it, and where the photo
// was taken from. Everything comes back as a DRAFT the producer reviews before
// anything is built, and every number is clamped here, since a model reading
// one photo will happily return a 400-metre sofa.
//
// Pure (no "server-only"), so it can be tested.
import { CATALOG } from "./catalog";

export type RoomDraftOpening = { wall: "back" | "left" | "right"; kind: "window" | "door"; at: number; width: number; sill: number; top: number };
export type RoomDraftWall = "back" | "left" | "right";
export type RoomDraftItem = {
  kind: string; name: string; x: number; z: number; rot: number;
  w: number | null; d: number | null; h: number | null; color: string | null;
  /** The wall its back is pushed against, as the reader saw it. */
  against: RoomDraftWall | null;
  /** The name of the item it sits on, if any. */
  on: string | null;
};
export type RoomDraft = {
  width: number;
  depth: number;
  height: number;
  wallColor: string;
  floor: "wood" | "concrete" | "tile" | "carpet";
  walls: { back: boolean; left: boolean; right: boolean };
  openings: RoomDraftOpening[];
  items: RoomDraftItem[];
  /** Where the photo was taken from, in room coordinates, if it could tell. */
  camera: { x: number; z: number; height: number; yaw: number; focal: number } | null;
  confidence: "low" | "medium" | "high";
  notes: string;
};

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const hex = (v: unknown): string | null => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : null);
const str = (v: unknown, max = 60): string => (typeof v === "string" ? v.replace(/[\r\n]+/g, " ").trim().slice(0, max) : "");

/** Finds the JSON object in a reply that may be fenced or wrapped in prose. */
function jsonOf(raw: string): Record<string, unknown> | null {
  const s = raw.replace(/```(?:json)?/gi, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    const o = JSON.parse(s.slice(a, b + 1));
    return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const KINDS = new Set(CATALOG.filter((c) => c.category !== "model" && c.category !== "backdrop").map((c) => c.kind));

export function parseRoomDraft(raw: string): RoomDraft | null {
  const o = jsonOf(raw);
  if (!o) return null;
  const room = (o.room ?? {}) as Record<string, unknown>;
  const width = clamp(num(room.width) ?? 5, 1.5, 40);
  const depth = clamp(num(room.depth) ?? 5, 1.5, 40);
  const height = clamp(num(room.height) ?? 2.7, 2, 12);
  const floorRaw = str(room.floor, 20).toLowerCase();
  const floor = (["wood", "concrete", "tile", "carpet"] as const).find((f) => f === floorRaw) ?? "wood";
  const wallsRaw = (o.walls ?? {}) as Record<string, unknown>;
  const walls = {
    back: wallsRaw.back !== false,
    left: wallsRaw.left === true,
    right: wallsRaw.right === true,
  };

  const openings: RoomDraftOpening[] = [];
  for (const r of Array.isArray(o.openings) ? o.openings.slice(0, 12) : []) {
    const x = r as Record<string, unknown>;
    const wall = (["back", "left", "right"] as const).find((w) => w === x.wall);
    const kind = (["window", "door"] as const).find((k) => k === x.kind);
    if (!wall || !kind) continue;
    const L = wall === "back" ? width : depth;
    const w = clamp(num(x.width) ?? (kind === "door" ? 0.9 : 1.2), 0.4, L - 0.2);
    const at = clamp(num(x.at) ?? L / 2, w / 2 + 0.05, L - w / 2 - 0.05);
    const top = clamp(num(x.top) ?? (kind === "door" ? 2.05 : 2.1), 0.8, height - 0.05);
    const sill = kind === "door" ? 0 : clamp(num(x.sill) ?? 0.9, 0, top - 0.3);
    openings.push({ wall, kind, at, width: w, sill, top });
    walls[wall] = true;
  }

  const items: RoomDraftItem[] = [];
  for (const r of Array.isArray(o.items) ? o.items.slice(0, 40) : []) {
    const x = r as Record<string, unknown>;
    const kind = str(x.kind, 30);
    if (!KINDS.has(kind)) continue;
    const size = (v: unknown, hi: number) => {
      const n = num(v);
      return n === null || n <= 0 ? null : clamp(n, 0.01, hi);
    };
    items.push({
      kind,
      name: str(x.name) || (CATALOG.find((c) => c.kind === kind)?.name ?? kind),
      x: clamp(num(x.x) ?? width / 2, 0, width),
      z: clamp(num(x.z) ?? depth / 2, 0, depth),
      rot: ((((num(x.rot) ?? 0) % 360) + 540) % 360) - 180,
      w: size(x.w, 8),
      d: size(x.d, 8),
      h: size(x.h, 4),
      color: hex(x.color),
      against: (["back", "left", "right"] as const).find((w) => w === x.against) ?? null,
      on: str(x.on) || null,
    });
  }
  settleItems(items, width, depth);

  const cam = (o.camera ?? null) as Record<string, unknown> | null;
  const cx = cam ? num(cam.x) : null;
  const cz = cam ? num(cam.z) : null;
  const camera = cam && cx !== null && cz !== null
    ? {
        x: clamp(cx, 0, width),
        z: clamp(cz, 0, depth + 3),
        height: clamp(num(cam.height) ?? 1.5, 0.2, 4),
        yaw: clamp(num(cam.yaw) ?? 0, -90, 90),
        focal: clamp(num(cam.focal) ?? 24, 10, 135),
      }
    : null;

  const conf = str(o.confidence, 10).toLowerCase();
  return {
    width, depth, height,
    wallColor: hex(room.wallColor) ?? "#e3ddd2",
    floor, walls, openings, items, camera,
    confidence: conf === "high" || conf === "medium" ? conf : "low",
    notes: str(o.notes, 400),
  };
}

// ---- Placement ---------------------------------------------------------------
// A model reading one photo is poor at angles and good at naming which wall a
// counter stands against. So orientation is DERIVED here from that answer, not
// taken from the model's own rot: an item against the left wall faces right
// (rot 90) with its back flush to that wall, and so on. Items that sit ON
// another item keep their place along it when it moves.
//
// Convention (lib/previz/catalog.ts): an item faces local +Z at rot 0, and a
// positive rot turns that front toward +X, the right of the room.

function catalogSize(kind: string): { w: number; d: number } {
  const c = CATALOG.find((k) => k.kind === kind);
  return { w: c?.w ?? 0.6, d: c?.d ?? 0.6 };
}
const WALL_ROT: Record<RoomDraftWall, number> = { back: 0, left: 90, right: -90 };

export function settleItems(items: RoomDraftItem[], width: number, depth: number): void {
  const before = items.map((it) => {
    const s = catalogSize(it.kind);
    return { rot: it.rot, w: it.w ?? s.w, d: it.d ?? s.d };
  });
  for (const it of items) {
    if (!it.against) continue;
    const s = catalogSize(it.kind);
    let w = it.w ?? s.w;
    let d = it.d ?? s.d;
    // A long piece at a wall runs ALONG it. A reply that put the length in d
    // has swapped the two, since "across" and "along" are easy to mix up.
    if (d > w * 1.5) [w, d] = [d, w];
    it.w = w;
    it.d = d;
    it.rot = WALL_ROT[it.against];
    if (it.against === "back") {
      it.z = d / 2;
      it.x = clamp(it.x, Math.min(w / 2, width / 2), Math.max(width - w / 2, width / 2));
    } else {
      it.x = it.against === "left" ? d / 2 : width - d / 2;
      it.z = clamp(it.z, Math.min(w / 2, depth / 2), Math.max(depth - w / 2, depth / 2));
    }
  }
  // Things on top of a support stay on it. The reader's room positions are
  // usually right even when its angles are not, so an item keeps the spot it
  // was given and is only pulled back inside the support's footprint (now
  // that the support may have turned) if it would hang off the edge. It also
  // turns with the support, so loaves on a side counter line up along it.
  const byName = new Map(items.map((it, i) => [it.name.toLowerCase(), i]));
  items.forEach((it, i) => {
    if (!it.on) return;
    const si = byName.get(it.on.toLowerCase());
    if (si === undefined || si === i) return;
    const sup = items[si];
    const sw = sup.w ?? catalogSize(sup.kind).w;
    const sd = sup.d ?? catalogSize(sup.kind).d;
    const sideways = Math.abs(Math.abs(sup.rot) - 90) < 1;
    const hx = (sideways ? sd : sw) / 2;
    const hz = (sideways ? sw : sd) / 2;
    const own = catalogSize(it.kind);
    const iw = Math.min((it.w ?? own.w) / 2, hx * 0.9);
    const idp = Math.min((it.d ?? own.d) / 2, hz * 0.9);
    it.x = clamp(it.x, sup.x - hx + iw, sup.x + hx - iw);
    it.z = clamp(it.z, sup.z - hz + idp, sup.z + hz - idp);
    it.rot = sup.rot + (it.rot - before[si].rot);
  });
}

/** The kinds the reader may name, for the prompt. */
export const ROOM_KINDS = Array.from(KINDS);
