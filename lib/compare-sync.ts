/**
 * Version compare: the rules that keep two versions of a cut on the same
 * moment. Pure and not `server-only`, so the player and the scratchpad tests
 * read one module.
 *
 * A TIMELINE, NOT A MASTER VIDEO. Each side is a "lane" with a duration and a
 * HEAD OFFSET: how many seconds of that version are skipped so its action
 * lines up with the other's (v2 gained a one-second slate, so v2 skips one
 * second). Offsets are never negative, which keeps the timeline starting at
 * zero for both: "B starts later" is written as "A skips", not as B going
 * below zero. The lane with the most left to play drives the clock, so the
 * longer version is never cut off by the shorter one ending.
 */

export type Lane = { duration: number; offset: number };

/** Head offsets for A and B from one signed figure: positive skips B's head. */
export function laneOffsets(offset: number): [number, number] {
  const o = Number.isFinite(offset) ? offset : 0;
  return [Math.max(0, -o), Math.max(0, o)];
}

function playable(l: Lane): number {
  const d = Number.isFinite(l.duration) ? l.duration : 0;
  return Math.max(0, d - Math.max(0, l.offset));
}

/** How long the shared timeline runs: the longer of the two after offsets. */
export function timelineLength(lanes: Lane[]): number {
  return lanes.reduce((n, l) => Math.max(n, playable(l)), 0);
}

/** Which lane drives the clock. Ties go to A, so the default never flips. */
export function masterIndex(lanes: Lane[]): number {
  let best = 0;
  lanes.forEach((l, i) => {
    if (playable(l) > playable(lanes[best])) best = i;
  });
  return best;
}

export type LaneTarget = { time: number; ended: boolean };

/**
 * Where a lane's video should be at timeline time t. A lane that has run out
 * holds its last frame (ended) rather than looping or going black, which is
 * what an editor expects when one cut is shorter.
 */
export function laneTarget(t: number, lane: Lane): LaneTarget {
  const off = Math.max(0, lane.offset);
  const time = Math.max(0, (Number.isFinite(t) ? t : 0) + off);
  const d = Number.isFinite(lane.duration) ? lane.duration : 0;
  if (d > 0 && time >= d - 0.02) return { time: d, ended: true };
  return { time, ended: false };
}

/** Timeline time from a lane's own clock. */
export function timelineFrom(laneTime: number, lane: Lane): number {
  return Math.max(0, laneTime - Math.max(0, lane.offset));
}

/**
 * Whether a follower has drifted far enough to be corrected. Playing, a small
 * tolerance avoids a seek every frame (each one stutters); paused, the two
 * must show the same frame.
 */
export function shouldResync(current: number, target: number, playing: boolean): boolean {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return true;
  return Math.abs(current - target) > (playing ? 0.12 : 0.02);
}

export type PairVersion = { id: string; version_number: number };

/**
 * The pair a compare opens on: the version being looked at against the one
 * IMMEDIATELY BEFORE it, which is the revision question ("what changed in
 * v3"), not the oldest. Looking at v1 compares it with v2.
 */
export function defaultPair(
  versions: PairVersion[],
  currentId: string | null
): { a: string | null; b: string | null } {
  const sorted = [...versions].sort((x, y) => x.version_number - y.version_number);
  if (!sorted.length) return { a: null, b: null };
  let i = sorted.findIndex((v) => v.id === currentId);
  if (i < 0) i = sorted.length - 1;
  if (sorted.length < 2) return { a: sorted[i].id, b: sorted[i].id };
  if (i === 0) return { a: sorted[0].id, b: sorted[1].id };
  return { a: sorted[i - 1].id, b: sorted[i].id };
}

/** "Lined up", "v3 skips 12 frames", for the offset control. */
export function offsetLabel(offset: number, fps: number, aName: string, bName: string): string {
  const frames = Math.round((Number.isFinite(offset) ? offset : 0) * fps);
  if (!frames) return "Lined up";
  const n = Math.abs(frames);
  const unit = n === 1 ? "frame" : "frames";
  const secs = n >= fps ? ` (${(n / fps).toFixed(2).replace(/\.?0+$/, "")}s)` : "";
  return `${frames > 0 ? bName : aName} skips ${n} ${unit}${secs}`;
}

/** Wipe position as a percentage, kept off the very edges so the handle stays grabbable. */
export function clampWipe(pct: number): number {
  if (!Number.isFinite(pct)) return 50;
  return Math.min(98, Math.max(2, pct));
}

/** Ceiling on the head offset: a minute is a different edit, not a slip. */
export const MAX_OFFSET_SECONDS = 60;

export function clampOffset(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(-MAX_OFFSET_SECONDS, Math.min(MAX_OFFSET_SECONDS, seconds));
}
