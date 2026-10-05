// The 3D world for the Scene Setup PROTOTYPE (app/dev/scene-setup). Builds a
// styled-real kitchen set, stylised talent and props, basic motivated lighting,
// the camera rigs shown in free view, and the depth of field pass. Lighting is
// deliberately simple here: modifiers and diffusion are slice 3, and this file
// only has to make slice 1 (camera and lens) judgeable.
//
// Conventions: metres, Y up. The room's back wall is toward -Z, the camera side
// is +Z. A figure faces its local +Z, and `facing` (degrees) turns it about Y.
import * as THREE from "three";
import { buildCameraBody } from "./camera-model";
import { hipY as poseHipY, poseDef, rightHand, shoulderY as poseShoulderY, eyeY, type PoseId } from "./poses";
import { buildStageFloor } from "./studio-set";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type Pose = PoseId;
export type TalentSpec = {
  id: string;
  name: string;
  heightM: number;
  pose: Pose;
  x: number;
  z: number;
  facing: number;
  top: string;
  bottom: string;
  /** A prop held in the right hand ("bottle"), or nothing. */
  holding?: string | null;
};
export type PropSpec = {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Resolved at runtime: the base's height, and who is holding it. Not saved. */
  y?: number;
  heldBy?: string | null;
};

const mat = (color: string, roughness = 0.8, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Wide boards with grain-ish variation, drawn once into a canvas. */
function plankTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext("2d")!;
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    let x = -((r * 173) % 400);
    while (x < 1024) {
      const len = 300 + ((x * 7 + r * 131) % 260);
      const l = 46 + ((r * 37 + x) % 9);
      g.fillStyle = `hsl(30 32% ${l}%)`;
      g.fillRect(x, r * 128, len, 128);
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = `hsla(28 30% ${l - 8}% / 0.35)`;
        g.lineWidth = 1 + (i % 3);
        g.beginPath();
        const y = r * 128 + 8 + i * 8.5;
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y + 3, x + len * 0.6, y - 3, x + len, y + 1);
        g.stroke();
      }
      g.fillStyle = "rgba(40,25,15,0.55)";
      g.fillRect(x, r * 128, 3, 128);
      x += len;
    }
    g.fillStyle = "rgba(40,25,15,0.6)";
    g.fillRect(0, r * 128, 1024, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.anisotropy = 8;
  return t;
}

