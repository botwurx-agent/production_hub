// Everything that can be put on a set in the Scene Setup prototype, beyond the
// room itself: backdrops, flats and walls, risers and apple boxes, furniture,
// practical lamps, props and products, and imported 3D models. One shape of
// data for all of them (ItemSpec), so they are added, moved, sized, coloured,
// stacked, duplicated and deleted the same way.
//
// An item's origin is the centre of its footprint on the floor, and its front
// faces local +Z (toward the camera side at rot 0). `rot` turns it about Y in
// degrees, the same convention as a person's facing. Sizes are real metres:
// w across, d front to back, h tall.
import * as THREE from "three";
import { buildCyc, buildSeamless } from "./studio-set";
import { catalogOf, type ItemSpec } from "./catalog";
import { DEFAULT_SPACING, gridLines } from "./rigging";

export * from "./catalog";

const FT = 0.3048;

/** Where a practical's bulb is, in the item's own frame. */
export function bulbLocal(s: ItemSpec): THREE.Vector3 {
  if (s.kind === "pendant") return new THREE.Vector3(0, s.h * 0.15, 0);
  if (s.kind === "floor-lamp") return new THREE.Vector3(0, s.h * 0.88, 0);
  return new THREE.Vector3(0, s.h * 0.72, 0);
}

/** A local point on an item, in the world. */
export function itemToWorld(s: ItemSpec, local: THREE.Vector3): THREE.Vector3 {
  const r = (s.rot * Math.PI) / 180;
  return new THREE.Vector3(
    s.x + local.x * Math.cos(r) + local.z * Math.sin(r),
    (s.y ?? 0) + local.y,
    s.z - local.x * Math.sin(r) + local.z * Math.cos(r),
  );
}

// ---------------------------------------------------------------- drawing

const mat = (color: string, roughness = 0.8, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function bx(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001)), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function cy(rTop: number, rBot: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, Math.max(h, 0.001), seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function shade(c: string, k = 0.75) {
  const col = new THREE.Color(c);
  col.multiplyScalar(k);
  return `#${col.getHexString()}`;
}
function glow(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveIntensity: 1, roughness: 1 });
}

/** A label as a texture: the photo across the front, the rest in its average colour. */
export type LabelArt = { image: HTMLImageElement | HTMLCanvasElement; avg: string };

/**
 * Wraps a front-on photo of a round product around its front 160 degrees: the
 * camera sees the product the way the photo shows it, and the back is the
 * photo's average colour rather than a stretched edge.
 */
