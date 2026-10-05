// Talent moving on the move timeline: a person starts where they stand and
// walks to their MARK as the shot plays, the way a performer hits a mark on a
// take. Pure (no three.js, no React), so it can be tested on its own.
//
// Facing: 0 faces +Z (the camera side), the same convention as everywhere
// else. While walking a person faces the way they are going; they turn to
// their start facing as they set off and to the mark's facing as they land.

export type Mark = { x: number; z: number; facing: number };
export type Walker = { x: number; z: number; facing: number; mark?: Mark | null };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}
const smooth = (t: number) => t * t * (3 - 2 * t);

/** How far it is from where they stand to their mark, metres. */
export function walkDistance(w: Walker): number {
  return w.mark ? Math.hypot(w.mark.x - w.x, w.mark.z - w.z) : 0;
}

/**
 * Where somebody is at `k` (0 to 1, already eased) through the action, which
 * way they face, whether they are mid-stride, and how far they have walked
 * (the walk cycle alternates the stride on that distance).
 */
export function walkerAt<T extends Walker>(w: T, k: number): T & { walking: boolean; walked: number } {
  if (!w.mark || walkDistance(w) < 0.05) return { ...w, walking: false, walked: 0 };
  const t = Math.max(0, Math.min(1, k));
  const m = w.mark;
  const x = lerp(w.x, m.x, t);
  const z = lerp(w.z, m.z, t);
  const heading = (Math.atan2(m.x - w.x, m.z - w.z) * 180) / Math.PI;
  // Turn into the walk over the first tenth, out of it over the last.
  let facing: number;
  if (t <= 0) facing = w.facing;
  else if (t >= 1) facing = m.facing;
  else if (t < 0.1) facing = lerpAngle(w.facing, heading, smooth(t / 0.1));
  else if (t > 0.9) facing = lerpAngle(heading, m.facing, smooth((t - 0.9) / 0.1));
  else facing = heading;
  return { ...w, x, z, facing, walking: t > 0 && t < 1, walked: walkDistance(w) * t };
}

/** A natural walk is about 1.4 metres a second; slower reads as strolling. */
export function walkSpeed(w: Walker, durationS: number): number {
  return walkDistance(w) / Math.max(0.1, durationS);
}

/** Which leg leads, from the distance walked: a stride is about 0.7 metres. */
export function strideSide(walked: number): 0 | 1 {
  return Math.floor(walked / 0.7) % 2 === 0 ? 0 : 1;
}
