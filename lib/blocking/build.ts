// Shot blocking: drawing the scene in three.js. Every object is built in its
// own frame (origin on the ground at its centre, facing +Z) out of a handful of
// low-poly parts, the way a blockout is made: volumes and silhouettes, nothing
// a generation model would copy as detail.
//
// One material per object per look. "Blockout" is flat colour with flat
// shading, each subject its own colour, which is what lets a video model tell
// the subjects apart in a reference clip.
import * as THREE from "three";
import { hipY as poseHipY, poseDef, shoulderY as poseShoulderY, SHIN } from "@/lib/previz/poses";
import { gestureOf, type BlockObject, type Environment, type GestureKind, type Look, type Vec3 } from "./scene";
import { evalTrack } from "./keys";

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
    if (look === "clay") m = new THREE.MeshStandardMaterial({ color: shade("#b9b6b0", k), roughness: 0.9 });
    else if (look === "lit") m = new THREE.MeshStandardMaterial({ color: shade(color, k), roughness: 0.75 });
    else m = new THREE.MeshLambertMaterial({ color: shade(color, k), flatShading: true });
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

const SEAT_PITCH = 0.95;

/** A car-like body: lower hull, open cabin (pillars and a roof), seats, wheels. */
function vehicle(o: BlockObject, paint: Paint, opts: { cab: number; cabStart: number; rows: number; cargo?: boolean; bed?: boolean; tall?: boolean }) {
  const [W, H, D] = o.size;
  const g = new THREE.Group();
  const wheelR = Math.min(0.4, H * 0.24);
  const hullH = H * (opts.tall ? 0.62 : 0.46);
  const hullY = wheelR * 0.75;
  g.add(box(W, hullH - hullY + wheelR * 0.5, D, paint(1), 0, hullY + (hullH - hullY + wheelR * 0.5) / 2 - wheelR * 0.25, 0));
  // Cabin: four pillars and a roof, open sides, so a camera can pass through
  // a window the way the reference shots do.
  const cabD = D * opts.cab;
  const cabZ = D / 2 - D * opts.cabStart - cabD / 2;
  const cabH = H - hullH;
  const pillar = 0.08;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(pillar, cabH, pillar, paint(0.82), sx * (W / 2 - pillar / 2), hullH + cabH / 2, cabZ + sz * (cabD / 2 - pillar / 2)));
  }
  g.add(box(W, 0.07, cabD, paint(1), 0, H - 0.035, cabZ));
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
  const wg = new THREE.CylinderGeometry(wheelR, wheelR, 0.28, 14);
  wg.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(part(wg, paint(0.25), sx * (W / 2 - 0.12), wheelR, sz * (D / 2 - wheelR * 1.6)));
  }
  // Head and tail lights read the direction of travel from any angle.
  for (const sx of [-1, 1]) {
    g.add(box(W * 0.2, 0.08, 0.04, paint(1.5), sx * W * 0.32, hullH - 0.12, D / 2));
    g.add(box(W * 0.2, 0.08, 0.04, paint(0.45), sx * W * 0.32, hullH - 0.12, -D / 2));
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
  hand: THREE.Mesh;
  /** Shoulder, rest elbow and rest wrist, in the upper body's frame. */
  sh: THREE.Vector3;
  el: THREE.Vector3;
  wr: THREE.Vector3;
  l1: number;
  l2: number;
};

export type PersonRig = {
  /** Pivots at the hip: leaning and turning move everything above it. */
  upperBody: THREE.Group;
  hipY: number;
  H: number;
  arms: [ArmRig, ArmRig];
  /** How far short of the target the hand stopped, metres (0 when it got there). */
  gap: number;
};

/**
 * A stylised figure at true proportions (the scene builder's, see
 * lib/previz/scene-build.ts buildFigure), built so its upper body can lean and
 * turn at the hip and either arm can reach for a point.
 */
