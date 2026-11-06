// Shot blocking: how a person's legs move when their track carries them.
// Pure (no three.js), so it can be tested in node.
//
// A person walks or runs at whatever speed their keys move them, and the
// stride is worked out from that speed rather than played from a clip, so
// the feet never slide: a foot on the ground moves backward under the body at
// exactly the speed the body moves forward, which is what keeps it still on
// the ground. The step rate (cadence) rises with speed the way people's does,
// and the stride length is whatever that leaves (speed / cadence).
//
// The phase of the step cycle is the cadence INTEGRATED over time, not
// cadence x time, so a person who speeds up keeps their footing instead of
// the legs jumping to a new place in the cycle.
import { evalTrack } from "./keys";
import type { Key } from "./scene";

export type Gait = {
  /** How much the legs walk, 0 (standing) to 1. */
  walk: number;
  /** How much of that is a run, 0 (a walk) to 1 (a run). */
  run: number;
  /** Step cycles so far: the fractional part is where the cycle is. */
  phase: number;
  /** Metres per second over the ground. */
  speed: number;
  /** Direction of travel in the person's own frame (x right... z forward), unit. */
  dir: [number, number];
  /** How far the stance foot travels under the body in one stance, metres. */
  excursion: number;
  /** Share of the cycle a foot is on the ground. */
  duty: number;
};

export const STILL: Gait = { walk: 0, run: 0, phase: 0, speed: 0, dir: [0, 1], excursion: 0, duty: 0.6 };

const smoothstep = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const rad = (d: number) => (d * Math.PI) / 180;

/** Thresholds and step rates are set for a 1.75 m adult and scale with height. */
const scale = (H: number) => Math.sqrt(Math.max(0.5, H) / 1.75);

/** How much the legs walk at a speed. Below about 0.15 m/s a person shuffles, not walks. */
export const walkWeight = (v: number, H: number) => smoothstep(0.12 * scale(H), 0.45 * scale(H), v);
/** A walk becomes a run around 2.2 m/s (about 5 mph) for an adult. */
export const runWeight = (v: number, H: number) => smoothstep(2.0 * scale(H), 2.9 * scale(H), v);

/**
 * Step cycles per second (one cycle is two steps). A walk at 1.4 m/s is about
 * 1.05 cycles a second for these figures, a run at 4 m/s about 1.5. Shorter
 * people step quicker.
 */
export function cadence(v: number, H: number): number {
  const s = scale(H);
  const r = runWeight(v, H);
  const walk = 0.75 + 0.22 * Math.min(v / s, 2.6);
  const run = 1.28 + 0.05 * Math.min(v / s, 8);
  const c = lerp(walk, run, r) / s;
  // A foot can only travel so far under the body before the leg runs out, so
  // past that a faster person takes quicker steps rather than longer ones.
  return Math.max(c, (dutyFactor(r, v / s) * v) / maxExcursion(H, r));
}

/**
 * Share of the cycle each foot is on the ground: 0.6 walking, 0.32 running,
 * falling toward 0.24 at a sprint, where the feet barely touch.
 */
export const dutyFactor = (run: number, v = 0) => lerp(0.6, Math.max(0.24, 0.32 - 0.03 * Math.max(0, v - 3.5)), run);

/** The figures' legs are 0.45 of their height, hip joint to ankle. */
export const legLength = (H: number) => 0.45 * H;

/** The longest a foot travels on the ground in one stance: a run keeps its feet under it. */
export const maxExcursion = (H: number, run: number) => legLength(H) * lerp(1.05, 0.82, run);

const H_STEP = 1 / 60;

/** Speed and direction of travel in the person's own frame, at t. */
export function travelAt(keys: Key[], t: number): { speed: number; dir: [number, number] } {
  if (keys.length < 2) return { speed: 0, dir: [0, 1] };
  const a = evalTrack(keys, Math.max(0, t - H_STEP));
  const b = evalTrack(keys, t + H_STEP);
  const span = t + H_STEP - Math.max(0, t - H_STEP);
  const wx = (b.p[0] - a.p[0]) / span;
  const wz = (b.p[2] - a.p[2]) / span;
  const speed = Math.hypot(wx, wz);
  if (speed < 1e-4) return { speed: 0, dir: [0, 1] };
  // Into the person's own frame: undo their yaw.
  const yaw = rad(evalTrack(keys, t).r[0]);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const lx = wx * c - wz * s;
  const lz = wx * s + wz * c;
  return { speed, dir: [lx / speed, lz / speed] };
}

/** Cumulative phase sampled every DT, per keys array (an edit makes a new array). */
const DT = 1 / 120;
const tables = new WeakMap<Key[], Map<number, number[]>>();

function phaseAt(keys: Key[], t: number, H: number): number {
  let byH = tables.get(keys);
  if (!byH) { byH = new Map(); tables.set(keys, byH); }
  const hk = Math.round(H * 1000);
  let tab = byH.get(hk);
  if (!tab) { tab = [0]; byH.set(hk, tab); }
  const need = Math.ceil(Math.max(0, t) / DT) + 1;
  while (tab.length <= need) {
    const i = tab.length - 1;
    const tm = (i + 0.5) * DT;
    const v = travelAt(keys, tm).speed;
    // A person standing still is not mid-step: the cycle only runs while walking.
    tab.push(tab[i] + cadence(v, H) * walkWeight(v, H) * DT);
  }
  const x = Math.max(0, t) / DT;
  const i = Math.floor(x);
  return lerp(tab[i], tab[i + 1], x - i);
}

/** The gait at t, for a person H metres tall whose track is `keys`. */
export function gaitAt(keys: Key[], t: number, H: number): Gait {
  const { speed, dir } = travelAt(keys, t);
  const walk = walkWeight(speed, H);
  if (walk <= 1e-3) return { ...STILL, phase: keys.length >= 2 ? phaseAt(keys, t, H) : 0 };
  const run = runWeight(speed, H);
  const c = cadence(speed, H);
  const duty = dutyFactor(run, speed / scale(H));
  // A foot on the ground covers what the body covers while it is down. The
  // cycle runs at cadence x walk (it eases in from standing), so that is the
  // rate to divide by; capped so a shuffle does not become a lunge.
  const excursion = Math.min((duty * speed) / (c * Math.max(walk, 0.05)), maxExcursion(H, run));
  return { walk, run, phase: phaseAt(keys, t, H), speed, dir, excursion, duty };
}

/**
 * Where one foot is in its cycle: on the ground (stance, s from 0 at heel
 * strike to 1 at toe off) or in the air (swing, s from 0 at toe off to 1 at
 * the next strike). Leg 1 runs half a cycle behind leg 0.
 */
export function footPhase(phase: number, leg: 0 | 1, duty: number): { stance: boolean; s: number } {
  const x = (((phase + leg * 0.5) % 1) + 1) % 1;
  return x < duty ? { stance: true, s: x / duty } : { stance: false, s: (x - duty) / (1 - duty) };
}

/** What a speed looks like on foot, in words, for the properties panel. */
export function gaitWord(v: number, H: number): string {
  const x = v / scale(H);
  if (x < 0.15) return "barely moving, so the feet stay put";
  if (x < 0.9) return "a stroll";
  if (x < 1.7) return "a walk";
  if (x < 2.1) return "a brisk walk";
  if (x < 3.2) return "a jog";
  if (x < 5.2) return "a run";
  return "a sprint";
}
