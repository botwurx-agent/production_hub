// Shot blocking: the keyframe engine. Pure, so it can be tested in node.
//
// A track is a list of keys in time order. Between two keys the value moves
// along a Catmull-Rom curve through its neighbours (or a straight line), at a
// pace set by the LEAVING key's ease. Angles are unwrapped first, so a yaw
// going from 350 to 10 turns 20 degrees rather than 340. The lens is
// interpolated in log space, so a zoom from 24 to 96 passes 48 at the middle.
import type { CamKey, Ease, Key, Vec3 } from "./scene";

export function easeOf(e: Ease, u: number): number {
  const x = Math.min(1, Math.max(0, u));
  switch (e) {
    case "linear": return x;
    case "in": return x * x;
    case "out": return 1 - (1 - x) * (1 - x);
    case "hold": return 0;
    default: return x * x * (3 - 2 * x);
  }
}

/** Uniform Catmull-Rom between b and c, with a and d as the neighbours. */
function cr(a: number, b: number, c: number, d: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
}

/** Each angle moved by whole turns so it is within 180 degrees of the one before. */
export function unwrap(values: number[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (!out.length) { out.push(v); continue; }
    const prev = out[out.length - 1];
    let x = v;
    while (x - prev > 180) x -= 360;
    while (x - prev < -180) x += 360;
    out.push(x);
  }
  return out;
}

export type Pose = { p: Vec3; r: Vec3 };
export type CamPose = Pose & { lens: number };

/** Where a track is between which keys, and how far, eased. */
function locate(keys: Key[], t: number): { i: number; u: number } {
  if (t <= keys[0].t) return { i: 0, u: 0 };
  const last = keys.length - 1;
  if (t >= keys[last].t) return { i: last, u: 0 };
  let i = 0;
  while (i < last - 1 && keys[i + 1].t <= t) i++;
  const span = keys[i + 1].t - keys[i].t;
  const raw = span > 0 ? (t - keys[i].t) / span : 0;
  return { i, u: easeOf(keys[i].ease, raw) };
}

function channel(vals: number[], i: number, u: number, smooth: boolean): number {
  const n = vals.length;
  if (n === 1 || u === 0) return vals[i];
  const b = vals[i];
  const c = vals[i + 1];
  if (!smooth) return b + (c - b) * u;
  // Clamped ends: a missing neighbour mirrors the segment, so the first and
  // last segments do not overshoot.
  const a = i > 0 ? vals[i - 1] : 2 * b - c;
  const d = i + 2 < n ? vals[i + 2] : 2 * c - b;
  return cr(a, b, c, d, u);
}

export function evalTrack(keys: Key[], t: number, smooth = true): Pose {
  if (!keys.length) return { p: [0, 0, 0], r: [0, 0, 0] };
  const { i, u } = locate(keys, t);
  const p: Vec3 = [0, 0, 0];
  const r: Vec3 = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    p[c] = channel(keys.map((k) => k.p[c]), i, u, smooth);
    r[c] = channel(unwrap(keys.map((k) => k.r[c])), i, u, smooth);
  }
  return { p, r };
}

export function evalCamera(keys: CamKey[], t: number, smooth = true): CamPose {
  const base = evalTrack(keys, t, smooth);
  if (!keys.length) return { ...base, lens: 35 };
  const { i, u } = locate(keys, t);
  const logs = keys.map((k) => Math.log(Math.max(1, k.lens)));
  // Not Catmull-Rom: a curve through log lens values overshoots a zoom.
  const l = keys.length === 1 || u === 0 ? logs[i] : logs[i] + (logs[i + 1] - logs[i]) * u;
  return { ...base, lens: Math.exp(l) };
}

/** Puts a key at time t, replacing any key within half a frame of it. */
export function setKey<T extends Key>(keys: T[], key: T, fps: number): T[] {
  const half = 0.5 / fps;
  const rest = keys.filter((k) => Math.abs(k.t - key.t) >= half);
  return [...rest, key].sort((a, b) => a.t - b.t);
}

export const keyAt = <T extends Key>(keys: T[], t: number, fps: number): T | undefined =>
  keys.find((k) => Math.abs(k.t - t) < 0.5 / fps);

export const snap = (t: number, fps: number) => Math.round(t * fps) / fps;

/* ---------- handheld shake ---------- */

