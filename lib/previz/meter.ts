// The light meter for the Scene Setup prototype. Reads every source at a
// point the way an incident meter does with its dome pointed at the lens,
// checks each one is not blocked (by the set, a person, a flag), and works out
// what each bounce board catches and throws back. Uses the same candela and
// the same cone falloff as the renderer (lib/previz/lighting.ts), so the
// number and the picture cannot disagree about a light.
import * as THREE from "three";
import { coneFalloff, roomBounceLux, spotCone, type SourceResult } from "./lighting";
import { shadowBlurM } from "./patterns";

export type Emitter = {
  id: string;
  label: string;
  /** World position of the glowing source (the frame, when there is one). */
  pos: THREE.Vector3;
  /** Unit vector the source points along. */
  fwd: THREE.Vector3;
  candela: number;
  beamDeg: number;
  omni: boolean;
  /** Apparent size, for the softness readout. */
  sizeM: number;
  flux: number;
  /** The light this belongs to, when one light is several emitters (a
   * diffusion frame: the beam through the cloth and the glow off it). The
   * meter reports them as one line. */
  group?: string;
};

export type Board = {
  id: string;
  label: string;
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  areaM2: number;
  sizeM: number;
  reflectance: number;
};

/**
 * A pattern grip (cookie, branch, blinds, window cutout) as the meter sees
 * it: a square that passes `transmission` of whatever light crosses it.
 */
export type Screen = {
  id: string;
  label: string;
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  half: number;
  transmission: number;
  featureM: number;
};

/** Where a segment crosses a screen's square, or null. */
export function screenHit(from: THREE.Vector3, to: THREE.Vector3, s: Screen): THREE.Vector3 | null {
  const d = to.clone().sub(from);
  const den = d.dot(s.normal);
  if (Math.abs(den) < 1e-9) return null;
  const t = s.pos.clone().sub(from).dot(s.normal) / den;
  if (t <= 0.001 || t >= 0.999) return null;
  const hit = from.clone().addScaledVector(d, t);
  const rel = hit.clone().sub(s.pos);
  if (Math.abs(rel.dot(s.right)) > s.half || Math.abs(rel.dot(s.up)) > s.half) return null;
  return hit;
}

/** Share of light that gets from `from` to `to` through every screen in the way. */
export function throughScreens(from: THREE.Vector3, to: THREE.Vector3, screens: Screen[]): number {
  let f = 1;
  for (const s of screens) if (screenHit(from, to, s)) f *= s.transmission;
  return f;
}

export type PatternRead = {
  /** The light the pattern is breaking up: the brightest one through it. */
  lightId: string;
  lightLabel: string;
  blurM: number;
  featureM: number;
  sourceToPatternM: number;
  patternToSubjectM: number;
};

/**
 * For each screen, the brightest light whose path to the subject crosses it
 * and how soft that light makes the pattern's edges. A screen nothing shines
 * through is absent: it is not doing anything yet.
 */
export function readPatterns(p: THREE.Vector3, emitters: Emitter[], screens: Screen[], occluders: THREE.Object3D[]): Map<string, PatternRead> {
  const out = new Map<string, PatternRead>();
  const best = new Map<string, number>();
  for (const em of emitters) {
    const { lux } = luxFrom(em, p);
    if (lux <= 0 || !clear(p, em.pos, occluders)) continue;
    for (const s of screens) {
      const hit = screenHit(em.pos, p, s);
      if (!hit || lux <= (best.get(s.id) ?? 0)) continue;
      const a = em.pos.distanceTo(hit);
      const b = hit.distanceTo(p);
      best.set(s.id, lux);
      out.set(s.id, { lightId: em.group ?? em.id, lightLabel: em.label, blurM: shadowBlurM(em.sizeM, a, b), featureM: s.featureM, sourceToPatternM: a, patternToSubjectM: b });
    }
  }
  return out;
}

export type Contribution = {
  id: string; label: string; lux: number; sizeM: number; distM: number;
  /** Apparent size in degrees, weighted by how much light each part gives,
   * when a light reaches the subject as more than one source. */
  deg?: number;
};

/** The area term of the near-field correction, for a source `sizeM` across. */
export function nearField(sizeM: number): number {
  return (sizeM * sizeM) / Math.PI;
}

/**
 * The renderer only has point lights, so a big source is dimmed to the level
 * the meter gives at its subject: the picture and the reading agree where it
 * matters, and the light is a little hot further off.
 */
export function nearFieldScale(sizeM: number, distM: number): number {
  const d2 = distM * distM;
  return d2 / (d2 + nearField(sizeM));
}

/**
 * A light as the meter sees it. With a diffusion frame that is TWO sources:
 * the glow off the cloth, at the frame, and the part of the beam that goes
 * straight through, still at the fixture. They share `group` so the reading
 * shows one line for the light.
 */
export function emittersFromSource(
  id: string,
  label: string,
  head: THREE.Vector3,
  fwd: THREE.Vector3,
  src: SourceResult,
): Emitter[] {
  const glow: Emitter = {
    id,
    label,
    pos: head.clone().addScaledVector(fwd, src.offsetM),
    fwd: fwd.clone(),
    candela: src.candela,
    beamDeg: src.beamDeg,
    omni: src.omni,
    sizeM: Math.max(src.sourceW, src.sourceH),
    flux: src.flux,
    group: id,
  };
  if (!src.through) return [glow];
  return [glow, {
    id: `${id}#through`,
    label,
    pos: head.clone(),
    fwd: fwd.clone(),
    candela: src.through.candela,
    beamDeg: src.through.beamDeg,
    omni: false,
    sizeM: src.through.sizeM,
    flux: 0,
    group: id,
  }];
}

