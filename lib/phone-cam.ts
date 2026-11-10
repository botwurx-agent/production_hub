// Pure half of the phone-as-camera latency test (/dev/phone-cam). No DOM, no
// three.js, so it can be checked in the scratchpad.
//
// The number that decides the feature is ONE-WAY POSE DELAY: how long after
// the phone moves the desktop knows about it. A round trip halved assumes the
// two directions take equally long, which a relay need not; so the desktop
// also estimates the phone's clock offset from its pings (NTP style, keeping
// the sample with the shortest round trip, which is the one least distorted by
// queueing) and ages every pose against it.

export type Pose = {
  /** Device orientation, degrees, as the phone reported it. */
  a: number;
  b: number;
  g: number;
  /** Screen orientation angle, degrees. */
  o: number;
  /** Phone clock when the sample was taken, epoch ms with fractions. */
  t: number;
  /** Sequence number, to count drops. */
  n: number;
  /**
   * The thumb controls, each -1..1 already scaled by the phone's speed choice:
   * truck (right +), boom (up +), push (in +), zoom (in +). Absent: nothing held.
   */
  m?: [number, number, number, number];
};

/** What the phone asks the desk to do. */
export type PhoneCmd = "record" | "stop" | "recentre" | "drive";

/** What the desk tells the phone, so the phone can show it. */
export type DeskState = {
  /** drive: the phone moves the camera; view: the recorded move plays; count: a take is about to start; rec: recording. */
  mode: "drive" | "view" | "count" | "rec";
  /** Seconds: the countdown left, or the take's running time. */
  sec?: number;
  /** A line to show, e.g. what the last take kept. */
  line?: string;
};

export type Msg =
  | { k: "pose"; p: Pose }
  | { k: "ping"; id: number; t0: number }
  | { k: "pong"; id: number; t0: number; tp: number }
  | { k: "hello"; from: "phone" | "desk" }
  | { k: "signal"; to: "phone" | "desk"; sdp?: unknown; ice?: unknown }
  | { k: "cmd"; c: PhoneCmd }
  | { k: "state"; s: DeskState };

/** High-resolution epoch milliseconds, comparable across devices up to their clock offset. */
export function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.timeOrigin === "number") {
    return performance.timeOrigin + performance.now();
  }
  return Date.now();
}

export function roomId(n = 8): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (x) => abc[x % abc.length]).join("");
}

/** A room id from a URL is only ever our own alphabet, 6 to 16 long. */
export function cleanRoom(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  return /^[a-z0-9]{6,16}$/.test(s) ? s : null;
}

/** The value at fraction q (0..1) of a list, by nearest rank. Empty gives null. */
export function quantile(xs: number[], q: number): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((p, r) => p - r);
  if (!v.length) return null;
  const i = Math.min(v.length - 1, Math.max(0, Math.ceil(q * v.length) - 1));
  return v[i];
}

/**
 * Clock offset of the phone relative to the desk (phone minus desk), from ping
 * samples. Uses the sample with the shortest round trip.
 */
export function clockOffset(samples: { t0: number; tp: number; t3: number }[]): { offset: number; rtt: number } | null {
  let best: { offset: number; rtt: number } | null = null;
  for (const s of samples) {
    const rtt = s.t3 - s.t0;
    if (!Number.isFinite(rtt) || rtt < 0) continue;
    const offset = s.tp - (s.t0 + s.t3) / 2;
    if (!best || rtt < best.rtt) best = { offset, rtt };
  }
  return best;
}

/** Sequence gaps: how many poses never arrived, given the numbers that did. */
export function dropped(seqs: number[]): number {
  if (seqs.length < 2) return 0;
  const v = [...new Set(seqs)].sort((a, b) => a - b);
  return Math.max(0, v[v.length - 1] - v[0] + 1 - v.length);
}

export type Verdict = { word: string; hue: "green" | "amber" | "red" };

/** How the delay will read on camera. Judged on the 95th percentile, since one stutter in five shows. */
export function verdict(p95: number | null): Verdict | null {
  if (p95 === null) return null;
  if (p95 <= 100) return { word: "Feels live", hue: "green" };
  if (p95 <= 160) return { word: "Noticeable lag", hue: "amber" };
  return { word: "Too slow for a live demo", hue: "red" };
}

// ---------------------------------------------------------------- the camera

/** Degrees: yaw, pitch, roll, in the blocking camera's convention. */
export type Angles = [number, number, number];

