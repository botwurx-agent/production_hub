// Shot blocking: drawing the scene in three.js. Every object is built in its
// own frame (origin on the ground at its centre, facing +Z) out of a handful of
// low-poly parts, the way a blockout is made: volumes and silhouettes, nothing
// a generation model would copy as detail.
//
// One material per object per look. "Blockout" is flat colour with flat
// shading, each subject its own colour, which is what lets a video model tell
// the subjects apart in a reference clip.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hipY as poseHipY, poseDef, shoulderY as poseShoulderY, SHIN } from "@/lib/previz/poses";
import { gestureOf, type BlockObject, type Environment, type GestureKind, type Look, type Vec3 } from "./scene";
import { evalTrack } from "./keys";
import { footPhase, type Gait } from "./gait";

const rad = (d: number) => (d * Math.PI) / 180;

/** Lighter or darker shade of a colour, for the parts of one object. */
function shade(hex: string, k: number): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(0.95, Math.max(0.04, hsl.l * k)));
  return c;
}

export type Paint = (k?: number) => THREE.Material;

export function painter(look: Look, color: string): Paint {
  const cache = new Map<number, THREE.Material>();
  return (k = 1) => {
    let m = cache.get(k);
    if (m) return m;
    // Clay is a warm off-white, the look of a 3D blockout under an overcast
    // sky; the shades of one object (k) still tell its parts apart.
    if (look === "clay") m = new THREE.MeshStandardMaterial({ color: shade("#e4e0d8", Math.min(k, 1.12)), roughness: 1, metalness: 0 });
    else if (look === "lit") m = new THREE.MeshStandardMaterial({ color: shade(color, k), roughness: 0.75 });
    // Blockout keeps one flat colour per subject, smooth shaded so a rounded
    // tree or a head is not drawn in facets.
    else m = new THREE.MeshLambertMaterial({ color: shade(color, k) });
    cache.set(k, m);
    return m;
  };
}

function part(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) =>
  part(new THREE.BoxGeometry(w, h, d), m, x, y, z);

/**
 * Many small boxes in one material, merged into a single mesh: a facade's
 * hundreds of windows and sills cost one draw call rather than hundreds.
 */
class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  box(m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(x, y, z);
    const list = this.parts.get(m) ?? [];
    list.push(geo);
    this.parts.set(m, list);
  }
  addTo(g: THREE.Group) {
    for (const [m, list] of this.parts) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      for (const geo of list) geo.dispose();
      if (merged) g.add(part(merged, m));
    }
  }
}

/** A box with softened edges: car bodies, roofs, anything that should not read as a crate. */
const rbox = (w: number, h: number, d: number, r: number, m: THREE.Material, x = 0, y = 0, z = 0) =>
  part(new RoundedBoxGeometry(w, h, d, 3, Math.max(0.005, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))), m, x, y, z);

/** Tinted glass, the same in every look: dark enough to read as a window, clear enough to see who is inside. */
const GLASS = new THREE.MeshStandardMaterial({ color: "#2b333b", roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.42, depthWrite: false });

const SEAT_PITCH = 0.95;

/** A car-like body: lower hull, open cabin (pillars and a roof), seats, wheels. */
function vehicle(o: BlockObject, paint: Paint, opts: { cab: number; cabStart: number; rows: number; cargo?: boolean; bed?: boolean; tall?: boolean }) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const wheelR = Math.min(0.4, H * 0.24);
  const hullH = H * (opts.tall ? 0.62 : 0.46);
  const hullY = wheelR * 0.75;
  const bodyH = hullH - hullY + wheelR * 0.5;
  // A rounded body, slightly narrower than the wheels so they sit out at the
  // corners, the way a car is drawn rather than a crate on wheels.
  g.add(rbox(W * 0.98, bodyH, D, Math.min(0.12, bodyH * 0.22), paint(1), 0, hullY + bodyH / 2 - wheelR * 0.25, 0));
  // Bumpers front and back, and a darker sill along each side.
  for (const sz of [-1, 1]) g.add(rbox(W * 0.96, 0.2, 0.16, 0.06, paint(0.55), 0, hullY + 0.05, sz * (D / 2 + 0.02)));
  for (const sx of [-1, 1]) g.add(box(0.04, 0.12, D * 0.7, paint(0.6), sx * W * 0.49, hullY + 0.02, 0));
  // Cabin: four pillars and a roof, open sides, so a camera can pass through
  // a window the way the reference shots do.
  const cabD = D * opts.cab;
  const cabZ = D / 2 - D * opts.cabStart - cabD / 2;
  const cabH = H - hullH;
  const pillar = 0.08;
  // The windscreen rakes forward from the roof to the bonnet, and the front
  // pillars lean with it; the rear pillars stand up. Sides stay open.
  const rake = opts.tall ? 0.18 : Math.min(0.6, cabH * 0.75);
  const lean = Math.atan2(rake, cabH);
  const len = Math.hypot(rake, cabH);
  const frontZ = cabZ + cabD / 2;
  for (const sx of [-1, 1]) {
    const fp = box(pillar, len, pillar, paint(0.82), sx * (W / 2 - pillar / 2 - 0.02), hullH + cabH / 2, frontZ + rake / 2);
    fp.rotation.x = -lean;
    g.add(fp);
    g.add(box(pillar * 1.4, cabH, pillar * 1.4, paint(0.82), sx * (W / 2 - pillar / 2 - 0.02), hullH + cabH / 2, cabZ - cabD / 2 + pillar));
  }
  const screen = box(W * 0.9, len, 0.02, GLASS, 0, hullH + cabH / 2, frontZ + rake / 2);
  screen.rotation.x = -lean;
  screen.castShadow = false;
  g.add(screen);
  const back = box(W * 0.9, cabH * 0.9, 0.02, GLASS, 0, hullH + cabH * 0.45, cabZ - cabD / 2 + pillar);
  back.castShadow = false;
  g.add(back);
  g.add(rbox(W * 0.94, 0.09, cabD, 0.04, paint(1), 0, H - 0.045, cabZ));
  // Side mirrors at the foot of the windscreen.
  for (const sx of [-1, 1]) g.add(rbox(0.14, 0.1, 0.18, 0.03, paint(0.85), sx * (W / 2 + 0.05), hullH + 0.12, frontZ + rake - 0.05));
  // Seats in real rows, spaced as a car is (about 0.95 m seat to seat), so a
  // sedan has two, an SUV two plus a cargo area (or three), a panel van one.
  // The count is the vehicle's, never derived from cabin length: that gave an
  // SUV four rows and a van five, which read as a tram.
  const front = cabZ + cabD / 2 - 0.55;
  const seatTop = hullH + 0.12;
  for (let r = 0; r < opts.rows; r++) {
    const z = front - r * SEAT_PITCH;
    if (r === 0) {
      for (const sx of [-1, 1]) {
        g.add(box(W * 0.34, 0.14, 0.5, paint(0.6), sx * W * 0.22, hullH + 0.05, z));
        g.add(box(W * 0.34, 0.6, 0.12, paint(0.6), sx * W * 0.22, hullH + 0.35, z - 0.26));
      }
    } else {
      // A rear row is a bench across the car.
      g.add(box(W * 0.8, 0.14, 0.5, paint(0.6), 0, hullH + 0.05, z));
      g.add(box(W * 0.8, 0.58, 0.12, paint(0.6), 0, hullH + 0.34, z - 0.26));
    }
  }
  // Behind the last row: a cargo floor (SUV, van) up to the tailgate.
  const lastBack = front - (opts.rows - 1) * SEAT_PITCH - 0.32;
  const cabBack = cabZ - cabD / 2;
  if (opts.cargo && lastBack - cabBack > 0.3) {
    const len = lastBack - cabBack - 0.05;
    g.add(box(W * 0.86, 0.04, len, paint(0.7), 0, seatTop - 0.1, cabBack + 0.05 + len / 2));
  }
  // Dash and wheel.
  g.add(box(W * 0.9, 0.22, 0.3, paint(0.5), 0, hullH + 0.1, cabZ + cabD / 2 - 0.1));
  if (opts.bed) g.add(box(W * 0.9, 0.05, D * 0.32, paint(0.7), 0, hullH + 0.02, -D / 2 + D * 0.17));
  // A tyre with a lighter hub face, so a wheel reads as turning, not a disc.
  const wg = new THREE.CylinderGeometry(wheelR, wheelR, 0.26, 20);
  wg.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, 0.27, 16);
  hub.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(part(wg, paint(0.25), sx * (W / 2 - 0.12), wheelR, sz * (D / 2 - wheelR * 1.6)));
    g.add(part(hub, paint(0.7), sx * (W / 2 - 0.115), wheelR, sz * (D / 2 - wheelR * 1.6)));
  }
  // Head and tail lights read the direction of travel from any angle.
  for (const sx of [-1, 1]) {
    g.add(box(W * 0.2, 0.08, 0.04, paint(1.5), sx * W * 0.32, hullH - 0.12, D / 2));
    g.add(box(W * 0.2, 0.08, 0.04, paint(0.45), sx * W * 0.32, hullH - 0.12, -D / 2));
  }
  return g;
}

/**
 * The side of a bus or tram between its sill and roof: glass along the whole
 * length, with a pillar every `bay` metres, so the people inside show through
 * and a camera can still look in. Drawn into a batch, one draw call.
 */
function windowBand(b: Batch, g: THREE.Group, pillar: THREE.Material, W: number, z0: number, len: number, sill: number, roof: number, bay: number) {
  const h = roof - sill;
  for (const sx of [-1, 1]) {
    const pane = box(0.02, h, len, GLASS, sx * (W / 2 - 0.02), sill + h / 2, z0);
    pane.castShadow = false;
    g.add(pane);
    const n = Math.max(1, Math.round(len / bay));
    for (let i = 0; i <= n; i++) b.box(pillar, 0.06, h, 0.1, sx * (W / 2 - 0.02), sill + h / 2, z0 - len / 2 + (i / n) * len);
  }
}

/** Pairs of seats down both sides, leaving gaps where the doors are. */
function seatRows(b: Batch, m: THREE.Material, W: number, from: number, to: number, floor: number, skip: [number, number][]) {
  for (let z = from; z > to; z -= 0.82) {
    if (skip.some(([a, c]) => z < a && z > c)) continue;
    for (const sx of [-1, 1]) {
      b.box(m, 0.9, 0.12, 0.44, sx * (W / 2 - 0.55), floor + 0.42, z);
      b.box(m, 0.9, 0.5, 0.08, sx * (W / 2 - 0.55), floor + 0.7, z - 0.22);
    }
  }
}

/** A city bus: low floor, a long window band, doors on its right (-X), seats you can see through the glass. */
function bus(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const b = new Batch();
  const base = 0.3;
  const floor = 0.4;
  const sill = Math.min(1.15, H * 0.37);
  const roof = H * 0.86;
  const top = H * 0.94;
  g.add(rbox(W, sill - base, D, 0.12, paint(1), 0, base + (sill - base) / 2, 0));
  g.add(rbox(W, top - roof, D, 0.2, paint(1), 0, roof + (top - roof) / 2, 0));
  // The air-conditioning pod on the roof, toward the back.
  g.add(rbox(W * 0.55, H - top, D * 0.2, 0.08, paint(0.85), 0, top + (H - top) / 2, -D * 0.25));
  // Front and back: a tall windscreen, a rear panel with a small window.
  const fh = roof - 0.95;
  const screen = box(W * 0.94, fh, 0.03, GLASS, 0, 0.95 + fh / 2, D / 2 + 0.005);
  screen.castShadow = false;
  g.add(screen);
  g.add(box(W * 0.98, roof - sill, 0.05, paint(0.95), 0, sill + (roof - sill) / 2, -D / 2 + 0.02));
  const doors: [number, number][] = [[D / 2 - 0.6, D / 2 - 1.9], [0.3, -1.0]];
  windowBand(b, g, paint(0.8), W, 0, D - 0.1, sill, roof, 1.5);
  for (const [a, c] of doors) {
    // A glazed double door, floor to roof, on the kerb side.
    const len = a - c;
    b.box(paint(0.35), 0.04, roof - base, len, -(W / 2 + 0.01), base + (roof - base) / 2, (a + c) / 2);
    const glass = box(0.02, roof - base - 0.25, len - 0.16, GLASS, -(W / 2 + 0.035), base + 0.12 + (roof - base - 0.25) / 2, (a + c) / 2);
    glass.castShadow = false;
    g.add(glass);
  }
  // Inside: the floor and the seats.
  b.box(paint(0.55), W - 0.12, 0.04, D - 0.3, 0, floor, 0);
  seatRows(b, tint("#5a6472"), W, D / 2 - 2.4, -D / 2 + 0.6, floor, [[0.5, -1.2]]);
  // The lit destination sign over the windscreen, head and tail lights.
  g.add(box(W * 0.7, 0.24, 0.04, tint("#f2c14e", 1.2), 0, roof - 0.14, D / 2 + 0.02));
  for (const sx of [-1, 1]) {
    b.box(paint(1.6), 0.32, 0.12, 0.04, sx * W * 0.36, 0.62, D / 2 + 0.01);
    b.box(paint(0.4), 0.22, 0.32, 0.04, sx * W * 0.4, 0.75, -D / 2 - 0.01);
    // Mirrors out on arms at the front corners.
    b.box(paint(0.4), 0.08, 0.32, 0.14, sx * (W / 2 + 0.22), roof - 0.55, D / 2 - 0.15);
  }
  // Wheels under arches: front axle in the overhang behind the door, rear at the back.
  const wr = 0.5;
  const wg = new THREE.CylinderGeometry(wr, wr, 0.3, 20);
  wg.rotateZ(Math.PI / 2);
  for (const z of [D / 2 - 2.65, -D / 2 + 3.1]) for (const sx of [-1, 1]) {
    g.add(part(wg, paint(0.25), sx * (W / 2 - 0.12), wr, z));
    b.box(paint(0.3), 0.02, 0.72, 1.25, sx * (W / 2 + 0.006), base + 0.32, z);
  }
  b.addTo(g);
  return g;
}