function person(o: BlockObject, paint: Paint) {
  const H = o.size[1];
  const pose = poseDef(o.pose);
  const hipY = poseHipY(pose, H);
  const shY = poseShoulderY(pose, H);
  const g = new THREE.Group();
  const legs = paint(0.8);
  const body = paint(1);
  const skin = paint(1.12);
  const at = (p: [number, number, number], yBase = 0) => new THREE.Vector3(p[0] * H, yBase + p[1] * H, p[2] * H);

  // Legs stay where the pose puts them.
  const legR = 0.034 * H;
  for (const i of [0, 1] as const) {
    const side = i === 0 ? -1 : 1;
    const hip = new THREE.Vector3(side * 0.055 * H, hipY, 0);
    const knee = at(pose.knee[i]);
    let ankle = at(pose.ankle[i]);
    if (pose.seatM !== undefined) {
      knee.y = hipY;
      const L = SHIN * H;
      const ground = 0.04 * H;
      const drop = knee.y - ground;
      if (drop >= L) ankle = new THREE.Vector3(knee.x, knee.y - L, knee.z + 0.02 * H);
      else ankle = new THREE.Vector3(knee.x, ground, knee.z + Math.sqrt(Math.max(0, L * L - drop * drop)));
    }
    const thigh = capsuleMesh(legR, hip.distanceTo(knee), legs);
    spanLimb(thigh, hip, knee);
    const shin = capsuleMesh(legR * 0.85, knee.distanceTo(ankle), legs);
    spanLimb(shin, knee, ankle);
    g.add(thigh, shin, box(0.06 * H, 0.05, 0.15 * H, legs, ankle.x, Math.max(0.025, ankle.y - 0.045), ankle.z + 0.04 * H));
  }

  // Everything above the hip, in a group pivoting at the hip.
  const up = new THREE.Group();
  up.position.set(0, hipY, 0);
  g.add(up);
  const rel = (v: THREE.Vector3) => v.sub(new THREE.Vector3(0, hipY, 0));
  const torso = capsuleMesh(0.1 * H, 0.17 * H, body);
  torso.scale.set(1.15, 1, 0.68);
  torso.position.set(0, (shY - hipY) / 2 + 0.01 * H, 0);
  up.add(torso);
  const neck = capsuleMesh(0.028 * H, 0.05 * H, skin);
  neck.position.set(0, shY - hipY + 0.025 * H, 0);
  up.add(neck);
  const head = part(new THREE.SphereGeometry(0.058 * H, 18, 14), skin, 0, shY - hipY + 0.105 * H, 0.004 * H);
  head.scale.set(0.9, 1.12, 1);
  up.add(head);

  const arms = ([0, 1] as const).map((i) => {
    const side = (i === 0 ? -1 : 1) as -1 | 1;
    const sh = rel(new THREE.Vector3(side * 0.13 * H, shY - 0.02 * H, 0));
    const el = rel(at(pose.elbow[i], shY));
    const wr = rel(at(pose.wrist[i], shY));
    const l1 = sh.distanceTo(el);
    const l2 = el.distanceTo(wr);
    const upper = capsuleMesh(0.026 * H, l1, body);
    const fore = capsuleMesh(0.022 * H, l2, skin);
    const hand = part(new THREE.SphereGeometry(0.027 * H, 10, 8), skin);
    hand.scale.set(0.8, 1.15, 0.8);
    up.add(upper, fore, hand);
    const arm: ArmRig = { side, upper, fore, hand, sh, el, wr, l1, l2 };
    placeArm(arm, el, wr);
    return arm;
  }) as [ArmRig, ArmRig];
  const rig: PersonRig = { upperBody: up, hipY, H, arms, gap: 0 };
  g.userData.rig = rig;
  return g;
}

