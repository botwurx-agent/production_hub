// create_scene_setup, the pure half: turns a lighting and camera setup
// described in production terms into a scene builder Setup (components/previz/
// setup.ts) that opens exactly as one built by hand. No "server-only", so it is
// tested in node. The server half (lib/connector-scene-tool.ts) reads the
// project, fetches any product photos and inserts the row.
//
// The assistant cannot see the 3D, so everything is placed by plain facts it
// can reason about: metres on a floor plan, "aim at" a person or a product
// rather than a yaw, a light's ROLE (key, fill, back) rather than a position
// when it has none, a camera's "look at" rather than a pan and tilt. Whatever
// comes out still passes asSetup, the check every saved setup passes.
//
// Conventions handed to the assistant (the builder's own): metres, x to the
// right, z toward the camera side (the front of the set is +z), y up. A
// person or an item at facing 0 faces +z, toward the camera; 90 faces +x.

import { CATALOG, catalogOf, newItem, stackHeights, type ItemSpec } from "@/lib/previz/catalog";
import { FIXTURES, DIFFUSIONS, FRAME_SIZES, MODIFIERS, WINDOW_SKIES, type WindowSky } from "@/lib/previz/lighting";
import { POSES, type PoseId } from "@/lib/previz/poses";
import { ASPECTS, BODIES } from "@/lib/previz/optics";
import { constrainEnd, toLocal, type CamKey, type Ease, type Move } from "@/lib/previz/camera-move";
import { aim, asSetup, type Setup, type Shot, type Vec3 } from "@/components/previz/setup";
import type { GripSpec, LightSpec } from "@/lib/previz/light-build";
import type { TalentSpec } from "@/lib/previz/scene-build";
import type { FloorKind, Opening, RoomSpec, WallId } from "@/lib/previz/room";

type Json = Record<string, unknown>;

export const MAX_SCENE_ITEMS = 80;
export const MAX_SCENE_PEOPLE = 12;
export const MAX_SCENE_LIGHTS = 16;
export const MAX_SCENE_CAMERAS = 8;
export const MAX_SCENE_PHOTOS = 6;

export const SUPPORT_IDS = ["sticks", "dana", "fisher", "robot"] as const;
type SupportId = (typeof SUPPORT_IDS)[number];
export const GRIP_IDS = ["bounce", "silver", "flag", "cookie", "branch", "blinds", "windowpane"] as const;
const FLOORS: FloorKind[] = ["wood", "concrete", "tile", "carpet", "stage"];
const WALL_IDS: WallId[] = ["back", "left", "right", "front"];
const EASES: Ease[] = ["smooth", "linear", "in", "out"];
const OUTFITS: [string, string][] = [
  ["#9b5a3d", "#33373f"], ["#4a5d6e", "#2e3138"], ["#c4553d", "#2f3542"], ["#6f8f6a", "#3a3530"],
  ["#d9c7a8", "#4b4f57"], ["#7d5a8c", "#2c2f36"], ["#e8e1d4", "#c8b9a6"], ["#3f6f8f", "#26292e"],
];

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const text = (v: unknown, max = 120): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const hex = (v: unknown): string | null => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : null);
const point = (v: unknown): Vec3 | null => {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const p = v.map(num);
  return p.every((x) => x !== null) ? { x: p[0]!, y: p[1]!, z: p[2]! } : null;
};
const deg = (r: number) => (r * 180) / Math.PI;
/** Facing (0 is +z) that turns something at `from` toward `to`. */
const faceYaw = (from: { x: number; z: number }, to: { x: number; z: number }) => deg(Math.atan2(to.x - from.x, to.z - from.z));

/** Kinds by group, for the tool's description. */
export function sceneCatalogText(): string {
  const by = new Map<string, string[]>();
  for (const c of CATALOG) {
    if (c.kind === "model") continue;
    by.set(c.category, [...(by.get(c.category) ?? []), c.kind]);
  }
  return [...by.entries()].map(([k, v]) => `${k}: ${v.join(", ")}`).join("; ");
}
export const FIXTURE_TEXT = FIXTURES.map((f) => `${f.id} (${f.name}; modifiers ${f.modifiers.join("/")})`).join(", ");
export const DIFFUSION_IDS = DIFFUSIONS.map((d) => d.id);
export const BODY_IDS = BODIES.map((b) => b.id);
export const POSE_IDS = POSES.map((p) => p.id) as string[];
export const ASPECT_TEXT = ASPECTS.map((a) => `${a.id} (${a.label})`).join(", ");

