// The scene builder's document: everything a setup holds and the setups it can
// start from. On a project a setup is saved to scene_setups (migration 0115)
// through app/(app)/projects/[id]/scene-actions.ts; the /dev prototype keeps it
// in this browser instead, which is what loadSetup / saveSetup are for.
//
// Version 3 made the set free-form: a room built from measurements (or an
// open stage) plus any number of placed items. A version 2 setup (a fixed
// kitchen or one backdrop, and a single hero bottle) is converted on load.
import type { Move } from "@/lib/previz/camera-move";
import type { SupportKind } from "@/lib/previz/camera-model";
import type { GripSpec, LightSpec } from "@/lib/previz/light-build";
import type { TalentSpec } from "@/lib/previz/scene-build";
import type { BackdropSpec, LegacySetSpec } from "@/lib/previz/studio-set";
import { newItem, type ItemSpec } from "@/lib/previz/catalog";
import { KITCHEN_ROOM, emptyRoom, type SetSpec } from "@/lib/previz/room";
import type { WindowSky } from "@/lib/previz/lighting";
import type { EmbeddedAsset } from "@/lib/previz/asset-store";
import type { RoomDraft } from "@/lib/previz/room-draft";

export type Vec3 = { x: number; y: number; z: number };
export type Shot = {
  id: string;
  code: string;
  title: string;
  bodyId: string;
  support: SupportKind;
  focal: number;
  stop: number;
  pos: Vec3;
  yaw: number; // degrees, 0 looks toward the back wall (-Z), positive turns left
  pitch: number; // degrees, positive tilts up
  focusM: number;
  focusOn: string | null; // a talent or item id: focus follows it
  board: string | null;
  iso: number;
  nd: number;
  wb: number;
  /** A camera move: this shot's own values are the start frame. */
  move: Move | null;
  /**
   * Which way what the camera is on faces, degrees, same convention as yaw:
   * the Fisher's track, the Dana's rails, the arm's base. Kept apart from the
   * camera's own pan so the head can pan freely while the track stays put.
   * Absent on an older setup, where it followed the camera.
   */
  rigYaw?: number;
  /**
   * Where a motion control arm's base stands, in the rig's frame relative to
   * the camera's start position (x toward rig right, z toward rig back).
   * Absent means the default: straight behind the camera.
   */
  robotBase?: { x: number; z: number } | null;
  /**
   * How a motion control arm holds the camera: "under" (underslung, the arm's
   * 6th axis on the camera's top through a disc spacer, the normal way) or
   * "over" (overslung, onto the baseplate). Absent means underslung.
   */
  robotMount?: "under" | "over";
};

/** The heading of what the camera is on, falling back the way older setups did. */
export function rigYawOf(s: Pick<Shot, "rigYaw" | "move" | "yaw">): number {
  return s.rigYaw ?? s.move?.trackYaw ?? s.yaw;
}
export type WinState = { sky: WindowSky; nd: number; on: boolean };
export type Units = "ft" | "m";

export type Setup = {
  v: 3;
  name: string;
  set: SetSpec;
  items: ItemSpec[];
  shots: Shot[];
  activeId: string;
  talent: TalentSpec[];
  lights: LightSpec[];
  grips: GripSpec[];
  win: WinState;
  units: Units;
  aspectId: string;
  /** Only in a downloaded file: the photos and models the items use. */
  assets?: Record<string, EmbeddedAsset>;
};

const deg = (r: number) => (r * 180) / Math.PI;
export function aim(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return { yaw: deg(Math.atan2(-dx, -dz)), pitch: deg(Math.atan2(dy, Math.hypot(dx, dz))) };
}

function shot(
  id: string, code: string, title: string, support: SupportKind, focal: number, stop: number, nd: number,
  pos: Vec3, look: Vec3, focusOn: string | null, focusM: number, board: string | null, iso = 640,
): Shot {
  return {
    id, code, title, bodyId: "alexamini", support, focal, stop, pos, ...aim(pos, look), focusM, focusOn, board,
    iso, nd, wb: 5600, move: null,
  };
}

function item(kind: string, id: string, x: number, z: number, p: Partial<ItemSpec> = {}): ItemSpec {
  return { ...newItem(kind, x, z, id), ...p };
}

