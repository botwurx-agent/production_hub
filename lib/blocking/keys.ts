// Shot blocking: the keyframe engine. Pure, so it can be tested in node.
//
// A track is a list of keys in time order. Between two keys the value moves
// along a Catmull-Rom curve through its neighbours (or a straight line), at a
// pace set by the LEAVING key's ease. Angles are unwrapped first, so a yaw
// going from 350 to 10 turns 20 degrees rather than 340. The lens is
// interpolated in log space, so a zoom from 24 to 96 passes 48 at the middle.
import type { CamKey, CameraFlow, Ease, GestureKind, Key, Vec3 } from "./scene";

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
/** `af` is the aim framing offset (see CamKey), interpolated like the angles. */
export type CamPose = Pose & { lens: number; af: [number, number] };
const afOf = (k: CamKey, c: 0 | 1) => (k.af ? k.af[c] : 0);

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

/**
 * A person's gesture at time t: which gesture, how far into it (0 to 1), and
 * the lean (degrees, back positive). Eased by each key's own ease but straight
 * between keys, never a curve: an amount that overshoots 1 would punch through
 * whatever the hand reaches for. A key without `g` counts as 0, 0; a key
 * without `gk` is a reach.
 *
 * Each key names its own gesture, so a person can wave at 2 s and pick up the
 * phone at 8 s. Between two keys holding DIFFERENT gestures the first winds
 * down to nothing over the first half and the second comes up over the
 * second half, the way a person drops one arm before raising the other,
 * rather than one gesture morphing into the other.
 */
export function evalGesture(keys: Key[], t: number): { reach: number; lean: number; kind: GestureKind } {
  if (!keys.length || !keys.some((k) => k.g)) return { reach: 0, lean: 0, kind: "reach" };
  const { i, u } = locate(keys, t);
  const amt = (j: number) => keys[j].g?.[0] ?? 0;
  const lean = (j: number) => keys[j].g?.[1] ?? 0;
  const kind = (j: number): GestureKind => keys[j].gk ?? "reach";
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  if (u === 0 || i + 1 >= keys.length) return { reach: clamp(amt(i)), lean: lean(i), kind: kind(i) };
  const a = amt(i);
  const b = amt(i + 1);
  const l = lean(i) + (lean(i + 1) - lean(i)) * u;
  const ka = kind(i);
  const kb = kind(i + 1);
  if (ka === kb || a <= 1e-4 || b <= 1e-4) {
    // One gesture across the segment: whichever end is actually doing it.
    return { reach: clamp(a + (b - a) * u), lean: l, kind: b > 1e-4 ? kb : ka };
  }
  return u < 0.5 ? { reach: clamp(a * (1 - 2 * u)), lean: l, kind: ka } : { reach: clamp(b * (2 * u - 1)), lean: l, kind: kb };
}

export type FlowOpts = { flow?: CameraFlow; easeEnds?: boolean };

export function evalCamera(keys: CamKey[], t: number, smooth = true, opts: FlowOpts = {}): CamPose {
  const flow = opts.flow ?? "keys";
  if (keys.length >= 2 && flow !== "keys") {
    if (flow === "even") return evenCamera(keys, t, smooth, opts.easeEnds !== false);
    return flowCamera(keys, t, smooth, opts.easeEnds !== false);
  }
  const base = evalTrack(keys, t, smooth);
  if (!keys.length) return { ...base, lens: 35, af: [0, 0] };
  const { i, u } = locate(keys, t);
  const lin = (vals: number[]) => (keys.length === 1 || u === 0 ? vals[i] : vals[i] + (vals[i + 1] - vals[i]) * u);
  // Not Catmull-Rom: a curve through log lens values overshoots a zoom.
  const l = lin(keys.map((k) => Math.log(Math.max(1, k.lens))));
  return { ...base, lens: Math.exp(l), af: [lin(keys.map((k) => afOf(k, 0))), lin(keys.map((k) => afOf(k, 1)))] };
}

/* ---------- continuous flow ---------- */

