"use client";

// Scene Setup PROTOTYPE, slice 1: camera and lens truth. A throwaway at
// /dev/scene-setup with no database and no app wiring, built so the operator
// can judge how it feels to drive before anything real is built (see
// CLAUDE.md, "Scene Setup: 3D previz"). The layout is the one they confirmed:
// through-the-lens main view, live top-down map in the corner, scene contents
// on the left, a production-language inspector on the right, shots along the
// bottom with each storyboard frame beside what its camera sees.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ASPECTS, BODIES, PRIMES, STOPS, cameraAngle, circleOfConfusion, dofLimits, feet,
  fovDeg, imagedArea, metres, shotSize,
} from "@/lib/previz/optics";
import {
  BOTTLE_TOP_Y, PENDANT, WINDOW, WINDOW_AREA, buildFigure, buildRig, buildWorld, dofMaterial, eyeHeight, handWorld,
  type PropSpec, type TalentSpec,
} from "@/lib/previz/scene-build";
import { SAMPLE_BOARDS } from "@/lib/previz/boards";
import {
  SUPPORTS, bodyDrop, buildSupport, robotBaseLocal, supportFootprint, type SupportKind, type SupportOpts,
} from "@/lib/previz/camera-model";
import {
  FIXTURES, FT, WINDOW_SKIES, apparentSizeDeg, cameraColor, exposureScale, resolveSource, type WindowSky,
} from "@/lib/previz/lighting";
import {
  GRIP_NAMES, GRIP_REFLECTANCE, buildGripRig, buildLightRig, structureKey, updateGripRig, updateLightRig,
  type GripKind, type GripRig, type GripSpec, type LightRig, type LightSpec,
} from "@/lib/previz/light-build";
import {
  bounceCandela, collectOccluders, emitterFromSource, nearFieldScale, readMeter, roomLuxFrom, type Board, type Emitter, type Reading,
} from "@/lib/previz/meter";
import { ExposurePanel, GripInspector, LightInspector, PracticalInspector, WindowInspector } from "./light-panels";
import { Chip, Field, Info, RailGroup, RailItem, Readout, Seg, Thumb, Toggle, TrashIcon } from "./ui";
import {
  aim, asSetup, downloadSetup, kitchenSetup, loadSetup, saveSetup, studioSetup,
  type PracticalState, type Setup, type Shot, type Units, type Vec3, type WinState,
} from "./setup";
import { Timeline } from "./timeline";
import {
  camAt, constrainEnd, fromLocal, moveStats, toLocal, trackExtent, trackFrame, type CamKey, type Move,
} from "@/lib/previz/camera-move";
import {
  PAPER_COLORS, ROLL_WIDTHS, backdropFootprint, buildBackdrop, type BackdropSpec, type SetSpec,
} from "@/lib/previz/studio-set";
import { POSES } from "@/lib/previz/poses";

type Selection =
  | { kind: "camera" }
  | { kind: "talent"; id: string }
  | { kind: "prop" }
  | { kind: "light"; id: string }
  | { kind: "window" }
  | { kind: "practical" }
  | { kind: "grip"; id: string }
  | { kind: "set" };

const STAGE_BG = "#131416"; // neutral and fixed: the frame is judged here
const SHOT_HUES = ["#6b7cff", "#e0884f", "#3fb68b", "#c26be0", "#d6b03a", "#3bb2d0"];

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function forward(yaw: number, pitch: number): THREE.Vector3 {
  const y = rad(yaw);
  const p = rad(pitch);
  return new THREE.Vector3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
}

/** Where a focus target sits in the world. */
function targetPoint(id: string, talent: TalentSpec[], bottle: PropSpec): THREE.Vector3 | null {
  if (id === "bottle") return new THREE.Vector3(bottle.x, (bottle.y ?? bottleBaseY(bottle)) + 0.1, bottle.z);
  const t = talent.find((x) => x.id === id);
  return t ? new THREE.Vector3(t.x, eyeHeight(t), t.z) : null;
}
/**
 * The bottle where it really is: in somebody's hand when they are holding it,
 * otherwise standing on whatever surface is under it (the studio has none).
 */
function placeBottle(b: PropSpec, talent: TalentSpec[], set: SetSpec): PropSpec {
  const holder = talent.find((t) => t.holding === "bottle" && t.pose === "holding");
  if (holder) {
    const h = handWorld(holder);
    return { ...b, x: h.x, y: h.y - 0.12, z: h.z, heldBy: holder.id };
  }
  return { ...b, y: set.kind === "kitchen" ? bottleBaseY(b) : 0, heldBy: null };
}
function bottleBaseY(b: PropSpec): number {
  if (b.x > -0.78 && b.x < 0.78 && b.z > -1.03 && b.z < -0.17) return BOTTLE_TOP_Y;
  if (b.x > -1.1 && b.x < 2.3 && b.z < -1.86) return 0.9;
  return 0;
}
/** Focus distance is measured to the focus PLANE, along the lens axis. */
function effectiveFocus(s: Shot, talent: TalentSpec[], bottle: PropSpec): number {
  if (!s.focusOn) return s.focusM;
  const p = targetPoint(s.focusOn, talent, bottle);
  if (!p) return s.focusM;
  const d = p.sub(new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z)).dot(forward(s.yaw, s.pitch));
  return Math.max(0.25, d);
}

const dist = (m: number, u: Units) => (u === "ft" ? feet(m) : metres(m));

/** The best video format this browser can record: MP4 where it can, WebM otherwise. */
function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  // H.264 first, so the clip plays in QuickTime and on a phone. A bare
  // "video/mp4" is left out on purpose: Chromium without H.264 answers yes to it
  // and writes VP9 into an mp4 box, which QuickTime refuses to open.
  for (const m of [
    "video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1.4d002a", "video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1",
    "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm",
  ]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/** A shot's own camera values: the start frame of any move. */
function camKey(s: Shot): CamKey {
  return { pos: s.pos, yaw: s.yaw, pitch: s.pitch, focal: s.focal, focusM: s.focusM, focusOn: s.focusOn };
}
/**
 * The shot as the camera sees it at a moment through its move. A rack between
 * two people pulls focus smoothly from one distance to the other, measured
 * from wherever the camera is at that moment.
 */
function viewShot(s: Shot, t: number, talent: TalentSpec[], bottle: PropSpec): Shot {
  if (!s.move || t <= 0) return s;
  const c = camAt(camKey(s), s.move, t);
  const base: Shot = { ...s, pos: c.pos, yaw: c.yaw, pitch: c.pitch, focal: c.focal };
  const e = s.move.end;
  if (s.focusOn === e.focusOn) return { ...base, focusOn: s.focusOn, focusM: c.focusM };
  const fa = effectiveFocus({ ...base, focusOn: s.focusOn, focusM: s.focusM }, talent, bottle);
  const fb = effectiveFocus({ ...base, focusOn: e.focusOn, focusM: e.focusM }, talent, bottle);
  return { ...base, focusOn: null, focusM: fa + (fb - fa) * c.mix };
}
/**
 * How a shot's support is drawn with the camera at `at`: turned to the
 * track's heading, with the track covering the whole move and the robot's
 * base left where it stood at the start.
 */
function supportPose(s: Shot, at: Vec3): { yaw: number; opts: SupportOpts } {
  if (!s.move) return { yaw: s.yaw, opts: {} };
  const f = trackFrame(camKey(s), s.move);
  const cur = toLocal(f, at);
  const ext = trackExtent(s.support, camKey(s), s.move);
  if (s.support === "dana" && ext) return { yaw: f.yaw, opts: { track: { from: ext.from - cur.lx, to: ext.to - cur.lx } } };
  if (s.support === "fisher" && ext) return { yaw: f.yaw, opts: { track: { from: ext.from - cur.lz, to: ext.to - cur.lz } } };
  if (s.support === "robot") {
    const b = robotBaseLocal(s.pos.y, bodyDrop(s.bodyId));
    return { yaw: f.yaw, opts: { base: { x: b.x - cur.lx, z: b.z - cur.lz } } };
  }
  return { yaw: f.yaw, opts: {} };
}

const WINDOW_CCT: Record<WindowSky, number> = { overcast: 6500, bright: 6000, sun: 5600 };
const SUN_FROM = new THREE.Vector3(-9, 4.8, -0.2);
const SUN_TO = new THREE.Vector3(0, 0.7, -0.6);
const SUN_DIR = SUN_FROM.clone().sub(SUN_TO).normalize();
const WINDOW_MID = new THREE.Vector3(WINDOW.x + 0.08, (WINDOW.sill + WINDOW.top) / 2, WINDOW.z);
const PENDANT_R = 0.045;

type Placed = { x: number; y: number; z: number; yaw: number; pitch: number; aimAt: string | null };
/** Where a light or a board points: at its target if it has one. */
function aimOf(p: Placed, talent: TalentSpec[], bottle: PropSpec): { yaw: number; pitch: number } {
  if (p.aimAt) {
    const t = targetPoint(p.aimAt, talent, bottle);
    if (t) return aim({ x: p.x, y: p.y, z: p.z }, t);
  }
  return { yaw: p.yaw, pitch: p.pitch };
}
/** Where the meter is held for a shot: on the focus target, or on the focus plane. */
function meterPoint(s: Shot, talent: TalentSpec[], bottle: PropSpec): THREE.Vector3 {
  if (s.focusOn) {
    const t = targetPoint(s.focusOn, talent, bottle);
    if (t) return t;
  }
  return new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z).addScaledVector(forward(s.yaw, s.pitch), s.focusM);
}
/**
 * A spot beside the subject, `deg` round from the active camera's side of
 * them (positive is camera right), `m` metres out. New lights and boards go
 * here, so they start lighting the subject and outside the frame.
 */
function besideSubject(s: Shot, subject: THREE.Vector3, deg: number, m: number): { x: number; z: number } {
  const toCam = new THREE.Vector3(s.pos.x - subject.x, 0, s.pos.z - subject.z).normalize();
  const a = rad(deg);
  const x = toCam.x * Math.cos(a) + toCam.z * Math.sin(a);
  const z = -toCam.x * Math.sin(a) + toCam.z * Math.cos(a);
  return {
    x: Math.max(-3.8, Math.min(4.2, subject.x + x * m)),
    z: Math.max(-2.3, Math.min(4.8, subject.z + z * m)),
  };
}
/** True when a thing `halfM` wide at (x, z) sits outside the shot's frame. */
function outOfFrame(s: Shot, hfov: number, x: number, z: number, halfM: number): boolean {
  const dx = x - s.pos.x;
  const dz = z - s.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return false;
  const f = forward(s.yaw, 0);
  const off = deg(Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dz * f.z) / d))));
  return off > hfov / 2 + deg(Math.atan(halfM / d)) + 3;
}
/**
 * Somewhere beside the subject on the given side (1 camera right, -1 camera
 * left) that the active camera cannot see. Every candidate out of frame is
 * scored by how far it is from the preferred angle and distance, and a spot
 * behind the subject costs extra, since a fill or a bounce from behind is a
 * different light.
 */
function findSpot(
  s: Shot, hfov: number, subject: THREE.Vector3, side: number, prefDeg: number, prefM: number, halfM: number,
  avoid: { x: number; z: number }[],
) {
  let best: { x: number; z: number } | null = null;
  let bestCost = Infinity;
  for (let m = Math.max(0.8, prefM - 0.5); m <= prefM + 2.5; m += 0.25) {
    for (let a = 10; a <= 170; a += 5) {
      const p = besideSubject(s, subject, a * side, m);
      if (!outOfFrame(s, hfov, p.x, p.z, halfM)) continue;
      // Not on top of a person, a camera or another light.
      if (avoid.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 0.55 + halfM)) continue;
      const cost = Math.abs(a - prefDeg) / 15 + Math.abs(m - prefM) * 1.5 + (a > 115 ? 4 : 0);
      if (cost < bestCost) { bestCost = cost; best = p; }
    }
  }
  return best ?? besideSubject(s, subject, prefDeg * side, prefM);
}
/**
 * A light with its diffusion frame kept in front of whatever it is aimed at:
 * a frame slid past the subject would be lighting the back of their head.
 */
function effLight(s: LightSpec, talent: TalentSpec[], bottle: PropSpec): LightSpec {
  if (!s.frame || !s.aimAt) return s;
  const t = targetPoint(s.aimAt, talent, bottle);
  if (!t) return s;
  const max = Math.max(0.3, t.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) - 0.5);
  return s.frame.distM > max ? { ...s, frame: { ...s.frame, distM: max } } : s;
}
function fixtureOf(s: LightSpec) {
  return FIXTURES.find((f) => f.id === s.fixtureId) ?? FIXTURES[0];
}
function lightLabel(s: LightSpec) {
  return `${s.role} · ${fixtureOf(s).name.replace(/^(Aputure|ARRI|Astera) /, "")}`;
}
function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose?.();
    (c as THREE.Light).dispose?.();
  });
}
/** Every source in the scene, as the meter sees it. */
function buildEmitters(
  lights: LightSpec[], win: WinState, practical: PracticalState, talent: TalentSpec[], bottle: PropSpec, kitchen: boolean,
): Emitter[] {
  const out: Emitter[] = [];
  for (const raw of lights) {
    if (!raw.on) continue;
    const s = effLight(raw, talent, bottle);
    const src = resolveSource(fixtureOf(s), s.modifierId, s.dimmer, s.beamDeg, s.frame);
    const a = aimOf(s, talent, bottle);
    out.push(emitterFromSource(s.id, lightLabel(s), new THREE.Vector3(s.x, s.y, s.z), forward(a.yaw, a.pitch), src));
  }
  if (win.on && kitchen) {
    const nits = WINDOW_SKIES[win.sky].skyNits * Math.pow(10, -win.nd);
    out.push({
      id: "window", label: "Window", pos: WINDOW_MID.clone(), fwd: new THREE.Vector3(1, 0, 0),
      candela: nits * WINDOW_AREA, beamDeg: 180, omni: false, sizeM: WINDOW.w, flux: nits * WINDOW_AREA * Math.PI,
    });
  }
  if (practical.on && kitchen) {
    const flux = PENDANT.lumens * practical.dimmer;
    out.push({
      id: "practical", label: "Pendant", pos: new THREE.Vector3(PENDANT.x, PENDANT.y, PENDANT.z), fwd: new THREE.Vector3(0, -1, 0),
      candela: flux / (4 * Math.PI), beamDeg: 360, omni: true, sizeM: PENDANT_R * 2, flux,
    });
  }
  return out;
}

