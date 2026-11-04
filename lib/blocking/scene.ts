// Shot blocking: the scene model. A blocking scene is a low-poly set, the
// things in it, and ONE camera, each with keyframes on a shared timeline. It
// exists to make the motion reference an AI video model follows (Seedance
// copies the camera of a reference clip), so it is built for motion, not for
// lighting truth: that is the scene builder's job.
//
// Pure (no three.js, no "server-only"), so the trust boundary below and the
// keyframe engine in ./keys.ts can be tested in node.
//
// Conventions: metres, Y up, angles in degrees. An object faces its local +Z,
// so a car drives along +Z at yaw 0. A camera at yaw 0 looks down -Z (three's
// own convention), pitch up is positive, roll clockwise is positive.

export type Vec3 = [number, number, number];

/** How a key leaves toward the next one. */
export type Ease = "smooth" | "linear" | "in" | "out" | "hold";
export const EASES: { id: Ease; name: string; hint: string }[] = [
  { id: "smooth", name: "Smooth", hint: "Eases out of this key and into the next" },
  { id: "linear", name: "Linear", hint: "Constant speed to the next key" },
  { id: "in", name: "Ease in", hint: "Starts slow, arrives fast" },
  { id: "out", name: "Ease out", hint: "Leaves fast, settles into the next key" },
  { id: "hold", name: "Hold", hint: "Stays put, then jumps at the next key" },
];

/** A transform at a moment. `r` is yaw, pitch, roll. */
export type Key = { t: number; p: Vec3; r: Vec3; ease: Ease };
/** A camera key also carries the lens. */
export type CamKey = Key & { lens: number };

export type BlockObject = {
  id: string;
  kind: string;
  name: string;
  color: string;
  /** Width, height, depth. */
  size: Vec3;
  keys: Key[];
  /** People and animals: the pose drawn. */
  pose?: string;
  /** Rides along with another object (a passenger in a car). */
  parent?: string | null;
  hidden?: boolean;
};

export type Shake = { amount: number; speed: number };

export type BlockCamera = {
  body: string;
  keys: CamKey[];
  /** Keys are relative to this object, so the camera rides along with it. */
  parent: string | null;
  shake: Shake;
  /** Smooth curves through the keys, or straight lines between them. */
  path: "smooth" | "linear";
};

export type Environment = {
  sky: string;
  ground: "grass" | "asphalt" | "sand" | "dirt" | "snow" | "studio" | "water" | "none";
  /** 0 to 1: how much distance fades into the sky. */
  haze: number;
  /** Where the sun comes from, degrees round and up. */
  sunAz: number;
  sunEl: number;
};

export type Look = "blockout" | "clay" | "lit";
export const LOOKS: { id: Look; name: string; hint: string }[] = [
  { id: "blockout", name: "Blockout", hint: "Flat colour per object: what Seedance reads best" },
  { id: "clay", name: "Clay", hint: "Grey, shaded: reads the forms alone" },
  { id: "lit", name: "Lit", hint: "Colour with sun and shadows" },
];

export type BlockScene = {
  v: 1;
  name: string;
  fps: 24 | 25 | 30;
  /** Seconds. */
  duration: number;
  aspect: string;
  look: Look;
  environment: Environment;
  objects: BlockObject[];
  camera: BlockCamera;
};

export const FPS: (24 | 25 | 30)[] = [24, 25, 30];
export const MAX_DURATION = 30;
export const MIN_DURATION = 1;

/** The frame shapes a generated clip is made in. */
export const BLOCK_ASPECTS: { id: string; label: string; ratio: number }[] = [
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "21:9", label: "21:9", ratio: 21 / 9 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
];
export const aspectRatio = (id: string) => BLOCK_ASPECTS.find((a) => a.id === id)?.ratio ?? 16 / 9;

/* ---------- the catalogue ---------- */

export type BlockCategory = "people" | "vehicles" | "environment" | "set" | "shapes";
export const BLOCK_CATEGORIES: { id: BlockCategory; name: string }[] = [
  { id: "people", name: "People and animals" },
  { id: "vehicles", name: "Vehicles" },
  { id: "environment", name: "Environment" },
  { id: "set", name: "Set pieces" },
  { id: "shapes", name: "Shapes" },
];

