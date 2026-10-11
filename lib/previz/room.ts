// A room built from measurements, for the Scene Setup prototype. Width, depth
// and height, which walls exist, and the windows and doors cut into them. The
// kitchen the prototype opened on is one preset of this, not a special case.
//
// Coordinates: metres, Y up. The back wall is the low-Z side (the wall a
// camera usually faces), the camera side is +Z. A room is placed by its
// back-left inside corner (x, z). Walls are single inward-facing planes, so
// from outside, in free view, you look straight in (a dollhouse), while from
// inside they are solid and cast shadows.
//
// An opening is measured the way somebody with a tape would measure it: its
// CENTRE, in metres from the wall's start corner. The back and front walls
// start at the left corner; the left and right walls start at the back corner.
import * as THREE from "three";

export type WallId = "back" | "left" | "right" | "front";
export const WALLS: { id: WallId; name: string; from: string }[] = [
  { id: "back", name: "Back wall", from: "from the left corner" },
  { id: "left", name: "Left wall", from: "from the back corner" },
  { id: "right", name: "Right wall", from: "from the back corner" },
  { id: "front", name: "Front wall", from: "from the left corner" },
];

export type FloorKind = "wood" | "concrete" | "tile" | "carpet" | "stage";
export const FLOORS: { id: FloorKind; name: string; color: string }[] = [
  { id: "wood", name: "Wood boards", color: "#a3784f" },
  { id: "concrete", name: "Concrete", color: "#8f8c87" },
  { id: "tile", name: "Tile", color: "#d9d4ca" },
  { id: "carpet", name: "Carpet", color: "#77695b" },
  { id: "stage", name: "Stage (painted black)", color: "#2b2c2e" },
];

export type Opening = {
  id: string;
  wall: WallId;
  kind: "window" | "door";
  /** Centre of the opening, metres from the wall's start corner. */
  at: number;
  width: number;
  /** Bottom of the opening (0 for a door). */
  sill: number;
  /** Top of the opening. */
  top: number;
};

export type RoomSpec = {
  /** The back-left inside corner. */
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  wallColor: string;
  floor: FloorKind;
  walls: Record<WallId, boolean>;
  openings: Opening[];
};

/** The set: an open stage (black, no walls) or a room. */
export type SetSpec = { kind: "stage" | "room"; room: RoomSpec };

export const KITCHEN_ROOM: RoomSpec = {
  x: -4.06, z: -2.56, width: 8.5, depth: 7.5, height: 3.2, wallColor: "#d8d0c3", floor: "wood",
  walls: { back: true, left: true, right: false, front: false },
  openings: [{ id: "w1", wall: "left", kind: "window", at: 2.16, width: 1.7, sill: 0.9, top: 2.4 }],
};

export function emptyRoom(width = 5, depth = 6, height = 2.8): RoomSpec {
  return {
    x: -width / 2, z: -depth * 0.45, width, depth, height, wallColor: "#e3ddd2", floor: "wood",
    walls: { back: true, left: true, right: true, front: false },
    openings: [
      { id: `o${Date.now()}a`, wall: "left", kind: "window", at: depth * 0.4, width: 1.5, sill: 0.85, top: 2.2 },
    ],
  };
}

export function wallLength(r: RoomSpec, w: WallId): number {
  return w === "back" || w === "front" ? r.width : r.depth;
}

/** A point on a wall's inside face: `u` along it from its start corner, `v` up. */
export function wallPoint(r: RoomSpec, w: WallId, u: number, v: number): THREE.Vector3 {
  if (w === "back") return new THREE.Vector3(r.x + u, v, r.z);
  if (w === "front") return new THREE.Vector3(r.x + u, v, r.z + r.depth);
  if (w === "left") return new THREE.Vector3(r.x, v, r.z + u);
  return new THREE.Vector3(r.x + r.width, v, r.z + u);
}

/** Into the room, from a wall. */
export function wallInward(w: WallId): THREE.Vector3 {
  if (w === "back") return new THREE.Vector3(0, 0, 1);
  if (w === "front") return new THREE.Vector3(0, 0, -1);
  if (w === "left") return new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3(-1, 0, 0);
}

/** The Y rotation that turns a plane (normal +Z) to face into the room off a wall. */
function wallYaw(w: WallId): number {
  return w === "back" ? 0 : w === "front" ? Math.PI : w === "left" ? Math.PI / 2 : -Math.PI / 2;
}

/**
 * Keeps an opening inside its wall and its sill below its top, so a typed
 * number can never produce a hole that runs off the end of the wall.
 */
export function clampOpening(r: RoomSpec, o: Opening): Opening {
  const L = wallLength(r, o.wall);
  const width = Math.max(0.3, Math.min(L - 0.1, o.width));
  const at = Math.max(width / 2 + 0.05, Math.min(L - width / 2 - 0.05, o.at));
  const top = Math.max(0.5, Math.min(r.height - 0.05, o.top));
  const sill = o.kind === "door" ? 0 : Math.max(0, Math.min(top - 0.3, o.sill));
  return { ...o, width, at, top, sill };
}

