// Shot blocking: drawing the scene in three.js. Every object is built in its
// own frame (origin on the ground at its centre, facing +Z) out of a handful of
// low-poly parts, the way a blockout is made: volumes and silhouettes, nothing
// a generation model would copy as detail.
//
// One material per object per look. "Blockout" is flat colour with flat
// shading, each subject its own colour, which is what lets a video model tell
// the subjects apart in a reference clip.
import * as THREE from "three";
import { buildFigure } from "@/lib/previz/scene-build";
import type { BlockObject, Environment, Look, Vec3 } from "./scene";
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

function person(o: BlockObject, paint: Paint) {
  const fig = buildFigure({
    id: o.id, name: o.name, heightM: o.size[1], pose: (o.pose ?? "standing") as never,
    x: 0, z: 0, facing: 0, top: o.color, bottom: o.color,
  });
  const m = paint(1);
  const m2 = paint(0.8);
  let i = 0;
  fig.traverse((c) => {
    if (c instanceof THREE.Mesh) c.material = i++ % 3 === 0 ? m2 : m;
  });
  fig.position.set(0, 0, 0);
  fig.rotation.set(0, 0, 0);
  return fig;
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

/** An object's own geometry, in its own frame. */
export function buildObject(o: BlockObject, look: Look): THREE.Group {
  const paint = painter(look, o.color);
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
    case "table": {
      g = new THREE.Group();
      g.add(box(W, 0.05, D, paint(1), 0, H - 0.025, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.06, H - 0.05, 0.06, paint(0.8), sx * (W / 2 - 0.08), (H - 0.05) / 2, sz * (D / 2 - 0.08)));
      break;
    }
    case "sofa": {
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