export type BlockKind = {
  kind: string;
  name: string;
  category: BlockCategory;
  size: Vec3;
  color: string;
  hint: string;
  /** Sits on the ground by default (y = 0). Water and sky pieces do not. */
  poses?: string[];
};

const FT = 0.3048;
export const BLOCK_KINDS: BlockKind[] = [
  { kind: "person", name: "Person", category: "people", size: [0.5, 1.75, 0.3], color: "#d98aa8", hint: "Any pose, true proportions", poses: ["standing", "walking", "seated", "pointing", "arms-crossed", "kneeling"] },
  { kind: "child", name: "Child", category: "people", size: [0.35, 1.2, 0.22], color: "#e3b26b", hint: "About eight years old", poses: ["standing", "walking", "seated", "pointing", "arms-crossed", "kneeling"] },
  { kind: "dog", name: "Dog", category: "people", size: [0.32, 0.7, 0.95], color: "#b99a72", hint: "A large dog, sitting or standing", poses: ["standing", "seated"] },
  { kind: "car", name: "Car", category: "vehicles", size: [1.85, 1.45, 4.7], color: "#e7e5df", hint: "A sedan, open cabin with seats" },
  { kind: "suv", name: "SUV", category: "vehicles", size: [2.0, 1.85, 5.1], color: "#e7e5df", hint: "Three rows, open cabin with seats" },
  { kind: "van", name: "Van", category: "vehicles", size: [2.05, 2.3, 5.6], color: "#d7d3ca", hint: "A panel van" },
  { kind: "truck", name: "Pickup", category: "vehicles", size: [2.05, 1.95, 5.9], color: "#9aa7b4", hint: "A pickup with an open bed" },
  { kind: "bike", name: "Motorbike", category: "vehicles", size: [0.8, 1.15, 2.1], color: "#3a3d44", hint: "With or without a rider" },
  { kind: "road", name: "Road", category: "environment", size: [8, 0.02, 200], color: "#3b3d42", hint: "Two lanes with a centre line" },
  { kind: "hill", name: "Hill", category: "environment", size: [60, 14, 60], color: "#7d8a58", hint: "A low-poly rise" },
  { kind: "mountain", name: "Mountain", category: "environment", size: [160, 70, 160], color: "#6f7764", hint: "Far away, on the horizon" },
  { kind: "sea", name: "Sea", category: "environment", size: [600, 0.02, 600], color: "#4a7d98", hint: "Water to the horizon" },
  { kind: "building", name: "Building", category: "environment", size: [12, 18, 12], color: "#b7aea2", hint: "A block with window rows" },
  { kind: "tree", name: "Tree", category: "environment", size: [4, 8, 4], color: "#5d7a4a", hint: "Trunk and canopy" },
  { kind: "rock", name: "Rock", category: "environment", size: [2.4, 1.6, 2.0], color: "#8b867d", hint: "A boulder" },
  { kind: "lamppost", name: "Street light", category: "environment", size: [0.3, 6, 1.2], color: "#55585e", hint: "A pole with an arm" },
  { kind: "wall", name: "Wall", category: "set", size: [6, 2.8, 0.15], color: "#d8d1c4", hint: "A section of wall" },
  { kind: "room", name: "Room", category: "set", size: [5, 2.8, 6], color: "#d8d1c4", hint: "Four walls, open on top" },
  { kind: "table", name: "Table", category: "set", size: [1.6, 0.75, 0.9], color: "#8a6a4d", hint: "A dining table" },
  { kind: "sofa", name: "Sofa", category: "set", size: [2.1, 0.85, 0.92], color: "#8b8f97", hint: "Three seater" },
  { kind: "bed", name: "Bed", category: "set", size: [1.6, 0.55, 2.1], color: "#e9e6df", hint: "Queen" },
  { kind: "counter", name: "Counter", category: "set", size: [2.4, 0.9, 0.62], color: "#cfc8bb", hint: "Kitchen worktop" },
  { kind: "door", name: "Doorway", category: "set", size: [1.2, 2.4, 0.15], color: "#d8d1c4", hint: "A wall with a door opening" },
  { kind: "stairs", name: "Stairs", category: "set", size: [1.2, 1.8, 3], color: "#bdb5a8", hint: "A straight flight" },
  { kind: "product", name: "Product", category: "set", size: [0.08, 0.26, 0.08], color: "#4fb3a3", hint: "A bottle-sized hero product" },
  { kind: "box", name: "Box", category: "shapes", size: [1, 1, 1], color: "#c9c3b8", hint: "Stands in for anything" },
  { kind: "cylinder", name: "Cylinder", category: "shapes", size: [1, 1, 1], color: "#c9c3b8", hint: "A column or a can" },
  { kind: "sphere", name: "Sphere", category: "shapes", size: [1, 1, 1], color: "#c9c3b8", hint: "A ball or a head" },
  { kind: "ramp", name: "Ramp", category: "shapes", size: [2, 1, 3], color: "#c9c3b8", hint: "A wedge" },
  { kind: "target", name: "Target", category: "shapes", size: [0.4, 0.4, 0.4], color: "#f2c14e", hint: "An invisible point to aim the camera at" },
];
export const blockKind = (kind: string): BlockKind => BLOCK_KINDS.find((k) => k.kind === kind) ?? BLOCK_KINDS.find((k) => k.kind === "box")!;

