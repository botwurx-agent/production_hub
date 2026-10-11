// The 3D side of the prototype's lighting: fixtures on stands, their
// modifiers, diffusion frames, flags and bounce boards, and the three.js light
// each one casts. The numbers all come from lib/previz/lighting.ts, so what a
// light does in the picture is what the meter reads.
//
// Conventions match the cameras: a head looks down its local -Z, yaw turns it
// about Y (0 faces the back wall) and pitch tilts it. Everything that only
// draws a fixture is tagged noOcclude, so the meter's shadow rays pass through
// stands and softboxes and only stop at the set, the people and the flags.
import * as THREE from "three";
import {
  FT, FIXTURES, MODIFIERS, shadowBlur, spotCone, type FrameSpec, type LightColor, type SourceResult,
} from "./lighting";
import { buildFixture, buildStand, faceMaterial } from "./gear-models";
import { PATTERNS, clampOpen, isPattern, leafSizeM, rng, seedOf, type PatternKind } from "./patterns";

export { faceMaterial };

export type LightSpec = {
  id: string;
  role: string;
  fixtureId: string;
  modifierId: string;
  /** Fresnel spot/flood, in degrees, or null for the modifier's own beam. */
  beamDeg: number | null;
  dimmer: number;
  cct: number;
  /** An RGB fixture in its HSI mode; absent or null is white at the CCT. */
  color?: LightColor | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** A talent id or "bottle": the head stays pointed at it as things move. */
  aimAt: string | null;
  frame: FrameSpec | null;
  on: boolean;
  /** The rig (a set item: grid, spreader, polecat) it hangs from; absent or
   * null is on a stand. */
  hangFrom?: string | null;
  /** Resolved at runtime, never saved: the hung-from pipe's centre height. */
  hungY?: number | null;
};

export type GripKind = "bounce" | "silver" | "flag" | PatternKind;
export type GripSpec = {
  id: string;
  kind: GripKind;
  sizeFt: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  aimAt: string | null;
  /** Patterns: which holes, leaves or panes it draws. Absent is from the id. */
  seed?: number;
  /** Blinds: how far open, 0.1 to 1. */
  open?: number;
};

export const GRIP_REFLECTANCE: Record<GripKind, number> = {
  bounce: 0.8, silver: 1.4, flag: 0, cookie: 0, branch: 0, blinds: 0, windowpane: 0,
};
export const GRIP_NAMES: Record<GripKind, string> = {
  bounce: "Bounce (white)", silver: "Bounce (silver)", flag: "Flag (solid)",
  cookie: PATTERNS.cookie.name, branch: PATTERNS.branch.name, blinds: PATTERNS.blinds.name, windowpane: PATTERNS.windowpane.name,
};
/** The colour a grip is drawn in on the rail and the map. */
export const GRIP_DOT: Record<GripKind, string> = {
  bounce: "#f2f2ee", silver: "#c8ccd2", flag: "#1d1d1f", cookie: "#b08a5a", branch: "#5b7a3a", blinds: "#d9d4ca", windowpane: "#3a3a3c",
};
/** What makes a grip's drawing change, so a rig is rebuilt only then. */
export function gripKey(g: GripSpec): string {
  return `${g.kind}|${g.sizeFt}|${g.seed ?? ""}|${g.kind === "blinds" ? clampOpen(g.open).toFixed(2) : ""}`;
}

const R = Math.PI / 180;

function mat(color: string, roughness = 0.6, metalness = 0.2) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function tag(o: THREE.Object3D) {
  o.traverse((c) => {
    c.userData.noOcclude = true;
    if ((c as THREE.Mesh).isMesh) {
      (c as THREE.Mesh).castShadow = false;
      (c as THREE.Mesh).receiveShadow = false;
    }
  });
  return o;
}

export type LightRig = {
  /** Unrotated: holds the stand and anything on the floor. */
  group: THREE.Group;
  /** Pans (yaw only): the yoke. */
  yoke: THREE.Group;
  /** Tilts inside the yoke (pitch only): body, modifier, frame and the light. */
  head: THREE.Group;
  standHolder: THREE.Group;
  base: THREE.Group;
  light: THREE.SpotLight | THREE.PointLight;
  /** With a diffusion frame: the beam that goes straight through the cloth,
   * kept at the fixture. `light` is then the glow off the frame. */
  through: THREE.SpotLight | null;
  faces: THREE.MeshStandardMaterial[];
  faceZ: number;
  yokeDrop: number;
  heavy: boolean;
  ownStand: boolean;
  structureKey: string;
};