/**
 * A low-floor tram in three sections joined by bellows, a cab and windscreen
 * at both ends (it drives either way), doors on both sides, and a pantograph
 * up to the wire on the middle section. The skirts hide the bogies.
 */
function tram(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const b = new Batch();
  const gap = 0.5;
  const secLen = (D - gap * 2) / 3;
  const base = 0.12;
  const floor = 0.35;
  const sill = 0.95;
  const top = Math.min(H - 0.45, 3.2);
  const roof = top - 0.35;
  for (let i = 0; i < 3; i++) {
    const z = (1 - i) * (secLen + gap);
    g.add(rbox(W, sill - base, secLen, 0.18, paint(1), 0, base + (sill - base) / 2, z));
    g.add(rbox(W, top - roof, secLen, 0.22, paint(1), 0, roof + (top - roof) / 2, z));
    // Roof gear: converters and cooling in long low boxes.
    g.add(rbox(W * 0.6, 0.22, secLen * 0.42, 0.06, paint(0.8), 0, top + 0.11, z + (i === 1 ? -secLen * 0.25 : 0)));
    windowBand(b, g, paint(0.8), W, z, secLen - 0.1, sill, roof, 1.3);
    // A double door on each side, in the middle of a section (toward the cab on the end ones).
    const dz = i === 1 ? z : z + (i === 0 ? -1 : 1) * secLen * 0.15;
    for (const sx of [-1, 1]) {
      b.box(paint(0.35), 0.04, roof - base, 1.3, sx * (W / 2 + 0.01), base + (roof - base) / 2, dz);
      const glass = box(0.02, roof - base - 0.22, 1.14, GLASS, sx * (W / 2 + 0.035), base + 0.11 + (roof - base - 0.22) / 2, dz);
      glass.castShadow = false;
      g.add(glass);
    }
    b.box(paint(0.55), W - 0.12, 0.04, secLen - 0.2, 0, floor, z);
    seatRows(b, tint("#5a6472"), W, z + secLen / 2 - (i === 0 ? 2 : 0.6), z - secLen / 2 + (i === 2 ? 2 : 0.6), floor, [[dz + 0.9, dz - 0.9]]);
    // Skirts down the sides over the bogies, darker so the tram reads as on rails.
    for (const sx of [-1, 1]) b.box(paint(0.4), 0.03, base + 0.1, secLen * 0.96, sx * (W / 2 + 0.005), (base + 0.1) / 2, z);
  }
  // Bellows between the sections.
  for (const sz of [-1, 1]) b.box(paint(0.32), W * 0.9, top - base - 0.1, gap, 0, base + (top - base - 0.1) / 2, sz * (secLen / 2 + gap / 2));
  // Both ends are cabs: windscreen, a lit sign, lamps.
  for (const sz of [-1, 1]) {
    const fh = roof - 0.9;
    const screen = box(W * 0.9, fh, 0.03, GLASS, 0, 0.9 + fh / 2, sz * (D / 2 + 0.005));
    screen.castShadow = false;
    g.add(screen);
    g.add(box(W * 0.6, 0.22, 0.04, tint("#f2c14e", 1.2), 0, roof - 0.12, sz * (D / 2 + 0.02)));
    for (const sx of [-1, 1]) b.box(sz > 0 ? paint(1.6) : paint(0.45), 0.3, 0.12, 0.04, sx * W * 0.32, 0.55, sz * (D / 2 + 0.01));
  }
  // The pantograph: a base on the roof, a folded arm, the collector head at the wire.
  const pz = secLen * 0.2;
  b.box(paint(0.4), 1.2, 0.12, 0.9, 0, top + 0.06, pz);
  const steel = tint("#3d4046");
  const reach = Math.max(0.3, H - top - 0.1);
  const lower = Math.hypot(0.9, reach / 2);
  const arm1 = box(0.05, lower, 0.05, steel, 0, top + 0.12 + reach / 4, pz + 0.45 - 0.45);
  arm1.rotation.x = Math.atan2(0.9, reach / 2);
  g.add(arm1);
  const arm2 = box(0.05, lower, 0.05, steel, 0, top + 0.12 + (reach * 3) / 4, pz);
  arm2.rotation.x = -Math.atan2(0.9, reach / 2);
  g.add(arm2);
  g.add(box(1.6, 0.05, 0.12, steel, 0, H - 0.04, pz - 0.0));
  b.addTo(g);
  return g;
}

/** Street tram tracks: two grooved rails at standard gauge, set in a strip of setts. */
function rails(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, , D] = o.size;
  const g = new THREE.Group();
  g.add(box(W, 0.04, D, paint(1), 0, 0.02, 0));
  const steel = tint("#b9bec4", 1.1);
  for (const sx of [-1, 1]) {
    g.add(box(0.07, 0.025, D, steel, sx * 0.7175, 0.05, 0));
    g.add(box(0.03, 0.026, D, paint(0.45), sx * (0.7175 - 0.05), 0.05, 0));
  }
  return g;
}

function dog(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const sit = o.pose === "seated";
  const leg = H * 0.42;
  if (sit) {
    g.add(box(W, H * 0.45, D * 0.45, paint(1), 0, H * 0.32, 0));
    g.add(box(W * 0.9, H * 0.3, D * 0.4, paint(1), 0, H * 0.12, -D * 0.05));
    for (const sx of [-1, 1]) g.add(box(0.07, H * 0.45, 0.07, paint(0.9), sx * W * 0.28, H * 0.22, D * 0.18));
    g.add(box(W * 0.75, H * 0.24, D * 0.34, paint(1), 0, H * 0.78, D * 0.12));
    g.add(box(W * 0.4, H * 0.12, D * 0.2, paint(0.85), 0, H * 0.72, D * 0.36));
    for (const sx of [-1, 1]) g.add(box(0.05, H * 0.16, 0.08, paint(0.8), sx * W * 0.25, H * 0.95, D * 0.08));
  } else {
    g.add(box(W, H * 0.3, D * 0.62, paint(1), 0, leg + H * 0.15, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.07, leg, 0.07, paint(0.9), sx * W * 0.32, leg / 2, sz * D * 0.24));
    g.add(box(W * 0.72, H * 0.24, D * 0.26, paint(1), 0, H * 0.82, D * 0.38));
    g.add(box(W * 0.4, H * 0.12, D * 0.18, paint(0.85), 0, H * 0.76, D * 0.55));
    for (const sx of [-1, 1]) g.add(box(0.05, H * 0.15, 0.08, paint(0.8), sx * W * 0.24, H * 0.99, D * 0.34));
    g.add(box(0.05, 0.05, D * 0.3, paint(0.9), 0, leg + H * 0.28, -D * 0.42));
  }
  return g;
}

/* ---------- people: a figure whose arm and upper body move ---------- */

function capsuleMesh(radius: number, length: number, m: THREE.Material) {
  return part(new THREE.CapsuleGeometry(radius, Math.max(length, 0.001), 5, 12), m);
}

/** Lays a capsule of fixed length along a to b. */
function spanLimb(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  mesh.position.copy(a).lerp(b, 0.5);
  const d = b.clone().sub(a);
  if (d.lengthSq() > 1e-10) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

type ArmRig = {
  side: -1 | 1;
  upper: THREE.Mesh;
  fore: THREE.Mesh;
  elbow: THREE.Mesh;
  hand: THREE.Group;
  /** Shoulder, rest elbow and rest wrist, in the upper body's frame. */
  sh: THREE.Vector3;
  el: THREE.Vector3;
  wr: THREE.Vector3;
  l1: number;
  l2: number;
  /** The arm a walk swings from: the pose's own, or a standing arm for the walking pose. */
  nel: THREE.Vector3;
  nwr: THREE.Vector3;
};

type LegRig = {
  hip: THREE.Vector3;
  thigh: THREE.Mesh;
  shin: THREE.Mesh;
  kneeJ: THREE.Mesh;
  calf: THREE.Mesh;
  foot: THREE.Group;
  l1: number;
  l2: number;
  restKnee: THREE.Vector3;
  restAnkle: THREE.Vector3;
  restFoot: THREE.Vector3;
};

export type PersonRig = {
  /** Pivots at the hip: leaning and turning move everything above it. */
  upperBody: THREE.Group;
  hipY: number;
  H: number;
  /** Middle of the head, in the upper body's frame. */
  headY: number;
  arms: [ArmRig, ArmRig];
  legs: [LegRig, LegRig];
  /** The pelvis and everything above it: drops and bobs with each step. */
  torso: THREE.Group;
  /** Upright poses walk when their track moves; seated and kneeling do not. */
  canWalk: boolean;
  /** Standing and walking poses swing their arms; the others keep theirs. */
  swings: boolean;
  /** The legs are off their rest pose and must be put back when the walk stops. */
  walking: boolean;
  /** How far short of the target the hand stopped, metres (0 when it got there). */
  gap: number;
};

/** Body proportions per build, as fractions of height. */
const BUILDS = {
  slim: { sw: 0.12, chest: 0.09, waist: 0.07, hip: 0.088, limb: 0.9 },
  average: { sw: 0.128, chest: 0.102, waist: 0.083, hip: 0.098, limb: 1 },
  broad: { sw: 0.142, chest: 0.12, waist: 0.1, hip: 0.106, limb: 1.13 },
  curvy: { sw: 0.12, chest: 0.1, waist: 0.076, hip: 0.118, limb: 1.02 },
} as const;

/** A body segment that tapers: radius ra at its start, rb at its end. */
function taper(ra: number, rb: number, len: number, m: THREE.Material) {
  return part(new THREE.CylinderGeometry(rb, ra, Math.max(len, 0.001), 12), m);
}
const ball = (r: number, m: THREE.Material) => part(new THREE.SphereGeometry(r, 14, 10), m);

/** A surface of revolution through (radius, height) points, squashed front to back. */
function lathe(pts: [number, number][], depth: number, m: THREE.Material) {
  const mesh = part(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 20), m);
  mesh.scale.z = depth;
  return mesh;
}

/**
 * A figure at true proportions: a shaped torso (chest, waist and hips by
 * build), tapered limbs with joints, hands and shoes, a head with a jaw,
 * nose and ears, and hair. Faceless on purpose. Clothes wear the subject's
 * colour so two people stay told apart; skin is one neutral tone. The upper
 * body sits in a group pivoting at the hip so it can lean and turn, and each
 * arm can reach for a point.
 */
