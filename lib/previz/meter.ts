// The light meter for the Scene Setup prototype. Reads every source at a
// point the way an incident meter does with its dome pointed at the lens,
// checks each one is not blocked (by the set, a person, a flag), and works out
// what each bounce board catches and throws back. Uses the same candela and
// the same cone falloff as the renderer (lib/previz/lighting.ts), so the
// number and the picture cannot disagree about a light.
import * as THREE from "three";
import { coneFalloff, roomBounceLux, spotCone, type SourceResult } from "./lighting";

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

export type Contribution = { id: string; label: string; lux: number; sizeM: number; distM: number };

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

export function emitterFromSource(
  id: string,
  label: string,
  head: THREE.Vector3,
  fwd: THREE.Vector3,
  src: SourceResult,
): Emitter {
  return {
    id,
    label,
    pos: head.clone().addScaledVector(fwd, src.offsetM),
    fwd: fwd.clone(),
    candela: src.candela,
    beamDeg: src.beamDeg,
    omni: src.omni,
    sizeM: Math.max(src.sourceW, src.sourceH),
    flux: src.flux,
  };
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
      e += lux * facing;
    }
    if (sun && sun.lux > 0) {
      const facing = sun.dir.dot(b.normal);
      if (facing > 0 && clear(b.pos, b.pos.clone().addScaledVector(sun.dir, 30), occluders, 0.08)) e += sun.lux * facing;
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
): Reading {
  const toCam = camera.clone().sub(p).normalize();
  const contributions: Contribution[] = [];
  for (const em of emitters) {
    const { lux, dir, d } = luxFrom(em, p);
    if (lux <= 0) {
      contributions.push({ id: em.id, label: em.label, lux: 0, sizeM: em.sizeM, distM: d });
      continue;
    }
    const blocked = !clear(p, em.pos, occluders);
    const dome = (1 + dir.dot(toCam)) / 2;
    contributions.push({ id: em.id, label: em.label, lux: blocked ? 0 : lux * dome, sizeM: em.sizeM, distM: d });
  }
  if (sun && sun.lux > 0) {
    const ok = clear(p, p.clone().addScaledVector(sun.dir, 30), occluders);
    const dome = (1 + sun.dir.dot(toCam)) / 2;
    contributions.push({ id: "sun", label: sun.label, lux: ok ? sun.lux * dome : 0, sizeM: 0, distM: Infinity });
  }
  if (roomLux > 0) contributions.push({ id: "room", label: "Room bounce", lux: roomLux, sizeM: 0, distM: 0 });
  contributions.sort((a, b) => b.lux - a.lux);
  return { lux: contributions.reduce((s, c) => s + c.lux, 0), contributions, roomLux };
}

export function roomLuxFrom(totalFlux: number): number {
  return roomBounceLux(totalFlux);
}