const clearances = new Map<string, number>();
/**
 * How far a hung light's centre has to sit under its spigot: the yoke, or for
 * a China ball its own radius and socket. Measured off the model once per
 * fixture and modifier, since that is the only place the number lives.
 */
export function hangClearance(fixtureId: string, modifierId: string): number {
  const key = `${fixtureId}|${modifierId}`;
  const known = clearances.get(key);
  if (known !== undefined) return known;
  const fixture = FIXTURES.find((f) => f.id === fixtureId) ?? FIXTURES[0];
  const v = fixture.kind === "lantern"
    ? fixture.faceW / 2 + 0.06
    : buildFixture(fixture, MODIFIERS[modifierId] ? modifierId : fixture.defaultModifier).yokeDrop;
  clearances.set(key, v);
  return v;
}

/** A pipe clamp on the rig and a drop down to the light's spigot (or its cord). */
function buildHanger(top: number, bottom: number, lantern: boolean): THREE.Group {
  const g = new THREE.Group();
  const steel = mat("#9aa0a6", 0.4, 0.8);
  const black = mat("#1c1c1e", 0.6, 0.3);
  const len = Math.max(0.02, top - 0.04 - bottom);
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(lantern ? 0.004 : 0.013, lantern ? 0.004 : 0.013, len, lantern ? 6 : 12), lantern ? black : steel);
  drop.position.y = bottom + len / 2;
  g.add(drop);
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.07, 0.07), black);
  clamp.position.y = top;
  g.add(clamp);
  if (!lantern) {
    // The pin's collar where it seats in the fixture's yoke.
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 12), black);
    collar.position.y = bottom + 0.02;
    g.add(collar);
  }
  return g;
}

export function structureKey(s: LightSpec): string {
  const f = s.frame ? `${s.frame.sizeFt}|${s.frame.materialId}` : "none";
  return `${s.fixtureId}|${s.modifierId}|${f}`;
}

/**
 * Builds the fixture (lib/previz/gear-models.ts), its modifier and its frame.
 * Position, aim, intensity and colour are applied separately by
 * updateLightRig, so dragging a light never rebuilds geometry or reallocates
 * its shadow map.
 */
export function buildLightRig(s: LightSpec): LightRig {
  const fixture = FIXTURES.find((f) => f.id === s.fixtureId) ?? FIXTURES[0];
  const mod = MODIFIERS[s.modifierId] ?? MODIFIERS[fixture.defaultModifier];
  const group = new THREE.Group();
  group.name = `light:${s.id}`;
  const standHolder = new THREE.Group();
  group.add(standHolder);
  const model = buildFixture(fixture, mod ? s.modifierId : fixture.defaultModifier);
  const { yoke, head, base, faces } = model;
  group.add(yoke);
  group.add(base);

  // A diffusion frame: four pipes and a cloth, square to the light.
  if (s.frame && !mod?.omni && fixture.kind !== "lantern") {
    const side = s.frame.sizeFt * FT;
    const pipe = mat("#9aa0a6", 0.4, 0.8);
    const frame = new THREE.Group();
    frame.name = "frame";
    for (const [w, h, x, y] of [
      [side, 0.03, 0, side / 2], [side, 0.03, 0, -side / 2], [0.03, side, side / 2, 0], [0.03, side, -side / 2, 0],
    ] as const) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), pipe);
      p.position.set(x, y, 0);
      frame.add(p);
    }
    const clothMat = faceMaterial();
    clothMat.transparent = true;
    clothMat.opacity = 0.9;
    faces.push(clothMat);
    frame.add(new THREE.Mesh(new THREE.PlaneGeometry(side, side), clothMat));
    head.add(frame);
  }

  let light: THREE.SpotLight | THREE.PointLight;
  if (fixture.kind === "lantern" || mod?.omni) {
    const p = new THREE.PointLight("#ffffff", 0, 0, 2);
    p.castShadow = true;
    p.shadow.mapSize.set(512, 512);
    p.shadow.bias = -0.002;
    p.shadow.radius = 10;
    light = p;
  } else {
    const sp = new THREE.SpotLight("#ffffff", 0, 0, 0.5, 0.5, 2);
    sp.castShadow = true;
    sp.shadow.mapSize.set(1024, 1024);
    sp.shadow.camera.near = 0.1;
    sp.shadow.camera.far = 25;
    sp.shadow.bias = -0.0006;
    sp.shadow.blurSamples = 16;
    const target = new THREE.Object3D();
    target.position.set(0, 0, -1);
    head.add(target);
    sp.target = target;
    light = sp;
  }
  head.add(light);
  let through: THREE.SpotLight | null = null;
  if (s.frame && !(fixture.kind === "lantern" || mod?.omni)) {
    through = new THREE.SpotLight("#ffffff", 0, 0, 0.5, 0.45, 2);
    through.shadow.mapSize.set(1024, 1024);
    through.shadow.camera.near = 0.1;
    through.shadow.camera.far = 25;
    through.shadow.bias = -0.0006;
    through.shadow.blurSamples = 16;
    const t = new THREE.Object3D();
    t.position.set(0, 0, model.faceZ - 1);
    head.add(t);
    through.target = t;
    through.position.set(0, 0, model.faceZ - 0.03);
    head.add(through);
  }
  tag(group);
  return {
    group, yoke, head, standHolder, base, light, through, faces,
    faceZ: model.faceZ, yokeDrop: model.yokeDrop, heavy: model.heavy, ownStand: model.ownStand,
    structureKey: structureKey(s),
  };
}

