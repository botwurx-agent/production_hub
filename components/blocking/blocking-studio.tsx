"use client";

// Shot blocking: the editor. A 3D viewport (through the camera, or a free view
// with the camera, its path and handles drawn), an outliner, a properties
// panel and a dope-sheet timeline, the shape of a motion-control or 3D
// animation tool rather than of the rest of the app.
//
// THE EDIT RULE, in one place (writePose): a change at the playhead to
// something with one keyframe just moves it; once it has two or more, or Auto
// key is on, the change sets a keyframe at the playhead. Press I to key
// something that is still static.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import {
  aspectRatio, blockKind, newId, newObject, tidyKeys,
  type BlockObject, type BlockScene, type CamKey, type Ease, type Key, type Vec3,
} from "@/lib/blocking/scene";
import {
  aimAt, applyPreset as mergePreset, evalCamera, evalGesture, evalTrack, keyAt, keyHandle, lookDir, pathStats, peakSpeed, presetKeys, setKey, snap,
  timecode, travel, type PresetId,
} from "@/lib/blocking/keys";
import {
  aimPoint, applyEnvironment, buildObject, buildWorld, cameraGizmo, cameraMatrix, objectMatrix, poseMatrix, poseRig, setFrustum, toLocal, touchPoint,
  type PersonRig, type World,
} from "@/lib/blocking/build";
import { BODIES, fovDeg, imagedArea } from "@/lib/previz/optics";
import { Outliner, Properties, type CamPadAction, type Posed, type StudioApi } from "./panels";
import { Timeline, type KeyRef, type Track } from "./timeline";
import { Btn, useOutside } from "./ui";
import { SendToPipeline, type PipelineTarget } from "./send-to-pipeline";
import { ShotRenderer } from "@/lib/blocking/look-render";
import { SceneBar } from "./scene-bar";
import { gaitAt } from "@/lib/blocking/gait";
import { holdsPosition, rigMotion } from "@/lib/blocking/rigs";

type View = "camera" | "free";

/** The camera path in free view: bright sky blue, apart from the amber camera body and the set's colours. */
const PATH_COLOR = "#38c6ff";
const KEY_COLOR = "#ffd166";
const HANDLE_COLOR = "#ff5fa8";

type Engine = {
  renderer: THREE.WebGLRenderer;
  /** Draws the shot camera with ambient occlusion, into the camera view and the picture in picture. */
  fx: ShotRenderer;
  /** The same, through the free camera. */
  fxFree: ShotRenderer;
  world: World;
  free: THREE.PerspectiveCamera;
  shot: THREE.PerspectiveCamera;
  orbit: OrbitControls;
  tc: TransformControls;
  tcHelper: THREE.Object3D;
  proxy: THREE.Object3D;
  meshes: Map<string, { g: THREE.Group; key: string }>;
  gizmo: THREE.Group;
  /** The camera's path, its key dots and the selected key's curve handles, all in the camera's parent frame. */
  path: THREE.Group;
  pathLine: Line2;
  dots: THREE.Group;
  handles: { group: THREE.Group; line: Line2; out: THREE.Mesh; inn: THREE.Mesh };
  lineMats: LineMaterial[];
  handleKey: string;
  pathKey: string;
  fovKey: string;
  envKey: string;
  size: { w: number; h: number };
  rec: { renderer: THREE.WebGLRenderer; fx: ShotRenderer; media: MediaRecorder; t0: number; on: boolean; chunks: Blob[] } | null;
  keys: Set<string>;
  last: number;
};

/** The best video format this browser records: H.264 MP4 where it can (QuickTime and Higgsfield read it), WebM otherwise. */
function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1.4d002a", "video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/** The camera frame inside the viewport, letterboxed with a margin. */
function frameRect(w: number, h: number, ratio: number, margin = 28) {
  const aw = Math.max(10, w - margin * 2);
  const ah = Math.max(10, h - margin * 2);
  let fw = aw;
  let fh = aw / ratio;
  if (fh > ah) { fh = ah; fw = ah * ratio; }
  return { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh };
}

type CrossStyle = "cross" | "lines" | "dot";
type Crosshair = { on: boolean; color: string; style: CrossStyle };
const CROSS_KEY = "blocking.crosshair";
// Overlay colours the person picks to stand out against their own scene, so
// they are chosen values rather than theme tokens, like a line's colour.
const CROSS_COLORS = [
  { hex: "#ff3b30", name: "Red" }, { hex: "#ffd60a", name: "Yellow" }, { hex: "#30d158", name: "Green" },
  { hex: "#64d2ff", name: "Cyan" }, { hex: "#ff2dfd", name: "Magenta" }, { hex: "#ffffff", name: "White" },
  { hex: "#000000", name: "Black" },
];
const CROSS_STYLES: { id: CrossStyle; name: string }[] = [
  { id: "cross", name: "Cross" }, { id: "lines", name: "Full lines" }, { id: "dot", name: "Dot" },
];

/** The crosshair, centred in the frame. A thin dark edge keeps it readable on any colour. */
function CrosshairMark({ color, style }: { color: string; style: CrossStyle }) {
  const edge = color === "#000000" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)";
  const line = (pos: React.CSSProperties) => (
    <div className="absolute" style={{ background: color, boxShadow: `0 0 0 1px ${edge}`, ...pos }} />
  );
  if (style === "dot") {
    return <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: color, boxShadow: `0 0 0 1px ${edge}` }} />;
  }
  if (style === "lines") {
    return (
      <>
        {line({ left: "50%", top: 0, bottom: 0, width: 1, transform: "translateX(-0.5px)" })}
        {line({ top: "50%", left: 0, right: 0, height: 1, transform: "translateY(-0.5px)" })}
      </>
    );
  }
  // A cross with a gap at its centre, so the point being lined up stays visible.
  const arm = 14;
  const gap = 4;
  return (
    <div className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0 }}>
      {line({ left: -0.75, top: -(gap + arm), width: 1.5, height: arm })}
      {line({ left: -0.75, top: gap, width: 1.5, height: arm })}
      {line({ top: -0.75, left: -(gap + arm), height: 1.5, width: arm })}
      {line({ top: -0.75, left: gap, height: 1.5, width: arm })}
    </div>
  );
}

const fileStem = (s: string) => s.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "blocking";