function person(o: BlockObject, paint: Paint, tint: Tint) {
  const child = o.kind === "child";
  const H = o.size[1];
  const B = BUILDS[o.build ?? "average"];
  const pose = poseDef(o.pose);
  const hipY = poseHipY(pose, H);
  const shY = poseShoulderY(pose, H);
  const g = new THREE.Group();
  const shirt = paint(1);
  const pants = paint(0.62);
  const shoes = tint("#3a3b3f");
  const skin = tint("#cfb9a6");
  const hairM = tint("#4a3d35");
  const L = B.limb * (child ? 0.92 : 1);
  const at = (p: [number, number, number], yBase = 0) => new THREE.Vector3(p[0] * H, yBase + p[1] * H, p[2] * H);

  // The pelvis and the upper body sit in one group that drops and bobs with
  // each step; the legs stay in the figure's own frame, where the feet are.
  const torso = new THREE.Group();
  g.add(torso);
  // Pelvis: stays with the legs when the upper body leans.
  torso.add(lathe([[0.001, hipY - 0.085 * H], [B.hip * 0.62 * H, hipY - 0.075 * H], [B.hip * 0.95 * H, hipY - 0.03 * H], [B.hip * H, hipY + 0.01 * H]], 0.68, pants));

  // Legs, where the pose puts them.
  const legs: LegRig[] = [];
  for (const i of [0, 1] as const) {
    const side = i === 0 ? -1 : 1;
    const hip = new THREE.Vector3(side * B.hip * 0.5 * H, hipY - 0.03 * H, 0);
    const knee = at(pose.knee[i]);
    let ankle = at(pose.ankle[i]);
    if (pose.seatM !== undefined) {
      knee.y = hipY;
      const len = SHIN * H;
      const ground = 0.04 * H;
      const drop = knee.y - ground;
      if (drop >= len) ankle = new THREE.Vector3(knee.x, knee.y - len, knee.z + 0.02 * H);
      else ankle = new THREE.Vector3(knee.x, ground, knee.z + Math.sqrt(Math.max(0, len * len - drop * drop)));
    }
    const thigh = taper(0.052 * H * L, 0.034 * H * L, hip.distanceTo(knee), pants);
    spanLimb(thigh, hip, knee);
    const shin = taper(0.033 * H * L, 0.021 * H * L, knee.distanceTo(ankle), pants);
    spanLimb(shin, knee, ankle);
    const kneeJ = ball(0.034 * H * L, pants);
    kneeJ.position.copy(knee);
    // A calf: the shin is fuller just below the knee.
    const calf = ball(0.032 * H * L, pants);
    calf.scale.set(0.95, 2.1, 0.95);
    calf.position.copy(knee.clone().lerp(ankle, 0.3)).add(new THREE.Vector3(0, 0, -0.006 * H));
    // A shoe: heel under the ankle, toe forward.
    const foot = new THREE.Group();
    const fl = 0.15 * H;
    const fy = Math.max(0.022 * H, ankle.y - 0.035 * H);
    foot.add(box(0.05 * H, 0.045 * H, fl * 0.62, shoes, 0, 0, fl * 0.12));
    const toe = ball(0.026 * H, shoes);
    toe.scale.set(0.95, 0.85, 1.5);
    toe.position.set(0, -0.004 * H, fl * 0.48);
    foot.add(toe);
    foot.position.set(ankle.x, fy, ankle.z);
    g.add(thigh, shin, kneeJ, calf, foot);
    legs.push({
      hip, thigh, shin, kneeJ, calf, foot, l1: hip.distanceTo(knee), l2: knee.distanceTo(ankle),
      restKnee: knee.clone(), restAnkle: ankle.clone(), restFoot: foot.position.clone(),
    });
  }

  // Everything above the hip, in a group pivoting at the hip.
  const up = new THREE.Group();
  up.position.set(0, hipY, 0);
  torso.add(up);
  const rel = (v: THREE.Vector3) => v.sub(new THREE.Vector3(0, hipY, 0));
  const top = shY - hipY;
  // Torso: hips, waist, ribs, chest, then the shoulders rounding in to the neck.
  up.add(lathe([
    [B.hip * 0.98 * H, -0.01 * H], [B.waist * 1.05 * H, top * 0.32], [B.waist * H, top * 0.42],
    [B.chest * 0.96 * H, top * 0.62], [B.chest * H, top * 0.78], [B.sw * 0.88 * H, top * 0.93],
    [B.sw * 0.55 * H, top + 0.012 * H], [0.03 * H, top + 0.022 * H],
  ], 0.62, shirt));
  // Neck and head. A child's head is bigger for its height.
  const hs = child ? 1.22 : 1;
  const neck = taper(0.03 * H, 0.027 * H, 0.06 * H, skin);
  neck.position.set(0, top + 0.035 * H, 0.004 * H);
  up.add(neck);
  const headY = top + 0.115 * H * (child ? 1.08 : 1);
  const r = 0.06 * H * hs;
  const skull = ball(r, skin);
  skull.scale.set(0.86, 1.06, 0.98);
  skull.position.set(0, headY, -0.004 * H);
  const jaw = ball(r * 0.72, skin);
  jaw.scale.set(0.86, 0.82, 0.92);
  jaw.position.set(0, headY - r * 0.48, r * 0.22);
  const nose = part(new THREE.ConeGeometry(r * 0.14, r * 0.32, 6), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, headY - r * 0.1, r * 0.98);
  up.add(skull, jaw, nose);
  for (const sx of [-1, 1]) {
    const ear = ball(r * 0.2, skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(sx * r * 0.86, headY - r * 0.05, -r * 0.05);
    up.add(ear);
  }
  addHair(up, o.hair ?? "short", r, headY, hairM);

  const arms = ([0, 1] as const).map((i) => {
    const side = (i === 0 ? -1 : 1) as -1 | 1;
    const sh = rel(new THREE.Vector3(side * B.sw * H, shY - 0.02 * H, 0));
    const el = rel(at(pose.elbow[i], shY));
    const wr = rel(at(pose.wrist[i], shY));
    const l1 = sh.distanceTo(el);
    const l2 = el.distanceTo(wr);
    const delt = ball(0.031 * H * L, shirt);
    delt.position.copy(sh).add(new THREE.Vector3(0, -0.004 * H, 0));
    const upper = taper(0.033 * H * L, 0.026 * H * L, l1, shirt);
    const elbow = ball(0.025 * H * L, skin);
    const fore = taper(0.025 * H * L, 0.018 * H * L, l2, skin);
    const hand = new THREE.Group();
    const palm = box(0.046 * H, 0.068 * H, 0.02 * H, skin, 0, 0.034 * H, 0);
    const fingers = box(0.042 * H, 0.03 * H, 0.016 * H, skin, 0, 0.082 * H, 0.002 * H);
    const thumb = box(0.014 * H, 0.04 * H, 0.014 * H, skin, -side * 0.026 * H, 0.03 * H, 0.008 * H);
    thumb.rotation.z = side * 0.4;
    hand.add(palm, fingers, thumb);
    up.add(delt, upper, elbow, fore, hand);
    // The walking pose holds its arms mid-swing; a walk swings from standing ones.
    const stand = pose.id === "walking" ? poseDef("standing") : pose;
    const nel = pose.id === "walking" ? rel(at(stand.elbow[i], shY)) : el.clone();
    const nwr = pose.id === "walking" ? rel(at(stand.wrist[i], shY)) : wr.clone();
    const arm: ArmRig = { side, upper, fore, elbow, hand, sh, el, wr, l1, l2, nel, nwr };
    placeArm(arm, el, wr);
    return arm;
  }) as [ArmRig, ArmRig];
  const rig: PersonRig = {
    upperBody: up, hipY, H, headY, arms, legs: legs as [LegRig, LegRig], torso,
    canWalk: pose.seatM === undefined && pose.id !== "kneeling",
    swings: pose.id === "standing" || pose.id === "walking",
    walking: false, gap: 0,
  };
  g.userData.rig = rig;
  return g;
}

/** Hair as a shell over the top and back of the head. */
function addHair(up: THREE.Group, style: string, r: number, headY: number, m: THREE.Material) {
  if (style === "bald") return;
  const cap = part(new THREE.SphereGeometry(r * 1.07, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m);
  cap.scale.set(0.9, 1.02, 1.0);
  cap.rotation.x = -0.62;
  cap.position.set(0, headY + r * 0.1, -r * 0.1);
  up.add(cap);
  if (style === "long") {
    const back = part(new THREE.CapsuleGeometry(r * 0.78, r * 1.6, 4, 12), m);
    back.scale.set(1.05, 1, 0.45);
    back.position.set(0, headY - r * 1.0, -r * 0.62);
    up.add(back);
  } else if (style === "bun") {
    const bun = ball(r * 0.36, m);
    bun.position.set(0, headY + r * 0.55, -r * 0.88);
    up.add(bun);
  } else if (style === "curly") {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const c = ball(r * 0.3, m);
      c.position.set(Math.cos(a) * r * 0.82, headY + r * 0.32 + Math.sin(i * 1.7) * r * 0.12, Math.sin(a) * r * 0.82 - r * 0.12);
      up.add(c);
    }
    const crown = ball(r * 0.5, m);
    crown.position.set(0, headY + r * 0.85, -r * 0.1);
    up.add(crown);
  }
}

function placeArm(a: ArmRig, el: THREE.Vector3, wr: THREE.Vector3) {
  spanLimb(a.upper, a.sh, el);
  spanLimb(a.fore, el, wr);
  a.elbow.position.copy(el);
  a.hand.position.copy(wr);
  const d = wr.clone().sub(el);
  if (d.lengthSq() > 1e-10) a.hand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

const twoBone = (a: ArmRig, goal: THREE.Vector3, pole: THREE.Vector3) => {
  const toGoal = goal.clone().sub(a.sh);
  const reachLen = a.l1 + a.l2;
  const dist = toGoal.length();
  const dir = dist > 1e-6 ? toGoal.clone().divideScalar(dist) : new THREE.Vector3(0, -1, 0);
  const d = Math.min(Math.max(dist, Math.abs(a.l1 - a.l2) + 1e-3), reachLen - 1e-4);
  const along = (a.l1 * a.l1 + d * d - a.l2 * a.l2) / (2 * d);
  const h = Math.sqrt(Math.max(0, a.l1 * a.l1 - along * along));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0);
  perp.normalize();
  const el = a.sh.clone().add(dir.clone().multiplyScalar(along)).add(perp.multiplyScalar(h));
  const wr = a.sh.clone().add(dir.clone().multiplyScalar(d));
  return { el, wr, gap: Math.max(0, dist - reachLen) };
};

/**
 * A leg as two fixed-length bones from the hip to an ankle, the knee bending
 * forward. Out of reach the leg goes straight at the ankle.
 */
function legIK(l: LegRig, hip: THREE.Vector3, ankle: THREE.Vector3) {
  const to = ankle.clone().sub(hip);
  const dist = to.length();
  const dir = dist > 1e-6 ? to.clone().divideScalar(dist) : new THREE.Vector3(0, -1, 0);
  const d = Math.min(Math.max(dist, Math.abs(l.l1 - l.l2) + 1e-3), l.l1 + l.l2 - 1e-4);
  const along = (l.l1 * l.l1 + d * d - l.l2 * l.l2) / (2 * d);
  const h = Math.sqrt(Math.max(0, l.l1 * l.l1 - along * along));
  const pole = new THREE.Vector3(0, 0, 1);
  const perp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perp.lengthSq() < 1e-8) perp.set(0, 0, 1);
  perp.normalize();
  const knee = hip.clone().add(dir.clone().multiplyScalar(along)).add(perp.multiplyScalar(h));
  return { knee, ankle: hip.clone().add(dir.multiplyScalar(d)) };
}

function placeLeg(l: LegRig, hip: THREE.Vector3, knee: THREE.Vector3, ankle: THREE.Vector3, foot: THREE.Vector3, pitch: number) {
  spanLimb(l.thigh, hip, knee);
  spanLimb(l.shin, knee, ankle);
  l.kneeJ.position.copy(knee);
  l.calf.position.copy(knee.clone().lerp(ankle, 0.3));
  l.calf.quaternion.copy(l.shin.quaternion);
  l.foot.position.copy(foot);
  l.foot.rotation.set(pitch, 0, 0);
}

function restLegs(rig: PersonRig) {
  for (const l of rig.legs) {
    placeLeg(l, l.hip, l.restKnee, l.restAnkle, l.restFoot, 0);
    l.calf.quaternion.identity();
  }
  rig.torso.position.set(0, 0, 0);
  rig.walking = false;
}

/** A point on the shoe relative to the shoe's own origin, rotated by its pitch. */
const onFoot = (v: THREE.Vector3, pitch: number) => v.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch);

/**
 * The legs for a walk or a run. Each foot is either on the ground or in the
 * air (see footPhase). On the ground it rolls the way a foot does: it lands
 * on the heel, goes flat, then lifts the heel and pushes off the toe, and
 * whichever part is down stays where it was put while the body passes over
 * it. In the air it swings forward, clearing the ground (a run kicks the heel
 * up behind). The hips drop just enough for the feet to reach, which is the
 * dip a real walk has at each step; a run bounces the other way, lowest with
 * a foot down and highest in the air between steps.
 *
 * Returns how far the torso dropped, the forward lean, and how far each arm
 * swings (degrees, forward positive), opposite to its leg.
 */