/** A product photo to fetch and wrap onto an item, keyed as the builder stores it. */
export type PhotoAsk = { key: string; url: string; item: string };

export type SceneResult = { setup: Setup; skipped: string[]; photos: PhotoAsk[] };

let seq = 0;
const nid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Where a light goes when only its role is given: around the subject, measured
 * from where the camera looks at it. Distances are what a gaffer would start
 * with for a person, not a product; a product key is closer.
 */
function rolePosition(role: string, subject: Vec3, cam: Vec3, small: boolean, spread = 0, far = 1): Vec3 {
  const toCam = Math.atan2(cam.x - subject.x, cam.z - subject.z);
  // `spread` swings the light further round, away from the lens side.
  const r = (a: number, d: number, h: number): Vec3 => {
    const b = a + Math.sign(a || 1) * spread;
    return { x: subject.x + Math.sin(toCam + b) * d * far, y: h, z: subject.z + Math.cos(toCam + b) * d * far };
  };
  const k = small ? 0.45 : 1;
  const top = subject.y;
  switch (role) {
    case "fill": return r(-0.75, 2.4 * k + 0.3, top + 0.1);
    case "back": case "hair": return r(Math.PI, 1.8 * k + 0.3, top + 0.9);
    case "rim": return r(2.4, 2.0 * k + 0.3, top + 0.4);
    case "background": case "bg": return { x: subject.x + 1.2, y: 1.4, z: subject.z - 2.2 };
    default: return r(0.75, 2.2 * k + 0.4, top + 0.65); // key: three-quarter, camera right (+x as the camera sees it)
  }
}
/** Whether a point is inside any camera's picture (horizontally, with a margin). */
function inAnyFrame(p: Vec3, cams: Shot[], pad = 0): boolean {
  return cams.some((c) => {
    const half = Math.atan(12.5 / c.focal) + 0.14;
    const y = (c.yaw * Math.PI) / 180;
    const fx = -Math.sin(y), fz = -Math.cos(y);
    const dx = p.x - c.pos.x, dz = p.z - c.pos.z;
    const ahead = dx * fx + dz * fz;
    if (ahead <= 0.2) return false;
    const side = Math.abs(dx * fz - dz * fx);
    return Math.atan2(Math.max(0, side - pad), ahead) < half;
  });
}

/**
 * A role position swung round until the light (and its diffusion frame, which
 * sits between it and the subject) is out of every camera's picture, the way
 * the builder places a new light itself. Gives up after a half turn.
 */
function placeOutOfFrame(role: string, subject: Vec3, cams: Shot[], small: boolean, frameDist: number, onMiss?: () => void, framePad = 0): Vec3 {
  // Swing round first, then further out as well: a wide lens sees a lot of
  // the room, and a side light pulled back clears it where a nearer one does not.
  for (const far of [1, 1.35, 1.7]) {
    for (let spread = 0; spread <= Math.PI / 2; spread += Math.PI / 24) {
      const pos = rolePosition(role, subject, cams[0].pos, small, spread, far);
      const d = Math.hypot(subject.x - pos.x, subject.y - pos.y, subject.z - pos.z) || 1;
      const k = Math.min(0.9, frameDist / d);
      const frame = { x: pos.x + (subject.x - pos.x) * k, y: pos.y, z: pos.z + (subject.z - pos.z) * k };
      if (!inAnyFrame(pos, cams) && (frameDist <= 0 || !inAnyFrame(frame, cams, framePad))) return pos;
    }
  }
  // Nothing clears every lens (a very wide shot of a small room): keep the
  // role's own place rather than a stranger one, and the builder shows it.
  onMiss?.();
  return rolePosition(role, subject, cams[0].pos, small);
}