/** Applies placement, aim, intensity, colour and softness to a built rig. */
export function updateLightRig(
  rig: LightRig,
  s: LightSpec,
  aim: { yaw: number; pitch: number },
  src: SourceResult,
  softDeg: number,
  color: [number, number, number],
  castShadow: boolean,
  through: { candela: number; beamDeg: number; softDeg: number; cast: boolean } | null = null,
) {
  rig.group.position.set(s.x, 0, s.z);
  rig.yoke.position.set(0, s.y, 0);
  // Hung from a pipe, a fixture hangs upside down off its yoke: the yoke is
  // turned over, so the head's tilt runs the other way to aim the same.
  const hung = typeof s.hungY === "number";
  const flip = hung && !rig.ownStand;
  rig.yoke.rotation.set(0, aim.yaw * R, flip ? Math.PI : 0);
  rig.head.rotation.set((flip ? -1 : 1) * aim.pitch * R, 0, 0);
  const placeKey = `${s.y}|${hung ? s.hungY : ""}`;
  if (rig.standHolder.userData.h !== placeKey) {
    rig.standHolder.clear();
    rig.yoke.getObjectByName("boomstand")?.removeFromParent();
    for (const n of ["boomArm", "boomKnuckle", "boomCord"]) {
      const o = rig.yoke.getObjectByName(n);
      if (o) o.visible = !hung;
    }
    if (hung) {
      const spigot = rig.ownStand ? s.y + hangClearance(s.fixtureId, s.modifierId) - 0.01 : s.y + rig.yokeDrop;
      rig.standHolder.add(tag(buildHanger(s.hungY as number, spigot, rig.ownStand)));
      // A box light enough to hang rides on the drop; anything else is on the floor.
      const room = (s.hungY as number) - spigot;
      rig.base.traverse((o) => {
        if (typeof o.userData.onStand !== "number") return;
        if (o.userData.onStand >= 0.3 && room > 0.4) o.position.set(0, spigot + 0.18, 0.06);
        else o.position.set(0.32, 0.12, 0.18);
      });
    } else if (rig.ownStand) {
      // A boom: the stand goes up behind the light to the arm's height.
      const boom = rig.yoke.userData.boom as { y: number; z: number } | undefined;
      const stand = buildStand(s.y + (boom?.y ?? 0.5), false);
      stand.name = "boomstand";
      stand.position.set(0, -s.y, boom?.z ?? 1);
      rig.yoke.add(tag(stand));
    } else {
      rig.standHolder.add(tag(buildStand(s.y - rig.yokeDrop - 0.03, rig.heavy)));
    }
    if (!hung) {
      // A control box rides on the stand at a working height.
      rig.base.traverse((o) => {
        if (typeof o.userData.onStand === "number") {
          // A box too heavy to hang sits on the floor beside the stand instead.
          if (o.userData.onStand < 0.3) o.position.set(0.32, o.userData.onStand, 0.18);
          else o.position.set(0, Math.min(o.userData.onStand, Math.max(0.3, s.y - 0.5)), 0.06);
        }
      });
    }
    rig.standHolder.userData.h = placeKey;
  }
  const frame = rig.head.getObjectByName("frame");
  if (frame && s.frame) frame.position.z = -s.frame.distM;

  const c = new THREE.Color(color[0], color[1], color[2]);
  const lit = s.on ? 1 : 0;
  rig.light.color.copy(c);
  rig.light.intensity = src.candela * lit;
  rig.light.castShadow = castShadow && s.on;
  // The source sits on the glowing face, or on the frame when there is one.
  const z = Math.min(rig.faceZ, -src.offsetM) - 0.03;
  rig.light.position.set(0, 0, z);
  if ((rig.light as THREE.SpotLight).isSpotLight) {
    const sp = rig.light as THREE.SpotLight;
    // The aim point travels with the light. It used to stay a metre in front
    // of the fixture, so a frame further out than that put the light past its
    // own target and turned it round to face the fixture.
    sp.target.position.set(0, 0, z - 1);
    const cone = spotCone(src.beamDeg);
    sp.angle = cone.angle;
    sp.penumbra = cone.penumbra;
    sp.shadow.radius = shadowBlur(softDeg);
  }
  if (rig.through) {
    const t = rig.through;
    t.color.copy(c);
    t.intensity = (through?.candela ?? 0) * lit;
    t.castShadow = !!through?.cast && s.on;
    const cone = spotCone(through?.beamDeg ?? 60);
    t.angle = cone.angle;
    t.penumbra = cone.penumbra;
    t.shadow.radius = shadowBlur(through?.softDeg ?? 1);
  }
  // The face glows at the brightness a viewer would see: the fixture's own
  // face, or the cloth when a frame is in front of it.
  for (const m of rig.faces) {
    m.emissive.copy(c);
    m.emissiveIntensity = src.faceNits * lit;
  }
}