/** The kitchen's furniture, as items anybody can move or delete. */
function kitchenItems(pendant?: { on: boolean; dimmer: number; cct: number }): ItemSpec[] {
  return [
    item("counter", "k-counter", 0.6, -2.19, { w: 3.4, d: 0.62, h: 0.9 }),
    item("wall-cabinet", "k-upper", 0.6, -2.38, { w: 3.4, d: 0.36, h: 0.7, raise: 1.7 }),
    item("plant", "k-plant", 1.85, -2.15, { w: 0.44, d: 0.44, h: 0.62 }),
    item("dining-table", "k-table", 0, -0.6),
    item("chair", "k-chair1", 0.35, -1.3),
    item("chair", "k-chair2", -0.45, -1.3),
    item("pendant", "k-pendant", 0, -0.6, { raise: 1.94, light: { on: pendant?.on ?? true, dimmer: pendant?.dimmer ?? 1, cct: pendant?.cct ?? 2700, lumens: 800 } }),
  ];
}

/**
 * A kitchen, kept plain: the counters, a table and chairs, one person and one
 * camera. Presets are a starting room, not a finished plan (operator,
 * 2026-10-08: three cameras and a hero product on every preset was noise);
 * the cameras, people, lights and props are added as the job needs them.
 */
export function kitchenSetup(): Setup {
  return {
    v: 3,
    name: "Kitchen",
    set: { kind: "room", room: KITCHEN_ROOM },
    items: kitchenItems(),
    shots: [
      shot("a", "1A", "Wide", "sticks", 25, 4, 0.3, { x: 0.4, y: 1.55, z: 3.6 }, { x: 0, y: 1.1, z: -0.3 }, "maya", 3.5, null),
    ],
    activeId: "a",
    talent: [
      { id: "maya", name: "Maya", heightM: 1.68, pose: "standing", x: 0, z: 0.1, facing: 0, top: "#9b5a3d", bottom: "#33373f" },
    ],
    lights: [
      { id: "key", role: "Key", fixtureId: "ls600d", modifierId: "dome", beamDeg: null, dimmer: 0.6, cct: 5600, x: 2.2, y: 2.3, z: 1.6, yaw: 0, pitch: 0, aimAt: "maya", frame: null, on: true },
    ],
    grips: [],
    win: { sky: "overcast", nd: 0, on: true },
    units: "ft",
    aspectId: "16x9",
  };
}

/**
 * Talent on seamless, and nothing more: 9 ft white paper, one person a good
 * distance off it so their shadow falls on the floor rather than the
 * background, one soft key and one camera on sticks.
 */
export function studioSetup(): Setup {
  return {
    v: 3,
    name: "Talent on seamless",
    set: { kind: "stage", room: emptyRoom() },
    items: [item("seamless", "paper", 0, -0.9)],
    shots: [
      shot("a", "1A", "Wide", "sticks", 32, 4, 0, { x: 0, y: 1.5, z: 4.4 }, { x: 0, y: 1.0, z: -0.2 }, "ava", 4.6, null, 800),
    ],
    activeId: "a",
    talent: [
      { id: "ava", name: "Ava", heightM: 1.7, pose: "standing", x: 0, z: -0.2, facing: 0, top: "#c4553d", bottom: "#2f3542" },
    ],
    lights: [
      { id: "key", role: "Key", fixtureId: "ls600d", modifierId: "dome", beamDeg: null, dimmer: 0.55, cct: 5600, x: 1.9, y: 2.2, z: 1.5, yaw: 0, pitch: 0, aimAt: "ava", frame: null, on: true },
    ],
    grips: [],
    win: { sky: "overcast", nd: 0, on: false },
    units: "ft",
    aspectId: "16x9",
  };
}

/**
 * A bathroom, the skincare and grooming spot: a vanity under a mirror on the
 * back wall, a tub under a frosted window on the left, toilet and shower on
 * the right, tile underfoot. Small on purpose (about 10 x 10 ft), because a
 * real one is, and the camera works from the open fourth wall as it would on
 * a built set. One person, one camera, one key: the rest is added per job.
 */
