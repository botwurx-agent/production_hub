// Camera moves for the Scene Setup prototype. A shot's own camera values are
// its START frame; a move adds an END frame, a duration and an ease, and the
// lens travels between them. What the camera is ON decides what can change:
// sticks only pan, tilt and zoom; a Dana Dolly slides across the shot; a
// Fisher pushes along its track and booms; a motion control arm goes anywhere.
// Pure (no three.js, no React) so it can be tested on its own.

export type Vec3 = { x: number; y: number; z: number };
export type Ease = "smooth" | "linear" | "in" | "out";

/** Everything about the camera that can change during a move. */
export type CamKey = {
  pos: Vec3;
  yaw: number; // degrees, 0 looks toward -Z, positive turns left
  pitch: number;
  focal: number;
  focusM: number;
  focusOn: string | null;
};

export type Move = {
  end: CamKey;
  durationS: number;
  ease: Ease;
  /**
   * The heading the track (or the dolly) is laid on, fixed when the move is
   * made. Panning the start frame afterwards turns the head, not the track.
   */
  trackYaw?: number;
};

/** The start frame turned to the track's heading: the frame a dolly travels in. */
export function trackFrame(start: CamKey, move: Move | null): CamKey {
  return { ...start, yaw: move?.trackYaw ?? start.yaw };
}

export const EASES: { id: Ease; name: string }[] = [
  { id: "smooth", name: "Ease in and out" },
  { id: "linear", name: "Constant speed" },
  { id: "in", name: "Ease in" },
  { id: "out", name: "Ease out" },
];