function wrapTexture(art: LabelArt): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  const H = 512;
  const iw = art.image.width || 512;
  const ih = art.image.height || 512;
  const frontW = Math.round((H * iw) / ih);
  c.width = Math.max(256, Math.round((frontW * 360) / 160));
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = art.avg;
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(art.image, (c.width - frontW) / 2, 0, frontW, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function faceTexture(art: LabelArt): THREE.Texture {
  const t = new THREE.CanvasTexture(art.image as HTMLCanvasElement);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * A round product's body as a lathe whose UVs run around (u, with the front
 * of the product at u 0.5 facing +Z) and up by HEIGHT (v), so a wrapped photo
 * keeps its proportions up the neck of a bottle.
 */
function latheBody(prof: [number, number][], w: number, h: number, m: THREE.Material): THREE.Mesh {
  const pts = prof.map(([r, y]) => new THREE.Vector2(r * (w / 2), y * h));
  const geo = new THREE.LatheGeometry(pts, 64);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Angle round from the front (+Z), increasing to the right (+X).
    const a = Math.atan2(x, z);
    uv.setXY(i, 0.5 + a / (2 * Math.PI), pos.getY(i) / h);
  }
  uv.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const BOTTLE: [number, number][] = [
  [0, 0], [0.94, 0.008], [1, 0.04], [1, 0.6], [0.92, 0.69], [0.56, 0.81], [0.35, 0.89], [0.35, 0.97], [0.39, 0.98], [0, 1],
];
const JAR: [number, number][] = [[0, 0], [0.95, 0.01], [1, 0.06], [1, 0.82], [0.9, 0.86], [0.9, 1], [0, 1]];

/** The invented label the sample bottle ships with: never a real brand. */
function sampleLabel(): THREE.CanvasTexture {
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

export type ItemExtras = {
  /** A practical's light and its glowing bulb, set every frame. */
  lamp?: { light: THREE.PointLight; bulb: THREE.MeshStandardMaterial };
};

/**
 * Builds an item in its own frame (the caller places and turns it). `art` is
 * the decoded label image for a labelled product; `model` is the loaded,
 * normalised model for an import, already in metres with its base at y 0.
 */
export function buildItem(s: ItemSpec, art: LabelArt | null, model: THREE.Object3D | null): THREE.Group {
  const g = new THREE.Group();
  const extras: ItemExtras = {};
  g.userData.extras = extras;
  const { w, d, h } = s;
  const m = mat(s.color, 0.8);
  const k = s.kind;

  if (k === "seamless") {
    const b = buildSeamless(w, d, s.color, h);
    b.position.z = -d / 2;
    g.add(b);
  } else if (k === "cyc") {
    const b = buildCyc(w, d, s.color, h);
    b.position.z = -d / 2;
    g.add(b);
  } else if (k === "muslin") {
    // Cloth with soft folds, on a crossbar between two stands.
    const geo = new THREE.PlaneGeometry(w, h, 40, 20);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      p.setZ(i, Math.sin(x * 4.1) * 0.03 + Math.sin(x * 1.7 + y * 0.6) * 0.04);
    }
    geo.computeVertexNormals();
    const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: s.color, roughness: 1, side: THREE.DoubleSide }));
    cloth.position.set(0, h / 2 + 0.02, 0);
    cloth.castShadow = cloth.receiveShadow = true;
    g.add(cloth);
    const metal = mat("#8f959c", 0.4, 0.8);
    g.add(cy(0.018, 0.018, w + 0.4, metal, 0, h + 0.06, -0.05).rotateZ(Math.PI / 2));
    for (const sx of [-1, 1]) g.add(cy(0.02, 0.02, h + 0.1, metal, sx * (w / 2 + 0.2), (h + 0.1) / 2, -0.05));
  } else if (k === "grid" || k === "spreader" || k === "polecat") {
    g.add(buildRig(s));
  } else if (k === "flat" || k === "wall") {
    g.add(bx(w, h, d, m, 0, h / 2, 0));
  } else if (k === "vflat") {
    // Two panels meeting at the back, opening toward the camera side.
    const panel = 4 * FT;
    const ang = Math.atan2(d, w / 2);
    for (const sx of [-1, 1]) {
      const p = bx(panel, h, 0.025, m, 0, h / 2, 0);
      p.rotation.y = -sx * ang;
      p.position.set(sx * (panel / 2) * Math.cos(ang), h / 2, -d / 2 + (panel / 2) * Math.sin(ang));
      g.add(p);
    }
  } else if (k === "window-flat" || k === "door-flat") {
    const win = k === "window-flat";
    const ow = win ? Math.min(w - 0.3, w * 0.6) : Math.min(w - 0.3, 0.9);
    const o0 = win ? Math.min(0.9, h * 0.33) : 0;
    const o1 = win ? Math.min(h - 0.2, 2.2) : Math.min(h - 0.2, 2.1);
    const side = (w - ow) / 2;
    g.add(bx(side, h, d, m, -w / 2 + side / 2, h / 2, 0));
    g.add(bx(side, h, d, m, w / 2 - side / 2, h / 2, 0));
    if (o0 > 0) g.add(bx(ow, o0, d, m, 0, o0 / 2, 0));
    g.add(bx(ow, h - o1, d, m, 0, (o1 + h) / 2, 0));
    const frame = mat("#f2efe8", 0.6);
    if (win) {
      g.add(bx(ow, 0.04, d + 0.02, frame, 0, o0, 0));
      g.add(bx(ow, 0.04, d + 0.02, frame, 0, o1, 0));
      g.add(bx(0.04, o1 - o0, d + 0.02, frame, 0, (o0 + o1) / 2, 0));
      g.add(bx(ow, 0.04, d + 0.02, frame, 0, (o0 + o1) / 2, 0));
    } else {
      const leaf = bx(ow, o1, 0.04, mat(shade(s.color, 0.85), 0.7), 0, o1 / 2, 0);
      leaf.geometry.translate(ow / 2, 0, 0);
      leaf.position.set(-ow / 2, o1 / 2, d / 2);
      leaf.rotation.y = -0.5;
      g.add(leaf);
    }
  } else if (k === "riser" || k === "plinth" || k === "box") {
    g.add(bx(w, h, d, m, 0, h / 2, 0));
    if (k === "riser") g.add(bx(w + 0.01, 0.01, d + 0.01, mat(shade(s.color, 1.15), 0.95), 0, h, 0));
  } else if (k === "apple") {
    // Plywood box with its hand holes.
    g.add(bx(w, h, d, m, 0, h / 2, 0));
    if (h > 0.06) {
      const dark = mat("#3a2a18", 0.9);
      for (const sx of [-1, 1]) g.add(bx(0.012, h * 0.28, d * 0.4, dark, sx * (w / 2 + 0.002), h * 0.62, 0));
    }
  } else if (k === "rug") {
    g.add(bx(w, h, d, mat(s.color, 0.98), 0, h / 2, 0));
  } else if (k === "dining-table" || k === "coffee-table" || k === "desk") {
    const top = Math.min(0.05, h * 0.12);
    g.add(bx(w, top, d, m, 0, h - top / 2, 0));
    const leg = Math.min(0.06, w * 0.05);
    const ix = w / 2 - leg * 1.4;
    const iz = d / 2 - leg * 1.4;
    if (k === "desk") {
      for (const sx of [-1, 1]) g.add(bx(0.03, h - top, d * 0.9, m, sx * (w / 2 - 0.03), (h - top) / 2, 0));
    } else {
      for (const [lx, lz] of [[-ix, -iz], [ix, -iz], [-ix, iz], [ix, iz]]) g.add(bx(leg, h - top, leg, m, lx, (h - top) / 2, lz));
    }
  } else if (k === "round-table") {
    g.add(cy(w / 2, w / 2, 0.04, m, 0, h - 0.02, 0, 48));
    g.add(cy(0.05, 0.05, h - 0.04, m, 0, (h - 0.04) / 2, 0));
    g.add(cy(w * 0.25, w * 0.28, 0.04, m, 0, 0.02, 0));
  } else if (k === "counter" || k === "island") {
    const topT = 0.04;
    g.add(bx(w - 0.04, h - topT, d - 0.04, m, 0, (h - topT) / 2, -0.02));
    g.add(bx(w + (k === "island" ? 0.06 : 0.02), topT, d + (k === "island" ? 0.06 : 0.02), mat("#ece8e1", 0.35), 0, h - topT / 2, 0));
    const handle = mat("#b8bcc2", 0.3, 0.8);
    const doors = Math.max(1, Math.round(w / 0.6));
    for (let i = 0; i < doors; i++) {
      const x = -w / 2 + (w / doors) * (i + 0.5);
      g.add(bx(0.008, h * 0.65, 0.004, mat(shade(s.color, 0.7)), x - w / doors / 2 + 0.01, h * 0.45, d / 2 - 0.018));
      g.add(bx(0.12, 0.015, 0.02, handle, x, h * 0.8, d / 2 - 0.01));
    }
  } else if (k === "wall-cabinet") {
    g.add(bx(w, h, d, m, 0, h / 2, 0));
    const doors = Math.max(1, Math.round(w / 0.6));
    for (let i = 1; i < doors; i++) g.add(bx(0.008, h * 0.95, 0.004, mat(shade(s.color, 0.7)), -w / 2 + (w / doors) * i, h / 2, d / 2 + 0.002));
  } else if (k === "sideboard") {
    const legH = Math.min(0.15, h * 0.2);
    g.add(bx(w, h - legH, d, m, 0, legH + (h - legH) / 2, 0));
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(bx(0.03, legH, 0.03, m, lx * (w / 2 - 0.05), legH / 2, lz * (d / 2 - 0.05)));
  } else if (k === "bookcase") {
    const t = 0.02;
    g.add(bx(t, h, d, m, -w / 2 + t / 2, h / 2, 0));
    g.add(bx(t, h, d, m, w / 2 - t / 2, h / 2, 0));
    g.add(bx(w, t, d, m, 0, h - t / 2, 0));
    g.add(bx(w, t, d, m, 0, t / 2, 0));
    g.add(bx(w, h, 0.01, m, 0, h / 2, -d / 2 + 0.005));
    const shelves = Math.max(2, Math.round(h / 0.36));
    const bookCols = ["#8a3b2e", "#2f4e6e", "#c9a54a", "#3f6b4a", "#6a5a7a", "#d8d2c4"];
    for (let i = 1; i < shelves; i++) {
      const y = (h / shelves) * i;
      g.add(bx(w - 2 * t, t, d, m, 0, y, 0));
      let x = -w / 2 + t + 0.01;
      let n = i * 7;
      while (x < w / 2 - t - 0.05) {
        const bw = 0.025 + ((n * 13) % 5) * 0.006;
        const bh = (h / shelves) * (0.6 + ((n * 7) % 4) * 0.07);
        g.add(bx(bw, bh, d * 0.75, mat(bookCols[n % bookCols.length], 0.85), x + bw / 2, y + t / 2 + bh / 2, 0));
        x += bw + 0.002;
        n++;
      }
    }
  } else if (k === "chair") {
    const seat = h * 0.5;
    g.add(bx(w, 0.04, d, m, 0, seat, 0));
    g.add(bx(w, h - seat, 0.03, m, 0, seat + (h - seat) / 2, -d / 2 + 0.02));
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(bx(0.035, seat, 0.035, m, lx * (w / 2 - 0.03), seat / 2, lz * (d / 2 - 0.03)));
  } else if (k === "stool") {
    g.add(cy(w / 2, w / 2, 0.05, m, 0, h - 0.025, 0));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = cy(0.012, 0.014, h - 0.05, mat("#8f959c", 0.4, 0.7), Math.cos(a) * w * 0.32, (h - 0.05) / 2, Math.sin(a) * w * 0.32);
      g.add(leg);
    }
    g.add(cy(w * 0.36, w * 0.36, 0.012, mat("#8f959c", 0.4, 0.7), 0, h * 0.3, 0));
  } else if (k === "sofa" || k === "armchair") {
    const seat = h * 0.52;
    const arm = Math.min(0.18, w * 0.12);
    const back = Math.min(0.22, d * 0.25);
    const dark = mat(shade(s.color, 0.85), 0.95);
    g.add(bx(w, seat - 0.12, d, dark, 0, (seat - 0.12) / 2 + 0.08, 0));
    g.add(bx(w - 2 * arm, 0.14, d - back, mat(s.color, 0.95), 0, seat - 0.07, back / 2));
    g.add(bx(w, h - 0.08, back, mat(s.color, 0.95), 0, 0.08 + (h - 0.08) / 2, -d / 2 + back / 2));
    for (const sx of [-1, 1]) g.add(bx(arm, seat + 0.08, d, mat(s.color, 0.95), sx * (w / 2 - arm / 2), 0.08 + (seat + 0.08) / 2, 0));
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(bx(0.04, 0.08, 0.04, mat("#3a2a1e"), lx * (w / 2 - 0.06), 0.04, lz * (d / 2 - 0.06)));
  } else if (k === "bed") {
    const frameH = h * 0.45;
    g.add(bx(w, frameH, d, mat(shade(s.color, 0.6), 0.8), 0, frameH / 2, 0));
    g.add(bx(w - 0.04, h - frameH, d - 0.06, mat(s.color, 0.95), 0, frameH + (h - frameH) / 2, 0.02));
    g.add(bx(w, h + 0.5, 0.06, mat(shade(s.color, 0.6), 0.8), 0, (h + 0.5) / 2, -d / 2 + 0.03));
    for (const sx of [-1, 1]) g.add(bx(w * 0.4, 0.12, 0.4, mat("#f6f4ef", 0.95), sx * w * 0.23, h + 0.04, -d / 2 + 0.3));
  } else if (k === "plant") {
    const potH = Math.min(0.35, h * 0.3);
    g.add(cy(w * 0.32, w * 0.24, potH, mat("#b5643f", 0.8), 0, potH / 2, 0));
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(s.color, 0.9));
    leaves.scale.set(w / 2, (h - potH) / 2, d / 2);
    leaves.position.y = potH + (h - potH) / 2;
    leaves.castShadow = true;
    g.add(leaves);
  } else if (k === "pendant" || k === "floor-lamp" || k === "table-lamp") {
    const bulb = glow();
    const bl = bulbLocal(s);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), bulb);
    b.position.copy(bl);
    b.userData.noOcclude = true;
    g.add(b);
    if (k === "pendant") {
      const sh = new THREE.Mesh(new THREE.ConeGeometry(w / 2, h * 0.7, 32, 1, true), new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.5, side: THREE.DoubleSide }));
      sh.position.y = h * 0.35;
      g.add(sh);
      g.add(bx(0.008, 1.1, 0.008, mat("#222"), 0, h * 0.7 + 0.55, 0));
    } else {
      const shadeM = new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
      const shH = Math.min(0.3, h * 0.3);
      const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w / 2, shH, 32, 1, true), shadeM);
      shadeMesh.position.y = bl.y + 0.02;
      shadeMesh.userData.noOcclude = true;
      g.add(shadeMesh);
      const metal = mat("#3a3a3a", 0.4, 0.6);
      g.add(cy(0.012, 0.012, bl.y, metal, 0, bl.y / 2, 0));
      g.add(cy(w * 0.3, w * 0.34, 0.03, metal, 0, 0.015, 0));
    }
    const light = new THREE.PointLight("#ffffff", 0, 0, 2);
    light.position.copy(bl);
    g.add(light);
    extras.lamp = { light, bulb };
  } else if (k === "bottle" || k === "jar") {
    const prof = k === "bottle" ? BOTTLE : JAR;
    if (art) {
      g.add(latheBody(prof, w, h, new THREE.MeshStandardMaterial({ map: wrapTexture(art), roughness: 0.35 })));
    } else if (k === "bottle") {
      const glass = new THREE.MeshPhysicalMaterial({ color: s.color, roughness: 0.04, transmission: 0.92, thickness: 0.02, ior: 1.5 });
      g.add(latheBody(prof, w, h, glass));
      const liquid = cy(w * 0.44, w * 0.44, h * 0.58, mat("#cfe9e1", 0.1), 0, h * 0.32, 0, 40);
      (liquid.material as THREE.MeshStandardMaterial).transparent = true;
      (liquid.material as THREE.MeshStandardMaterial).opacity = 0.45;
      g.add(liquid);
      const label = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.511, w * 0.511, h * 0.33, 64, 1, true), new THREE.MeshStandardMaterial({ map: sampleLabel(), roughness: 0.55 }));
      label.position.y = h * 0.33;
      label.rotation.y = -Math.PI / 2;
      g.add(label);
    } else {
      g.add(latheBody(prof, w, h, mat(s.color, 0.3)));
    }
    g.add(cy(w * (k === "bottle" ? 0.21 : 0.47), w * (k === "bottle" ? 0.21 : 0.47), h * (k === "bottle" ? 0.08 : 0.1), mat("#2f6f62", 0.4, 0.3), 0, h * (k === "bottle" ? 1.02 : 1.0), 0, 24));
  } else if (k === "can") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h * 0.9, 64), art
      ? [new THREE.MeshStandardMaterial({ map: wrapTexture(art), roughness: 0.3, metalness: 0.3 }), mat("#c8ccd2", 0.25, 0.9), mat("#c8ccd2", 0.25, 0.9)]
      : [mat(s.color, 0.3, 0.6), mat("#c8ccd2", 0.25, 0.9), mat("#c8ccd2", 0.25, 0.9)]);
    // CylinderGeometry's UVs start at the front (+Z); a half turn puts the
    // photo's middle, at u 0.5, on the front instead of the back.
    body.rotation.y = Math.PI;
    body.position.y = h * 0.5;
    body.castShadow = true;
    g.add(body);
    g.add(cy(w * 0.43, w / 2, h * 0.05, mat("#c8ccd2", 0.25, 0.9), 0, h * 0.975, 0));
    g.add(cy(w / 2, w * 0.43, h * 0.05, mat("#c8ccd2", 0.25, 0.9), 0, h * 0.025, 0));
  } else if (k === "carton" || k === "pouch") {
    const side = mat(art ? art.avg : s.color, 0.6);
    const front = art ? new THREE.MeshStandardMaterial({ map: faceTexture(art), roughness: 0.55 }) : side;
    const mats = [side, side, side, side, front, side];
    if (k === "carton") {
      const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
      c.position.y = h / 2;
      c.castShadow = c.receiveShadow = true;
      g.add(c);
    } else {
      // A pouch bulges in the middle and is sealed flat at the top.
      const geo = new THREE.BoxGeometry(w, h * 0.92, d, 8, 8, 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) / (h * 0.46);
        const x = p.getX(i) / (w / 2);
        p.setZ(i, p.getZ(i) * Math.max(0.15, (1 - y * y * 0.8) * (1 - x * x * 0.3)));
      }
      geo.computeVertexNormals();
      const c = new THREE.Mesh(geo, mats);
      c.position.y = h * 0.46;
      c.castShadow = c.receiveShadow = true;
      g.add(c);
      g.add(bx(w, h * 0.08, 0.004, side, 0, h * 0.96, 0));
    }
  } else if (k === "mug") {
    g.add(cy(w * 0.42, w * 0.4, h, mat(s.color, 0.4), 0, h / 2, 0));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(h * 0.27, w * 0.06, 8, 24, Math.PI), mat(s.color, 0.4));
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(w * 0.42, h * 0.5, 0);
    g.add(handle);
  } else if (k === "wine-glass") {
    const glass = new THREE.MeshPhysicalMaterial({ color: s.color, roughness: 0.03, transmission: 0.95, thickness: 0.01, ior: 1.5 });
    g.add(latheBody([[0, 0], [0.8, 0], [0.8, 0.02], [0.08, 0.04], [0.08, 0.45], [0.7, 0.55], [1, 0.75], [0.85, 1], [0.82, 1]], w, h, glass));
  } else if (k === "plate" || k === "bowl") {
    if (k === "plate") g.add(latheBody([[0, 0], [0.7, 0], [0.8, 0.3], [1, 1], [0.97, 1], [0.72, 0.5], [0, 0.45]], w, h, mat(s.color, 0.3)));
    else g.add(latheBody([[0, 0], [0.5, 0], [0.8, 0.3], [1, 1], [0.94, 1], [0.74, 0.35], [0.45, 0.1], [0, 0.1]], w, h, mat(s.color, 0.3)));
  } else if (k === "laptop") {
    const base = 0.018;
    g.add(bx(w, base, d, m, 0, base / 2, 0));
    const lid = new THREE.Group();
    lid.add(bx(w, d, 0.008, m, 0, d / 2, 0));
    lid.add(bx(w * 0.9, d * 0.85, 0.002, mat("#0f1820", 0.2), 0, d / 2, 0.005));
    lid.position.set(0, base, -d / 2);
    lid.rotation.x = -0.32;
    g.add(lid);
  } else if (k === "phone") {
    g.add(bx(w, h, d, mat(s.color, 0.2, 0.3), 0, h / 2, 0));
    g.add(bx(w * 0.92, h * 0.94, 0.001, mat("#0f1820", 0.15), 0, h / 2, d / 2 + 0.0005));
  } else if (k === "model") {
    if (model) {
      const clone = model.clone(true);
      clone.traverse((o) => (o.userData.shared = true));
      // Fit the model to the item's size, so the sizes in the inspector are true.
      const box = new THREE.Box3().setFromObject(model);
      const sz = box.getSize(new THREE.Vector3());
      clone.scale.set(w / Math.max(sz.x, 1e-6), h / Math.max(sz.y, 1e-6), d / Math.max(sz.z, 1e-6));
      g.add(clone);
    } else {
      // Loading: a wire box at its size.
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: "#8a857c" }));
      wire.position.y = h / 2;
      wire.userData.noOcclude = true;
      g.add(wire);
    }
  } else {
    g.add(bx(w, h, d, m, 0, h / 2, 0));
  }
  return g;
}

