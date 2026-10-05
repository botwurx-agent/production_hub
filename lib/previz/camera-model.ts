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
  bar.position.set(-0.07, -s.h / 2 - 0.1, s.d + 0.18);
  bar.rotation.set(-(Math.PI / 2 - 0.35), 0, 0.35);
  g.add(bar);
  g.add(box(0.11, 0.05, 0.12, m("#222326", 0.5, 0.4), 0, -s.h / 2 - 0.055, s.d / 2));
  return g;
}

/**
 * The support under a camera at `lensHeight`: a hi-hat on the floor or a
 * table for a low lens, sticks with a mid-level spreader otherwise. Drawn in
 * world-up, so it never tips with the head.
 */
export function buildSupport(lensHeight: number, drop: number): THREE.Group {
  const g = new THREE.Group();
  const legMat = m("#2b2d31", 0.5, 0.5);
  const alu = m("#9aa0a7", 0.4, 0.8);
  const bowlY = Math.max(0.05, lensHeight - drop - 0.08);
  // The fluid head's bowl.
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.07, 20), m("#1d1e21", 0.5, 0.4)), 0, bowlY + 0.035, 0));
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