/** A label for the hero bottle. Invented brand, never a real one. */
function labelTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f3efe6";
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = "#2f6f62";
  g.fillRect(0, 0, 1024, 26);
  g.fillRect(0, 230, 1024, 26);
  for (const cx of [256, 768]) {
    g.fillStyle = "#2f6f62";
    g.font = "bold 92px Helvetica, Arial, sans-serif";
    g.textAlign = "center";
    g.fillText("SPRING", cx, 140);
    g.fillStyle = "#c46a3b";
    g.font = "600 34px Helvetica, Arial, sans-serif";
    g.fillText("sparkling water", cx, 192);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function capsule(radius: number, length: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(length, 0.001), 6, 14), m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A capsule spanning two points, for limbs. */
function limb(a: THREE.Vector3, b: THREE.Vector3, radius: number, m: THREE.Material) {
  const len = a.distanceTo(b);
  const mesh = capsule(radius, len, m);
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

const SKIN = "#b59a86";

/**
 * A stylised figure at true proportions: no face, on purpose (see CLAUDE.md:
 * lifelike people pull focus and raise the question of whose likeness it is).
 * Feet point forward so facing reads from any angle, including the map.
 */
export function buildFigure(t: TalentSpec): THREE.Group {
  const H = t.heightM;
  const g = new THREE.Group();
  g.name = t.id;
  const skin = mat(SKIN, 0.7);
  const top = mat(t.top, 0.85);
  const bottom = mat(t.bottom, 0.9);
  const shoe = mat("#2a2623", 0.6);

  const pose = poseDef(t.pose);
  const hipY = poseHipY(pose, H);
  const shoulderY = poseShoulderY(pose, H);
  const legR = 0.034 * H;
  const hipX = 0.055 * H;
  const at = (p: [number, number, number], yBase = 0) => new THREE.Vector3(p[0] * H, yBase + p[1] * H, p[2] * H);

  // Legs (side 0 is the figure's right, -X)
  for (const i of [0, 1] as const) {
    const side = i === 0 ? -1 : 1;
    const hip = new THREE.Vector3(side * hipX, hipY, 0);
    const knee = at(pose.knee[i]);
    if (pose.seatM) knee.y = hipY; // thighs level on the seat
    const ankle = at(pose.ankle[i]);
    g.add(limb(hip, knee, legR, bottom));
    g.add(limb(knee, ankle, legR * 0.85, bottom));
    g.add(box(0.06 * H, 0.05, 0.15 * H, shoe, ankle.x, Math.max(0.025, ankle.y - 0.045), ankle.z + 0.04 * H));
  }

  // Torso: a capsule flattened front to back
  const torso = capsule(0.1 * H, 0.17 * H, top);
  torso.scale.set(1.15, 1, 0.68);
  torso.position.set(0, (hipY + shoulderY) / 2 + 0.01 * H, 0);
  g.add(torso);

  // Neck and head
  g.add(limb(new THREE.Vector3(0, shoulderY, 0), new THREE.Vector3(0, shoulderY + 0.05 * H, 0), 0.028 * H, skin));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.058 * H, 24, 18), skin);
  head.scale.set(0.9, 1.12, 1);
  head.position.set(0, shoulderY + 0.105 * H, 0.004 * H);
  head.castShadow = true;
  g.add(head);

  // Arms, from the pose: elbow and wrist are offsets from the shoulder line.
  for (const i of [0, 1] as const) {
    const side = i === 0 ? -1 : 1;
    const sh = new THREE.Vector3(side * 0.13 * H, shoulderY - 0.02 * H, 0);
    const el = at(pose.elbow[i], shoulderY);
    const wr = at(pose.wrist[i], shoulderY);
    g.add(limb(sh, el, 0.026 * H, top));
    g.add(limb(el, wr, 0.022 * H, skin));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.027 * H, 12, 10), skin);
    hand.scale.set(0.8, 1.15, 0.8);
    hand.position.copy(wr);
    hand.castShadow = true;
    g.add(hand);
  }

  g.position.set(t.x, 0, t.z);
  g.rotation.y = (t.facing * Math.PI) / 180;
  return g;
}

/** Eye-line height of a figure, where "focus on" pulls to. */
export function eyeHeight(t: TalentSpec): number {
  return eyeY(poseDef(t.pose), t.heightM);
}

/** Where the right hand is in the world: a held prop sits in it. */
export function handWorld(t: TalentSpec): { x: number; y: number; z: number } {
  const [hx, hy, hz] = rightHand(poseDef(t.pose), t.heightM);
  const r = (t.facing * Math.PI) / 180;
  return { x: t.x + hx * Math.cos(r) + hz * Math.sin(r), y: hy, z: t.z - hx * Math.sin(r) + hz * Math.cos(r) };
}

export const BOTTLE_TOP_Y = 0.75; // the table top the bottle stands on

function buildBottle(): THREE.Group {
  const g = new THREE.Group();
  g.name = "bottle";
  const pts: THREE.Vector2[] = [];
  const prof: [number, number][] = [
    [0, 0], [0.034, 0.002], [0.036, 0.01], [0.036, 0.15], [0.033, 0.175],
    [0.02, 0.205], [0.0125, 0.225], [0.0125, 0.25], [0.014, 0.252], [0, 0.252],
  ];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#dff2ee", roughness: 0.04, transmission: 0.92, thickness: 0.02, ior: 1.5,
  });
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), glass);
  body.castShadow = true;
  g.add(body);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.15, 40), mat("#cfe9e1", 0.1));
  (liquid.material as THREE.MeshStandardMaterial).transparent = true;
  (liquid.material as THREE.MeshStandardMaterial).opacity = 0.45;
  liquid.position.y = 0.083;
  g.add(liquid);
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0368, 0.0368, 0.085, 64, 1, true),
    new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.55 }),
  );
  label.position.y = 0.085;
  label.rotation.y = -Math.PI / 2;
  g.add(label);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 24), mat("#2f6f62", 0.4, 0.3));
  cap.position.y = 0.258;
  cap.castShadow = true;
  g.add(cap);
  return g;
}

