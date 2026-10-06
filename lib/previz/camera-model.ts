// Recognisable camera models for the Scene Setup prototype, at real size: an
// Alexa built out with a matte box and follow focus reads as an Alexa, a RED
// as a RED, an FX6 as a run-and-gun body. Drawn from primitives, like the
// fixtures in lib/previz/gear-models.ts, so nothing is downloaded.
//
// The camera group's origin is the lens mount, the body runs back along +Z
// and the lens looks down -Z, matching the rig convention in scene-build.ts.
// The support (sticks and a fluid head) is separate and never rotates, since
// legs stay on the floor however the head is panned and tilted.
import * as THREE from "three";

type Family = "arri" | "venice" | "red" | "compact" | "pocket";
type Spec = { family: Family; w: number; h: number; d: number; body: string; accent?: string };

const SPECS: Record<string, Spec> = {
  alexamini: { family: "arri", w: 0.125, h: 0.14, d: 0.185, body: "#2a2c30" },
  alexaminilf: { family: "arri", w: 0.133, h: 0.15, d: 0.2, body: "#2a2c30" },
  alexa35: { family: "arri", w: 0.144, h: 0.155, d: 0.21, body: "#26282c" },
  venice2: { family: "venice", w: 0.16, h: 0.16, d: 0.24, body: "#55585e", accent: "#1c1d20" },
  vraptor: { family: "red", w: 0.13, h: 0.12, d: 0.14, body: "#16171a", accent: "#c4232a" },
  komodo: { family: "red", w: 0.101, h: 0.101, d: 0.095, body: "#16171a", accent: "#c4232a" },
  fx6: { family: "compact", w: 0.116, h: 0.114, d: 0.153, body: "#1b1c1f" },
  c70: { family: "compact", w: 0.16, h: 0.15, d: 0.12, body: "#1b1c1f", accent: "#b51f24" },
  pocket6k: { family: "pocket", w: 0.178, h: 0.096, d: 0.08, body: "#2e3034" },
};

function m(color: string, roughness = 0.5, metalness = 0.35) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}
function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  return at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
}
/** A cylinder along Z, centred on z. */
function cylZ(r: number, len: number, mat: THREE.Material, z: number, seg = 24, r2 = r) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, seg), mat);
  c.rotation.x = Math.PI / 2;
  c.position.z = z;
  return c;
}

/** How high the lens axis sits above the bottom of the body, for the support. */
export function bodyDrop(bodyId: string): number {
  return (SPECS[bodyId] ?? SPECS.alexamini).h / 2 + 0.03;
}

/**
 * The camera, built out the way it would be on that job: cinema bodies get a
 * matte box, follow focus, top handle, monitor and a V-mount; compact bodies
 * a grip and a top handle; the Pocket is a hand-held body with a photo lens.
 */
