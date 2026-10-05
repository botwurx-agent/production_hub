// The studio set for the Scene Setup prototype: a stage floor and a seamless
// paper backdrop on two background stands, the commonest set in commercial
// work. The roll widths are the real ones (53", 107" and 140" paper), and the
// colours are the standard seamless shades, named generically.
//
// The backdrop's origin is the middle of its foot line, where the vertical
// paper meets the floor; it faces +Z (toward the camera side) at rot 0.
import * as THREE from "three";

export type SetKind = "kitchen" | "studio";

export type BackdropSpec = {
  /** Roll width in inches: 53, 107 or 140. */
  widthIn: number;
  color: string;
  /** How far the paper is pulled out across the floor, metres. */
  sweepM: number;
  x: number;
  z: number;
  /** Degrees about Y. */
  rot: number;
};

export type LegacySetSpec = { kind: SetKind; backdrop: BackdropSpec };

export const ROLL_WIDTHS: { inches: number; label: string }[] = [
  { inches: 53, label: "53 in (4.4 ft)" },
  { inches: 107, label: "107 in (9 ft)" },
  { inches: 140, label: "140 in (12 ft)" },
];

export const PAPER_COLORS: { name: string; hex: string }[] = [
  { name: "Super white", hex: "#f4f4f1" },
  { name: "Fashion grey", hex: "#9c9a96" },
  { name: "Thunder grey", hex: "#5d5f62" },
  { name: "Black", hex: "#141414" },
  { name: "Warm beige", hex: "#d8c3a0" },
  { name: "Pale blue", hex: "#a9c4dc" },
  { name: "Deep yellow", hex: "#e8b730" },
  { name: "Red", hex: "#b8262d" },
  { name: "Chroma green", hex: "#2f9b4a" },
];

export const DEFAULT_BACKDROP: BackdropSpec = { widthIn: 107, color: "#f4f4f1", sweepM: 2.4, x: 0, z: -2.1, rot: 0 };

const CURVE = 0.55; // radius of the curve where the paper meets the floor

/** Paper, in the backdrop's own frame: up the back, round the curve, out across the floor. */
export function paperGeometry(w: number, sweep: number, top = 2.95, curve = CURVE): THREE.BufferGeometry {
  const CURVE = Math.min(curve, sweep - 0.06, top - 0.1);
  const TOP = top + 0.05;
  // The profile, as (z, y) points from the top of the roll down and forward.
  const prof: [number, number][] = [];
  prof.push([0, TOP - 0.05]);
  prof.push([0, CURVE]);
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    prof.push([CURVE - Math.cos(a) * CURVE, CURVE - Math.sin(a) * CURVE]);
  }
  prof.push([Math.max(CURVE + 0.05, sweep), 0.002]);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let len = 0;
  const along: number[] = [0];
  for (let i = 1; i < prof.length; i++) {
    len += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]);
    along.push(len);
  }
  for (let i = 0; i < prof.length; i++) {
    const [z, y] = prof[i];
    for (const s of [-1, 1]) {
      pos.push((s * w) / 2, y, z);
      uv.push(s < 0 ? 0 : 1, along[i] / len);
    }
  }
  for (let i = 0; i < prof.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function cyl(r: number, h: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), mat);
  m.castShadow = true;
  return m;
}

/**
 * A seamless: paper, the roll and crossbar at the top, and two stands. In the
 * backdrop's own frame: the foot line (where the paper meets the floor) runs
 * along X at z 0, and the paper comes out toward +Z.
 */
export function buildSeamless(w: number, sweep: number, color: string, top = 2.95): THREE.Group {
  const TOP = top;
  const g = new THREE.Group();
  g.name = "backdrop";
  const paperMat = new THREE.MeshStandardMaterial({ color, roughness: 0.97, side: THREE.DoubleSide });
  const paper = new THREE.Mesh(paperGeometry(w, sweep, top), paperMat);
  paper.receiveShadow = true;
  paper.castShadow = true;
  g.add(paper);
  const metal = new THREE.MeshStandardMaterial({ color: "#8f959c", roughness: 0.4, metalness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: "#26282b", roughness: 0.6, metalness: 0.3 });
  // The roll itself, and the crossbar it hangs on, a little wider than the paper.
  const roll = cyl(0.055, w + 0.04, paperMat);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, TOP, -0.06);
  g.add(roll);
  const bar = cyl(0.018, w + 0.5, metal);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, TOP, -0.06);
  g.add(bar);
  for (const s of [-1, 1]) {
    const x = s * (w / 2 + 0.22);
    const pole = cyl(0.02, TOP + 0.08, metal);
    pole.position.set(x, (TOP + 0.08) / 2, -0.06);
    g.add(pole);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const foot = new THREE.Vector3(x + Math.cos(a) * 0.45, 0.02, -0.06 + Math.sin(a) * 0.45);
      const top = new THREE.Vector3(x, 0.55, -0.06);
      const leg = cyl(0.012, foot.distanceTo(top), dark);
      leg.position.copy(foot.clone().add(top).multiplyScalar(0.5));
      leg.lookAt(top);
      leg.rotateX(Math.PI / 2);
      g.add(leg);
    }
    // A sandbag on each stand: nobody on a real set leaves one unweighted.
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.18), new THREE.MeshStandardMaterial({ color: "#4b4033", roughness: 1 }));
    bag.position.set(x + s * 0.25, 0.05, -0.06);
    g.add(bag);
  }
  return g;
}

/** A plain stage floor, larger than the kitchen's, dark grey sealed concrete. */
export function buildStageFloor(): THREE.Mesh {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshStandardMaterial({ color: "#4a4b4d", roughness: 0.75 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.001, 1);
  floor.receiveShadow = true;
  return floor;
}

/** A hard cyc: a painted wall that curves into the floor, no stands. */
export function buildCyc(w: number, sweep: number, color: string, top: number): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });
  const cyc = new THREE.Mesh(paperGeometry(w, sweep, top, 1.1), m);
  cyc.receiveShadow = true;
  cyc.castShadow = true;
  g.add(cyc);
  return g;
}