export type Built = {
  scene: THREE.Scene;
  figures: Map<string, THREE.Group>;
  bottle: THREE.Group;
  rigs: THREE.Group;
  /** Holds the movable fixtures, flags and bounce boards. */
  lightsRoot: THREE.Group;
  /** Daylight through the window: a soft sky source, plus direct sun. */
  windowLight: THREE.SpotLight;
  sun: THREE.DirectionalLight;
  sky: THREE.MeshStandardMaterial;
  pendant: THREE.PointLight;
  bulb: THREE.MeshStandardMaterial;
  /** Light bouncing round the set, as one averaged level. */
  bounce: THREE.HemisphereLight;
  /** The two sets: only one is visible at a time. */
  kitchen: THREE.Group;
  studio: THREE.Group;
};

/** The window opening, so the meter can find the sky. */
export const WINDOW = { x: -4.06, z: -0.4, w: 1.7, sill: 0.9, top: 2.4 };
export const WINDOW_AREA = WINDOW.w * (WINDOW.top - WINDOW.sill);
/** The practical over the table: a 60W-equivalent bulb. */
export const PENDANT = { x: 0, y: 1.94, z: -0.6, lumens: 800 };

function glow(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveIntensity: 1, roughness: 1 });
}

/** The kitchen set. Returned groups are the things the UI moves. */
export function buildWorld(renderer: THREE.WebGLRenderer): Built {
  const scene = new THREE.Scene();
  // Beyond the set is a dark stage, which is what a real set has around it.
  scene.background = new THREE.Color("#0a0b0d");
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0;

  // The kitchen lives in its own group so the studio can take its place.
  const kitchen = new THREE.Group();
  kitchen.name = "kitchen";
  scene.add(kitchen);
  const studio = new THREE.Group();
  studio.name = "studio";
  studio.visible = false;
  studio.add(buildStageFloor());
  scene.add(studio);

  const plaster = mat("#d8d0c3", 0.95);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.62 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.5);
  floor.receiveShadow = true;
  kitchen.add(floor);

  // Back wall, and a left wall with a window cut into it
  kitchen.add(box(9, 3.2, 0.12, plaster, 0, 1.6, -2.56));
  const wx = WINDOW.x;
  const win = WINDOW;
  kitchen.add(box(0.12, 3.2, win.z - win.w / 2 + 2.56, plaster, wx, 1.6, (-2.56 + win.z - win.w / 2) / 2));
  kitchen.add(box(0.12, 3.2, 4.94 - (win.z + win.w / 2), plaster, wx, 1.6, (win.z + win.w / 2 + 4.94) / 2));
  kitchen.add(box(0.12, win.sill, win.w, plaster, wx, win.sill / 2, win.z));
  kitchen.add(box(0.12, 3.2 - win.top, win.w, plaster, wx, (win.top + 3.2) / 2, win.z));
  const frame = mat("#f2efe8", 0.6);
  kitchen.add(box(0.14, 0.05, win.w, frame, wx, win.sill, win.z));
  kitchen.add(box(0.14, 0.05, win.w, frame, wx, win.top, win.z));
  kitchen.add(box(0.14, win.top - win.sill, 0.04, frame, wx, (win.sill + win.top) / 2, win.z));
  // The sky seen through the window glows at real sky brightness, so it
  // blows out unless the window is gelled, exactly as it does on a set.
  const skyMat = glow();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), skyMat);
  sky.position.set(wx - 1.5, 1.7, win.z);
  sky.rotation.y = Math.PI / 2;
  sky.userData.noOcclude = true;
  kitchen.add(sky);

  // Counter run along the back wall, with a plant on it
  const cab = mat("#7f9182", 0.7);
  kitchen.add(box(3.4, 0.86, 0.62, cab, 0.6, 0.43, -2.19));
  kitchen.add(box(3.46, 0.04, 0.66, mat("#ece8e1", 0.35), 0.6, 0.88, -2.19));
  kitchen.add(box(3.4, 0.7, 0.36, cab, 0.6, 2.05, -2.32));
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.2, 24), mat("#b5643f", 0.8));
  pot.position.set(1.85, 1.0, -2.15);
  pot.castShadow = true;
  kitchen.add(pot);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), mat("#4e6e45", 0.9));
  leaves.position.set(1.85, 1.28, -2.15);
  leaves.castShadow = true;
  kitchen.add(leaves);

  // Table and two chairs
  const walnut = mat("#6a4a34", 0.5);
  kitchen.add(box(1.6, 0.05, 0.9, walnut, 0, 0.725, -0.6));
  for (const [lx, lz] of [[-0.72, -0.98], [0.72, -0.98], [-0.72, -0.22], [0.72, -0.22]])
    kitchen.add(box(0.05, 0.7, 0.05, walnut, lx, 0.35, lz));
  const chair = (x: number, z: number, rot: number) => {
    const c = new THREE.Group();
    c.add(box(0.44, 0.04, 0.42, walnut, 0, 0.45, 0));
    c.add(box(0.44, 0.45, 0.03, walnut, 0, 0.7, -0.2));
    for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]])
      c.add(box(0.035, 0.45, 0.035, walnut, lx, 0.225, lz));
    c.position.set(x, 0, z);
    c.rotation.y = rot;
    kitchen.add(c);
  };
  chair(0.35, -1.3, 0);
  chair(-0.45, -1.3, 0);

  const bottle = buildBottle();
  scene.add(bottle);

  // Pendant practical over the table
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.18, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: "#2b2b2b", roughness: 0.5, side: THREE.DoubleSide }),
  );
  shade.position.set(0, 2.05, -0.6);
  kitchen.add(shade);
  kitchen.add(box(0.008, 1.05, 0.008, mat("#222"), 0, 2.67, -0.6));
  const bulbMat = glow();
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), bulbMat);
  bulb.position.set(0, 1.98, -0.6);
  bulb.userData.noOcclude = true;
  kitchen.add(bulb);
  const pendant = new THREE.PointLight("#ffffff", 0, 0, 2);
  pendant.position.set(PENDANT.x, PENDANT.y, PENDANT.z);
  scene.add(pendant);

  // Daylight. The sky source sits OUTSIDE the wall, so the wall itself shapes
  // the patch of light on the floor the way a real window does.
  const windowLight = new THREE.SpotLight("#ffffff", 0, 0, 89 * (Math.PI / 180), 1, 2);
  windowLight.position.set(wx - 0.35, (win.sill + win.top) / 2, win.z);
  windowLight.target.position.set(wx + 3, (win.sill + win.top) / 2 - 0.4, win.z);
  windowLight.castShadow = true;
  windowLight.shadow.mapSize.set(1024, 1024);
  windowLight.shadow.camera.near = 0.1;
  windowLight.shadow.camera.far = 20;
  windowLight.shadow.bias = -0.0006;
  windowLight.shadow.radius = 18;
  windowLight.shadow.blurSamples = 16;
  scene.add(windowLight, windowLight.target);

  const sun = new THREE.DirectionalLight("#ffffff", 0);
  sun.position.set(-9, 4.8, -0.2);
  sun.target.position.set(0, 0.7, -0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.camera.far = 25;
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 1.5;
  scene.add(sun, sun.target);

  const bounce = new THREE.HemisphereLight("#ffffff", "#c9b9a6", 0);
  scene.add(bounce);

  const lightsRoot = new THREE.Group();
  lightsRoot.name = "lights";
  scene.add(lightsRoot);

  const rigs = new THREE.Group();
  rigs.name = "rigs";
  scene.add(rigs);

  return {
    scene, figures: new Map(), bottle, rigs, lightsRoot, windowLight, sun, sky: skyMat, pendant, bulb: bulbMat, bounce, kitchen, studio,
  };
}

