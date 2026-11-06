// create_blocking_scene, the pure half: turns a scene described in plain
// production terms (things on a set, where they are, how they move, what the
// camera does) into a BlockScene the blocking studio opens as it would one
// built by hand. No "server-only", so it is tested in node.
//
// The assistant cannot see the 3D, so the input is deliberately in terms it
// can reason about without seeing: metres on a floor plan, "face toward" an
// object rather than a yaw, "look at" an object rather than a pitch, a move
// by name (push in, orbit) rather than a curve. The angles are worked out
// here. Whatever comes out still goes through asBlockScene, the same trust
// boundary a saved scene passes, so nothing here can write a scene the page
// could not have saved.
//
// Conventions handed to the assistant: metres, x to the right, z toward the
// camera's usual side (the front of the set is +z), y up. An object at yaw 0
// faces +z, which is why "face_toward" is easier to get right than a number.

import { CAMERA_RIGS } from "@/lib/blocking/rigs";
import { aimAt, evalTrack, presetKeys, PRESETS, type PresetId } from "@/lib/blocking/keys";
import {
  asBlockScene,
  BLOCK_ASPECTS,
  BLOCK_KINDS,
  BODY_BUILDS,
  blankScene,
  blockKind,
  GESTURES,
  HAIR_STYLES,
  LEAN_MAX,
  LEAN_MIN,
  LOOKS,
  MAX_DURATION,
  MIN_DURATION,
  newObject,
  type BlockObject,
  type BlockScene,
  type CamKey,
  type Ease,
  type Environment,
  type GestureKind,
  type Key,
  type Vec3,
} from "@/lib/blocking/scene";
import { TEMPLATES } from "@/lib/blocking/templates";
import { BODIES } from "@/lib/previz/optics";

export const MAX_OBJECTS_PER_CALL = 120;
export const MAX_MOVES = 60;
export const MAX_GESTURES = 12;
export const MAX_CAMERA_KEYS = 40;
/** How long a gesture takes to come up, and to go back down. */
export const GESTURE_RISE = 0.6;

type Json = Record<string, unknown>;

const SKIES: Record<string, string> = {
  day: "#b9cde0",
  morning: "#c9d6e2",
  golden: "#e2c29a",
  dusk: "#c9a38f",
  overcast: "#c3cbd4",
  night: "#1d2430",
  studio: "#9fa4ab",
  black: "#1d1f23",
};
const GROUNDS: Environment["ground"][] = ["grass", "asphalt", "sand", "dirt", "snow", "studio", "water", "none"];
/** Flat ground pieces something can stand on. */
const FLAT_GROUND = new Set(["road", "sidewalk", "crosswalk", "parking", "lawn", "path", "rug", "rails"]);
const EASE_IDS: Ease[] = ["smooth", "linear", "in", "out", "hold"];

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const text = (v: unknown, max = 120): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const point = (v: unknown): Vec3 | null => {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const p = v.map(num);
  return p.every((x) => x !== null) ? (p as Vec3) : null;
};
const deg = (r: number) => (r * 180) / Math.PI;
/** The yaw that turns an object at `from` to face `to` (yaw 0 faces +z). */
const faceYaw = (from: Vec3, to: Vec3) => deg(Math.atan2(to[0] - from[0], to[2] - from[2]));

/** The words for the catalogue, for the tool's description. */
export function catalogueText(): string {
  const byCat = new Map<string, string[]>();
  for (const k of BLOCK_KINDS) {
    const list = byCat.get(k.category) ?? [];
    list.push(k.poses ? `${k.kind} (poses: ${k.poses.join(", ")})` : k.seats ? `${k.kind} (seats: ${k.seats.map((s) => s.id).join(", ")})` : k.kind);
    byCat.set(k.category, list);
  }
  return [...byCat.entries()].map(([c, l]) => `${c}: ${l.join(", ")}`).join("; ");
}

export const GESTURE_IDS = GESTURES.map((g) => g.id) as string[];
export const PRESET_IDS = PRESETS.map((p) => p.id) as string[];
export const BODY_IDS = BODIES.map((b) => b.id);

export type BuildResult = { scene: BlockScene; skipped: string[]; refs: Record<string, string> };