export type WindowInfo = {
  id: string;
  wall: WallId;
  /** Centre of the opening on the inside face of its wall. */
  centre: THREE.Vector3;
  inward: THREE.Vector3;
  width: number;
  sill: number;
  top: number;
  area: number;
};

/** Every window in the room, as the light and the meter need it. */
export function roomWindows(r: RoomSpec): WindowInfo[] {
  return r.openings
    .filter((o) => o.kind === "window" && r.walls[o.wall])
    .map((raw) => {
      const o = clampOpening(r, raw);
      return {
        id: o.id,
        wall: o.wall,
        centre: wallPoint(r, o.wall, o.at, (o.sill + o.top) / 2),
        inward: wallInward(o.wall),
        width: o.width,
        sill: o.sill,
        top: o.top,
        area: o.width * (o.top - o.sill),
      };
    });
}

export function roomBounds(r: RoomSpec) {
  return { minX: r.x, maxX: r.x + r.width, minZ: r.z, maxZ: r.z + r.depth };
}

/** True when (x, z) is outside the room's footprint. */
export function outsideRoom(r: RoomSpec, x: number, z: number): boolean {
  return x < r.x || x > r.x + r.width || z < r.z || z > r.z + r.depth;
}

/** "Window 1, left wall", or plain "Left wall window" when it is the only one. */
export function windowName(windows: WindowInfo[], id: string): string {
  const i = windows.findIndex((w) => w.id === id);
  const w = windows[i];
  if (!w) return "Window";
  const wall = WALLS.find((x) => x.id === w.wall)?.name.toLowerCase() ?? "wall";
  return windows.length > 1 ? `Window ${i + 1}, ${wall}` : `Window, ${wall}`;
}

/**
 * Where a lamp goes to light a subject THROUGH a window from outside, the way
 * day interiors are lit: `outM` metres out from the wall, on the line from the
 * subject through the opening, and as high as it can go while the beam still
 * clears the head of the window, so it rakes down like the sun rather than
 * coming in flat. `frameDistM` is how far along the beam a diffusion frame
 * sits when it is `frameOutM` outside the glass, which hides its edges behind
 * the wall from inside. A subject off to one side gets the steepest angle the
 * opening allows; one not in front of the window at all gets the light
 * straight out from it.
 */
export function throughWindow(
  w: WindowInfo,
  subject: { x: number; y: number; z: number },
  outM: number,
  frameOutM = 0.25,
): { x: number; y: number; z: number; frameDistM: number } {
  const out = { x: -w.inward.x, z: -w.inward.z };
  // Through the middle of a PANE, not of the window: a window has a mullion
  // down its centre, and a beam aimed through it would be cut by that bar.
  // The pane on the subject's side, so the angle in is the gentler one.
  const along = { x: -w.inward.z, z: w.inward.x };
  const side = Math.sign((subject.x - w.centre.x) * along.x + (subject.z - w.centre.z) * along.z) || 1;
  const pass = { x: w.centre.x + along.x * side * (w.width / 4), z: w.centre.z + along.z * side * (w.width / 4) };
  let hx = pass.x - subject.x;
  let hz = pass.z - subject.z;
  // The subject's distance in from the wall, perpendicular to it.
  let inM = hx * out.x + hz * out.z;
  const hl = Math.hypot(hx, hz) || 1;
  hx /= hl;
  hz /= hl;
  // Too oblique (or behind the wall): the light goes straight out instead.
  let cos = hx * out.x + hz * out.z;
  if (!(inM > 0.2) || cos < 0.35) {
    hx = out.x;
    hz = out.z;
    cos = 1;
    inM = Math.max(0.5, inM);
  }
  const run = outM / cos;
  const x = pass.x + hx * run;
  const z = pass.z + hz * run;
  // The beam crosses the wall near the top of the opening, so it comes down.
  const yWall = w.top - 0.15 * (w.top - w.sill);
  const y = Math.max(1.2, Math.min(6, subject.y + ((yWall - subject.y) * (inM + outM)) / inM));
  const len = Math.hypot(x - subject.x, y - subject.y, z - subject.z);
  const frameDistM = Math.max(0.3, (len * Math.max(0, outM - frameOutM)) / (inM + outM));
  return { x, y, z, frameDistM };
}

// ---------------------------------------------------------------- drawing

function plankTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext("2d")!;
  for (let r = 0; r < 8; r++) {
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
  return finishTexture(c, 1);
}

function tileTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#bdb6aa";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      g.fillStyle = `hsl(40 14% ${83 + ((i * 3 + j * 5) % 4)}%)`;
      g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
    }
  return finishTexture(c, 1);
}