export function bathroomSetup(): Setup {
  const room = {
    x: -1.6, z: -1.5, width: 3.2, depth: 3.0, height: 2.6, wallColor: "#e6e2da", floor: "tile" as const,
    walls: { back: true, left: true, right: true, front: false },
    openings: [
      { id: "bw1", wall: "left" as const, kind: "window" as const, at: 1.0, width: 0.9, sill: 1.2, top: 1.95 },
      { id: "bd1", wall: "right" as const, kind: "door" as const, at: 2.4, width: 0.8, sill: 0, top: 2.05 },
    ],
  };
  return {
    v: 3,
    name: "Bathroom",
    set: { kind: "room", room },
    items: [
      item("vanity", "b-vanity", 0.2, -1.225),
      item("mirror", "b-mirror", 0.2, -1.48, { raise: 1.1 }),
      item("bathtub", "b-tub", -1.22, -0.3, { rot: 90 }),
      item("shower", "b-shower", 1.15, -1.05),
      item("toilet", "b-toilet", 1.25, -0.15, { rot: -90 }),
      item("towel-rail", "b-towel", -0.62, -1.46, { raise: 0.95 }),
      item("plant", "b-plant", 0.55, -1.27, { w: 0.18, d: 0.18, h: 0.32 }),
    ],
    shots: [
      shot("a", "1A", "Wide", "sticks", 18, 4, 0, { x: 0.1, y: 1.5, z: 1.9 }, { x: 0, y: 1.1, z: -1.0 }, "nia", 2.4, null, 800),
    ],
    activeId: "a",
    talent: [
      { id: "nia", name: "Nia", heightM: 1.68, pose: "standing", x: 0.2, z: -0.55, facing: 10, top: "#e8e1d4", bottom: "#c8b9a6" },
    ],
    lights: [
      { id: "key", role: "Key", fixtureId: "ls600d", modifierId: "softbox", beamDeg: null, dimmer: 0.3, cct: 5600, x: 1.2, y: 2.0, z: 0.55, yaw: 0, pitch: 0, aimAt: "nia", frame: null, on: true },
    ],
    grips: [],
    win: { sky: "bright", nd: 0, on: true },
    units: "ft",
    aspectId: "16x9",
  };
}

/**
 * A bedroom: a queen bed against the back wall between two nightstands with
 * lamps on, a dresser and mirror on the right wall, an armchair in the corner
 * and a window on the left. One person sits on the foot of the bed (the seat
 * is the bed, worked out on its own), with one camera and one key.
 */
export function bedroomSetup(): Setup {
  const room = {
    x: -2.25, z: -1.8, width: 4.5, depth: 4.8, height: 2.7, wallColor: "#d9d2c6", floor: "wood" as const,
    walls: { back: true, left: true, right: true, front: false },
    openings: [
      { id: "rw1", wall: "left" as const, kind: "window" as const, at: 1.7, width: 1.4, sill: 0.8, top: 2.2 },
      { id: "rd1", wall: "right" as const, kind: "door" as const, at: 3.9, width: 0.85, sill: 0, top: 2.05 },
    ],
  };
  const lamp = (id: string, x: number) => item("table-lamp", id, x, -1.6, { light: { on: true, dimmer: 0.8, cct: 2700, lumens: 450 } });
  return {
    v: 3,
    name: "Bedroom",
    set: { kind: "room", room },
    items: [
      item("rug", "r-rug", 0, 0.05, { w: 2.6, d: 1.8 }),
      item("bed", "r-bed", 0, -0.75),
      item("nightstand", "r-ns1", -1.15, -1.6),
      item("nightstand", "r-ns2", 1.15, -1.6),
      lamp("r-lamp1", -1.15),
      lamp("r-lamp2", 1.15),
      item("dresser", "r-dresser", 2.01, -0.25, { rot: -90 }),
      item("mirror", "r-mirror", 2.235, -0.25, { rot: -90, w: 0.7, h: 0.9, raise: 1.25 }),
      item("armchair", "r-chair", 1.55, 1.45, { rot: -135 }),
      item("plant", "r-plant", -1.9, 1.7),
    ],
    shots: [
      shot("a", "1A", "Wide", "sticks", 24, 2.8, 0, { x: 0.2, y: 1.5, z: 3.6 }, { x: 0, y: 0.9, z: -0.6 }, "rob", 3.4, null, 1280),
    ],
    activeId: "a",
    talent: [
      { id: "rob", name: "Rob", heightM: 1.8, pose: "seated", x: 0.3, z: 0.1, facing: 0, top: "#4a5d6e", bottom: "#2e3138" },
    ],
    lights: [
      { id: "key", role: "Key (window side)", fixtureId: "ls600d", modifierId: "dome", beamDeg: null, dimmer: 0.35, cct: 5600, x: -1.7, y: 2.1, z: 1.6, yaw: 0, pitch: 0, aimAt: "rob", frame: null, on: true },
    ],
    grips: [],
    win: { sky: "overcast", nd: 0.6, on: true },
    units: "ft",
    aspectId: "16x9",
  };
}