/**
 * A deterministic wobble: three incommensurate sines per channel, so it never
 * visibly repeats and the same time always gives the same frame (a recorded
 * clip and a scrub agree). `amount` 1 is a loose handheld, 0.2 a stabilised one.
 */
export function shakeAt(t: number, amount: number, speed: number): { p: Vec3; r: Vec3 } {
  if (amount <= 0) return { p: [0, 0, 0], r: [0, 0, 0] };
  const w = (seed: number) => {
    const s = t * speed;
    return (Math.sin(s * 1.7 + seed) * 0.5 + Math.sin(s * 3.13 + seed * 2.1) * 0.32 + Math.sin(s * 7.37 + seed * 3.7) * 0.18);
  };
  const m = 0.025 * amount;
  const a = 1.4 * amount;
  return { p: [w(1) * m, w(2) * m, w(3) * m * 0.5], r: [w(4) * a, w(5) * a, w(6) * a * 0.6] };
}

/* ---------- aiming ---------- */

/** The yaw and pitch that point a camera at `from` toward `to` (yaw 0 looks down -Z). */
export function aimAt(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const yaw = (Math.atan2(-dx, -dz) * 180) / Math.PI;
  const pitch = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
  return { yaw, pitch };
}

/** The direction a camera looks at a yaw and pitch. */
export function lookDir(yaw: number, pitch: number): Vec3 {
  const y = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  return [-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)];
}

/* ---------- move presets ---------- */

export type PresetId = "orbit" | "orbit-half" | "push" | "pull" | "crane-up" | "crane-down" | "flyby" | "dolly-zoom" | "whip" | "reveal" | "arc";
export const PRESETS: { id: PresetId; name: string; hint: string }[] = [
  { id: "push", name: "Push in", hint: "Moves toward the target, closing to a third of the distance" },
  { id: "pull", name: "Pull out", hint: "Backs away to twice the distance" },
  { id: "orbit", name: "Orbit", hint: "A full circle round the target" },
  { id: "orbit-half", name: "Half orbit", hint: "Half way round the target" },
  { id: "arc", name: "Arc", hint: "A 60 degree arc, pushing in a little" },
  { id: "crane-up", name: "Crane up", hint: "Rises 3 m, tilting down to hold the target" },
  { id: "crane-down", name: "Crane down", hint: "Comes down from 3 m above" },
  { id: "reveal", name: "Rise and reveal", hint: "Starts low behind a foreground, rises over it" },
  { id: "flyby", name: "Fly-by", hint: "Passes the target side on, panning to hold it" },
  { id: "dolly-zoom", name: "Dolly zoom", hint: "Pulls back while zooming in, so the subject holds its size" },
  { id: "whip", name: "Whip pan", hint: "Holds, then whips 90 degrees in a third of a second" },
];

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Keys for a move, starting from the camera as it stands at t0, aimed at a
 * target point. The camera's own key at t0 is the first key, so a preset
 * picks up exactly where the shot is.
 */
