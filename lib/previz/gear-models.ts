// Recognisable fixture models for the Scene Setup prototype. Built from
// primitives at each unit's real size and in its real colourway, so a gaffer
// can tell an LS 600d on a Light Dome from a SkyPanel or a 650 Fresnel at a
// glance. They are drawn, not downloaded: manufacturer CAD is not ours to
// ship, and a hand-built model loads instantly and costs nothing.
//
// Conventions match the cameras: a head looks down its local -Z, the YOKE
// pans (yaw only) and the HEAD tilts inside it (pitch only), the way a real
// yoke works. Everything here only draws; the light itself and its numbers
// come from lib/previz/lighting.ts via light-build.ts.
import * as THREE from "three";
import { MODIFIERS, type Fixture } from "./lighting";

export type FixtureModel = {
  /** Pans with the light: holds the yoke and the head. */
  yoke: THREE.Group;
  /** Tilts inside the yoke: holds the body, the modifier and the face. */
  head: THREE.Group;
  /** Neither: things on the floor beside the stand (a ballast, a control box). */
  base: THREE.Group;
  /** The glowing surfaces, driven in nits every frame. */
  faces: THREE.MeshStandardMaterial[];
  /** Where the glowing face sits along -Z, metres (negative). */
  faceZ: number;
  /** How far below the tilt axis the stand's spigot meets the yoke. */
  yokeDrop: number;
  /** Heavier fixtures go on a combo stand. */
  heavy: boolean;
  /** A lantern on a boom brings its own stand. */
  ownStand: boolean;
};

const TAU = Math.PI * 2;

function m(color: string, roughness = 0.55, metalness = 0.3, side: THREE.Side = THREE.FrontSide) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, side });
}
const palette = () => ({
  black: m("#1a1b1e", 0.5, 0.35),
  matte: m("#121315", 0.85, 0.1),
  grey: m("#3b3e44", 0.45, 0.5),
  alu: m("#c3c8cf", 0.3, 0.9),
  aluInside: m("#d9dde2", 0.25, 0.95, THREE.BackSide),
  rubber: m("#0c0c0d", 0.95, 0),
  arriBlue: m("#2b5c99", 0.45, 0.35),
  cloth: m("#0f1012", 0.95, 0, THREE.FrontSide),
  paperRib: m("#cfc8b8", 0.9, 0),
});
type Pal = ReturnType<typeof palette>;

/** A glowing face. Its brightness is set every frame from real nits. */
export function faceMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: "#000000",
    emissive: "#ffffff",
    emissiveIntensity: 1,
    roughness: 1,
    side: THREE.DoubleSide,
  });
}

/** A cylinder lying along Z. `rBack` is at +Z, `rFront` at -Z. */
function cylZ(rBack: number, rFront: number, len: number, mat: THREE.Material, seg = 24, open = false) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rBack, rFront, len, seg, 1, open), mat);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}
/** A cylinder lying along X (knobs, axles). */
function cylX(r: number, len: number, mat: THREE.Material, seg = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}
/** Places an object (Object3D.position cannot be reassigned, only set). */
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}
function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}
/** A flat disc facing -Z. */
function discZ(r: number, mat: THREE.Material, z: number, seg = 32) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, seg), mat);
  mesh.rotation.y = Math.PI;
  mesh.position.z = z;
  return mesh;
}

/**
 * An open frustum along -Z: a back rectangle at z0 opening to a front one at
 * z0 - depth. Softboxes and strips, with the flat sides square to the frame.
 */