export function buildCameraBody(bodyId: string, focalMm: number): THREE.Group {
  const s = SPECS[bodyId] ?? SPECS.alexamini;
  const g = new THREE.Group();
  const body = m(s.body, 0.55, 0.4);
  const black = m("#121315", 0.6, 0.3);
  const rubber = m("#0b0b0c", 0.9, 0);
  const alu = m("#b8bdc4", 0.3, 0.85);
  const glass = m("#0d1a26", 0.05, 0.9);
  const cine = s.family === "arri" || s.family === "venice" || s.family === "red";

  // Body: back from the mount along +Z.
  g.add(box(s.w, s.h, s.d, body, 0, 0, s.d / 2 + 0.012));
  // Mount ring.
  g.add(cylZ(cine ? 0.034 : 0.03, 0.012, s.accent && s.family !== "venice" ? m(s.accent, 0.4, 0.4) : alu, 0.006));

  if (s.family === "arri") {
    // ARRI's side panel with its buttons and the small status display.
    g.add(box(0.004, s.h * 0.55, s.d * 0.5, black, -s.w / 2 - 0.002, 0.01, s.d * 0.45));
    g.add(box(0.002, 0.025, 0.04, m("#203a52", 0.2, 0.2), -s.w / 2 - 0.005, 0.03, s.d * 0.4));
  }
  if (s.family === "venice") {
    // Venice: the darker operator-side panel with its wide display.
    g.add(box(0.004, s.h * 0.7, s.d * 0.6, m(s.accent ?? "#1c1d20"), -s.w / 2 - 0.002, 0, s.d * 0.5));
    g.add(box(0.002, 0.04, 0.09, m("#203a52", 0.2, 0.2), -s.w / 2 - 0.005, 0.02, s.d * 0.5));
  }
  if (s.family === "red") {
    // RED: fins on top and the brand's red accent on the mount.
    for (let i = 0; i < 5; i++) g.add(box(s.w * 0.8, 0.008, 0.008, black, 0, s.h / 2 + 0.004, 0.02 + (i * s.d) / 5));
  }
  if (s.family === "compact" || s.family === "pocket") {
    // A hand grip on the operator's right.
    const grip = box(0.045, s.h * 0.9, 0.06, rubber, s.w / 2 + 0.02, -0.01, 0.03);
    g.add(grip);
  }

  // Lens: a cine prime for cinema bodies, a photo lens otherwise. Longer
  // focal lengths get a longer barrel.
  const lensLen = Math.min(0.24, 0.08 + focalMm * 0.0009);
  const lensR = cine ? (focalMm > 100 ? 0.05 : 0.045) : 0.036;
  g.add(cylZ(lensR, lensLen, black, -lensLen / 2, 28));
  if (cine) {
    // Geared focus and iris rings, and the engraved white scale.
    for (const [z, r] of [[-lensLen * 0.35, lensR + 0.006], [-lensLen * 0.7, lensR + 0.004]] as const) {
      g.add(cylZ(r, 0.018, m("#2a2b2e", 0.4, 0.5), z, 40));
    }
    g.add(cylZ(lensR + 0.007, 0.004, m("#d8d8d8", 0.4, 0.1), -lensLen * 0.35 + 0.012, 40));
  } else {
    g.add(cylZ(lensR + 0.003, 0.03, rubber, -lensLen * 0.55, 28));
  }
  // Front element.
  const front = new THREE.Mesh(new THREE.CircleGeometry(lensR * 0.8, 28), glass);
  front.rotation.y = Math.PI;
  front.position.z = -lensLen - 0.001;
  g.add(front);

  if (cine) {
    // Matte box: an open shade (four thin walls, open at the front) with a
    // top flag, and a bellows back to the lens. A solid block would read as a
    // box of something rather than a shade you look through.
    const mbZ = -lensLen - 0.055;
    const mb = new THREE.Group();
    const W = 0.19, H = 0.14, D = 0.085, T = 0.006;
    mb.add(box(W, T, D, black, 0, H / 2, 0));
    mb.add(box(W, T, D, black, 0, -H / 2, 0));
    mb.add(box(T, H, D, black, -W / 2, 0, 0));
    mb.add(box(T, H, D, black, W / 2, 0, 0));
    // Filter trays sticking up out of the top, and the top flag.
    for (let i = 0; i < 2; i++) mb.add(box(W * 0.9, 0.02, 0.006, m("#2c2d30", 0.5, 0.4), 0, H / 2 + 0.01, D / 2 - 0.01 - i * 0.012));
    const flag = box(W, 0.004, 0.1, black, 0, 0, -0.05);
    const hinge = new THREE.Group();
    hinge.position.set(0, H / 2, -D / 2);
    hinge.rotation.x = 0.25;
    hinge.add(flag);
    mb.add(hinge);
    // The bellows: a short dark frustum from the shade back onto the lens.
    const bellows = new THREE.Mesh(new THREE.CylinderGeometry(lensR + 0.006, W * 0.42, 0.05, 4, 1, true), m("#0d0d0e", 0.9, 0));
    bellows.rotation.set(Math.PI / 2, Math.PI / 4, 0);
    bellows.position.z = D / 2 + 0.025;
    mb.add(bellows);
    mb.position.set(0, 0.004, mbZ);
    g.add(mb);
    for (const sx of [-1, 1]) g.add(at(cylZ(0.0075, 0.32, alu, 0, 12), sx * 0.03, -s.h / 2 - 0.02, -0.05));
    g.add(box(0.06, 0.03, 0.05, black, 0, -s.h / 2 - 0.02, 0.05));
    // Follow focus on the operator side, its knob and gear.
    g.add(box(0.03, 0.06, 0.035, black, -lensR - 0.02, -0.035, -lensLen * 0.35));
    const ffKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 20), m("#d8d8d8", 0.5, 0.2));
    ffKnob.rotation.z = Math.PI / 2;
    ffKnob.position.set(-lensR - 0.045, -0.04, -lensLen * 0.35);
    g.add(ffKnob);
    // V-mount battery on the back.
    g.add(box(s.w * 0.85, s.h * 0.8, 0.05, m("#202124", 0.6, 0.2), 0, -0.005, s.d + 0.04));
    // Top handle, and the 7" monitor out on an arm.
    const handleY = s.h / 2 + 0.035;
    g.add(box(0.025, 0.012, s.d * 1.1, black, 0, handleY, s.d * 0.4));
    for (const z of [0.02, s.d * 0.85]) g.add(box(0.02, 0.035, 0.015, black, 0, s.h / 2 + 0.016, z));
    const mon = new THREE.Group();
    mon.add(box(0.17, 0.105, 0.025, black));
    mon.add(box(0.15, 0.088, 0.002, m("#101820", 0.1, 0.3), 0, 0, 0.014));
    mon.position.set(-s.w / 2 - 0.08, handleY + 0.06, s.d * 0.55);
    mon.rotation.y = -0.6;
    g.add(mon);
    // The articulating arm from the handle to the monitor.
    const armA = new THREE.Vector3(-0.01, handleY + 0.005, s.d * 0.55);
    const armB = new THREE.Vector3(-s.w / 2 - 0.06, handleY + 0.03, s.d * 0.58);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, armA.distanceTo(armB), 8), alu);
    arm.position.copy(armA.clone().add(armB).multiplyScalar(0.5));
    arm.lookAt(armB);
    arm.rotateX(Math.PI / 2);
    g.add(arm);
    // An eyepiece for the ARRIs.
    if (s.family === "arri") {
      const eye = cylZ(0.02, 0.06, rubber, s.d * 0.9);
      eye.position.x = -s.w / 2 - 0.03;
      eye.position.y = s.h * 0.25;
      g.add(eye);
    }
  } else if (s.family === "compact") {
    // Top handle with its mic holder, and the flip-out screen.
    g.add(box(0.025, 0.02, s.d * 0.9, black, 0, s.h / 2 + 0.03, s.d * 0.45));
    g.add(box(0.008, 0.06, 0.09, black, -s.w / 2 - 0.006, 0.01, s.d * 0.35));
  } else {
    // Pocket: the big rear screen.
    g.add(box(s.w * 0.8, s.h * 0.75, 0.004, m("#101820", 0.1, 0.3), 0, 0, s.d + 0.014));
  }

  // The pan bar, out the back and down, on the operator's side; it tilts with
  // the head, which is why it is part of the camera rather than the legs.
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.5, 10), black);
  bar.name = "panbar"; // hidden on a motion control arm, which has no operator
  bar.position.set(-0.07, -s.h / 2 - 0.1, s.d + 0.18);
  bar.rotation.set(-(Math.PI / 2 - 0.35), 0, 0.35);
  g.add(bar);
  g.add(box(0.11, 0.05, 0.12, m("#222326", 0.5, 0.4), 0, -s.h / 2 - 0.055, s.d / 2));
  return g;
}