function finishTexture(c: HTMLCanvasElement, metres: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.userData.metres = metres;
  return t;
}

/** A floor material for a floor `w` by `d` metres. */
export function floorMaterial(kind: FloorKind, w: number, d: number): THREE.MeshStandardMaterial {
  if (kind === "wood") {
    const t = plankTexture();
    t.repeat.set(w / 3, d / 3);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.62 });
  }
  if (kind === "tile") {
    const t = tileTexture();
    t.repeat.set(w / 1.2, d / 1.2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 });
  }
  const f = FLOORS.find((x) => x.id === kind) ?? FLOORS[0];
  return new THREE.MeshStandardMaterial({ color: f.color, roughness: kind === "carpet" ? 0.98 : 0.8 });
}

function wallPlane(m: THREE.Material, w: number, h: number, pos: THREE.Vector3, yaw: number) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.position.copy(pos);
  mesh.rotation.y = yaw;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function glow(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveIntensity: 1, roughness: 1 });
}

export type BuiltRoom = {
  group: THREE.Group;
  /** The glowing sky outside each window, by window id. */
  skies: Map<string, THREE.MeshStandardMaterial>;
};

/**
 * The room: floor, the walls that exist with their openings cut out, frames
 * round the windows, and a glowing sky outside each one so a window blows out
 * unless it is gelled, as it does on a set.
 */
export function buildRoom(r: RoomSpec): BuiltRoom {
  const group = new THREE.Group();
  group.name = "room";
  const skies = new Map<string, THREE.MeshStandardMaterial>();

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.width, r.depth), floorMaterial(r.floor, r.width, r.depth));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(r.x + r.width / 2, 0, r.z + r.depth / 2);
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: r.wallColor, roughness: 0.95 });
  wallMat.shadowSide = THREE.DoubleSide;
  const frameMat = new THREE.MeshStandardMaterial({ color: "#f2efe8", roughness: 0.6 });
  const H = r.height;

  for (const { id: w } of WALLS) {
    if (!r.walls[w]) continue;
    const L = wallLength(r, w);
    const yaw = wallYaw(w);
    const ops = r.openings.filter((o) => o.wall === w).map((o) => clampOpening(r, o)).sort((a, b) => a.at - b.at);
    // Vertical strips: full height between openings, above and below each.
    let u = 0;
    const strip = (u0: number, u1: number, v0: number, v1: number) => {
      if (u1 - u0 < 0.002 || v1 - v0 < 0.002) return;
      group.add(wallPlane(wallMat, u1 - u0, v1 - v0, wallPoint(r, w, (u0 + u1) / 2, (v0 + v1) / 2), yaw));
    };
    for (const o of ops) {
      const a = Math.max(u, o.at - o.width / 2);
      const b = o.at + o.width / 2;
      strip(u, a, 0, H);
      strip(a, b, 0, o.sill);
      strip(a, b, o.top, H);
      u = Math.max(u, b);
      // A frame round the opening, and for a window a sky outside it.
      const n = wallInward(w);
      const t = 0.05;
      const along = w === "back" || w === "front" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
      const frameBox = (len: number, h: number, c: THREE.Vector3, horizontal: boolean) => {
        const geo = horizontal
          ? new THREE.BoxGeometry(len, t, t)
          : new THREE.BoxGeometry(t, h, t);
        const m = new THREE.Mesh(geo, frameMat);
        m.position.copy(c);
        m.rotation.y = yaw;
        m.castShadow = true;
        group.add(m);
      };
      const mid = wallPoint(r, w, o.at, 0).addScaledVector(n, 0.02);
      if (o.kind === "window") {
        frameBox(o.width, 0, mid.clone().setY(o.sill), true);
        frameBox(o.width, 0, mid.clone().setY(o.top), true);
        frameBox(0, o.top - o.sill, mid.clone().setY((o.sill + o.top) / 2), false);
        const skyMat = glow();
        // Close to the glass and only a little bigger than the opening: far and
        // big covered steep views through it, but from free view it read as a
        // white sheet floating over the wall. 0.35 m out with 0.6 m to spare
        // each side still fills the window to about 60 degrees off axis.
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(o.width + 1.2, o.top - o.sill + 0.9), skyMat);
        sky.position.copy(wallPoint(r, w, o.at, (o.sill + o.top) / 2)).addScaledVector(n, -0.35);
        sky.rotation.y = yaw;
        sky.userData.noOcclude = true;
        group.add(sky);
        skies.set(o.id, skyMat);
      } else {
        frameBox(0, o.top, mid.clone().addScaledVector(along, -o.width / 2).setY(o.top / 2), false);
        frameBox(0, o.top, mid.clone().addScaledVector(along, o.width / 2).setY(o.top / 2), false);
        frameBox(o.width, 0, mid.clone().setY(o.top), true);
      }
    }
    strip(u, L, 0, H);
  }
  return { group, skies };
}