function frustumGeometry(bw: number, bh: number, fw: number, fh: number, depth: number): THREE.BufferGeometry {
  const b = [[-bw / 2, -bh / 2], [bw / 2, -bh / 2], [bw / 2, bh / 2], [-bw / 2, bh / 2]];
  const f = [[-fw / 2, -fh / 2], [fw / 2, -fh / 2], [fw / 2, fh / 2], [-fw / 2, fh / 2]];
  const pos: number[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const q = [
      [b[i][0], b[i][1], 0], [b[j][0], b[j][1], 0], [f[j][0], f[j][1], -depth],
      [b[i][0], b[i][1], 0], [f[j][0], f[j][1], -depth], [f[i][0], f[i][1], -depth],
    ];
    for (const v of q) pos.push(...v);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A U yoke: two arms either side of the head, joined below, with tilt knobs. */
function yokeU(p: Pal, halfW: number, drop: number, thick = 0.016, mat?: THREE.Material) {
  const g = new THREE.Group();
  const yk = mat ?? p.black;
  g.add(box(thick, drop, 0.035, yk, -halfW, -drop / 2, 0));
  g.add(box(thick, drop, 0.035, yk, halfW, -drop / 2, 0));
  g.add(box(halfW * 2 + thick, thick, 0.035, yk, 0, -drop, 0));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 12), p.alu), 0, -drop - 0.03, 0));
  for (const s of [-1, 1]) {
    const knob = cylX(0.028, 0.03, p.rubber, 18);
    knob.position.x = s * (halfW + 0.03);
    g.add(knob);
    const hub = cylX(0.012, 0.03, p.alu, 12);
    hub.position.x = s * (halfW + 0.012);
    g.add(hub);
  }
  return g;
}

/** A carry handle arching over the top of a head, front to back. */
function topHandle(p: Pal, y: number, z: number, span: number) {
  const h = new THREE.Mesh(new THREE.TorusGeometry(span / 2, 0.01, 8, 18, Math.PI), p.rubber);
  h.rotation.y = Math.PI / 2;
  h.position.set(0, y, z);
  return h;
}

// ------------------------------------------------------------ modifiers

/** What a Bowens-mount modifier adds in front of a COB head; returns faceZ. */
function bowensModifier(head: THREE.Group, p: Pal, faces: THREE.MeshStandardMaterial[], modifierId: string, z0: number, chipZ: number): number {
  const mod = MODIFIERS[modifierId];
  const addFace = (mesh: THREE.Mesh) => {
    faces.push(mesh.material as THREE.MeshStandardMaterial);
    head.add(mesh);
  };
  if (modifierId === "reflector") {
    // The standard 55° hyper reflector, polished inside.
    const depth = 0.15;
    const out = cylZ(0.085, 0.165, depth, p.alu, 32, true);
    out.position.z = z0 - depth / 2;
    head.add(out);
    const inner = cylZ(0.085, 0.165, depth, p.aluInside, 32, true);
    inner.position.z = z0 - depth / 2;
    head.add(inner);
    return chipZ;
  }
  if (modifierId === "dome") {
    // A deep sixteen-sided parabolic: black outside, silver inside, a white
    // front diffuser, and the speed ring at the back.
    const depth = 0.52;
    const r = (mod?.faceW ?? 0.9) / 2;
    const shell = cylZ(0.1, r, depth, p.cloth, 16, true);
    shell.position.z = z0 - depth / 2;
    head.add(shell);
    const lining = cylZ(0.1, r, depth, p.aluInside, 16, true);
    lining.position.z = z0 - depth / 2;
    head.add(lining);
    const ring = cylZ(0.11, 0.11, 0.04, p.alu, 24);
    ring.position.z = z0 - 0.02;
    head.add(ring);
    // The rods, visible as seams on the cloth.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, Math.hypot(depth, r - 0.1), 6), p.grey);
      const mid = new THREE.Vector3(Math.cos(a) * (0.1 + r) / 2, Math.sin(a) * (0.1 + r) / 2, z0 - depth / 2);
      rod.position.copy(mid);
      rod.lookAt(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z0 - depth));
      rod.rotateX(Math.PI / 2);
      head.add(rod);
    }
    addFace(discZ(r, faceMaterial(), z0 - depth, 16));
    return z0 - depth;
  }
  if (modifierId === "softbox" || modifierId === "strip") {
    const w = mod?.faceW ?? 1.2;
    const h = mod?.faceH ?? 1.2;
    const depth = modifierId === "strip" ? 0.36 : 0.48;
    const geo = frustumGeometry(0.16, 0.16, w, h, depth);
    const shell = new THREE.Mesh(geo, p.cloth);
    shell.position.z = z0;
    head.add(shell);
    const lining = new THREE.Mesh(geo, p.aluInside);
    lining.position.z = z0;
    head.add(lining);
    // A black edge band around the front, the recess a real softbox has.
    const band = new THREE.Mesh(frustumGeometry(w, h, w, h, 0.04), p.cloth);
    band.position.z = z0 - depth;
    head.add(band);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), faceMaterial());
    face.position.z = z0 - depth - 0.02;
    addFace(face);
    return z0 - depth - 0.02;
  }
  if (modifierId === "lantern") {
    // Aputure's lantern: a paper sphere on a short black neck.
    const r = (mod?.faceW ?? 0.65) / 2;
    const neck = cylZ(0.09, 0.07, 0.06, p.cloth, 20);
    neck.position.z = z0 - 0.03;
    head.add(neck);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), faceMaterial());
    ball.position.z = z0 - 0.05 - r;
    addFace(ball);
    // The wire ribs, as faint seams.
    for (let i = 1; i < 6; i++) {
      const lat = -Math.PI / 2 + (i / 6) * Math.PI;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.cos(lat) * r * 1.002, 0.0025, 6, 48), p.paperRib);
      ring.position.set(0, 0, ball.position.z + Math.sin(lat) * r);
      head.add(ring);
    }
    return ball.position.z;
  }
  return chipZ;
}