export type SupportKind = "sticks" | "dana" | "fisher" | "robot";

/** `lens` is the lens height range in metres each support can actually put a camera at. */
export const SUPPORTS: { id: SupportKind; name: string; note: string; lens: [number, number] }[] = [
  { id: "sticks", name: "Sticks", note: "Tripod and fluid head, dropping to a hi-hat for a low lens. Locked off, pans and tilts.", lens: [0.15, 2.2] },
  { id: "dana", name: "Dana Dolly", note: "8 ft of speed rail on two stands, or on apple boxes for a low lens. A short, smooth lateral slide.", lens: [0.35, 2.0] },
  { id: "fisher", name: "Fisher dolly", note: "Fisher 11 on 12 ft of straight track along the lens axis, so it pushes in and pulls out. The arm booms the lens about 0.6 to 1.9 m.", lens: [0.6, 1.9] },
  { id: "robot", name: "Motion control arm", note: "A Bolt-style robotic arm: repeatable moves to the frame, the high-speed food and liquid shot. Reaches a lens height of about 0.2 to 2.4 m.", lens: [0.2, 2.4] },
];

/**
 * Options for a support that is part way through a move: the track's extent
 * along its axis, and the robot's base, both in the support's frame relative
 * to where the camera is NOW. Left out, a support is drawn for a camera that
 * is not moving.
 */