function poseLegs(rig: PersonRig, gt: Gait): { lean: number; swing: [number, number] } {
  const H = rig.H;
  const w = gt.walk;
  const run = gt.run;
  const [dx, dz] = gt.dir;
  const fwd = Math.max(0, dz);
  const E = gt.excursion;
  const lift = (0.055 + (0.08 + 0.03 * Math.min(gt.speed, 5)) * run) * H * w;
  // A walk lands on the heel; a run lands nearer the middle of the foot.
  const heel0 = rad(-12) * fwd * w * (1 - run);
  const toe1 = rad(32 - 8 * run) * fwd * w;
  const heelOff = new THREE.Vector3(0, -0.0225 * H, -0.0285 * H);
  const toeOff = new THREE.Vector3(0, -0.024 * H, 0.1 * H);
  const ankleUp = new THREE.Vector3(0, 0.035 * H, 0);
  const s1 = 0.12 - 0.09 * run;
  const s2 = 0.62 - 0.07 * run;
  // Where in the stance the foot passes under the hip: midway through the flat
  // part for a walk, later for a run, which lands its feet further forward.
  const sm = (s1 + s2) / 2 + 0.2 * run;
  // Where the shoe's origin is along the line of travel during the flat part,
  // and the heel and toe points that are planted either side of it.
  const along = (u: number) => -(u - sm) * E;
  // From where a standing foot is, whatever the pose holds its feet in.
  const at = (l: LegRig, a: number) => new THREE.Vector3(l.restFoot.x + dx * a, 0.022 * H, dz * a);
  const stanceFoot = (l: LegRig, u: number): { o: THREE.Vector3; pitch: number } => {
    if (u < s1) {
      const k = u / s1;
      const pitch = heel0 * (1 - k * k * (3 - 2 * k));
      const heel = at(l, along(s1) + (s1 - u) * E).add(heelOff);
      return { o: heel.sub(onFoot(heelOff, pitch)), pitch };
    }
    if (u <= s2) return { o: at(l, along(u)), pitch: 0 };
    const k = (u - s2) / (1 - s2);
    const pitch = toe1 * Math.pow(k, 1.3);
    const toe = at(l, along(s2) - (u - s2) * E).add(toeOff);
    return { o: toe.sub(onFoot(toeOff, pitch)), pitch };
  };
  const target = (l: LegRig, i: 0 | 1) => {
    const f = footPhase(gt.phase, i, gt.duty);
    if (f.stance) return stanceFoot(l, f.s);
    const a = stanceFoot(l, 1);
    const b = stanceFoot(l, 0);
    const u = f.s;
    const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
    const o = a.o.clone().lerp(b.o, e);
    // A run lifts the heel high early in the swing and folds it in behind.
    const up = run > 0 ? Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 1.2) : Math.sin(Math.PI * u);
    o.y += lift * up;
    const kick = 0.12 * H * run * w * Math.sin(Math.PI * u) * (1 - u);
    o.x -= dx * kick;
    o.z -= dz * kick;
    const pitch = a.pitch * Math.pow(1 - Math.min(1, u / 0.6), 2) + b.pitch * Math.max(0, (u - 0.6) / 0.4);
    return { o, pitch };
  };
  // Blend from the pose's own feet as the walk eases in.
  const feet = rig.legs.map((l, i) => {
    const t = target(l, i as 0 | 1);
    const o = l.restFoot.clone().lerp(t.o, w);
    const pitch = t.pitch;
    const ankle = o.clone().add(onFoot(ankleUp, pitch));
    return { o, pitch, ankle };
  });
  // Drop the hips just enough that both feet are in reach, knees a little soft.
  let drop = (0.008 + 0.014 * run) * H * w;
  rig.legs.forEach((l, i) => {
    const a = feet[i].ankle;
    const horiz = Math.hypot(a.x - l.hip.x, a.z - l.hip.z);
    const reach = 0.985 * (l.l1 + l.l2);
    const vert = Math.sqrt(Math.max(0, reach * reach - horiz * horiz));
    drop = Math.max(drop, l.hip.y - a.y - vert);
  });
  drop = Math.min(drop, 0.14 * H);
  // A run is lowest with a foot down and highest in the air between steps.
  const bounce = run > 0 ? -0.02 * H * run * w * Math.cos(2 * Math.PI * (2 * gt.phase - gt.duty)) : 0;
  const dy = -drop + bounce;
  rig.torso.position.set(0, dy, 0);
  rig.legs.forEach((l, i) => {
    const hip = l.hip.clone().add(new THREE.Vector3(0, dy, 0));
    const { knee, ankle } = legIK(l, hip, feet[i].ankle);
    placeLeg(l, hip, knee, ankle, feet[i].o, feet[i].pitch);
  });
  rig.walking = true;
  // Arms swing opposite their legs: the right arm comes forward with the left foot.
  const amp = (12 + 10 * Math.min(1, gt.speed / 1.5) + 12 * run) * w * fwd;
  const c = Math.cos(2 * Math.PI * gt.phase);
  return { lean: -(2 * w + 9 * run) * fwd, swing: [-amp * c, amp * c] };
}

/**
 * An arm at rest for a walk or a run: swung about the shoulder, and for a
 * run bent at the elbow with the forearm carried forward.
 */
function swingArm(a: ArmRig, deg: number, run: number): { el: THREE.Vector3; wr: THREE.Vector3 } {
  let el = a.nel.clone();
  let wr = a.nwr.clone();
  if (run > 0) {
    const rEl = a.sh.clone().add(new THREE.Vector3(a.side * 0.01, -0.96, -0.28).normalize().multiplyScalar(a.l1));
    // The forearm angles up and in toward the body's centre line.
    const rWr = rEl.clone().add(new THREE.Vector3(-a.side * 0.3, 0.7, 0.75).normalize().multiplyScalar(a.l2));
    el = el.lerp(rEl, run);
    wr = wr.lerp(rWr, run);
  }
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -rad(deg));
  const pivot = (v: THREE.Vector3) => v.sub(a.sh).applyQuaternion(q).add(a.sh);
  return { el: pivot(el), wr: pivot(wr) };
}

export type GestureState = {
  kind: GestureKind;
  /** 0 to 1: how far into the gesture (0 is the pose's own arms). */
  reach: number;
  lean: number;
  hand: "right" | "left";
  /** The point the gesture is done toward, in the person's own frame; null for none. */
  target: THREE.Vector3 | null;
  /** Seconds, for anything that moves once there (a wave, a clap, a stroke). */
  time: number;
  /** A reach strokes back and forth once it is there. */
  stroke: boolean;
  /** The walk or run the person's track carries them at, if any. */
  gait?: Gait;
};

type ArmGoal = { goal: THREE.Vector3; pole: THREE.Vector3 };

/**
 * Where each hand goes for a gesture, in the upper body's own frame (after it
 * has leant and turned). Points on the body (the ear, the mouth, the hips) are
 * placed on the figure's own proportions; reaching gestures are a direction
 * from the shoulder and a share of the arm's length, so they fit any height.
 */
function gestureGoals(rig: PersonRig, s: GestureState, local: THREE.Vector3 | null): (ArmGoal | null)[] {
  const H = rig.H;
  const spec = gestureOf(s.kind);
  const t = s.time;
  return rig.arms.map((a, i) => {
    const mine = spec.hands === 2 || (s.hand === "right" ? i === 0 : i === 1);
    if (!mine) return null;
    const side = a.side;
    const L = a.l1 + a.l2;
    const headY = rig.headY;
    const pt = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const ext = (dx: number, dy: number, dz: number, f: number) => a.sh.clone().add(pt(dx, dy, dz).normalize().multiplyScalar(L * f));
    const pole = (x: number, y: number, z: number) => pt(x, y, z);
    switch (s.kind) {
      case "reach": {
        if (!local) return null;
        // The wrist stops a hand's length short, so the hand rests on it.
        const goal = local.clone();
        const back = goal.clone().sub(a.sh);
        if (back.lengthSq() > 1e-6) goal.sub(back.normalize().multiplyScalar(0.06 * H));
        if (s.stroke && s.reach > 0.6) {
          // A slow stroke across the top: back and forth along the line from
          // the shoulder to the target, lifting a little on the way back.
          const ph = t * Math.PI * 2 * 0.9;
          const flat = goal.clone().sub(a.sh).setY(0);
          if (flat.lengthSq() > 1e-6) flat.normalize();
          goal.add(flat.multiplyScalar(Math.sin(ph) * 0.05)).add(pt(0, (1 - Math.cos(ph)) * 0.008, 0));
        }
        return { goal, pole: pole(side, -0.7, 0.15) };
      }
      case "point": {
        const d = local ? local.clone().sub(a.sh) : pt(side * 0.12, 0.1, 1);
        return { goal: ext(d.x, d.y, d.z, 0.99), pole: pole(side, -0.6, 0) };
      }
      case "offer": {
        if (local) {
          const d = local.clone().sub(a.sh);
          const f = Math.min(0.88, Math.max(0.5, d.length() / L));
          return { goal: ext(d.x, d.y - 0.15 * d.length(), d.z, f), pole: pole(side, -1, 0) };
        }
        return { goal: ext(side * 0.15, -0.35, 1, 0.82), pole: pole(side, -1, 0) };
      }
      case "wave": {
        const goal = ext(side * 0.55, 0.85, 0.25, 0.78);
        goal.x += Math.sin(t * Math.PI * 2 * 1.7) * 0.06 * H;
        return { goal, pole: pole(side, -0.5, 0.15) };
      }
      case "raise": return { goal: ext(side * 0.18, 1, 0.12, 0.98), pole: pole(side, 0, -0.2) };
      case "phone": return { goal: pt(side * 0.075 * H, headY, 0.012 * H), pole: pole(side, -0.6, 0.5) };
      case "drink": return { goal: pt(side * 0.02 * H, headY - 0.035 * H, 0.075 * H), pole: pole(side, -1, 0.35) };
      case "chin": return { goal: pt(side * 0.012 * H, headY - 0.062 * H, 0.066 * H), pole: pole(side, -1, 0.7) };
      case "present": return { goal: pt(side * 0.075 * H, a.sh.y - 0.05 * H, 0.26 * H), pole: pole(side, -1, -0.1) };
      case "cheer": {
        const goal = ext(side * 0.6, 1, 0.15, 0.97);
        goal.y += Math.sin(t * Math.PI * 2 * 1.2) * 0.012 * H;
        return { goal, pole: pole(side, 0, -0.1) };
      }
      case "open": return { goal: ext(side * 1, 0.15, 0.5, 0.97), pole: pole(side, -0.6, -0.4) };
      case "shrug": return { goal: ext(side * 0.6, -0.55, 0.75, 0.7), pole: pole(side, -1, -0.3) };
      case "hips": return { goal: pt(side * 0.14 * H, 0.04 * H, 0.01 * H), pole: pole(side, 0.1, -0.7) };
      case "clap": {
        const apart = (1 + Math.sin(t * Math.PI * 2 * 2.2)) / 2;
        return { goal: pt(side * (0.014 + apart * 0.05) * H, a.sh.y - 0.13 * H, 0.22 * H), pole: pole(side, -1, 0) };
      }
      case "cover": return { goal: pt(side * 0.042 * H, headY - 0.025 * H, 0.07 * H), pole: pole(side, -1, 0.45) };
    }
    return null;
  });
}

/**
 * Poses a person's upper body and arms for a gesture. The body leans back by
 * `lean` and, for a gesture done toward something, turns at the hip so the
 * working shoulder comes round toward it (as far as a person really twists,
 * about 40 degrees). Each arm is solved as two fixed-length bones from the
 * shoulder to where the gesture puts the hand, blended from the pose's own
 * arm by how far into the gesture the person is; out of reach it stretches
 * straight at it.
 */
const FACE = new Set<string>(["phone", "drink", "chin", "cover"]);

export function poseRig(rig: PersonRig, s: GestureState) {
  const up = rig.upperBody;
  const spec = gestureOf(s.kind);
  const needs = spec.target === "required";
  const amount = needs && !s.target ? 0 : Math.min(1, Math.max(0, s.reach));
  const gt = rig.canWalk && s.gait && s.gait.walk > 1e-3 ? s.gait : null;
  const legs = gt ? poseLegs(rig, gt) : null;
  if (!gt && rig.walking) restLegs(rig);
  const leanRad = rad(s.lean + (legs?.lean ?? 0));
  const arm = rig.arms[s.hand === "right" ? 0 : 1];
  let twist = 0;
  if (amount > 0 && s.target && spec.target !== "none") {
    // Try a handful of turns and keep whichever brings the shoulder closest.
    let best = Infinity;
    for (const deg of [-40, -30, -20, -10, 0, 10, 20, 30, 40]) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-leanRad, rad(deg * amount), 0, "YXZ"));
      const sw = arm.sh.clone().applyQuaternion(q).add(up.position);
      const d = sw.distanceTo(s.target) + Math.abs(deg) * 0.0004;
      if (d < best) { best = d; twist = rad(deg * amount); }
    }
  }
  up.rotation.set(-leanRad, twist, 0, "YXZ");
  up.updateMatrix();
  rig.gap = 0;
  const local = s.target ? s.target.clone().applyMatrix4(up.matrix.clone().invert()) : null;
  const goals = amount > 0 ? gestureGoals(rig, s, local) : [null, null];
  rig.arms.forEach((a, i) => {
    const gl = goals[i];
    // A walk swings the arms that are not doing anything else.
    const base = legs && rig.swings ? swingArm(a, legs.swing[i], gt!.run * gt!.walk) : { el: a.el, wr: a.wr };
    if (!gl) { placeArm(a, base.el, base.wr); return; }
    // At the face the HAND should be at the point, so the wrist stops short.
    if (FACE.has(s.kind)) {
      const back = gl.goal.clone().sub(a.sh);
      if (back.lengthSq() > 1e-6) gl.goal.sub(back.normalize().multiplyScalar(0.05 * rig.H));
    }
    const target = base.wr.clone().lerp(gl.goal, amount);
    // The elbow swings from where the pose holds it to where the gesture
    // wants it, so a small amount does not snap the arm round.
    const restPole = base.el.clone().sub(a.sh).normalize();
    const pole = restPole.lerp(gl.pole.normalize(), Math.min(1, amount * 1.5));
    const sol = twoBone(a, target, pole);
    placeArm(a, sol.el, sol.wr);
    if (s.kind === "reach" && a === arm && amount > 0.95) rig.gap = sol.gap;
  });
}

/**
 * Where a hand lands when it reaches for an object, in world coordinates: the
 * top of the head for a person or a dog (just above it, so the hand rests on
 * it rather than in it), the top of anything else.
 */
export function touchPoint(objs: Map<string, BlockObject>, o: BlockObject, t: number): THREE.Vector3 {
  const [, H, D] = o.size;
  let local: THREE.Vector3;
  if (o.kind === "dog") local = o.pose === "seated" ? new THREE.Vector3(0, H * 0.93, D * 0.1) : new THREE.Vector3(0, H * 0.97, D * 0.36);
  else if (o.kind === "person" || o.kind === "child") {
    const p = poseDef(o.pose);
    local = new THREE.Vector3(0, poseShoulderY(p, H) + 0.18 * H, 0);
  } else local = new THREE.Vector3(0, H + 0.02, 0);
  return local.applyMatrix4(objectMatrix(objs, o.id, t));
}