/** Colours a blockout cycles through, so neighbouring subjects read apart. */
export const SUBJECT_COLORS = ["#d98aa8", "#6f9bd8", "#e3b26b", "#8cc27a", "#b48ad9", "#e07f5f", "#5fc0c0", "#d9d36a"];

let seq = 0;
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export function newObject(kind: string, p: Vec3 = [0, 0, 0], yaw = 0, used: BlockObject[] = []): BlockObject {
  const k = blockKind(kind);
  // People get the next subject colour that is not already on the set, so two
  // people never arrive in the same colour.
  let color = k.color;
  if (k.category === "people" && kind !== "dog") {
    const taken = new Set(used.map((o) => o.color));
    color = SUBJECT_COLORS.find((c) => !taken.has(c)) ?? k.color;
  }
  const count = used.filter((o) => o.kind === kind).length;
  return {
    id: newId("o"),
    kind,
    name: count ? `${k.name} ${count + 1}` : k.name,
    color,
    size: [...k.size] as Vec3,
    keys: [{ t: 0, p, r: [yaw, 0, 0], ease: "smooth" }],
    pose: k.poses?.[0],
    parent: null,
  };
}

export const DEFAULT_ENV: Environment = { sky: "#b9cde0", ground: "grass", haze: 0.35, sunAz: 140, sunEl: 40 };

export function blankScene(name = "Untitled blocking"): BlockScene {
  return {
    v: 1,
    name,
    fps: 24,
    duration: 8,
    aspect: "16:9",
    look: "blockout",
    environment: { ...DEFAULT_ENV, ground: "studio", sky: "#9fa4ab", haze: 0.15 },
    objects: [],
    camera: {
      body: "alexamini",
      keys: [{ t: 0, p: [0, 1.6, 6], r: [0, -4, 0], lens: 35, ease: "smooth" }],
      parent: null,
      shake: { amount: 0, speed: 1 },
      path: "smooth",
    },
  };
}

/* ---------- the trust boundary ---------- */

const num = (v: unknown, d: number, lo = -1e5, hi = 1e5) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const vec = (v: unknown, d: Vec3, lo?: number, hi?: number): Vec3 =>
  Array.isArray(v) ? [num(v[0], d[0], lo, hi), num(v[1], d[1], lo, hi), num(v[2], d[2], lo, hi)] : d;
const str = (v: unknown, d: string, max = 120) => (typeof v === "string" ? v.slice(0, max) : d);
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
const ease = (v: unknown): Ease => (EASES.some((e) => e.id === v) ? (v as Ease) : "smooth");

function keyOf(raw: unknown, duration: number): Key | null {
  if (!raw || typeof raw !== "object") return null;
  const k = raw as Record<string, unknown>;
  return { t: num(k.t, 0, 0, duration), p: vec(k.p, [0, 0, 0]), r: vec(k.r, [0, 0, 0], -36000, 36000), ease: ease(k.ease) };
}

/** Keys in time order, one per frame at most (a later duplicate wins). */
export function tidyKeys<T extends Key>(keys: T[], fps: number): T[] {
  const half = 0.5 / fps;
  const out: T[] = [];
  for (const k of [...keys].sort((a, b) => a.t - b.t)) {
    const last = out[out.length - 1];
    if (last && k.t - last.t < half) out[out.length - 1] = k;
    else out.push(k);
  }
  return out;
}