/**
 * A curve through values at given times whose VELOCITY is continuous across
 * every key, so nothing stops at a key unless the path itself turns back.
 * Cubic Hermite with each key's slope taken from its neighbours over the time
 * between them (Catmull-Rom on the real key times, not on key count, which is
 * what keeps the speed steady where keys are unevenly spaced). `monotone`
 * flattens a slope where the values turn round, so a lens or an angle never
 * overshoots its key. `restEnds` starts and ends at zero velocity.
 */
export function flowChannel(times: number[], vals: number[], t: number, opts: { monotone?: boolean; restEnds?: boolean; linear?: boolean; slopes?: (number | null)[] } = {}): number {
  const n = vals.length;
  if (n === 1) return vals[0];
  if (t <= times[0]) return vals[0];
  if (t >= times[n - 1]) return vals[n - 1];
  let i = 0;
  while (i < n - 2 && times[i + 1] <= t) i++;
  const h = times[i + 1] - times[i];
  if (h <= 0) return vals[i + 1];
  const s = (t - times[i]) / h;
  if (opts.linear) return vals[i] + (vals[i + 1] - vals[i]) * s;
  const slope = (j: number): number => {
    const fixed = opts.slopes?.[j];
    if (fixed != null) return fixed;
    const d = (a: number, b: number) => (vals[b] - vals[a]) / Math.max(1e-6, times[b] - times[a]);
    if (j === 0) return opts.restEnds ? 0 : d(0, 1);
    if (j === n - 1) return opts.restEnds ? 0 : d(n - 2, n - 1);
    const m = d(j - 1, j + 1);
    if (opts.monotone) {
      const a = d(j - 1, j);
      const b = d(j, j + 1);
      if (a * b <= 0) return 0;
      // Fritsch-Carlson: never steeper than three times either side.
      return Math.sign(m) * Math.min(Math.abs(m), 3 * Math.abs(a), 3 * Math.abs(b));
    }
    return m;
  };
  const m0 = slope(i);
  const m1 = slope(i + 1);
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * vals[i] + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * vals[i + 1] + (s3 - s2) * h * m1;
}

/**
 * The time a curve handle is measured against: the mean of the gaps either
 * side of the key. A handle offset of `tan` is a slope of 3 * tan / span, the
 * Bezier relation, so the handle drawn at key + tan is where the curve heads.
 */
export function handleSpan(times: number[], j: number): number {
  const n = times.length;
  const gaps: number[] = [];
  if (j > 0) gaps.push(times[j] - times[j - 1]);
  if (j < n - 1) gaps.push(times[j + 1] - times[j]);
  const g = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 1;
  return Math.max(1e-3, g);
}

/** The slope (m/s) each key's handle fixes on channel c, or null for automatic. */
function handleSlopes(keys: CamKey[], c: number): (number | null)[] {
  const times = keys.map((k) => k.t);
  return keys.map((k, j) => (k.tan ? (3 * k.tan[c]) / handleSpan(times, j) : null));
}

/**
 * Where a key's handle sits, as an offset from the key: its own when set,
 * otherwise the automatic curve's, so a handle drawn for an untouched key
 * starts on the path rather than jumping when grabbed.
 */
export function keyHandle(keys: CamKey[], j: number, restEnds: boolean): Vec3 {
  const k = keys[j];
  if (k.tan) return [...k.tan] as Vec3;
  const times = keys.map((x) => x.t);
  const n = keys.length;
  const span = handleSpan(times, j);
  const out: Vec3 = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    let m = 0;
    if (n > 1) {
      const d = (a: number, b: number) => (keys[b].p[c] - keys[a].p[c]) / Math.max(1e-6, times[b] - times[a]);
      if (j === 0) m = restEnds ? 0 : d(0, 1);
      else if (j === n - 1) m = restEnds ? 0 : d(n - 2, n - 1);
      else m = d(j - 1, j + 1);
    }
    out[c] = (m * span) / 3;
  }
  return out;
}