export function BlockingStudio({
  initial, canEdit, onChange, pipeline, describe,
}: {
  initial: BlockScene;
  canEdit: boolean;
  onChange: (s: BlockScene) => void;
  /** The scene bar: changes the open scene from a sentence. Absent without AI or edit access. */
  describe?: (prompt: string, scene: BlockScene) => Promise<{ scene: BlockScene; summary: string; skipped: string[] } | { error: string }>;
  /** Where Send to pipeline puts the clip. Absent in the fixture and for view-only access. */
  pipeline?: PipelineTarget;
}) {
  const [scene, setSceneState] = useState(initial);
  const sceneRef = useRef(initial);
  const [t, setTState] = useState(0);
  const tRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef({ on: false, from: 0, t0: 0 });
  const [loop, setLoop] = useState(true);
  const loopRef = useRef(true);
  loopRef.current = loop;
  const [view, setView] = useState<View>("camera");
  const viewRef = useRef<View>("camera");
  const [sel, setSel] = useState<Track | null>("camera");
  const selRef = useRef<Track | null>("camera");
  const [selectedKey, setSelectedKey] = useState<KeyRef | null>(null);
  const selKeyRef = useRef<KeyRef | null>(null);
  selKeyRef.current = selectedKey;
  /** Which curve handle of the selected camera key the move handles are on, if any. */
  const handleRef = useRef<"out" | "in" | null>(null);
  const [autoKey, setAutoKey] = useState(false);
  const autoRef = useRef(false);
  const [tcMode, setTcMode] = useState<"translate" | "rotate">("translate");
  const [thirds, setThirds] = useState(true);
  // A crosshair for lining a subject up on the centre of frame. It is drawn
  // over the canvas, so it never reaches a recorded clip or a saved frame.
  const [cross, setCross] = useState<Crosshair>({ on: false, color: "#ff3b30", style: "cross" });
  const [crossOpen, setCrossOpen] = useState(false);
  const crossRef = useOutside(crossOpen, () => setCrossOpen(false));
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(CROSS_KEY) ?? "null");
      if (raw && typeof raw === "object") {
        setCross({
          on: raw.on === true,
          color: CROSS_COLORS.some((c) => c.hex === raw.color) ? raw.color : "#ff3b30",
          style: CROSS_STYLES.some((x) => x.id === raw.style) ? raw.style : "cross",
        });
      }
    } catch {}
  }, []);
  const saveCross = (next: Crosshair) => {
    setCross(next);
    try { localStorage.setItem(CROSS_KEY, JSON.stringify(next)); } catch {}
  };
  const [recording, setRecording] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [rect, setRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useOutside(exportOpen, () => setExportOpen(false));
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eng = useRef<Engine | null>(null);
  const history = useRef<{ undo: BlockScene[]; redo: BlockScene[]; lastKey: string; lastAt: number }>({ undo: [], redo: [], lastKey: "", lastAt: 0 });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  viewRef.current = view;
  selRef.current = sel;
  autoRef.current = autoKey;

  const setT = useCallback((v: number) => {
    tRef.current = v;
    setTState(v);
    if (playRef.current.on) { playRef.current.from = v; playRef.current.t0 = performance.now(); }
  }, []);

  /** Every edit goes through here: it records undo history and tells the page to save. */
  const commit = useCallback((fn: (s: BlockScene) => BlockScene, coalesce?: string) => {
    const prev = sceneRef.current;
    const next = fn(prev);
    if (next === prev) return;
    const h = history.current;
    const now = performance.now();
    if (!coalesce || coalesce !== h.lastKey || now - h.lastAt > 700) {
      h.undo.push(prev);
      if (h.undo.length > 80) h.undo.shift();
      h.redo = [];
    }
    h.lastKey = coalesce ?? "";
    h.lastAt = now;
    sceneRef.current = next;
    setSceneState(next);
    onChangeRef.current(next);
  }, []);

  const undo = useCallback((redo = false) => {
    const h = history.current;
    const from = redo ? h.redo : h.undo;
    const to = redo ? h.undo : h.redo;
    const s = from.pop();
    if (!s) return;
    to.push(sceneRef.current);
    h.lastKey = "";
    sceneRef.current = s;
    setSceneState(s);
    onChangeRef.current(s);
    setNote(redo ? "Redone" : "Undone");
  }, []);

  /* ---------- reading the scene ---------- */

  const objMap = useMemo(() => new Map(scene.objects.map((o) => [o.id, o])), [scene.objects]);
  const mapOf = (s: BlockScene) => new Map(s.objects.map((o) => [o.id, o]));

  /**
   * The camera at a moment, in its parent's frame: the path and lens from the
   * keys (moved the way the camera's flow says), and, when it is kept aimed
   * at something, pointed at that thing rather than where the keys point.
   */
  const camAt = (s: BlockScene, at: number, m = mapOf(s)): { p: Vec3; r: Vec3; lens: number; af: [number, number] } => {
    const cam = s.camera;
    const c = evalCamera(cam.keys, at, cam.path === "smooth", { flow: cam.flow, easeEnds: cam.easeEnds });
    // On a tripod the camera stays where the shot starts: it turns, it does not travel.
    if (holdsPosition(cam.rig)) c.p = evalCamera(cam.keys, 0, cam.path === "smooth", { flow: cam.flow, easeEnds: cam.easeEnds }).p;
    const o = cam.aim.target ? m.get(cam.aim.target) : undefined;
    if (!o) return c;
    const w = aimPoint(m, o, at);
    if (cam.parent && m.get(cam.parent)) w.applyMatrix4(objectMatrix(m, cam.parent, at).clone().invert());
    const a = aimAt(c.p, [w.x, w.y, w.z]);
    return { ...c, r: [a.yaw + c.af[0] + cam.aim.frame[0], Math.max(-89, Math.min(89, a.pitch + c.af[1] + cam.aim.frame[1])), c.r[2]] };
  };

  const posedAt = (s: BlockScene, track: Track, at: number): Posed => {
    if (track === "camera") {
      const c = camAt(s, at);
      return { p: c.p, r: c.r, lens: c.lens, af: c.af };
    }
    const o = s.objects.find((x) => x.id === track);
    if (!o) return { p: [0, 0, 0], r: [0, 0, 0] };
    const base: Posed = evalTrack(o.keys, at);
    if (o.keys.some((k) => k.g)) {
      const gs = evalGesture(o.keys, at);
      base.g = [gs.reach, gs.lean];
      base.gk = gs.kind;
    }
    return base;
  };

  /** The edit rule (see the top of the file). */
  const writePose = useCallback((track: Track, pose: Partial<Posed>, coalesce?: string) => {
    commit((s) => {
      const at = snap(tRef.current, s.fps);
      const cur = posedAt(s, track, at);
      const write = <K extends Key>(keys: K[], extra: Partial<K>): K[] => {
        const existing = keyAt(keys, at, s.fps);
        const merged = { ...(existing ?? { ease: "smooth" as Ease }), t: existing?.t ?? at, p: pose.p ?? cur.p, r: pose.r ?? cur.r, ...extra } as K;
        // A gesture is an action at a moment, not a placement: changing reach
        // or lean always keys at the playhead, even when the person has only
        // one key, or the gesture lands on that key (often at 0s) and the whole
        // shot starts mid-reach.
        const gestureOnly = (!!pose.g || !!pose.gk) && !pose.p && !pose.r;
        if (keys.length >= 2 || autoRef.current || existing || gestureOnly) return setKey(keys, merged, s.fps);
        return [{ ...keys[0], p: merged.p, r: merged.r, ...extra }];
      };
      if (track === "camera" && holdsPosition(s.camera.rig) && pose.p) {
        // A tripod is moved, not keyed: every key moves with it, so the
        // camera stays put for the whole shot in its new place.
        const d: Vec3 = [pose.p[0] - cur.p[0], pose.p[1] - cur.p[1], pose.p[2] - cur.p[2]];
        const moved = s.camera.keys.map((k) => ({ ...k, p: [k.p[0] + d[0], k.p[1] + d[1], k.p[2] + d[2]] as Vec3 }));
        const rest = { ...pose, p: undefined };
        if (!rest.r && !rest.lens && !rest.af) return { ...s, camera: { ...s.camera, keys: moved } };
        s = { ...s, camera: { ...s.camera, keys: moved } };
        pose = rest;
      }
      if (track === "camera") {
        const lens = pose.lens ?? cur.lens ?? 35;
        const af = pose.af ?? cur.af;
        const extra: Partial<CamKey> = af && (Math.abs(af[0]) > 1e-3 || Math.abs(af[1]) > 1e-3) ? { lens, af } : { lens, af: undefined };
        return { ...s, camera: { ...s.camera, keys: write<CamKey>(s.camera.keys, extra) } };
      }
      const g = pose.g ?? cur.g;
      const gk = pose.gk ?? cur.gk;
      const extra: Partial<Key> = {
        g: g && (g[0] > 1e-4 || Math.abs(g[1]) > 1e-3) ? g : undefined,
        gk: gk && gk !== "reach" ? gk : undefined,
      };
      return { ...s, objects: s.objects.map((o) => (o.id === track ? { ...o, keys: write<Key>(o.keys, extra) } : o)) };
    }, coalesce);
  }, [commit]);

  const insertKey = useCallback(() => {
    const track = selRef.current ?? "camera";
    commit((s) => {
      const at = snap(tRef.current, s.fps);
      const cur = posedAt(s, track, at);
      if (track === "camera") {
        const ex = keyAt(s.camera.keys, at, s.fps);
        return { ...s, camera: { ...s.camera, keys: setKey(s.camera.keys, { t: at, p: cur.p, r: cur.r, lens: cur.lens ?? 35, ...(cur.af ? { af: cur.af } : {}), ...(ex?.tan ? { tan: ex.tan } : {}), ease: ex?.ease ?? "smooth" }, s.fps) } };
      }
      return {
        ...s,
        objects: s.objects.map((o) => {
          if (o.id !== track) return o;
          const ex = keyAt(o.keys, at, s.fps);
          return { ...o, keys: setKey(o.keys, { t: at, p: cur.p, r: cur.r, ...(cur.g ? { g: cur.g } : {}), ...(cur.gk && cur.gk !== "reach" ? { gk: cur.gk } : {}), ease: ex?.ease ?? "smooth" }, s.fps) };
        }),
      };
    });
    setSelectedKey({ track, t: snap(tRef.current, sceneRef.current.fps) });
    setNote(`Keyframe set at ${timecode(tRef.current, sceneRef.current.fps)}`);
  }, [commit]);

  const deleteKey = useCallback(() => {
    const k = selectedKey;
    if (!k) return;
    const keysOf = (s: BlockScene) => (k.track === "camera" ? s.camera.keys : s.objects.find((o) => o.id === k.track)?.keys ?? []);
    if (keysOf(sceneRef.current).length <= 1) { setNote("Everything keeps at least one keyframe: delete the object instead"); return; }
    commit((s) => {
      const half = 0.5 / s.fps;
      if (k.track === "camera") return { ...s, camera: { ...s.camera, keys: s.camera.keys.filter((x) => Math.abs(x.t - k.t) >= half) } };
      return { ...s, objects: s.objects.map((o) => (o.id === k.track ? { ...o, keys: o.keys.filter((x) => Math.abs(x.t - k.t) >= half) } : o)) };
    });
    setSelectedKey(null);
  }, [commit, selectedKey]);

  const moveKey = useCallback((track: Track, from: number, to: number) => {
    commit((s) => {
      const half = 0.5 / s.fps;
      const move = <K extends Key>(keys: K[]): K[] => {
        const k = keys.find((x) => Math.abs(x.t - from) < half);
        if (!k) return keys;
        return setKey(keys.filter((x) => x !== k), { ...k, t: to }, s.fps);
      };
      if (track === "camera") return { ...s, camera: { ...s.camera, keys: move(s.camera.keys) } };
      return { ...s, objects: s.objects.map((o) => (o.id === track ? { ...o, keys: move(o.keys) } : o)) };
    });
  }, [commit]);

  /* ---------- the api the panels use ---------- */

  const api: StudioApi = {
    scene, t, canEdit, sel, selectedKey,
    select: (track) => { setSel(track); setSelectedKey(null); },
    updateScene: commit,
    updateObject: (id, patch, c) => commit((s) => ({ ...s, objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) }), c),
    writePose,
    camPad: (action, amt) => camPad(action, amt),
    posed: (track) => posedAt(scene, track, t),
    addObject: (kind) => {
      const s = sceneRef.current;
      const k = blockKind(kind);
      // Almost everything lands in front of the camera, far enough back that
      // a building does not swallow the lens. Ground and landscape (a road, a
      // hill, the sea) and a room land at the origin, where they belong.
      let p: Vec3 = [0, 0, 0];
      if (k.category !== "environment" && kind !== "room") {
        const c = camAt(s, tRef.current);
        const parent = s.camera.parent ? objectMatrix(mapOf(s), s.camera.parent, tRef.current) : null;
        const w = new THREE.Vector3(...c.p).applyMatrix4(parent ?? new THREE.Matrix4());
        const d = lookDir(c.r[0], c.r[1]);
        const dist = k.category === "vehicles" ? 9 : Math.max(4, Math.max(k.size[0], k.size[2]) / 2 + 3, k.size[1] * 0.6);
        p = [w.x + d[0] * dist, 0, w.z + d[2] * dist];
      }
      const o = newObject(kind, p, 0, s.objects);
      commit((x) => ({ ...x, objects: [...x.objects, o] }));
      setSel(o.id);
    },
    deleteObject: (id) => {
      commit((s) => ({
        ...s,
        objects: s.objects.filter((o) => o.id !== id).map((o) => (o.parent === id ? { ...o, parent: null } : o)),
        camera: {
          ...s.camera,
          parent: s.camera.parent === id ? null : s.camera.parent,
          aim: s.camera.aim.target === id ? { target: null, frame: [0, 0] } : s.camera.aim,
        },
      }));
      setSel(null);
    },
    duplicateObject: (id) => {
      const s = sceneRef.current;
      const o = s.objects.find((x) => x.id === id);
      if (!o) return;
      const copy: BlockObject = { ...o, id: newId("o"), name: `${o.name} copy`, keys: o.keys.map((k) => ({ ...k, p: [k.p[0] + 1, k.p[1], k.p[2]] as Vec3 })) };
      commit((x) => ({ ...x, objects: [...x.objects, copy] }));
      setSel(copy.id);
    },
    setParent: (track, parent) => {
      // Re-expresses every key in the new parent's frame, so nothing jumps:
      // where it was in the world at each key is where it stays.
      commit((s) => {
        const m = mapOf(s);
        const pm = (id: string | null, at: number) => (id ? objectMatrix(m, id, at) : null);
        if (track === "camera") {
          const keys = s.camera.keys.map((k) => {
            const w = cameraMatrix(k.p, k.r, pm(s.camera.parent, k.t));
            const l = toLocal(w, pm(parent, k.t), true);
            return { ...k, p: l.p, r: l.r };
          });
          return { ...s, camera: { ...s.camera, parent, keys } };
        }
        return {
          ...s,
          objects: s.objects.map((o) => {
            if (o.id !== track) return o;
            const keys = o.keys.map((k) => {
              const base = pm(o.parent ?? null, k.t);
              const w = base ? base.clone().multiply(poseMatrix(k.p, k.r)) : poseMatrix(k.p, k.r);
              const l = toLocal(w, pm(parent, k.t), false);
              return { ...k, p: l.p, r: l.r };
            });
            return { ...o, parent, keys };
          }),
        };
      });
    },
    applyPreset: (id: PresetId, target, len) => {
      let offSticks = false;
      commit((s) => {
        const at = snap(tRef.current, s.fps);
        const dur = Math.max(0.5, Math.min(len, s.duration - at > 0.4 ? s.duration - at : s.duration));
        const t0 = s.duration - at > 0.4 ? at : 0;
        const start = camAt(s, t0);
        const m = mapOf(s);
        const parent = s.camera.parent ? objectMatrix(m, s.camera.parent, t0) : null;
        let tgt: THREE.Vector3;
        if (target && m.get(target)) {
          const o = m.get(target)!;
          tgt = new THREE.Vector3(0, Math.min(o.size[1] * 0.6, 1.6), 0).applyMatrix4(objectMatrix(m, target, t0));
          if (parent) tgt.applyMatrix4(parent.clone().invert());
        } else {
          const d = lookDir(start.r[0], start.r[1]);
          tgt = new THREE.Vector3(start.p[0] + d[0] * 5, start.p[1] + d[1] * 5, start.p[2] + d[2] * 5);
        }
        const made = presetKeys(id, start, [tgt.x, tgt.y, tgt.z], t0, dur).map((k) => ({ ...k, t: snap(k.t, s.fps) }));
        // Every move but a whip pan travels, which a tripod cannot: the move
        // takes the camera off it rather than being silently held in place.
        offSticks = holdsPosition(s.camera.rig) && id !== "whip";
        const camera = { ...s.camera, keys: tidyKeys(mergePreset(s.camera.keys, made, s.fps), s.fps) };
        if (offSticks) delete camera.rig;
        return { ...s, camera };
      });
      setSel("camera");
      setNote(offSticks ? `${id.replace("-", " ")} keyed, and taken off the tripod so it can travel` : `${id.replace("-", " ")} keyed`);
    },
    drive: (id, speed, len) => {
      commit((s) => {
        const at = snap(tRef.current, s.fps);
        return {
          ...s,
          objects: s.objects.map((o) => {
            if (o.id !== id) return o;
            const cur = evalTrack(o.keys, at);
            const yaw = (cur.r[0] * Math.PI) / 180;
            const dist = speed * len;
            const end: Vec3 = [cur.p[0] + Math.sin(yaw) * dist, cur.p[1], cur.p[2] + Math.cos(yaw) * dist];
            const end_t = snap(Math.min(s.duration, at + len), s.fps);
            let keys = o.keys.filter((k) => k.t <= at - 0.5 / s.fps || k.t >= end_t + 0.5 / s.fps);
            keys = setKey(keys, { t: at, p: cur.p, r: cur.r, ease: "linear" }, s.fps);
            keys = setKey(keys, { t: end_t, p: end, r: cur.r, ease: "linear" }, s.fps);
            return { ...o, keys };
          }),
        };
      });
    },
    resetKeyCurve: () => {
      const k = selectedKey;
      if (!k || k.track !== "camera") return;
      handleRef.current = null;
      commit((s) => {
        const half = 0.5 / s.fps;
        return { ...s, camera: { ...s.camera, keys: s.camera.keys.map((x) => {
          if (Math.abs(x.t - k.t) >= half || !x.tan) return x;
          const { tan: _drop, ...rest } = x;
          void _drop;
          return rest;
        }) } };
      });
    },
    setKeyEase: (e) => {
      const k = selectedKey;
      if (!k) return;
      commit((s) => {
        const half = 0.5 / s.fps;
        const set = <K extends Key>(keys: K[]) => keys.map((x) => (Math.abs(x.t - k.t) < half ? { ...x, ease: e } : x));
        if (k.track === "camera") return { ...s, camera: { ...s.camera, keys: set(s.camera.keys) } };
        return { ...s, objects: s.objects.map((o) => (o.id === k.track ? { ...o, keys: set(o.keys) } : o)) };
      });
    },
    reachGap: (id) => {
      const rig = eng.current?.meshes.get(id)?.g.userData.rig as PersonRig | undefined;
      return rig ? rig.gap : 0;
    },
    gestureKeys: (id, beats) => commit((s) => ({
      ...s,
      objects: s.objects.map((o) => {
        if (o.id !== id) return o;
        let keys = o.keys;
        for (const b of beats) {
          const at = snap(Math.min(s.duration, Math.max(0, b.t)), s.fps);
          const cur = evalTrack(keys, at);
          const ex = keyAt(keys, at, s.fps);
          keys = setKey(keys, { t: at, p: cur.p, r: cur.r, g: b.g, ...(b.gk && b.gk !== "reach" ? { gk: b.gk } : {}), ease: ex?.ease ?? "smooth" }, s.fps);
        }
        return { ...o, keys };
      }),
    })),
    speedOf: (track) => {
      if (track === "camera") {
        const cam = scene.camera;
        if (cam.keys.length < 2) return { peak: 0, travel: 0 };
        return pathStats((tt) => evalCamera(cam.keys, tt, cam.path === "smooth", { flow: cam.flow, easeEnds: cam.easeEnds }).p, scene.duration, scene.fps);
      }
      const keys = objMap.get(track)?.keys ?? [];
      return { peak: peakSpeed(keys, scene.duration, scene.fps), travel: travel(keys, scene.duration, scene.fps) };
    },
  };

  /* ---------- the engine ---------- */

  useEffect(() => {
    const canvas = canvasRef.current!;
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // A gentle shoulder on the highlights, so a sunlit wall rolls off
    // instead of clipping to flat white; it keeps hues, so blockout's subject
    // colours stay the colours they were picked as.
    renderer.toneMapping = THREE.NeutralToneMapping;
    const world = buildWorld();
    const free = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
    free.position.set(14, 10, 18);
    const shot = new THREE.PerspectiveCamera(30, 16 / 9, 0.03, 5000);
    const orbit = new OrbitControls(free, canvas);
    orbit.enableDamping = true;
    orbit.target.set(0, 1, 0);
    const proxy = new THREE.Object3D();
    world.scene.add(proxy);
    const tc = new TransformControls(free, canvas);
    tc.setSize(0.8);
    const tcHelper = tc.getHelper();
    world.scene.add(tcHelper);
    const gizmo = cameraGizmo("#f2a93b");
    world.helpers.add(gizmo);
    // The path is drawn thick and on top of everything, in its own colour, so
    // it reads against the set and through the car it passes into.
    const path = new THREE.Group();
    path.matrixAutoUpdate = false;
    path.userData.helper = true;
    world.helpers.add(path);
    const lineMat = (color: string, width: number, opacity = 1) => new LineMaterial({
      color, linewidth: width, transparent: true, opacity, depthTest: false, depthWrite: false,
    });
    const pathMat = lineMat(PATH_COLOR, 4);
    const pathLine = new Line2(new LineGeometry(), pathMat);
    pathLine.renderOrder = 20;
    path.add(pathLine);
    const dots = new THREE.Group();
    path.add(dots);
    const hMat = lineMat(HANDLE_COLOR, 2, 0.9);
    const hLine = new Line2(new LineGeometry(), hMat);
    hLine.renderOrder = 21;
    const ball = (kind: "out" | "in") => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: HANDLE_COLOR, depthTest: false, depthWrite: false }));
      m.renderOrder = 23;
      m.userData.handle = kind;
      return m;
    };
    const hGroup = new THREE.Group();
    const out = ball("out");
    const inn = ball("in");
    hGroup.add(hLine, out, inn);
    hGroup.visible = false;
    path.add(hGroup);
    const fx = new ShotRenderer(renderer, world.scene, shot, Math.min(window.devicePixelRatio, 1.5));
    const fxFree = new ShotRenderer(renderer, world.scene, free, Math.min(window.devicePixelRatio, 1.25));
    const e: Engine = {
      renderer, fx, fxFree, world, free, shot, orbit, tc, tcHelper, proxy, meshes: new Map(), gizmo,
      path, pathLine, dots, handles: { group: hGroup, line: hLine, out, inn }, lineMats: [pathMat, hMat], handleKey: "",
      pathKey: "", fovKey: "", envKey: "", size: { w: 1, h: 1 }, rec: null, keys: new Set(), last: performance.now(),
    };
    eng.current = e;

    let tcUsed = false;
    tc.addEventListener("dragging-changed", (ev) => {
      const on = (ev as unknown as { value: boolean }).value;
      if (on) { history.current.lastKey = ""; tcUsed = true; }
    });
    tc.addEventListener("objectChange", () => {
      const track = selRef.current;
      if (!track) return;
      const s = sceneRef.current;
      const at = tRef.current;
      proxy.updateMatrixWorld();
      const sk = selKeyRef.current;
      const keyEdit = track === "camera" && sk?.track === "camera" && tc.mode === "translate";
      if (keyEdit) {
        const k = sk!;
        const parent = s.camera.parent ? objectMatrix(mapOf(s), s.camera.parent, at) : null;
        const local = new THREE.Vector3().setFromMatrixPosition(proxy.matrixWorld);
        if (parent) local.applyMatrix4(parent.clone().invert());
        const which = handleRef.current ?? "key";
        commit((sc) => {
          const half = 0.5 / sc.fps;
          return { ...sc, camera: { ...sc.camera, keys: sc.camera.keys.map((x) => {
            if (Math.abs(x.t - k.t) >= half) return x;
            if (which === "key") return { ...x, p: [local.x, local.y, local.z] as Vec3 };
            const d: Vec3 = [local.x - x.p[0], local.y - x.p[1], local.z - x.p[2]];
            return { ...x, tan: (which === "out" ? d : [-d[0], -d[1], -d[2]]) as Vec3 };
          }) } };
        }, "tan");
        return;
      }
      if (track === "camera") {
        const parent = s.camera.parent ? objectMatrix(mapOf(s), s.camera.parent, at) : null;
        const l = toLocal(proxy.matrixWorld.clone(), parent, true);
        writePose("camera", tc.mode === "rotate" ? { r: l.r } : { p: l.p }, "tc");
      } else {
        const o = s.objects.find((x) => x.id === track);
        if (!o) return;
        const parent = o.parent ? objectMatrix(mapOf(s), o.parent, at) : null;
        const l = toLocal(proxy.matrixWorld.clone(), parent, false);
        writePose(track, tc.mode === "rotate" ? { r: l.r } : { p: l.p }, "tc");
      }
    });

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      e.size = { w, h };
      renderer.setSize(w, h, false);
      for (const m of e.lineMats) m.resolution.set(w, h);
      free.aspect = w / Math.max(1, h);
      free.updateProjectionMatrix();
      setRect(frameRect(w, h, aspectRatio(sceneRef.current.aspect)));
    });
    ro.observe(host);

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - e.last) / 1000);
      e.last = now;
      const s = sceneRef.current;
      // Time
      const P = playRef.current;
      if (e.rec?.on) {
        const tt = (now - e.rec.t0) / 1000;
        tRef.current = Math.min(s.duration, tt);
        if (tt >= s.duration + 0.05) stopRecording();
      } else if (P.on) {
        let tt = P.from + (now - P.t0) / 1000;
        if (tt >= s.duration) {
          if (loopRef.current) { tt = tt % s.duration; P.from = tt; P.t0 = now; } else { tt = s.duration; P.on = false; setPlaying(false); }
        }
        tRef.current = tt;
      }
      if (P.on || e.rec?.on) setTState(tRef.current);
      // Fly keys move the camera in camera view.
      if (e.keys.size && viewRef.current === "camera" && canEdit && !P.on) flyKeys(dt);
      pose(s, tRef.current);
      draw(s);
    };
    raf = requestAnimationFrame(frame);

    // Picking in the free view: a click (not a drag) selects what is under it.
    let down: { x: number; y: number } | null = null;
    const onDown = (ev: PointerEvent) => { down = { x: ev.clientX, y: ev.clientY }; };
    const onUp = (ev: PointerEvent) => {
      // A press on a transform handle is the handle's, not a pick.
      if (tcUsed || tc.axis) { tcUsed = false; down = null; return; }
      if (!down || viewRef.current !== "free" || tc.dragging) return;
      const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
      down = null;
      if (moved > 4) return;
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, free);
      // Curve handles and key dots first: they are drawn on top, so they win.
      const top = ray.intersectObjects([...(e.handles.group.visible ? [e.handles.out, e.handles.inn] : []), ...e.dots.children], false);
      if (top.length) {
        const o = top[0].object;
        if (o.userData.handle) { handleRef.current = o.userData.handle; setSel("camera"); return; }
        if (typeof o.userData.keyT === "number") {
          handleRef.current = null;
          setSel("camera");
          // The playhead stays put: seeking would drive the car, and the path
          // with it, out of the view being worked in.
          setSelectedKey({ track: "camera", t: o.userData.keyT });
          return;
        }
      }
      handleRef.current = null;
      const hits = ray.intersectObjects([...world.objects.children, gizmo], true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o && !o.userData.objectId && o !== gizmo) o = o.parent;
        if (o === gizmo) { setSel("camera"); setSelectedKey(null); return; }
        if (o?.userData.objectId) {
          const so = sceneRef.current.objects.find((x) => x.id === o!.userData.objectId);
          // The road, the sea and big ground pieces are clicked through, so a
          // click on the floor does not grab the road every time.
          if (so && (so.kind === "road" || so.kind === "sea")) continue;
          setSel(o.userData.objectId); setSelectedKey(null); return;
        }
      }
      setSel(null);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      tc.dispose();
      orbit.dispose();
      fx.dispose();
      fxFree.dispose();
      renderer.dispose();
      e.rec?.fx.dispose();
      e.rec?.renderer.dispose();
      eng.current = null;
    };
    // The loop reads everything through refs; it is built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Places every object and the camera at time `at`. */
  function pose(s: BlockScene, at: number) {
    const e = eng.current;
    if (!e) return;
    const m = mapOf(s);
    // Objects: rebuild any whose shape changed, then place.
    const seen = new Set<string>();
    for (const o of s.objects) {
      seen.add(o.id);
      const key = `${s.look}|${o.kind}|${o.size.join(",")}|${o.color}|${o.pose ?? ""}|${o.seats ?? ""}|${o.build ?? ""}|${o.hair ?? ""}`;
      let rec = e.meshes.get(o.id);
      if (!rec || rec.key !== key) {
        if (rec) e.world.objects.remove(rec.g);
        const g = buildObject(o, s.look);
        g.matrixAutoUpdate = false;
        e.world.objects.add(g);
        rec = { g, key };
        e.meshes.set(o.id, rec);
      }
      rec.g.visible = !o.hidden;
      rec.g.matrix.copy(objectMatrix(m, o.id, at));
      rec.g.matrixWorldNeedsUpdate = true;
      const rig = rec.g.userData.rig as PersonRig | undefined;
      if (rig) {
        const gs = evalGesture(o.keys, at);
        const tgtObj = o.reach?.target ? m.get(o.reach.target) : undefined;
        // A reach lands on top of what it touches; a point or a held-out hand
        // goes toward its middle.
        const wt = tgtObj && gs.reach > 0 ? (gs.kind === "reach" ? touchPoint(m, tgtObj, at) : aimPoint(m, tgtObj, at)) : null;
        const target = wt ? wt.applyMatrix4(rec.g.matrix.clone().invert()) : null;
        poseRig(rig, {
          kind: gs.kind, reach: gs.reach, lean: gs.lean, hand: o.reach?.hand ?? "right", target,
          time: at, stroke: !!o.reach?.stroke, gait: gaitAt(o.keys, at, o.size[1]),
        });
      }
    }
    for (const [id, rec] of e.meshes) if (!seen.has(id)) { e.world.objects.remove(rec.g); e.meshes.delete(id); }
    // Environment
    const envKey = JSON.stringify([s.environment, s.look]);
    if (envKey !== e.envKey) { applyEnvironment(e.world, s.environment, s.look); e.envKey = envKey; }
    // Camera
    const c = camAt(s, at, m);
    const sh = rigMotion(s.camera.rig, s.camera.keys, at, { smooth: s.camera.path === "smooth", flow: s.camera.flow, easeEnds: s.camera.easeEnds }, s.camera.shake);
    const parent = s.camera.parent ? objectMatrix(m, s.camera.parent, at) : null;
    const local: Vec3 = [c.p[0] + sh.p[0], c.p[1] + sh.p[1], c.p[2] + sh.p[2]];
    const rot: Vec3 = [c.r[0] + sh.r[0], c.r[1] + sh.r[1], c.r[2] + sh.r[2]];
    const M = cameraMatrix(local, rot, parent);
    M.decompose(e.shot.position, e.shot.quaternion, e.shot.scale);
    const body = BODIES.find((b) => b.id === s.camera.body) ?? BODIES[0];
    const ratio = aspectRatio(s.aspect);
    const area = imagedArea(body, ratio);
    const vfov = fovDeg(area.h, c.lens);
    const hfov = fovDeg(area.w, c.lens);
    e.shot.fov = vfov;
    e.shot.aspect = ratio;
    e.shot.updateProjectionMatrix();
    e.shot.updateMatrixWorld();
    e.gizmo.matrixAutoUpdate = false;
    e.gizmo.matrix.copy(M);
    e.gizmo.matrixWorldNeedsUpdate = true;
    const fk = `${hfov.toFixed(2)}|${vfov.toFixed(2)}`;
    if (fk !== e.fovKey) { setFrustum(e.gizmo, hfov, vfov); e.fovKey = fk; }
    // The camera's path, drawn in its parent's frame so it travels with it.
    const pk = JSON.stringify([s.camera.keys, s.camera.path, s.camera.flow, s.camera.easeEnds, s.duration, holdsPosition(s.camera.rig)]);
    if (pk !== e.pathKey) {
      const pts: number[] = [];
      const n = Math.max(2, Math.round(s.duration * 30));
      const still = holdsPosition(s.camera.rig);
      for (let i = 0; i <= n; i++) pts.push(...evalCamera(s.camera.keys, still ? 0 : (i / n) * s.duration, s.camera.path === "smooth", { flow: s.camera.flow, easeEnds: s.camera.easeEnds }).p);
      e.pathLine.geometry.dispose();
      const g = new LineGeometry();
      g.setPositions(pts);
      e.pathLine.geometry = g;
      e.pathLine.computeLineDistances();
      for (const d of [...e.dots.children]) { e.dots.remove(d); (d as THREE.Mesh).geometry.dispose(); }
      for (const k of s.camera.keys) {
        const d = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: KEY_COLOR, depthTest: false, depthWrite: false }));
        d.position.set(...k.p);
        d.renderOrder = 22;
        d.userData.keyT = k.t;
        e.dots.add(d);
      }
      e.pathKey = pk;
      e.handleKey = "";
    }
    // The selected key glows; its curve handles show when the motion flows.
    const sk = selKeyRef.current;
    const keyIdx = sk && sk.track === "camera" ? s.camera.keys.findIndex((k) => Math.abs(k.t - sk.t) < 0.5 / s.fps) : -1;
    for (const d of e.dots.children) {
      const on = keyIdx >= 0 && Math.abs((d.userData.keyT as number) - s.camera.keys[keyIdx].t) < 1e-6;
      ((d as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(on ? "#ffffff" : KEY_COLOR);
      d.userData.sel = on;
    }
    const curvy = canEdit && keyIdx >= 0 && s.camera.flow !== "keys" && s.camera.path === "smooth" && s.camera.keys.length >= 2;
    e.handles.group.visible = curvy;
    if (!curvy && handleRef.current) handleRef.current = null;
    if (curvy) {
      const hk = `${pk}|${keyIdx}`;
      if (hk !== e.handleKey) {
        const k = s.camera.keys[keyIdx];
        const tan = keyHandle(s.camera.keys, keyIdx, s.camera.flow === "continuous" && s.camera.easeEnds);
        const o = new THREE.Vector3(k.p[0] + tan[0], k.p[1] + tan[1], k.p[2] + tan[2]);
        const i = new THREE.Vector3(k.p[0] - tan[0], k.p[1] - tan[1], k.p[2] - tan[2]);
        e.handles.out.position.copy(o);
        e.handles.inn.position.copy(i);
        const g = new LineGeometry();
        g.setPositions([i.x, i.y, i.z, ...k.p, o.x, o.y, o.z]);
        e.handles.line.geometry.dispose();
        e.handles.line.geometry = g;
        e.handleKey = hk;
      }
    }
    e.path.matrix.copy(parent ?? new THREE.Matrix4());
    e.path.matrixWorldNeedsUpdate = true;
    // Transform handles follow the selection.
    const track = selRef.current;
    const showTc = viewRef.current === "free" && canEdit && !!track && !playRef.current.on;
    if (showTc && !e.tc.dragging) {
      let wm: THREE.Matrix4 | null;
      const keyDot = track === "camera" && keyIdx >= 0 && e.tc.mode === "translate"
        ? e.dots.children.find((d) => d.userData.sel) : undefined;
      if (track === "camera" && handleRef.current && e.handles.group.visible) {
        const hb = handleRef.current === "out" ? e.handles.out : e.handles.inn;
        e.path.updateMatrixWorld(true);
        wm = new THREE.Matrix4().setPosition(hb.getWorldPosition(new THREE.Vector3()));
        if (e.tc.mode !== "translate") e.tc.setMode("translate");
      } else if (keyDot) {
        // A selected key moves its own point, at whatever time the playhead is.
        e.path.updateMatrixWorld(true);
        wm = new THREE.Matrix4().setPosition(keyDot.getWorldPosition(new THREE.Vector3()));
      } else if (track === "camera") {
        // Unshaken, so dragging does not bake the handheld shake into a key.
        wm = cameraMatrix(c.p, c.r, parent);
      } else wm = m.get(track!) ? objectMatrix(m, track!, at) : null;
      if (wm) {
        wm.decompose(e.proxy.position, e.proxy.quaternion, e.proxy.scale);
        e.proxy.updateMatrixWorld();
        if (e.tc.object !== e.proxy) e.tc.attach(e.proxy);
      }
    }
    if (!showTc && e.tc.object) e.tc.detach();
  }

  function draw(s: BlockScene) {
    const e = eng.current;
    if (!e) return;
    const { renderer, world } = e;
    const { w, h } = e.size;
    const ratio = aspectRatio(s.aspect);
    const dark = new THREE.Color("#0d0e10");
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    renderer.setClearColor(dark, 1);
    renderer.clear();
    const shotView = (x: number, y: number, fw: number, fh: number) => {
      world.helpers.visible = false;
      e.tcHelper.visible = false;
      // While a clip records, the editor's own view is drawn plainly: the
      // recording is the frame that matters, and drawing the occlusion twice
      // a frame can halve the frame rate the clip is recorded at.
      if (e.rec) {
        renderer.setScissorTest(true);
        renderer.setScissor(x, y, fw, fh);
        renderer.setViewport(x, y, fw, fh);
        renderer.render(world.scene, e.shot);
        renderer.setScissorTest(false);
      } else e.fx.render(s.look, { x, y, w: fw, h: fh });
    };
    if (viewRef.current === "camera") {
      e.orbit.enabled = false;
      const r = frameRect(w, h, ratio);
      shotView(r.x, h - r.y - r.h, r.w, r.h);
    } else {
      e.orbit.enabled = !e.tc.dragging;
      e.orbit.update();
      world.helpers.visible = true;
      e.gizmo.visible = true;
      // Dots and handles keep a steady size on screen at any distance.
      const wp = new THREE.Vector3();
      const sizeTo = (o: THREE.Object3D, px: number) => {
        o.getWorldPosition(wp);
        const dist = wp.distanceTo(e.free.position);
        const perPx = (2 * Math.tan((e.free.fov * Math.PI) / 360) * dist) / Math.max(1, h);
        o.scale.setScalar(px * perPx);
      };
      e.path.updateMatrixWorld(true);
      for (const d of e.dots.children) sizeTo(d, d.userData.sel ? 11 : 8);
      if (e.handles.group.visible) { sizeTo(e.handles.out, 8); sizeTo(e.handles.inn, 8); }
      e.tcHelper.visible = !!e.tc.object;
      e.fxFree.render(s.look);
      // Picture in picture: what the camera sees.
      const pw = Math.min(w * 0.3, 380);
      let ph = pw / ratio;
      let pw2 = pw;
      if (ph > h * 0.42) { ph = h * 0.42; pw2 = ph * ratio; }
      shotView(w - pw2 - 14, 14, pw2, ph);
    }
    // The clip canvas is painted from the moment the recorder exists, so it
    // has a first frame to start on (Chrome waits for one).
    if (e.rec) {
      world.helpers.visible = false;
      e.tcHelper.visible = false;
      e.rec.fx.render(s.look);
    }
  }

  /** WASD / QE fly the camera, in its own frame, at 2 m/s (shift: 6). */
  function flyKeys(dt: number) {
    const e = eng.current!;
    const speed = (e.keys.has("shift") ? 6 : 2) * dt;
    const v = new THREE.Vector3(
      (e.keys.has("d") ? 1 : 0) - (e.keys.has("a") ? 1 : 0),
      (e.keys.has("e") ? 1 : 0) - (e.keys.has("q") ? 1 : 0),
      (e.keys.has("s") ? 1 : 0) - (e.keys.has("w") ? 1 : 0),
    );
    if (!v.lengthSq()) return;
    moveCamera(v.multiplyScalar(speed), "fly");
  }

  /** Moves the camera by a vector in its own frame (x right, y up, z back). */
  function moveCamera(local: THREE.Vector3, coalesce: string) {
    const s = sceneRef.current;
    const at = tRef.current;
    const c = camAt(s, at);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((c.r[1] * Math.PI) / 180, (c.r[0] * Math.PI) / 180, (-c.r[2] * Math.PI) / 180, "YXZ"));
    const d = local.clone().applyQuaternion(q);
    writePose("camera", { p: [c.p[0] + d.x, c.p[1] + d.y, c.p[2] + d.z] }, coalesce);
  }

  /**
   * The controller pads in the camera panel (the scene builder's pads). `amt`
   * is seconds at the chosen speed. Boom is straight up and down, truck and
   * push stay level with the floor, the way a dolly moves. While the camera is
   * kept aimed at a subject, pan and tilt move the subject off centre instead,
   * since the lock owns the aim.
   */
  function camPad(action: CamPadAction, amt: number) {
    const s = sceneRef.current;
    const c = camAt(s, tRef.current);
    const m = 0.4 * amt;
    const deg = 15 * amt;
    const y = (c.r[0] * Math.PI) / 180;
    const level = (side: number, fwd: number) =>
      writePose("camera", { p: [c.p[0] + (Math.cos(y) * side - Math.sin(y) * fwd) * m, c.p[1], c.p[2] + (-Math.sin(y) * side - Math.cos(y) * fwd) * m] }, `pad-${action}`);
    const aimed = !!s.camera.aim.target;
    const turn = (dy: number, dp: number) => {
      if (aimed) {
        const [fy, fp] = posedAt(s, "camera", tRef.current).af ?? [0, 0];
        writePose("camera", { af: [Math.max(-60, Math.min(60, fy + dy)), Math.max(-40, Math.min(40, fp + dp))] }, `pad-${action}`);
      } else {
        const p = posedAt(s, "camera", tRef.current);
        writePose("camera", { r: [p.r[0] + dy, Math.max(-89, Math.min(89, p.r[1] + dp)), p.r[2]] }, `pad-${action}`);
      }
    };
    const lens = (k: number) => {
      const p = posedAt(s, "camera", tRef.current);
      writePose("camera", { lens: Math.min(600, Math.max(8, (p.lens ?? 35) * Math.exp(k * 0.6 * amt))) }, `pad-${action}`);
    };
    switch (action) {
      case "boomUp": return writePose("camera", { p: [c.p[0], c.p[1] + m, c.p[2]] }, "pad-boom");
      case "boomDown": return writePose("camera", { p: [c.p[0], Math.max(0.05, c.p[1] - m), c.p[2]] }, "pad-boom");
      case "truckLeft": return level(-1, 0);
      case "truckRight": return level(1, 0);
      case "pushIn": return level(0, 1);
      case "pullOut": return level(0, -1);
      case "panLeft": return turn(deg, 0);
      case "panRight": return turn(-deg, 0);
      case "tiltUp": return turn(0, deg);
      case "tiltDown": return turn(0, -deg);
      case "zoomIn": return lens(1);
      case "zoomOut": return lens(-1);
    }
  }

  /* ---------- camera view mouse controls ---------- */

  const look = useRef<{ x: number; y: number; button: number } | null>(null);
  const onViewportDown = (ev: React.PointerEvent) => {
    if (view !== "camera" || !canEdit) return;
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    look.current = { x: ev.clientX, y: ev.clientY, button: ev.shiftKey ? 2 : ev.button };
    history.current.lastKey = "";
  };
  const onViewportMove = (ev: React.PointerEvent) => {
    const l = look.current;
    if (!l) return;
    const dx = ev.clientX - l.x;
    const dy = ev.clientY - l.y;
    l.x = ev.clientX;
    l.y = ev.clientY;
    if (l.button === 0 && sceneRef.current.camera.aim.target) {
      // Kept aimed: dragging moves the subject off centre at THIS key (the
      // same edit rule as any other change), never the whole shot.
      const [fy, fp] = posedAt(sceneRef.current, "camera", tRef.current).af ?? [0, 0];
      writePose("camera", { af: [Math.max(-60, Math.min(60, fy - dx * 0.08)), Math.max(-40, Math.min(40, fp - dy * 0.08))] }, "aimframe");
    } else if (l.button === 0) {
      const c = posedAt(sceneRef.current, "camera", tRef.current);
      const k = 0.12 * Math.min(1, (c.lens ?? 35) / 35) ** 0.6;
      writePose("camera", { r: [c.r[0] - dx * k, Math.max(-89, Math.min(89, c.r[1] - dy * k)), c.r[2]] }, "look");
    } else {
      moveCamera(new THREE.Vector3(-dx * 0.01, dy * 0.01, 0), "slide");
    }
  };
  const onViewportUp = () => (look.current = null);

  // The wheel needs a non-passive listener to stop the page from scrolling or zooming.
  useEffect(() => {
    const host = hostRef.current!;
    const onWheel = (ev: WheelEvent) => {
      if (viewRef.current !== "camera") return;
      ev.preventDefault();
      if (!canEdit) return;
      if (ev.altKey || ev.ctrlKey) {
        const c = posedAt(sceneRef.current, "camera", tRef.current);
        writePose("camera", { lens: Math.min(600, Math.max(8, (c.lens ?? 35) * Math.exp(-ev.deltaY * 0.002))) }, "zoom");
      } else {
        moveCamera(new THREE.Vector3(0, 0, Math.sign(ev.deltaY) * Math.min(0.6, Math.abs(ev.deltaY) * 0.004)), "dolly");
      }
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  /* ---------- playback and keys ---------- */

  const togglePlay = useCallback(() => {
    const P = playRef.current;
    if (P.on) { P.on = false; setPlaying(false); return; }
    P.from = tRef.current >= sceneRef.current.duration - 1e-3 ? 0 : tRef.current;
    P.t0 = performance.now();
    P.on = true;
    setPlaying(true);
  }, []);

  useEffect(() => {
    const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    const down = (ev: KeyboardEvent) => {
      if (typing(ev.target)) return;
      const e = eng.current;
      const k = ev.key.toLowerCase();
      if ((ev.metaKey || ev.ctrlKey) && k === "z") { ev.preventDefault(); undo(ev.shiftKey); return; }
      if ((ev.metaKey || ev.ctrlKey) && k === "y") { ev.preventDefault(); undo(true); return; }
      if ((ev.metaKey || ev.ctrlKey) && k === "d") { ev.preventDefault(); if (selRef.current && selRef.current !== "camera") api.duplicateObject(selRef.current); return; }
      if (ev.metaKey || ev.ctrlKey) return;
      if (k === " ") { ev.preventDefault(); togglePlay(); return; }
      if (k === "tab") { ev.preventDefault(); setView((v) => (v === "camera" ? "free" : "camera")); return; }
      if (k === "i" && canEdit) { insertKey(); return; }
      if (k === "arrowleft") { setT(snap(Math.max(0, tRef.current - 1 / sceneRef.current.fps), sceneRef.current.fps)); return; }
      if (k === "arrowright") { setT(snap(Math.min(sceneRef.current.duration, tRef.current + 1 / sceneRef.current.fps), sceneRef.current.fps)); return; }
      if (k === "home") { setT(0); return; }
      if (k === "end") { setT(sceneRef.current.duration); return; }
      if ((k === "delete" || k === "backspace") && canEdit) {
        if (selectedKey) deleteKey();
        else if (selRef.current && selRef.current !== "camera") api.deleteObject(selRef.current);
        return;
      }
      if (viewRef.current === "free" && (k === "g" || k === "r")) {
        const m = k === "g" ? "translate" : "rotate";
        setTcMode(m);
        e?.tc.setMode(m);
        return;
      }
      if (viewRef.current === "camera" && ["w", "a", "s", "d", "q", "e"].includes(k) && e) {
        if (!e.keys.size) history.current.lastKey = "";
        e.keys.add(k);
      }
      if (k === "shift" && e) e.keys.add("shift");
    };
    const up = (ev: KeyboardEvent) => { eng.current?.keys.delete(ev.key.toLowerCase()); };
    const blur = () => eng.current?.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  });

  useEffect(() => {
    const e = eng.current;
    if (!e) return;
    setRect(frameRect(e.size.w, e.size.h, aspectRatio(scene.aspect)));
  }, [scene.aspect, view]);

  useEffect(() => { eng.current?.tc.setMode(tcMode); }, [tcMode]);

  // The first time the free view opens it frames the camera and what it is
  // looking at, rather than an origin the shot may be nowhere near.
  const framedOnce = useRef(false);
  useEffect(() => {
    if (view !== "free" || framedOnce.current) return;
    framedOnce.current = true;
    const e = eng.current;
    if (!e) return;
    const target = e.shot.position.clone().add(new THREE.Vector3(0, 0, -6).applyQuaternion(e.shot.quaternion));
    e.orbit.target.copy(target);
    e.free.position.copy(target.clone().add(new THREE.Vector3(9, 7, 11)));
  }, [view]);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 2600);
    return () => clearTimeout(id);
  }, [note]);

  /** In the free view, frames the selection (or the whole scene). */
  const frameSelection = () => {
    const e = eng.current;
    if (!e) return;
    const box = new THREE.Box3();
    const track = selRef.current;
    if (track && track !== "camera") {
      const rec = e.meshes.get(track);
      if (rec) box.setFromObject(rec.g);
    } else if (track === "camera") {
      box.setFromCenterAndSize(e.shot.position, new THREE.Vector3(3, 3, 3));
    } else {
      for (const [id, rec] of e.meshes) {
        const o = sceneRef.current.objects.find((x) => x.id === id);
        if (o && !["sea", "mountain", "road"].includes(o.kind)) box.expandByObject(rec.g);
      }
      box.expandByPoint(e.shot.position);
    }
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(1.5, box.getSize(new THREE.Vector3()).length() * 0.7);
    const dir = e.free.position.clone().sub(e.orbit.target).normalize();
    e.orbit.target.copy(c);
    e.free.position.copy(c.clone().add(dir.multiplyScalar(r * 1.6)));
  };

  /* ---------- export ---------- */

  const exportSize = () => {
    const ratio = aspectRatio(sceneRef.current.aspect);
    // 1280 on the long side, even numbers (encoders refuse odd ones).
    const w = ratio >= 1 ? 1280 : Math.round((1280 * ratio) / 2) * 2;
    const h = ratio >= 1 ? Math.round(1280 / ratio / 2) * 2 : 1280;
    return { w, h };
  };

  const recRenderer = () => {
    const { w, h } = exportSize();
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(w, h, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    return r;
  };

  function stopRecording() {
    const e = eng.current;
    if (!e?.rec) return;
    e.rec.on = false;
    if (e.rec.media.state !== "inactive") e.rec.media.stop();
  }

  /**
   * Plays the shot through the camera into its own canvas and resolves with
   * the recorded clip (null when nothing was recorded). Shared by the
   * download and by Send to pipeline, so both get the same file.
   */
  const captureClip = (): Promise<{ blob: Blob; mime: string; ext: string } | null> =>
    new Promise((resolve) => {
      const e = eng.current;
      const mime = pickMime();
      if (!e || !mime) { setNote("This browser cannot record video: try Chrome"); resolve(null); return; }
      setExportOpen(false);
      playRef.current.on = false;
      setPlaying(false);
      setSel(null);
      const r = recRenderer();
      // Draw one frame before the recorder exists: the first render on a new
      // context compiles the occlusion shaders, which can hold the page for a
      // moment, and a recorder already running through that stall got no
      // frames at all (a 0-byte clip in testing).
      const fx = new ShotRenderer(r, e.world.scene, e.shot, 1);
      pose(sceneRef.current, 0);
      e.world.helpers.visible = false;
      e.tcHelper.visible = false;
      fx.render(sceneRef.current.look);
      const media = new MediaRecorder((r.domElement as HTMLCanvasElement).captureStream(sceneRef.current.fps), { mimeType: mime, videoBitsPerSecond: 14_000_000 });
      const chunks: Blob[] = [];
      media.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
      media.onstop = () => {
        const blob = new Blob(chunks, { type: mime.split(";")[0] });
        if (e.rec) { e.rec.fx.dispose(); e.rec = null; }
        r.dispose();
        setRecording(false);
        setT(0);
        if (!blob.size) { setNote("Nothing was recorded: try again in Chrome"); resolve(null); return; }
        resolve({ blob, mime: mime.split(";")[0], ext });
      };
      e.rec = { renderer: r, fx, media, t0: 0, on: false, chunks };
      tRef.current = 0;
      // The clip starts when the recorder does, or its first frames are lost.
      const go = () => { if (e.rec && !e.rec.on) { e.rec.t0 = performance.now(); e.rec.on = true; } };
      media.onstart = go;
      setTimeout(go, 600);
      setRecording(true);
      setView("camera");
      media.start(250);
    });

  /** The first frame through the camera, as a PNG. */
  const captureFrame = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const e = eng.current;
      if (!e) { resolve(null); return; }
      setExportOpen(false);
      const r = recRenderer();
      pose(sceneRef.current, 0);
      e.world.helpers.visible = false;
      e.tcHelper.visible = false;
      const fx = new ShotRenderer(r, e.world.scene, e.shot, 1);
      fx.render(sceneRef.current.look);
      r.domElement.toBlob((blob) => { fx.dispose(); r.dispose(); resolve(blob); }, "image/png");
    });

  const download = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    setNote(`Saved ${name}`);
  };

  const record = async () => {
    const clip = await captureClip();
    if (clip) download(clip.blob, `${fileStem(sceneRef.current.name)}_blocking.${clip.ext}`);
  };

  const saveFrame = async () => {
    const blob = await captureFrame();
    if (blob) download(blob, `${fileStem(sceneRef.current.name)}_frame1.png`);
  };

  const [sendOpen, setSendOpen] = useState(false);

  /* ---------- layout ---------- */

  const lens = camAt(scene, t).lens;
  const body = BODIES.find((b) => b.id === scene.camera.body) ?? BODIES[0];

  return (
    <div className="grid h-full min-h-0 grid-cols-[220px_1fr_290px] grid-rows-[1fr_220px] bg-bg text-text">
      {/* Outliner */}
      <aside className="row-span-1 min-h-0 border-r border-border bg-surface">
        <Outliner api={api} />
      </aside>

      {/* Viewport */}
      <div className="relative min-h-0 min-w-0">
        <div className="absolute left-2 right-2 top-2 z-10 flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-[7px] border border-border bg-surface p-0.5">
            {(["camera", "free"] as View[]).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={`rounded-[5px] px-2.5 py-1 text-[11.5px] font-semibold ${view === v ? "bg-accent text-accent-fg" : "text-text-muted hover:text-text"}`}>
                {v === "camera" ? "Camera" : "Free view"}
              </button>
            ))}
          </div>
          {view === "free" && canEdit && (
            <div className="flex rounded-[7px] border border-border bg-surface p-0.5">
              {(["translate", "rotate"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setTcMode(m)} title={m === "translate" ? "Move (G)" : "Turn (R)"}
                  className={`rounded-[5px] px-2.5 py-1 text-[11.5px] font-semibold ${tcMode === m ? "bg-accent text-accent-fg" : "text-text-muted hover:text-text"}`}>
                  {m === "translate" ? "Move" : "Turn"}
                </button>
              ))}
            </div>
          )}
          {view === "free" && <Btn onClick={frameSelection} title="Frame the selection">Frame</Btn>}
          {view === "camera" && <Btn active={thirds} onClick={() => setThirds(!thirds)} title="Rule of thirds">Thirds</Btn>}
          {view === "camera" && (
            <div ref={crossRef} className="relative flex">
              <Btn active={cross.on} onClick={() => saveCross({ ...cross, on: !cross.on })} title="Crosshair at the centre of frame" className="rounded-r-none">
                <span className="h-2.5 w-2.5 rounded-full border border-border-strong" style={{ background: cross.color }} />
                Crosshair
              </Btn>
              <Btn onClick={() => setCrossOpen((v) => !v)} title="Crosshair colour and style" className="-ml-px rounded-l-none px-1.5">▾</Btn>
              {crossOpen && (
                <div className="absolute left-0 top-9 z-30 w-[200px] rounded-[10px] border border-border bg-surface p-2.5 shadow-2xl">
                  <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Colour</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CROSS_COLORS.map((c) => (
                      <button key={c.hex} type="button" title={c.name} aria-label={c.name}
                        onClick={() => saveCross({ ...cross, on: true, color: c.hex })}
                        className={`h-6 w-6 rounded-full border ${cross.color === c.hex ? "border-text ring-2 ring-accent" : "border-border-strong"}`}
                        style={{ background: c.hex }} />
                    ))}
                  </div>
                  <p className="mb-1.5 mt-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Style</p>
                  <div className="flex gap-1">
                    {CROSS_STYLES.map((x) => (
                      <button key={x.id} type="button" onClick={() => saveCross({ ...cross, on: true, style: x.id })}
                        className={`flex-1 rounded-[6px] border px-1.5 py-1 text-[11px] font-semibold ${cross.style === x.id ? "border-accent bg-accent text-accent-fg" : "border-border text-text-muted hover:text-text"}`}>
                        {x.name}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2.5 text-[10.5px] leading-relaxed text-text-faint">Only on screen: it is never in a recorded clip or a saved frame.</p>
                </div>
              )}
            </div>
          )}
          <div ref={exportRef} className="relative ml-auto">
            <Btn tone="primary" onClick={() => setExportOpen((v) => !v)} disabled={recording}>{recording ? "Recording…" : "Export"}</Btn>
            {exportOpen && (
              <div className="absolute right-0 top-9 z-30 w-[290px] rounded-[10px] border border-border bg-surface p-3 shadow-2xl">
                <p className="text-[12px] font-semibold text-text">For Seedance</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-text-muted">
                  Upload the clip as a video reference for the camera move, and the first frame (made real) as the start image.
                </p>
                <div className="mt-3 space-y-1.5">
                  {pipeline && (
                    <Btn className="w-full" tone="primary" onClick={() => { setExportOpen(false); setSendOpen(true); }}>Send to the pipeline…</Btn>
                  )}
                  <Btn className="w-full" tone={pipeline ? "plain" : "primary"} onClick={record}>Record the blocking clip ({scene.duration.toFixed(1)} s)</Btn>
                  <Btn className="w-full" onClick={saveFrame}>Save the first frame (PNG)</Btn>
                </div>
                <p className="mt-2 text-[10.5px] text-text-faint">{exportSize().w} x {exportSize().h}, {scene.fps} fps, in the {scene.look} look. Recording plays the shot through in real time.</p>
              </div>
            )}
          </div>
        </div>

        <div ref={hostRef} className="absolute inset-0"
          onPointerDown={onViewportDown} onPointerMove={onViewportMove} onPointerUp={onViewportUp}
          onContextMenu={(e) => e.preventDefault()}>
          <canvas ref={canvasRef} className="block h-full w-full" style={{ cursor: view === "camera" && canEdit ? "grab" : "default" }} />
        </div>

        {describe && canEdit && !recording && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex justify-center">
            <SceneBar collapsible
              placeholder="Change the scene: add a cyclist passing behind her at 3 s, push in slower…"
              onUndo={() => undo()}
              onSubmit={async (prompt) => {
                const res = await describe(prompt, sceneRef.current);
                if ("error" in res) return res;
                commit(() => res.scene);
                if (tRef.current > res.scene.duration) setT(res.scene.duration);
                const ids = new Set(res.scene.objects.map((o) => o.id));
                if (sel && sel !== "camera" && !ids.has(sel)) setSel("camera");
                return { summary: res.summary, skipped: res.skipped };
              }}
            />
          </div>
        )}

        {view === "camera" && rect.w > 0 && (
          <div className="pointer-events-none absolute" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
            <div className="absolute inset-0 border border-text-faint" />
            {thirds && (
              <>
                {[1, 2].map((i) => <div key={`v${i}`} className="absolute bottom-0 top-0 w-px bg-white opacity-20" style={{ left: `${(i * 100) / 3}%` }} />)}
                {[1, 2].map((i) => <div key={`h${i}`} className="absolute left-0 right-0 h-px bg-white opacity-20" style={{ top: `${(i * 100) / 3}%` }} />)}
              </>
            )}
            {cross.on && <CrosshairMark color={cross.color} style={cross.style} />}
            <div className="absolute -bottom-6 left-0 right-0 flex items-center justify-between font-mono text-[11px] text-text-muted">
              <span>{body.name} · {Math.round(lens)}mm · {scene.aspect}</span>
              <span className="flex items-center gap-2">
                {recording && <span className="flex items-center gap-1 text-red"><span className="h-2 w-2 rounded-full bg-red" />REC</span>}
                {timecode(t, scene.fps)}
              </span>
            </div>
          </div>
        )}
        {view === "free" && (
          <p className="pointer-events-none absolute bottom-3 left-3 rounded-[6px] bg-surface px-2 py-1 text-[11px] text-text-muted">
            Drag to orbit · right-drag to pan · click to select · G move · R turn
          </p>
        )}
        {note && (
          <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 rounded-[8px] border border-border bg-surface px-3 py-1.5 text-[12px] text-text shadow-lg">
            {note}
          </div>
        )}
      </div>

      {sendOpen && pipeline && (
        <SendToPipeline
          target={pipeline}
          sceneName={scene.name}
          duration={scene.duration}
          size={exportSize()}
          fps={scene.fps}
          aspect={scene.aspect}
          captureClip={captureClip}
          captureFrame={captureFrame}
          onClose={() => setSendOpen(false)}
        />
      )}

      {/* Properties */}
      <aside className="row-span-2 min-h-0 overflow-y-auto border-l border-border bg-surface">
        <Properties api={api} />
      </aside>

      {/* Timeline */}
      <div className="col-span-2 min-h-0">
        <Timeline
          scene={scene} t={t} setT={setT} playing={playing} onPlay={togglePlay} loop={loop} setLoop={setLoop}
          selected={sel} onSelectTrack={(tr) => { setSel(tr); }} selectedKey={selectedKey} onSelectKey={setSelectedKey}
          onMoveKey={moveKey} onDeleteKey={deleteKey} onInsertKey={insertKey} autoKey={autoKey} setAutoKey={setAutoKey}
          onDuration={(d) => commit((s) => ({ ...s, duration: d, camera: { ...s.camera, keys: s.camera.keys.filter((k) => k.t <= d) .length ? s.camera.keys.filter((k) => k.t <= d) : [s.camera.keys[0]] }, objects: s.objects.map((o) => { const ks = o.keys.filter((k) => k.t <= d); return { ...o, keys: ks.length ? ks : [o.keys[0]] }; }) }), "dur")}
          onFps={(f) => commit((s) => ({ ...s, fps: f }))}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