/** Where something is aimed at: an object's head height, or the middle of it. */
function aimHeight(o: BlockObject): number {
  if (o.kind === "person" || o.kind === "child") return o.size[1] * (o.pose === "seated" ? 0.62 : o.pose === "kneeling" ? 0.68 : 0.9);
  if (o.kind === "dog") return o.size[1] * 0.85;
  return o.size[1] * 0.5;
}

/** An object's aim point at time t, in its own parent's frame. */
/**
 * The smallest room whose walls surround a point, and how far a camera can
 * circle that point before reaching a wall (keeping 0.35 m clear). Rooms are
 * read at their first key, in their own turned frame.
 */
export function orbitRoom(objects: BlockObject[], at: Vec3): { name: string; room: number } | null {
  let best: { name: string; room: number; area: number } | null = null;
  for (const o of objects) {
    if (o.kind !== "room" || o.hidden) continue;
    const k = o.keys[0];
    if (!k) continue;
    const yaw = (k.r[0] * Math.PI) / 180;
    const dx = at[0] - k.p[0];
    const dz = at[2] - k.p[2];
    const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const [W, , D] = o.size;
    if (Math.abs(lx) >= W / 2 || Math.abs(lz) >= D / 2) continue;
    const room = Math.min(W / 2 - Math.abs(lx), D / 2 - Math.abs(lz)) - 0.35;
    const area = W * D;
    if (!best || area < best.area) best = { name: o.name, room, area };
  }
  return best && { name: best.name, room: best.room };
}

function aimPointOf(o: BlockObject, t: number): Vec3 {
  const p = evalTrack(o.keys, t).p;
  return [p[0], p[1] + aimHeight(o), p[2]];
}

/** Put a gesture value on the key at t, or a new key there carrying the pose the object has at t. */
function gestureKey(keys: Key[], t: number, fps: number, g: [number, number], gk: GestureKind): Key[] {
  const half = 0.5 / fps;
  const at = keys.findIndex((k) => Math.abs(k.t - t) < half);
  if (at >= 0) {
    const k = { ...keys[at], g, ...(gk === "reach" ? {} : { gk }) };
    if (gk === "reach") delete k.gk;
    return keys.map((x, i) => (i === at ? k : x));
  }
  const pose = evalTrack(keys, t);
  const before = [...keys].reverse().find((k) => k.t < t);
  const key: Key = { t, p: pose.p, r: pose.r, ease: before?.ease ?? "smooth", g, ...(gk === "reach" ? {} : { gk }) };
  return [...keys, key].sort((a, b) => a.t - b.t);
}

/**
 * Builds the scene. Anything that cannot be read is left out and named in
 * `skipped`, rather than refusing the whole scene: a dropped tree costs a
 * line, a refused scene costs the conversation.
 */