export type SupportOpts = { track?: { from: number; to: number }; base?: { x: number; z: number } };

/** Where the support's footprint sits, in the camera's own frame (lens looks -Z). */
export function supportFootprint(kind: SupportKind, lensHeight: number, drop: number, opts: SupportOpts = {}):
  { track?: { axis: "x" | "z"; from: number; to: number; gauge: number }; base?: { x: number; z: number; r: number } } {
  if (kind === "dana") return { track: { axis: "x", from: opts.track?.from ?? -1.22, to: opts.track?.to ?? 1.22, gauge: 0.25 } };
  if (kind === "fisher") return { track: { axis: "z", from: opts.track?.from ?? -1.4, to: opts.track?.to ?? 2.26, gauge: 0.62 } };
  if (kind === "robot") return { base: { x: opts.base?.x ?? 0, z: opts.base?.z ?? robotReach(lensHeight, drop).baseZ, r: 0.3 } };
  return {};
}

/** Where the robot's base goes for a camera at this height, in the camera's frame. */
export function robotBaseLocal(lensHeight: number, drop: number): { x: number; z: number } {
  return { x: 0, z: robotReach(lensHeight, drop).baseZ };
}

/**
 * How far from the camera an arm's base can stand and still reach it at this
 * height, metres across the floor. Closer than `min` the arm folds on itself.
 */
export function robotBaseRange(lensHeight: number, drop: number): { min: number; max: number } {
  const ty = Math.max(0.12, lensHeight - drop - 0.04);
  const dy = ty - ROBOT.shoulderY;
  const maxR = ROBOT.upper + ROBOT.fore - 0.12;
  return { min: ROBOT.flangeZ + 0.35, max: ROBOT.flangeZ + Math.sqrt(Math.max(0.12, maxR * maxR - dy * dy)) };
}

const ROBOT = { shoulderY: 0.78, upper: 1.05, fore: 0.95, flangeZ: 0.2 };

/** Where a robot arm's base goes so it can reach the camera without straining. */
function robotReach(lensHeight: number, drop: number) {
  const ty = Math.max(0.12, lensHeight - drop - 0.04);
  const dy = ty - ROBOT.shoulderY;
  const maxR = ROBOT.upper + ROBOT.fore - 0.12;
  // About 1.1 m behind the camera, closer in when the lens is very high or low.
  const D = Math.max(0.35, Math.min(1.1, Math.sqrt(Math.max(0.12, maxR * maxR - dy * dy))));
  return { baseZ: ROBOT.flangeZ + D, ty };
}

/** A beam or tube from a to b. */
function segment(a: THREE.Vector3, b: THREE.Vector3, w: number, mat: THREE.Material, round = true) {
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(round ? new THREE.CylinderGeometry(w, w, len, 14) : new THREE.BoxGeometry(w, len, w), mat);
  mesh.position.copy(a.clone().add(b).multiplyScalar(0.5));
  mesh.lookAt(b);
  mesh.rotateX(Math.PI / 2);
  return mesh;
}