export type GripRig = { group: THREE.Group; board: THREE.Group; light: THREE.SpotLight | null };

/** A flag or a bounce board on its stand. A board blocks light either way. */
export function buildGripRig(g: GripSpec): GripRig {
  const group = new THREE.Group();
  group.name = `grip:${g.id}`;
  const board = new THREE.Group();
  board.rotation.order = "YXZ";
  group.add(board);
  const side = g.sizeFt * FT;
  if (isPattern(g.kind)) {
    board.add(buildPattern(g.kind, side, g.seed ?? seedOf(g.id), clampOpen(g.open)));
  } else {
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(side, side),
      new THREE.MeshStandardMaterial({
        color: g.kind === "flag" ? "#0b0b0c" : g.kind === "silver" ? "#c8ccd2" : "#f2f2ee",
        roughness: g.kind === "silver" ? 0.3 : 0.95,
        metalness: g.kind === "silver" ? 0.6 : 0,
        side: THREE.DoubleSide,
      }),
    );
    surface.castShadow = true;
    surface.receiveShadow = true;
    surface.userData.grip = true;
    board.add(surface);
  }
  if (g.kind !== "branch") {
    const pipe = mat("#5d6166", 0.4, 0.8);
    for (const [w, h, x, y] of [
      [side, 0.025, 0, side / 2], [side, 0.025, 0, -side / 2], [0.025, side, side / 2, 0], [0.025, side, -side / 2, 0],
    ] as const) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.025), pipe);
      p.position.set(x, y, 0);
      p.userData.noOcclude = true;
      board.add(p);
    }
  }
  let light: THREE.SpotLight | null = null;
  if (GRIP_REFLECTANCE[g.kind] > 0) {
    light = new THREE.SpotLight("#ffffff", 0, 0, 89 * R, 1, 2);
    light.castShadow = false;
    const target = new THREE.Object3D();
    target.position.set(0, 0, -1);
    board.add(target);
    light.target = target;
    light.position.set(0, 0, -0.05);
    board.add(light);
  }
  const standHolder = new THREE.Group();
  standHolder.name = "stand";
  group.add(standHolder);
  return { group, board, light };
}

/**
 * Soften a light's shadows to the blur a pattern in front of it really gets:
 * source size x pattern-to-subject / source-to-pattern (lib/previz/patterns.ts
 * works it out, the meter's readPatterns hands it over). Shadows here are
 * blurred per LIGHT in shadow-map texels, so the blur is turned into texels at
 * the subject's distance. Only ever raises the blur the light already has, so
 * a cookie in front of a big source washes out the way a real one does rather
 * than throwing a crisp pattern it never could.
 */