/**
 * Overhead rigging, drawn round its pipe centre (the item is placed at its
 * `raise`). Pipe is thin and nobody judges it, so none of it casts a shadow
 * or blocks the meter: a light under a grid is not cut by the grid.
 */
function buildRig(s: ItemSpec): THREE.Group {
  const g = new THREE.Group();
  const steel = mat("#9aa0a7", 0.4, 0.8);
  const black = mat("#1c1c1e", 0.7, 0.2);
  const pipe = (len: number, r: number, m: THREE.Material, x: number, z: number, alongX: boolean) => {
    const p = cy(r, r, len, m, x, 0, z, 12);
    p.rotation.set(alongX ? 0 : Math.PI / 2, 0, alongX ? Math.PI / 2 : 0);
    return p;
  };
  if (s.kind === "grid") {
    // Schedule 40 pipe, 1.9" outside, on even centres both ways, hung on
    // short rods at the corners.
    const sp = s.spacing ?? DEFAULT_SPACING;
    for (const z of gridLines(s.d, sp)) g.add(pipe(s.w, 0.024, steel, 0, z, true));
    for (const x of gridLines(s.w, sp)) g.add(pipe(s.d, 0.024, steel, x, 0, false));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      g.add(cy(0.008, 0.008, 0.3, black, (x * s.w) / 2, 0.15, (z * s.d) / 2, 6));
    }
  } else if (s.kind === "spreader") {
    // A 2x4 on edge, and a spreader end at each wall with its rubber pad.
    g.add(bx(s.w - 0.1, s.h, s.d, mat(s.color, 0.85), 0, 0, 0));
    for (const sx of [-1, 1]) {
      g.add(bx(0.09, s.h + 0.06, s.d + 0.05, black, sx * (s.w / 2 - 0.09), 0, 0));
      g.add(bx(0.03, s.h + 0.1, s.d + 0.1, mat("#3a3a3c", 1), sx * (s.w / 2 - 0.015), 0, 0));
    }
  } else {
    // A polecat: two telescoping tubes and a rubber cup at each end.
    const tube = mat(s.color, 0.35, 0.8);
    g.add(pipe(s.w * 0.55, s.d / 2, tube, -s.w * 0.225, 0, true));
    g.add(pipe(s.w * 0.5, s.d * 0.38, tube, s.w * 0.25, 0, true));
    g.add(pipe(0.05, s.d / 2 + 0.006, black, s.w * 0.05, 0, true));
    for (const sx of [-1, 1]) g.add(pipe(0.05, 0.04, black, sx * (s.w / 2 - 0.025), 0, true));
  }
  g.traverse((o) => {
    o.userData.noOcclude = true;
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = false;
  });
  return g;
}

/** What changes an item's geometry: anything but where it is. */
export function itemShapeKey(s: ItemSpec, artReady: boolean, modelReady: boolean): string {
  return [s.kind, s.w, s.d, s.h, s.color, s.spacing ?? "", s.label ?? "", artReady ? 1 : 0, s.model?.key ?? "", modelReady ? 1 : 0].join("|");
}