/** The fluid head's bowl, which every support but the robot carries. */
function bowl(y: number) {
  return at(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.07, 20), m("#1d1e21", 0.5, 0.4)), 0, y + 0.035, 0);
}

/**
 * What the camera is on, drawn in world-up so it never tips with the head:
 * sticks (or a hi-hat), a Dana Dolly, a Fisher dolly on track, or a motion
 * control arm. The lens looks down -Z; the group is only ever yawed.
 */
export function buildSupport(kind: SupportKind, lensHeight: number, drop: number, opts: SupportOpts = {}): THREE.Group {
  if (kind === "dana") return buildDana(lensHeight, drop, opts);
  if (kind === "fisher") return buildFisher(lensHeight, drop, opts);
  if (kind === "robot") return buildRobot(lensHeight, drop, opts);
  return buildSticks(lensHeight, drop);
}

/** Dana Dolly: two speed rails across the lens axis, a carriage on skate wheels. */
function buildDana(lensHeight: number, drop: number, opts: SupportOpts): THREE.Group {
  const g = new THREE.Group();
  const alu = m("#b9bec5", 0.35, 0.85);
  const black = m("#1b1c1f", 0.6, 0.3);
  const wood = m("#b98a55", 0.8, 0);
  const bowlY = Math.max(0.2, lensHeight - drop - 0.08);
  const railY = Math.min(1.7, Math.max(0.12, bowlY - 0.2));
  const x0 = opts.track?.from ?? -1.22;
  const x1 = opts.track?.to ?? 1.22;
  for (const z of [-0.125, 0.125]) {
    g.add(segment(new THREE.Vector3(x0, railY, z), new THREE.Vector3(x1, railY, z), 0.019, alu));
  }
  for (const x of [x0 + 0.08, x1 - 0.08]) {
    // End brackets tying the two rails together.
    g.add(box(0.06, 0.04, 0.34, black, x, railY - 0.01, 0));
    if (railY > 0.32) {
      // A stand under each end, its riser up to the bracket.
      const stand = buildStandLite(railY - 0.03);
      stand.position.set(x, 0, 0);
      g.add(stand);
    } else {
      // Low: the rails sit on apple boxes.
      g.add(box(0.3, railY - 0.02, 0.46, wood, x, (railY - 0.02) / 2, 0));
    }
  }
  // The carriage: a plate riding on four skate wheels, a riser to the head.
  g.add(box(0.3, 0.025, 0.36, black, 0, railY + 0.045, 0));
  for (const x of [-0.11, 0.11]) for (const z of [-0.125, 0.125]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 14), m("#e3e3e3", 0.5, 0.1));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, railY + 0.03, z);
    g.add(w);
  }
  if (bowlY > railY + 0.07) g.add(segment(new THREE.Vector3(0, railY + 0.055, 0), new THREE.Vector3(0, bowlY, 0), 0.03, black));
  g.add(bowl(bowlY));
  return g;
}

/** A light-duty stand for the rails: riser and three legs. */
function buildStandLite(h: number): THREE.Group {
  const g = new THREE.Group();
  const metal = m("#9aa0a7", 0.4, 0.8);
  g.add(segment(new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(0, h, 0), 0.016, metal));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    g.add(segment(new THREE.Vector3(Math.cos(a) * 0.32, 0.02, Math.sin(a) * 0.32), new THREE.Vector3(0, 0.28, 0), 0.011, metal));
  }
  return g;
}