// ------------------------------------------------------------ heads

/** Aputure LS 600d / 300x: a finned COB head with a Bowens mount and a fan grille. */
function cobHead(f: Fixture, modifierId: string, p: Pal, faces: THREE.MeshStandardMaterial[]): Partial<FixtureModel> & { faceZ: number } {
  const head = new THREE.Group();
  const yoke = new THREE.Group();
  const base = new THREE.Group();
  const big = f.id === "ls600d";
  const r = big ? 0.115 : 0.095;
  const len = big ? 0.29 : 0.23;
  const zc = 0.03 + len / 2;
  const body = cylZ(r, r, len, p.grey, 32);
  body.position.z = zc;
  head.add(body);
  // Heat-sink fins.
  for (let i = 0; i < 9; i++) {
    const fin = cylZ(r + 0.012, r + 0.012, 0.006, p.black, 32);
    fin.position.z = 0.06 + i * (len - 0.07) / 8;
    head.add(fin);
  }
  // Rear fan grille.
  const rear = discZ(r - 0.01, p.matte, 0.03 + len + 0.001);
  rear.rotation.y = 0;
  head.add(rear);
  for (let i = 1; i <= 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry((r - 0.01) * (i / 3.4), 0.004, 6, 32), p.grey);
    ring.position.z = 0.03 + len + 0.004;
    head.add(ring);
  }
  // Front bezel and the Bowens mount.
  const bezel = cylZ(r, r * 0.92, 0.035, p.black, 32);
  bezel.position.z = 0.012;
  head.add(bezel);
  const bowens = cylZ(0.082, 0.082, 0.02, p.alu, 32);
  bowens.position.z = -0.012;
  head.add(bowens);
  const chip = discZ(big ? 0.032 : 0.026, faceMaterial(), -0.01, 24);
  faces.push(chip.material as THREE.MeshStandardMaterial);
  head.add(chip);
  head.add(topHandle(p, r + 0.01, zc, len * 0.7));
  const faceZ = bowensModifier(head, p, faces, modifierId, -0.022, -0.01);
  const drop = r + 0.07;
  yoke.add(yokeU(p, r + 0.02, drop));
  // The separate control box, hung on the stand, with its screen.
  const ctrl = new THREE.Group();
  ctrl.add(box(big ? 0.21 : 0.17, big ? 0.15 : 0.12, 0.08, p.black));
  ctrl.add(box(0.07, 0.03, 0.002, m("#1f3b4f", 0.2, 0.2), -0.04, 0.03, -0.041));
  for (let i = 0; i < 2; i++) ctrl.add(at(cylZ(0.012, 0.012, 0.012, p.rubber, 12), 0.05 + i * 0.03, 0.03, -0.045));
  ctrl.userData.onStand = 0.9;
  base.add(ctrl);
  return { head, yoke, base, faceZ, yokeDrop: drop, heavy: big };
}

