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
  FT, FIXTURES, MODIFIERS, shadowBlur, spotCone, type FrameSpec, type SourceResult,
} from "./lighting";

export type LightSpec = {
  id: string;
  role: string;
  fixtureId: string;
  modifierId: string;
  /** Fresnel spot/flood, in degrees, or null for the modifier's own beam. */
  beamDeg: number | null;
  dimmer: number;
  cct: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** A talent id or "bottle": the head stays pointed at it as things move. */
  aimAt: string | null;
  frame: FrameSpec | null;
  on: boolean;
};

export type GripKind = "bounce" | "silver" | "flag";
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
};

export const GRIP_REFLECTANCE: Record<GripKind, number> = { bounce: 0.8, silver: 1.4, flag: 0 };
export const GRIP_NAMES: Record<GripKind, string> = { bounce: "Bounce (white)", silver: "Bounce (silver)", flag: "Flag (solid)" };

const R = Math.PI / 180;

function mat(color: string, roughness = 0.6, metalness = 0.2) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

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

/** A C-stand: three legs and a riser to the head height. */
function stand(height: number): THREE.Group {
  const g = new THREE.Group();
  const metal = mat("#3a3c40", 0.5, 0.7);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, Math.max(0.1, height), 10), metal);
  riser.position.y = Math.max(0.1, height) / 2;
  g.add(riser);
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 8), metal);
    const a = (i / 3) * Math.PI * 2;
    leg.position.set(Math.cos(a) * 0.22, 0.12, Math.sin(a) * 0.22);
    leg.rotation.set(0, -a, 0);
    leg.rotateZ(Math.PI / 2 - 0.45);
    g.add(leg);
  }
  return g;
}

export type LightRig = {
  /** Unrotated: holds the stand. */
  group: THREE.Group;
  /** Rotated by yaw and pitch: holds the head, modifier, frame and the light. */
  head: THREE.Group;
  standHolder: THREE.Group;
  light: THREE.SpotLight | THREE.PointLight;
  faces: THREE.MeshStandardMaterial[];
  structureKey: string;
};

export function structureKey(s: LightSpec): string {
  const f = s.frame ? `${s.frame.sizeFt}|${s.frame.materialId}` : "none";
  return `${s.fixtureId}|${s.modifierId}|${f}`;
}

/**
 * Builds the fixture, its modifier and its frame. Position, aim, intensity and
 * colour are applied separately by updateLightRig, so dragging a light never
 * rebuilds geometry or reallocates its shadow map.
 */