/** Fisher 11: a heavy wheeled chassis on straight track, its hydraulic arm booming the head. */
function buildFisher(lensHeight: number, drop: number, opts: SupportOpts): THREE.Group {
  const g = new THREE.Group();
  const grey = m("#5d6168", 0.45, 0.6);
  const dark = m("#22252a", 0.55, 0.4);
  const chrome = m("#d6dade", 0.2, 0.95);
  const rail = m("#a7adb4", 0.35, 0.85);
  const wood = m("#8a6a45", 0.85, 0);
  // Track: two round rails at the Fisher gauge on wooden sleepers.
  const fp = supportFootprint("fisher", lensHeight, drop, opts).track!;
  for (let z = fp.from + 0.15; z < fp.to; z += 0.6) g.add(box(0.85, 0.035, 0.1, wood, 0, 0.018, z));
  for (const x of [-fp.gauge / 2, fp.gauge / 2]) {
    g.add(segment(new THREE.Vector3(x, 0.06, fp.from), new THREE.Vector3(x, 0.06, fp.to), 0.02, rail));
  }
  // Chassis behind the camera, on four wheels riding the rails.
  const cz = 0.45;
  const top = 0.38;
  g.add(box(0.62, 0.22, 1.05, grey, 0, top - 0.11 + 0.0, cz));
  g.add(box(0.66, 0.03, 1.09, dark, 0, top + 0.01, cz));
  for (const x of [-0.31, 0.31]) for (const z of [cz - 0.42, cz + 0.42]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 18), dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.155, z);
    g.add(w);
  }
  // Steering / push bar at the back.
  for (const x of [-0.2, 0.2]) g.add(segment(new THREE.Vector3(x, top, cz + 0.5), new THREE.Vector3(x, 1.0, cz + 0.62), 0.014, chrome));
  g.add(segment(new THREE.Vector3(-0.22, 1.0, cz + 0.62), new THREE.Vector3(0.22, 1.0, cz + 0.62), 0.016, chrome));
  // The arm: pivots on the chassis, its front end carrying the head. Clamped
  // to roughly the range a Fisher 11 arm booms through.
  const bowlY = Math.max(0.5, Math.min(1.9, lensHeight - drop - 0.08));
  const pivot = new THREE.Vector3(0, top + 0.12, cz + 0.15);
  const front = new THREE.Vector3(0, bowlY - 0.12, 0);
  g.add(box(0.12, 0.12, 0.16, dark, pivot.x, pivot.y, pivot.z));
  g.add(segment(pivot, front, 0.09, grey, false));
  // Hydraulic strut from the chassis to mid-arm.
  g.add(segment(new THREE.Vector3(0, top + 0.02, cz - 0.3), pivot.clone().lerp(front, 0.55), 0.022, chrome));
  // The leveling head and a riser up to the bowl.
  g.add(box(0.16, 0.06, 0.16, dark, front.x, front.y, front.z));
  g.add(segment(front, new THREE.Vector3(0, bowlY, 0), 0.03, dark));
  g.add(bowl(bowlY));
  // The dolly grip's seat on the side.
  g.add(segment(new THREE.Vector3(0.33, top - 0.05, cz + 0.1), new THREE.Vector3(0.62, 0.55, cz + 0.1), 0.015, chrome));
  g.add(box(0.26, 0.05, 0.26, dark, 0.66, 0.57, cz + 0.1));
  return g;
}

