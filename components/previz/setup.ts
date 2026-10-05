// The Scene Setup prototype's document: everything a setup holds, the two
// setups it can start from, and keeping it in this browser so closing the tab
// does not lose an afternoon's work. Nothing here reaches a server: the real
// build stores setups in the database, and this is the stand-in until then.
import type { Move } from "@/lib/previz/camera-move";
import type { SupportKind } from "@/lib/previz/camera-model";
import type { GripSpec, LightSpec } from "@/lib/previz/light-build";
import type { PropSpec, TalentSpec } from "@/lib/previz/scene-build";
import { DEFAULT_BACKDROP, type SetSpec } from "@/lib/previz/studio-set";
import { SAMPLE_BOARDS } from "@/lib/previz/boards";
import type { WindowSky } from "@/lib/previz/lighting";

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
  focusOn: string | null; // a talent id or "bottle": focus follows it
  board: string | null;
  iso: number;
  nd: number;
  wb: number;
  /** A camera move: this shot's own values are the start frame. */
  move: Move | null;
};
export type WinState = { sky: WindowSky; nd: number; on: boolean };
export type PracticalState = { on: boolean; dimmer: number; cct: number };
export type Units = "ft" | "m";

export type Setup = {
  v: 2;
  name: string;
  set: SetSpec;
  shots: Shot[];
  activeId: string;
  talent: TalentSpec[];
  bottle: PropSpec;
  lights: LightSpec[];
  grips: GripSpec[];
  win: WinState;
  practical: PracticalState;
  units: Units;
  aspectId: string;
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

/** The kitchen the prototype has always opened on. */
export function kitchenSetup(): Setup {
  return {
    v: 2,
    name: "Kitchen, morning",
    set: { kind: "kitchen", backdrop: { ...DEFAULT_BACKDROP } },
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
    bottle: { id: "bottle", name: "Hero bottle", x: 0.18, z: -0.52 },
    lights: [
      { id: "key", role: "Key", fixtureId: "ls600d", modifierId: "dome", beamDeg: null, dimmer: 0.6, cct: 5600, x: 2.6, y: 2.3, z: 0.3, yaw: 0, pitch: 0, aimAt: "leo", frame: null, on: true },
      { id: "rim", role: "Rim", fixtureId: "titan", modifierId: "bare", beamDeg: null, dimmer: 1, cct: 5600, x: 3.2, y: 1.7, z: -1.6, yaw: 0, pitch: 0, aimAt: "leo", frame: null, on: true },
    ],
    grips: [{ id: "g1", kind: "bounce", sizeFt: 4, x: -2.2, y: 1.2, z: 0.8, yaw: 0, pitch: 0, aimAt: "leo" }],
    win: { sky: "overcast", nd: 0, on: true },
    practical: { on: true, dimmer: 1, cct: 2700 },
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
    v: 2,
    name: "Studio, talent on seamless",
    set: { kind: "studio", backdrop: { ...DEFAULT_BACKDROP } },
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
    bottle: { id: "bottle", name: "Hero bottle", x: 0.5, z: 0.1 },
    lights: [
      { id: "key", role: "Key", fixtureId: "ls600d", modifierId: "dome", beamDeg: null, dimmer: 0.55, cct: 5600, x: 1.9, y: 2.2, z: 1.5, yaw: 0, pitch: 0, aimAt: "ava", frame: null, on: true },
      { id: "back", role: "Back", fixtureId: "ls300x", modifierId: "reflector", beamDeg: null, dimmer: 0.35, cct: 5600, x: -1.7, y: 2.4, z: -1.3, yaw: 0, pitch: 0, aimAt: "sam", frame: null, on: true },
    ],
    grips: [{ id: "g1", kind: "bounce", sizeFt: 4, x: -1.9, y: 1.2, z: 1.1, yaw: 0, pitch: 0, aimAt: "ava" }],
    win: { sky: "overcast", nd: 0, on: false },
    practical: { on: false, dimmer: 1, cct: 2700 },
    units: "ft",
    aspectId: "16x9",
  };
}

export const STORAGE_KEY = "previz.setup.v2";

/** A loose check that a parsed file is a setup this build can open. */
export function asSetup(x: unknown): Setup | null {
  if (!x || typeof x !== "object") return null;
  const s = x as Partial<Setup>;
  if (s.v !== 2 || !Array.isArray(s.shots) || !s.shots.length || !Array.isArray(s.talent) || !Array.isArray(s.lights)) return null;
  if (!s.set || !s.bottle || !s.win || !s.practical || !Array.isArray(s.grips)) return null;
  const shots = s.shots.map((sh) => ({ ...sh, move: sh.move ?? null }));
  return { ...(s as Setup), shots, activeId: shots.some((sh) => sh.id === s.activeId) ? s.activeId! : shots[0].id };
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
 * without them and the caller is told, rather than saving nothing.
 */
export function saveSetup(s: Setup): "ok" | "without-boards" | "failed" {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return "ok";
  } catch {
    try {
      const lean = { ...s, shots: s.shots.map((x) => ({ ...x, board: x.board && x.board.length < 60000 ? x.board : null })) };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lean));
      return "without-boards";
    } catch {
      return "failed";
    }
  }
}

export function downloadSetup(s: Setup) {
  const blob = new Blob([JSON.stringify(s, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${s.name.replace(/[^\w\- ]+/g, "").trim() || "setup"}.previz.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