export function buildBlockingScene(input: Json, base?: BlockScene): BuildResult | { error: string } {
  const skipped: string[] = [];

  // EDIT MODE: with a base scene, everything below changes that scene rather
  // than starting one. Its objects keep their ids and keys unless a `change`
  // names them, and its camera is kept unless `camera` is given.
  let s: BlockScene;
  let fromTemplate: boolean;
  if (base) {
    s = JSON.parse(JSON.stringify(base)) as BlockScene;
    fromTemplate = true;
  } else {
    // Start from a template when asked, else an empty stage.
    const templateId = text(input.template, 40).toLowerCase();
    const template = templateId ? TEMPLATES.find((t) => t.id === templateId || t.name.toLowerCase() === templateId) : undefined;
    if (templateId && !template) skipped.push(`template "${templateId}" is not one of ${TEMPLATES.map((t) => t.id).join(", ")}; started from an empty stage`);
    s = template ? template.make() : blankScene();
    fromTemplate = !!template;
    if (!fromTemplate) s.objects = [];
  }

  const name = text(input.name, 120);
  if (name) s.name = name;
  const dur = num(input.duration);
  if (dur !== null) s.duration = clamp(dur, MIN_DURATION, MAX_DURATION);
  const fps = num(input.fps);
  if (fps === 24 || fps === 25 || fps === 30) s.fps = fps;
  const aspect = text(input.aspect, 8);
  if (aspect) {
    if (BLOCK_ASPECTS.some((a) => a.id === aspect)) s.aspect = aspect;
    else skipped.push(`aspect "${aspect}" (use ${BLOCK_ASPECTS.map((a) => a.id).join(", ")})`);
  }
  const look = text(input.look, 20).toLowerCase();
  if (look && LOOKS.some((l) => l.id === look)) s.look = look as BlockScene["look"];

  // Environment.
  if (isObj(input.environment)) {
    const e = input.environment;
    const env = { ...s.environment };
    const ground = text(e.ground, 20).toLowerCase();
    if (ground) {
      if (GROUNDS.includes(ground as Environment["ground"])) env.ground = ground as Environment["ground"];
      else skipped.push(`ground "${ground}"`);
    }
    const sky = text(e.sky, 20).toLowerCase();
    if (sky) {
      if (/^#[0-9a-f]{6}$/i.test(sky)) env.sky = sky;
      else if (SKIES[sky]) env.sky = SKIES[sky];
      else skipped.push(`sky "${sky}"`);
    }
    const haze = num(e.haze);
    if (haze !== null) env.haze = clamp(haze, 0, 1);
    const az = num(e.sun_azimuth);
    if (az !== null) env.sunAz = clamp(az, -360, 360);
    const el = num(e.sun_elevation);
    if (el !== null) env.sunEl = clamp(el, 2, 90);
    s.environment = env;
  }

  // Objects. `ref` is the assistant's own name for a thing, so it can point
  // at it from another object or the camera before any id exists.
  const refs: Record<string, string> = {};
  const byRef = new Map<string, BlockObject>();
  const rawObjects = Array.isArray(input.objects) ? input.objects : [];
  if (rawObjects.length > MAX_OBJECTS_PER_CALL) skipped.push(`${rawObjects.length - MAX_OBJECTS_PER_CALL} objects past the ${MAX_OBJECTS_PER_CALL} per call`);
  type Pending = { o: BlockObject; raw: Json; ref: string; change?: boolean };
  const pending: Pending[] = [];
  const findByName = (v: unknown): BlockObject | undefined => {
    const r = text(v, 60).toLowerCase();
    return r ? s.objects.find((o) => o.name.toLowerCase() === r) : undefined;
  };

  // Edit mode: take things out first, so a `change` or a new object cannot
  // point at something that is about to go.
  if (base && Array.isArray(input.remove)) {
    for (const r of input.remove.slice(0, MAX_OBJECTS_PER_CALL)) {
      const o = findByName(r);
      if (!o) { skipped.push(`remove "${text(r, 60)}": nothing here is called that`); continue; }
      s.objects = s.objects.filter((x) => x.id !== o.id);
      // Anything riding with it now stands where it was, in the world.
      for (const x of s.objects) if (x.parent === o.id) x.parent = null;
      if (s.camera.parent === o.id) s.camera.parent = null;
      if (s.camera.aim.target === o.id) s.camera.aim = { ...s.camera.aim, target: null };
      for (const x of s.objects) if (x.reach?.target === o.id) x.reach = { ...x.reach, target: null };
    }
  }
  rawObjects.slice(0, MAX_OBJECTS_PER_CALL).forEach((raw, i) => {
    if (!isObj(raw)) return;
    const kind = text(raw.kind, 30).toLowerCase();
    const label = text(raw.name, 60) || text(raw.ref, 60) || kind || `object ${i + 1}`;
    if (!BLOCK_KINDS.some((k) => k.kind === kind)) {
      skipped.push(`${label}: kind "${kind}" is not in the catalogue (use a box, cylinder or sphere for anything else)`);
      return;
    }
    const x = num(raw.x) ?? 0;
    const y = num(raw.y) ?? 0;
    const z = num(raw.z) ?? 0;
    const o = newObject(kind, [x, y, z], 0, s.objects);
    const bk = blockKind(kind);
    if (text(raw.name, 60)) o.name = text(raw.name, 60);
    const size = point(raw.size);
    if (size) o.size = size.map((v) => clamp(v, 0.01, 2000)) as Vec3;
    else {
      const scale = num(raw.scale);
      if (scale !== null) o.size = bk.size.map((v) => clamp(v * scale, 0.01, 2000)) as Vec3;
      // A person given only a height keeps their proportions.
      const height = num(raw.height);
      if (height !== null && (kind === "person" || kind === "child")) {
        const k = clamp(height, 0.5, 2.4) / bk.size[1];
        o.size = [bk.size[0] * k, clamp(height, 0.5, 2.4), bk.size[2] * k];
      }
    }
    const color = text(raw.color, 7);
    if (/^#[0-9a-f]{6}$/i.test(color)) o.color = color;
    const pose = text(raw.pose, 20).toLowerCase();
    if (pose) {
      if (bk.poses?.includes(pose)) o.pose = pose;
      else skipped.push(`${o.name}: pose "${pose}"${bk.poses ? ` (use ${bk.poses.join(", ")})` : " (this kind has no poses)"}`);
    }
    const seats = text(raw.seats, 20).toLowerCase();
    if (seats && bk.seats?.some((x) => x.id === seats)) o.seats = seats;
    if (kind === "person" || kind === "child") {
      const build = text(raw.build, 20).toLowerCase();
      if (build && BODY_BUILDS.some((b) => b.id === build)) o.build = build as BlockObject["build"];
      const hair = text(raw.hair, 20).toLowerCase();
      const hairId = hair === "tied up" || hair === "tied" ? "bun" : hair === "none" ? "bald" : hair;
      if (hairId && HAIR_STYLES.some((h) => h.id === hairId)) o.hair = hairId as BlockObject["hair"];
    }
    s.objects.push(o);
    const ref = text(raw.ref, 60) || text(raw.name, 60);
    if (ref) {
      if (byRef.has(ref.toLowerCase())) skipped.push(`${o.name}: the ref "${ref}" was used twice; the first keeps it`);
      else {
        byRef.set(ref.toLowerCase(), o);
        refs[ref] = o.id;
      }
    }
    pending.push({ o, raw, ref });
  });
  // Edit mode: changes to things already in the scene, named as they are in
  // the studio's list. Only what a change says is touched.
  if (base && Array.isArray(input.change)) {
    for (const raw of input.change.slice(0, MAX_OBJECTS_PER_CALL)) {
      if (!isObj(raw)) continue;
      const o = findByName(raw.name);
      if (!o) { skipped.push(`change "${text(raw.name, 60)}": nothing here is called that`); continue; }
      const bk = blockKind(o.kind);
      const rename = text(raw.rename, 60);
      if (rename) o.name = rename;
      const color = text(raw.color, 7);
      if (/^#[0-9a-f]{6}$/i.test(color)) o.color = color;
      const pose = text(raw.pose, 20).toLowerCase();
      if (pose) {
        if (bk.poses?.includes(pose)) o.pose = pose;
        else skipped.push(`${o.name}: pose "${pose}"${bk.poses ? ` (use ${bk.poses.join(", ")})` : " (this kind has no poses)"}`);
      }
      const size = point(raw.size);
      if (size) o.size = size.map((v) => clamp(v, 0.01, 2000)) as Vec3;
      const height = num(raw.height);
      if (!size && height !== null && (o.kind === "person" || o.kind === "child")) {
        const k = clamp(height, 0.5, 2.4) / o.size[1];
        o.size = [o.size[0] * k, clamp(height, 0.5, 2.4), o.size[2] * k];
      }
      // A new position, facing or route starts the object's track again from
      // there; gestures alone are added to the track it has.
      const placed = raw.x !== undefined || raw.z !== undefined || raw.y !== undefined || raw.facing !== undefined || raw.face_toward !== undefined || Array.isArray(raw.moves);
      if (placed) {
        const at = o.keys[0];
        o.keys = [{ ...at, p: [num(raw.x) ?? at.p[0], num(raw.y) ?? at.p[1], num(raw.z) ?? at.p[2]], r: [...at.r] as Vec3 }];
        if (raw.facing === undefined && raw.face_toward === undefined) (raw as Json).facing = at.r[0];
      }
      if (Array.isArray(raw.gestures)) o.keys = o.keys.filter((k) => !k.g || k.t === o.keys[0].t);
      byRef.set(o.name.toLowerCase(), o);
      pending.push({ o, raw, ref: o.name, change: !placed });
    }
  }
  const lookup = (v: unknown): BlockObject | undefined => {
    const r = text(v, 60).toLowerCase();
    return r ? byRef.get(r) ?? s.objects.find((o) => o.name.toLowerCase() === r) : undefined;
  };

  // Parents first, so a passenger's coordinates are read in the car's frame.
  for (const { o, raw } of pending) {
    if (raw.rides_with === undefined) continue;
    const p = lookup(raw.rides_with);
    if (!p || p.id === o.id) skipped.push(`${o.name}: rides_with "${text(raw.rides_with, 60)}" is not an object in this scene`);
    else o.parent = p.id;
  }

  // Facing, then moves.
  for (const { o, raw, change } of pending) {
    if (change) continue;
    const start = o.keys[0].p;
    let yaw = num(raw.facing) ?? 0;
    if (raw.face_toward !== undefined) {
      const t = point(raw.face_toward) ?? (() => { const ob = lookup(raw.face_toward); return ob && ob.parent === o.parent ? ob.keys[0].p : null; })();
      if (t) yaw = faceYaw(start, t);
      else skipped.push(`${o.name}: face_toward "${text(raw.face_toward, 60)}" (an object in the same frame, or [x, y, z])`);
    }
    o.keys = [{ t: 0, p: start, r: [yaw, 0, 0], ease: "smooth" }];

    const moves = Array.isArray(raw.moves) ? raw.moves.slice(0, MAX_MOVES) : [];
    if (!moves.length) continue;
    const ease = (EASE_IDS.includes(text(raw.ease, 10) as Ease) ? text(raw.ease, 10) : "linear") as Ease;
    // A moving thing goes at an even pace unless told otherwise: a walk or a
    // drive that eases in and out of every point reads as stopping and starting.
    o.keys[0].ease = ease;
    let last = o.keys[0];
    const added: Key[] = [];
    for (const m of moves) {
      if (!isObj(m)) continue;
      const t = num(m.t);
      if (t === null || t <= 0 || t > s.duration) {
        skipped.push(`${o.name}: a move at t=${String(m.t)} (needs 0 < t <= ${s.duration})`);
        continue;
      }
      const p: Vec3 = [num(m.x) ?? last.p[0], num(m.y) ?? last.p[1], num(m.z) ?? last.p[2]];
      let y = num(m.facing);
      if (y === null && m.face_toward !== undefined) {
        const tp = point(m.face_toward) ?? lookup(m.face_toward)?.keys[0].p ?? null;
        if (tp) y = faceYaw(p, tp);
      }
      // Unsaid, a moving thing faces the way it is going.
      if (y === null) {
        const d = Math.hypot(p[0] - last.p[0], p[2] - last.p[2]);
        y = d > 0.05 ? faceYaw(last.p, p) : last.r[0];
        if (!added.length && raw.facing === undefined && raw.face_toward === undefined && d > 0.05) o.keys[0].r = [y, 0, 0];
      }
      const k: Key = { t, p, r: [y, 0, 0], ease: (EASE_IDS.includes(text(m.ease, 10) as Ease) ? text(m.ease, 10) : ease) as Ease };
      added.push(k);
      last = k;
    }
    o.keys = [...o.keys, ...added].sort((a, b) => a.t - b.t);
  }

  // Things put down on a flat ground piece (a raised sidewalk, a lawn, a rug)
  // stand on top of it rather than sinking into it, unless a height was given.
  const flats = s.objects.filter((o) => FLAT_GROUND.has(o.kind) && !o.parent);
  const groundAt = (x: number, z: number): number => {
    let top = 0;
    for (const f of flats) {
      const [fx, fy, fz] = f.keys[0].p;
      const a = (-f.keys[0].r[0] * Math.PI) / 180;
      const dx = x - fx, dz = z - fz;
      const lx = dx * Math.cos(a) + dz * Math.sin(a);
      const lz = -dx * Math.sin(a) + dz * Math.cos(a);
      if (Math.abs(lx) <= f.size[0] / 2 && Math.abs(lz) <= f.size[2] / 2) top = Math.max(top, fy + f.size[1]);
    }
    return top;
  };
  for (const { o, raw, change } of pending) {
    if (change) continue;
    if (o.parent || FLAT_GROUND.has(o.kind) || blockKind(o.kind).category === "environment") continue;
    const moves = Array.isArray(raw.moves) ? raw.moves.filter(isObj) : [];
    o.keys = o.keys.map((k, i) => {
      const given = i === 0 ? raw.y !== undefined : moves.some((m) => num(m.t) === k.t && m.y !== undefined);
      return given ? k : { ...k, p: [k.p[0], groundAt(k.p[0], k.p[2]), k.p[2]] as Vec3 };
    });
  }

  // Gestures, for people.
  for (const { o, raw } of pending) {
    const gs = Array.isArray(raw.gestures) ? raw.gestures.slice(0, MAX_GESTURES) : [];
    if (!gs.length) continue;
    if (o.kind !== "person" && o.kind !== "child") {
      skipped.push(`${o.name}: only people gesture`);
      continue;
    }
    let toward: string | null = null;
    let hand: "right" | "left" = "right";
    let stroke = false;
    for (const g of gs) {
      if (!isObj(g)) continue;
      const kind = text(g.gesture, 20).toLowerCase();
      const spec = GESTURES.find((x) => x.id === kind);
      if (!spec) {
        skipped.push(`${o.name}: gesture "${kind}" (use ${GESTURE_IDS.join(", ")})`);
        continue;
      }
      const at = clamp(num(g.at) ?? 0, 0, s.duration);
      const until = num(g.until);
      const lean = clamp(num(g.lean) ?? 0, LEAN_MIN, LEAN_MAX);
      if (g.toward !== undefined) {
        const t = lookup(g.toward);
        if (t && t.id !== o.id) toward = t.id;
        else skipped.push(`${o.name}: ${kind} toward "${text(g.toward, 60)}" is not an object here`);
      }
      if (spec.target === "required" && !toward) {
        skipped.push(`${o.name}: "${kind}" needs toward (an object to reach for)`);
        continue;
      }
      if (g.hand === "left") hand = "left";
      if (g.stroke === true) stroke = true;
      const gk = spec.id as GestureKind;
      const up = Math.max(0, at - GESTURE_RISE);
      if (up < at) o.keys = gestureKey(o.keys, up, s.fps, [0, 0], gk);
      o.keys = gestureKey(o.keys, at, s.fps, [1, lean], gk);
      const end = until !== null ? clamp(until, at, s.duration) : null;
      if (end !== null && end > at) {
        o.keys = gestureKey(o.keys, end, s.fps, [1, lean], gk);
        const down = Math.min(s.duration, end + GESTURE_RISE);
        if (down > end) o.keys = gestureKey(o.keys, down, s.fps, [0, 0], gk);
      }
    }
    o.reach = { target: toward, hand, stroke };
  }

  // The camera.
  const cam = isObj(input.camera) ? input.camera : null;
  if (cam || !fromTemplate) {
    const c = cam ?? {};
    const body = text(c.body, 30).toLowerCase();
    if (body) {
      if (BODY_IDS.includes(body)) s.camera.body = body;
      else skipped.push(`camera body "${body}" (use ${BODY_IDS.join(", ")})`);
    }
    const lens = clamp(num(c.lens) ?? 35, 8, 600);
    if (c.rides_with !== undefined) {
      const p = lookup(c.rides_with);
      if (p) s.camera.parent = p.id;
      else skipped.push(`camera rides_with "${text(c.rides_with, 60)}" is not an object here`);
    }

    // What the camera points at when a key does not say: the first person, or
    // the middle of everything that is not ground.
    const subjects = s.objects.filter((o) => o.parent === s.camera.parent && o.kind !== "target" && blockKind(o.kind).category !== "environment");
    const people = subjects.filter((o) => o.kind === "person" || o.kind === "child" || o.kind === "dog");
    const defaultLook: Vec3 = people.length
      ? aimPointOf(people[0], 0)
      : subjects.length
        ? (() => {
            const pts = subjects.map((o) => aimPointOf(o, 0));
            return [0, 1, 2].map((i) => pts.reduce((a, p) => a + p[i], 0) / pts.length) as Vec3;
          })()
        : [0, 1.2, 0];
    const lookPoint = (v: unknown, t: number): Vec3 | null => {
      const pt = point(v);
      if (pt) return pt;
      const ob = lookup(v);
      if (!ob) return null;
      if (ob.parent !== s.camera.parent) return null;
      return aimPointOf(ob, t);
    };

    const keys: CamKey[] = [];
    for (const k of (Array.isArray(c.keys) ? c.keys : []).slice(0, MAX_CAMERA_KEYS)) {
      if (!isObj(k)) continue;
      const t = clamp(num(k.t) ?? 0, 0, s.duration);
      const p = point([k.x, k.y, k.z]) ?? point(k.position);
      if (!p) {
        skipped.push(`camera key at ${t}s: needs x, y and z`);
        continue;
      }
      let look = k.look_at !== undefined ? lookPoint(k.look_at, t) : null;
      if (k.look_at !== undefined && !look) {
        const ob = lookup(k.look_at);
        if (ob && !s.camera.aim.target) s.camera.aim = { target: ob.id, frame: [0, 0] };
        skipped.push(`camera key at ${t}s: look_at "${text(k.look_at, 60)}" is ${ob ? "in another frame; the camera keeps aimed at it instead" : "not an object here, or [x, y, z]"}`);
      }
      look = look ?? defaultLook;
      const a = aimAt(p, look);
      const easeId = text(k.ease, 10);
      keys.push({
        t,
        p,
        r: [a.yaw, a.pitch, clamp(num(k.roll) ?? 0, -90, 90)],
        lens: clamp(num(k.lens) ?? lens, 8, 600),
        ease: (EASE_IDS.includes(easeId as Ease) ? easeId : "smooth") as Ease,
      });
    }

    const move = isObj(c.move) ? c.move : null;
    // Editing, a move with no keys of its own starts from the camera as it is.
    if (base && move && !keys.length) keys.push(...s.camera.keys.map((k) => ({ ...k })));
    if (move) {
      const id = text(move.preset, 20).toLowerCase() as PresetId;
      if (!PRESET_IDS.includes(id)) skipped.push(`camera move "${id}" (use ${PRESET_IDS.join(", ")})`);
      else {
        const t0 = clamp(num(move.start) ?? 0, 0, s.duration);
        const d = clamp(num(move.duration) ?? s.duration - t0, 0.3, s.duration - t0 || s.duration);
        const target = (move.target !== undefined ? lookPoint(move.target, t0) : null) ?? defaultLook;
        const from = keys.filter((k) => k.t <= t0).pop() ?? keys[0];
        let startP: Vec3 = from?.p ?? [target[0], Math.max(1.4, target[1]), target[2] + 5];
        // A move that circles the target stays inside the room the target is
        // in: an orbit as wide as the start distance otherwise swings through
        // the walls and spends half the shot looking at plaster.
        if (id === "orbit" || id === "orbit-half" || id === "arc") {
          const fit = orbitRoom(s.objects.filter((o) => o.parent === s.camera.parent), target);
          if (fit) {
            const dx = startP[0] - target[0];
            const dz = startP[2] - target[2];
            const r = Math.hypot(dx, dz);
            if (fit.room < 0.8) skipped.push(`camera ${id}: ${fit.name} is too tight round the subject for a ${id}; it was left as asked`);
            else if (r > fit.room) {
              const k = fit.room / Math.max(r, 1e-6);
              startP = [target[0] + dx * k, startP[1], target[2] + dz * k];
              skipped.push(`camera ${id}: pulled in from ${r.toFixed(1)} m to ${fit.room.toFixed(1)} m so it stays inside ${fit.name}`);
            }
          }
          const r = Math.hypot(startP[0] - target[0], startP[2] - target[2]);
          const sweep = id === "orbit" ? 2 * Math.PI : id === "orbit-half" ? Math.PI : Math.PI / 3;
          const speed = (r * sweep) / d;
          if (speed > 2.5) skipped.push(`camera ${id}: travels ${speed.toFixed(1)} m/s, which reads as a whip; give it longer for a steady move`);
        }
        const a = aimAt(startP, target);
        const made = presetKeys(id, { p: startP, r: [a.yaw, a.pitch, 0], lens: from?.lens ?? lens }, target, t0, d);
        const half = 0.5 / s.fps;
        const kept = keys.filter((k) => k.t < t0 - half || k.t > t0 + d + half);
        keys.length = 0;
        keys.push(...kept, ...made);
      }
    }

    if (keys.length) s.camera.keys = keys.sort((a, b) => a.t - b.t);
    else if (!fromTemplate) {
      // No keys and no move: a locked-off camera in front of the subject.
      const p: Vec3 = [defaultLook[0], Math.max(1.4, defaultLook[1]), defaultLook[2] + 6];
      const a = aimAt(p, defaultLook);
      s.camera.keys = [{ t: 0, p, r: [a.yaw, a.pitch, 0], lens, ease: "smooth" }];
    }

    if (c.aim_at !== undefined) {
      const ob = lookup(c.aim_at);
      if (ob) s.camera.aim = { target: ob.id, frame: [0, 0] };
      else skipped.push(`camera aim_at "${text(c.aim_at, 60)}" is not an object here`);
    }
    const rigName = text(c.rig, 20).toLowerCase().replace(/[\s_-]/g, "");
    if (rigName) {
      const rig = CAMERA_RIGS.find((r) => r.id === rigName || r.name.toLowerCase().replace(/\s/g, "") === rigName || (rigName === "sticks" && r.id === "tripod") || (rigName === "shoulder" && r.id === "handheld"));
      if (rig) {
        s.camera.shake = { ...rig.shake };
        if (rig.id === "free") delete s.camera.rig; else s.camera.rig = rig.id;
      } else skipped.push(`camera rig "${text(c.rig, 30)}" is not one of ${CAMERA_RIGS.map((r) => r.id).join(", ")}`);
    }
    const shake = num(c.handheld);
    if (shake !== null) s.camera.shake = { amount: clamp(shake, 0, 1), speed: 1 };
    const flow = text(c.flow, 20).toLowerCase();
    if (flow === "continuous" || flow === "even" || flow === "keys") s.camera.flow = flow;
  }

  const clean = asBlockScene(JSON.parse(JSON.stringify(s)));
  if (!clean) return { error: "That scene could not be put together." };
  return { scene: clean, skipped, refs };
}

/** A line per object for the tool's answer, so the assistant can say what it made. */
export function describeScene(s: BlockScene): string[] {
  const byId = new Map(s.objects.map((o) => [o.id, o]));
  return s.objects.map((o) => {
    const moves = o.keys.filter((k) => !k.g).length > 1 ? "moves" : "still";
    const gestures = [...new Set(o.keys.filter((k) => k.g && k.g[0] > 0).map((k) => k.gk ?? "reach"))];
    const rides = o.parent ? `, rides with ${byId.get(o.parent)?.name ?? "?"}` : "";
    return `${o.name} (${o.kind}${o.pose ? `, ${o.pose}` : ""}), ${moves}${rides}${gestures.length ? `, gestures: ${gestures.join(", ")}` : ""}`;
  });
}

/**
 * The scene as the scene bar's model reads it before an edit: every object by
 * its name (which is how a change or a remove names it), where it starts,
 * where it goes, what it does, and what the camera does. Rounded, so the
 * prompt stays short and the model is not tempted to echo noise back.
 */
export function sceneForPrompt(s: BlockScene): Json {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const byId = new Map(s.objects.map((o) => [o.id, o]));
  return {
    name: s.name,
    duration: s.duration,
    aspect: s.aspect,
    look: s.look,
    environment: { ground: s.environment.ground, sky: s.environment.sky },
    objects: s.objects.map((o) => {
      const k0 = o.keys[0];
      const route = o.keys.filter((k) => !k.g && k.t > 0);
      const gestures = o.keys.filter((k) => k.g && k.g[0] > 0.5).map((k) => ({ gesture: k.gk ?? "reach", at: r2(k.t) }));
      return {
        name: o.name,
        kind: o.kind,
        ...(o.pose ? { pose: o.pose } : {}),
        x: r2(k0.p[0]), y: r2(k0.p[1]), z: r2(k0.p[2]), facing: Math.round(k0.r[0]),
        size: o.size.map(r2),
        ...(o.parent ? { rides_with: byId.get(o.parent)?.name ?? null } : {}),
        ...(route.length ? { moves: route.map((k) => ({ t: r2(k.t), x: r2(k.p[0]), z: r2(k.p[2]) })) } : {}),
        ...(gestures.length ? { gestures } : {}),
      };
    }),
    camera: {
      ...(s.camera.parent ? { rides_with: byId.get(s.camera.parent)?.name ?? null } : {}),
      ...(s.camera.aim.target ? { aim_at: byId.get(s.camera.aim.target)?.name ?? null } : {}),
      ...(s.camera.rig ? { rig: s.camera.rig } : {}),
      keys: s.camera.keys.map((k) => ({ t: r2(k.t), x: r2(k.p[0]), y: r2(k.p[1]), z: r2(k.p[2]), lens: Math.round(k.lens) })),
    },
  };
}

/** The JSON object in a model's answer: fences stripped, prose around it ignored. */
export function jsonFromText(raw: string): Json | null {
  const t = raw.replace(/```(?:json)?/gi, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    const v = JSON.parse(t.slice(a, b + 1));
    return isObj(v) ? v : null;
  } catch {
    return null;
  }
}