const roleOf = (s: string) => {
  const t = s.toLowerCase();
  for (const r of ["fill", "back", "hair", "rim", "background"]) if (t.includes(r)) return r;
  return "key";
};

export function buildSceneSetup(input: Json): SceneResult | { error: string } {
  const skipped: string[] = [];
  const photos: PhotoAsk[] = [];
  const name = text(input.name, 120) || "Untitled setup";

  /* ---------- the set ---------- */
  const r = isObj(input.room) ? input.room : null;
  const stage = !r || text(r.kind, 10) === "stage" || r.stage === true;
  const width = clamp(num(r?.width) ?? 5, 1.5, 40);
  const depth = clamp(num(r?.depth) ?? 6, 1.5, 40);
  const height = clamp(num(r?.height) ?? 2.8, 2, 12);
  const floorAsked = text(r?.floor, 12).toLowerCase();
  const room: RoomSpec = {
    x: -width / 2, z: -depth * 0.55, width, depth, height,
    wallColor: hex(r?.wall_color) ?? "#e3ddd2",
    floor: FLOORS.includes(floorAsked as FloorKind) ? (floorAsked as FloorKind) : stage ? "stage" : "wood",
    walls: { back: true, left: true, right: true, front: false },
    openings: [],
  };
  if (floorAsked && !FLOORS.includes(floorAsked as FloorKind)) skipped.push(`floor "${floorAsked}" (use ${FLOORS.join(", ")})`);
  if (r && Array.isArray(r.walls)) {
    const want = new Set(r.walls.map((w) => text(w, 8).toLowerCase()));
    for (const w of WALL_IDS) room.walls[w] = want.has(w);
  }
  for (const [i, o] of (r && Array.isArray(r.openings) ? r.openings : []).slice(0, 12).entries()) {
    if (!isObj(o)) continue;
    const wall = text(o.wall, 8).toLowerCase() as WallId;
    if (!WALL_IDS.includes(wall)) { skipped.push(`an opening on wall "${wall}" (use back, left, right, front)`); continue; }
    const kind: Opening["kind"] = text(o.kind, 8) === "door" ? "door" : "window";
    const len = wall === "back" || wall === "front" ? width : depth;
    const w = clamp(num(o.width) ?? (kind === "door" ? 0.9 : 1.4), 0.4, len);
    room.openings.push({
      id: `o${i}${nid("")}`, wall, kind,
      at: clamp(num(o.at) ?? len / 2, w / 2, len - w / 2),
      width: w,
      sill: kind === "door" ? 0 : clamp(num(o.sill) ?? 0.85, 0, height - 0.3),
      top: clamp(num(o.top) ?? (kind === "door" ? 2.05 : 2.2), 0.5, height),
    });
  }

  /* ---------- refs ---------- */
  const refs = new Map<string, { kind: "person" | "item"; id: string; at: Vec3; small: boolean }>();
  const addRef = (ref: string, v: { kind: "person" | "item"; id: string; at: Vec3; small: boolean }, label: string) => {
    const k = ref.toLowerCase();
    if (!k) return;
    if (refs.has(k)) skipped.push(`${label}: the ref "${ref}" was used twice; the first keeps it`);
    else refs.set(k, v);
  };
  const lookup = (v: unknown) => refs.get(text(v, 60).toLowerCase());

  /* ---------- items ---------- */
  const items: ItemSpec[] = [];
  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (rawItems.length > MAX_SCENE_ITEMS) skipped.push(`${rawItems.length - MAX_SCENE_ITEMS} set pieces past the ${MAX_SCENE_ITEMS} per setup`);
  const facingOf: { it: ItemSpec; raw: Json }[] = [];
  for (const raw of rawItems.slice(0, MAX_SCENE_ITEMS)) {
    if (!isObj(raw)) continue;
    const kind = text(raw.kind, 30).toLowerCase();
    const label = text(raw.name, 60) || text(raw.ref, 60) || kind;
    if (kind === "model" || !CATALOG.some((c) => c.kind === kind)) {
      skipped.push(`${label}: kind "${kind}" is not in the catalogue (use box for anything else, sized to it)`);
      continue;
    }
    const c = catalogOf(kind);
    const it = newItem(kind, num(raw.x) ?? 0, num(raw.z) ?? 0, nid("i"));
    if (text(raw.name, 60)) it.name = text(raw.name, 60);
    const w = num(raw.width), d = num(raw.depth), h = num(raw.height);
    if (w !== null) it.w = clamp(w, 0.01, 40);
    if (d !== null) it.d = clamp(d, 0.005, 40);
    if (h !== null) it.h = clamp(h, 0.005, 12);
    const raise = num(raw.raise);
    if (raise !== null) it.raise = clamp(raise, 0, 12);
    const col = hex(raw.color);
    if (col) it.color = col;
    const rot = num(raw.facing);
    if (rot !== null) it.rot = Math.round(rot);
    if (c.light && it.light) {
      if (raw.on === false) it.light.on = false;
      const dim = num(raw.dimmer);
      if (dim !== null) it.light.dimmer = clamp(dim > 1 ? dim / 100 : dim, 0.02, 1);
      const cct = num(raw.cct);
      if (cct !== null) it.light.cct = clamp(cct, 1800, 10000);
    }
    const photo = text(raw.photo_url, 2000);
    if (photo) {
      if (!c.labelled) skipped.push(`${it.name}: a photo goes only on a product (bottle, can, carton, pouch, jar)`);
      else if (!/^https:\/\//i.test(photo)) skipped.push(`${it.name}: the photo link must start with https://`);
      else if (photos.length >= MAX_SCENE_PHOTOS) skipped.push(`${it.name}: past the ${MAX_SCENE_PHOTOS} photos per setup`);
      else {
        const key = `p${nid("")}`.slice(0, 40);
        it.label = key;
        photos.push({ key, url: photo, item: it.name });
      }
    }
    items.push(it);
    facingOf.push({ it, raw });
    const ref = text(raw.ref, 60) || text(raw.name, 60);
    addRef(ref, { kind: "item", id: it.id, at: { x: it.x, y: (it.raise ?? 0) + it.h / 2, z: it.z }, small: Math.max(it.w, it.h) < 0.5 }, it.name);
  }

  // What stands on what (a glass on the island, a lamp on a nightstand) is the
  // builder's own rule, so aim points sit where the piece really ends up.
  const heights = stackHeights(items);
  for (const v of refs.values()) {
    if (v.kind !== "item") continue;
    const it = items.find((x) => x.id === v.id);
    if (it) v.at = { x: it.x, y: (heights.get(it.id) ?? it.raise ?? 0) + it.h / 2, z: it.z };
  }

  /* ---------- people ---------- */
  const talent: TalentSpec[] = [];
  const rawPeople = Array.isArray(input.people) ? input.people : [];
  if (rawPeople.length > MAX_SCENE_PEOPLE) skipped.push(`${rawPeople.length - MAX_SCENE_PEOPLE} people past the ${MAX_SCENE_PEOPLE} per setup`);
  const personRaw: { t: TalentSpec; raw: Json }[] = [];
  for (const [i, raw] of rawPeople.slice(0, MAX_SCENE_PEOPLE).entries()) {
    if (!isObj(raw)) continue;
    const nm = text(raw.name, 40) || `Talent ${i + 1}`;
    const poseAsked = text(raw.pose, 20).toLowerCase();
    const pose = (POSE_IDS.includes(poseAsked) ? poseAsked : "standing") as PoseId;
    if (poseAsked && !POSE_IDS.includes(poseAsked)) skipped.push(`${nm}: pose "${poseAsked}" (use ${POSE_IDS.join(", ")})`);
    const [top, bottom] = OUTFITS[i % OUTFITS.length];
    const t: TalentSpec = {
      id: nid("t"), name: nm, heightM: clamp(num(raw.height) ?? 1.72, 0.9, 2.2), pose,
      x: num(raw.x) ?? 0, z: num(raw.z) ?? 0, facing: Math.round(num(raw.facing) ?? 0),
      top: hex(raw.top_color) ?? top, bottom: hex(raw.bottom_color) ?? bottom,
    };
    talent.push(t);
    personRaw.push({ t, raw });
    const eye = pose === "seated" ? t.heightM * 0.7 : pose === "kneeling" ? t.heightM * 0.68 : t.heightM * 0.93;
    addRef(text(raw.ref, 60) || nm, { kind: "person", id: t.id, at: { x: t.x, y: eye, z: t.z }, small: false }, nm);
  }

  // Facing toward something, holding, and walking to a mark, now refs exist.
  for (const { it, raw } of facingOf) {
    if (raw.face_toward === undefined || raw.facing !== undefined) continue;
    const to = lookup(raw.face_toward);
    if (to) it.rot = Math.round(faceYaw(it, to.at));
    else skipped.push(`${it.name}: face_toward "${text(raw.face_toward, 60)}" is not in this setup`);
  }
  for (const { t, raw } of personRaw) {
    if (raw.face_toward !== undefined && raw.facing === undefined) {
      const to = lookup(raw.face_toward);
      if (to) t.facing = Math.round(faceYaw(t, to.at));
      else skipped.push(`${t.name}: face_toward "${text(raw.face_toward, 60)}" is not in this setup`);
    }
    if (raw.holding !== undefined) {
      const it = lookup(raw.holding);
      const spec = it && it.kind === "item" ? items.find((x) => x.id === it.id) : null;
      if (spec && catalogOf(spec.kind).holdable && !talent.some((o) => o.holding === spec.id)) t.holding = spec.id;
      else skipped.push(`${t.name}: cannot hold "${text(raw.holding, 60)}" (it must be a small prop in this setup, held by one person)`);
    }
    if (isObj(raw.walk_to)) {
      const mx = num(raw.walk_to.x), mz = num(raw.walk_to.z);
      if (mx !== null && mz !== null) t.mark = { x: mx, z: mz, facing: Math.round(num(raw.walk_to.facing) ?? faceYaw(t, { x: mx, z: mz })) };
    }
  }

  const firstSubject = talent[0]
    ? lookup(personRaw[0].raw.ref ?? talent[0].name) ?? { kind: "person" as const, id: talent[0].id, at: { x: talent[0].x, y: talent[0].heightM * 0.93, z: talent[0].z }, small: false }
    : items.find((i) => catalogOf(i.kind).labelled)
      ? (() => { const i = items.find((x) => catalogOf(x.kind).labelled)!; return { kind: "item" as const, id: i.id, at: { x: i.x, y: i.h / 2, z: i.z }, small: true }; })()
      : null;
  const subjectAt: Vec3 = firstSubject?.at ?? { x: 0, y: 1.1, z: 0 };

  /* ---------- cameras ---------- */
  const shots: Shot[] = [];
  const camList = Array.isArray(input.cameras) ? input.cameras.filter(isObj) : [];
  const rawCams: unknown[] = camList.length ? camList : [{}];
  if (rawCams.length > MAX_SCENE_CAMERAS) skipped.push(`${rawCams.length - MAX_SCENE_CAMERAS} cameras past the ${MAX_SCENE_CAMERAS} per setup`);
  for (const [i, raw] of rawCams.slice(0, MAX_SCENE_CAMERAS).entries()) {
    if (!isObj(raw)) continue;
    const code = text(raw.code, 12) || `1${String.fromCharCode(65 + i)}`;
    const body = text(raw.body, 30).toLowerCase();
    if (body && !BODY_IDS.includes(body)) skipped.push(`${code}: camera body "${body}" (use ${BODY_IDS.join(", ")})`);
    const sup = text(raw.support, 12).toLowerCase();
    if (sup && !SUPPORT_IDS.includes(sup as SupportId)) skipped.push(`${code}: support "${sup}" (use ${SUPPORT_IDS.join(", ")})`);
    const focal = clamp(num(raw.lens) ?? 35, 8, 600);
    const lookTarget = raw.look_at !== undefined ? (point(raw.look_at) ?? lookup(raw.look_at)?.at ?? null) : null;
    if (raw.look_at !== undefined && !lookTarget) skipped.push(`${code}: look_at "${text(raw.look_at, 60)}" is not in this setup or [x, y, z]`);
    const look = lookTarget ?? subjectAt;
    const given = num(raw.x) !== null || num(raw.z) !== null;
    const pos: Vec3 = given
      ? { x: num(raw.x) ?? look.x, y: num(raw.y) ?? 1.5, z: num(raw.z) ?? look.z + 3 }
      : { x: look.x + 0.3, y: num(raw.y) ?? 1.5, z: look.z + Math.max(2.5, focal / 9) };
    pos.y = clamp(pos.y, 0.1, 6);
    const focusRef = raw.focus_on !== undefined ? lookup(raw.focus_on) : lookTarget ? [...refs.values()].find((v) => v.at === lookTarget) : firstSubject ?? undefined;
    const a = aim(pos, look);
    const focusTo = focusRef?.at ?? look;
    const shot: Shot = {
      id: nid("s"), code, title: text(raw.title, 60) || (i === 0 ? "Wide" : "Shot"),
      bodyId: BODY_IDS.includes(body) ? body : "alexamini",
      support: (SUPPORT_IDS.includes(sup as SupportId) ? sup : "sticks") as SupportId,
      focal, stop: clamp(num(raw.stop) ?? 4, 0.7, 32), pos, yaw: a.yaw, pitch: a.pitch,
      focusM: Math.max(0.3, Math.hypot(focusTo.x - pos.x, focusTo.y - pos.y, focusTo.z - pos.z)),
      focusOn: focusRef?.id ?? null, board: null,
      iso: clamp(num(raw.iso) ?? 800, 50, 25600), nd: clamp(num(raw.nd) ?? 0, 0, 2.4),
      wb: clamp(num(raw.white_balance) ?? 5600, 2000, 11000), move: null,
    };
    shot.rigYaw = shot.yaw;

    // A move: an end position (and lens) over a duration.
    if (isObj(raw.move)) {
      const m = raw.move;
      const endLook = m.look_at !== undefined ? (point(m.look_at) ?? lookup(m.look_at)?.at ?? look) : look;
      const endPos: Vec3 = { x: num(m.x) ?? pos.x, y: clamp(num(m.y) ?? pos.y, 0.1, 6), z: num(m.z) ?? pos.z };
      const ea = aim(endPos, endLook);
      const start: CamKey = { pos, yaw: shot.yaw, pitch: shot.pitch, focal, focusM: shot.focusM, focusOn: shot.focusOn };
      let end: CamKey = {
        pos: endPos, yaw: ea.yaw, pitch: ea.pitch, focal: clamp(num(m.lens) ?? focal, 8, 600),
        focusM: Math.max(0.3, Math.hypot(endLook.x - endPos.x, endLook.y - endPos.y, endLook.z - endPos.z)), focusOn: shot.focusOn,
      };
      // With no support named, pick the one that can make the move.
      if (!sup) {
        const { lx, ly, lz } = toLocal(start, endPos);
        const travel = Math.hypot(lx, ly, lz);
        shot.support = travel < 0.05 ? "sticks" : Math.abs(lx) < 0.1 && Math.abs(ly) < 0.6 ? "fisher" : Math.abs(lz) < 0.1 && Math.abs(ly) < 0.05 ? "dana" : "robot";
      }
      const fixed = constrainEnd(shot.support, start, end, shot.rigYaw);
      const off = Math.hypot(fixed.pos.x - end.pos.x, fixed.pos.y - end.pos.y, fixed.pos.z - end.pos.z);
      if (off > 0.05) skipped.push(`${code}: a ${shot.support} cannot travel there, so the end was moved ${off.toFixed(2)} m onto what it can reach`);
      end = fixed;
      const easeAsked = text(m.ease, 10) as Ease;
      const move: Move = {
        end, durationS: clamp(num(m.seconds) ?? 4, 0.5, 60),
        ease: EASES.includes(easeAsked) ? easeAsked : "smooth", trackYaw: shot.rigYaw,
      };
      shot.move = move;
    }
    shots.push(shot);
  }

  /* ---------- lights ---------- */
  const lights: LightSpec[] = [];
  const rawLights = Array.isArray(input.lights) ? input.lights : [];
  if (rawLights.length > MAX_SCENE_LIGHTS) skipped.push(`${rawLights.length - MAX_SCENE_LIGHTS} lights past the ${MAX_SCENE_LIGHTS} per setup`);
  for (const raw of rawLights.slice(0, MAX_SCENE_LIGHTS)) {
    if (!isObj(raw)) continue;
    const fid = text(raw.fixture, 20).toLowerCase();
    const fx = FIXTURES.find((f) => f.id === fid);
    const role = text(raw.role, 40) || "Key";
    if (!fx) { skipped.push(`${role}: fixture "${fid}" (use ${FIXTURES.map((f) => f.id).join(", ")})`); continue; }
    const target = raw.aim_at !== undefined ? lookup(raw.aim_at) : firstSubject ?? undefined;
    if (raw.aim_at !== undefined && !target) skipped.push(`${role}: aim_at "${text(raw.aim_at, 60)}" is not in this setup`);
    const at = target?.at ?? subjectAt;
    const frameDist = isObj(raw.diffusion) ? clamp(num(raw.diffusion.distance) ?? 1.2, 0.3, 6) : 0;
    const pos = point([raw.x, raw.y, raw.z]) ?? placeOutOfFrame(roleOf(role), at, shots, !!target?.small, frameDist, () => skipped.push(`${role}: no place for it clears every camera, so it may be in shot; give it an x, y, z`), isObj(raw.diffusion) ? (clamp(num(raw.diffusion.size_ft) ?? 4, 2, 20) * 0.3048) / 2 : 0);
    pos.y = clamp(pos.y, 0.2, 8);
    const modAsked = text(raw.modifier, 20).toLowerCase();
    let modifierId = fx.defaultModifier;
    if (modAsked) {
      if (fx.modifiers.includes(modAsked) && MODIFIERS[modAsked]) modifierId = modAsked;
      else skipped.push(`${role}: ${fx.name} takes ${fx.modifiers.join(", ")}, not "${modAsked}"`);
    }
    const dimRaw = num(raw.dimmer);
    const cct = num(raw.cct);
    const a = aim(pos, at);
    const l: LightSpec = {
      id: nid("l"), role, fixtureId: fx.id, modifierId, beamDeg: null,
      dimmer: dimRaw === null ? 0.6 : clamp(dimRaw > 1 ? dimRaw / 100 : dimRaw, 0.02, 1),
      cct: cct === null ? fx.cctDefault : clamp(cct, fx.cctMin, fx.cctMax),
      x: pos.x, y: pos.y, z: pos.z, yaw: a.yaw, pitch: a.pitch,
      aimAt: target?.id ?? null, frame: null, on: raw.on !== false,
    };
    if (cct !== null && (cct < fx.cctMin || cct > fx.cctMax)) skipped.push(`${role}: ${fx.name} runs ${fx.cctMin} to ${fx.cctMax}K, so ${Math.round(cct)}K was set to ${l.cct}K`);
    if (isObj(raw.diffusion)) {
      const mat = text(raw.diffusion.material, 20).toLowerCase();
      const size = num(raw.diffusion.size_ft) ?? 4;
      const sizeFt = FRAME_SIZES.reduce((b, s) => (Math.abs(s - size) < Math.abs(b - size) ? s : b), FRAME_SIZES[0]);
      if (!DIFFUSION_IDS.includes(mat)) skipped.push(`${role}: diffusion "${mat}" (use ${DIFFUSION_IDS.join(", ")})`);
      else l.frame = { sizeFt, materialId: mat, distM: clamp(num(raw.diffusion.distance) ?? 1.2, 0.3, 6) };
    }
    lights.push(l);
  }

  /* ---------- grip ---------- */
  const grips: GripSpec[] = [];
  for (const raw of (Array.isArray(input.grip) ? input.grip : []).slice(0, 12)) {
    if (!isObj(raw)) continue;
    const kind = text(raw.kind, 12).toLowerCase();
    if (!GRIP_IDS.includes(kind as (typeof GRIP_IDS)[number])) { skipped.push(`grip "${kind}" (use ${GRIP_IDS.join(", ")})`); continue; }
    const target = raw.aim_at !== undefined ? lookup(raw.aim_at) : firstSubject ?? undefined;
    const at = target?.at ?? subjectAt;
    const pos = point([raw.x, raw.y, raw.z]) ?? placeOutOfFrame(kind === "flag" ? "key" : "fill", at, shots, !!target?.small, 0);
    const a = aim(pos, at);
    grips.push({
      id: nid("g"), kind: kind as GripSpec["kind"], sizeFt: clamp(num(raw.size_ft) ?? 4, 1, 20),
      x: pos.x, y: clamp(pos.y, 0.2, 6), z: pos.z, yaw: a.yaw, pitch: a.pitch, aimAt: target?.id ?? null,
    });
  }

  /* ---------- daylight ---------- */
  const w = isObj(input.daylight) ? input.daylight : null;
  const skyAsked = text(w?.sky, 12).toLowerCase();
  const sky: WindowSky = skyAsked in WINDOW_SKIES ? (skyAsked as WindowSky) : "overcast";
  if (skyAsked && !(skyAsked in WINDOW_SKIES)) skipped.push(`daylight "${skyAsked}" (use ${Object.keys(WINDOW_SKIES).join(", ")})`);
  const hasWindow = room.openings.some((o) => o.kind === "window");

  const aspectAsked = text(input.aspect, 8).replace(":", "x").replace(".", "");
  const aspect = ASPECTS.find((a) => a.id === aspectAsked || a.label === text(input.aspect, 8));
  if (text(input.aspect, 8) && !aspect) skipped.push(`aspect "${text(input.aspect, 8)}" (use ${ASPECT_TEXT})`);

  const setup: Setup = {
    v: 3, name,
    set: { kind: stage ? "stage" : "room", room },
    items, shots, activeId: shots[0].id, talent, lights, grips,
    win: { sky, nd: clamp(num(w?.nd) ?? 0, 0, 2.4), on: !stage && hasWindow && w?.on !== false },
    units: text(input.units, 4) === "m" ? "m" : "ft",
    aspectId: aspect?.id ?? "16x9",
  };
  const clean = asSetup(JSON.parse(JSON.stringify(setup)));
  if (!clean) return { error: "That setup could not be put together." };
  return { setup: clean, skipped, photos };
}

/** Lines for the tool's answer, so the assistant can say what it made. */
export function describeSetup(s: Setup): string[] {
  const name = (id: string | null) => s.talent.find((t) => t.id === id)?.name ?? s.items.find((i) => i.id === id)?.name ?? null;
  return [
    `${s.set.kind === "stage" ? "Open stage" : `Room ${s.set.room.width} x ${s.set.room.depth} m`}, ${s.items.length} set piece${s.items.length === 1 ? "" : "s"}`,
    ...s.talent.map((t) => `${t.name}, ${t.pose}${t.holding ? `, holding ${name(t.holding)}` : ""}${t.mark ? ", walks to a mark" : ""}`),
    ...s.lights.map((l) => `${l.role}: ${FIXTURES.find((f) => f.id === l.fixtureId)?.name ?? l.fixtureId}, ${l.modifierId}, ${Math.round(l.dimmer * 100)}%, ${l.cct}K${l.frame ? `, ${l.frame.sizeFt}x${l.frame.sizeFt} ${l.frame.materialId}` : ""}${l.aimAt ? ` on ${name(l.aimAt)}` : ""}`),
    ...s.grips.map((g) => `${g.kind} ${g.sizeFt} ft${g.aimAt ? ` on ${name(g.aimAt)}` : ""}`),
    ...s.shots.map((sh) => `${sh.code} ${sh.title}: ${sh.focal}mm at f/${sh.stop} on ${sh.support}${sh.move ? `, a ${sh.move.durationS}s move` : ""}`),
  ];
}