export function softenForPattern(rig: LightRig, blurM: number, distM: number) {
  if (!(blurM > 0) || !(distM > 0)) return;
  for (const l of [rig.light, rig.through]) {
    if (!l) continue;
    const fov = (l as THREE.SpotLight).isSpotLight ? (l as THREE.SpotLight).angle * 2 : Math.PI / 2;
    const texel = (2 * distM * Math.tan(Math.min(fov, 3) / 2)) / l.shadow.mapSize.x;
    const r = Math.min(40, blurM / texel);
    if (l.shadow.radius < r) l.shadow.radius = r;
  }
}

// --- Patterns ---------------------------------------------------------------
// Each is a cutout: an alpha map with alphaTest, which three.js carries into
// the shadow pass by itself, so the light throws the real holes, slats or
// leaves (softened per light by softenForPattern). They are tagged noOcclude: the meter takes their AVERAGE
// transmission (lib/previz/patterns.ts) rather than tracing every hole.

function cutoutCanvas(px: number, draw: (c: CanvasRenderingContext2D, n: number) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const c = canvas.getContext("2d")!;
  // White is solid, black is a hole.
  c.fillStyle = "#fff";
  c.fillRect(0, 0, px, px);
  c.fillStyle = "#000";
  draw(c, px);
  return canvas;
}

function texOf(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.anisotropy = 4;
  return t;
}

/** A smooth closed blob round (cx, cy), drawn as a hole. */
function blob(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, rand: () => number) {
  const k = 7 + Math.floor(rand() * 4);
  const pts: [number, number][] = [];
  const stretch = 0.55 + rand() * 0.9;
  const turn = rand() * Math.PI;
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2;
    const rr = r * (0.6 + rand() * 0.6);
    const x = Math.cos(a) * rr * stretch;
    const y = Math.sin(a) * rr;
    pts.push([cx + x * Math.cos(turn) - y * Math.sin(turn), cy + x * Math.sin(turn) + y * Math.cos(turn)]);
  }
  c.beginPath();
  const mid = (i: number) => {
    const a = pts[i % k];
    const b = pts[(i + 1) % k];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  };
  const m0 = mid(0);
  c.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= k; i++) {
    const p = pts[i % k];
    const m = mid(i);
    c.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  c.closePath();
  c.fill();
}

function cutoutBoard(side: number, tex: THREE.Texture, color: string, roughness = 0.85): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(side, side),
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, alphaMap: tex, alphaTest: 0.5, side: THREE.DoubleSide }),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.noOcclude = true;
  m.userData.grip = true;
  return m;
}

function boardPattern(side: number, canvas: HTMLCanvasElement, color: string, roughness?: number): THREE.Mesh {
  return cutoutBoard(side, texOf(canvas), color, roughness);
}

function buildPattern(kind: PatternKind, side: number, seed: number, open: number): THREE.Object3D {
  const rand = rng(seed);
  if (kind === "cookie") {
    const canvas = cutoutCanvas(512, (c, n) => {
      // Holes sized off the board so a 2x2 and a 4x4 read alike in scale of
      // their own surface; a margin keeps the board in one piece.
      const holes = 26 + Math.floor(rand() * 10);
      const margin = n * 0.08;
      for (let i = 0; i < holes; i++) {
        const r = n * (0.035 + rand() * 0.05);
        blob(c, margin + rand() * (n - 2 * margin), margin + rand() * (n - 2 * margin), r, rand);
      }
    });
    return boardPattern(side, canvas, "#b08a5a");
  }
  if (kind === "blinds") {
    // A slat about 2 in deep whatever the board's size; opening them narrows
    // the slat's shadow (it turns edge on) and widens the gap.
    const slats = Math.max(6, Math.round(side / 0.05));
    const canvas = cutoutCanvas(512, (c, n) => {
      const pitch = n / slats;
      const gap = pitch * Math.min(0.92, 0.12 + open * 0.8);
      for (let i = 0; i < slats; i++) c.fillRect(0, i * pitch, n, gap);
      // The ladder tapes that hold the slats.
      c.fillStyle = "#fff";
      for (const f of [0.22, 0.78]) c.fillRect(n * f - 2, 0, 4, n);
    });
    return boardPattern(side, canvas, "#e2ddd3", 0.6);
  }
  if (kind === "windowpane") {
    const cols = 2 + (rand() < 0.5 ? 0 : 1);
    const rows = 2 + (rand() < 0.5 ? 0 : 1);
    const canvas = cutoutCanvas(512, (c, n) => {
      const frame = n * 0.07;
      const mull = n * 0.035;
      const w = (n - 2 * frame - (cols - 1) * mull) / cols;
      const h = (n - 2 * frame - (rows - 1) * mull) / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) c.fillRect(frame + i * (w + mull), frame + j * (h + mull), w, h);
      }
    });
    return boardPattern(side, canvas, "#2b2b2d");
  }
  return buildBranch(side, rand);
}

