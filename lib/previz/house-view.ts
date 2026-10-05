// Free view's working aids: house lights, a ground grid, markers on every
// light and camera, and framing everything. All of it is for FINDING things,
// so none of it may ever reach the shot: the caller hides the group before a
// lens render, and the house light is a fill the meter never reads.
import * as THREE from "three";

export type HouseView = {
  /** The grid and the markers, drawn as a SECOND PASS over the free view
   * (depth kept), so clay view's override material cannot repaint them. */
  aids: THREE.Scene;
  /** A soft, even, shadowless fill: the stage's work lights. Lives in the
   * world scene, since it has to light the set; 0 whenever it is not wanted. */
  fill: THREE.HemisphereLight;
  grid: THREE.Mesh;
  gridMat: THREE.ShaderMaterial;
  markers: THREE.Group;
};

/** How bright the house lights are against a correct exposure: about two thirds
 * of a stop under, so the set reads clearly while the key still stands out. */
export const HOUSE_LEVEL = 0.6;

/** Grid spacing in metres for the units in use: 1 ft with a bolder 5 ft, or 0.5 m with a bolder 1 m. */
export function gridSpacing(units: "ft" | "m"): { minor: number; major: number } {
  return units === "ft" ? { minor: 0.3048, major: 1.524 } : { minor: 0.5, major: 1 };
}

const GRID_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// Lines drawn with fwidth so they stay one pixel at any distance, fading with
// distance from the camera so the grid reads as an endless stage, not a slab.
const GRID_FRAG = /* glsl */ `
  uniform float minor;
  uniform float major;
  uniform float fadeM;
  uniform vec3 color;
  varying vec3 vWorld;
  float lineAt(float size, float width) {
    vec2 c = vWorld.xz / size;
    vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    return 1.0 - min(min(g.x, g.y) / width, 1.0);
  }
  void main() {
    float d = distance(cameraPosition.xz, vWorld.xz);
    float fade = 1.0 - smoothstep(fadeM * 0.35, fadeM, d);
    float a = max(lineAt(minor, 1.0) * 0.22, lineAt(major, 1.4) * 0.5) * fade;
    if (a < 0.01) discard;
    gl_FragColor = vec4(color, a);
  }
`;

export function buildHouseView(): HouseView {
  const aids = new THREE.Scene();
  aids.name = "houseView";

  const fill = new THREE.HemisphereLight("#ffffff", "#9a9a9a", 0);
  fill.name = "houseLights";

  const gridMat = new THREE.ShaderMaterial({
    vertexShader: GRID_VERT,
    fragmentShader: GRID_FRAG,
    uniforms: {
      minor: { value: 0.3048 },
      major: { value: 1.524 },
      fadeM: { value: 40 },
      color: { value: new THREE.Color("#c8d0dc") },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = 0.002;
  grid.renderOrder = 1;
  grid.name = "groundGrid";
  // Never a thing to grab, never something that blocks light.
  grid.userData.noOcclude = true;
  grid.raycast = () => {};
  aids.add(grid);

  const markers = new THREE.Group();
  markers.name = "markers";
  aids.add(markers);

  return { aids, fill, grid, gridMat, markers };
}

let dotTex: THREE.Texture | null = null;
/** A soft round dot with a bright core, drawn once and shared. */
function dotTexture(): THREE.Texture {
  if (dotTex) return dotTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.28, "rgba(255,255,255,0.95)");
  r.addColorStop(0.42, "rgba(255,255,255,0.35)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  dotTex.colorSpace = THREE.SRGBColorSpace;
  return dotTex;
}

export type Marker = { id: string; pos: THREE.Vector3; color: string; dim?: boolean };

/**
 * Keeps one constant-size glowing dot per light and camera, drawn through
 * everything (so a light behind a wall is still findable), reusing sprites
 * between frames.
 */
export function syncMarkers(hv: HouseView, list: Marker[]) {
  const have = new Map<string, THREE.Sprite>();
  for (const o of hv.markers.children) have.set(o.name, o as THREE.Sprite);
  const seen = new Set<string>();
  for (const m of list) {
    seen.add(m.id);
    let s = have.get(m.id);
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), depthTest: false, depthWrite: false, toneMapped: false, transparent: true, sizeAttenuation: false }));
      s.name = m.id;
      s.renderOrder = 10;
      s.scale.set(0.028, 0.028, 1);
      s.raycast = () => {};
      hv.markers.add(s);
    }
    s.position.copy(m.pos);
    const mat = s.material as THREE.SpriteMaterial;
    mat.color.set(m.color);
    mat.opacity = m.dim ? 0.45 : 1;
  }
  for (const [id, s] of have) {
    if (seen.has(id)) continue;
    hv.markers.remove(s);
    (s.material as THREE.Material).dispose();
  }
}

/**
 * Where free view's camera should sit to show everything: aimed at the middle
 * of `box` from the camera's current direction, far enough back to fit it.
 */
export function frameBox(box: THREE.Box3, cam: THREE.PerspectiveCamera, target: THREE.Vector3): { pos: THREE.Vector3; target: THREE.Vector3 } | null {
  if (box.isEmpty()) return null;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = Math.max(0.8, sphere.radius);
  const vFov = (cam.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect);
  const dist = (r / Math.sin(Math.min(vFov, hFov) / 2)) * 1.08;
  const dir = cam.position.clone().sub(target);
  if (dir.lengthSq() < 1e-6) dir.set(1, 0.8, 1);
  dir.normalize();
  // Never frame from below the floor or straight down.
  if (dir.y < 0.25) { dir.y = 0.25; dir.normalize(); }
  return { pos: sphere.center.clone().addScaledVector(dir, dist), target: sphere.center.clone() };
}