export function ease(kind: Ease, t: number): number {
  const x = Math.max(0, Math.min(1, t));
  if (kind === "linear") return x;
  if (kind === "in") return x * x * x;
  if (kind === "out") return 1 - Math.pow(1 - x, 3);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** The short way round between two headings. */
function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

/**
 * The camera at a moment through the move, `t` 0 to 1 in TIME (the ease is
 * applied here). Zoom interpolates in log space, so a 24 to 100mm zoom feels
 * even rather than racing through the wide end.
 */
export function camAt(start: CamKey, move: Move | null, t: number): CamKey & { mix: number } {
  if (!move) return { ...start, mix: 0 };
  const k = ease(move.ease, t);
  const e = move.end;
  return {
    pos: { x: lerp(start.pos.x, e.pos.x, k), y: lerp(start.pos.y, e.pos.y, k), z: lerp(start.pos.z, e.pos.z, k) },
    yaw: lerpAngle(start.yaw, e.yaw, k),
    pitch: lerp(start.pitch, e.pitch, k),
    focal: Math.exp(lerp(Math.log(start.focal), Math.log(e.focal), k)),
    focusM: lerp(start.focusM, e.focusM, k),
    focusOn: k < 0.5 ? start.focusOn : e.focusOn,
    mix: k,
  };
}

/** The axis a support lets the camera travel along, in its own frame. */
export type SupportKindLite = "sticks" | "dana" | "fisher" | "robot";

/** Where (start-relative) a point sits along and across the start heading. */
export function toLocal(start: CamKey, p: Vec3): { lx: number; ly: number; lz: number } {
  const r = (start.yaw * Math.PI) / 180;
  const dx = p.x - start.pos.x;
  const dz = p.z - start.pos.z;
  // Inverse of the map's loc(): local x is camera right, local z is toward the back (+Z).
  return { lx: dx * Math.cos(r) - dz * Math.sin(r), ly: p.y - start.pos.y, lz: dx * Math.sin(r) + dz * Math.cos(r) };
}
export function fromLocal(start: CamKey, lx: number, ly: number, lz: number): Vec3 {
  const r = (start.yaw * Math.PI) / 180;
  return {
    x: start.pos.x + lx * Math.cos(r) + lz * Math.sin(r),
    y: start.pos.y + ly,
    z: start.pos.z - lx * Math.sin(r) + lz * Math.cos(r),
  };
}

/**
 * Keeps an end frame to what the support can physically do, relative to the
 * start. Sticks cannot travel at all; a Dana Dolly only slides sideways at a
 * fixed height; a Fisher pushes along its track and booms; an arm is free.
 */
export function constrainEnd(kind: SupportKindLite, start: CamKey, end: CamKey, trackYaw?: number): CamKey {
  if (kind === "robot") return end;
  const f = { ...start, yaw: trackYaw ?? start.yaw };
  const { lx, ly, lz } = toLocal(f, end.pos);
  if (kind === "sticks") return { ...end, pos: { ...start.pos } };
  if (kind === "dana") return { ...end, pos: fromLocal(f, lx, 0, 0) };
  return { ...end, pos: fromLocal(f, 0, ly, lz) }; // fisher
}

export type MoveStats = {
  /** Distance the lens travels, metres. */
  travelM: number;
  /** Pan and tilt over the move, degrees. */
  panDeg: number;
  tiltDeg: number;
  /** Average speed, metres per second. */
  speed: number;
  /** Peak speed, roughly, for the ease used. */
  peak: number;
  /** "Push in", "Pull out", "Slide left" and so on, in production language. */
  name: string;
  /** Track needed for a dolly, metres, or null. */
  trackM: number | null;
};

/** Peak speed over average speed, for each ease. */
const PEAK: Record<Ease, number> = { linear: 1, smooth: 1.5, in: 3, out: 3 };

export function moveStats(kind: SupportKindLite, start: CamKey, move: Move): MoveStats {
  const e = move.end;
  const { lx, ly, lz } = toLocal(trackFrame(start, move), e.pos);
  const travelM = Math.hypot(lx, ly, lz);
  const panDeg = Math.abs(((((e.yaw - start.yaw) % 360) + 540) % 360) - 180);
  const tiltDeg = Math.abs(e.pitch - start.pitch);
  const speed = travelM / Math.max(0.1, move.durationS);
  const parts: string[] = [];
  if (Math.abs(lz) > 0.05) parts.push(lz < 0 ? "Push in" : "Pull out");
  if (Math.abs(lx) > 0.05) parts.push(lx > 0 ? "Slide right" : "Slide left");
  if (Math.abs(ly) > 0.05) parts.push(ly > 0 ? "Boom up" : "Boom down");
  if (panDeg > 1) parts.push("pan");
  if (tiltDeg > 1) parts.push("tilt");
  const zoom = e.focal / start.focal;
  if (zoom > 1.03) parts.push("zoom in");
  else if (zoom < 0.97) parts.push("zoom out");
  if (e.focusOn !== start.focusOn) parts.push("rack focus");
  const name = parts.length ? parts.join(", ").replace(/^./, (c) => c.toUpperCase()) : "Locked off";
  // A dolly's track runs past the start and the end, plus the dolly itself.
  const trackM = kind === "dana" ? Math.max(2.44, Math.abs(lx) + 1.2) : kind === "fisher" ? Math.max(3.66, Math.abs(lz) + 3.5) : null;
  return { travelM, panDeg, tiltDeg, speed, peak: speed * PEAK[move.ease], name, trackM };
}

/** Track sections come in 4 ft lengths; how many a dolly move needs. */
export function trackSections(trackM: number): number {
  return Math.ceil(trackM / (4 * 0.3048));
}

/** The track's extent along its axis, start-relative, metres (negative is toward the subject). */
export function trackExtent(kind: SupportKindLite, start: CamKey, move: Move | null): { from: number; to: number } | null {
  const { lx, lz } = move ? toLocal(trackFrame(start, move), move.end.pos) : { lx: 0, lz: 0 };
  if (kind === "dana") {
    const lo = Math.min(0, lx) - 0.6;
    const hi = Math.max(0, lx) + 0.6;
    const pad = Math.max(0, (2.44 - (hi - lo)) / 2);
    return { from: lo - pad, to: hi + pad };
  }
  if (kind === "fisher") {
    const lo = Math.min(0, lz) - 1.2;
    const hi = Math.max(0, lz) + 2.3;
    return { from: lo, to: hi };
  }
  return null;
}