/**
 * A camera rig drawn in free view: a small body, and a frustum running out to
 * the focus distance, ending in the focus plane, so where the lens is sharp is
 * visible from outside the camera.
 */
export function buildRig(
  color: string,
  hfovDeg: number,
  vfovDeg: number,
  focusM: number,
  label: string,
  bodyId: string,
  focalMm: number,
): THREE.Group {
  const g = new THREE.Group();
  g.add(buildCameraBody(bodyId, focalMm));
  const d = Math.max(focusM, 0.3);
  const hx = Math.tan(((hfovDeg / 2) * Math.PI) / 180) * d;
  const hy = Math.tan(((vfovDeg / 2) * Math.PI) / 180) * d;
  const c = [
    new THREE.Vector3(-hx, -hy, -d), new THREE.Vector3(hx, -hy, -d),
    new THREE.Vector3(hx, hy, -d), new THREE.Vector3(-hx, hy, -d),
  ];
  const o = new THREE.Vector3(0, 0, -0.1);
  const pts = [o, c[0], o, c[1], o, c[2], o, c[3], c[0], c[1], c[1], c[2], c[2], c[3], c[3], c[0]];
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  g.add(lines);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(hx * 2, hy * 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }),
  );
  plane.position.z = -d;
  g.add(plane);
  g.add(labelSprite(label, color));
  g.traverse((o) => (o.userData.noOcclude = true));
  return g;
}

