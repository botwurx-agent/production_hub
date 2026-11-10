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
};

export type Msg =
  | { k: "pose"; p: Pose }
  | { k: "ping"; id: number; t0: number }
  | { k: "pong"; id: number; t0: number; tp: number }
  | { k: "hello"; from: "phone" | "desk" }
  | { k: "signal"; to: "phone" | "desk"; sdp?: unknown; ice?: unknown };

/** High-resolution epoch milliseconds, comparable across devices up to their clock offset. */
export function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.timeOrigin === "number") {
    return performance.timeOrigin + performance.now();
  }
  return Date.now();
}

export function roomId(): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
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