export function buildLightRig(s: LightSpec): LightRig {
  const fixture = FIXTURES.find((f) => f.id === s.fixtureId) ?? FIXTURES[0];
  const mod = MODIFIERS[s.modifierId] ?? MODIFIERS[fixture.defaultModifier];
  const group = new THREE.Group();
  group.name = `light:${s.id}`;
  const standHolder = new THREE.Group();
  group.add(standHolder);
  const head = new THREE.Group();
  head.rotation.order = "YXZ";
  group.add(head);
  const faces: THREE.MeshStandardMaterial[] = [];
  const body = mat("#202124", 0.45, 0.4);

  const addFace = (geo: THREE.BufferGeometry, z: number) => {
    const m = faceMaterial();
    faces.push(m);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.z = z;
    head.add(mesh);
    return mesh;
  };

  if (fixture.kind === "tube") {
    const tube = addFace(new THREE.CylinderGeometry(0.025, 0.025, fixture.faceH, 16), 0);
    tube.rotation.set(0, 0, 0);
  } else if (fixture.kind === "lantern" || mod.omni) {
    const r = (mod.faceW ?? fixture.faceW) / 2;
    addFace(new THREE.SphereGeometry(r, 24, 16), -r);
    if (fixture.kind !== "lantern") {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.22, 16), body);
      can.rotation.x = Math.PI / 2;
      can.position.z = 0.12;
      head.add(can);
    }
  } else if (fixture.kind === "panel") {
    const box = new THREE.Mesh(new THREE.BoxGeometry(fixture.faceW + 0.04, fixture.faceH + 0.04, 0.08), body);
    box.position.z = 0.05;
    head.add(box);
    addFace(new THREE.PlaneGeometry(fixture.faceW, fixture.faceH), -0.0);
    if (s.modifierId === "grid") {
      const grid = new THREE.Mesh(
        new THREE.BoxGeometry(fixture.faceW + 0.04, fixture.faceH + 0.04, 0.08),
        new THREE.MeshStandardMaterial({ color: "#111", wireframe: true }),
      );
      grid.position.z = -0.04;
      head.add(grid);
    }
  } else {
    // Point-source heads: a body, then the modifier in front of it.
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.28, 18), body);
    can.rotation.x = Math.PI / 2;
    can.position.z = 0.14;
    head.add(can);
    if (s.modifierId === "reflector") {
      const refl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.09, 0.16, 24, 1, true), mat("#cfd2d6", 0.25, 0.9));
      refl.rotation.x = Math.PI / 2;
      refl.position.z = -0.08;
      head.add(refl);
      addFace(new THREE.CircleGeometry(0.06, 20), -0.02);
    } else if (s.modifierId === "fresnel") {
      addFace(new THREE.CircleGeometry(0.09, 24), -0.005);
    } else {
      // Dome, softbox or stripbox: a frustum out to a glowing face.
      const w = mod.faceW ?? 0.9;
      const h = mod.faceH ?? 0.9;
      const depth = s.modifierId === "dome" ? 0.55 : 0.4;
      const round = s.modifierId === "dome";
      const shell = new THREE.Mesh(
        round
          ? new THREE.CylinderGeometry(w / 2, 0.12, depth, 16, 1, true)
          : new THREE.CylinderGeometry(Math.SQRT1_2 * Math.max(w, h), 0.12, depth, 4, 1, true),
        new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.9, side: THREE.DoubleSide }),
      );
      shell.rotation.x = Math.PI / 2;
      if (!round) shell.rotation.y = Math.PI / 4;
      shell.position.z = -depth / 2;
      if (!round) shell.scale.set(w / Math.max(w, h), 1, h / Math.max(w, h));
      head.add(shell);
      addFace(round ? new THREE.CircleGeometry(w / 2, 24) : new THREE.PlaneGeometry(w, h), -depth);
    }
  }

  // A diffusion frame: four pipes and a cloth, square to the light.
  if (s.frame && !mod.omni) {
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
  if (fixture.kind === "lantern" || mod.omni) {
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
  tag(group);
  return { group, head, standHolder, light, faces, structureKey: structureKey(s) };
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
) {
  rig.group.position.set(s.x, 0, s.z);
  rig.head.position.set(0, s.y, 0);
  rig.head.rotation.set(aim.pitch * R, aim.yaw * R, 0);
  if (rig.standHolder.userData.h !== s.y) {
    rig.standHolder.clear();
    rig.standHolder.add(tag(stand(s.y - 0.12)));
    rig.standHolder.userData.h = s.y;
  }
  const frame = rig.head.getObjectByName("frame");
  if (frame && s.frame) frame.position.z = -s.frame.distM;

  const c = new THREE.Color(color[0], color[1], color[2]);
  const lit = s.on ? 1 : 0;
  rig.light.color.copy(c);
  rig.light.intensity = src.candela * lit;
  rig.light.castShadow = castShadow && s.on;
  rig.light.position.set(0, 0, -src.offsetM - 0.03);
  if ((rig.light as THREE.SpotLight).isSpotLight) {
    const sp = rig.light as THREE.SpotLight;
    const cone = spotCone(src.beamDeg);
    sp.angle = cone.angle;
    sp.penumbra = cone.penumbra;
    sp.shadow.radius = shadowBlur(softDeg);
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
  const pipe = mat("#5d6166", 0.4, 0.8);
  for (const [w, h, x, y] of [
    [side, 0.025, 0, side / 2], [side, 0.025, 0, -side / 2], [0.025, side, side / 2, 0], [0.025, side, -side / 2, 0],
  ] as const) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.025), pipe);
    p.position.set(x, y, 0);
    p.userData.noOcclude = true;
    board.add(p);
  }
  let light: THREE.SpotLight | null = null;
  if (g.kind !== "flag") {
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
    holder.add(tag(stand(g.y - (g.sizeFt * FT) / 2)));
    holder.userData.h = g.y;
  }
  if (rig.light) {
    rig.light.color.setRGB(color[0], color[1], color[2]);
    rig.light.intensity = bounceCandela;
  }
}