export function PrevizPrototype() {
  const [initial] = useState(kitchenSetup);
  const [name, setName] = useState(initial.name);
  const [set, setSet] = useState<SetSpec>(initial.set);
  const [shots, setShots] = useState<Shot[]>(initial.shots);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [talent, setTalent] = useState<TalentSpec[]>(initial.talent);
  const [rawBottle, setRawBottle] = useState<PropSpec>(initial.bottle);
  const [aspectId, setAspectId] = useState(initial.aspectId);
  const [view, setView] = useState<"lens" | "free">("lens");
  const [clay, setClay] = useState(false);
  const [showBoard, setShowBoard] = useState(true);
  const [boardOpacity, setBoardOpacity] = useState(0.35);
  const [thirds, setThirds] = useState(false);
  const [units, setUnits] = useState<Units>("ft");
  const [sel, setSel] = useState<Selection>({ kind: "camera" });
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [help, setHelp] = useState(false);
  const [box, setBox] = useState({ w: 960, h: 540 });
  const [lights, setLights] = useState<LightSpec[]>(initial.lights);
  const [grips, setGrips] = useState<GripSpec[]>(initial.grips);
  const [win, setWin] = useState<WinState>(initial.win);
  const [practical, setPractical] = useState<PracticalState>(initial.practical);
  const [zebra, setZebra] = useState(false);
  const [meter, setMeter] = useState<Reading | null>(null);
  // The move timeline: where the playhead sits (0 start, 1 end), and playback.
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const bottle = useMemo(() => placeBottle(rawBottle, talent, set), [rawBottle, talent, set]);
  const rawActive = shots.find((s) => s.id === activeId) ?? shots[0];
  // What the camera sees right now: the start, the end, or a moment between.
  const active = viewShot(rawActive, playhead, talent, bottle);
  const aspect = ASPECTS.find((a) => a.id === aspectId) ?? ASPECTS[0];
  const body = BODIES.find((b) => b.id === active.bodyId) ?? BODIES[0];
  const area = imagedArea(body, aspect.ratio);
  const focus = effectiveFocus(active, talent, bottle);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ shots, activeId, talent, bottle, aspect, view, clay, lights, grips, win, practical, zebra, set, playhead });
  live.current = { shots, activeId, talent, bottle, aspect, view, clay, lights, grips, win, practical, zebra, set, playhead };
  // Playback runs in the render loop, not in React: `t0` is when the move
  // started, and a recording composites each frame onto `comp` for the clip.
  const playRef = useRef<{
    on: boolean; t0: number; from: number; hold: number;
    rec: MediaRecorder | null; comp: HTMLCanvasElement | null; chunks: Blob[]; file: string;
  }>({ on: false, t0: 0, from: 0, hold: 0, rec: null, comp: null, chunks: [], file: "" });
  const tickRef = useRef<((t: number) => void) | null>(null);
  const finishRef = useRef<(t: number) => void>(() => {});
  const toggleRef = useRef<() => void>(() => {});
  const unitRef = useRef<(s: Shot, at: Shot) => THREE.Group>(() => new THREE.Group());
  // What the meter worked out and the renderer needs: light thrown back by
  // each bounce board, and the averaged room bounce.
  const levels = useRef<{ bounce: Map<string, number>; roomLux: number }>({ bounce: new Map(), roomLux: 0 });
  const engine = useRef<{
    renderer: THREE.WebGLRenderer;
    world: ReturnType<typeof buildWorld>;
    shotCam: THREE.PerspectiveCamera;
    freeCam: THREE.PerspectiveCamera;
    controls: OrbitControls;
    rt: THREE.WebGLRenderTarget;
    quad: THREE.Mesh;
    quadScene: THREE.Scene;
    quadCam: THREE.OrthographicCamera;
    clayMat: THREE.Material;
    lightRigs: Map<string, LightRig>;
    gripRigs: Map<string, GripRig>;
    syncRigs: (wb: number) => void;
  } | null>(null);
  const captureQueue = useRef<string[]>([]);
  const lastChange = useRef(0);
  const activeDirty = useRef(true);
  const saveFrame = useRef(false);

  /**
   * Changes a shot. With a move, a camera change lands on whichever frame the
   * playhead is on: the end frame when it sits at the end, the start (the
   * shot's own values) otherwise. Between the two, it snaps to the nearer
   * one. The end is always kept to what the support can physically do.
   */
  const updateShot = useCallback((id: string, patch: Partial<Shot> | ((s: Shot) => Partial<Shot>)) => {
    const t = live.current.playhead;
    const isActive = id === live.current.activeId;
    const editEnd = isActive && t >= 0.5;
    setShots((all) => all.map((s) => {
      if (s.id !== id) return s;
      if (s.move && editEnd) {
        const cur: Shot = { ...s, ...s.move.end };
        const p = typeof patch === "function" ? patch(cur) : patch;
        const end: CamKey = { ...s.move.end };
        const rest: Partial<Shot> = { ...p };
        for (const k of ["pos", "yaw", "pitch", "focal", "focusM", "focusOn"] as const) {
          if (k in p) {
            (end as Record<string, unknown>)[k] = p[k];
            delete rest[k];
          }
        }
        const next = { ...s, ...rest };
        const move = (rest.move === undefined ? s.move : rest.move);
        return move ? { ...next, move: { ...move, end: constrainEnd(next.support, camKey(next), end, move.trackYaw) } } : next;
      }
      const next = { ...s, ...(typeof patch === "function" ? patch(s) : patch) };
      if (next.move) next.move = { ...next.move, end: constrainEnd(next.support, camKey(next), next.move.end, next.move.trackYaw) };
      return next;
    }));
    if (isActive && t > 0 && t < 1) setPlayhead(t >= 0.5 ? 1 : 0);
    lastChange.current = performance.now();
    activeDirty.current = true;
  }, []);

  // ----- Stage size: the canvas IS the frame, fitted to the delivery aspect.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // The frame takes the whole stage. The map is a small card in the corner
    // that can be minimised: the frame is the thing being judged.
    const fit = () => {
      const pad = 24;
      const aw = el.clientWidth - pad * 2;
      const ah = el.clientHeight - pad * 2;
      const w = Math.min(aw, ah * aspect.ratio);
      setBox({ w: Math.max(80, Math.floor(w)), h: Math.max(80, Math.floor(w / aspect.ratio)) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect.ratio]);

  // ----- Engine: built once, torn down on unmount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    // VSM so a shadow's softness can follow the size of the source.
    renderer.shadowMap.type = THREE.VSMShadowMap;
    // The scene is in real units (nits), and the camera exposes it: the
    // exposure is set per shot from stop, ISO, shutter and ND.
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const world = buildWorld(renderer);
    const shotCam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 60);
    shotCam.rotation.order = "YXZ";
    const freeCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 100);
    freeCam.position.set(5.5, 5.2, 6.5);
    const controls = new OrbitControls(freeCam, canvas);
    controls.target.set(-0.2, 0.8, -0.6);
    controls.enableDamping = true;
    controls.enabled = false;

    const depth = new THREE.DepthTexture(1, 1);
    depth.type = THREE.FloatType;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: depth, samples: 0 });
    const quadMat = dofMaterial();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const clayMat = new THREE.MeshStandardMaterial({ color: "#c9c7c3", roughness: 0.92 });

    const lightRigs = new Map<string, LightRig>();
    const gripRigs = new Map<string, GripRig>();

    // Places every light and board, and sets every source's strength and its
    // colour as the camera sees it at this white balance. Cheap enough to run
    // every frame; geometry is rebuilt only when a fixture or modifier changes.
    const syncRigs = (wb: number) => {
      const L = live.current;
      const seen = new Set<string>();
      let shadows = 0;
      for (const raw of L.lights) {
        const s = effLight(raw, L.talent, L.bottle);
        seen.add(s.id);
        let rig = lightRigs.get(s.id);
        if (!rig || rig.structureKey !== structureKey(s)) {
          if (rig) { world.lightsRoot.remove(rig.group); disposeTree(rig.group); }
          rig = buildLightRig(s);
          world.lightsRoot.add(rig.group);
          lightRigs.set(s.id, rig);
        }
        const src = resolveSource(fixtureOf(s), s.modifierId, s.dimmer, s.beamDeg, s.frame);
        const a = aimOf(s, L.talent, L.bottle);
        const t = s.aimAt ? targetPoint(s.aimAt, L.talent, L.bottle) : null;
        const d = t ? Math.max(0.3, t.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) - src.offsetM) : 2;
        const size = Math.max(src.sourceW, src.sourceH);
        const soft = apparentSizeDeg(size, d);
        const cast = s.on && shadows < 5;
        if (cast) shadows++;
        const lit = { ...src, candela: src.candela * nearFieldScale(size, d) };
        updateLightRig(rig, s, a, lit, soft, cameraColor(s.cct, wb), cast);
      }
      for (const [id, rig] of lightRigs) {
        if (seen.has(id)) continue;
        world.lightsRoot.remove(rig.group);
        disposeTree(rig.group);
        lightRigs.delete(id);
      }
      seen.clear();
      for (const g of L.grips) {
        seen.add(g.id);
        let rig = gripRigs.get(g.id);
        const key = `${g.kind}|${g.sizeFt}`;
        if (!rig || rig.group.userData.key !== key) {
          if (rig) { world.lightsRoot.remove(rig.group); disposeTree(rig.group); }
          rig = buildGripRig(g);
          rig.group.userData.key = key;
          world.lightsRoot.add(rig.group);
          gripRigs.set(g.id, rig);
        }
        const gt = g.aimAt ? targetPoint(g.aimAt, L.talent, L.bottle) : null;
        const gd = gt ? Math.max(0.3, gt.distanceTo(new THREE.Vector3(g.x, g.y, g.z))) : 2;
        const cd = (levels.current.bounce.get(g.id) ?? 0) * nearFieldScale(g.sizeFt * FT, gd);
        updateGripRig(rig, g, aimOf(g, L.talent, L.bottle), cd, cameraColor(5600, wb));
      }
      for (const [id, rig] of gripRigs) {
        if (seen.has(id)) continue;
        world.lightsRoot.remove(rig.group);
        disposeTree(rig.group);
        gripRigs.delete(id);
      }

      // Daylight: the sky through the glass, and the sun when there is one.
      const sky = WINDOW_SKIES[L.win.sky];
      const kitchen = L.set.kind === "kitchen";
      const tau = Math.pow(10, -L.win.nd) * (L.win.on && kitchen ? 1 : 0);
      const dayCol = cameraColor(WINDOW_CCT[L.win.sky], wb);
      world.windowLight.color.setRGB(...dayCol);
      world.windowLight.intensity = sky.skyNits * WINDOW_AREA * tau;
      world.sky.emissive.setRGB(...dayCol);
      world.sky.emissiveIntensity = sky.skyNits * tau + (L.win.on ? 0 : 30);
      world.sun.color.setRGB(...cameraColor(5600, wb));
      world.sun.intensity = sky.sunLux * tau;
      // The pendant: a bare bulb, its glass at the brightness it really has.
      const P = L.practical;
      const flux = P.on && kitchen ? PENDANT.lumens * P.dimmer : 0;
      const pCol = cameraColor(P.cct, wb);
      world.pendant.color.setRGB(...pCol);
      world.pendant.intensity = flux / (4 * Math.PI);
      world.bulb.emissive.setRGB(...pCol);
      world.bulb.emissiveIntensity = flux / (4 * Math.PI * Math.PI * PENDANT_R * PENDANT_R);
      // Room bounce: one averaged level, warm from the plaster and the floor.
      const room = levels.current.roomLux;
      world.bounce.color.setRGB(...cameraColor(5000, wb));
      world.bounce.intensity = room * 0.8;
      world.scene.environmentIntensity = (room * 0.2) / Math.PI;
    };

    engine.current = { renderer, world, shotCam, freeCam, controls, rt, quad, quadScene, quadCam, clayMat, lightRigs, gripRigs, syncRigs };
    captureQueue.current = live.current.shots.map((s) => s.id);

    let raf = 0;
    const thumbCanvas = document.createElement("canvas");
    const grab = (w: number) => {
      const src = renderer.domElement;
      thumbCanvas.width = w;
      thumbCanvas.height = Math.round((w * src.height) / src.width);
      thumbCanvas.getContext("2d")!.drawImage(src, 0, 0, thumbCanvas.width, thumbCanvas.height);
      return thumbCanvas.toDataURL("image/jpeg", 0.8);
    };

    const renderShot = (s: Shot) => {
      const L = live.current;
      const b = BODIES.find((x) => x.id === s.bodyId) ?? BODIES[0];
      const a = imagedArea(b, L.aspect.ratio);
      shotCam.fov = fovDeg(a.h, s.focal);
      shotCam.aspect = L.aspect.ratio;
      shotCam.updateProjectionMatrix();
      shotCam.position.set(s.pos.x, s.pos.y, s.pos.z);
      shotCam.rotation.set(rad(s.pitch), rad(s.yaw), 0);
      world.rigs.visible = false;
      world.scene.overrideMaterial = L.clay ? clayMat : null;
      syncRigs(s.wb);
      const expo = exposureScale(s.stop, s.iso, s.nd);
      renderer.toneMappingExposure = expo;
      renderer.setRenderTarget(rt);
      renderer.render(world.scene, shotCam);
      renderer.setRenderTarget(null);
      const u = quadMat.uniforms;
      u.tColor.value = rt.texture;
      u.tDepth.value = rt.depthTexture;
      u.cNear.value = shotCam.near;
      u.cFar.value = shotCam.far;
      u.focusM.value = effectiveFocus(s, L.talent, L.bottle);
      u.focalMm.value = s.focal;
      u.stop.value = s.stop;
      u.imgWmm.value = a.w;
      u.res.value.set(rt.width, rt.height);
      u.maxR.value = 22 * renderer.getPixelRatio();
      u.zebra.value = L.zebra ? 1 : 0;
      u.expo.value = expo;
      renderer.render(quadScene, quadCam);
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const L = live.current;
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      if (rt.width !== size.x || rt.height !== size.y) rt.setSize(size.x, size.y);

      // Where the playhead is this frame: from the clock while playing.
      const P = playRef.current;
      const raw = L.shots.find((x) => x.id === L.activeId) ?? L.shots[0];
      let t = P.rec && !P.on ? 0 : L.playhead;
      let finished = false;
      if (P.on && raw.move) {
        const el = (performance.now() - P.t0) / 1000 - P.hold;
        t = Math.max(0, Math.min(1, P.from + el / raw.move.durationS));
        finished = el - (1 - P.from) * raw.move.durationS > P.hold;
        tickRef.current?.(t);
      }
      const view = viewShot(raw, t, L.talent, L.bottle);

      if (L.view === "free") {
        // A dolly travelling in free view: rebuild just the moving camera.
        if (P.on) {
          const old = world.rigs.getObjectByName(`unit:${raw.id}`);
          if (old) { world.rigs.remove(old); disposeTree(old); }
          world.rigs.add(unitRef.current(raw, view));
        }
        if (finished) finishRef.current(1);
        const fs = L.shots.find((x) => x.id === L.activeId) ?? L.shots[0];
        syncRigs(fs.wb);
        renderer.toneMappingExposure = exposureScale(fs.stop, fs.iso, fs.nd);
        controls.update();
        world.rigs.visible = true;
        world.scene.overrideMaterial = L.clay ? clayMat : null;
        freeCam.aspect = size.x / size.y;
        freeCam.updateProjectionMatrix();
        renderer.render(world.scene, freeCam);
        return;
      }
      // Fill thumbnails for shots not yet seen, one per frame, never mid-move:
      // a thumbnail render in a recorded frame would be a flash of another shot.
      const queued = P.on || P.rec ? undefined : captureQueue.current.shift();
      if (queued) {
        const s = L.shots.find((x) => x.id === queued);
        if (s) {
          renderShot(s);
          const url = grab(360);
          setThumbs((t) => ({ ...t, [queued]: url }));
        }
      }
      const s = view;
      renderShot(s);
      if (P.rec && P.comp) {
        // The clip: this frame, with the shot's details burned in along the bottom.
        const c = P.comp;
        const g = c.getContext("2d")!;
        g.drawImage(renderer.domElement, 0, 0, c.width, c.height);
        const fs = Math.max(12, Math.round(c.height * 0.026));
        g.fillStyle = "rgba(0,0,0,0.5)";
        g.fillRect(0, c.height - fs * 2, c.width, fs * 2);
        g.fillStyle = "#ffffff";
        g.font = `600 ${fs}px Helvetica, Arial, sans-serif`;
        g.textBaseline = "middle";
        g.textAlign = "left";
        g.fillText(P.file, fs * 0.8, c.height - fs);
        g.textAlign = "right";
        g.fillText(`${(t * (raw.move?.durationS ?? 0)).toFixed(1)}s`, c.width - fs * 0.8, c.height - fs);
      }
      if (finished) finishRef.current(1);
      if (saveFrame.current) {
        saveFrame.current = false;
        const a = document.createElement("a");
        a.href = renderer.domElement.toDataURL("image/png");
        a.download = `${s.code}_previz.png`;
        a.click();
      }
      if (!P.on && activeDirty.current && performance.now() - lastChange.current > 300) {
        activeDirty.current = false;
        const url = grab(360);
        setThumbs((t) => ({ ...t, [s.id]: url }));
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      controls.dispose();
      rt.dispose();
      renderer.dispose();
      engine.current = null;
    };
  }, []);

  // ----- Canvas size follows the fitted box.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.renderer.setSize(box.w, box.h, false);
    activeDirty.current = true;
    lastChange.current = performance.now();
  }, [box.w, box.h]);

  // ----- Talent: rebuilt when anything about a person changes.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    for (const g of e.world.figures.values()) e.world.scene.remove(g);
    e.world.figures.clear();
    for (const t of talent) {
      const g = buildFigure(t);
      e.world.scene.add(g);
      e.world.figures.set(t.id, g);
    }
    activeDirty.current = true;
    lastChange.current = performance.now();
  }, [talent]);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.world.bottle.position.set(bottle.x, bottle.y ?? 0, bottle.z);
    // Held, the label turns with the person holding it, toward the camera they face.
    const holder = talent.find((t) => t.id === bottle.heldBy);
    e.world.bottle.rotation.y = holder ? rad(holder.facing) : 0;
    activeDirty.current = true;
    lastChange.current = performance.now();
  }, [bottle]);

  // A different shot starts at its own start frame.
  useEffect(() => {
    finishRef.current(0);
    setPlayhead(0);
  }, [activeId]);

  // ----- The set: the kitchen, or the stage with a paper backdrop.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.world.kitchen.visible = set.kind === "kitchen";
    e.world.studio.visible = set.kind === "studio";
    const old = e.world.studio.getObjectByName("backdrop");
    if (old) { e.world.studio.remove(old); disposeTree(old); }
    if (set.kind === "studio") e.world.studio.add(buildBackdrop(set.backdrop));
    activeDirty.current = true;
    lastChange.current = performance.now();
    captureQueue.current = live.current.shots.map((x) => x.id);
  }, [set]);

  // ----- The light meter. Runs when anything that moves light changes, not
  // every frame, because it casts shadow rays. It also works out what each
  // bounce board throws back and the room bounce, which the renderer reads.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const t = window.setTimeout(() => {
      const s = viewShot(shots.find((x) => x.id === activeId) ?? shots[0], playhead, talent, bottle);
      e.syncRigs(s.wb);
      e.world.scene.updateMatrixWorld(true);
      const occ = collectOccluders(e.world.scene);
      const kitchen = set.kind === "kitchen";
      const emitters = buildEmitters(lights, win, practical, talent, bottle, kitchen);
      const tau = win.on && kitchen ? Math.pow(10, -win.nd) : 0;
      const sunLux = WINDOW_SKIES[win.sky].sunLux * tau;
      const sun = sunLux > 0 ? { dir: SUN_DIR, lux: sunLux, label: "Sun through the window" } : null;
      const boards: Board[] = grips.map((g) => {
        const a = aimOf(g, talent, bottle);
        const side = g.sizeFt * FT;
        return {
          id: g.id, label: GRIP_NAMES[g.kind], pos: new THREE.Vector3(g.x, g.y, g.z), normal: forward(a.yaw, a.pitch),
          areaM2: side * side, sizeM: side, reflectance: GRIP_REFLECTANCE[g.kind],
        };
      });
      const bounce = bounceCandela(boards, emitters, occ, sun);
      const all = [...emitters];
      for (const b of boards) {
        const cd = bounce.get(b.id) ?? 0;
        if (cd <= 0) continue;
        all.push({ id: b.id, label: b.label, pos: b.pos.clone().addScaledVector(b.normal, 0.06), fwd: b.normal, candela: cd, beamDeg: 180, omni: false, sizeM: b.sizeM, flux: cd * Math.PI });
      }
      // Sun landing on the floor through the glass adds to the room too.
      const flux = emitters.reduce((n, x) => n + x.flux, 0) + sunLux * WINDOW_AREA * 0.8;
      // A stage has black walls a long way off: far less comes back than in a
      // plaster kitchen, and most of what does is off the paper.
      const roomLux = roomLuxFrom(flux) * (kitchen ? 1 : 0.35);
      levels.current = { bounce, roomLux };
      const p = meterPoint(s, talent, bottle);
      setMeter(readMeter(p, new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z), all, occ, sun, roomLux));
    }, 40);
    return () => window.clearTimeout(t);
  }, [shots, activeId, lights, grips, win, practical, talent, bottle, set, playhead]);

  // Light changes every shot, so every thumbnail is stale (once it settles).
  useEffect(() => {
    const t = window.setTimeout(() => {
      captureQueue.current = live.current.shots.map((x) => x.id).filter((id) => id !== live.current.activeId);
      activeDirty.current = true;
      lastChange.current = performance.now();
    }, 400);
    return () => window.clearTimeout(t);
  }, [lights, grips, win, practical, set, talent]);

  // ----- Camera rigs, seen only in free view. Each is a "unit": the camera
  // pans and tilts on its head, and what it is on stays on the floor, turned
  // to its track. A shot with a move also draws its path, start to end.
  unitRef.current = (s: Shot, at: Shot) => {
    const L = live.current;
    const i = L.shots.findIndex((x) => x.id === s.id);
    const b = BODIES.find((x) => x.id === s.bodyId) ?? BODIES[0];
    const a = imagedArea(b, L.aspect.ratio);
    const rig = buildRig(
      s.id === L.activeId ? "#ffffff" : SHOT_HUES[i % SHOT_HUES.length],
      fovDeg(a.w, at.focal),
      fovDeg(a.h, at.focal),
      effectiveFocus(at, L.talent, L.bottle),
      `${s.code} ${Math.round(at.focal)}mm`,
      s.bodyId,
      at.focal,
    );
    const unit = new THREE.Group();
    unit.name = `unit:${s.id}`;
    unit.position.set(at.pos.x, 0, at.pos.z);
    const sp = supportPose(s, at.pos);
    const legs = buildSupport(s.support, at.pos.y, bodyDrop(s.bodyId), sp.opts);
    const bar = rig.getObjectByName("panbar");
    if (bar) bar.visible = s.support !== "robot";
    legs.rotation.y = rad(sp.yaw);
    legs.traverse((o) => (o.userData.noOcclude = true));
    unit.add(legs);
    rig.position.set(0, at.pos.y, 0);
    rig.rotation.order = "YXZ";
    rig.rotation.set(rad(at.pitch), rad(at.yaw), 0);
    unit.add(rig);
    return unit;
  };
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    for (const old of [...e.world.rigs.children]) {
      e.world.rigs.remove(old);
      disposeTree(old);
    }
    for (const s of shots) {
      const at = s.id === activeId ? viewShot(s, playhead, talent, bottle) : s;
      e.world.rigs.add(unitRef.current(s, at));
      if (s.move) {
        const p0 = s.pos;
        const p1 = s.move.end.pos;
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p0.x, p0.y, p0.z), new THREE.Vector3(p1.x, p1.y, p1.z)]);
        const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: "#ffd166", dashSize: 0.08, gapSize: 0.05 }));
        line.computeLineDistances();
        line.name = `path:${s.id}`;
        line.userData.noOcclude = true;
        e.world.rigs.add(line);
      }
    }
  }, [shots, activeId, aspect.ratio, talent, bottle, playhead]);

  useEffect(() => {
    const e = engine.current;
    if (e) e.controls.enabled = view === "free";
  }, [view]);

  useEffect(() => {
    // Everything re-renders at the new aspect, so every thumbnail is stale.
    captureQueue.current = shots.map((s) => s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectId, clay]);

  // ----- Through-the-lens controls: drag pans and tilts like a fluid head,
  // shift or right drag trucks and booms, the wheel dollies. Long lenses move
  // slower per pixel, because they would on a real head.
  const drag = useRef<{ x: number; y: number; mode: "pan" | "truck" } | null>(null);
  const onCanvasDown = (e: React.PointerEvent) => {
    if (view !== "lens") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, mode: e.button === 2 || e.shiftKey ? "truck" : "pan" };
    setSel({ kind: "camera" });
  };
  const onCanvasMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || view !== "lens") return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    const vfov = fovDeg(area.h, active.focal);
    if (d.mode === "pan") {
      const k = vfov / box.h;
      updateShot(active.id, (s) => ({
        yaw: s.yaw - dx * k,
        pitch: Math.max(-89, Math.min(80, s.pitch - dy * k)),
      }));
    } else {
      const mpp = (2 * Math.tan(rad(vfov / 2)) * Math.max(focus, 1)) / box.h;
      const y = rad(active.yaw);
      updateShot(active.id, (s) => ({
        pos: {
          x: s.pos.x + Math.cos(y) * dx * mpp,
          y: Math.max(0.1, Math.min(4, s.pos.y - dy * mpp)),
          z: s.pos.z - Math.sin(y) * dx * mpp,
        },
      }));
    }
  };
  const onCanvasUp = () => (drag.current = null);
  const onWheel = (e: React.WheelEvent) => {
    if (view !== "lens") return;
    const step = -Math.sign(e.deltaY) * Math.min(0.25, Math.abs(e.deltaY) * 0.002) * Math.max(1, focus * 0.5);
    const f = forward(active.yaw, active.pitch);
    updateShot(active.id, (s) => ({ pos: { x: s.pos.x + f.x * step, y: Math.max(0.1, s.pos.y + f.y * step), z: s.pos.z + f.z * step } }));
  };

  // Keyboard: works anywhere on the page except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (k === "v") return setView((v) => (v === "lens" ? "free" : "lens"));
      if (k === "c" && !e.metaKey && !e.ctrlKey) return setClay((c) => !c);
      if (k === "b") return setShowBoard((b) => !b);
      if (k === "?") return setHelp((h) => !h);
      if (k === "z") return setZebra((z) => !z);
      if (e.key === " ") {
        e.preventDefault();
        return toggleRef.current();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && removeSelected()) return e.preventDefault();
      const n = Number(e.key);
      if (n >= 1 && n <= shots.length) {
        setActiveId(shots[n - 1].id);
        setSel({ kind: "camera" });
        return;
      }
      if (view !== "lens") return;
      const m = e.shiftKey ? 0.5 : 0.1;
      const turn = e.shiftKey ? 5 : 1;
      const y = rad(active.yaw);
      const fwd = forward(active.yaw, 0);
      const move = (dx: number, dy: number, dz: number) =>
        updateShot(active.id, (s) => ({ pos: { x: s.pos.x + dx, y: Math.max(0.1, s.pos.y + dy), z: s.pos.z + dz } }));
      if (k === "w") move(fwd.x * m, 0, fwd.z * m);
      else if (k === "s") move(-fwd.x * m, 0, -fwd.z * m);
      else if (k === "a") move(-Math.cos(y) * m, 0, Math.sin(y) * m);
      else if (k === "d") move(Math.cos(y) * m, 0, -Math.sin(y) * m);
      else if (k === "e") move(0, m, 0);
      else if (k === "q") move(0, -m, 0);
      else if (e.key === "ArrowLeft") updateShot(active.id, (s) => ({ yaw: s.yaw + turn }));
      else if (e.key === "ArrowRight") updateShot(active.id, (s) => ({ yaw: s.yaw - turn }));
      else if (e.key === "ArrowUp") updateShot(active.id, (s) => ({ pitch: Math.min(80, s.pitch + turn) }));
      else if (e.key === "ArrowDown") updateShot(active.id, (s) => ({ pitch: Math.max(-89, s.pitch - turn) }));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, active, shots, updateShot, sel]);

  // ----- Readouts
  const hfov = fovDeg(area.w, active.focal);
  const vfov = fovDeg(area.h, active.focal);
  const dof = dofLimits(active.focal, active.stop, focus, circleOfConfusion(body));
  const frameH = (area.h * focus) / active.focal;
  const size = shotSize(frameH);
  const angle = cameraAngle(active.pitch, active.pos.y);
  const focusName =
    active.focusOn === "bottle" ? "the bottle" : talent.find((t) => t.id === active.focusOn)?.name ?? null;

  // ----- Lights and grip. Letting go of a target keeps the head where it was
  // pointing, so "by hand" starts from the current aim, not from zero.
  const updateLight = (id: string, patch: Partial<LightSpec>) =>
    setLights((all) => all.map((l) => {
      if (l.id !== id) return l;
      const next = { ...l, ...patch };
      if (patch.aimAt === null && l.aimAt) Object.assign(next, aimOf(l, talent, bottle));
      if (patch.fixtureId && patch.fixtureId !== l.fixtureId) {
        const f = FIXTURES.find((x) => x.id === patch.fixtureId) ?? FIXTURES[0];
        next.modifierId = f.defaultModifier;
        next.cct = f.cctDefault;
        next.beamDeg = null;
      }
      return next;
    }));
  const updateGrip = (id: string, patch: Partial<GripSpec>) =>
    setGrips((all) => all.map((g) => {
      if (g.id !== id) return g;
      const next = { ...g, ...patch };
      if (patch.aimAt === null && g.aimAt) Object.assign(next, aimOf(g, talent, bottle));
      return next;
    }));
  const subjectId = active.focusOn ?? talent[0]?.id ?? null;
  const subjectAt = meterPoint(active, talent, bottle);
  const occupied = [
    ...talent, ...lights, ...grips, ...shots.map((x) => ({ x: x.pos.x, z: x.pos.z })), { x: bottle.x, z: bottle.z },
  ].map((o) => ({ x: o.x, z: o.z }));
  /** Which side of the subject a light is on, seen from the camera: 1 right, -1 left. */
  const keySideOf = (l: LightSpec) =>
    Math.sign((l.x - subjectAt.x) * (active.pos.z - subjectAt.z) - (l.z - subjectAt.z) * (active.pos.x - subjectAt.x)) || 1;
  const addLight = (fixtureId: string) => {
    const f = FIXTURES.find((x) => x.id === fixtureId) ?? FIXTURES[0];
    const id = `l${Date.now()}`;
    // The first light is a key, three-quarter camera right; after that a
    // fill on the other side from the key. Either way, out of frame.
    const key = lights.find((l) => l.role === "Key");
    const side = key ? -keySideOf(key) : 1;
    // A palm-sized MC goes in close and low, the way it gets used: a kicker
    // or an eye light just out of frame, not a key from across the room.
    const mini = f.kind === "mini";
    const at = findSpot(active, hfov, subjectAt, side, key ? 45 : 55, mini ? 0.9 : key ? 2.2 : 2.6, mini ? 0.2 : 0.5, occupied);
    const spec: LightSpec = {
      id, role: mini ? "Kicker" : key ? "Fill" : "Key", fixtureId: f.id, modifierId: f.defaultModifier, beamDeg: null, dimmer: mini ? 1 : 0.5,
      cct: f.cctDefault, ...at, y: mini ? subjectAt.y + 0.2 : Math.max(1.6, subjectAt.y + 0.8), yaw: 0, pitch: 0, aimAt: subjectId, frame: null, on: true,
    };
    setLights((all) => [...all, spec]);
    setSel({ kind: "light", id });
  };
  const addGrip = (kind: GripKind) => {
    const id = `g${Date.now()}`;
    // A bounce goes to the side opposite the key; a flag to the side, ready to cut.
    const key = lights.find((l) => l.role === "Key" && l.on);
    const keySide = key ? keySideOf(key) : 1;
    const sizeFt = kind === "flag" ? 2 : 4;
    const at = kind === "flag"
      ? findSpot(active, hfov, subjectAt, keySide, 80, 1.1, (sizeFt * FT) / 2, occupied)
      : findSpot(active, hfov, subjectAt, -keySide, 70, 1.5, (sizeFt * FT) / 2, occupied);
    const spec: GripSpec = { id, kind, sizeFt, ...at, y: Math.max(0.9, subjectAt.y), yaw: 0, pitch: 0, aimAt: subjectId };
    setGrips((all) => [...all, spec]);
    setSel({ kind: "grip", id });
  };
  const removeLight = (id: string) => {
    setLights((all) => all.filter((l) => l.id !== id));
    if (sel.kind === "light" && sel.id === id) setSel({ kind: "camera" });
  };
  const removeGrip = (id: string) => {
    setGrips((all) => all.filter((g) => g.id !== id));
    if (sel.kind === "grip" && sel.id === id) setSel({ kind: "camera" });
  };
  // A shot IS its camera, so deleting either deletes both. One always stays:
  // the viewport is always looking through a camera. A shot carries a board
  // and a framing somebody worked on, so it asks first; a light does not,
  // since putting one back is a single pick from the list.
  const removeShot = (id: string) => {
    if (shots.length <= 1) return;
    const s = shots.find((x) => x.id === id);
    if (!s || !window.confirm(`Delete shot ${s.code} ${s.title} and its camera?`)) return;
    const i = shots.findIndex((x) => x.id === id);
    const rest = shots.filter((x) => x.id !== id);
    setShots(rest);
    if (id === activeId) {
      setActiveId(rest[Math.min(i, rest.length - 1)].id);
      setSel({ kind: "camera" });
    }
  };
  const removeSelected = () => {
    if (sel.kind === "light") removeLight(sel.id);
    else if (sel.kind === "grip") removeGrip(sel.id);
    else return false;
    return true;
  };
  const targets = [...talent.map((t) => ({ id: t.id, name: t.name })), { id: "bottle", name: "Bottle" }];
  const targetName = focusName ?? "the focus point";
  const fmt = (m: number) => dist(m, units);

  const addShot = () => {
    // The next letter nobody is using, so a deleted 1B is not reissued twice.
    let n = 0;
    while (shots.some((x) => x.code === `1${String.fromCharCode(65 + n)}`)) n++;
    const code = `1${String.fromCharCode(65 + n)}`;
    const copy: Shot = { ...active, id: `s${Date.now()}`, code, title: "New shot", board: null, move: null, focal: Math.round(active.focal) };
    setShots((all) => [...all, copy]);
    setActiveId(copy.id);
    captureQueue.current.push(copy.id);
  };

  // ----- Moves: add, change, remove, play and record.
  const [canRecord, setCanRecord] = useState(false);
  useEffect(() => {
    setCanRecord(!!pickMime() && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype);
  }, []);
  const support = SUPPORTS.find((k) => k.id === rawActive.support) ?? SUPPORTS[0];
  const stats = rawActive.move ? moveStats(rawActive.support, camKey(rawActive), rawActive.move) : null;
  const moveWarnings: string[] = [];
  if (rawActive.move && stats) {
    const [lo, hi] = support.lens;
    const ys = [rawActive.pos.y, rawActive.move.end.pos.y];
    if (ys.some((y) => y < lo - 0.01 || y > hi + 0.01)) moveWarnings.push(`The lens leaves the ${support.name.toLowerCase()}'s height range (${dist(lo, units)} to ${dist(hi, units)})`);
    const dolly = rawActive.support === "dana" || rawActive.support === "fisher";
    if (dolly && stats.peak > 1.2) moveWarnings.push("Fast for a dolly grip to land cleanly: give it more time");
    if (rawActive.support === "robot" && stats.peak > 2.5) moveWarnings.push("Near the top speed of a motion control arm");
    if (rawActive.support === "dana" && stats.trackM && stats.trackM > 3.66) moveWarnings.push("Longer than Dana rails usually run (12 ft): a Fisher on track would do it");
  }
  const supportHints: Record<string, string> = {
    sticks: "pans, tilts and zooms only. Pick a dolly or the arm to travel.",
    dana: "slides across the shot at one height.",
    fisher: "pushes in, pulls out and booms.",
    robot: "can go anywhere within its reach.",
  };

  const finish = (t: number) => {
    const P = playRef.current;
    if (!P.on && !P.rec) return;
    P.on = false;
    if (P.rec && P.rec.state !== "inactive") P.rec.stop();
    P.rec = null;
    setPlaying(false);
    setRecording(false);
    setPlayhead(t);
    activeDirty.current = true;
  };
  finishRef.current = finish;
  const nowT = () => {
    const P = playRef.current;
    const d = rawActive.move?.durationS ?? 1;
    return Math.max(0, Math.min(1, P.from + ((performance.now() - P.t0) / 1000 - P.hold) / d));
  };
  const play = (record: boolean) => {
    const mv = rawActive.move;
    const e = engine.current;
    if (!mv || !e) return;
    const P = playRef.current;
    P.from = record || playhead >= 0.999 ? 0 : playhead;
    // A recorded clip holds half a second on each end, so it does not start
    // or stop on a frame that is already moving.
    P.hold = record ? 0.5 : 0;
    if (record) {
      const mime = pickMime();
      if (!mime) return;
      const src = e.renderer.domElement;
      const comp = document.createElement("canvas");
      comp.width = src.width - (src.width % 2);
      comp.height = src.height - (src.height % 2);
      const rec = new MediaRecorder(comp.captureStream(30), { mimeType: mime, videoBitsPerSecond: 12_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
      const file = `${rawActive.code}_${rawActive.title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}_previz.${ext}`;
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: mime.split(";")[0] });
        if (!blob.size) {
          setSaveNote("This browser did not record anything: try Chrome, or record again");
          return;
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        setSaveNote(`Clip saved: ${file}`);
      };
      P.comp = comp;
      P.rec = rec;
      P.file = `${rawActive.code} ${rawActive.title} · ${body.name} · ${support.name}: ${stats?.name ?? ""}`;
      // The recorder starts asynchronously; the move starts when it does, or
      // the first second of the clip is lost. Until then the loop keeps
      // painting the start frame into the clip canvas.
      rec.onstart = () => {
        P.t0 = performance.now();
        P.on = true;
        setPlaying(true);
      };
      rec.onerror = () => {
        finish(0);
        setSaveNote("Recording stopped with an error: try again");
      };
      P.from = 0;
      rec.start(250);
      setRecording(true);
      setView("lens");
      return;
    }
    P.t0 = performance.now();
    P.on = true;
    setPlaying(true);
  };
  toggleRef.current = () => (playRef.current.on ? finish(nowT()) : play(false));
  const addMove = () => {
    const k = camKey(rawActive);
    // A small move the support can actually make, so play shows something
    // straight away: a pan on sticks, a slide on the Dana, a push otherwise.
    let end: CamKey = { ...k };
    if (rawActive.support === "sticks") end = { ...k, yaw: k.yaw - 15 };
    else if (rawActive.support === "dana") end = { ...k, pos: fromLocal(k, 0.6, 0, 0) };
    else end = { ...k, pos: fromLocal(k, 0, 0, -0.6), focusM: Math.max(0.3, k.focusM - 0.6) };
    updateShot(rawActive.id, { move: { end, durationS: 4, ease: "smooth", trackYaw: k.yaw } });
    setPlayhead(1);
  };
  const removeMove = () => {
    updateShot(rawActive.id, { move: null });
    setPlayhead(0);
  };
  const changeMove = (p: Partial<Move>) => updateShot(rawActive.id, (s) => ({ move: s.move ? { ...s.move, ...p } : null }));

  // ----- The setup: kept in this browser, and openable from a file.
  const snapshot = (): Setup => ({
    v: 2, name, set, shots, activeId, talent,
    bottle: { id: rawBottle.id, name: rawBottle.name, x: rawBottle.x, z: rawBottle.z },
    lights, grips, win, practical, units, aspectId,
  });
  const applySetup = (x: Setup) => {
    setName(x.name);
    setSet(x.set);
    setShots(x.shots);
    setActiveId(x.activeId);
    setTalent(x.talent);
    setRawBottle(x.bottle);
    setLights(x.lights);
    setGrips(x.grips);
    setWin(x.win);
    setPractical(x.practical);
    setUnits(x.units);
    setAspectId(x.aspectId);
    setPlayhead(0);
    setSel({ kind: "camera" });
    setThumbs({});
    captureQueue.current = x.shots.map((s) => s.id);
  };
  useEffect(() => {
    const saved = loadSetup();
    if (saved) applySetup(saved);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const t = window.setTimeout(() => {
      const r = saveSetup(snapshot());
      if (r === "without-boards") setSaveNote("Saved, but storyboard pictures are too big to keep in this browser");
      else if (r === "failed") setSaveNote("This browser would not save the setup: download it to keep it");
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, name, set, shots, activeId, talent, rawBottle, lights, grips, win, practical, units, aspectId]);
  useEffect(() => {
    if (!saveNote) return;
    const t = window.setTimeout(() => setSaveNote(null), 5000);
    return () => window.clearTimeout(t);
  }, [saveNote]);
  const newSetup = (which: "studio" | "kitchen") => {
    if (!window.confirm("Start a new setup? This one is replaced in this browser. Download it first if you want to keep it.")) return;
    applySetup(which === "studio" ? studioSetup() : kitchenSetup());
  };
  const openFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then((txt) => {
      let parsed: Setup | null = null;
      try { parsed = asSetup(JSON.parse(txt)); } catch { parsed = null; }
      if (!parsed) { window.alert("That file is not a scene setup this page can open."); return; }
      applySetup(parsed);
      setSaveNote(`Opened ${parsed.name}`);
    });
  };
  const setupFileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);

  // ----- Talent
  const addPerson = () => {
    const id = `t${Date.now()}`;
    const n = talent.length + 1;
    const near = talent[talent.length - 1];
    const x = near ? Math.min(3, near.x + 0.8) : 0;
    const z = near ? near.z : set.kind === "studio" ? -0.2 : 0;
    const hues = ["#7a5c99", "#3f7a5c", "#99683f", "#3f5f99", "#993f55"];
    setTalent((all) => [...all, {
      id, name: `Person ${n}`, heightM: 1.75, pose: "standing", x, z, facing: 0,
      top: hues[n % hues.length], bottom: "#34363b",
    }]);
    setSel({ kind: "talent", id });
  };
  const removePerson = (id: string) => {
    setTalent((all) => all.filter((t) => t.id !== id));
    if (sel.kind === "talent" && sel.id === id) setSel({ kind: "camera" });
  };
  const updatePerson = (id: string, p: Partial<TalentSpec>) =>
    setTalent((all) => all.map((t) => {
      if (t.id !== id) {
        // One bottle: handing it to someone takes it from whoever had it.
        return p.holding === "bottle" && t.holding === "bottle" ? { ...t, holding: null } : t;
      }
      const next = { ...t, ...p };
      if (p.pose === "holding" && !all.some((o) => o.id !== id && o.holding === "bottle" && o.pose === "holding")) next.holding = "bottle";
      return next;
    }));

  const onBoardFile = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => updateShot(active.id, { board: String(r.result) });
    r.readAsDataURL(file);
  };

  return (
    <div className="flex h-screen min-h-[640px] flex-col overflow-hidden bg-bg text-text">
      <div className="border-b border-border bg-surface px-4 py-1.5 text-xs font-semibold text-text-muted lg:hidden">
        Scene Setup is a desktop workspace. Open this on a laptop or larger screen.
      </div>

      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2">
        <div className="relative mr-3 min-w-0">
          <div className="flex items-center gap-2">
            <input
              aria-label="Setup name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-[230px] truncate rounded-[6px] border border-transparent bg-transparent px-1 font-display text-[15px] font-bold hover:border-border focus:border-border focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
              className="rounded-[8px] border border-border px-2 py-0.5 text-[11px] font-semibold text-text-muted hover:text-text"
            >
              Setup ▾
            </button>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Prototype</span>
          </div>
          <p className="px-1 text-xs text-text-muted">
            {saveNote ?? `${shots.length} shot${shots.length === 1 ? "" : "s"} · saved in this browser`}
          </p>
          {menu ? (
            <div className="absolute left-0 top-full z-30 mt-1 w-[260px] rounded-[12px] border border-border bg-surface p-1.5 shadow-lg" onMouseLeave={() => setMenu(false)}>
              {[
                { l: "New: talent on seamless", d: "Studio, paper backdrop, two people", f: () => newSetup("studio") },
                { l: "New: kitchen sample", d: "The room the prototype opened on", f: () => newSetup("kitchen") },
                { l: "Download this setup", d: "A file you can open on another computer", f: () => downloadSetup(snapshot()) },
                { l: "Open a setup file", d: "One you downloaded before", f: () => setupFileRef.current?.click() },
              ].map((o) => (
                <button
                  key={o.l}
                  type="button"
                  onClick={() => { setMenu(false); o.f(); }}
                  className="block w-full rounded-[8px] px-2.5 py-1.5 text-left hover:bg-surface-2"
                >
                  <span className="block text-xs font-semibold">{o.l}</span>
                  <span className="block text-[11px] text-text-muted">{o.d}</span>
                </button>
              ))}
            </div>
          ) : null}
          <input ref={setupFileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <Seg
          value={view}
          onChange={(v) => setView(v as "lens" | "free")}
          options={[{ v: "lens", l: "Through the lens" }, { v: "free", l: "Free view" }]}
        />
        <Toggle on={clay} onClick={() => setClay(!clay)} label="Clay" hint="C" />
        <Toggle on={showBoard} onClick={() => setShowBoard(!showBoard)} label="Board" hint="B" />
        {showBoard ? (
          <input
            aria-label="Storyboard opacity"
            type="range" min={0.1} max={0.9} step={0.05} value={boardOpacity}
            onChange={(e) => setBoardOpacity(Number(e.target.value))}
            className="w-24 accent-[var(--accent)]"
          />
        ) : null}
        <Toggle on={thirds} onClick={() => setThirds(!thirds)} label="Thirds" />
        <Toggle on={zebra} onClick={() => setZebra(!zebra)} label="Zebras" hint="Z" />
        <label className="ml-1 flex items-center gap-1.5 text-xs text-text-muted">
          Frame
          <select
            value={aspectId}
            onChange={(e) => setAspectId(e.target.value)}
            className="rounded-[8px] border border-border bg-surface px-2 py-1 text-xs text-text"
          >
            {ASPECTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <Seg value={units} onChange={(v) => setUnits(v as Units)} options={[{ v: "ft", l: "ft" }, { v: "m", l: "m" }]} />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled
            title="The photoreal still renderer is slice 3"
            className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold text-text-faint"
          >
            Render this frame
          </button>
          <button
            type="button"
            onClick={() => { setView("lens"); saveFrame.current = true; }}
            className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-accent-strong"
          >
            Save frame
          </button>
          <button
            type="button"
            onClick={() => setHelp(!help)}
            className="rounded-full border border-border px-2.5 py-1 text-xs font-bold text-text-muted"
            aria-label="Controls"
          >
            ?
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[210px_minmax(0,1fr)_300px]">
        {/* Left rail: what is in the scene */}
        <aside className="min-h-0 overflow-y-auto border-r border-border bg-surface p-3 text-sm">
          <RailGroup title="Set">
            {set.kind === "kitchen" ? (
              <RailItem active={sel.kind === "set"} onClick={() => setSel({ kind: "set" })} dot="#a89a86" label="Kitchen" sub="room, window, counter, table" />
            ) : (
              <RailItem
                active={sel.kind === "set"} onClick={() => setSel({ kind: "set" })} dot={set.backdrop.color}
                label="Studio backdrop"
                sub={`${set.backdrop.widthIn} in ${PAPER_COLORS.find((c) => c.hex === set.backdrop.color)?.name.toLowerCase() ?? "custom"} seamless`}
              />
            )}
          </RailGroup>
          <RailGroup title="Talent">
            {talent.map((t) => (
              <RailItem
                key={t.id}
                active={sel.kind === "talent" && sel.id === t.id}
                onClick={() => setSel({ kind: "talent", id: t.id })}
                dot={t.top}
                label={t.name}
                onDelete={() => removePerson(t.id)}
                deleteLabel={`Remove ${t.name}`}
                sub={`${dist(t.heightM, units)} · ${(POSES.find((p) => p.id === t.pose)?.name ?? t.pose).toLowerCase()}`}
              />
            ))}
            <button type="button" onClick={addPerson} className="mt-1 w-full rounded-[8px] border border-dashed border-border px-2 py-1 text-xs font-semibold text-text-muted hover:text-text">+ Add a person</button>
          </RailGroup>
          <RailGroup title="Props">
            <RailItem
              active={sel.kind === "prop"} onClick={() => setSel({ kind: "prop" })} dot="#2f6f62" label="Hero bottle"
              sub={bottle.heldBy ? `in ${talent.find((t) => t.id === bottle.heldBy)?.name ?? "a"}'s hand` : (bottle.y ?? 0) > 0 ? "on a surface" : "on the floor"}
            />
          </RailGroup>
          <RailGroup title="Lights">
            {set.kind === "kitchen" ? (
              <>
                <RailItem
                  active={sel.kind === "window"} onClick={() => setSel({ kind: "window" })} dot={win.on ? "#8fc2f0" : "#5b6068"}
                  label="Window" sub={win.on ? `${WINDOW_SKIES[win.sky].name.toLowerCase()}${win.nd ? `, ND ${win.nd.toFixed(1)}` : ""}` : "off"}
                />
                <RailItem
                  active={sel.kind === "practical"} onClick={() => setSel({ kind: "practical" })} dot={practical.on ? "#ffc879" : "#5b6068"}
                  label="Pendant" sub={practical.on ? `practical, ${Math.round(practical.dimmer * 100)}%` : "off"}
                />
              </>
            ) : null}
            {lights.map((l) => (
              <RailItem
                key={l.id}
                active={sel.kind === "light" && sel.id === l.id}
                onClick={() => setSel({ kind: "light", id: l.id })}
                dot={l.on ? "#e4b94a" : "#5b6068"}
                onDelete={() => removeLight(l.id)}
                deleteLabel={`Delete ${l.role} light`}
                label={`${l.role}`}
                sub={l.on ? `${fixtureOf(l).name.replace(/^(Aputure|ARRI|Astera) /, "")}, ${Math.round(l.dimmer * 100)}%` : "off"}
              />
            ))}
            <select
              aria-label="Add a light"
              value=""
              onChange={(e) => { if (e.target.value) addLight(e.target.value); }}
              className="mt-1 w-full rounded-[8px] border border-dashed border-border bg-surface px-2 py-1 text-xs font-semibold text-text-muted"
            >
              <option value="">+ Add a light</option>
              {FIXTURES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </RailGroup>
          <RailGroup title="Grip">
            {grips.map((g) => (
              <RailItem
                key={g.id}
                active={sel.kind === "grip" && sel.id === g.id}
                onClick={() => setSel({ kind: "grip", id: g.id })}
                dot={g.kind === "flag" ? "#1d1d1f" : g.kind === "silver" ? "#c8ccd2" : "#f2f2ee"}
                label={GRIP_NAMES[g.kind]}
                onDelete={() => removeGrip(g.id)}
                sub={`${g.sizeFt}x${g.sizeFt}${g.aimAt ? `, on ${targets.find((t) => t.id === g.aimAt)?.name ?? ""}` : ""}`}
              />
            ))}
            <div className="mt-1 flex gap-1">
              <button type="button" onClick={() => addGrip("bounce")} className="flex-1 rounded-[8px] border border-dashed border-border px-2 py-1 text-xs font-semibold text-text-muted hover:text-text">+ Bounce</button>
              <button type="button" onClick={() => addGrip("flag")} className="flex-1 rounded-[8px] border border-dashed border-border px-2 py-1 text-xs font-semibold text-text-muted hover:text-text">+ Flag</button>
            </div>
          </RailGroup>
          <RailGroup title="Cameras">
            {shots.map((s, i) => (
              <RailItem
                key={s.id}
                active={sel.kind === "camera" && s.id === activeId}
                onClick={() => { setActiveId(s.id); setSel({ kind: "camera" }); }}
                dot={SHOT_HUES[i % SHOT_HUES.length]}
                label={`${s.code} ${s.title}`}
                onDelete={shots.length > 1 ? () => removeShot(s.id) : undefined}
                deleteLabel={`Delete shot ${s.code} and its camera`}
                sub={`${(BODIES.find((b) => b.id === s.bodyId) ?? BODIES[0]).name}, ${s.focal}mm, ${(SUPPORTS.find((k) => k.id === s.support) ?? SUPPORTS[0]).name}`}
              />
            ))}
          </RailGroup>
        </aside>

        {/* Stage, with the move timeline under it */}
        <div className="flex min-h-0 flex-col">
        <main
          ref={stageRef}
          className="relative min-h-0 flex-1 overflow-hidden"
          style={{ background: STAGE_BG }}
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: box.w, height: box.h }}>
            <canvas
              ref={canvasRef}
              onPointerDown={onCanvasDown}
              onPointerMove={onCanvasMove}
              onPointerUp={onCanvasUp}
              onPointerCancel={onCanvasUp}
              onWheel={onWheel}
              onContextMenu={(e) => e.preventDefault()}
              className={`block h-full w-full ${view === "lens" ? "cursor-grab active:cursor-grabbing" : "cursor-move"}`}
              style={{ width: box.w, height: box.h }}
            />
            {view === "lens" && showBoard && active.board ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.board}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                style={{ opacity: boardOpacity, mixBlendMode: "multiply" }}
              />
            ) : null}
            {view === "lens" && thirds ? (
              <div className="pointer-events-none absolute inset-0">
                {[1, 2].map((i) => (
                  <div key={`v${i}`} className="absolute top-0 h-full w-px bg-white/40" style={{ left: `${(i * 100) / 3}%` }} />
                ))}
                {[1, 2].map((i) => (
                  <div key={`h${i}`} className="absolute left-0 h-px w-full bg-white/40" style={{ top: `${(i * 100) / 3}%` }} />
                ))}
              </div>
            ) : null}
            {view === "lens" ? (
              <div className="pointer-events-none absolute left-3 top-3 rounded-[8px] bg-black/55 px-2.5 py-1.5 font-mono text-[11px] leading-tight text-white/90">
                <div className="font-semibold">{active.code} · {body.name}</div>
                <div>{Math.round(active.focal)}mm · f/{active.stop} · focus {dist(focus, units)}</div>
              </div>
            ) : (
              <div className="pointer-events-none absolute left-3 top-3 rounded-[8px] bg-black/55 px-2.5 py-1.5 text-[11px] text-white/90">
                Free view · drag to orbit, scroll to zoom · press V for the lens
              </div>
            )}
          </div>

          <TopDownMap
            talent={talent}
            bottle={bottle}
            shots={shots.map((x) => (x.id === activeId ? active : x))}
            rawShots={shots}
            set={set}
            supportOf={(x, at) => supportPose(x, at)}
            onBackdrop={(x, z) => setSet((st) => ({ ...st, backdrop: { ...st.backdrop, x, z } }))}
            activeId={activeId}
            aspectRatio={aspect.ratio}
            onTalent={(id, x, z) => setTalent((all) => all.map((t) => (t.id === id ? { ...t, x, z } : t)))}
            onBottle={(x, z) => {
              // Picking the bottle up off the map takes it out of anyone's hand.
              setRawBottle((b) => ({ ...b, x, z }));
              if (bottle.heldBy) setTalent((all) => all.map((t) => (t.holding === "bottle" ? { ...t, holding: null } : t)));
            }}
            onCamera={(id, x, z) => updateShot(id, (s) => ({ pos: { ...s.pos, x, z } }))}
            onAim={(id, yaw) => updateShot(id, { yaw })}
            lights={lights}
            grips={grips}
            winOn={win.on}
            practicalOn={practical.on}
            selected={sel}
            aimOfLight={(l) => aimOf(l, talent, bottle)}
            effLight={(l) => effLight(l, talent, bottle)}
            onLight={(id, x, z) => setLights((all) => all.map((l) => (l.id === id ? { ...l, x, z } : l)))}
            onLightAim={(id, yaw) => setLights((all) => all.map((l) => (l.id === id ? { ...l, ...aimOf(l, talent, bottle), yaw, aimAt: null } : l)))}
            onGrip={(id, x, z) => setGrips((all) => all.map((g) => (g.id === id ? { ...g, x, z } : g)))}
            onGripAim={(id, yaw) => setGrips((all) => all.map((g) => (g.id === id ? { ...g, ...aimOf(g, talent, bottle), yaw, aimAt: null } : g)))}
            onPick={(k) => {
              if (k.kind === "camera") { setActiveId(k.id); setSel({ kind: "camera" }); }
              else if (k.kind === "talent") setSel({ kind: "talent", id: k.id });
              else if (k.kind === "light") setSel({ kind: "light", id: k.id });
              else if (k.kind === "grip") setSel({ kind: "grip", id: k.id });
              else if (k.kind === "window") setSel({ kind: "window" });
              else if (k.kind === "practical") setSel({ kind: "practical" });
              else if (k.kind === "backdrop") setSel({ kind: "set" });
              else setSel({ kind: "prop" });
            }}
          />

          {help ? <HelpCard onClose={() => setHelp(false)} /> : null}
        </main>
        <Timeline
          move={rawActive.move}
          stats={stats}
          playhead={playhead}
          playing={playing}
          recording={recording}
          tickRef={tickRef}
          supportName={support.name}
          supportHint={supportHints[rawActive.support]}
          warnings={moveWarnings}
          onPlay={() => play(false)}
          onStop={() => finish(nowT())}
          onSeek={(t) => setPlayhead(t)}
          onAdd={addMove}
          onRemove={removeMove}
          onChange={changeMove}
          onRecord={() => play(true)}
          fmtDist={(m) => dist(m, units)}
          fmtSpeed={(v) => (units === "ft" ? `${(v / 0.3048).toFixed(1)} ft/s` : `${v.toFixed(2)} m/s`)}
          canRecord={canRecord}
        />
        </div>

        {/* Inspector */}
        <aside className="min-h-0 overflow-y-auto border-l border-border bg-surface p-4 text-sm">
          {sel.kind === "camera" ? (
            <CameraInspector
              shot={active}
              units={units}
              focus={focus}
              focusName={focusName}
              talent={talent}
              readouts={{ hfov, vfov, near: dof.near, far: dof.far, hyper: dof.hyperfocal, size, angle }}
              onChange={(p) => updateShot(active.id, p)}
              onDelete={shots.length > 1 ? () => removeShot(active.id) : undefined}
              onBoardFile={onBoardFile}
              exposure={
                <ExposurePanel
                  stop={active.stop} iso={active.iso} nd={active.nd} wb={active.wb}
                  reading={meter} targetName={targetName}
                  onChange={(p) => updateShot(active.id, p)}
                />
              }
            />
          ) : sel.kind === "talent" && talent.some((t) => t.id === sel.id) ? (
            <TalentInspector
              t={talent.find((x) => x.id === sel.id)!}
              units={units}
              onChange={(p) => updatePerson(sel.id, p)}
              onDelete={() => removePerson(sel.id)}
            />
          ) : sel.kind === "prop" ? (
            <Info title="Hero bottle" lines={[
              bottle.heldBy
                ? `In ${talent.find((t) => t.id === bottle.heldBy)?.name ?? "someone"}'s right hand. Drag it on the map to put it down.`
                : `Standing ${bottle.y === BOTTLE_TOP_Y ? "on the table" : (bottle.y ?? 0) > 0 ? "on the counter" : "on the floor"}. Drag it on the map to move it.`,
              "To put it in someone's hand, give them the Holding product pose.",
              "A real product comes in as its actual size with your label wrapped on.",
            ]} />
          ) : sel.kind === "light" && lights.some((l) => l.id === sel.id) ? (
            <LightInspector
              s={lights.find((l) => l.id === sel.id)!}
              targets={targets} reading={meter} targetName={targetName} fmt={fmt}
              onChange={(p) => updateLight(sel.id, p)}
              onDelete={removeSelected}
            />
          ) : sel.kind === "grip" && grips.some((g) => g.id === sel.id) ? (
            <GripInspector
              g={grips.find((g) => g.id === sel.id)!}
              targets={targets} reading={meter} targetName={targetName} fmt={fmt}
              onChange={(p) => updateGrip(sel.id, p)}
              onDelete={removeSelected}
            />
          ) : sel.kind === "window" ? (
            <WindowInspector
              sky={win.sky} nd={win.nd} on={win.on} reading={meter} targetName={targetName} fmt={fmt}
              onChange={(p) => setWin((w) => ({ ...w, ...p }))}
            />
          ) : sel.kind === "practical" ? (
            <PracticalInspector
              dimmer={practical.dimmer} cct={practical.cct} on={practical.on} reading={meter} targetName={targetName} fmt={fmt}
              onChange={(p) => setPractical((x) => ({ ...x, ...p }))}
            />
          ) : (
            <SetInspector set={set} talent={talent} units={units} onChange={setSet} />
          )}
        </aside>
      </div>

      {/* Shots strip */}
      <footer className="flex gap-3 overflow-x-auto border-t border-border bg-surface px-4 py-3">
        {shots.map((s, i) => {
          const b = BODIES.find((x) => x.id === s.bodyId) ?? BODIES[0];
          const a = imagedArea(b, aspect.ratio);
          const f = effectiveFocus(s, talent, bottle);
          const isActive = s.id === activeId;
          return (
            <div key={s.id} className="group relative shrink-0">
            <button
              type="button"
              onClick={() => { setActiveId(s.id); setSel({ kind: "camera" }); setView("lens"); }}
              className={`flex shrink-0 flex-col gap-1.5 rounded-[12px] border p-2 text-left transition ${
                isActive ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong"
              }`}
            >
              <div className="flex gap-1.5">
                <Thumb src={s.board} label="Board" />
                <Thumb src={thumbs[s.id] ?? null} label="Camera" />
              </div>
              <div className="flex items-center gap-1.5 px-0.5">
                <span className="h-2 w-2 rounded-full" style={{ background: SHOT_HUES[i % SHOT_HUES.length] }} />
                <span className="text-xs font-bold">{s.code}</span>
                <span className="truncate text-xs text-text-muted">{s.title}</span>
              </div>
              <div className="px-0.5 text-[11px] text-text-muted">
                {s.focal}mm · f/{s.stop} · {shotSize((a.h * f) / s.focal)}
              </div>
            </button>
            {shots.length > 1 ? (
              <button
                type="button"
                onClick={() => removeShot(s.id)}
                aria-label={`Delete shot ${s.code}`}
                title={`Delete shot ${s.code} and its camera`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-[7px] border border-border bg-surface text-text-muted opacity-0 shadow-sm hover:text-text focus:opacity-100 group-hover:opacity-100"
              >
                <TrashIcon />
              </button>
            ) : null}
            </div>
          );
        })}
        <button
          type="button"
          onClick={addShot}
          className="flex w-[120px] shrink-0 flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed border-border text-xs font-semibold text-text-muted hover:border-border-strong hover:text-text"
        >
          <span className="text-lg leading-none">+</span>
          Shot from here
        </button>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- inspector

function CameraInspector({
  shot, units, focus, focusName, talent, readouts, onChange, onDelete, onBoardFile, exposure,
}: {
  shot: Shot;
  units: Units;
  focus: number;
  focusName: string | null;
  talent: TalentSpec[];
  readouts: { hfov: number; vfov: number; near: number; far: number; hyper: number; size: string; angle: string };
  onChange: (p: Partial<Shot>) => void;
  onDelete?: () => void;
  onBoardFile: (f: File | undefined) => void;
  exposure: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  // Focus slider runs on a log scale: the difference between 0.5 and 1 metre
  // matters far more than between 15 and 15.5.
  const toSlider = (m: number) => Math.log(m / 0.3) / Math.log(30 / 0.3);
  const fromSlider = (v: number) => 0.3 * Math.pow(30 / 0.3, v);
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">Camera</p>
          <h2 className="truncate font-display text-base font-bold">{shot.code} · {shot.title}</h2>
        </div>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            title="Delete this shot and its camera"
            className="flex shrink-0 items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-xs font-semibold text-text-muted hover:border-border-strong hover:text-text"
          >
            <TrashIcon />
            Delete shot
          </button>
        ) : null}
      </div>

      <Field label="Body">
        <select
          value={shot.bodyId}
          onChange={(e) => onChange({ bodyId: e.target.value })}
          className="w-full rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm"
        >
          {BODIES.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.format})</option>)}
        </select>
      </Field>

      <Field label="On">
        <div className="flex flex-wrap gap-1">
          {SUPPORTS.map((k) => (
            <Chip key={k.id} on={shot.support === k.id} onClick={() => onChange({ support: k.id })}>{k.name}</Chip>
          ))}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
          {(SUPPORTS.find((k) => k.id === shot.support) ?? SUPPORTS[0]).note}
        </p>
        {(() => {
          // Say so when the lens is somewhere this support cannot put it,
          // rather than quietly moving the camera and changing the frame.
          const sp = SUPPORTS.find((k) => k.id === shot.support) ?? SUPPORTS[0];
          const [lo, hi] = sp.lens;
          if (shot.pos.y >= lo && shot.pos.y <= hi) return null;
          return (
            <p className="mt-1.5 flex gap-1.5 rounded-[8px] border border-[var(--h-amber)] bg-[var(--h-amber-bg)] px-2 py-1.5 text-xs leading-relaxed text-text">
              <span aria-hidden className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--h-amber)]" />
              The lens is at {dist(shot.pos.y, units)}. {sp.name} range: {dist(lo, units)} to {dist(hi, units)}. Boom it into range or pick another support.
            </p>
          );
        })()}
      </Field>

      <Field label={`Lens · ${shot.focal}mm`}>
        <div className="flex flex-wrap gap-1">
          {PRIMES.map((f) => (
            <Chip key={f} on={shot.focal === f} onClick={() => onChange({ focal: f })}>{f}</Chip>
          ))}
        </div>
        <input
          aria-label="Focal length"
          type="range" min={12} max={200} step={1} value={shot.focal}
          onChange={(e) => onChange({ focal: Number(e.target.value) })}
          className="mt-2 w-full accent-[var(--accent)]"
        />
      </Field>

      <Field label={`Stop · f/${shot.stop}`}>
        <div className="flex flex-wrap gap-1">
          {STOPS.map((s) => (
            <Chip key={s} on={shot.stop === s} onClick={() => onChange({ stop: s })}>{s}</Chip>
          ))}
        </div>
      </Field>

      {exposure}

      <Field label={`Focus · ${dist(focus, units)}${focusName ? ` on ${focusName}` : ""}`}>
        <div className="flex flex-wrap gap-1">
          {talent.map((t) => (
            <Chip key={t.id} on={shot.focusOn === t.id} onClick={() => onChange({ focusOn: t.id })}>{t.name}</Chip>
          ))}
          <Chip on={shot.focusOn === "bottle"} onClick={() => onChange({ focusOn: "bottle" })}>Bottle</Chip>
        </div>
        <input
          aria-label="Focus distance"
          type="range" min={0} max={1} step={0.001} value={toSlider(focus)}
          onChange={(e) => onChange({ focusOn: null, focusM: fromSlider(Number(e.target.value)) })}
          className="mt-2 w-full accent-[var(--accent)]"
        />
        <p className="mt-1 text-xs text-text-muted">
          {focusName ? "Focus follows them as the camera moves. Drag the slider to pull by hand." : "Pulled by hand."}
        </p>
      </Field>

      <Field label={`Height · ${dist(shot.pos.y, units)}`}>
        <input
          aria-label="Lens height"
          type="range" min={0.15} max={3.5} step={0.01} value={shot.pos.y}
          onChange={(e) => onChange({ pos: { ...shot.pos, y: Number(e.target.value) } })}
          className="w-full accent-[var(--accent)]"
        />
      </Field>
      <Field label={`Tilt · ${shot.pitch >= 0 ? "up" : "down"} ${Math.abs(shot.pitch).toFixed(0)}°`}>
        <input
          aria-label="Tilt"
          type="range" min={-89} max={60} step={0.5} value={shot.pitch}
          onChange={(e) => onChange({ pitch: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
      </Field>

      <div className="rounded-[12px] border border-border bg-surface-2 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">What this lens sees</p>
        <Readout k="Field of view" v={`${readouts.hfov.toFixed(1)}° × ${readouts.vfov.toFixed(1)}°`} />
        <Readout k="In focus" v={`${dist(readouts.near, units)} to ${dist(readouts.far, units)}`} />
        <Readout k="Hyperfocal" v={dist(readouts.hyper, units)} />
        <Readout k="Lens height" v={dist(shot.pos.y, units)} />
      </div>

      <div className="rounded-[12px] border border-border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">Would fill shot list row {shot.code}</p>
        <Readout k="Shot size" v={readouts.size} />
        <Readout k="Shot type" v={readouts.angle} />
        <Readout k="Lens" v={`${shot.focal}mm at f/${shot.stop}`} />
        <p className="mt-2 text-xs text-text-muted">Not wired up in the prototype. The real build writes these to the row.</p>
      </div>

      <Field label="Storyboard frame">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold hover:border-border-strong"
          >
            Use my own frame
          </button>
          {SAMPLE_BOARDS[shot.code] && shot.board !== SAMPLE_BOARDS[shot.code] ? (
            <button
              type="button"
              onClick={() => onChange({ board: SAMPLE_BOARDS[shot.code] })}
              className="rounded-[10px] px-2 py-1.5 text-xs font-semibold text-text-muted hover:text-text"
            >
              Back to sample
            </button>
          ) : null}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onBoardFile(e.target.files?.[0])} />
        <p className="mt-1 text-xs text-text-muted">Stays in this browser tab. Nothing is uploaded.</p>
      </Field>
    </div>
  );
}