/** A Bolt-style motion control arm on a floor base, reaching in from behind. */
function buildRobot(lensHeight: number, drop: number, opts: SupportOpts): THREE.Group {
  const outer = new THREE.Group();
  const g = new THREE.Group();
  outer.add(g);
  const body = m("#1d1f23", 0.4, 0.5);
  const joint = m("#c9cdd3", 0.35, 0.7);
  const accent = m("#e0662a", 0.5, 0.2);
  const reachAt = robotReach(lensHeight, drop);
  const ty = reachAt.ty;
  // A base left where it stood while the camera moves: build the arm along +Z
  // to that distance, then turn the whole arm to face the base.
  const baseZ = opts.base ? Math.max(0.3, Math.hypot(opts.base.x, opts.base.z)) : reachAt.baseZ;
  if (opts.base) g.rotation.y = Math.atan2(opts.base.x, opts.base.z);
  // Base plate and turret.
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.06, 28), body), 0, 0.03, baseZ));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.4, 28), body), 0, 0.26, baseZ));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.03, 28), accent), 0, 0.47, baseZ));
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.26, 24), body), 0, 0.62, baseZ));
  // Two-link IK in the vertical plane through the camera: shoulder to flange.
  const S = new THREE.Vector3(0, ROBOT.shoulderY, baseZ);
  const T = new THREE.Vector3(0, ty, ROBOT.flangeZ);
  const d = Math.min(S.distanceTo(T), ROBOT.upper + ROBOT.fore - 0.02);
  const dir = T.clone().sub(S).normalize();
  const reach = S.clone().add(dir.clone().multiplyScalar(d));
  const a = Math.atan2(dir.y, dir.z);
  const cosB = (ROBOT.upper ** 2 + d * d - ROBOT.fore ** 2) / (2 * ROBOT.upper * d);
  const b = Math.acos(Math.max(-1, Math.min(1, cosB)));
  const e1 = new THREE.Vector3(0, S.y + Math.sin(a + b) * ROBOT.upper, S.z + Math.cos(a + b) * ROBOT.upper);
  const e2 = new THREE.Vector3(0, S.y + Math.sin(a - b) * ROBOT.upper, S.z + Math.cos(a - b) * ROBOT.upper);
  const E = e1.y > e2.y ? e1 : e2; // elbow up, out of the frame
  // Shoulder and elbow joints, the two links, and the wrist at the flange.
  for (const [p, r] of [[S, 0.17], [E, 0.13]] as const) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 24), joint);
    c.rotation.z = Math.PI / 2;
    c.position.copy(p);
    g.add(c);
  }
  g.add(segment(S, E, 0.12, body, false));
  g.add(segment(E, reach, 0.095, body, false));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 12), joint), reach.x, reach.y, reach.z));
  // Wrist plate up to the camera's baseplate.
  const plateY = lensHeight - drop - 0.06;
  g.add(segment(reach, new THREE.Vector3(0, plateY, ROBOT.flangeZ - 0.05), 0.045, body));
  g.add(box(0.16, 0.03, 0.26, joint, 0, plateY, 0.1));
  return outer;
}

/** Sticks and a fluid head, dropping to a hi-hat for a low lens. */
function buildSticks(lensHeight: number, drop: number): THREE.Group {
  const g = new THREE.Group();
  const legMat = m("#2b2d31", 0.5, 0.5);
  const alu = m("#9aa0a7", 0.4, 0.8);
  const bowlY = Math.max(0.05, lensHeight - drop - 0.08);
  // The fluid head's bowl.
  g.add(bowl(bowlY));
  if (bowlY < 0.25) {
    // Hi-hat: three short feet.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.03), legMat), Math.cos(a) * 0.1, 0.01, Math.sin(a) * 0.1).rotateY(-a));
    }
    return g;
  }
  const spread = Math.min(0.75, 0.25 + bowlY * 0.25);
  const mid = bowlY * 0.35;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const foot = new THREE.Vector3(Math.cos(a) * spread, 0, Math.sin(a) * spread);
    const top = new THREE.Vector3(Math.cos(a) * 0.05, bowlY, Math.sin(a) * 0.05);
    const len = foot.distanceTo(top);
    // Twin tubes, as real sticks have.
    for (const off of [-0.012, 0.012]) {
      const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(off);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, len, 8), legMat);
      leg.position.copy(foot.clone().add(top).multiplyScalar(0.5).add(side));
      leg.lookAt(top.clone().add(side));
      leg.rotateX(Math.PI / 2);
      g.add(leg);
    }
    // Leg locks two thirds down, and the spreader arm to the centre.
    const lock = foot.clone().lerp(top, 0.45);
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.04), m("#111", 0.7, 0.2)), lock.x, lock.y, lock.z));
    const sp = foot.clone().lerp(top, mid / bowlY);
    const centre = new THREE.Vector3(0, sp.y, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, sp.distanceTo(centre), 6), alu);
    arm.position.copy(sp.clone().add(centre).multiplyScalar(0.5));
    arm.lookAt(centre);
    arm.rotateX(Math.PI / 2);
    g.add(arm);
  }
  return g;
}