function labelSprite(text: string, color: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(8, 16, 240, 64, 18);
  g.fill();
  g.fillStyle = "#fff";
  g.font = "bold 40px Helvetica, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 49);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(0.42, 0.16, 1);
  s.position.set(0, 0.34, 0.1);
  return s;
}

/**
 * Depth of field from the lens, not from a slider. Each pixel's blur diameter
 * is the thin-lens circle of confusion for its depth (lib/previz/optics.ts
 * blurDiameterMm, restated in GLSL), converted from mm on the sensor to pixels
 * across the imaged width. A gather with a front/back test keeps a sharp
 * foreground from smearing over a soft background. Ends with three's tone
 * mapping and colour space chunks, since the scene was rendered linear into a
 * target.
 */
export function dofMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      cNear: { value: 0.05 },
      cFar: { value: 60 },
      focusM: { value: 3 },
      focalMm: { value: 35 },
      stop: { value: 2.8 },
      imgWmm: { value: 28 },
      res: { value: new THREE.Vector2(1, 1) },
      maxR: { value: 22 },
      enabled: { value: 1 },
      zebra: { value: 0 },
      expo: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      #include <packing>
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform float cNear, cFar, focusM, focalMm, stop, imgWmm, maxR, enabled, zebra, expo;
      uniform vec2 res;
      varying vec2 vUv;

      float distM(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        return -perspectiveDepthToViewZ(d, cNear, cFar);
      }
      // Blur RADIUS in pixels for a point at distance d (metres).
      float cocPx(float d) {
        float f = focalMm;
        float s = max(focusM * 1000.0, f * 1.01);
        float p = max(d * 1000.0, f * 1.01);
        float diaMm = (f * f) / (stop * (s - f)) * abs(p - s) / p;
        return min(0.5 * diaMm / imgWmm * res.x, maxR);
      }
      void main() {
        vec4 base = texture2D(tColor, vUv);
        if (enabled < 0.5) {
          gl_FragColor = base;
        } else {
          float dc = distM(vUv);
          float rc = cocPx(dc);
          vec3 acc = base.rgb;
          float wsum = 1.0;
          if (rc > 0.6) {
            const int N = 56;
            for (int i = 1; i < N; i++) {
              float fi = float(i);
              float r = sqrt(fi / float(N)) * rc;
              float a = fi * 2.39996323;
              vec2 o = vec2(cos(a), sin(a)) * r;
              vec2 uv = vUv + o / res;
              float dj = distM(uv);
              float rj = cocPx(dj);
              // A nearer sample only counts if its own blur reaches this pixel.
              float w = dj < dc ? smoothstep(r - 1.0, r + 1.0, rj) : 1.0;
              acc += texture2D(tColor, uv).rgb * w;
              wsum += w;
            }
          }
          gl_FragColor = vec4(acc / wsum, 1.0);
        }
        // Zebras, as on a monitor: diagonal stripes wherever the exposed image
        // is more than about two and a half stops over middle grey, i.e. where
        // it is heading for clipping.
        if (zebra > 0.5) {
          vec3 e = gl_FragColor.rgb * expo;
          if (max(e.r, max(e.g, e.b)) > 1.0) {
            float band = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 14.0));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0), band * 0.85);
          }
        }
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}