const MAX_OBJECTS = 300;
const MAX_KEYS = 400;

/** Reads a stored or uploaded scene. Anything unreadable becomes null. */
export function asBlockScene(raw: unknown): BlockScene | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (s.v !== 1) return null;
  const fps = FPS.includes(s.fps as 24) ? (s.fps as 24 | 25 | 30) : 24;
  const duration = num(s.duration, 8, MIN_DURATION, MAX_DURATION);
  const envRaw = (s.environment ?? {}) as Record<string, unknown>;
  const grounds: Environment["ground"][] = ["grass", "asphalt", "sand", "dirt", "snow", "studio", "water", "none"];
  const environment: Environment = {
    sky: hex(envRaw.sky, DEFAULT_ENV.sky),
    ground: grounds.includes(envRaw.ground as "grass") ? (envRaw.ground as Environment["ground"]) : "grass",
    haze: num(envRaw.haze, DEFAULT_ENV.haze, 0, 1),
    sunAz: num(envRaw.sunAz, DEFAULT_ENV.sunAz, -360, 360),
    sunEl: num(envRaw.sunEl, DEFAULT_ENV.sunEl, 2, 90),
  };
  const ids = new Set<string>();
  const objects: BlockObject[] = [];
  for (const o of Array.isArray(s.objects) ? s.objects.slice(0, MAX_OBJECTS) : []) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const id = str(r.id, "", 60);
    if (!id || ids.has(id)) continue;
    const kind = BLOCK_KINDS.some((k) => k.kind === r.kind) ? (r.kind as string) : "box";
    const keys = tidyKeys(
      (Array.isArray(r.keys) ? r.keys.slice(0, MAX_KEYS) : []).map((k) => keyOf(k, duration)).filter((k): k is Key => !!k),
      fps,
    );
    if (!keys.length) continue;
    ids.add(id);
    const bk = blockKind(kind);
    objects.push({
      id,
      kind,
      name: str(r.name, bk.name).trim() || bk.name,
      color: hex(r.color, bk.color),
      size: vec(r.size, bk.size, 0.01, 2000),
      keys,
      pose: bk.poses ? (bk.poses.includes(r.pose as string) ? (r.pose as string) : bk.poses[0]) : undefined,
      parent: typeof r.parent === "string" ? r.parent : null,
      hidden: r.hidden === true,
    });
  }
  // A parent must exist and must not lead back round to the object itself.
  const byId = new Map(objects.map((o) => [o.id, o]));
  for (const o of objects) {
    let p = o.parent ? byId.get(o.parent) : undefined;
    const seen = new Set([o.id]);
    while (p && !seen.has(p.id)) { seen.add(p.id); p = p.parent ? byId.get(p.parent) : undefined; }
    if (!o.parent || !byId.has(o.parent) || p) o.parent = null;
  }

  const camRaw = (s.camera ?? {}) as Record<string, unknown>;
  const camKeys = tidyKeys(
    (Array.isArray(camRaw.keys) ? camRaw.keys.slice(0, MAX_KEYS) : [])
      .map((k) => {
        const base = keyOf(k, duration);
        if (!base) return null;
        return { ...base, lens: num((k as Record<string, unknown>).lens, 35, 8, 600) } as CamKey;
      })
      .filter((k): k is CamKey => !!k),
    fps,
  );
  const shakeRaw = (camRaw.shake ?? {}) as Record<string, unknown>;
  const camera: BlockCamera = {
    body: str(camRaw.body, "alexamini", 40),
    keys: camKeys.length ? camKeys : blankScene().camera.keys,
    parent: typeof camRaw.parent === "string" && byId.has(camRaw.parent) ? camRaw.parent : null,
    shake: { amount: num(shakeRaw.amount, 0, 0, 1), speed: num(shakeRaw.speed, 1, 0.1, 4) },
    path: camRaw.path === "linear" ? "linear" : "smooth",
  };
  return {
    v: 1,
    name: str(s.name, "Untitled blocking").trim() || "Untitled blocking",
    fps,
    duration,
    aspect: BLOCK_ASPECTS.some((a) => a.id === s.aspect) ? (s.aspect as string) : "16:9",
    look: LOOKS.some((l) => l.id === s.look) ? (s.look as Look) : "blockout",
    environment,
    objects,
    camera,
  };
}

export { FT };
