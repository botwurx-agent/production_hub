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
export type RoomDraftItem = { kind: string; name: string; x: number; z: number; rot: number; w: number | null; d: number | null; h: number | null; color: string | null };
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
    });
  }

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

/** The kinds the reader may name, for the prompt. */
export const ROOM_KINDS = Array.from(KINDS);
