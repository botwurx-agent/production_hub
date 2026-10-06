// The Scene Setup prototype's document: everything a setup holds, the setups
// it can start from, and keeping it in this browser so closing the tab does
// not lose an afternoon's work. Nothing here reaches a server: the real build
// stores setups in the database, and this is the stand-in until then.
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
import { SAMPLE_BOARDS } from "@/lib/previz/boards";
import type { WindowSky } from "@/lib/previz/lighting";
import type { EmbeddedAsset } from "@/lib/previz/asset-store";

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

/** The kitchen the prototype has always opened on. */
export function kitchenSetup(): Setup {
  return {
    v: 3,
    name: "Kitchen, morning",
    set: { kind: "room", room: KITCHEN_ROOM },
    items: [...kitchenItems(), item("bottle", "bottle", 0.18, -0.52, { name: "Hero bottle" })],
    shots: [
      shot("a", "1A", "Wide", "sticks", 25, 4, 0.3, { x: 0.4, y: 1.55, z: 3.6 }, { x: -0.1, y: 0.95, z: -0.8 }, "leo", 4, SAMPLE_BOARDS["1A"] ?? null),
      shot("b", "1B", "Two shot", "fisher", 40, 2.8, 0.6, { x: 0.1, y: 1.35, z: 1.9 }, { x: -0.3, y: 1.15, z: -0.8 }, "leo", 3, SAMPLE_BOARDS["1B"] ?? null),
      shot("c", "1C", "Product close-up", "robot", 85, 2, 0.9, { x: 0.45, y: 0.92, z: 0.55 }, { x: 0.18, y: 0.84, z: -0.52 }, "bottle", 1, SAMPLE_BOARDS["1C"] ?? null),
    ],
    activeId: "b",
    talent: [
      { id: "maya", name: "Maya", heightM: 1.68, pose: "standing", x: -1.15, z: -0.35, facing: 70, top: "#9b5a3d", bottom: "#33373f" },
      { id: "leo", name: "Leo", heightM: 1.83, pose: "seated", x: 0.35, z: -1.3, facing: 0, top: "#3f5c7c", bottom: "#857a62" },
    ],
    lights: [
      { id: "key", role: "Key", fixtureId: "ls600d", modifierId: "dome", beamDeg: null, dimmer: 0.6, cct: 5600, x: 2.6, y: 2.3, z: 0.3, yaw: 0, pitch: 0, aimAt: "leo", frame: null, on: true },
      { id: "rim", role: "Rim", fixtureId: "titan", modifierId: "bare", beamDeg: null, dimmer: 1, cct: 5600, x: 3.2, y: 1.7, z: -1.6, yaw: 0, pitch: 0, aimAt: "leo", frame: null, on: true },
    ],
    grips: [{ id: "g1", kind: "bounce", sizeFt: 4, x: -2.2, y: 1.2, z: 0.8, yaw: 0, pitch: 0, aimAt: "leo" }],
    win: { sky: "overcast", nd: 0, on: true },
    units: "ft",
    aspectId: "16x9",
  };
}

/**
 * Talent against a backdrop, the commonest commercial setup: 9 ft white
 * seamless, two people a good distance off the paper so their shadows fall
 * on the floor rather than the background, a soft key, a back light and a
 * bounce. The two shot already carries a slow push in, so pressing play shows
 * what a move is.
 */
export function studioSetup(): Setup {
  const twoShot = shot("b", "1B", "Two shot", "fisher", 35, 4, 0, { x: 0, y: 1.45, z: 3.6 }, { x: 0, y: 1.25, z: -0.2 }, "ava", 3.8, null, 800);
  twoShot.move = {
    end: { pos: { x: 0, y: 1.45, z: 2.6 }, yaw: twoShot.yaw, pitch: twoShot.pitch, focal: 35, focusM: 2.8, focusOn: "ava" },
    durationS: 4,
    ease: "smooth",
    trackYaw: twoShot.yaw,
  };
  return {
    v: 3,
    name: "Studio, talent on seamless",
    set: { kind: "stage", room: emptyRoom() },
    items: [
      item("seamless", "paper", 0, -0.9),
      item("bottle", "bottle", 0.5, 0.1, { name: "Hero bottle" }),
    ],
    shots: [
      shot("a", "1A", "Wide", "sticks", 32, 4, 0, { x: 0, y: 1.5, z: 4.4 }, { x: 0, y: 1.0, z: -0.4 }, "ava", 4.6, null, 800),
      twoShot,
      shot("c", "1C", "Product in hand", "robot", 85, 2.8, 0.3, { x: 0.1, y: 1.3, z: 1.85 }, { x: 0.24, y: 1.27, z: 0.02 }, "bottle", 1.8, null, 800),
    ],
    activeId: "b",
    talent: [
      { id: "ava", name: "Ava", heightM: 1.7, pose: "standing", x: -0.45, z: -0.2, facing: 8, top: "#c4553d", bottom: "#2f3542" },
      { id: "sam", name: "Sam", heightM: 1.83, pose: "holding", x: 0.45, z: -0.25, facing: -12, top: "#3d6c8c", bottom: "#d6d0c4", holding: "bottle" },
    ],
    lights: [
      { id: "key", role: "Key", fixtureId: "ls600d", modifierId: "dome", beamDeg: null, dimmer: 0.55, cct: 5600, x: 1.9, y: 2.2, z: 1.5, yaw: 0, pitch: 0, aimAt: "ava", frame: null, on: true },
      { id: "back", role: "Back", fixtureId: "ls300x", modifierId: "reflector", beamDeg: null, dimmer: 0.35, cct: 5600, x: -1.7, y: 2.4, z: -1.3, yaw: 0, pitch: 0, aimAt: "sam", frame: null, on: true },
    ],
    grips: [{ id: "g1", kind: "bounce", sizeFt: 4, x: -1.9, y: 1.2, z: 1.1, yaw: 0, pitch: 0, aimAt: "ava" }],
    win: { sky: "overcast", nd: 0, on: false },
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