function placeArm(a: ArmRig, el: THREE.Vector3, wr: THREE.Vector3) {
  spanLimb(a.upper, a.sh, el);
  spanLimb(a.fore, el, wr);
  a.hand.position.copy(wr);
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
    const headY = a.sh.y + 0.125 * H;
    const pt = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const ext = (dx: number, dy: number, dz: number, f: number) => a.sh.clone().add(pt(dx, dy, dz).normalize().multiplyScalar(L * f));
    const pole = (x: number, y: number, z: number) => pt(x, y, z);
    switch (s.kind) {
      case "reach": {
        if (!local) return null;
        const goal = local.clone();
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
export function poseRig(rig: PersonRig, s: GestureState) {
  const up = rig.upperBody;
  const spec = gestureOf(s.kind);
  const needs = spec.target === "required";
  const amount = needs && !s.target ? 0 : Math.min(1, Math.max(0, s.reach));
  const leanRad = rad(s.lean);
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
    if (!gl) { placeArm(a, a.el, a.wr); return; }
    const target = a.wr.clone().lerp(gl.goal, amount);
    // The elbow swings from where the pose holds it to where the gesture
    // wants it, so a small amount does not snap the arm round.
    const restPole = a.el.clone().sub(a.sh).normalize();
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
  g.add(box(W, H, D, paint(1), 0, H / 2, 0));
  const floors = Math.max(1, Math.floor(H / 3.2));
  for (let f = 0; f < floors; f++) {
    const y = 1.6 + f * 3.2;
    if (y > H - 1) break;
    for (const face of [1, -1]) g.add(box(W * 0.86, 1.2, 0.05, paint(0.55), 0, y, face * (D / 2 + 0.02)));
    for (const face of [1, -1]) g.add(box(0.05, 1.2, D * 0.86, paint(0.55), face * (W / 2 + 0.02), y, 0));
  }
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
  g.add(part(new THREE.CylinderGeometry(W * 0.06, W * 0.08, H * 0.4, 6), paint(0.55), 0, H * 0.2, 0));
  g.add(part(new THREE.ConeGeometry(W / 2, H * 0.7, 7), paint(1), 0, H * 0.62, 0));
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
  const b = part(new THREE.IcosahedronGeometry(r, 1), m, x, y, z);
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
  g.add(blob(c, paint(1), 0, H * 0.68, 0, 1.15, 0.9, 1.15));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r();
    g.add(blob(c * (0.6 + r() * 0.2), paint(0.9 + r() * 0.2), Math.cos(a) * W * 0.22, H * (0.58 + r() * 0.15), Math.sin(a) * W * 0.22));
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
  const unit = 0.5;
  g.add(box(W, unit, D, tint("#8f7458"), 0, unit / 2, 0));
  const sw = W * 0.8;
  const sh = Math.min(H - unit - 0.08, sw * 0.5625);
  g.add(box(0.3, 0.04, 0.2, paint(1), 0, unit + 0.02, 0));
  g.add(box(0.05, 0.06, 0.05, paint(1), 0, unit + 0.07, 0));
  g.add(box(sw, sh, 0.05, paint(1), 0, unit + 0.1 + sh / 2, 0));
  g.add(box(sw - 0.04, sh - 0.04, 0.01, paint(0.4), 0, unit + 0.1 + sh / 2, 0.026));
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
    case "person": case "child": g = person(o, paint); break;
    case "dog": g = dog(o, paint); break;
    case "car": g = vehicle(o, paint, { cab: 0.48, cabStart: 0.28, rows: 2 }); break;
    case "suv": g = vehicle(o, paint, { cab: 0.66, cabStart: 0.22, rows: o.seats === "three" ? 3 : 2, cargo: true, tall: false }); break;
    case "van": g = vehicle(o, paint, { cab: 0.8, cabStart: 0.12, rows: 1, cargo: true, tall: true }); break;
    case "truck": g = vehicle(o, paint, { cab: 0.38, cabStart: 0.24, rows: 2, bed: true }); break;
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
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.far = 400;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const objects = new THREE.Group();
  scene.add(objects);
  const helpers = new THREE.Group();
  scene.add(helpers);
  return { scene, ground, sun, hemi, objects, helpers };
}

export function applyEnvironment(w: World, env: Environment, look: Look) {
  const sky = new THREE.Color(look === "clay" ? "#c9cbce" : env.sky);
  w.scene.background = sky;
  w.scene.fog = env.haze > 0 ? new THREE.Fog(sky, 30 + (1 - env.haze) * 600, 120 + (1 - env.haze) * 1400) : null;
  w.ground.visible = env.ground !== "none";
  const gm = w.ground.material as THREE.MeshLambertMaterial;
  gm.color.set(look === "clay" ? "#a8a6a2" : GROUND[env.ground]);
  const az = rad(env.sunAz);
  const el = rad(env.sunEl);
  w.sun.position.set(Math.sin(az) * Math.cos(el) * 150, Math.sin(el) * 150, Math.cos(az) * Math.cos(el) * 150);
  w.sun.castShadow = look !== "blockout";
  // Blockout is flat colour: lit almost evenly, so a colour stays one colour.
  w.hemi.intensity = look === "blockout" ? 2.4 : 1.2;
  w.sun.intensity = look === "blockout" ? 0.9 : 2.4;
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