/** b moved by whole turns so it sits within 180 degrees of a. */
export function nearAngle(a: number, b: number): number {
  return a + ((((b - a) % 360) + 540) % 360) - 180;
}

/**
 * The phone's recent orientations, played back a little behind real time so a
 * missed update glides instead of jumping (a phone skips the odd beat: about
 * 95 ms gaps were measured at 30 updates a second). Times are desk ms.
 */
export class PoseTrack {
  private s: { t: number; a: Angles }[] = [];
  constructor(private keepMs = 1000) {}

  push(t: number, a: Angles) {
    const last = this.s[this.s.length - 1];
    if (last && t <= last.t) return;
    // Yaw kept continuous with the previous sample, so 359 -> 1 is 2 degrees.
    const y = last ? nearAngle(last.a[0], a[0]) : a[0];
    const r = last ? nearAngle(last.a[2], a[2]) : a[2];
    this.s.push({ t, a: [y, a[1], r] });
    while (this.s.length > 2 && this.s[0].t < t - this.keepMs) this.s.shift();
  }

  clear() {
    this.s = [];
  }

  get size() {
    return this.s.length;
  }

  latest(): Angles | null {
    return this.s.length ? this.s[this.s.length - 1].a : null;
  }

  /** The orientation at time t (straight between samples, held at either end). */
  at(t: number): Angles | null {
    const s = this.s;
    if (!s.length) return null;
    if (t <= s[0].t) return s[0].a;
    const last = s[s.length - 1];
    if (t >= last.t) return last.a;
    let i = s.length - 1;
    while (i > 0 && s[i - 1].t > t) i--;
    const p = s[i - 1];
    const q = s[i];
    const u = (t - p.t) / (q.t - p.t);
    return [0, 1, 2].map((k) => p.a[k] + (q.a[k] - p.a[k]) * u) as Angles;
  }
}

export type TakeSample = { t: number; p: [number, number, number]; r: Angles; lens: number };

/** Tolerances for keeping a recorded sample as a key. */
const TOL = { m: 0.015, deg: 0.6, lens: 0.015 };

function offBy(a: TakeSample, b: TakeSample, c: TakeSample): number {
  // How far b sits from the straight line between a and c, as a share of the tolerance.
  const u = c.t === a.t ? 0 : (b.t - a.t) / (c.t - a.t);
  let worst = 0;
  for (let k = 0; k < 3; k++) {
    worst = Math.max(worst, Math.abs(a.p[k] + (c.p[k] - a.p[k]) * u - b.p[k]) / TOL.m);
    worst = Math.max(worst, Math.abs(a.r[k] + (c.r[k] - a.r[k]) * u - b.r[k]) / TOL.deg);
  }
  const lens = Math.exp(Math.log(a.lens) + (Math.log(c.lens) - Math.log(a.lens)) * u);
  return Math.max(worst, Math.abs(Math.log(lens / b.lens)) / TOL.lens);
}

/**
 * A recorded take thinned to the samples that matter (Ramer-Douglas-Peucker
 * over position, angles and lens), so the timeline gets a handful of keys a
 * second where the move changes and none where it holds. Yaw and roll are
 * made continuous first. The first and last samples are always kept, and no
 * two kept samples are more than maxGap seconds apart, so a long hold still
 * has keys to grab.
 */
export function thinTake(raw: TakeSample[], maxGap = 1): TakeSample[] {
  if (raw.length <= 2) return raw.slice();
  const s: TakeSample[] = [];
  for (const x of raw) {
    const prev = s[s.length - 1];
    if (prev && x.t <= prev.t) continue;
    s.push(prev ? { ...x, r: [nearAngle(prev.r[0], x.r[0]), x.r[1], nearAngle(prev.r[2], x.r[2])] } : x);
  }
  if (s.length <= 2) return s;
  const keep = new Array(s.length).fill(false);
  keep[0] = keep[s.length - 1] = true;
  const stack: [number, number][] = [[0, s.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    if (j - i < 2) continue;
    let worst = 0;
    let at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = offBy(s[i], s[k], s[j]);
      if (d > worst) { worst = d; at = k; }
    }
    if (worst > 1 || s[j].t - s[i].t > maxGap) {
      const k = worst > 1 ? at : (i + j) >> 1;
      keep[k] = true;
      stack.push([i, k], [k, j]);
    }
  }
  return s.filter((_, i) => keep[i]);
}
