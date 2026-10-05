// The 3D world for the Scene Setup PROTOTYPE (app/dev/scene-setup): the empty
// stage and its light roots, stylised talent, the camera rigs shown in free
// view, and the depth of field pass. The room is lib/previz/room.ts and
// everything placed on the set is lib/previz/set-items.ts.
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
  /** A prop held in the right hand (an item id), or nothing. */
  holding?: string | null;
  /** Where they walk to as the shot plays, if anywhere. */
  mark?: { x: number; z: number; facing: number } | null;
  /** Resolved at runtime, never saved: lifted by a riser or an apple box. */
  y?: number;
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

  g.position.set(t.x, t.y ?? 0, t.z);
  g.rotation.y = (t.facing * Math.PI) / 180;
  return g;
}

/** Eye-line height of a figure, where "focus on" pulls to. */
export function eyeHeight(t: TalentSpec): number {
  return (t.y ?? 0) + eyeY(poseDef(t.pose), t.heightM);
}

/** Where the right hand is in the world: a held prop sits in it. */
export function handWorld(t: TalentSpec): { x: number; y: number; z: number } {
  const [hx, hy, hz] = rightHand(poseDef(t.pose), t.heightM);
  const r = (t.facing * Math.PI) / 180;
  return { x: t.x + hx * Math.cos(r) + hz * Math.sin(r), y: (t.y ?? 0) + hy, z: t.z - hx * Math.sin(r) + hz * Math.cos(r) };
}

export type Built = {
  scene: THREE.Scene;
  figures: Map<string, THREE.Group>;
  rigs: THREE.Group;
  /** Holds the movable fixtures, flags and bounce boards. */
  lightsRoot: THREE.Group;
  /** The open stage's floor, shown when the set is a stage rather than a room. */
  stage: THREE.Group;
  /** The room shell (rebuilt when its measurements change). */
  roomRoot: THREE.Group;
  /** Everything placed on the set. */
  itemsRoot: THREE.Group;
  /** Daylight from outside each window, made per window. */
  windowsRoot: THREE.Group;
  sun: THREE.DirectionalLight;
  /** Light bouncing round the set, as one averaged level. */
  bounce: THREE.HemisphereLight;
};

/** The empty world: a dark stage, the light roots, sun and room bounce. */
export function buildWorld(renderer: THREE.WebGLRenderer): Built {
  const scene = new THREE.Scene();
  // Beyond the set is a dark stage, which is what a real set has around it.
  scene.background = new THREE.Color("#0a0b0d");
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0;

  const stage = new THREE.Group();
  stage.name = "stage";
  stage.add(buildStageFloor());
  scene.add(stage);
  const roomRoot = new THREE.Group();
  roomRoot.name = "roomRoot";
  scene.add(roomRoot);
  const itemsRoot = new THREE.Group();
  itemsRoot.name = "items";
  scene.add(itemsRoot);
  const windowsRoot = new THREE.Group();
  windowsRoot.name = "windows";
  scene.add(windowsRoot);

  const sun = new THREE.DirectionalLight("#ffffff", 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.far = 40;
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

  return { scene, figures: new Map(), rigs, lightsRoot, stage, roomRoot, itemsRoot, windowsRoot, sun, bounce };
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