/** A blank room built from measurements, with nobody in it yet. */
export function blankSetup(width: number, depth: number, height: number): Setup {
  const s = studioSetup();
  return {
    ...s,
    name: "Untitled setup",
    set: { kind: "room", room: emptyRoom(width, depth, height) },
    items: [],
    talent: [],
    lights: [],
    grips: [],
    shots: [shot("a", "1A", "Wide", "sticks", 24, 4, 0, { x: 0, y: 1.5, z: depth * 0.5 }, { x: 0, y: 1.0, z: -depth * 0.3 }, null, depth * 0.6, null, 800)],
    activeId: "a",
    win: { sky: "overcast", nd: 0, on: true },
  };
}

export const STORAGE_KEY = "previz.setup.v2";

type V2 = Omit<Setup, "v" | "set" | "items"> & {
  v: 2;
  set: LegacySetSpec;
  bottle: { id: string; name: string; x: number; z: number };
  practical?: { on: boolean; dimmer: number; cct: number };
};

/** A version 2 setup, rebuilt as version 3: same scene, now made of items. */
function fromV2(s: V2): Setup {
  const bottle = item("bottle", "bottle", s.bottle?.x ?? 0, s.bottle?.z ?? 0, { name: s.bottle?.name ?? "Hero bottle" });
  let set: SetSpec;
  let items: ItemSpec[];
  if (s.set?.kind === "kitchen") {
    set = { kind: "room", room: KITCHEN_ROOM };
    items = [...kitchenItems(s.practical), bottle];
  } else {
    const b: BackdropSpec = s.set?.backdrop ?? { widthIn: 107, color: "#f4f4f1", sweepM: 2.4, x: 0, z: -2.1, rot: 0 };
    const r = (b.rot * Math.PI) / 180;
    // v2 placed paper by its foot line; an item is placed by its middle.
    const cx = b.x + (b.sweepM / 2) * Math.sin(r);
    const cz = b.z + (b.sweepM / 2) * Math.cos(r);
    set = { kind: "stage", room: emptyRoom() };
    items = [item("seamless", "paper", cx, cz, { w: b.widthIn * 0.0254, d: b.sweepM, rot: b.rot, color: b.color }), bottle];
  }
  const { bottle: _b, practical: _p, ...rest } = s;
  return { ...rest, v: 3, set, items };
}

/** A loose check that a parsed file is a setup this build can open. */
export function asSetup(x: unknown): Setup | null {
  if (!x || typeof x !== "object") return null;
  const raw = x as Omit<Partial<Setup>, "v"> & { v?: number; items?: unknown };
  if (!Array.isArray(raw.shots) || !raw.shots.length || !Array.isArray(raw.talent) || !Array.isArray(raw.lights)) return null;
  if (!raw.set || !raw.win || !Array.isArray(raw.grips)) return null;
  let s: Setup;
  if (raw.v === 2) s = fromV2(raw as unknown as V2);
  else if (raw.v === 3 && Array.isArray(raw.items)) s = raw as unknown as Setup;
  else return null;
  const shots = s.shots.map((sh) => ({ ...sh, move: sh.move ?? null }));
  return { ...s, shots, activeId: shots.some((sh) => sh.id === s.activeId) ? s.activeId : shots[0].id };
}

export function loadSetup(): Setup | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? asSetup(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * Saves the setup in this browser. Uploaded storyboard frames are pictures and
 * can be large; if the browser refuses the whole thing, it is saved again
 * without them and the caller is told, rather than saving nothing. Product
 * photos and models are not in here at all: they live in IndexedDB.
 */
export function saveSetup(s: Setup): "ok" | "without-boards" | "failed" {
  const { assets: _a, ...plain } = s;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plain));
    return "ok";
  } catch {
    try {
      const lean = { ...plain, shots: plain.shots.map((x) => ({ ...x, board: x.board && x.board.length < 60000 ? x.board : null })) };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lean));
      return "without-boards";
    } catch {
      return "failed";
    }
  }
}