/** A leafy branch held up on the stand's arm, filling about the board's square. */
function buildBranch(side: number, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const bark = mat("#5b4632", 0.9, 0);
  // One leaf, solid (white) on open (black).
  const leafCanvas = cutoutCanvas(128, (c, n) => {
    c.fillRect(0, 0, n, n);
    c.fillStyle = "#fff";
    c.beginPath();
    c.moveTo(n * 0.5, n * 0.04);
    c.quadraticCurveTo(n * 0.95, n * 0.45, n * 0.5, n * 0.96);
    c.quadraticCurveTo(n * 0.05, n * 0.45, n * 0.5, n * 0.04);
    c.fill();
  });
  const tex = texOf(leafCanvas);
  const leafMat = new THREE.MeshStandardMaterial({ color: "#4f6f33", roughness: 0.8, alphaMap: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  const leafSize = leafSizeM(side);
  const leaves: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const half = side / 2;
  // A main stem rising from the bottom, and limbs off it to either side.
  const stem = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const d = b.clone().sub(a);
    const len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, len, 6), bark);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.castShadow = true;
    m.userData.noOcclude = true;
    g.add(m);
  };
  const base = new THREE.Vector3(0, -half, 0);
  const top = new THREE.Vector3((rand() - 0.5) * side * 0.2, half * 0.9, (rand() - 0.5) * 0.1);
  stem(base, top, 0.018);
  const limbs = 6 + Math.floor(rand() * 3);
  for (let i = 0; i < limbs; i++) {
    const t = 0.25 + (i / limbs) * 0.7;
    const from = base.clone().lerp(top, t);
    const dir = (i % 2 === 0 ? 1 : -1) * (0.6 + rand() * 0.4);
    const to = from.clone().add(new THREE.Vector3(dir * half * (0.55 + rand() * 0.35), half * (0.1 + rand() * 0.35), (rand() - 0.5) * 0.25));
    stem(from, to, 0.009);
    // Leaves along the limb, thickest toward its end, each turned its own way.
    const n = 14 + Math.floor(rand() * 10);
    for (let k = 0; k < n; k++) {
      const u = 0.25 + rand() * 0.8;
      const p = from.clone().lerp(to, Math.min(1, u)).add(new THREE.Vector3(
        (rand() - 0.5) * leafSize * 2.4, (rand() - 0.5) * leafSize * 2.4, (rand() - 0.5) * leafSize * 1.5,
      ));
      e.set((rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4, rand() * Math.PI * 2);
      q.setFromEuler(e);
      const sc = leafSize * (0.7 + rand() * 0.6);
      leaves.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(sc * 0.6, sc, 1)));
    }
  }
  const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), leafMat, leaves.length);
  leaves.forEach((m, i) => inst.setMatrixAt(i, m));
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.userData.noOcclude = true;
  inst.userData.grip = true;
  g.add(inst);
  return g;
}

export function updateGripRig(
  rig: GripRig,
  g: GripSpec,
  aim: { yaw: number; pitch: number },
  bounceCandela: number,
  color: [number, number, number],
) {
  rig.group.position.set(g.x, 0, g.z);
  rig.board.position.set(0, g.y, 0);
  rig.board.rotation.set(aim.pitch * R, aim.yaw * R, 0);
  const holder = rig.group.getObjectByName("stand") as THREE.Group;
  if (holder.userData.h !== g.y) {
    holder.clear();
    holder.add(tag(buildStand(g.y - (g.sizeFt * FT) / 2, false)));
    holder.userData.h = g.y;
  }
  if (rig.light) {
    rig.light.color.setRGB(color[0], color[1], color[2]);
    rig.light.intensity = bounceCandela;
  }
}