/** ARRI SkyPanel: a slim rectangular soft panel in a wide yoke. */
function panelHead(f: Fixture, modifierId: string, p: Pal, faces: THREE.MeshStandardMaterial[]): Partial<FixtureModel> & { faceZ: number } {
  const head = new THREE.Group();
  const yoke = new THREE.Group();
  const w = f.faceW + 0.07;
  const h = f.faceH + 0.07;
  const d = 0.075;
  head.add(box(w, h, d, p.black, 0, 0, d / 2));
  // Rounded-looking ends: half cylinders on the short sides.
  for (const s of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, h, 16, 1, false, s > 0 ? 0 : Math.PI, Math.PI), p.black);
    end.position.set((s * w) / 2, 0, d / 2);
    head.add(end);
  }
  // Rear cooling ribs and the control panel with its screen.
  for (let i = 0; i < 7; i++) head.add(box(w * 0.8, 0.008, 0.02, p.grey, 0, -h / 2 + 0.05 + i * ((h - 0.1) / 6), d + 0.01));
  head.add(box(0.16, 0.08, 0.02, p.grey, w / 2 - 0.14, h / 2 - 0.08, d + 0.02));
  head.add(box(0.07, 0.035, 0.002, m("#1f3b4f", 0.2, 0.2), w / 2 - 0.16, h / 2 - 0.08, d + 0.031));
  // Two handles on top, and ARRI's blue badge.
  for (const s of [-1, 1]) head.add(at(topHandle(p, h / 2 + 0.005, d / 2, 0.06), s * w * 0.3, h / 2 + 0.005, d / 2));
  head.add(box(0.06, 0.012, 0.003, p.arriBlue, -w / 2 + 0.08, -h / 2 + 0.03, -0.002));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(f.faceW, f.faceH), faceMaterial());
  face.position.z = -0.002;
  faces.push(face.material as THREE.MeshStandardMaterial);
  head.add(face);
  if (modifierId === "grid") {
    // Honeycomb egg crate: a frame and its dividers.
    const gd = 0.07;
    const crate = new THREE.Group();
    const nx = Math.round(f.faceW / 0.08);
    const ny = Math.round(f.faceH / 0.08);
    for (let i = 0; i <= nx; i++) crate.add(box(0.004, f.faceH, gd, p.matte, -f.faceW / 2 + (i * f.faceW) / nx, 0, 0));
    for (let j = 0; j <= ny; j++) crate.add(box(f.faceW, 0.004, gd, p.matte, 0, -f.faceH / 2 + (j * f.faceH) / ny, 0));
    crate.position.z = -gd / 2 - 0.004;
    head.add(crate);
  }
  const drop = h / 2 + 0.09;
  yoke.add(yokeU(p, w / 2 + 0.05, drop, 0.022));
  return { head, yoke, faceZ: -0.002, yokeDrop: drop };
}

/** ARRI M18: a big HMI head with a separate ballast on the floor. */
function hmiHead(modifierId: string, p: Pal, faces: THREE.MeshStandardMaterial[]): Partial<FixtureModel> & { faceZ: number } {
  const head = new THREE.Group();
  const yoke = new THREE.Group();
  const base = new THREE.Group();
  const r = 0.17;
  const len = 0.36;
  const body = cylZ(r * 0.92, r, len, p.black, 36);
  body.position.z = len / 2;
  head.add(body);
  // Cooling vents across the top, a blue ARRI band, the front ring.
  for (let i = 0; i < 6; i++) head.add(box(0.2, 0.012, 0.018, p.grey, 0, r - 0.005, 0.06 + i * 0.045));
  const band = cylZ(r + 0.004, r + 0.004, 0.025, p.arriBlue, 36);
  band.position.z = len - 0.04;
  head.add(band);
  const ring = cylZ(r + 0.012, r + 0.012, 0.04, p.grey, 36);
  ring.position.z = 0.0;
  head.add(ring);
  let faceZ = -0.022;
  if (modifierId === "fresnel") {
    const lens = discZ(r - 0.02, faceMaterial(), faceZ, 36);
    faces.push(lens.material as THREE.MeshStandardMaterial);
    head.add(lens);
    for (let i = 1; i <= 6; i++) {
      const step = new THREE.Mesh(new THREE.TorusGeometry(((r - 0.02) * i) / 6.4, 0.0025, 6, 40), p.alu);
      step.position.z = faceZ - 0.002;
      head.add(step);
    }
  } else {
    // The MAX reflector seen through clear glass: a silver bowl, the lamp.
    const bowl = cylZ(r - 0.02, 0.05, 0.1, p.aluInside, 36, true);
    bowl.position.z = 0.03;
    head.add(bowl);
    const glass = discZ(r - 0.02, faceMaterial(), -0.01, 36);
    faces.push(glass.material as THREE.MeshStandardMaterial);
    head.add(glass);
    faceZ = -0.01;
  }
  head.add(topHandle(p, r + 0.015, len / 2, 0.24));
  const drop = r + 0.1;
  yoke.add(yokeU(p, r + 0.03, drop, 0.026));
  // The ballast, on the floor beside the stand, with its header cable.
  base.add(box(0.36, 0.17, 0.24, p.black, 0.42, 0.085, 0.18));
  base.add(box(0.36, 0.02, 0.24, p.arriBlue, 0.42, 0.172, 0.18));
  base.userData.heavy = true;
  return { head, yoke, base, faceZ, yokeDrop: drop, heavy: true };
}