function bike(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const r = H * 0.28;
  const wg = new THREE.CylinderGeometry(r, r, 0.12, 14);
  wg.rotateZ(Math.PI / 2);
  for (const sz of [-1, 1]) g.add(part(wg, paint(0.3), 0, r, sz * (D / 2 - r)));
  g.add(box(W * 0.4, H * 0.3, D * 0.55, paint(1), 0, r + H * 0.12, 0));
  g.add(box(W * 0.35, 0.1, D * 0.3, paint(0.6), 0, r + H * 0.3, -D * 0.08));
  g.add(box(W, 0.05, 0.05, paint(0.5), 0, H * 0.85, D * 0.3));
  return g;
}

function room(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const t = 0.12;
  const g = new THREE.Group();
  g.add(box(W, H, t, paint(1), 0, H / 2, -D / 2));
  g.add(box(t, H, D, paint(0.92), -W / 2, H / 2, 0));
  g.add(box(t, H, D, paint(0.92), W / 2, H / 2, 0));
  // The front wall has a gap in the middle, so the camera has a way in.
  const side = W * 0.35;
  for (const sx of [-1, 1]) g.add(box(side, H, t, paint(0.96), sx * (W / 2 - side / 2), H / 2, D / 2));
  g.add(box(W, 0.02, D, paint(0.7), 0, 0.01, 0));
  return g;
}

function building(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const r = rng(o.id);
  g.add(box(W, H, D, paint(1), 0, H / 2, 0));
  const b = new Batch();
  // Glass is a cool dark grey whatever colour the building is: a window
  // painted in a darker brown reads as a hole, not a window.
  const glass = new THREE.MeshLambertMaterial({ color: "#76808a" });
  const trim = paint(1.08);
  const deep = paint(0.88);
  const tower = H > 40;
  // Every face: an outward axis (nx, nz), its width along the face and the
  // face's distance from the centre.
  const faces = [
    { nx: 0, nz: 1, len: W, off: D / 2 },
    { nx: 0, nz: -1, len: W, off: D / 2 },
    { nx: 1, nz: 0, len: D, off: W / 2 },
    { nx: -1, nz: 0, len: D, off: W / 2 },
  ];
  // A box on a face: u along the face, y up, out = how far it stands proud.
  const onFace = (m: THREE.Material, f: (typeof faces)[number], u: number, y: number, w: number, h: number, out: number) => {
    const c = f.off + out / 2;
    if (f.nz) b.box(m, w, h, out, u, y, f.nz * c);
    else b.box(m, out, h, w, f.nx * c, y, u);
  };
  const gf = H >= 8 ? Math.min(4.4, H * 0.28) : 0;
  // Plinth, the band above the shops, a cornice and a parapet: the lines a
  // street is read by.
  b.box(deep, W + 0.1, 0.45, D + 0.1, 0, 0.225, 0);
  if (gf) b.box(trim, W + 0.16, 0.32, D + 0.16, 0, gf, 0);
  b.box(trim, W + 0.4, 0.34, D + 0.4, 0, H - 0.17, 0);
  for (const f of faces) {
    const a = f.nz ? f.off : f.off;
    if (f.nz) b.box(paint(1), f.len, 0.7, 0.22, 0, H + 0.35, f.nz * (a - 0.11));
    else b.box(paint(1), 0.22, 0.7, f.len - 0.44, f.nx * (a - 0.11), H + 0.35, 0);
  }
  for (const f of faces) {
    // Shop windows across the ground floor.
    if (gf) {
      const bays = Math.max(1, Math.floor((f.len - 1) / 3.4));
      const step = (f.len - 1) / bays;
      for (let i = 0; i < bays; i++) {
        const u = -f.len / 2 + 0.5 + step * (i + 0.5);
        const gh = Math.min(2.7, gf - 1.4);
        onFace(glass, f, u, 0.55 + gh / 2, step * 0.72, gh, 0.04);
        onFace(trim, f, u, 0.55 + gh + 0.08, step * 0.8, 0.14, 0.1);
      }
    }
    // Upper floors.
    const top = H - 1.1;
    if (tower) {
      // A tower is ribbons of glass between floor slabs.
      for (let y = gf + 1.9; y < top; y += 3.6) onFace(glass, f, 0, y, f.len - 0.6, 2.4, 0.04);
      continue;
    }
    const cols = Math.max(1, Math.floor((f.len - 1.2) / 2.6));
    const step = (f.len - 1.2) / cols;
    for (let y = gf + 0.9 + 0.8; y + 0.8 < top; y += 3.2) {
      for (let i = 0; i < cols; i++) {
        const u = -f.len / 2 + 0.6 + step * (i + 0.5);
        onFace(glass, f, u, y, 1.15, 1.6, 0.04);
        onFace(trim, f, u, y - 0.86, 1.45, 0.12, 0.16);
      }
    }
  }
  // A couple of things on the roof: a stair housing, a plant unit.
  for (let i = 0; i < 2; i++) {
    const w = 1.6 + r() * 2.2;
    const d = 1.4 + r() * 2;
    const h = 1 + r() * 1.6;
    if (w > W * 0.6 || d > D * 0.6) continue;
    b.box(deep, w, h, d, (r() - 0.5) * (W - w - 1), H + h / 2, (r() - 0.5) * (D - d - 1));
  }
  b.addTo(g);
  return g;
}

function hill(o: BlockObject, paint: Paint, sharp: boolean) {
  const [W, H, D] = o.size;
  const geo = new THREE.ConeGeometry(0.5, 1, sharp ? 7 : 9, sharp ? 3 : 4);
  // A few lumps so it reads as ground, not a cone. Seeded from the id so the
  // shape is the same on every load.
  let seed = 0;
  for (const ch of o.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 0.49 && y > -0.49) {
      pos.setX(i, pos.getX(i) * (0.85 + rnd() * 0.3));
      pos.setZ(i, pos.getZ(i) * (0.85 + rnd() * 0.3));
      pos.setY(i, y + (rnd() - 0.5) * 0.08);
    }
  }
  if (!sharp) {
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.49) pos.setY(i, 0.35);
  }
  geo.computeVertexNormals();
  const m = part(geo, paint(1));
  m.scale.set(W, H, D);
  m.position.y = H / 2;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

function road(o: BlockObject, paint: Paint) {
  const [W, , D] = o.size;
  const g = new THREE.Group();
  g.add(box(W, 0.02, D, paint(1), 0, 0.01, 0));
  // Dashed centre line and solid edges: the lines are what sell speed.
  const dash = 3;
  for (let z = -D / 2 + dash; z < D / 2; z += dash * 3) g.add(box(0.14, 0.022, dash, paint(3.2), 0, 0.012, z));
  for (const sx of [-1, 1]) g.add(box(0.12, 0.022, D, paint(3.2), sx * (W / 2 - 0.3), 0.012, 0));
  return g;
}

function tree(o: BlockObject, paint: Paint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  const r = rng(o.id);
  g.add(cyl(W * 0.05, W * 0.08, H * 0.45, paint(0.55), 0, H * 0.225, 0, 9));
  // A tapering canopy of soft clumps, widest low and coming to a rounded top.
  const rows = [
    { y: 0.4, rad: 0.42, n: 8, s: 0.2 },
    { y: 0.52, rad: 0.38, n: 7, s: 0.2 },
    { y: 0.65, rad: 0.3, n: 6, s: 0.18 },
    { y: 0.78, rad: 0.2, n: 4, s: 0.16 },
  ];
  g.add(blob(W * 0.34, paint(0.92), 0, H * 0.6, 0, 1, 1.35, 1));
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const a = (i / row.n) * Math.PI * 2 + r() * 0.6;
      const k = W * row.rad * (0.7 + r() * 0.2);
      g.add(blob(W * row.s * (0.85 + r() * 0.3), paint(0.9 + r() * 0.2), Math.cos(a) * k, H * (row.y + (r() - 0.5) * 0.05), Math.sin(a) * k));
    }
  }
  g.add(blob(W * 0.18, paint(1.05), 0, H * 0.9, 0));
  return g;
}

function stairs(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(H / 0.18));
  for (let i = 0; i < n; i++) {
    const h = (H / n) * (i + 1);
    g.add(box(W, h, D / n, paint(i % 2 ? 0.95 : 1), 0, h / 2, D / 2 - (D / n) * (i + 0.5)));
  }
  return g;
}

function door(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const gap = 0.9;
  const side = Math.max(0.05, (W - gap) / 2);
  for (const sx of [-1, 1]) g.add(box(side, H, D, paint(1), sx * (gap / 2 + side / 2), H / 2, 0));
  g.add(box(gap, H - 2.1, D, paint(1), 0, 2.1 + (H - 2.1) / 2, 0));
  return g;
}

function lamppost(o: BlockObject, paint: Paint) {
  const [, H, D] = o.size;
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.07, 0.1, H, 8), paint(1), 0, H / 2, 0));
  g.add(box(0.08, 0.08, D, paint(1), 0, H, D / 2));
  g.add(box(0.3, 0.12, 0.5, paint(1.8), 0, H - 0.08, D));
  return g;
}

function ramp(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const s = new THREE.Shape();
  s.moveTo(-D / 2, 0);
  s.lineTo(D / 2, 0);
  s.lineTo(D / 2, H);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false });
  geo.translate(0, 0, -W / 2);
  geo.rotateY(-Math.PI / 2);
  const g = new THREE.Group();
  g.add(part(geo, paint(1)));
  return g;
}

/* ---------- everyday pieces: streets, buildings, plants, rooms ---------- */

/** A second colour on one object (a traffic light's lamps, a flower's bloom). */
type Tint = (hex: string, k?: number) => THREE.Material;

const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 12) =>
  part(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
const blob = (r: number, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
  const b = part(new THREE.IcosahedronGeometry(r, 2), m, x, y, z);
  b.scale.set(sx, sy, sz);
  return b;
};
/** A seeded random from an object's id, so a shape is the same on every load. */
function rng(id: string) {
  let seed = 7;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}
/** A prism along X: a gable roof. */
function gable(w: number, h: number, d: number, m: THREE.Material, y: number) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(d / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  geo.translate(0, 0, -w / 2);
  geo.rotateY(Math.PI / 2);
  return part(geo, m, 0, y, 0);
}

function sidewalk(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  g.add(box(W - 0.2, H, D, paint(1), -0.1, H / 2, 0));
  g.add(box(0.2, H + 0.02, D, paint(0.82), W / 2 - 0.1, (H + 0.02) / 2, 0));
  // Joints between slabs, so the ground reads as paving and gives speed.
  for (let z = -D / 2 + 1.5; z < D / 2; z += 1.5) g.add(box(W - 0.2, 0.004, 0.03, paint(0.8), -0.1, H + 0.002, z));
  return g;
}

function crosswalk(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const bar = 0.5;
  for (let x = -W / 2 + bar / 2 + 0.2; x < W / 2 - 0.2; x += bar * 2) g.add(box(bar, H, D, paint(3.4), x, H / 2, 0));
  return g;
}

function parking(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  g.add(box(W, H, D, paint(1), 0, H / 2, 0));
  const bay = 2.6;
  const len = Math.min(5, D / 3);
  for (const sz of [-1, 1]) {
    for (let x = -W / 2 + 0.3; x <= W / 2 - 0.3; x += bay) g.add(box(0.12, 0.004, len, paint(3.2), x, H + 0.002, sz * (D / 2 - len / 2 - 0.3)));
  }
  return g;
}

function flat(o: BlockObject, paint: Paint, round = false) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  if (round) {
    const m = cyl(0.5, 0.5, 1, paint(1), 0, 0, 0, 28);
    m.scale.set(W, H, D);
    m.position.y = H / 2;
    m.castShadow = false;
    g.add(m);
  } else {
    const m = box(W, H, D, paint(1), 0, H / 2, 0);
    m.castShadow = false;
    g.add(m);
  }
  return g;
}

function oak(o: BlockObject, paint: Paint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  const r = rng(o.id);
  g.add(cyl(W * 0.05, W * 0.07, H * 0.5, paint(0.5), 0, H * 0.25, 0, 7));
  const c = W * 0.32;
  // A cloud of clumps: a core, a ring round its widest point, a few on top.
  // The clumps are what catch light and shade, which is what reads as leaves.
  g.add(blob(c, paint(1), 0, H * 0.68, 0, 1.15, 0.9, 1.15));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r() * 0.5;
    const k = W * (0.28 + r() * 0.08);
    g.add(blob(c * (0.38 + r() * 0.16), paint(0.88 + r() * 0.22), Math.cos(a) * k, H * (0.55 + r() * 0.14), Math.sin(a) * k));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r();
    const k = W * (0.12 + r() * 0.08);
    g.add(blob(c * (0.34 + r() * 0.14), paint(0.95 + r() * 0.2), Math.cos(a) * k, H * (0.78 + r() * 0.08), Math.sin(a) * k));
  }
  return g;
}

function pine(o: BlockObject, paint: Paint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  g.add(cyl(W * 0.04, W * 0.06, H * 0.3, paint(0.5), 0, H * 0.15, 0, 6));
  for (let i = 0; i < 4; i++) {
    const w = W * (0.5 - i * 0.1);
    const h = H * 0.32;
    g.add(part(new THREE.ConeGeometry(w, h, 8), paint(1 - i * 0.04), 0, H * 0.25 + i * H * 0.17 + h / 2, 0));
  }
  return g;
}

