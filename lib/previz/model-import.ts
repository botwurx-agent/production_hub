// Reads a 3D model file in the browser for the Scene Setup prototype: GLB or
// GLTF, OBJ, and STL. That covers a LiDAR room scan (Polycam, Scaniverse and
// RoomPlan all export GLB, in metres), a product or prop from a CAD program
// (STL or OBJ), and anything from a model library. STEP and other CAD-native
// formats need a CAD kernel the browser does not have; export STL or GLB.
//
// The model comes back NORMALISED: centred over its footprint, sitting on the
// floor, in metres. GLB is metres by its spec. STL and OBJ carry no units at
// all, so a guess is made from the size and the inspector lets it be changed.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

export const MODEL_EXTENSIONS = [".glb", ".gltf", ".obj", ".stl"];
export const MAX_MODEL_BYTES = 150 * 1024 * 1024;

export const UNITS: { id: string; name: string; m: number }[] = [
  { id: "mm", name: "Millimetres", m: 0.001 },
  { id: "cm", name: "Centimetres", m: 0.01 },
  { id: "m", name: "Metres", m: 1 },
  { id: "in", name: "Inches", m: 0.0254 },
  { id: "ft", name: "Feet", m: 0.3048 },
];

export function modelFormat(name: string): "glb" | "obj" | "stl" | null {
  const n = name.toLowerCase();
  if (n.endsWith(".glb") || n.endsWith(".gltf")) return "glb";
  if (n.endsWith(".obj")) return "obj";
  if (n.endsWith(".stl")) return "stl";
  return null;
}

const plain = () => new THREE.MeshStandardMaterial({ color: "#b9b4ab", roughness: 0.75 });

/** Parses the bytes into a scene graph, in the file's own units and axes. */
async function parse(buf: ArrayBuffer, name: string): Promise<THREE.Object3D> {
  const f = modelFormat(name);
  if (f === "glb") {
    const loader = new GLTFLoader();
    const gltf = await new Promise<{ scene: THREE.Object3D }>((resolve, reject) =>
      loader.parse(buf, "", (g) => resolve(g), (e) => {
        const msg = String((e as unknown as { message?: string })?.message ?? e);
        reject(new Error(/draco/i.test(msg)
          ? "This GLB is Draco compressed. Export it again without compression."
          : /buffer|uri/i.test(msg)
            ? "This GLTF points at separate files. Export it as a single .glb."
            : `Could not read this model: ${msg}`));
      }),
    );
    return gltf.scene;
  }
  if (f === "obj") {
    const obj = new OBJLoader().parse(new TextDecoder().decode(buf));
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = plain();
    });
    return obj;
  }
  if (f === "stl") {
    const geo = new STLLoader().parse(buf);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, plain());
  }
  throw new Error("Use a GLB, GLTF, OBJ or STL file.");
}

/** Its size in the file's own units, before any scaling. */
export function rawSize(o: THREE.Object3D): THREE.Vector3 {
  return new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
}

/**
 * A first guess at the units, from the size. A GLB is metres by definition.
 * An STL or OBJ bigger than 30 units across is almost certainly millimetres
 * (30 metres is not a prop); otherwise metres. Shown, and changeable.
 */
export function guessUnit(name: string, size: THREE.Vector3): string {
  if (modelFormat(name) === "glb") return "m";
  return Math.max(size.x, size.y, size.z) > 30 ? "mm" : "m";
}

/**
 * The model, normalised: Z-up files turned Y-up, centred on its footprint and
 * sitting on the floor, in the file's own units (the item scales it to size).
 */
export async function loadModel(buf: ArrayBuffer, name: string, upZ: boolean): Promise<THREE.Object3D> {
  const raw = await parse(buf, name);
  const wrap = new THREE.Group();
  if (upZ) raw.rotation.x = -Math.PI / 2;
  wrap.add(raw);
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  const c = box.getCenter(new THREE.Vector3());
  raw.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  wrap.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return wrap;
}