/** Meshes that can block light: everything not tagged as fixture drawing. */
export function collectOccluders(scene: THREE.Scene): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    let p: THREE.Object3D | null = o;
    while (p) {
      if (p.userData.noOcclude || !p.visible) return;
      p = p.parent;
    }
    out.push(o);
  });
  return out;
}

const ray = new THREE.Raycaster();

/** True when nothing solid sits between the point and the source. */
function clear(from: THREE.Vector3, to: THREE.Vector3, occluders: THREE.Object3D[], skipM = 0.2): boolean {
  const dir = to.clone().sub(from);
  const d = dir.length();
  if (d < skipM + 0.05) return true;
  dir.divideScalar(d);
  ray.set(from.clone().addScaledVector(dir, skipM), dir);
  ray.far = d - skipM - 0.05;
  return ray.intersectObjects(occluders, false).length === 0;
}

/** Lux an emitter puts on a point, before any meter-dome weighting. */
function luxFrom(e: Emitter, p: THREE.Vector3): { lux: number; dir: THREE.Vector3; d: number } {
  const v = e.pos.clone().sub(p);
  const d = Math.max(0.05, v.length());
  const dir = v.divideScalar(d);
  if (e.candela <= 0) return { lux: 0, dir, d };
  let fall = 1;
  if (!e.omni) {
    const cos = Math.max(-1, Math.min(1, -dir.dot(e.fwd)));
    const cone = spotCone(e.beamDeg);
    fall = coneFalloff(cone.angle, cone.penumbra, Math.acos(cos));
  }
  // Near a big source the inverse square overstates it: a glowing card of
  // area A reads like a disc, E = I / (d² + A/π). Far away the two agree.
  return { lux: (e.candela * fall) / (d * d + nearField(e.sizeM)), dir, d };
}

/**
 * Light each bounce board catches (on its face) and the candela it throws
 * back along its normal as a flat glowing card. Boards facing away catch
 * nothing; a board does not bounce another board.
 */
export function bounceCandela(
  boards: Board[],
  emitters: Emitter[],
  occluders: THREE.Object3D[],
  sun: { dir: THREE.Vector3; lux: number } | null,
  screens: Screen[] = [],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of boards) {
    if (b.reflectance <= 0) continue;
    let e = 0;
    for (const em of emitters) {
      const { lux, dir } = luxFrom(em, b.pos);
      const facing = dir.dot(b.normal);
      if (lux <= 0 || facing <= 0) continue;
      if (!clear(b.pos, em.pos, occluders, 0.08)) continue;
      e += lux * facing * throughScreens(em.pos, b.pos, screens);
    }
    if (sun && sun.lux > 0) {
      const facing = sun.dir.dot(b.normal);
      const far = b.pos.clone().addScaledVector(sun.dir, 30);
      if (facing > 0 && clear(b.pos, far, occluders, 0.08)) e += sun.lux * facing * throughScreens(far, b.pos, screens);
    }
    out.set(b.id, (e * b.reflectance * b.areaM2) / Math.PI);
  }
  return out;
}

export type Reading = {
  lux: number;
  contributions: Contribution[];
  roomLux: number;
};

/**
 * An incident reading at `p` with the dome pointed at the camera. A source
 * straight behind the subject still reads a little (the dome is a half
 * sphere), which is why a strong backlight shows up on a real meter too.
 */
export function readMeter(
  p: THREE.Vector3,
  camera: THREE.Vector3,
  emitters: Emitter[],
  occluders: THREE.Object3D[],
  sun: { dir: THREE.Vector3; lux: number; label: string } | null,
  roomLux: number,
  screens: Screen[] = [],
): Reading {
  const toCam = camera.clone().sub(p).normalize();
  const contributions: Contribution[] = [];
  const byGroup = new Map<string, Contribution & { degLux: number }>();
  for (const em of emitters) {
    const { lux, dir, d } = luxFrom(em, p);
    let got = 0;
    if (lux > 0 && clear(p, em.pos, occluders)) got = lux * ((1 + dir.dot(toCam)) / 2) * throughScreens(em.pos, p, screens);
    const deg = em.sizeM > 0 ? (2 * Math.atan(em.sizeM / 2 / Math.max(0.05, d)) * 180) / Math.PI : 0;
    const key = em.group ?? em.id;
    const prev = byGroup.get(key);
    if (!prev) {
      byGroup.set(key, { id: key, label: em.label, lux: got, sizeM: em.sizeM, distM: d, degLux: deg * got, deg });
      continue;
    }
    // The line reports the part giving most of the light for size and distance.
    if (got > prev.lux) { prev.sizeM = em.sizeM; prev.distM = d; }
    prev.lux += got;
    prev.degLux += deg * got;
    prev.deg = prev.lux > 0 ? prev.degLux / prev.lux : Math.max(prev.deg ?? 0, deg);
  }
  for (const { degLux: _drop, ...c } of byGroup.values()) contributions.push(c);
  if (sun && sun.lux > 0) {
    const far = p.clone().addScaledVector(sun.dir, 30);
    const ok = clear(p, far, occluders);
    const dome = (1 + sun.dir.dot(toCam)) / 2;
    contributions.push({ id: "sun", label: sun.label, lux: ok ? sun.lux * dome * throughScreens(far, p, screens) : 0, sizeM: 0, distM: Infinity });
  }
  if (roomLux > 0) contributions.push({ id: "room", label: "Room bounce", lux: roomLux, sizeM: 0, distM: 0 });
  contributions.sort((a, b) => b.lux - a.lux);
  return { lux: contributions.reduce((s, c) => s + c.lux, 0), contributions, roomLux };
}

export function roomLuxFrom(totalFlux: number): number {
  return roomBounceLux(totalFlux);
}