function flowCamera(keys: CamKey[], t: number, smooth: boolean, restEnds: boolean): CamPose {
  const times = keys.map((k) => k.t);
  const p: Vec3 = [0, 0, 0];
  const r: Vec3 = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    p[c] = flowChannel(times, keys.map((k) => k.p[c]), t, { restEnds, linear: !smooth, slopes: handleSlopes(keys, c) });
    // Angles turn as smoothly as the path but never overshoot a key.
    r[c] = flowChannel(times, unwrap(keys.map((k) => k.r[c])), t, { restEnds, monotone: true, linear: !smooth });
  }
  const lens = Math.exp(flowChannel(times, keys.map((k) => Math.log(Math.max(1, k.lens))), t, { restEnds, monotone: true, linear: !smooth }));
  const af: [number, number] = [0, 1].map((c) =>
    flowChannel(times, keys.map((k) => afOf(k, c as 0 | 1)), t, { restEnds, monotone: true, linear: !smooth })) as [number, number];
  return { p, r, lens, af };
}

/* ---------- even speed ---------- */

type EvenTable = { t0: number; t1: number; ts: number[]; cum: number[] };
const evenCache = new WeakMap<CamKey[], Map<string, EvenTable>>();

/** The flowing path sampled finely, with the distance travelled at each sample. */
function evenTable(keys: CamKey[], smooth: boolean): EvenTable {
  const k = `${smooth}`;
  let m = evenCache.get(keys);
  if (!m) { m = new Map(); evenCache.set(keys, m); }
  const hit = m.get(k);
  if (hit) return hit;
  const t0 = keys[0].t;
  const t1 = keys[keys.length - 1].t;
  const N = Math.max(64, Math.min(2000, Math.round((t1 - t0) * 60)));
  const ts: number[] = [];
  const cum: number[] = [];
  let prev = flowCamera(keys, t0, smooth, false).p;
  let d = 0;
  for (let i = 0; i <= N; i++) {
    const tt = t0 + ((t1 - t0) * i) / N;
    const q = flowCamera(keys, tt, smooth, false).p;
    d += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]);
    ts.push(tt);
    cum.push(d);
    prev = q;
  }
  const out = { t0, t1, ts, cum };
  m.set(k, out);
  return out;
}

/**
 * Share of the distance covered at share u of the time. With rested ends the
 * speed ramps up over the first fifth and down over the last (a trapezoid),
 * otherwise it is steady throughout.
 */
export function evenProfile(u: number, restEnds: boolean): number {
  const x = Math.min(1, Math.max(0, u));
  if (!restEnds) return x;
  const a = 0.2;
  const vmax = 1 / (1 - a);
  if (x < a) return (vmax * x * x) / (2 * a);
  if (x > 1 - a) { const y = 1 - x; return 1 - (vmax * y * y) / (2 * a); }
  return vmax * (x - a / 2);
}

function evenCamera(keys: CamKey[], t: number, smooth: boolean, restEnds: boolean): CamPose {
  const tb = evenTable(keys, smooth);
  const total = tb.cum[tb.cum.length - 1];
  if (total < 1e-4 || tb.t1 <= tb.t0) return flowCamera(keys, t, smooth, restEnds);
  const u = (t - tb.t0) / (tb.t1 - tb.t0);
  const want = evenProfile(u, restEnds) * total;
  // The time along the path at which that distance is reached.
  let lo = 0;
  let hi = tb.cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tb.cum[mid] < want) lo = mid; else hi = mid; }
  const span = tb.cum[hi] - tb.cum[lo];
  const f = span > 0 ? (want - tb.cum[lo]) / span : 0;
  const tt = tb.ts[lo] + (tb.ts[hi] - tb.ts[lo]) * f;
  return flowCamera(keys, tt, smooth, false);
}

/** Peak speed and distance of any position-over-time function, sampled at the frame rate. */
export function pathStats(at: (t: number) => Vec3, duration: number, fps: number): { peak: number; travel: number } {
  let peak = 0;
  let d = 0;
  let prev = at(0);
  for (let f = 1; f <= Math.round(duration * fps); f++) {
    const p = at(f / fps);
    const step = Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
    d += step;
    peak = Math.max(peak, step * fps);
    prev = p;
  }
  return { peak, travel: d };
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
export function presetKeys(id: PresetId, start: Pose & { lens: number }, target: Vec3, t0: number, dur: number, steps = 8): CamKey[] {
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