export function downloadSetup(s: Setup) {
  const blob = new Blob([JSON.stringify(s)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${s.name.replace(/[^\w\- ]+/g, "").trim() || "setup"}.previz.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** The asset keys a setup's items use. */
export function assetKeys(items: ItemSpec[]): string[] {
  const out: string[] = [];
  for (const i of items) {
    if (i.label) out.push(i.label);
    if (i.model?.key) out.push(i.model.key);
  }
  return out;
}

/**
 * A setup ready to send to the project. Storyboard frames uploaded into a shot
 * are data URLs and the only part of a setup that gets big; a save crosses a
 * Server Action (about 4.5MB), so past a safe size the large frames are left
 * off and the caller says so, rather than the save failing outright.
 */
export function setupForStore(s: Setup): { setup: Setup; dropped: boolean } {
  const { assets: _a, ...plain } = s;
  const setup = plain as Setup;
  if (JSON.stringify(setup).length <= 3_000_000) return { setup, dropped: false };
  return {
    setup: { ...setup, shots: setup.shots.map((x) => ({ ...x, board: x.board && x.board.length < 60000 ? x.board : null })) },
    dropped: true,
  };
}

/**
 * A scene started from a location still taken through the phone viewfinder:
 * camera 1A on the still's own body, lens and tilt, with the still as its
 * storyboard overlay, so the job of the scene builder becomes matching the
 * frame that was actually seen. With a room read from the photo, the room and
 * its furniture are built from it and the camera stands where the photo was
 * taken; without one, a plain room stands in, to be measured and corrected.
 */
export function setupFromStill(o: {
  name: string;
  bodyId: string;
  focal: number;
  aspectId: string;
  tiltDeg: number | null;
  board: string | null;
  draft: RoomDraft | null;
}): Setup {
  const d = o.draft;
  const width = d?.width ?? 5;
  const depth = d?.depth ?? 6;
  const height = d?.height ?? 2.8;
  const base = blankSetup(width, depth, height);
  const x0 = -width / 2;
  const z0 = -depth * 0.55;
  const room = d
    ? {
        x: x0, z: z0, width, depth, height, wallColor: d.wallColor, floor: d.floor,
        walls: { back: d.walls.back, left: d.walls.left, right: d.walls.right, front: false },
        openings: d.openings.map((op, i) => ({ ...op, id: `s${Date.now()}${i}` })),
      }
    : { ...emptyRoom(width, depth, height), x: x0, z: z0 };
  const items: ItemSpec[] = (d?.items ?? []).map((it) => ({
    ...newItem(it.kind, x0 + it.x, z0 + it.z),
    name: it.name,
    rot: Math.round(it.rot),
    ...(it.w ? { w: it.w } : {}),
    ...(it.d ? { d: it.d } : {}),
    ...(it.h ? { h: it.h } : {}),
    ...(it.color ? { color: it.color } : {}),
  }));
  const pos: Vec3 = d?.camera
    ? { x: x0 + d.camera.x, y: d.camera.height, z: z0 + Math.min(d.camera.z, depth - 0.3) }
    : { x: 0, y: 1.5, z: z0 + depth - 0.6 };
  const yaw = d?.camera?.yaw ?? 0;
  const pitch = o.tiltDeg ?? -2;
  const centre: Vec3 = { x: 0, y: 1.1, z: z0 + depth * 0.45 };
  const keyPos: Vec3 = { x: pos.x + 1.6, y: 2.3, z: pos.z - 1.2 };
  return {
    ...base,
    name: o.name,
    set: { kind: "room", room },
    items,
    aspectId: o.aspectId,
    shots: [{
      id: "a", code: "1A", title: "Location still", bodyId: o.bodyId, support: "sticks",
      focal: o.focal, stop: 4, pos, yaw, pitch,
      focusM: Math.max(1, depth * 0.45), focusOn: null, board: o.board, iso: 800, nd: 0, wb: 5600, move: null,
    }],
    activeId: "a",
    lights: [{
      id: "key", role: "Key", fixtureId: "ls600d", modifierId: "dome", beamDeg: null, dimmer: 0.6, cct: 5600,
      ...keyPos, ...aim(keyPos, centre), aimAt: null, frame: null, on: true,
    }],
  };
}