function TalentInspector({ t, units, onChange, onDelete }: {
  t: TalentSpec; units: Units; onChange: (p: Partial<TalentSpec>) => void; onDelete: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">Talent</p>
          <input
            aria-label="Name"
            value={t.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full rounded-[6px] border border-transparent bg-transparent font-display text-base font-bold hover:border-border focus:border-border focus:outline-none"
          />
        </div>
        <button
          type="button" onClick={onDelete}
          className="flex shrink-0 items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-xs font-semibold text-text-muted hover:border-border-strong hover:text-text"
        >
          <TrashIcon /> Remove
        </button>
      </div>
      <Field label={`Height · ${dist(t.heightM, units)}`}>
        <input
          aria-label="Height"
          type="range" min={1.2} max={2.1} step={0.01} value={t.heightM}
          onChange={(e) => onChange({ heightM: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
      </Field>
      <Field label="Pose">
        <div className="grid grid-cols-2 gap-1">
          {POSES.map((p) => (
            <Chip key={p.id} on={t.pose === p.id} onClick={() => onChange({ pose: p.id })}>{p.name}</Chip>
          ))}
        </div>
        {t.pose === "holding" ? (
          <label className="mt-2 flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={t.holding === "bottle"}
              onChange={(e) => onChange({ holding: e.target.checked ? "bottle" : null })}
              className="accent-[var(--accent)]"
            />
            Holding the hero bottle
          </label>
        ) : null}
      </Field>
      <Field label={`Facing · ${t.facing}°`}>
        <input
          aria-label="Facing"
          type="range" min={-180} max={180} step={1} value={t.facing}
          onChange={(e) => onChange({ facing: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
        <p className="mt-1 text-xs text-text-muted">0° faces the camera side of the room.</p>
      </Field>
      <Field label="Wardrobe">
        <div className="flex gap-3 text-xs text-text-muted">
          <label className="flex items-center gap-1.5">
            <input type="color" value={t.top} onChange={(e) => onChange({ top: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-border bg-surface" />
            Top
          </label>
          <label className="flex items-center gap-1.5">
            <input type="color" value={t.bottom} onChange={(e) => onChange({ bottom: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-border bg-surface" />
            Bottom
          </label>
        </div>
      </Field>
      <p className="text-xs text-text-muted">Drag them on the map to block the scene. No faces, on purpose: these are stand-ins, not likenesses.</p>
    </div>
  );
}

function SetInspector({ set, talent, units, onChange }: {
  set: SetSpec; talent: TalentSpec[]; units: Units; onChange: (s: SetSpec) => void;
}) {
  const b = set.backdrop;
  const setB = (p: Partial<BackdropSpec>) => onChange({ ...set, backdrop: { ...b, ...p } });
  // How far each person stands off the paper, measured from where it meets the floor.
  const r = rad(b.rot);
  const off = talent.map((t) => ({ name: t.name, d: (t.x - b.x) * Math.sin(r) + (t.z - b.z) * Math.cos(r) }));
  const closest = off.length ? off.reduce((m, x) => (x.d < m.d ? x : m)) : null;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">Set</p>
        <h2 className="font-display text-base font-bold">{set.kind === "studio" ? "Studio backdrop" : "Kitchen"}</h2>
      </div>
      <Seg
        value={set.kind}
        onChange={(v) => onChange({ ...set, kind: v as SetSpec["kind"] })}
        options={[{ v: "studio", l: "Studio backdrop" }, { v: "kitchen", l: "Kitchen sample" }]}
      />
      {set.kind === "kitchen" ? (
        <p className="text-sm text-text-muted">About 8 by 5 metres: window camera left, counter along the back wall, a dining table with two chairs.</p>
      ) : (
        <>
          <Field label="Paper roll">
            <div className="flex flex-wrap gap-1">
              {ROLL_WIDTHS.map((w) => (
                <Chip key={w.inches} on={b.widthIn === w.inches} onClick={() => setB({ widthIn: w.inches })}>{w.label}</Chip>
              ))}
            </div>
          </Field>
          <Field label={`Colour · ${PAPER_COLORS.find((c) => c.hex === b.color)?.name ?? "custom"}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              {PAPER_COLORS.map((c) => (
                <button
                  key={c.hex} type="button" title={c.name} aria-label={c.name}
                  onClick={() => setB({ color: c.hex })}
                  className={`h-6 w-6 rounded-full border ${b.color === c.hex ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : "border-border"}`}
                  style={{ background: c.hex }}
                />
              ))}
              <label className="ml-1 flex items-center gap-1 text-xs text-text-muted">
                <input type="color" value={b.color} onChange={(e) => setB({ color: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-border bg-surface" />
                Other
              </label>
            </div>
          </Field>
          <Field label={`Pulled out across the floor · ${dist(b.sweepM, units)}`}>
            <input
              aria-label="Sweep" type="range" min={1} max={5} step={0.05} value={b.sweepM}
              onChange={(e) => setB({ sweepM: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
          <Field label={`Turned · ${b.rot}°`}>
            <input
              aria-label="Turn" type="range" min={-60} max={60} step={1} value={b.rot}
              onChange={(e) => setB({ rot: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
          {closest ? (
            <div className="rounded-[12px] border border-border bg-surface-2 p-3 text-xs text-text-muted">
              <p>
                <span className="font-semibold text-text">{closest.name}</span> is {dist(Math.max(0, closest.d), units)} off the paper.
              </p>
              <p className="mt-1">
                {closest.d < 1.8
                  ? "Close enough that a key will throw their shadow onto the background. 6 to 10 ft off keeps it on the floor."
                  : "Far enough that their shadow falls on the floor, and the paper can be lit on its own."}
              </p>
            </div>
          ) : null}
          <p className="text-xs text-text-muted">Drag the paper on the map to move it.</p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- top-down map

type Pick =
  | { kind: "camera" | "talent" | "light" | "grip"; id: string }
  | { kind: "bottle" | "window" | "practical" | "backdrop" };

function TopDownMap({
  talent, bottle, shots, activeId, aspectRatio, onTalent, onBottle, onCamera, onAim, onPick,
  lights, grips, winOn, practicalOn, selected, aimOfLight, effLight, onLight, onLightAim, onGrip, onGripAim,
  rawShots, set, supportOf, onBackdrop,
}: {
  rawShots: Shot[];
  set: SetSpec;
  supportOf: (s: Shot, at: Vec3) => { yaw: number; opts: SupportOpts };
  onBackdrop: (x: number, z: number) => void;
  lights: LightSpec[];
  grips: GripSpec[];
  winOn: boolean;
  practicalOn: boolean;
  selected: Selection;
  aimOfLight: (p: LightSpec | GripSpec) => { yaw: number; pitch: number };
  effLight: (l: LightSpec) => LightSpec;
  onLight: (id: string, x: number, z: number) => void;
  onLightAim: (id: string, yaw: number) => void;
  onGrip: (id: string, x: number, z: number) => void;
  onGripAim: (id: string, yaw: number) => void;
  talent: TalentSpec[];
  bottle: PropSpec;
  shots: Shot[];
  activeId: string;
  aspectRatio: number;
  onTalent: (id: string, x: number, z: number) => void;
  onBottle: (x: number, z: number) => void;
  onCamera: (id: string, x: number, z: number) => void;
  onAim: (id: string, yaw: number) => void;
  onPick: (p: Pick) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Drawn after mount only: the geometry is computed with trig whose last
  // digit differs between the server and the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [size, setSize] = useState<"min" | "small" | "big">("small");
  const drag = useRef<(Pick & { aim?: boolean }) | null>(null);
  const grab = useRef({ dx: 0, dz: 0 });

  const toWorld = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const w = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.max(-3.9, Math.min(4.3, w.x)), z: Math.max(-2.4, Math.min(5, w.y)) };
  };
  const start = (p: Pick & { aim?: boolean }) => (e: React.PointerEvent) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    drag.current = p;
    onPick(p);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const w = toWorld(e);
    const yawTo = (px: number, pz: number) => (Math.atan2(-(w.x - px), -(w.z - pz)) * 180) / Math.PI;
    if (d.kind === "window" || d.kind === "practical") return;
    if (d.kind === "backdrop") return onBackdrop(w.x + grab.current.dx, w.z + grab.current.dz);
    if (d.kind === "bottle") onBottle(w.x, w.z);
    else if (d.kind === "talent") onTalent(d.id, w.x, w.z);
    else if (d.kind === "light") {
      const l = lights.find((x) => x.id === d.id);
      if (l && d.aim) onLightAim(d.id, yawTo(l.x, l.z));
      else onLight(d.id, w.x, w.z);
    } else if (d.kind === "grip") {
      const g = grips.find((x) => x.id === d.id);
      if (g && d.aim) onGripAim(d.id, yawTo(g.x, g.z));
      else onGrip(d.id, w.x, w.z);
    } else if (d.kind === "camera" && d.aim) {
      const s = shots.find((x) => x.id === d.id);
      if (s) onAim(d.id, yawTo(s.pos.x, s.pos.z));
    } else if (d.kind === "camera") onCamera(d.id, w.x, w.z);
  };

  if (!mounted) return null;
  return (
    <div
      className={`absolute bottom-3 right-3 overflow-hidden rounded-[12px] border border-white/10 bg-[#f4f1ea] shadow-lg ${
        size === "big" ? "w-[460px]" : size === "small" ? "w-[210px]" : "w-[150px]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 bg-black/80 px-2.5 py-1 text-[11px] font-semibold text-white/90">
        <span>Top-down map</span>
        <span className="flex gap-2">
          {size !== "min" ? (
            <button type="button" onClick={() => setSize(size === "big" ? "small" : "big")} className="text-white/70 hover:text-white">
              {size === "big" ? "Smaller" : "Bigger"}
            </button>
          ) : null}
          <button type="button" onClick={() => setSize(size === "min" ? "small" : "min")} className="text-white/70 hover:text-white">
            {size === "min" ? "Show" : "Hide"}
          </button>
        </span>
      </div>
      <svg
        style={{ display: size === "min" ? "none" : undefined }}
        ref={svgRef}
        viewBox="-4.4 -2.9 8.8 8.2"
        className="block w-full touch-none select-none"
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {/* floor grid, one metre */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`gx${i}`} x1={-4 + i} y1={-2.5} x2={-4 + i} y2={5} stroke="#d9d3c6" strokeWidth={0.015} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <line key={`gz${i}`} x1={-4} y1={-2.5 + i} x2={4.4} y2={-2.5 + i} stroke="#d9d3c6" strokeWidth={0.015} />
        ))}
        {set.kind === "kitchen" ? (
          <>
        {/* walls and window */}
        <path d="M-4.06 5 L-4.06 -2.56 L4.4 -2.56" fill="none" stroke="#5a5148" strokeWidth={0.12} />
        <line x1={-4.06} y1={-1.25} x2={-4.06} y2={0.45} stroke="#7fb3e6" strokeWidth={0.16} />
        <rect x={-1.1} y={-2.5} width={3.4} height={0.62} fill="#b8c4b7" stroke="#6f7f6f" strokeWidth={0.02} />
        {/* table + chairs */}
        <rect x={-0.8} y={-1.05} width={1.6} height={0.9} fill="#a98a70" stroke="#6a4a34" strokeWidth={0.025} rx={0.02} />
        {[0.35, -0.45].map((cx) => (
          <rect key={cx} x={cx - 0.22} y={-1.51} width={0.44} height={0.42} fill="none" stroke="#6a4a34" strokeWidth={0.02} />
        ))}
        {/* the window and the pendant: click to select */}
        <g className="cursor-pointer" onPointerDown={start({ kind: "window" })}>
          <rect x={-4.3} y={-1.25} width={0.5} height={1.7} fill="transparent" />
          <path d="M-3.95 -0.4 L-2.9 -0.4" stroke={winOn ? "#4f97d8" : "#9aa0a6"} strokeWidth={0.05} strokeDasharray="0.1 0.07" />
          {selected.kind === "window" ? <rect x={-4.22} y={-1.3} width={0.32} height={1.8} fill="none" stroke="#1d1d1f" strokeWidth={0.03} /> : null}
        </g>
        <circle
          cx={PENDANT.x} cy={PENDANT.z} r={0.1}
          fill={practicalOn ? "#ffd28f" : "#cfcac0"} stroke={selected.kind === "practical" ? "#1d1d1f" : "#b9891d"} strokeWidth={selected.kind === "practical" ? 0.04 : 0.02}
          className="cursor-pointer" onPointerDown={start({ kind: "practical" })}
        />

          </>
        ) : (
          <g
            className="cursor-move"
            onPointerDown={(e) => {
              const w = toWorld(e);
              grab.current = { dx: set.backdrop.x - w.x, dz: set.backdrop.z - w.z };
              start({ kind: "backdrop" })(e);
            }}
          >
            <polygon
              points={backdropFootprint(set.backdrop).map((p) => `${p.x},${p.z}`).join(" ")}
              fill={set.backdrop.color} fillOpacity={0.85}
              stroke={selected.kind === "set" ? "#1d1d1f" : "#8a857c"} strokeWidth={selected.kind === "set" ? 0.04 : 0.025}
            />
            {(() => {
              const f = backdropFootprint(set.backdrop);
              return <line x1={f[0].x} y1={f[0].z} x2={f[1].x} y2={f[1].z} stroke="#5a5148" strokeWidth={0.08} />;
            })()}
            <text x={set.backdrop.x} y={set.backdrop.z + set.backdrop.sweepM / 2} textAnchor="middle" fontSize={0.17} fontWeight={700} fill="#5a5148" pointerEvents="none">
              seamless
            </text>
          </g>
        )}
        {/* bounce boards and flags, edge on, with the side that works facing out */}
        {grips.map((g) => {
          const a = aimOfLight(g);
          const y = rad(a.yaw);
          const half = (g.sizeFt * FT * Math.cos(rad(a.pitch))) / 2 || 0.05;
          const px = Math.cos(y) * Math.max(half, 0.12);
          const pz = -Math.sin(y) * Math.max(half, 0.12);
          const hx = g.x - Math.sin(y) * 0.6;
          const hz = g.z - Math.cos(y) * 0.6;
          const isSel = selected.kind === "grip" && selected.id === g.id;
          const col = g.kind === "flag" ? "#1d1d1f" : g.kind === "silver" ? "#8b9097" : "#ffffff";
          return (
            <g key={g.id}>
              <line x1={g.x} y1={g.z} x2={hx} y2={hz} stroke="#8b8478" strokeWidth={0.02} strokeDasharray="0.06 0.05" />
              <circle cx={hx} cy={hz} r={0.08} fill="#fff" stroke="#6b645a" strokeWidth={0.03} className="cursor-crosshair" onPointerDown={start({ kind: "grip", id: g.id, aim: true })} />
              <line
                x1={g.x - px} y1={g.z - pz} x2={g.x + px} y2={g.z + pz}
                stroke={isSel ? "#1d1d1f" : "#6b645a"} strokeWidth={0.14} strokeLinecap="round"
                className="cursor-move" onPointerDown={start({ kind: "grip", id: g.id })}
              />
              <line x1={g.x - px} y1={g.z - pz} x2={g.x + px} y2={g.z + pz} stroke={col} strokeWidth={0.08} strokeLinecap="round" pointerEvents="none" />
            </g>
          );
        })}

        {/* lights: the beam they throw, a drag handle, and a white dot to aim */}
        {lights.map((raw) => {
          const l = effLight(raw);
          const a = aimOfLight(l);
          const y = rad(a.yaw);
          const f = FIXTURES.find((x) => x.id === l.fixtureId) ?? FIXTURES[0];
          const src = resolveSource(f, l.modifierId, l.dimmer, l.beamDeg, l.frame);
          const half = rad(Math.min(src.omni ? 180 : src.beamDeg, 150) / 2);
          const R = src.omni ? 0.7 : 1.5;
          const ray = (k: number) => `${l.x - Math.sin(y + k) * R} ${l.z - Math.cos(y + k) * R}`;
          const hx = l.x - Math.sin(y) * 0.7;
          const hz = l.z - Math.cos(y) * 0.7;
          const isSel = selected.kind === "light" && selected.id === l.id;
          const fill = l.on ? "#f3c64a" : "#b7b1a6";
          return (
            <g key={l.id}>
              {l.on ? (
                src.omni
                  ? <circle cx={l.x} cy={l.z} r={R} fill={fill} fillOpacity={0.12} />
                  : <path d={`M${l.x} ${l.z} L${ray(half)} L${ray(-half)} Z`} fill={fill} fillOpacity={isSel ? 0.22 : 0.12} />
              ) : null}
              {!src.omni ? (
                <>
                  <line x1={l.x} y1={l.z} x2={hx} y2={hz} stroke="#b9891d" strokeWidth={0.025} />
                  <circle cx={hx} cy={hz} r={0.08} fill="#fff" stroke="#b9891d" strokeWidth={0.03} className="cursor-crosshair" onPointerDown={start({ kind: "light", id: l.id, aim: true })} />
                </>
              ) : null}
              {l.frame && !src.omni ? (
                <line
                  x1={l.x - Math.sin(y) * l.frame.distM + Math.cos(y) * (l.frame.sizeFt * FT) / 2}
                  y1={l.z - Math.cos(y) * l.frame.distM - Math.sin(y) * (l.frame.sizeFt * FT) / 2}
                  x2={l.x - Math.sin(y) * l.frame.distM - Math.cos(y) * (l.frame.sizeFt * FT) / 2}
                  y2={l.z - Math.cos(y) * l.frame.distM + Math.sin(y) * (l.frame.sizeFt * FT) / 2}
                  stroke="#f2efe8" strokeWidth={0.07} pointerEvents="none"
                />
              ) : null}
              <g className="cursor-move" onPointerDown={start({ kind: "light", id: l.id })}>
                <circle cx={l.x} cy={l.z} r={0.15} fill={fill} stroke={isSel ? "#1d1d1f" : "#b9891d"} strokeWidth={isSel ? 0.05 : 0.025} />
                <text x={l.x} y={l.z + 0.06} textAnchor="middle" fontSize={0.15} fontWeight={800} fill="#4a3a10">{l.role[0]}</text>
              </g>
              <text x={l.x + 0.2} y={l.z - 0.16} fontSize={0.17} fontWeight={700} fill="#7a5b14" pointerEvents="none">{l.role}</text>
            </g>
          );
        })}

        {/* cameras, with their horizontal field of view */}
        {shots.map((s, i) => {
          const b = BODIES.find((x) => x.id === s.bodyId) ?? BODIES[0];
          const half = rad(fovDeg(imagedArea(b, aspectRatio).w, s.focal) / 2);
          const y = rad(s.yaw);
          const L = 4.2;
          const ray = (a: number) => `${s.pos.x - Math.sin(y + a) * L} ${s.pos.z - Math.cos(y + a) * L}`;
          const col = SHOT_HUES[i % SHOT_HUES.length];
          const isA = s.id === activeId;
          const hx = s.pos.x - Math.sin(y) * 0.7;
          const hz = s.pos.z - Math.cos(y) * 0.7;
          // What it is on: a dolly's track or a robot's base, turned to the track.
          const raw = rawShots.find((x) => x.id === s.id) ?? s;
          const sp = supportOf(raw, s.pos);
          const ty = rad(sp.yaw);
          const fp = supportFootprint(s.support, s.pos.y, bodyDrop(s.bodyId), sp.opts);
          const loc = (lx: number, lz: number) => ({ x: s.pos.x + lx * Math.cos(ty) + lz * Math.sin(ty), z: s.pos.z - lx * Math.sin(ty) + lz * Math.cos(ty) });
          const rails = fp.track
            ? [-fp.track.gauge / 2, fp.track.gauge / 2].map((o) => {
                const t = fp.track!;
                const a = t.axis === "x" ? loc(t.from, o) : loc(o, t.from);
                const b = t.axis === "x" ? loc(t.to, o) : loc(o, t.to);
                return { a, b };
              })
            : [];
          const base = fp.base ? loc(fp.base.x, fp.base.z) : null;
          return (
            <g key={s.id} opacity={isA ? 1 : 0.55}>
              {rails.map((r, k) => (
                <line key={k} x1={r.a.x} y1={r.a.z} x2={r.b.x} y2={r.b.z} stroke="#6f747b" strokeWidth={0.035} strokeLinecap="round" pointerEvents="none" />
              ))}
              {base && fp.base ? <circle cx={base.x} cy={base.z} r={fp.base.r} fill="#2a2c30" fillOpacity={0.35} stroke="#2a2c30" strokeWidth={0.02} pointerEvents="none" /> : null}
              {raw.move ? (
                <g pointerEvents="none">
                  <line x1={raw.pos.x} y1={raw.pos.z} x2={raw.move.end.pos.x} y2={raw.move.end.pos.z} stroke={col} strokeWidth={0.035} strokeDasharray="0.08 0.06" />
                  <circle cx={raw.move.end.pos.x} cy={raw.move.end.pos.z} r={0.08} fill="none" stroke={col} strokeWidth={0.03} />
                  <circle cx={raw.pos.x} cy={raw.pos.z} r={0.05} fill={col} />
                </g>
              ) : null}
              <path d={`M${s.pos.x} ${s.pos.z} L${ray(half)} L${ray(-half)} Z`} fill={col} fillOpacity={isA ? 0.16 : 0.07} stroke={col} strokeWidth={0.02} />
              <line x1={s.pos.x} y1={s.pos.z} x2={hx} y2={hz} stroke={col} strokeWidth={0.03} />
              <circle cx={hx} cy={hz} r={0.09} fill="#fff" stroke={col} strokeWidth={0.03} className="cursor-crosshair" onPointerDown={start({ kind: "camera", id: s.id, aim: true })} />
              <g transform={`translate(${s.pos.x} ${s.pos.z}) rotate(${-s.yaw})`} className="cursor-move" onPointerDown={start({ kind: "camera", id: s.id })}>
                <rect x={-0.14} y={-0.05} width={0.28} height={0.32} rx={0.04} fill={col} stroke="#1d1d1f" strokeWidth={isA ? 0.04 : 0.02} />
                <rect x={-0.07} y={-0.15} width={0.14} height={0.12} fill="#1d1d1f" />
              </g>
              <text x={s.pos.x + 0.22} y={s.pos.z + 0.3} fontSize={0.2} fontWeight={700} fill="#1d1d1f">{s.code}</text>
            </g>
          );
        })}

        {/* bottle */}
        <circle cx={bottle.x} cy={bottle.z} r={0.07} fill="#2f6f62" stroke="#fff" strokeWidth={0.025} className="cursor-move" onPointerDown={start({ kind: "bottle" })} />

        {/* talent: body, facing tick, name */}
        {talent.map((t) => {
          const f = rad(t.facing);
          return (
            <g key={t.id} className="cursor-move" onPointerDown={start({ kind: "talent", id: t.id })}>
              <circle cx={t.x} cy={t.z} r={0.22} fill={t.top} stroke="#fff" strokeWidth={0.03} />
              <line x1={t.x} y1={t.z} x2={t.x + Math.sin(f) * 0.36} y2={t.z + Math.cos(f) * 0.36} stroke="#1d1d1f" strokeWidth={0.05} strokeLinecap="round" />
              <text x={t.x} y={t.z + 0.48} textAnchor="middle" fontSize={0.2} fontWeight={700} fill="#1d1d1f">{t.name}</text>
            </g>
          );
        })}
      </svg>
      {size === "big" ? (
        <p className="bg-black/80 px-2.5 py-1 text-[10px] text-white/75">
          Drag people, the bottle, a camera, a light or a board. Drag a white dot to aim it.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- small parts

function HelpCard({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["Drag", "pan and tilt, like a fluid head"],
    ["Shift or right drag", "truck left and right, boom up and down"],
    ["Scroll", "dolly in and out"],
    ["W A S D", "dolly and truck (Shift for bigger steps)"],
    ["Q / E", "boom down and up"],
    ["Arrow keys", "pan and tilt one degree"],
    ["1, 2, 3", "switch shots"],
    ["Space", "play or stop the camera move"],
    ["V", "through the lens / free view"],
    ["C", "clay view"],
    ["B", "storyboard overlay"],
    ["Map", "drag people, the bottle, cameras, lights and boards; drag a white dot to aim"],
    ["Z", "zebras: stripes where the picture clips"],
    ["Delete", "delete the selected light, bounce or flag (a shot: its bin)"],
  ];
  return (
    <div className="absolute left-3 top-14 w-[330px] rounded-[12px] border border-border bg-surface p-4 text-sm shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-display font-bold">Driving the camera</p>
        <button type="button" onClick={onClose} className="text-xs text-text-muted hover:text-text">Close</button>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3 border-t border-border py-1.5 first-of-type:border-0">
          <span className="w-[130px] shrink-0 font-mono text-xs font-semibold">{k}</span>
          <span className="text-xs text-text-muted">{v}</span>
        </div>
      ))}
    </div>
  );
}