/** ARRI 650 Plus: the classic blue tungsten Fresnel with four-leaf barn doors. */
function fresnelHead(p: Pal, faces: THREE.MeshStandardMaterial[]): Partial<FixtureModel> & { faceZ: number } {
  const head = new THREE.Group();
  const yoke = new THREE.Group();
  const w = 0.2;
  const h = 0.22;
  const d = 0.25;
  head.add(box(w, h, d, p.arriBlue, 0, 0, d / 2));
  // Louvred top and the rear focus knob.
  for (let i = 0; i < 5; i++) head.add(box(w * 0.9, 0.01, 0.025, p.black, 0, h / 2 + 0.005, 0.04 + i * 0.045));
  const knob = cylZ(0.02, 0.02, 0.04, p.rubber, 14);
  knob.position.set(0, -h / 2 + 0.03, d + 0.02);
  head.add(knob);
  // Front plate, the stepped Fresnel lens, the barn-door ring.
  head.add(box(w + 0.02, h + 0.02, 0.012, p.black, 0, 0, 0));
  const lens = discZ(0.075, faceMaterial(), -0.008, 36);
  faces.push(lens.material as THREE.MeshStandardMaterial);
  head.add(lens);
  for (let i = 1; i <= 5; i++) {
    const step = new THREE.Mesh(new THREE.TorusGeometry((0.075 * i) / 5.3, 0.002, 6, 32), p.alu);
    step.position.z = -0.01;
    head.add(step);
  }
  // Four-leaf barn doors, opened out.
  const leaf = (lw: number, lh: number) => box(lw, lh, 0.004, p.matte);
  const open = 0.55;
  const top = leaf(w, 0.14);
  top.geometry.translate(0, 0.07, 0);
  top.position.set(0, h / 2 + 0.01, -0.012);
  top.rotation.x = -open;
  const bot = leaf(w, 0.14);
  bot.geometry.translate(0, -0.07, 0);
  bot.position.set(0, -h / 2 - 0.01, -0.012);
  bot.rotation.x = open;
  const left = leaf(0.1, h);
  left.geometry.translate(-0.05, 0, 0);
  left.position.set(-w / 2 - 0.01, 0, -0.012);
  left.rotation.y = -open;
  const right = leaf(0.1, h);
  right.geometry.translate(0.05, 0, 0);
  right.position.set(w / 2 + 0.01, 0, -0.012);
  right.rotation.y = open;
  head.add(top, bot, left, right);
  head.add(topHandle(p, h / 2 + 0.02, d / 2, 0.14));
  const drop = h / 2 + 0.07;
  yoke.add(yokeU(p, w / 2 + 0.025, drop, 0.016, p.arriBlue));
  return { head, yoke, faceZ: -0.008, yokeDrop: drop };
}

/** Astera Titan: a slim tube on a center clamp, the light along its length. */
function tubeHead(f: Fixture, p: Pal, faces: THREE.MeshStandardMaterial[]): Partial<FixtureModel> & { faceZ: number } {
  const head = new THREE.Group();
  const yoke = new THREE.Group();
  const len = f.faceH;
  const z = -0.07;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, len, 20), faceMaterial());
  tube.position.z = z;
  faces.push(tube.material as THREE.MeshStandardMaterial);
  head.add(tube);
  // Black end caps and the control ring at one end.
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.045, 20), p.black);
    cap.position.set(0, (s * (len + 0.045)) / 2, z);
    head.add(cap);
  }
  const ctrl = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 20), p.grey);
  ctrl.position.set(0, -len / 2 + 0.03, z);
  head.add(ctrl);
  // The clamp joining it to the stand behind.
  head.add(box(0.06, 0.08, 0.07, p.black, 0, 0, z / 2 + 0.005));
  yoke.add(box(0.05, 0.06, 0.05, p.grey, 0, -0.04, 0));
  return { head, yoke, faceZ: z, yokeDrop: 0.07 };
}