export function presetKeys(id: PresetId, start: CamPose, target: Vec3, t0: number, dur: number, steps = 8): CamKey[] {
  const [tx, ty, tz] = target;
  const dx = start.p[0] - tx;
  const dz = start.p[2] - tz;
  const radius = Math.max(0.5, Math.hypot(dx, dz));
  const ang0 = Math.atan2(dx, dz);
  const height = start.p[1];
  const out: CamKey[] = [];
  const at = (u: number, p: Vec3, lens = start.lens, ease: Ease = "smooth", rollDeg = start.r[2]) => {
    const a = aimAt(p, target);
    out.push({ t: t0 + dur * u, p, r: [a.yaw, a.pitch, rollDeg], lens, ease });
  };
  const ring = (angle: number, rr: number, h: number): Vec3 => [tx + Math.sin(angle) * rr, h, tz + Math.cos(angle) * rr];
  switch (id) {
    case "push":
    case "pull": {
      const f = id === "push" ? 0.35 : 2;
      for (const u of [0, 1]) {
        const k = 1 + (f - 1) * u;
        at(u, [tx + dx * k, ty + (start.p[1] - ty) * k, tz + dz * k], start.lens, "smooth");
      }
      break;
    }
    case "orbit":
    case "orbit-half":
    case "arc": {
      const sweep = id === "orbit" ? Math.PI * 2 : id === "orbit-half" ? Math.PI : rad(60);
      const n = id === "arc" ? 3 : steps;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const rr = id === "arc" ? radius * (1 - 0.25 * u) : radius;
        // Linear between the in-between keys keeps an orbit at an even pace;
        // only the very first and last ease.
        at(u, ring(ang0 + sweep * u, rr, height), start.lens, i === 0 ? "in" : i === n - 1 ? "out" : "linear");
      }
      break;
    }
    case "crane-up":
    case "crane-down": {
      const lift = 3;
      const a = id === "crane-up" ? height : height + lift;
      const b = id === "crane-up" ? height + lift : height;
      for (const u of [0, 1]) at(u, [start.p[0], a + (b - a) * u, start.p[2]]);
      break;
    }
    case "reveal": {
      at(0, [start.p[0], Math.max(0.3, ty * 0.25), start.p[2]]);
      at(1, [start.p[0] - dx * 0.2, height + 2, start.p[2] - dz * 0.2]);
      break;
    }
    case "flyby": {
      // A straight line past the target, side on to the camera's own line.
      const side: Vec3 = [Math.cos(ang0), 0, -Math.sin(ang0)];
      const pass = Math.max(1.5, radius * 0.6);
      const half = Math.max(4, radius * 1.4);
      const base: Vec3 = [tx + Math.sin(ang0) * pass, height, tz + Math.cos(ang0) * pass];
      for (let i = 0; i <= 4; i++) {
        const u = i / 4;
        const s = -half + 2 * half * u;
        at(u, [base[0] + side[0] * s, height, base[2] + side[2] * s], start.lens, "linear");
      }
      break;
    }
    case "dolly-zoom": {
      // Subject size goes as lens / distance: double the distance, double the lens.
      const back = 2.2;
      for (const u of [0, 1]) {
        const k = 1 + (back - 1) * u;
        at(u, [tx + dx * k, ty + (start.p[1] - ty) * k, tz + dz * k], Math.min(600, start.lens * k));
      }
      break;
    }
    case "whip": {
      const r0 = start.r;
      const t1 = Math.max(0, dur - 0.33);
      out.push({ t: t0, p: start.p, r: r0, lens: start.lens, ease: "hold" });
      out.push({ t: t0 + t1, p: start.p, r: r0, lens: start.lens, ease: "in" });
      out.push({ t: t0 + dur, p: start.p, r: [r0[0] - 90, r0[1], r0[2]], lens: start.lens, ease: "smooth" });
      break;
    }
  }
  return out;
}

/** Replaces the keys inside [t0, t1] with the preset's keys. */
export function applyPreset(keys: CamKey[], made: CamKey[], fps: number): CamKey[] {
  if (!made.length) return keys;
  const t0 = made[0].t;
  const t1 = made[made.length - 1].t;
  const half = 0.5 / fps;
  const kept = keys.filter((k) => k.t < t0 - half || k.t > t1 + half);
  return [...kept, ...made].sort((a, b) => a.t - b.t);
}

/* ---------- reading a move back ---------- */

/** Peak speed along a track, m/s, sampled at the frame rate. */
export function peakSpeed(keys: Key[], duration: number, fps: number, smooth = true): number {
  if (keys.length < 2) return 0;
  let peak = 0;
  let prev = evalTrack(keys, 0, smooth).p;
  for (let f = 1; f <= Math.round(duration * fps); f++) {
    const p = evalTrack(keys, f / fps, smooth).p;
    peak = Math.max(peak, Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) * fps);
    prev = p;
  }
  return peak;
}

/** Total distance travelled, metres. */
export function travel(keys: Key[], duration: number, fps: number, smooth = true): number {
  if (keys.length < 2) return 0;
  let d = 0;
  let prev = evalTrack(keys, 0, smooth).p;
  for (let f = 1; f <= Math.round(duration * fps); f++) {
    const p = evalTrack(keys, f / fps, smooth).p;
    d += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
    prev = p;
  }
  return d;
}

/** "00:03:12" style: seconds and frames. */
export function timecode(t: number, fps: number): string {
  const f = Math.round(t * fps);
  const s = Math.floor(f / fps);
  const ff = f % fps;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}:${String(ff).padStart(2, "0")}`;
}