function palm(o: BlockObject, paint: Paint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  // A trunk that leans and curves, in four segments.
  const segs = 5;
  let x = 0;
  let y = 0;
  for (let i = 0; i < segs; i++) {
    const h = (H * 0.92) / segs;
    const lean = 0.05 + i * 0.05;
    const s = cyl(W * 0.04, W * 0.05, h, paint(0.55), x + Math.sin(lean) * h / 2, y + h / 2, 0, 7);
    s.rotation.z = -lean;
    g.add(s);
    x += Math.sin(lean) * h;
    y += Math.cos(lean) * h;
  }
  const r = rng(o.id);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + r() * 0.3;
    const len = W * 0.45;
    const f = box(len, 0.04, 0.32, paint(1 + (r() - 0.5) * 0.2));
    f.geometry.translate(len / 2, 0, 0);
    f.position.set(x, y, 0);
    f.rotation.set(0, a, -0.45 - r() * 0.25, "YXZ");
    g.add(f);
  }
  g.add(blob(W * 0.07, paint(0.6), x, y - 0.05, 0));
  return g;
}

function bush(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const r = rng(o.id);
  g.add(blob(0.5, paint(1), 0, H * 0.5, 0, W * 0.9, H, D * 0.9));
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    g.add(blob(0.5, paint(0.9 + r() * 0.2), Math.cos(a) * W * 0.22, H * 0.4, Math.sin(a) * D * 0.22, W * 0.6, H * 0.75, D * 0.6));
  }
  return g;
}

function flowers(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const soil = H * 0.35;
  g.add(box(W, soil, D, tint("#6e5644"), 0, soil / 2, 0));
  const r = rng(o.id);
  const leaf = tint("#5f8a4a");
  const n = Math.max(6, Math.round(W * D * 8));
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * (W - 0.15);
    const z = (r() - 0.5) * (D - 0.15);
    const h = H * (0.45 + r() * 0.5);
    g.add(cyl(0.012, 0.012, h - soil, leaf, x, soil + (h - soil) / 2, z, 4));
    g.add(blob(0.06, paint(0.85 + r() * 0.4), x, h, z));
  }
  return g;
}

function grassClump(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const r = rng(o.id);
  for (let i = 0; i < 14; i++) {
    const h = H * (0.5 + r() * 0.5);
    const c = part(new THREE.ConeGeometry(0.06, h, 4), paint(0.85 + r() * 0.3), (r() - 0.5) * W * 0.8, h / 2, (r() - 0.5) * D * 0.8);
    c.rotation.set((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
    g.add(c);
  }
  return g;
}

function cactus(o: BlockObject, paint: Paint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  const r = W * 0.16;
  g.add(part(new THREE.CapsuleGeometry(r, H - 2 * r, 4, 10), paint(1), 0, H / 2, 0));
  for (const [sx, y0, h] of [[-1, 0.35, 0.35], [1, 0.5, 0.3]] as const) {
    const ax = sx * W * 0.36;
    g.add(box(Math.abs(ax), r * 1.4, r * 1.4, paint(0.95), ax / 2, H * y0, 0));
    g.add(part(new THREE.CapsuleGeometry(r * 0.8, H * h, 4, 8), paint(0.95), ax, H * y0 + H * h / 2, 0));
  }
  return g;
}

function log(o: BlockObject, paint: Paint) {
  const [W, , D] = o.size;
  const g = new THREE.Group();
  const m = cyl(W / 2, W / 2, D, paint(1), 0, W / 2, 0, 10);
  m.rotation.x = Math.PI / 2;
  g.add(m);
  return g;
}

function house(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const wall = H * 0.58;
  g.add(box(W, wall, D, paint(1), 0, wall / 2, 0));
  g.add(gable(W + 0.4, H - wall, D + 0.6, tint("#7a5a4a"), wall));
  const glass = tint("#46505c");
  g.add(box(1, 2.1, 0.06, paint(0.55), 0, 1.05, D / 2 + 0.02));
  for (const sx of [-1, 1]) {
    g.add(box(1.3, 1.2, 0.05, glass, sx * W * 0.28, 1.5, D / 2 + 0.02));
    if (wall > 4.5) g.add(box(1.3, 1.1, 0.05, glass, sx * W * 0.28, wall - 1.3, D / 2 + 0.02));
  }
  return g;
}

function shopfront(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  g.add(box(W, H, D, paint(1), 0, H / 2, 0));
  const glassH = Math.min(2.8, H * 0.6);
  g.add(box(W * 0.84, glassH, 0.06, tint("#46505c"), 0, 0.2 + glassH / 2, D / 2 + 0.02));
  g.add(box(W * 0.84, 0.6, 0.08, paint(0.6), 0, glassH + 0.6, D / 2 + 0.04));
  const aw = box(W * 0.9, 0.06, 1.2, tint("#b5523f"), 0, glassH + 0.25, D / 2 + 0.6);
  aw.rotation.x = 0.35;
  g.add(aw);
  return g;
}

function garage(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  g.add(box(W, H, D, paint(1), 0, H / 2, 0));
  g.add(box(W * 0.75, H * 0.72, 0.05, paint(0.75), 0, (H * 0.72) / 2, D / 2 + 0.02));
  for (let i = 1; i < 6; i++) g.add(box(W * 0.75, 0.02, 0.06, paint(0.6), 0, (H * 0.72 * i) / 6, D / 2 + 0.03));
  return g;
}

function warehouse(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const wall = H * 0.8;
  g.add(box(W, wall, D, paint(1), 0, wall / 2, 0));
  g.add(gable(W, H - wall, D, paint(0.8), wall));
  for (let i = 0; i < 3; i++) g.add(box(3.5, 4, 0.06, paint(0.6), -W / 3 + (i * W) / 3, 2, D / 2 + 0.02));
  return g;
}

function fence(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  for (const y of [H * 0.3, H * 0.75]) g.add(box(W, 0.08, D * 0.6, paint(0.9), 0, y, -D * 0.4));
  const n = Math.max(2, Math.round(W / 0.15));
  for (let i = 0; i <= n; i++) g.add(box(0.08, H, D, paint(1), -W / 2 + (i * W) / n, H / 2, 0));
  return g;
}

function trafficLight(o: BlockObject, paint: Paint, tint: Tint) {
  const [, H] = o.size;
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.08, H, paint(1), 0, H / 2, 0, 8));
  const hy = H - 0.55;
  g.add(box(0.32, 0.95, 0.28, paint(0.7), 0, hy, 0.18));
  for (const [i, c] of (["#d9534f", "#e5a93b", "#4caf6a"] as const).entries()) g.add(cyl(0.09, 0.09, 0.04, tint(c, 1.2), 0, hy + 0.3 - i * 0.3, 0.33, 12).rotateX(Math.PI / 2));
  return g;
}

function signPost(o: BlockObject, paint: Paint, tint: Tint, octagon: boolean) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  g.add(cyl(0.035, 0.035, H, tint("#8a8d92"), 0, H / 2, 0, 6));
  if (octagon) {
    const s = cyl(W / 2, W / 2, 0.04, paint(1), 0, H - W / 2, 0.04, 8).rotateX(Math.PI / 2);
    s.rotation.y = Math.PI / 8;
    g.add(s);
  } else g.add(box(W, 0.22, 0.04, paint(1), 0, H - 0.15, 0.04));
  return g;
}

function busStop(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  g.add(box(W, 0.08, D, paint(1), 0, H - 0.04, 0));
  g.add(box(W, H - 0.3, 0.04, tint("#9fb4c2"), 0, (H - 0.3) / 2 + 0.2, -D / 2 + 0.05));
  for (const sx of [-1, 1]) {
    g.add(box(0.06, H, 0.06, paint(0.7), sx * (W / 2 - 0.05), H / 2, -D / 2 + 0.05));
    g.add(box(0.04, H - 0.3, D * 0.7, tint("#9fb4c2"), sx * (W / 2 - 0.05), (H - 0.3) / 2 + 0.2, -D * 0.12));
  }
  g.add(box(W * 0.6, 0.06, 0.4, paint(0.6), 0, 0.46, -D / 2 + 0.3));
  return g;
}

function bench(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const seatY = 0.45;
  for (let i = 0; i < 3; i++) g.add(box(W, 0.04, D * 0.22, paint(1), 0, seatY, D * 0.3 - i * D * 0.25));
  for (let i = 0; i < 2; i++) g.add(box(W, 0.1, 0.04, paint(1), 0, seatY + 0.16 + i * 0.16, -D * 0.38));
  const iron = tint("#45484e");
  for (const sx of [-1, 1]) {
    g.add(box(0.05, seatY, D * 0.75, iron, sx * (W / 2 - 0.15), seatY / 2, 0));
    g.add(box(0.05, H - seatY, 0.05, iron, sx * (W / 2 - 0.15), seatY + (H - seatY) / 2, -D * 0.4));
  }
  return g;
}

function hydrant(o: BlockObject, paint: Paint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  g.add(cyl(W * 0.36, W * 0.4, H * 0.75, paint(1), 0, H * 0.375, 0, 12));
  g.add(part(new THREE.SphereGeometry(W * 0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint(1), 0, H * 0.75, 0));
  g.add(cyl(0.04, 0.04, 0.08, paint(0.9), 0, H * 0.98, 0, 6));
  for (const sx of [-1, 1]) g.add(cyl(W * 0.12, W * 0.12, W * 0.3, paint(0.9), sx * W * 0.45, H * 0.55, 0, 8).rotateZ(Math.PI / 2));
  g.add(cyl(W * 0.15, W * 0.15, W * 0.3, paint(0.9), 0, H * 0.5, W * 0.45, 8).rotateX(Math.PI / 2));
  return g;
}

function mailbox(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const body = H * 0.7;
  g.add(box(W, body, D, paint(1), 0, H - body / 2 - W / 4, 0));
  const top = cyl(W / 2, W / 2, D, paint(1), 0, H - W / 4, 0, 14).rotateX(Math.PI / 2);
  top.scale.set(1, 1, 0.5);
  g.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.05, H - body - W / 4, 0.05, paint(0.6), sx * (W / 2 - 0.05), (H - body - W / 4) / 2, sz * (D / 2 - 0.05)));
  g.add(box(W * 0.6, 0.04, 0.02, paint(0.5), 0, H - 0.4, D / 2 + 0.01));
  return g;
}

function meter(o: BlockObject, paint: Paint) {
  const [, H] = o.size;
  const g = new THREE.Group();
  g.add(cyl(0.035, 0.035, H - 0.3, paint(1), 0, (H - 0.3) / 2, 0, 6));
  g.add(box(0.2, 0.3, 0.16, paint(0.8), 0, H - 0.15, 0));
  g.add(box(0.12, 0.08, 0.02, paint(1.8), 0, H - 0.1, 0.09));
  return g;
}

function cone(o: BlockObject, paint: Paint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  g.add(box(W, 0.04, W, paint(0.7), 0, 0.02, 0));
  g.add(part(new THREE.ConeGeometry(W * 0.33, H - 0.04, 12), paint(1), 0, 0.04 + (H - 0.04) / 2, 0));
  g.add(cyl(W * 0.2, W * 0.24, H * 0.12, paint(2.4), 0, H * 0.55, 0, 12));
  return g;
}

function barrier(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = box(0.05, H, 0.05, paint(0.6), sx * (W / 2 - 0.1), H / 2, sz * D * 0.25);
    leg.rotation.x = -sz * 0.25;
    g.add(leg);
  }
  const n = 6;
  for (let i = 0; i < n; i++) g.add(box(W / n, 0.25, 0.03, paint(i % 2 ? 0.35 : 1.15), -W / 2 + (W / n) * (i + 0.5), H - 0.2, 0));
  return g;
}

function utilityPole(o: BlockObject, paint: Paint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  g.add(cyl(0.13, 0.17, H, paint(1), 0, H / 2, 0, 8));
  for (const y of [H - 0.4, H - 1.2]) {
    g.add(box(W, 0.1, 0.1, paint(0.8), 0, y, 0));
    for (const x of [-W * 0.4, -W * 0.15, W * 0.15, W * 0.4]) g.add(cyl(0.04, 0.04, 0.14, paint(1.6), x, y + 0.12, 0, 6));
  }
  return g;
}

function billboard(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const bh = H * 0.42;
  for (const sx of [-1, 1]) g.add(box(0.3, H - bh, 0.3, tint("#6c6f75"), sx * W * 0.28, (H - bh) / 2, 0));
  g.add(box(W, bh, D * 0.5, paint(1), 0, H - bh / 2, 0));
  g.add(box(W * 0.9, 0.08, 0.6, tint("#6c6f75"), 0, H - bh - 0.1, 0.3));
  return g;
}