/** A 26" China ball hung from a boom arm, its stand off behind it. */
function chinaBall(f: Fixture, p: Pal, faces: THREE.MeshStandardMaterial[]): Partial<FixtureModel> & { faceZ: number } {
  const head = new THREE.Group();
  const yoke = new THREE.Group();
  const r = f.faceW / 2;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 22), faceMaterial());
  faces.push(ball.material as THREE.MeshStandardMaterial);
  head.add(ball);
  for (let i = 1; i < 7; i++) {
    const lat = -Math.PI / 2 + (i / 7) * Math.PI;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.cos(lat) * r * 1.003, 0.002, 6, 48), p.paperRib);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = Math.sin(lat) * r;
    head.add(ring);
  }
  // Socket and cord up to the boom.
  yoke.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.06, 12), p.black), 0, r + 0.02, 0));
  const cordLen = 0.4;
  yoke.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, cordLen, 6), p.rubber), 0, r + 0.05 + cordLen / 2, 0));
  const armY = r + 0.05 + cordLen;
  const armLen = 1.0;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, armLen, 10), p.grey);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, armY, armLen / 2);
  yoke.add(arm);
  yoke.add(box(0.05, 0.05, 0.05, p.black, 0, armY, armLen));
  yoke.userData.boom = { y: armY, z: armLen };
  return { head, yoke, faceZ: 0, yokeDrop: 0, ownStand: true };
}

/**
 * The whole fixture for a fixture and a modifier: yoke, head, face, and
 * whatever sits on the floor beside it.
 */
export function buildFixture(f: Fixture, modifierId: string): FixtureModel {
  const p = palette();
  const faces: THREE.MeshStandardMaterial[] = [];
  let part: Partial<FixtureModel> & { faceZ: number };
  if (f.kind === "panel") part = panelHead(f, modifierId, p, faces);
  else if (f.kind === "hmi") part = hmiHead(modifierId, p, faces);
  else if (f.kind === "fresnel") part = fresnelHead(p, faces);
  else if (f.kind === "tube") part = tubeHead(f, p, faces);
  else if (f.kind === "lantern") part = chinaBall(f, p, faces);
  else part = cobHead(f, modifierId, p, faces);
  const yoke = part.yoke ?? new THREE.Group();
  const head = part.head ?? new THREE.Group();
  head.rotation.order = "YXZ";
  yoke.add(head);
  return {
    yoke,
    head,
    base: part.base ?? new THREE.Group(),
    faces,
    faceZ: part.faceZ,
    yokeDrop: part.yokeDrop ?? 0.12,
    heavy: !!part.heavy,
    ownStand: !!part.ownStand,
  };
}

/**
 * A stand. A C-stand (turtle base, three legs, riser) for most heads; a combo
 * stand with a wider, heavier base under the big ones.
 */
export function buildStand(height: number, heavy: boolean): THREE.Group {
  const g = new THREE.Group();
  const p = palette();
  const metal = heavy ? p.grey : m("#9aa0a7", 0.4, 0.8);
  const h = Math.max(0.12, height);
  const lower = Math.min(h, 0.9);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(heavy ? 0.022 : 0.016, heavy ? 0.028 : 0.02, lower, 12), metal);
  riser.position.y = lower / 2;
  g.add(riser);
  if (h > lower) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(heavy ? 0.017 : 0.012, heavy ? 0.017 : 0.012, h - lower, 10), metal);
    upper.position.y = lower + (h - lower) / 2;
    g.add(upper);
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), p.black), 0, lower, 0));
  }
  const spread = heavy ? 0.42 : 0.3;
  const legLen = heavy ? 0.62 : 0.5;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.3;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(heavy ? 0.016 : 0.011, heavy ? 0.016 : 0.011, legLen, 8), metal);
    const foot = new THREE.Vector3(Math.cos(a) * spread, 0.02, Math.sin(a) * spread);
    const top = new THREE.Vector3(0, 0.3, 0);
    leg.position.copy(foot.clone().add(top).multiplyScalar(0.5));
    leg.lookAt(top);
    leg.rotateX(Math.PI / 2);
    g.add(leg);
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), p.rubber), foot.x, foot.y, foot.z));
  }
  return g;
}