function bicycle(o: BlockObject, paint: Paint, tint: Tint) {
  const [, H, D] = o.size;
  const g = new THREE.Group();
  const r = H * 0.33;
  const rubber = tint("#2a2c30");
  const geo = new THREE.TorusGeometry(r, 0.025, 6, 22);
  geo.rotateY(Math.PI / 2);
  const back = -D / 2 + r;
  const front = D / 2 - r;
  for (const z of [back, front]) g.add(part(geo, rubber, 0, r, z));
  const bar = (a: THREE.Vector3, b: THREE.Vector3) => {
    const m = capsuleMesh(0.022, a.distanceTo(b), paint(1));
    spanLimb(m, a, b);
    g.add(m);
  };
  const crank = new THREE.Vector3(0, r, -0.05);
  const seat = new THREE.Vector3(0, H * 0.82, back + 0.35);
  const head = new THREE.Vector3(0, H * 0.85, front - 0.15);
  bar(new THREE.Vector3(0, r, back), crank);
  bar(new THREE.Vector3(0, r, back), seat);
  bar(crank, seat);
  bar(crank, head);
  bar(seat, head);
  bar(head, new THREE.Vector3(0, r, front));
  g.add(box(0.12, 0.04, 0.25, rubber, 0, seat.y + 0.04, seat.z));
  g.add(box(0.5, 0.03, 0.03, rubber, 0, H, head.z + 0.05));
  return g;
}

function picnic(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  g.add(box(W, 0.05, D * 0.45, paint(1), 0, H - 0.025, 0));
  for (const sz of [-1, 1]) g.add(box(W, 0.05, D * 0.18, paint(1), 0, 0.45, sz * D * 0.4));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = box(0.06, H * 1.05, 0.08, paint(0.8), sx * (W / 2 - 0.25), H / 2, sz * D * 0.2);
    leg.rotation.x = sz * 0.5;
    g.add(leg);
  }
  return g;
}

function parasol(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  const wood = tint("#8a6a4d");
  g.add(cyl(0.4, 0.4, 0.04, wood, 0, 0.74, 0, 16));
  g.add(cyl(0.05, 0.25, 0.72, wood, 0, 0.36, 0, 8));
  g.add(cyl(0.025, 0.025, H, tint("#d0ccc4"), 0, H / 2, 0, 6));
  g.add(part(new THREE.ConeGeometry(W / 2, 0.45, 8), paint(1), 0, H - 0.22, 0));
  for (const a of [0, Math.PI]) {
    const c = new THREE.Group();
    c.add(box(0.42, 0.04, 0.42, wood, 0, 0.45, 0));
    c.add(box(0.42, 0.42, 0.04, wood, 0, 0.66, -0.2));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.add(box(0.03, 0.45, 0.03, wood, sx * 0.18, 0.225, sz * 0.18));
    c.position.set(Math.sin(a) * 0.75, 0, Math.cos(a) * 0.75);
    c.rotation.y = a + Math.PI;
    g.add(c);
  }
  return g;
}

function planter(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const bh = H * 0.45;
  g.add(box(W, bh, D, paint(1), 0, bh / 2, 0));
  g.add(blob(0.5, tint("#62844a"), 0, bh + (H - bh) * 0.45, 0, W * 0.85, (H - bh) * 1.05, D * 0.85));
  return g;
}

function fountain(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  const water = tint("#5e93b0");
  g.add(cyl(W / 2, W / 2, 0.5, paint(1), 0, 0.25, 0, 24));
  g.add(cyl(W / 2 - 0.15, W / 2 - 0.15, 0.02, water, 0, 0.51, 0, 24));
  g.add(cyl(0.18, 0.25, H - 0.5, paint(0.9), 0, 0.5 + (H - 0.5) / 2, 0, 10));
  g.add(cyl(W * 0.2, W * 0.1, 0.2, paint(1), 0, H - 0.25, 0, 16));
  g.add(cyl(W * 0.18, W * 0.18, 0.03, water, 0, H - 0.15, 0, 16));
  return g;
}

function vending(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  g.add(box(W, H, D, paint(1), 0, H / 2, 0));
  g.add(box(W * 0.62, H * 0.62, 0.04, tint("#46505c"), -W * 0.12, H * 0.6, D / 2 + 0.02));
  g.add(box(W * 0.2, H * 0.3, 0.04, paint(0.6), W * 0.32, H * 0.62, D / 2 + 0.02));
  g.add(box(W * 0.62, 0.18, 0.05, paint(0.4), -W * 0.12, 0.35, D / 2 + 0.02));
  return g;
}

function windowWall(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const ow = Math.min(1.5, W - 0.6);
  const sill = 0.9;
  const head = Math.min(2.2, H - 0.3);
  const side = (W - ow) / 2;
  for (const sx of [-1, 1]) g.add(box(side, H, D, paint(1), sx * (ow / 2 + side / 2), H / 2, 0));
  g.add(box(ow, sill, D, paint(1), 0, sill / 2, 0));
  g.add(box(ow, H - head, D, paint(1), 0, head + (H - head) / 2, 0));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(ow, head - sill, 0.02), tint("#a9c4d4"));
  glass.position.set(0, (sill + head) / 2, 0);
  const gm = (glass.material as THREE.Material).clone();
  gm.transparent = true;
  gm.opacity = 0.35;
  glass.material = gm;
  glass.castShadow = false;
  g.add(glass);
  g.add(box(0.05, head - sill, D + 0.02, paint(0.7), 0, (sill + head) / 2, 0));
  return g;
}

function chair(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const seat = 0.46;
  g.add(box(W, 0.05, D, paint(1), 0, seat, 0));
  g.add(box(W, H - seat, 0.04, paint(1), 0, seat + (H - seat) / 2, -D / 2 + 0.02));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.04, seat, 0.04, paint(0.8), sx * (W / 2 - 0.03), seat / 2, sz * (D / 2 - 0.03)));
  return g;
}

function stool(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  g.add(cyl(W * 0.5, W * 0.5, 0.06, tint("#8a6a4d"), 0, H - 0.03, 0, 16));
  g.add(cyl(0.03, 0.03, H - 0.06, paint(1), 0, (H - 0.06) / 2, 0, 8));
  g.add(cyl(W * 0.42, W * 0.45, 0.03, paint(1), 0, 0.015, 0, 16));
  g.add(part(new THREE.TorusGeometry(W * 0.35, 0.012, 6, 18).rotateX(Math.PI / 2), paint(1), 0, H * 0.35, 0));
  return g;
}

function desk(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  g.add(box(W, 0.04, D, paint(1), 0, H - 0.02, 0));
  const pw = W * 0.3;
  g.add(box(pw, H - 0.04, D * 0.95, paint(0.85), W / 2 - pw / 2, (H - 0.04) / 2, 0));
  for (let i = 1; i < 3; i++) g.add(box(pw * 0.9, 0.01, 0.01, paint(0.6), W / 2 - pw / 2, ((H - 0.04) * i) / 3, D * 0.48));
  for (const sz of [-1, 1]) g.add(box(0.05, H - 0.04, 0.05, paint(0.85), -W / 2 + 0.04, (H - 0.04) / 2, sz * (D / 2 - 0.04)));
  return g;
}

function fridge(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  g.add(box(W, H, D, paint(1), 0, H / 2, 0));
  g.add(box(W, 0.015, 0.02, paint(0.7), 0, H * 0.66, D / 2 + 0.005));
  for (const [y0, h] of [[H * 0.72, 0.35], [H * 0.3, 0.45]]) g.add(box(0.03, h, 0.04, paint(0.6), W / 2 - 0.08, y0, D / 2 + 0.03));
  return g;
}

function dresser(o: BlockObject, paint: Paint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  g.add(box(W, H - 0.08, D, paint(1), 0, 0.08 + (H - 0.08) / 2, 0));
  const rows = 3;
  for (let i = 0; i < rows; i++) {
    const y = 0.08 + ((H - 0.08) * (i + 0.5)) / rows;
    g.add(box(W * 0.9, (H - 0.08) / rows - 0.04, 0.02, paint(0.92), 0, y, D / 2 + 0.01));
    g.add(box(0.12, 0.02, 0.03, paint(0.55), 0, y, D / 2 + 0.03));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.04, 0.08, 0.04, paint(0.7), sx * (W / 2 - 0.04), 0.04, sz * (D / 2 - 0.04)));
  return g;
}

function bookshelf(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const t = 0.03;
  for (const sx of [-1, 1]) g.add(box(t, H, D, paint(1), sx * (W / 2 - t / 2), H / 2, 0));
  g.add(box(W, H, 0.01, paint(0.85), 0, H / 2, -D / 2 + 0.005));
  const shelves = Math.max(3, Math.round(H / 0.38));
  const r = rng(o.id);
  const books = ["#7a5a4a", "#4f6b8a", "#8a4f4f", "#5f7a52", "#c9b98f"];
  for (let i = 0; i <= shelves; i++) {
    const y = (H * i) / shelves;
    g.add(box(W - 2 * t, t, D, paint(1), 0, Math.min(H - t / 2, y + t / 2), 0));
    if (i === shelves) break;
    let x = -W / 2 + t + 0.02;
    while (x < W / 2 - t - 0.06) {
      const bw = 0.025 + r() * 0.035;
      const bh = (H / shelves) * (0.55 + r() * 0.3);
      if (r() > 0.12) g.add(box(bw, bh, D * 0.75, tint(books[Math.floor(r() * books.length)]), x + bw / 2, y + t + bh / 2, 0));
      x += bw + 0.004;
    }
  }
  return g;
}

function tvStand(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  // The screen is always 16:9 off the width, whatever height was given, so a
  // short or thin size never squashes it into a sliver; the media unit takes
  // what height is left, within the range real ones come in.
  const sw = W * 0.8;
  const sh = sw * 0.5625;
  const unit = Math.min(0.6, Math.max(0.35, H - sh - 0.1));
  const ud = Math.max(0.35, D);
  g.add(box(W, unit, ud, tint("#8f7458"), 0, unit / 2, 0));
  g.add(box(0.3, 0.04, 0.2, paint(1), 0, unit + 0.02, 0));
  g.add(box(0.05, 0.06, 0.05, paint(1), 0, unit + 0.07, 0));
  g.add(box(sw, sh, 0.05, paint(1), 0, unit + 0.1 + sh / 2, 0));
  // The glass reads as a screen rather than a black slab: a cool grey that
  // stays a screen in clay and blockout alike.
  g.add(box(sw - 0.05, sh - 0.05, 0.01, tint("#4b5a6b"), 0, unit + 0.1 + sh / 2, 0.026));
  return g;
}

function floorLamp(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  const metal = tint("#55585e");
  g.add(cyl(W * 0.4, W * 0.45, 0.03, metal, 0, 0.015, 0, 16));
  g.add(cyl(0.015, 0.015, H - 0.3, metal, 0, (H - 0.3) / 2, 0, 6));
  g.add(cyl(W * 0.3, W * 0.5, 0.35, paint(1.15), 0, H - 0.175, 0, 16));
  return g;
}

function pottedPlant(o: BlockObject, paint: Paint, tint: Tint) {
  const [W, H] = o.size;
  const g = new THREE.Group();
  const pot = H * 0.35;
  g.add(cyl(W * 0.4, W * 0.3, pot, tint("#b0745a"), 0, pot / 2, 0, 12));
  const r = rng(o.id);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r();
    const len = (H - pot) * (0.7 + r() * 0.35);
    const leaf = box(0.07, len, 0.02, paint(0.85 + r() * 0.3));
    leaf.geometry.translate(0, len / 2, 0);
    leaf.position.set(0, pot, 0);
    leaf.rotation.set(0.35 + r() * 0.3, a, 0, "YXZ");
    g.add(leaf);
  }
  return g;
}

/** An object's own geometry, in its own frame. */
export function buildObject(o: BlockObject, look: Look): THREE.Group {
  const paint = painter(look, o.color);
  const tints = new Map<string, Paint>();
  const tint: Tint = (hex, k = 1) => {
    let p = tints.get(hex);
    if (!p) { p = painter(look, hex); tints.set(hex, p); }
    return p(k);
  };
  const [W, H, D] = o.size;
  let g: THREE.Group;
  switch (o.kind) {
    case "person": case "child": g = person(o, paint, tint); break;
    case "dog": g = dog(o, paint); break;
    case "car": g = vehicle(o, paint, { cab: 0.48, cabStart: 0.28, rows: 2 }); break;
    case "suv": g = vehicle(o, paint, { cab: 0.66, cabStart: 0.22, rows: o.seats === "three" ? 3 : 2, cargo: true, tall: false }); break;
    case "van": g = vehicle(o, paint, { cab: 0.8, cabStart: 0.12, rows: 1, cargo: true, tall: true }); break;
    case "truck": g = vehicle(o, paint, { cab: 0.38, cabStart: 0.24, rows: 2, bed: true }); break;
    case "bus": g = bus(o, paint, tint); break;
    case "tram": g = tram(o, paint, tint); break;
    case "rails": g = rails(o, paint, tint); break;
    case "bike": g = bike(o, paint); break;
    case "road": g = road(o, paint); break;
    case "hill": g = hill(o, paint, false); break;
    case "mountain": g = hill(o, paint, true); break;
    case "sea": {
      g = new THREE.Group();
      const m = part(new THREE.PlaneGeometry(W, D), paint(1));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.02;
      m.castShadow = false;
      g.add(m);
      break;
    }
    case "building": g = building(o, paint); break;
    case "tree": g = tree(o, paint); break;
    case "rock": {
      g = new THREE.Group();
      const m = part(new THREE.DodecahedronGeometry(0.5, 0), paint(1));
      m.scale.set(W, H, D);
      m.position.y = H * 0.4;
      g.add(m);
      break;
    }
    case "lamppost": g = lamppost(o, paint); break;
    case "sidewalk": g = sidewalk(o, paint); break;
    case "crosswalk": g = crosswalk(o, paint); break;
    case "parking": g = parking(o, paint); break;
    case "lawn": case "path": case "rug": g = flat(o, paint); break;
    case "pond": g = flat(o, paint, true); break;
    case "oak": g = oak(o, paint); break;
    case "pine": g = pine(o, paint); break;
    case "palm": g = palm(o, paint); break;
    case "bush": g = bush(o, paint); break;
    case "hedge": {
      g = new THREE.Group();
      g.add(box(W, H, D, paint(1), 0, H / 2, 0));
      g.add(box(W * 0.98, 0.06, D * 0.9, paint(1.08), 0, H + 0.02, 0));
      break;
    }
    case "flowers": g = flowers(o, paint, tint); break;
    case "grass": g = grassClump(o, paint); break;
    case "cactus": g = cactus(o, paint); break;
    case "log": g = log(o, paint); break;
    case "skyscraper": g = building(o, paint); break;
    case "house": g = house(o, paint, tint); break;
    case "shopfront": g = shopfront(o, paint, tint); break;
    case "garage": g = garage(o, paint); break;
    case "warehouse": g = warehouse(o, paint); break;
    case "fence": g = fence(o, paint); break;
    case "lowwall": {
      g = new THREE.Group();
      g.add(box(W, H, D, paint(1), 0, H / 2, 0));
      g.add(box(W + 0.04, 0.06, D + 0.06, paint(0.85), 0, H + 0.03, 0));
      break;
    }
    case "trafficlight": g = trafficLight(o, paint, tint); break;
    case "stopsign": g = signPost(o, paint, tint, true); break;
    case "sign": g = signPost(o, paint, tint, false); break;
    case "busstop": g = busStop(o, paint, tint); break;
    case "bench": g = bench(o, paint, tint); break;
    case "bin": {
      g = new THREE.Group();
      g.add(cyl(W / 2, W * 0.45, H, paint(1), 0, H / 2, 0, 14));
      g.add(cyl(W * 0.52, W * 0.52, 0.05, paint(0.8), 0, H + 0.02, 0, 14));
      break;
    }
    case "dumpster": {
      g = new THREE.Group();
      g.add(box(W, H * 0.9, D, paint(1), 0, H * 0.45 + 0.1, 0));
      const lid = box(W, 0.05, D * 1.04, paint(0.8), 0, H, 0);
      lid.rotation.x = -0.08;
      g.add(lid);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.06, 0.06, 0.1, paint(0.4), sx * (W / 2 - 0.15), 0.05, sz * (D / 2 - 0.15), 8));
      break;
    }
    case "hydrant": g = hydrant(o, paint); break;
    case "mailbox": g = mailbox(o, paint); break;
    case "bollard": {
      g = new THREE.Group();
      g.add(cyl(W / 2, W / 2, H, paint(1), 0, H / 2, 0, 12));
      g.add(cyl(W / 2 + 0.005, W / 2 + 0.005, 0.06, paint(2.2), 0, H * 0.82, 0, 12));
      break;
    }
    case "meter": g = meter(o, paint); break;
    case "cone": g = cone(o, paint); break;
    case "barrier": g = barrier(o, paint); break;
    case "pole": g = utilityPole(o, paint); break;
    case "billboard": g = billboard(o, paint, tint); break;
    case "bicycle": g = bicycle(o, paint, tint); break;
    case "picnic": g = picnic(o, paint); break;
    case "parasol": g = parasol(o, paint, tint); break;
    case "planter": g = planter(o, paint, tint); break;
    case "fountain": g = fountain(o, paint, tint); break;
    case "vending": g = vending(o, paint, tint); break;
    case "window": g = windowWall(o, paint, tint); break;
    case "chair": g = chair(o, paint); break;
    case "stool": g = stool(o, paint, tint); break;
    case "desk": g = desk(o, paint); break;
    case "fridge": g = fridge(o, paint); break;
    case "cabinet": g = dresser(o, paint); break;
    case "bookshelf": g = bookshelf(o, paint, tint); break;
    case "tv": g = tvStand(o, paint, tint); break;
    case "lamp": g = floorLamp(o, paint, tint); break;
    case "plant": g = pottedPlant(o, paint, tint); break;
    case "room": g = room(o, paint); break;
    case "door": g = door(o, paint); break;
    case "stairs": g = stairs(o, paint); break;
    case "cylinder": case "product": {
      g = new THREE.Group();
      g.add(part(new THREE.CylinderGeometry(W / 2, W / 2, H, o.kind === "product" ? 16 : 20), paint(1), 0, H / 2, 0));
      break;
    }
    case "sphere": {
      g = new THREE.Group();
      const m = part(new THREE.SphereGeometry(0.5, 20, 14), paint(1));
      m.scale.set(W, H, D);
      m.position.y = H / 2;
      g.add(m);
      break;
    }
    case "ramp": g = ramp(o, paint); break;
    case "target": {
      g = new THREE.Group();
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(W / 2, 0),
        new THREE.MeshBasicMaterial({ color: o.color, wireframe: true }),
      );
      m.position.y = H / 2;
      m.userData.helper = true;
      g.add(m);
      break;
    }
    case "table": case "coffeetable": {
      g = new THREE.Group();
      g.add(box(W, 0.05, D, paint(1), 0, H - 0.025, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.06, H - 0.05, 0.06, paint(0.8), sx * (W / 2 - 0.08), (H - 0.05) / 2, sz * (D / 2 - 0.08)));
      break;
    }
    case "sofa": case "armchair": {
      g = new THREE.Group();
      g.add(box(W, H * 0.5, D, paint(1), 0, H * 0.25, 0));
      g.add(box(W, H * 0.5, D * 0.25, paint(0.9), 0, H * 0.75, -D * 0.375));
      for (const sx of [-1, 1]) g.add(box(0.18, H * 0.75, D, paint(0.9), sx * (W / 2 - 0.09), H * 0.375, 0));
      break;
    }
    default: {
      g = new THREE.Group();
      g.add(box(W, H, D, paint(1), 0, H / 2, 0));
    }
  }
  g.name = o.id;
  g.userData.objectId = o.id;
  g.traverse((c) => (c.userData.objectId = o.id));
  return g;
}

/** The ground, sky and sun. */
export type World = {
  scene: THREE.Scene;
  ground: THREE.Mesh;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  objects: THREE.Group;
  helpers: THREE.Group;
};

const GROUND: Record<Environment["ground"], string> = {
  grass: "#7f925a", asphalt: "#4a4c50", sand: "#d4c29a", dirt: "#8c7354", snow: "#eef1f4",
  studio: "#6d7177", water: "#4a7d98", none: "#000000",
};

export function buildWorld(): World {
  const scene = new THREE.Scene();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2000, 64), new THREE.MeshLambertMaterial({ color: "#7f925a" }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.ground = true;
  scene.add(ground);
  const hemi = new THREE.HemisphereLight("#ffffff", "#6b6255", 1.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff4e6", 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  // A soft edge, as under a hazy sun rather than a hard noon.
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const objects = new THREE.Group();
  scene.add(objects);
  const helpers = new THREE.Group();
  scene.add(helpers);
  return { scene, ground, sun, hemi, objects, helpers };
}

export function applyEnvironment(w: World, env: Environment, look: Look) {
  const clay = look === "clay";
  // Clay sits in a pale, slightly cool sky so the warm forms read against it.
  const sky = new THREE.Color(clay ? "#dde1e4" : env.sky);
  w.scene.background = sky;
  w.scene.fog = env.haze > 0 ? new THREE.Fog(sky, 30 + (1 - env.haze) * 600, 120 + (1 - env.haze) * 1400) : null;
  w.ground.visible = env.ground !== "none";
  const gm = w.ground.material as THREE.MeshLambertMaterial;
  gm.color.set(clay ? "#d3cfc8" : GROUND[env.ground]);
  const az = rad(env.sunAz);
  const el = rad(env.sunEl);
  w.sun.position.set(Math.sin(az) * Math.cos(el) * 150, Math.sin(el) * 150, Math.cos(az) * Math.cos(el) * 150);
  // Every look casts shadows now: the shadow under a car and down a street is
  // what places things on the ground. Blockout keeps a strong sky light so a
  // subject's colour stays its colour, with a gentler sun than the others.
  w.sun.castShadow = true;
  if (clay) {
    w.hemi.color.set("#ffffff");
    w.hemi.groundColor.set("#b9b2a6");
    w.hemi.intensity = 1.15;
    w.sun.color.set("#fff1dc");
    w.sun.intensity = 2.9;
  } else if (look === "blockout") {
    w.hemi.color.set("#ffffff");
    w.hemi.groundColor.set("#8a8478");
    w.hemi.intensity = 1.95;
    w.sun.color.set("#fff4e6");
    w.sun.intensity = 1.4;
  } else {
    w.hemi.color.set("#ffffff");
    w.hemi.groundColor.set("#6b6255");
    w.hemi.intensity = 1.2;
    w.sun.color.set("#fff4e6");
    w.sun.intensity = 2.4;
  }
}

/** World transform of an object at time t, following any parents. */
/** An object's own transform from a position and yaw/pitch/roll. */
export function poseMatrix(p: Vec3, r: Vec3): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(r[1]), rad(r[0]), rad(r[2]), "YXZ")),
    new THREE.Vector3(1, 1, 1),
  );
}

export function objectMatrix(objs: Map<string, BlockObject>, id: string, t: number, depth = 0): THREE.Matrix4 {
  const o = objs.get(id);
  if (!o) return new THREE.Matrix4();
  const pose = evalTrack(o.keys, t);
  const m = poseMatrix(pose.p, pose.r);
  if (o.parent && depth < 8) return objectMatrix(objs, o.parent, t, depth + 1).multiply(m);
  return m;
}

/** A camera's world matrix from its own pose (yaw, pitch, roll) and an optional parent. */
export function cameraMatrix(p: Vec3, r: Vec3, parent: THREE.Matrix4 | null): THREE.Matrix4 {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(r[1]), rad(r[0]), rad(-r[2]), "YXZ")),
    new THREE.Vector3(1, 1, 1),
  );
  return parent ? parent.clone().multiply(m) : m;
}

/** Decompose a world matrix back into a position and yaw/pitch/roll in a parent's frame. */
export function toLocal(world: THREE.Matrix4, parent: THREE.Matrix4 | null, camera: boolean): { p: Vec3; r: Vec3 } {
  const local = parent ? parent.clone().invert().multiply(world) : world.clone();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  local.decompose(pos, q, new THREE.Vector3());
  const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
  const deg = (x: number) => (x * 180) / Math.PI;
  return { p: [pos.x, pos.y, pos.z], r: [deg(e.y), deg(e.x), camera ? -deg(e.z) : deg(e.z)] };
}

/** A small camera body with a frustum, drawn in the free view. */
export function cameraGizmo(color: string): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.3), m);
  body.position.z = 0.15;
  g.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12), m);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.05;
  g.add(lens);
  const frus = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color }));
  frus.name = "frustum";
  g.add(frus);
  g.userData.helper = true;
  g.traverse((c) => (c.userData.helper = true));
  return g;
}

export function setFrustum(g: THREE.Group, hfov: number, vfov: number, d = 1.6) {
  const f = g.getObjectByName("frustum") as THREE.LineSegments;
  const hx = Math.tan(rad(hfov / 2)) * d;
  const hy = Math.tan(rad(vfov / 2)) * d;
  const o = new THREE.Vector3(0, 0, -0.1);
  const c = [
    new THREE.Vector3(-hx, -hy, -d), new THREE.Vector3(hx, -hy, -d),
    new THREE.Vector3(hx, hy, -d), new THREE.Vector3(-hx, hy, -d),
  ];
  const up = [new THREE.Vector3(-hx * 0.3, hy * 1.1, -d), new THREE.Vector3(0, hy * 1.4, -d), new THREE.Vector3(hx * 0.3, hy * 1.1, -d)];
  f.geometry.dispose();
  f.geometry = new THREE.BufferGeometry().setFromPoints([
    o, c[0], o, c[1], o, c[2], o, c[3], c[0], c[1], c[1], c[2], c[2], c[3], c[3], c[0], up[0], up[1], up[1], up[2],
  ]);
}

/**
 * The point a camera kept aimed at an object looks at: a person's head (lower
 * when seated or kneeling, since a seated figure's origin is its seat), an
 * animal's head, the middle of anything else.
 */
export function aimPoint(objs: Map<string, BlockObject>, o: BlockObject, t: number): THREE.Vector3 {
  const h = o.size[1];
  const up =
    o.kind === "person" || o.kind === "child"
      ? h * (o.pose === "seated" ? 0.42 : o.pose === "kneeling" ? 0.62 : 0.92)
      : o.kind === "dog" ? h * 0.85 : h * 0.5;
  return new THREE.Vector3(0, up, 0).applyMatrix4(objectMatrix(objs, o.id, t));
}

/**
 * Aim markers (a Target's diamond) are for working in free view only: they
 * must never appear through the camera, in a recorded clip or a saved frame.
 */
export function showMarkers(world: World, on: boolean) {
  world.objects.traverse((o) => {
    if (o.userData.helper && (o as THREE.Mesh).isMesh) o.visible = on;
  });
}
