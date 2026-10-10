"use client";

// Scene Setup PROTOTYPE: a throwaway at /dev/scene-setup with no database and
// no app wiring, built so the operator can judge how it feels to drive before
// anything real is built (see CLAUDE.md, "Scene Setup: 3D previz"). The
// layout is the one they confirmed: through-the-lens main view, live top-down
// map in the corner, scene contents on the left, a production-language
// inspector on the right, shots along the bottom with each storyboard frame
// beside what its camera sees.
//
// The set is free-form: a room built from measurements (or an open stage) and
// any number of items on it (backdrops, flats, risers, furniture, practicals,
// props, products from photos, imported models), plus talent who can walk to
// a mark while the camera moves.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ASPECTS, BODIES, PRIMES, STOPS, cameraAngle, circleOfConfusion, dofLimits, feet,
  fovDeg, imagedArea, metres, shotSize,
} from "@/lib/previz/optics";
import { buildFigure, buildRig, buildWorld, dofMaterial, eyeHeight, handWorld, type TalentSpec } from "@/lib/previz/scene-build";
import { SAMPLE_BOARDS } from "@/lib/previz/boards";
import { SUPPORTS, bodyDrop, buildSupport, buildUnderslungMount, underslungTop, robotBaseLocal, robotBaseRange, type RobotMount, type SupportOpts } from "@/lib/previz/camera-model";
import {
  FIXTURES, FT, WINDOW_SKIES, apparentSizeDeg, cameraColor, cameraColorRgb, exposureScale, lightOutput, lightRgb, luxForStop,
  resolveSource, type WindowSky,
} from "@/lib/previz/lighting";
import {
  GRIP_NAMES, GRIP_REFLECTANCE, buildGripRig, buildLightRig, hangClearance, structureKey, updateGripRig, updateLightRig,
  type GripKind, type GripRig, type GripSpec, type LightRig, type LightSpec,
} from "@/lib/previz/light-build";
import {
  bounceCandela, collectOccluders, emittersFromSource, nearFieldScale, readMeter, roomLuxFrom, type Board, type Emitter, type Reading,
} from "@/lib/previz/meter";
import { ExposurePanel, GripInspector, LightInspector, PracticalInspector, ShotExposure, WindowInspector, type WindowLightStyle } from "./light-panels";
import { Chip, Field, RailGroup, RailItem, Readout, Seg, Thumb, Toggle, TrashIcon } from "./ui";
import {
  aim, asSetup, assetKeys, bathroomSetup, setupForStore, bedroomSetup, blankSetup, downloadSetup, kitchenSetup, loadSetup, rigYawOf, saveSetup, studioSetup,
  type Setup, type Shot, type Units, type Vec3, type WinState,
} from "./setup";
import { FRAME_A, FRAME_B, Timeline } from "./timeline";
import {
  camAt, constrainEnd, ease, fromLocal, isLockedOff, moveStats, toLocal, trackExtent, trackFrame, type CamKey, type Move,
} from "@/lib/previz/camera-move";
import { POSES } from "@/lib/previz/poses";
import { ControlPads, type PadSpec } from "./move-pad";
import { CLAMP_DROP, POLECAT_MAX, hangOn, isRig, rigHeight, wallToWall, type RigKind } from "@/lib/previz/rigging";
import { HOUSE_LEVEL, buildHouseView, frameBox, gridSpacing, syncMarkers, type Marker } from "@/lib/previz/house-view";
import {
  CATEGORIES, bulbLocal, buildItem, catalogOf, containsPoint, itemShapeKey, itemToWorld, newItem, stackHeights, standHeight, seatUnder, groundUnder,
  type ItemSpec, type LabelArt,
} from "@/lib/previz/set-items";
import { buildRoom, outsideRoom, roomBounds, roomWindows, throughWindow, windowName, type SetSpec, type WindowInfo } from "@/lib/previz/room";
import { embedAssets, getAsset, prepareLabel, putAsset, restoreAssets } from "@/lib/previz/asset-store";
import { MAX_MODEL_BYTES, UNITS, guessUnit, loadModel, modelFormat, rawSize } from "@/lib/previz/model-import";
import { strideSide, walkSpeed, walkerAt } from "@/lib/previz/talent-walk";
import { AddMenu, ItemInspector, RoomInspector, ScoutDialog, type ScoutChoices } from "./set-panels";
import { SHOT_HUES, TopDownMap, type MapPick } from "./top-down-map";
import { readScoutPhoto } from "@/app/(app)/projects/[id]/scene-actions";
import type { RoomDraft } from "@/lib/previz/room-draft";

type Selection =
  | { kind: "camera" }
  | { kind: "talent"; id: string }
  | { kind: "item"; id: string }
  | { kind: "light"; id: string }
  | { kind: "daylight" }
  | { kind: "grip"; id: string }
  | { kind: "set" };

/** Everything that stands on the set, placed: heights resolved, held props in hand. */
type Scene = { talent: TalentSpec[]; items: ItemSpec[]; walk: Map<string, { walking: boolean; walked: number }> };

const STAGE_BG = "#131416"; // neutral and fixed: the frame is judged here
const UP = new THREE.Vector3(0, 1, 0);

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function forward(yaw: number, pitch: number): THREE.Vector3 {
  const y = rad(yaw);
  const p = rad(pitch);
  return new THREE.Vector3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
}

/**
 * Talent and items where they really are at `k` (0 to 1) through the action:
 * people part way to their marks and lifted by a riser or an apple box under
 * them, items stacked on whatever is under them, and anything somebody holds
 * in their right hand.
 */
function placeScene(rawTalent: TalentSpec[], rawItems: ItemSpec[], k: number): Scene {
  const heights = stackHeights(rawItems);
  const walk = new Map<string, { walking: boolean; walked: number }>();
  const talent = rawTalent.map((raw) => {
    const w = walkerAt(raw, k);
    walk.set(raw.id, { walking: w.walking, walked: w.walked });
    const { walking: _a, walked: _b, ...t } = w;
    if (t.pose !== "seated") return { ...t, y: standHeight(rawItems, heights, t.x, t.z), seatY: null };
    // Seated: the hip lands on whatever is under it, and the feet on whatever
    // is under the knees (the floor at a bed's edge, the bed in its middle).
    const seat = seatUnder(rawItems, heights, t.x, t.z);
    const r = (t.facing * Math.PI) / 180, reach = 0.27 * t.heightM;
    const footY = groundUnder(rawItems, heights, t.x + Math.sin(r) * reach, t.z + Math.cos(r) * reach);
    return { ...t, y: 0, seatY: seat?.y ?? null, footY };
  });
  const items = rawItems.map((i) => {
    const holder = talent.find((t) => t.holding === i.id && t.pose === "holding");
    if (holder && catalogOf(i.kind).holdable) {
      const h = handWorld(holder);
      return { ...i, x: h.x, y: h.y - i.h * 0.45, z: h.z, rot: holder.facing, heldBy: holder.id };
    }
    return { ...i, y: heights.get(i.id) ?? 0, heldBy: null };
  });
  return { talent, items, walk };
}

/** Where a focus or aim target sits in the world. */
function targetPoint(id: string, sc: Scene): THREE.Vector3 | null {
  const t = sc.talent.find((x) => x.id === id);
  if (t) return new THREE.Vector3(t.x, eyeHeight(t), t.z);
  const i = sc.items.find((x) => x.id === id);
  if (!i) return null;
  // A backdrop is lit on its face: the middle of the hanging part, at the back.
  if (catalogOf(i.kind).category === "backdrop") return itemToWorld(i, new THREE.Vector3(0, i.h * 0.45, -i.d / 2 + 0.05));
  return new THREE.Vector3(i.x, (i.y ?? 0) + i.h * (catalogOf(i.kind).surface === 1 ? 1 : 0.55), i.z);
}
function targetName(id: string | null, sc: Scene): string | null {
  if (!id) return null;
  return sc.talent.find((t) => t.id === id)?.name ?? sc.items.find((i) => i.id === id)?.name ?? null;
}
/** Focus distance is measured to the focus PLANE, along the lens axis. */
function effectiveFocus(s: Shot, sc: Scene): number {
  if (!s.focusOn) return s.focusM;
  const p = targetPoint(s.focusOn, sc);
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
function viewShot(s: Shot, t: number, sc: Scene): Shot {
  if (!s.move || t <= 0) return s;
  const c = camAt(camKey(s), s.move, t);
  const base: Shot = { ...s, pos: c.pos, yaw: c.yaw, pitch: c.pitch, focal: c.focal };
  const e = s.move.end;
  if (s.focusOn === e.focusOn) return { ...base, focusOn: s.focusOn, focusM: c.focusM };
  const fa = effectiveFocus({ ...base, focusOn: s.focusOn, focusM: s.focusM }, sc);
  const fb = effectiveFocus({ ...base, focusOn: e.focusOn, focusM: e.focusM }, sc);
  return { ...base, focusOn: null, focusM: fa + (fb - fa) * c.mix };
}
/** The camera keys of a frame, the only part of a shot a move changes. */
const CAM_KEYS = ["pos", "yaw", "pitch", "focal", "focusM", "focusOn"] as const;
/** A shot with a real move (not one locked off for the action), whose camera is framed then stamped. */
function hasMove(s: Shot): boolean {
  return !!s.move && !isLockedOff(camKey(s), s.move);
}
/**
 * What the camera shows: unsaved framing when there is some and nothing is
 * playing, otherwise the move at the playhead.
 */
function seenShot(s: Shot, t: number, sc: Scene, draft: CamKey | undefined, playing: boolean): Shot {
  if (draft && !playing && hasMove(s)) return { ...s, ...draft };
  return viewShot(s, t, sc);
}
/**
 * The outline another frame of the move covers, drawn into this view: the
 * rectangle that frame sees at its own focus distance, projected through the
 * camera being looked through. Returned as fractions of the view, or null
 * when any corner is behind this camera.
 */
function frameOutline(view: Shot, other: Shot, ratio: number, sc: Scene): [number, number][] | null {
  const camFor = (s: Shot) => {
    const b = BODIES.find((x) => x.id === s.bodyId) ?? BODIES[0];
    const c = new THREE.PerspectiveCamera(fovDeg(imagedArea(b, ratio).h, s.focal), ratio, 0.05, 500);
    c.rotation.order = "YXZ";
    c.position.set(s.pos.x, s.pos.y, s.pos.z);
    c.rotation.set(rad(s.pitch), rad(s.yaw), 0);
    c.updateMatrixWorld(true);
    c.updateProjectionMatrix();
    return c;
  };
  const me = camFor(view);
  const them = camFor(other);
  const d = effectiveFocus(other, sc);
  const hh = d * Math.tan(rad(them.fov / 2));
  const hw = hh * ratio;
  const out: [number, number][] = [];
  for (const [x, y] of [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]]) {
    const w = new THREE.Vector3(x, y, -d).applyMatrix4(them.matrixWorld);
    const local = w.clone().applyMatrix4(me.matrixWorldInverse);
    if (local.z > -0.05) return null;
    const n = w.project(me);
    out.push([(n.x + 1) / 2, (1 - n.y) / 2]);
  }
  return out;
}
/**
 * How a shot's support is drawn with the camera at `at`: turned to its own
 * heading (never the camera's pan), with the track covering the whole move
 * and the robot's base left where it stood at the start.
 */
function supportPose(s: Shot, at: Vec3, head?: { yaw: number; pitch: number }): { yaw: number; opts: SupportOpts } {
  const yaw = rigYawOf(s);
  const f = { ...camKey(s), yaw };
  const cur = toLocal(f, at);
  const ext = trackExtent(s.support, camKey(s), s.move ? { ...s.move, trackYaw: yaw } : null);
  if (s.support === "dana" && ext) return { yaw, opts: { track: { from: ext.from - cur.lx, to: ext.to - cur.lx } } };
  if (s.support === "fisher" && ext) return { yaw, opts: { track: { from: ext.from - cur.lz, to: ext.to - cur.lz } } };
  if (s.support === "robot") {
    const b = robotBaseOf(s);
    const mount = mountOf(s);
    const base = { x: b.x - cur.lx, z: b.z - cur.lz };
    if (mount === "over") return { yaw, opts: { base, mount } };
    // Underslung: the top of the 6th axis, which pans and tilts with the head,
    // brought into the support's frame so the arm can reach down onto it.
    const h = head ?? { yaw: s.yaw, pitch: s.pitch };
    const top = underslungTop(s.bodyId);
    top.applyEuler(new THREE.Euler(rad(h.pitch), rad(h.yaw), 0, "YXZ"));
    top.applyAxisAngle(UP, -rad(yaw));
    return { yaw, opts: { base, mount, wrist: { x: top.x, y: top.y + at.y, z: top.z } } };
  }
  return { yaw, opts: {} };
}
/** Where the arm's base stands, rig frame, relative to the camera's start. */
function robotBaseOf(s: Shot): { x: number; z: number } {
  return s.robotBase ?? robotBaseLocal(s.pos.y, bodyDrop(s.bodyId), mountOf(s));
}
/** How the arm holds the camera: underslung unless the shot says otherwise. */
function mountOf(s: Pick<Shot, "robotMount">): RobotMount {
  return s.robotMount ?? "under";
}
/**
 * After any change to a shot: what the camera is on keeps the heading it had
 * unless the change sets a new one, so panning the head never turns the
 * track. A move's track heading follows it.
 */
/**
 * A motion control arm's base is stored relative to the camera, so moving the
 * camera would carry the base with it. This keeps the base where it stands on
 * the floor instead, and only lets it trail along once the camera goes past
 * what the arm can reach (or folds in closer than it can bend).
 */
function keepRobotBase(prev: Shot, next: Shot): Shot {
  if (next.support !== "robot" || prev.support !== "robot") return next;
  const py = rigYawOf(prev);
  const ny = rigYawOf(next);
  if (prev.pos.x === next.pos.x && prev.pos.z === next.pos.z && py === ny) return next;
  const b = robotBaseOf(prev);
  const world = fromLocal({ ...camKey(prev), yaw: py }, b.x, 0, b.z);
  const l = toLocal({ ...camKey(next), yaw: ny }, world);
  const range = robotBaseRange(next.pos.y, bodyDrop(next.bodyId), mountOf(next));
  const d = Math.hypot(l.lx, l.lz) || 1;
  const k = Math.max(range.min, Math.min(range.max, d)) / d;
  return { ...next, robotBase: { x: l.lx * k, z: l.lz * k } };
}

function settleRig(prev: Shot, next: Shot): Shot {
  // A support just picked starts square to the lens; after that it stays put.
  const swapped = next.support !== prev.support && next.rigYaw === prev.rigYaw;
  const rigYaw = swapped ? next.yaw : next.rigYaw ?? rigYawOf(prev);
  const out = { ...next, rigYaw };
  if (out.move && out.move.trackYaw !== rigYaw) out.move = { ...out.move, trackYaw: rigYaw };
  return out;
}

const WINDOW_CCT: Record<WindowSky, number> = { overcast: 6500, bright: 6000, sun: 5600 };
const BULB_R = 0.045;

/** Toward the sun: low and outside the first window, coming in at a slant. */
function sunDirection(windows: WindowInfo[]): THREE.Vector3 | null {
  const w = windows[0];
  if (!w) return null;
  const el = rad(24);
  const out = w.inward.clone().negate().applyAxisAngle(UP, rad(15)).multiplyScalar(Math.cos(el));
  return out.add(new THREE.Vector3(0, Math.sin(el), 0)).normalize();
}

type Placed = { x: number; y: number; z: number; yaw: number; pitch: number; aimAt: string | null };
/** Where a light or a board points: at its target if it has one. */
function aimOf(p: Placed, sc: Scene): { yaw: number; pitch: number } {
  if (p.aimAt) {
    const t = targetPoint(p.aimAt, sc);
    if (t) return aim({ x: p.x, y: p.y, z: p.z }, t);
  }
  return { yaw: p.yaw, pitch: p.pitch };
}
/** Where the meter is held for a shot: on the focus target, or on the focus plane. */
function meterPoint(s: Shot, sc: Scene): THREE.Vector3 {
  if (s.focusOn) {
    const t = targetPoint(s.focusOn, sc);
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
  return { x: subject.x + x * m, z: subject.z + z * m };
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
/**
 * A light hung from a rig, put where it can actually be: on the nearest pipe
 * and below the clamp. A light whose rig has gone is back on a stand.
 */
function settleHung(s: LightSpec, items: ItemSpec[]): LightSpec {
  if (!s.hangFrom) return s.hungY == null ? s : { ...s, hungY: null };
  const rig = items.find((i) => i.id === s.hangFrom && isRig(i.kind));
  if (!rig) return { ...s, hungY: null };
  const h = hangOn(rig, s.x, s.z, s.y, hangClearance(s.fixtureId, s.modifierId));
  return { ...s, x: h.x, z: h.z, y: h.y, hungY: h.pipeY };
}
/** The same, for storing: the runtime pipe height is not part of the setup. */
function snapHung(s: LightSpec, items: ItemSpec[]): LightSpec {
  const { hungY: _h, ...rest } = settleHung(s, items);
  return rest;
}
function effLight(raw: LightSpec, sc: Scene): LightSpec {
  const s = settleHung(raw, sc.items);
  if (!s.frame || !s.aimAt) return s;
  const t = targetPoint(s.aimAt, sc);
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
/** Frees GPU memory under an object, leaving a loaded model's shared geometry alone. */
function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    if (c.userData.shared) return;
    const m = c as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose?.();
    (c as THREE.Light).dispose?.();
  });
}
function clearGroup(g: THREE.Group) {
  for (const c of [...g.children]) {
    g.remove(c);
    disposeTree(c);
  }
}
/** A practical's light, as lumens out of the bulb. */
function lampFlux(i: ItemSpec): number {
  return i.light?.on ? i.light.lumens * i.light.dimmer : 0;
}
/** Every source in the scene, as the meter sees it. */
function buildEmitters(lights: LightSpec[], win: WinState, sc: Scene, windows: WindowInfo[]): Emitter[] {
  const out: Emitter[] = [];
  for (const raw of lights) {
    if (!raw.on) continue;
    const s = effLight(raw, sc);
    const src = resolveSource(fixtureOf(s), s.modifierId, lightOutput(s, fixtureOf(s)), s.beamDeg, s.frame);
    const a = aimOf(s, sc);
    out.push(...emittersFromSource(s.id, lightLabel(s), new THREE.Vector3(s.x, s.y, s.z), forward(a.yaw, a.pitch), src));
  }
  if (win.on) {
    const nits = WINDOW_SKIES[win.sky].skyNits * Math.pow(10, -win.nd);
    windows.forEach((w, i) => out.push({
      id: `window:${w.id}`, label: windows.length > 1 ? `Window ${i + 1}` : "Window", pos: w.centre.clone(), fwd: w.inward.clone(),
      candela: nits * w.area, beamDeg: 180, omni: false, sizeM: w.width, flux: nits * w.area * Math.PI,
    }));
  }
  for (const i of sc.items) {
    const flux = lampFlux(i);
    if (flux <= 0) continue;
    out.push({
      id: i.id, label: i.name, pos: itemToWorld(i, bulbLocal(i)), fwd: new THREE.Vector3(0, -1, 0),
      candela: flux / (4 * Math.PI), beamDeg: 360, omni: true, sizeM: BULB_R * 2, flux,
    });
  }
  return out;
}

/** A camera-side photo, made small: a data URL for an overlay, base64 for the reader. */
async function shrinkPhoto(file: File, maxSide: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file is not a photo this browser can read."));
      i.src = url;
    });
    const s = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * s));
    c.height = Math.max(1, Math.round(img.height * s));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type ModelEntry = { obj: THREE.Object3D; raw: { x: number; y: number; z: number } } | "loading" | "missing";
type ArtEntry = (LabelArt & { aspect: number }) | "loading" | "missing";

/**
 * Where a setup is kept. Without one (the /dev prototype) it lives in this
 * browser's localStorage; with one (Scene builder on a project) it is saved to
 * the project's scene_setups row, and "New" makes another row instead of
 * replacing this one.
 */
export type SceneStore = {
  initial: Setup;
  /** Resolves to an error sentence, or null when saved. */
  save: (s: Setup) => Promise<string | null>;
  /** Makes a new setup on the project and switches to it. */
  create: (s: Setup) => Promise<void>;
  canEdit: boolean;
};

export function PrevizPrototype({ store, heightClass = "h-screen" }: { store?: SceneStore; heightClass?: string } = {}) {
  const [initial] = useState(() => store?.initial ?? kitchenSetup());
  const [name, setName] = useState(initial.name);
  const [set, setSet] = useState<SetSpec>(initial.set);
  const [items, setItems] = useState<ItemSpec[]>(initial.items);
  const [shots, setShots] = useState<Shot[]>(initial.shots);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [talent, setTalent] = useState<TalentSpec[]>(initial.talent);
  const [aspectId, setAspectId] = useState(initial.aspectId);
  const [view, setView] = useState<"lens" | "free">("lens");
  const [clay, setClay] = useState(false);
  // Free view's work lights. A per-person preference about how to look round
  // the set, so it lives in this browser rather than in the setup file.
  const [houseLights, setHouseLights] = useState(true);
  useEffect(() => {
    try { if (window.localStorage.getItem("previz.houseLights") === "off") setHouseLights(false); } catch { /* storage off */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem("previz.houseLights", houseLights ? "on" : "off"); } catch { /* storage off */ }
  }, [houseLights]);
  // The shots strip folds down to one line of shot chips so the picture can
  // take the room. Per person, like the house lights.
  const [shotsOpen, setShotsOpenState] = useState(true);
  // Focus hides both side panels and folds the shots strip, so the picture
  // gets the whole window. Not remembered: reopening the page with every
  // control hidden would read as the page being broken.
  const [focusMode, setFocusMode] = useState(false);
  const stripOpen = shotsOpen && !focusMode;
  useEffect(() => {
    try { if (window.localStorage.getItem("previz.shotsOpen") === "closed") setShotsOpenState(false); } catch { /* storage off */ }
  }, []);
  // Saved on the press rather than in an effect, so nothing can write the
  // default over a stored "closed" before it has been read.
  const toggleShots = () => {
    // In focus the strip is folded by focus, not by preference: opening it
    // means leaving focus, with the strip shown.
    if (focusMode) {
      setFocusMode(false);
      if (!shotsOpen) flipShots();
      return;
    }
    flipShots();
  };
  const flipShots = () => setShotsOpenState((o) => {
    try { window.localStorage.setItem("previz.shotsOpen", o ? "closed" : "open"); } catch { /* storage off */ }
    return !o;
  });
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
  const [zebra, setZebra] = useState(false);
  const [meter, setMeter] = useState<Reading | null>(null);
  // The move timeline: where the playhead sits (0 start, 1 end), and playback.
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  // Unsaved framing, per shot with a move: the camera as it is being driven,
  // before it is stamped as the move's start or its end. Nothing about the
  // move changes until one of those is pressed.
  const [drafts, setDrafts] = useState<Record<string, CamKey>>({});
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [scout, setScout] = useState(false);
  // Bumped when a product photo or a model finishes loading, so the set rebuilds.
  const [assetTick, setAssetTick] = useState(0);

  const rawActive = shots.find((s) => s.id === activeId) ?? shots[0];
  // Talent walk to their marks over the active shot's move, with its ease.
  const actionK = rawActive.move ? ease(rawActive.move.ease, playhead) : 0;
  const scene = useMemo(() => placeScene(talent, items, actionK), [talent, items, actionK]);
  // What seated people sit on: a figure is rebuilt when its seat changes.
  const seatKey = scene.talent.map((t) => (t.pose === "seated" ? `${t.id}:${(t.seatY ?? -1).toFixed(3)}:${(t.footY ?? 0).toFixed(3)}` : "")).join("|");
  // What the camera sees right now: unsaved framing, or the start, the end or
  // a moment between.
  const draft = drafts[rawActive.id];
  const active = seenShot(rawActive, playhead, scene, draft, playing);
  const aspect = ASPECTS.find((a) => a.id === aspectId) ?? ASPECTS[0];
  const body = BODIES.find((b) => b.id === active.bodyId) ?? BODIES[0];
  const area = imagedArea(body, aspect.ratio);
  const focus = effectiveFocus(active, scene);
  const windows = useMemo(() => (set.kind === "room" ? roomWindows(set.room) : []), [set]);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ shots, activeId, talent, items, aspect, view, clay, lights, grips, win, zebra, set, playhead, houseLights, units, drafts });
  live.current = { shots, activeId, talent, items, aspect, view, clay, lights, grips, win, zebra, set, playhead, houseLights, units, drafts };
  // The scene as last posed by the render loop, which the light rigs aim from.
  const poseRef = useRef<Scene>(scene);
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
  // The 3D objects the React state turns into, kept by id.
  const figs = useRef(new Map<string, { base: THREE.Group; walk: [THREE.Group, THREE.Group] | null }>());
  const itemObjs = useRef(new Map<string, { group: THREE.Group; key: string }>());
  const windowLights = useRef<{ info: WindowInfo; light: THREE.SpotLight }[]>([]);
  const skies = useRef(new Map<string, THREE.MeshStandardMaterial>());
  const sunDir = useRef<THREE.Vector3 | null>(null);
  // Loaded product photos and models, by asset key.
  const art = useRef(new Map<string, ArtEntry>());
  const models = useRef(new Map<string, ModelEntry>());
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
    pose: (sc: Scene) => void;
    house: ReturnType<typeof buildHouseView>;
  } | null>(null);
  const captureQueue = useRef<string[]>([]);
  /** Queues these shots for new thumbnails, keeping any move-end cards already waiting. */
  const requeue = (ids: string[]) => {
    captureQueue.current = [...ids, ...captureQueue.current.filter((k) => k.includes("#") && !ids.includes(k))];
  };
  const lastChange = useRef(0);
  const activeDirty = useRef(true);
  const saveFrame = useRef(false);
  const dirty = () => {
    activeDirty.current = true;
    lastChange.current = performance.now();
  };

  /**
   * Changes a shot. On a shot with a move, a camera change never lands on the
   * move directly: it moves the UNSAVED FRAMING, starting from whatever the
   * camera shows now, and nothing about the move changes until that framing
   * is stamped as the start or the end. On a shot locked off for the action,
   * both ends move together. Everything else lands on the shot as it is.
   */
  const updateShot = useCallback((id: string, patch: Partial<Shot> | ((s: Shot) => Partial<Shot>)) => {
    const L = live.current;
    const s0 = L.shots.find((x) => x.id === id);
    if (!s0) return;
    if (id === L.activeId && hasMove(s0)) {
      const fromView = camKey(viewShot(s0, L.playhead, poseRef.current));
      const probe = typeof patch === "function" ? patch({ ...s0, ...(L.drafts[id] ?? fromView) }) : patch;
      const rest: Partial<Shot> = { ...probe };
      let framing = false;
      for (const k of CAM_KEYS) {
        if (k in probe) {
          framing = true;
          delete rest[k];
        }
      }
      if (framing) {
        // Evaluated against the freshest framing, so quick drags accumulate.
        setDrafts((d) => {
          const base = d[id] ?? fromView;
          const p = typeof patch === "function" ? patch({ ...s0, ...base }) : patch;
          const next: CamKey = { ...base };
          for (const k of CAM_KEYS) if (k in p) (next as Record<string, unknown>)[k] = p[k];
          return { ...d, [id]: next };
        });
      }
      if (Object.keys(rest).length) {
        setShots((all) => all.map((s) => {
          if (s.id !== id) return s;
          let next = settleRig(s, { ...s, ...rest });
          if (!("robotBase" in rest)) next = keepRobotBase(s, next);
          if (next.move) next.move = { ...next.move, end: constrainEnd(next.support, camKey(next), next.move.end, next.move.trackYaw) };
          return next;
        }));
      }
    } else {
      setShots((all) => all.map((s) => {
        if (s.id !== id) return s;
        const p = typeof patch === "function" ? patch(s) : patch;
        let next = settleRig(s, { ...s, ...p });
        if (!("robotBase" in p)) next = keepRobotBase(s, next);
        if (!next.move) return next;
        // Locked off for the action: the end IS the start, so it follows.
        if (!("move" in p) && isLockedOff(camKey(s), s.move)) next.move = { ...next.move, end: camKey(next) };
        else next.move = { ...next.move, end: constrainEnd(next.support, camKey(next), next.move.end, next.move.trackYaw) };
        return next;
      }));
    }
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
    // Free view's aids (house lights, ground grid, markers). Hidden for every
    // lens render, so none of it can reach a shot, a thumbnail or a clip.
    const house = buildHouseView();
    world.scene.add(house.fill);
    const stageBg = (world.scene.background as THREE.Color).clone();
    const houseBg = new THREE.Color("#22252b");
    const shotCam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 80);
    shotCam.rotation.order = "YXZ";
    const freeCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 200);
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
      const sc = poseRef.current;
      const seen = new Set<string>();
      let shadows = 0;
      for (const raw of L.lights) {
        const s = effLight(raw, sc);
        seen.add(s.id);
        let rig = lightRigs.get(s.id);
        if (!rig || rig.structureKey !== structureKey(s)) {
          if (rig) { world.lightsRoot.remove(rig.group); disposeTree(rig.group); }
          rig = buildLightRig(s);
          rig.group.userData.pick = { kind: "light", id: s.id };
          world.lightsRoot.add(rig.group);
          lightRigs.set(s.id, rig);
        }
        const src = resolveSource(fixtureOf(s), s.modifierId, lightOutput(s, fixtureOf(s)), s.beamDeg, s.frame);
        const a = aimOf(s, sc);
        const t = s.aimAt ? targetPoint(s.aimAt, sc) : null;
        const dFix = t ? Math.max(0.3, t.distanceTo(new THREE.Vector3(s.x, s.y, s.z))) : 2;
        const d = Math.max(0.3, dFix - src.offsetM);
        const size = Math.max(src.sourceW, src.sourceH);
        const soft = apparentSizeDeg(size, d);
        const cast = s.on && shadows < 5;
        if (cast) shadows++;
        const lit = { ...src, candela: src.candela * nearFieldScale(size, d) };
        // The beam through a diffusion frame is its own light, at the fixture.
        let through: { candela: number; beamDeg: number; softDeg: number; cast: boolean } | null = null;
        if (src.through) {
          const castT = s.on && shadows < 5;
          if (castT) shadows++;
          through = {
            candela: src.through.candela * nearFieldScale(src.through.sizeM, dFix),
            beamDeg: src.through.beamDeg,
            softDeg: apparentSizeDeg(src.through.sizeM, dFix),
            cast: castT,
          };
        }
        updateLightRig(rig, s, a, lit, soft, cameraColorRgb(lightRgb(s.cct, fixtureOf(s).rgb ? s.color : null), wb), cast, through);
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
          rig.group.userData.pick = { kind: "grip", id: g.id };
          world.lightsRoot.add(rig.group);
          gripRigs.set(g.id, rig);
        }
        const gt = g.aimAt ? targetPoint(g.aimAt, sc) : null;
        const gd = gt ? Math.max(0.3, gt.distanceTo(new THREE.Vector3(g.x, g.y, g.z))) : 2;
        const cd = (levels.current.bounce.get(g.id) ?? 0) * nearFieldScale(g.sizeFt * FT, gd);
        updateGripRig(rig, g, aimOf(g, sc), cd, cameraColor(5600, wb));
      }
      for (const [id, rig] of gripRigs) {
        if (seen.has(id)) continue;
        world.lightsRoot.remove(rig.group);
        disposeTree(rig.group);
        gripRigs.delete(id);
      }

      // Daylight: the sky through each window, and the sun through the first.
      const sky = WINDOW_SKIES[L.win.sky];
      const roomOn = L.set.kind === "room";
      const tau = Math.pow(10, -L.win.nd) * (L.win.on && roomOn ? 1 : 0);
      const dayCol = cameraColor(WINDOW_CCT[L.win.sky], wb);
      for (const { info, light } of windowLights.current) {
        light.color.setRGB(...dayCol);
        light.intensity = sky.skyNits * info.area * tau;
      }
      for (const m of skies.current.values()) {
        m.emissive.setRGB(...dayCol);
        m.emissiveIntensity = sky.skyNits * tau + (L.win.on ? 0 : 30);
      }
      world.sun.color.setRGB(...cameraColor(5600, wb));
      world.sun.intensity = sunDir.current ? sky.sunLux * tau : 0;
      // Practicals: bare bulbs, the glass at the brightness it really has.
      for (const it of sc.items) {
        const lamp = itemObjs.current.get(it.id)?.group.userData.extras?.lamp as
          | { light: THREE.PointLight; bulb: THREE.MeshStandardMaterial } | undefined;
        if (!lamp) continue;
        const flux = lampFlux(it);
        const col = cameraColor(it.light?.cct ?? 2700, wb);
        lamp.light.color.setRGB(...col);
        lamp.light.intensity = flux / (4 * Math.PI);
        lamp.bulb.emissive.setRGB(...col);
        lamp.bulb.emissiveIntensity = flux / (4 * Math.PI * Math.PI * BULB_R * BULB_R);
      }
      // Room bounce: one averaged level, warm from the plaster and the floor.
      const room = levels.current.roomLux;
      world.bounce.color.setRGB(...cameraColor(5000, wb));
      world.bounce.intensity = room * 0.8;
      world.scene.environmentIntensity = (room * 0.2) / Math.PI;
    };

    // Puts every person and item where the scene says, this frame: a walker
    // takes the leg that is leading, and a held prop rides in the hand.
    const pose = (sc: Scene) => {
      for (const t of sc.talent) {
        const f = figs.current.get(t.id);
        if (!f) continue;
        const w = sc.walk.get(t.id);
        const walking = !!f.walk && !!w?.walking;
        const all = f.walk ? [f.base, ...f.walk] : [f.base];
        for (const g of all) {
          g.position.set(t.x, t.y ?? 0, t.z);
          g.rotation.y = rad(t.facing);
        }
        f.base.visible = !walking;
        if (f.walk) {
          const side = strideSide(w?.walked ?? 0);
          f.walk[0].visible = walking && side === 0;
          f.walk[1].visible = walking && side === 1;
        }
      }
      for (const it of sc.items) {
        const o = itemObjs.current.get(it.id);
        if (!o) continue;
        o.group.position.set(it.x, it.y ?? 0, it.z);
        o.group.rotation.y = rad(it.rot);
      }
    };

    engine.current = { renderer, world, shotCam, freeCam, controls, rt, quad, quadScene, quadCam, clayMat, lightRigs, gripRigs, syncRigs, pose, house };
    requeue(live.current.shots.map((s) => s.id));

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
      house.fill.intensity = 0;
      (world.scene.background as THREE.Color).copy(stageBg);
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
      u.focusM.value = effectiveFocus(s, poseRef.current);
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
      // The people and the props, as they are at this moment of the action.
      const sc = placeScene(L.talent, L.items, raw.move ? ease(raw.move.ease, t) : 0);
      poseRef.current = sc;
      pose(sc);
      const view = seenShot(raw, t, sc, L.drafts[raw.id], P.on);

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
        // House lights: an even, shadowless fill about 2/3 of a stop under this
        // shot's exposure, so the set reads at any stop. The meter never sees it.
        house.fill.intensity = L.houseLights ? HOUSE_LEVEL * luxForStop(fs.stop, fs.iso, fs.nd) : 0;
        (world.scene.background as THREE.Color).copy(L.houseLights ? houseBg : stageBg);
        const sp = gridSpacing(L.units);
        house.gridMat.uniforms.minor.value = sp.minor;
        house.gridMat.uniforms.major.value = sp.major;
        house.gridMat.uniforms.fadeM.value = Math.max(25, freeCam.position.distanceTo(controls.target) * 4);
        const marks: Marker[] = [];
        for (const l of L.lights) {
          const rig = lightRigs.get(l.id);
          if (rig) marks.push({ id: `l:${l.id}`, pos: rig.head.getWorldPosition(new THREE.Vector3()), color: "#ffc061", dim: !l.on });
        }
        for (const sh of L.shots) {
          marks.push({ id: `c:${sh.id}`, pos: new THREE.Vector3(sh.pos.x, sh.pos.y, sh.pos.z), color: "#7fa8ff", dim: sh.id !== L.activeId });
        }
        syncMarkers(house, marks);
        world.scene.overrideMaterial = L.clay ? clayMat : null;
        freeCam.aspect = size.x / size.y;
        freeCam.updateProjectionMatrix();
        renderer.render(world.scene, freeCam);
        // The grid and markers over it, against the scene's own depth.
        renderer.autoClear = false;
        renderer.render(house.aids, freeCam);
        renderer.autoClear = true;
        return;
      }
      // Fill thumbnails for shots not yet seen, one per frame, never mid-move:
      // a thumbnail render in a recorded frame would be a flash of another shot.
      const queued = P.on || P.rec ? undefined : captureQueue.current.shift();
      if (queued) {
        // "<id>#a" and "<id>#b" are the two ends of a move, for the frame cards.
        const [qid, end] = queued.split("#");
        const s = L.shots.find((x) => x.id === qid);
        if (s && !end) {
          renderShot(s);
          const url = grab(360);
          setThumbs((th) => ({ ...th, [queued]: url }));
        } else if (s && s.move) {
          // Posed as the action stands at that end, then put back.
          const at = end === "b" ? 1 : 0;
          const sq = placeScene(L.talent, L.items, at);
          poseRef.current = sq;
          pose(sq);
          renderShot(viewShot(s, at, sq));
          const url = grab(200);
          setThumbs((th) => ({ ...th, [queued]: url }));
          poseRef.current = sc;
          pose(sc);
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
        setThumbs((th) => ({ ...th, [s.id]: url }));
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      controls.dispose();
      rt.dispose();
      renderer.dispose();
      engine.current = null;
      // The set pieces were added to THIS engine's scene. A remount (React's
      // development double mount, a hot reload) makes a fresh, empty engine,
      // and a cache still holding the old groups would skip every piece as
      // already built, leaving the room bare.
      itemObjs.current.clear();
    };
  }, []);

  // ----- Canvas size follows the fitted box.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.renderer.setSize(box.w, box.h, false);
    dirty();
  }, [box.w, box.h]);

  // ----- Talent: rebuilt when anything about a person changes. Somebody with
  // a mark also gets a walking figure, one for each leg leading.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    for (const f of figs.current.values()) {
      for (const g of f.walk ? [f.base, ...f.walk] : [f.base]) { e.world.scene.remove(g); disposeTree(g); }
    }
    figs.current.clear();
    for (const t of talent) {
      // Seated: built from where they are placed, since the seat (a bed, a
      // sofa) and where the feet land decide the legs.
      const placed = scene.talent.find((x) => x.id === t.id);
      const base = buildFigure(t.pose === "seated" && placed ? { ...t, seatY: placed.seatY, footY: placed.footY } : t);
      base.userData.pick = { kind: "talent", id: t.id };
      e.world.scene.add(base);
      let walk: [THREE.Group, THREE.Group] | null = null;
      if (t.mark && t.pose !== "seated" && !(t.pose === "holding" && t.holding)) {
        const a = buildFigure({ ...t, pose: "walking" });
        const b = buildFigure({ ...t, pose: "walking" });
        b.scale.x = -1; // the other leg forward
        for (const g of [a, b]) {
          g.userData.pick = { kind: "talent", id: t.id };
          g.visible = false;
          e.world.scene.add(g);
        }
        walk = [a, b];
      }
      figs.current.set(t.id, { base, walk });
    }
    e.pose(scene);
    dirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talent, seatKey]);

  // ----- Assets: product photos and imported models, loaded once each.
  useEffect(() => {
    let alive = true;
    const bump = () => { if (alive) setAssetTick((n) => n + 1); };
    for (const it of items) {
      if (it.label && !art.current.has(it.label)) {
        const key = it.label;
        art.current.set(key, "loading");
        void (async () => {
          const a = await getAsset(key);
          if (!a) { art.current.set(key, "missing"); setSaveNote("A product photo this setup uses is not in this browser"); bump(); return; }
          await cacheArt(key, a.blob);
          bump();
        })();
      }
      if (it.model) {
        const ck = `${it.model.key}|${it.model.upZ}`;
        if (!models.current.has(ck)) {
          const m = it.model;
          models.current.set(ck, "loading");
          void (async () => {
            const a = await getAsset(m.key);
            if (!a) { models.current.set(ck, "missing"); setSaveNote(`${m.fileName} is not in this browser: open the setup file it came in`); bump(); return; }
            try {
              const obj = await loadModel(await a.blob.arrayBuffer(), m.fileName, m.upZ);
              const r = rawSize(obj);
              models.current.set(ck, { obj, raw: { x: r.x, y: r.y, z: r.z } });
            } catch (err) {
              models.current.set(ck, "missing");
              setSaveNote(err instanceof Error ? err.message : "Could not read that model");
            }
            bump();
          })();
        }
      }
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  /** Decodes a product photo for wrapping, with its average colour. */
  const cacheArt = async (key: string, blob: Blob, avg?: string) => {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("bad image"));
        i.src = url;
      });
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      let colour = avg;
      if (!colour) {
        const one = document.createElement("canvas");
        one.width = one.height = 1;
        one.getContext("2d")!.drawImage(c, 0, 0, 1, 1);
        const [r, g, b] = one.getContext("2d")!.getImageData(0, 0, 1, 1).data;
        colour = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      }
      art.current.set(key, { image: c, avg: colour, aspect: img.width / img.height });
    } catch {
      art.current.set(key, "missing");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  // ----- Items: rebuilt only when their shape changes; moving one is just a
  // new position, applied every frame by the loop.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const seen = new Set<string>();
    for (const it of items) {
      seen.add(it.id);
      const a = it.label ? art.current.get(it.label) : undefined;
      const artReady = !!a && typeof a === "object";
      const m = it.model ? models.current.get(`${it.model.key}|${it.model.upZ}`) : undefined;
      const modelReady = !!m && typeof m === "object";
      const key = itemShapeKey(it, artReady, modelReady);
      const prev = itemObjs.current.get(it.id);
      if (prev && prev.key === key) continue;
      if (prev) { e.world.itemsRoot.remove(prev.group); disposeTree(prev.group); }
      const g = buildItem(it, artReady ? (a as LabelArt) : null, modelReady ? (m as { obj: THREE.Object3D }).obj : null);
      g.userData.pick = { kind: "item", id: it.id };
      e.world.itemsRoot.add(g);
      itemObjs.current.set(it.id, { group: g, key });
    }
    for (const [id, o] of itemObjs.current) {
      if (seen.has(id)) continue;
      e.world.itemsRoot.remove(o.group);
      disposeTree(o.group);
      itemObjs.current.delete(id);
    }
    e.pose(poseRef.current);
    dirty();
  }, [items, assetTick]);

  // ----- The room: its shell, the daylight from outside each window, the sun.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const W = e.world;
    W.stage.visible = set.kind === "stage";
    clearGroup(W.roomRoot);
    clearGroup(W.windowsRoot);
    windowLights.current = [];
    skies.current = new Map();
    sunDir.current = null;
    if (set.kind === "room") {
      const built = buildRoom(set.room);
      W.roomRoot.add(built.group);
      skies.current = built.skies;
      // Each window's sky source sits OUTSIDE the wall, so the wall itself
      // shapes the patch of light on the floor the way a real window does.
      roomWindows(set.room).forEach((info, i) => {
        const l = new THREE.SpotLight("#ffffff", 0, 0, rad(89), 1, 2);
        l.position.copy(info.centre).addScaledVector(info.inward, -0.35);
        l.target.position.copy(info.centre).addScaledVector(info.inward, 3).add(new THREE.Vector3(0, -0.4, 0));
        l.castShadow = i < 2;
        l.shadow.mapSize.set(1024, 1024);
        l.shadow.camera.near = 0.1;
        l.shadow.camera.far = 30;
        l.shadow.bias = -0.0006;
        l.shadow.radius = 18;
        l.shadow.blurSamples = 16;
        W.windowsRoot.add(l, l.target);
        windowLights.current.push({ info, light: l });
      });
      const dir = sunDirection(roomWindows(set.room));
      sunDir.current = dir;
      const r = set.room;
      const mid = new THREE.Vector3(r.x + r.width / 2, 0.7, r.z + r.depth / 2);
      if (dir) {
        W.sun.target.position.copy(mid);
        W.sun.position.copy(mid).addScaledVector(dir, 14);
        const half = Math.max(r.width, r.depth) / 2 + 1;
        const cam = W.sun.shadow.camera;
        cam.left = -half;
        cam.right = half;
        cam.top = half;
        cam.bottom = -half;
        cam.updateProjectionMatrix();
      }
    }
    dirty();
    requeue(live.current.shots.map((x) => x.id));
  }, [set]);

  // A different shot starts at its own start frame.
  useEffect(() => {
    finishRef.current(0);
    setPlayhead(0);
  }, [activeId]);

  // ----- The light meter. Runs when anything that moves light changes, not
  // every frame, because it casts shadow rays. It also works out what each
  // bounce board throws back and the room bounce, which the renderer reads.
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const t = window.setTimeout(() => {
      const s = seenShot(shots.find((x) => x.id === activeId) ?? shots[0], playhead, scene, drafts[activeId], playing);
      poseRef.current = scene;
      e.pose(scene);
      e.syncRigs(s.wb);
      e.world.scene.updateMatrixWorld(true);
      const occ = collectOccluders(e.world.scene);
      const roomOn = set.kind === "room";
      const ws = roomOn ? windows : [];
      const emitters = buildEmitters(lights, win, scene, ws);
      const tau = win.on && roomOn ? Math.pow(10, -win.nd) : 0;
      const sunLux = WINDOW_SKIES[win.sky].sunLux * tau;
      const dir = roomOn ? sunDirection(ws) : null;
      const sun = sunLux > 0 && dir ? { dir, lux: sunLux, label: "Sun through the window" } : null;
      const boards: Board[] = grips.map((g) => {
        const a = aimOf(g, scene);
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
      const flux = emitters.reduce((n, x) => n + x.flux, 0) + (sun ? sunLux * (ws[0]?.area ?? 0) * 0.8 : 0);
      // A stage has black walls a long way off: far less comes back than in a
      // plaster room, and most of what does is off the paper.
      const roomLux = roomLuxFrom(flux) * (roomOn ? 1 : 0.35);
      levels.current = { bounce, roomLux };
      const p = meterPoint(s, scene);
      setMeter(readMeter(p, new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z), all, occ, sun, roomLux));
    }, 40);
    return () => window.clearTimeout(t);
  }, [shots, activeId, lights, grips, win, scene, set, windows, playhead, assetTick, drafts, playing]);

  // Light and the set change every shot, so every thumbnail is stale (once it settles).
  useEffect(() => {
    const t = window.setTimeout(() => {
      requeue(live.current.shots.map((x) => x.id).filter((id) => id !== live.current.activeId));
      dirty();
    }, 400);
    return () => window.clearTimeout(t);
  }, [lights, grips, win, set, talent, items, assetTick]);

  // The frame cards on the timeline: both ends of the active shot's move,
  // retaken once things settle after anything that changes what they show.
  useEffect(() => {
    if (!rawActive.move) return;
    const t = window.setTimeout(() => {
      const q = captureQueue.current;
      for (const k of [`${rawActive.id}#a`, `${rawActive.id}#b`]) if (!q.includes(k)) q.push(k);
    }, 350);
    return () => window.clearTimeout(t);
  }, [rawActive, lights, grips, win, set, talent, items, aspectId, clay, assetTick]);

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
      effectiveFocus(at, poseRef.current),
      `${s.code} ${Math.round(at.focal)}mm`,
      s.bodyId,
      at.focal,
    );
    const unit = new THREE.Group();
    unit.name = `unit:${s.id}`;
    unit.userData.pick = { kind: "camera", id: s.id };
    unit.position.set(at.pos.x, 0, at.pos.z);
    const sp = supportPose(s, at.pos, { yaw: at.yaw, pitch: at.pitch });
    const legs = buildSupport(s.support, at.pos.y, bodyDrop(s.bodyId), sp.opts);
    const bar = rig.getObjectByName("panbar");
    if (bar) bar.visible = s.support !== "robot";
    if (s.support === "robot" && sp.opts.mount !== "over") {
      // Underslung: the top handle comes off and the spacer and 6th axis sit
      // on the camera's top plate, panning and tilting with it.
      const handle = rig.getObjectByName("tophandle");
      if (handle) handle.visible = false;
      rig.add(buildUnderslungMount(s.bodyId).group);
    }
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
    clearGroup(e.world.rigs);
    for (const s of shots) {
      const at = s.id === activeId ? seenShot(s, playhead, scene, drafts[s.id], playing) : s;
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
  }, [shots, activeId, aspect.ratio, scene, playhead, drafts, playing]);

  useEffect(() => {
    const e = engine.current;
    if (e) e.controls.enabled = view === "free";
  }, [view]);

  useEffect(() => {
    // Everything re-renders at the new aspect, so every thumbnail is stale.
    requeue(shots.map((s) => s.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectId, clay]);

  // ----- Through-the-lens controls: drag pans and tilts like a fluid head,
  // shift or right drag trucks and booms, the wheel dollies. Long lenses move
  // slower per pixel, because they would on a real head. A click that does not
  // drag selects whatever is under it, in either view.
  const drag = useRef<{ x: number; y: number; mode: "pan" | "truck" } | null>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const onCanvasDown = (e: React.PointerEvent) => {
    press.current = { x: e.clientX, y: e.clientY };
    if (view !== "lens") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, mode: e.button === 2 || e.shiftKey ? "truck" : "pan" };
  };
  const onCanvasMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || view !== "lens") return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    if (sel.kind !== "camera" && press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 4) setSel({ kind: "camera" });
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
  const onCanvasUp = (e: React.PointerEvent) => {
    drag.current = null;
    const p = press.current;
    press.current = null;
    if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) return;
    // Through the lens is for framing only: a click there never picks
    // anything up, so a stray press cannot select the talent mid-pan.
    if (view === "free") pickAt(e.clientX, e.clientY);
  };
  const ray = useMemo(() => {
    const r = new THREE.Raycaster();
    // three.js lets a LINE catch a ray up to one world unit away by default,
    // so every camera's frustum lines (which run straight through the set)
    // swallowed presses meant for the person standing inside them.
    r.params.Line = { threshold: 0.03 };
    r.params.Points = { threshold: 0.03 };
    return r;
  }, []);
  /** What is under the cursor in the view being shown, and where it was hit. */
  const hitAt = (cx: number, cy: number): { pick: { kind: string; id: string }; point: THREE.Vector3 } | null => {
    const e = engine.current;
    const canvas = canvasRef.current;
    if (!e || !canvas) return null;
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, view === "lens" ? e.shotCam : e.freeCam);
    const roots: THREE.Object3D[] = [e.world.itemsRoot, e.world.lightsRoot, ...Array.from(figs.current.values()).flatMap((f) => (f.walk ? [f.base, ...f.walk] : [f.base]))];
    if (view === "free") roots.push(e.world.rigs);
    for (const hit of ray.intersectObjects(roots, true)) {
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.pick) o = o.parent;
      if (!o || !o.visible) continue;
      return { pick: o.userData.pick as { kind: string; id: string }, point: hit.point.clone() };
    }
    return null;
  };
  const pickAt = (cx: number, cy: number) => {
    const found = hitAt(cx, cy);
    if (found) {
      const pk = found.pick;
      if (pk.kind === "item") setSel({ kind: "item", id: pk.id });
      else if (pk.kind === "talent") setSel({ kind: "talent", id: pk.id });
      else if (pk.kind === "light") setSel({ kind: "light", id: pk.id });
      else if (pk.kind === "grip") setSel({ kind: "grip", id: pk.id });
      else if (pk.kind === "camera") { setActiveId(pk.id); setSel({ kind: "camera" }); }
      return;
    }
    if (view === "lens") setSel({ kind: "camera" });
  };

  // ----- Free view: press on a thing and drag to slide it across the floor,
  // shift-drag to raise or lower it. Pressing empty space still orbits.
  // This runs as a native CAPTURE listener on the canvas so it is heard
  // before OrbitControls' own pointerdown, and can stop the orbit starting
  // when the press lands on something movable.
  const movable = (kind: string) => kind === "item" || kind === "talent" || kind === "light" || kind === "grip";
  const live3d = useRef({ hitAt, scene, lights, grips, items });
  live3d.current = { hitAt, scene, lights, grips, items };
  const moveDrag = useRef<{
    kind: string; id: string; start: THREE.Vector3; x: number; z: number;
    lastX: number; lastY: number; lift: boolean;
  } | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || view !== "free") return;
    // Metres per screen pixel at the thing's own distance. Projecting the
    // cursor onto a plane through the grab point was tried first and is
    // wrong from a high camera: grab the top of a tall backdrop and the plane
    // is nearly edge-on, so a short drag threw it three metres.
    const metresPerPixel = (at: THREE.Vector3) => {
      const e = engine.current;
      if (!e) return 0;
      const dist = e.freeCam.position.distanceTo(at);
      return (2 * Math.tan(rad(e.freeCam.fov / 2)) * dist) / Math.max(1, canvas.clientHeight);
    };
    const baseOf = (kind: string, id: string): { x: number; z: number; y: number } | null => {
      const L = live3d.current;
      if (kind === "item") { const i = L.scene.items.find((o) => o.id === id); return i ? { x: i.x, z: i.z, y: i.raise ?? 0 } : null; }
      if (kind === "talent") { const t = L.scene.talent.find((o) => o.id === id); return t ? { x: t.x, z: t.z, y: 0 } : null; }
      if (kind === "light") { const l = L.lights.find((o) => o.id === id); return l ? { x: l.x, z: l.z, y: l.y } : null; }
      if (kind === "grip") { const g = L.grips.find((o) => o.id === id); return g ? { x: g.x, z: g.z, y: g.y } : null; }
      return null;
    };
    const down = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      const found = live3d.current.hitAt(ev.clientX, ev.clientY);
      if (!found || !movable(found.pick.kind)) return;
      const base = baseOf(found.pick.kind, found.pick.id);
      if (!base) return;
      // Ours, not the orbit's.
      ev.stopImmediatePropagation();
      ev.preventDefault();
      canvas.setPointerCapture(ev.pointerId);
      moveDrag.current = {
        kind: found.pick.kind, id: found.pick.id, start: found.point, x: base.x, z: base.z,
        lastX: ev.clientX, lastY: ev.clientY, lift: ev.shiftKey,
      };
      const pk = found.pick;
      setSel(pk.kind === "item" ? { kind: "item", id: pk.id } : pk.kind === "talent" ? { kind: "talent", id: pk.id } : pk.kind === "light" ? { kind: "light", id: pk.id } : { kind: "grip", id: pk.id });
      canvas.style.cursor = "grabbing";
    };
    const move = (ev: PointerEvent) => {
      const d = moveDrag.current;
      if (!d) {
        // Hover: say what a press would do.
        const found = live3d.current.hitAt(ev.clientX, ev.clientY);
        canvas.style.cursor = found && movable(found.pick.kind) ? "grab" : "";
        return;
      }
      ev.stopImmediatePropagation();
      const e = engine.current;
      if (!e) return;
      const mpp = metresPerPixel(d.start);
      const px = ev.clientX - d.lastX;
      const py = ev.clientY - d.lastY;
      d.lastX = ev.clientX;
      d.lastY = ev.clientY;
      if (d.lift || ev.shiftKey) {
        const dh = -py * mpp;
        if (d.kind === "item") setItems((all) => all.map((i) => (i.id === d.id ? { ...i, raise: Math.max(0, Math.min(12, (i.raise ?? catalogOf(i.kind).raise ?? 0) + dh)) } : i)));
        else if (d.kind === "light") setLights((all) => all.map((l) => (l.id === d.id ? snapHung({ ...l, y: Math.max(0.15, Math.min(8, l.y + dh)) }, live.current.items) : l)));
        else if (d.kind === "grip") setGrips((all) => all.map((g) => (g.id === d.id ? { ...g, y: Math.max(0.15, Math.min(8, g.y + dh)) } : g)));
        return;
      }
      // Across the screen is the camera's right; up the screen is away from
      // the camera along the floor, stretched for how steeply the camera
      // looks down (capped, so a near-overhead view does not race).
      const dir = e.freeCam.getWorldDirection(new THREE.Vector3());
      const fwd = new THREE.Vector3(dir.x, 0, dir.z);
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
      fwd.normalize();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const stretch = 1 / Math.max(0.35, Math.abs(dir.y));
      d.x += (right.x * px - fwd.x * py * stretch) * mpp;
      d.z += (right.z * px - fwd.z * py * stretch) * mpp;
      d.start.x += (right.x * px - fwd.x * py * stretch) * mpp;
      d.start.z += (right.z * px - fwd.z * py * stretch) * mpp;
      const { x, z } = d;
      if (d.kind === "item") {
        setItems((all) => all.map((i) => (i.id === d.id ? { ...i, x, z } : i)));
        // Picking up something held takes it out of the hand, as on the map.
        if (live3d.current.scene.items.find((i) => i.id === d.id)?.heldBy) setTalent((all) => all.map((t) => (t.holding === d.id ? { ...t, holding: null } : t)));
      } else if (d.kind === "talent") setTalent((all) => all.map((t) => (t.id === d.id ? { ...t, x, z } : t)));
      else if (d.kind === "light") setLights((all) => all.map((l) => (l.id === d.id ? snapHung({ ...l, x, z }, live.current.items) : l)));
      else if (d.kind === "grip") setGrips((all) => all.map((g) => (g.id === d.id ? { ...g, x, z } : g)));
    };
    const up = (ev: PointerEvent) => {
      if (!moveDrag.current) return;
      ev.stopImmediatePropagation();
      moveDrag.current = null;
      if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerdown", down, { capture: true });
    canvas.addEventListener("pointermove", move, { capture: true });
    canvas.addEventListener("pointerup", up, { capture: true });
    canvas.addEventListener("pointercancel", up, { capture: true });
    return () => {
      canvas.removeEventListener("pointerdown", down, { capture: true });
      canvas.removeEventListener("pointermove", move, { capture: true });
      canvas.removeEventListener("pointerup", up, { capture: true });
      canvas.removeEventListener("pointercancel", up, { capture: true });
      canvas.style.cursor = "";
      moveDrag.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  // The wheel and a trackpad pinch dolly the lens. A Mac pinch arrives as a
  // wheel event with ctrlKey set, and the browser zooms the WHOLE PAGE unless
  // the event is cancelled, which React's onWheel cannot do (it is passive).
  // So this is a native, non-passive listener on the whole stage: the frame,
  // the margins round it and the map all keep a pinch to themselves.
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    const onCanvas = e.target === canvasRef.current;
    const onMap = (e.target as Element | null)?.closest?.("[data-previz-map]");
    if (view === "free") {
      // OrbitControls zooms (and cancels) on the canvas itself; elsewhere on
      // the stage only the page zoom needs stopping.
      if (!onCanvas && e.ctrlKey) e.preventDefault();
      return;
    }
    if (onMap) {
      if (e.ctrlKey) e.preventDefault();
      return;
    }
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dy = e.deltaY * scale;
    // A pinch sends small deltas many times a second; a mouse notch sends one big one.
    const rate = e.ctrlKey ? 0.012 : 0.002;
    const step = -Math.sign(dy) * Math.min(0.25, Math.abs(dy) * rate) * Math.max(1, focus * 0.5);
    if (!step) return;
    const f = forward(active.yaw, active.pitch);
    updateShot(active.id, (s) => ({ pos: { x: s.pos.x + f.x * step, y: Math.max(0.1, s.pos.y + f.y * step), z: s.pos.z + f.z * step } }));
  };
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => wheelRef.current(e);
    // Safari also fires its own gesture events for a pinch and zooms the page from them.
    const gesture = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("gesturestart", gesture);
    el.addEventListener("gesturechange", gesture);
    return () => {
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("gesturestart", gesture);
      el.removeEventListener("gesturechange", gesture);
    };
  }, []);

  // Frame everything: free view backs off until every set piece, person,
  // light and camera is in shot. The stage floor is left out, since it is
  // effectively endless and would frame a void.
  const frameAll = () => {
    const e = engine.current;
    if (!e) return;
    const box = new THREE.Box3();
    const roots: THREE.Object3D[] = [e.world.itemsRoot, e.world.lightsRoot, e.world.roomRoot, ...Array.from(figs.current.values()).map((f) => f.base)];
    for (const r of roots) box.expandByObject(r);
    for (const s of shots) box.expandByPoint(new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z));
    const to = frameBox(box, e.freeCam, e.controls.target);
    if (!to) return;
    e.freeCam.position.copy(to.pos);
    e.controls.target.copy(to.target);
    e.controls.update();
    setView("free");
  };

  // Keyboard: works anywhere on the page except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "d") {
        if (sel.kind === "item") { e.preventDefault(); duplicateItem(sel.id); }
        return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (k === "v") return setView((v) => (v === "lens" ? "free" : "lens"));
      if (k === "c") return setClay((c) => !c);
      if (k === "h") return setHouseLights((h) => !h);
      if (k === "f") return frameAll();
      if (k === "b") return setShowBoard((b) => !b);
      if (k === "?") return setHelp((h) => !h);
      if (k === "z") return setZebra((z) => !z);
      if (e.key === "\\") return setFocusMode((f) => !f);
      if (e.key === "Escape" && focusMode) return setFocusMode(false);
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
  }, [view, active, shots, updateShot, sel, items, focusMode]);

  // ----- Readouts
  const hfov = fovDeg(area.w, active.focal);
  const vfov = fovDeg(area.h, active.focal);
  const dof = dofLimits(active.focal, active.stop, focus, circleOfConfusion(body));
  const frameH = (area.h * focus) / active.focal;
  const size = shotSize(frameH);
  const angle = cameraAngle(active.pitch, active.pos.y);
  const focusName = targetName(active.focusOn, scene);

  // ----- Lights and grip. Letting go of a target keeps the head where it was
  // pointing, so "by hand" starts from the current aim, not from zero.
  const updateLight = (id: string, patch: Partial<LightSpec>) =>
    setLights((all) => all.map((l) => {
      if (l.id !== id) return l;
      const next = { ...l, ...patch };
      if (patch.aimAt === null && l.aimAt) Object.assign(next, aimOf(l, scene));
      // Going up onto a rig starts it a couple of feet under the pipe.
      const rig = patch.hangFrom ? items.find((i) => i.id === patch.hangFrom) : null;
      if (rig && !settleHung(l, items).hungY) next.y = rigHeight(rig) - 0.6;
      if (patch.fixtureId && patch.fixtureId !== l.fixtureId) {
        const f = FIXTURES.find((x) => x.id === patch.fixtureId) ?? FIXTURES[0];
        next.modifierId = f.defaultModifier;
        next.cct = f.cctDefault;
        next.beamDeg = null;
        if (!f.rgb) next.color = null;
      }
      return snapHung(next, items);
    }));
  const updateGrip = (id: string, patch: Partial<GripSpec>) =>
    setGrips((all) => all.map((g) => {
      if (g.id !== id) return g;
      const next = { ...g, ...patch };
      if (patch.aimAt === null && g.aimAt) Object.assign(next, aimOf(g, scene));
      return next;
    }));
  // ----- Controller pads (components/previz/move-pad.tsx). Each act is handed
  // seconds at the chosen speed; these are the rates per second at Normal.
  const PAD_M = 0.4; // metres a second
  const PAD_DEG = 15; // degrees a second
  const PAD_ZOOM = 0.6; // focal length grows by e^0.6 a second
  const camPads = (id: string): PadSpec[] => {
    const mv = (fn: (s: Shot) => Partial<Shot>) => updateShot(id, fn);
    const slide = (t: number, side: number, fwd: number) => mv((s) => {
      const y = rad(s.yaw);
      const m = PAD_M * t;
      return { pos: { x: s.pos.x + (Math.cos(y) * side - Math.sin(y) * fwd) * m, y: s.pos.y, z: s.pos.z + (-Math.sin(y) * side - Math.cos(y) * fwd) * m } };
    });
    const boom = (t: number) => mv((s) => ({ pos: { ...s.pos, y: Math.max(0.1, Math.min(6, s.pos.y + PAD_M * t)) } }));
    return [
      {
        title: "Move",
        up: { label: "Boom up", act: (t) => boom(t) },
        down: { label: "Boom down", act: (t) => boom(-t) },
        left: { label: "Truck left", act: (t) => slide(t, -1, 0) },
        right: { label: "Truck right", act: (t) => slide(t, 1, 0) },
        outerUp: { label: "Push in", act: (t) => slide(t, 0, 1) },
        outerDown: { label: "Pull out", act: (t) => slide(t, 0, -1) },
      },
      {
        title: "Aim",
        up: { label: "Tilt up", act: (t) => mv((s) => ({ pitch: Math.min(80, s.pitch + PAD_DEG * t) })) },
        down: { label: "Tilt down", act: (t) => mv((s) => ({ pitch: Math.max(-89, s.pitch - PAD_DEG * t) })) },
        left: { label: "Pan left", act: (t) => mv((s) => ({ yaw: s.yaw + PAD_DEG * t })) },
        right: { label: "Pan right", act: (t) => mv((s) => ({ yaw: s.yaw - PAD_DEG * t })) },
        outerUp: { label: "Zoom in (longer lens)", act: (t) => mv((s) => ({ focal: Math.min(200, s.focal * Math.exp(PAD_ZOOM * t)) })) },
        outerDown: { label: "Zoom out (wider lens)", act: (t) => mv((s) => ({ focal: Math.max(12, s.focal * Math.exp(-PAD_ZOOM * t)) })) },
      },
    ];
  };
  /**
   * Pads for a light or a board, moved as if standing behind it: in is toward
   * where it points, left and right are its own. Turning the head lets go of a
   * target, starting from where it was pointing, the same rule as the
   * inspector's "By hand".
   */
  const fixturePads = (kind: "light" | "grip", id: string): PadSpec[] => {
    type P = LightSpec | GripSpec;
    const apply = (fn: (p: P, a: { yaw: number; pitch: number }) => Partial<P>) => {
      const sc = live3d.current.scene;
      const step = <T extends P>(p: T): T => {
        const a = aimOf(p, sc);
        return { ...p, ...fn(p, a) } as T;
      };
      if (kind === "light") setLights((all) => all.map((l) => (l.id === id ? snapHung(step(l), live.current.items) : l)));
      else setGrips((all) => all.map((g) => (g.id === id ? step(g) : g)));
    };
    const slide = (t: number, side: number, fwd: number) => apply((p, a) => {
      const y = rad(a.yaw);
      const m = PAD_M * t;
      return { x: p.x + (Math.cos(y) * side - Math.sin(y) * fwd) * m, z: p.z + (-Math.sin(y) * side - Math.cos(y) * fwd) * m };
    });
    const raise = (t: number) => apply((p) => ({ y: Math.max(0.15, Math.min(8, p.y + PAD_M * t)) }));
    const turn = (dYaw: number, dPitch: number) => apply((_p, a) => ({
      aimAt: null, yaw: a.yaw + dYaw, pitch: Math.max(-89, Math.min(89, a.pitch + dPitch)),
    }));
    return [
      {
        title: "Move",
        up: { label: kind === "light" ? "Raise the light" : "Raise the board", act: (t) => raise(t) },
        down: { label: kind === "light" ? "Lower the light" : "Lower the board", act: (t) => raise(-t) },
        left: { label: "Slide left", act: (t) => slide(t, -1, 0) },
        right: { label: "Slide right", act: (t) => slide(t, 1, 0) },
        outerUp: { label: "Bring it in", act: (t) => slide(t, 0, 1) },
        outerDown: { label: "Back it off", act: (t) => slide(t, 0, -1) },
      },
      {
        title: "Aim",
        up: { label: "Tilt up", act: (t) => turn(0, PAD_DEG * t) },
        down: { label: "Tilt down", act: (t) => turn(0, -PAD_DEG * t) },
        left: { label: "Pan left", act: (t) => turn(PAD_DEG * t, 0) },
        right: { label: "Pan right", act: (t) => turn(-PAD_DEG * t, 0) },
      },
    ];
  };
  const subjectId = active.focusOn ?? talent[0]?.id ?? null;
  const subjectAt = meterPoint(active, scene);
  const occupied = [
    ...talent, ...lights, ...grips, ...shots.map((x) => ({ x: x.pos.x, z: x.pos.z })),
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
  /**
   * A lamp OUTSIDE a window, lighting the subject through it: how most day
   * interiors are really lit, rather than leaving it to the weather. An M18
   * a few metres out, aimed in and kept on the subject; the soft versions
   * put a frame of diffusion just outside the glass.
   */
  const addWindowLight = (windowId: string, style: WindowLightStyle) => {
    const w = windows.find((x) => x.id === windowId);
    if (!w) return;
    const id = `l${Date.now()}`;
    const f = FIXTURES.find((x) => x.id === "m18") ?? FIXTURES[0];
    const at = throughWindow(w, subjectAt, style === "hard" ? 4 : 3);
    const frame = style === "hard" ? null
      : { sizeFt: style === "soft20" ? 20 : 12, materialId: style === "soft20" ? "full-grid" : "half-grid", distM: at.frameDistM };
    const spec: LightSpec = {
      id, role: "Window", fixtureId: f.id, modifierId: "reflector", beamDeg: null, dimmer: style === "hard" ? 0.5 : 1,
      cct: f.cctDefault, x: at.x, y: at.y, z: at.z, yaw: 0, pitch: 0, aimAt: subjectId, frame, on: true,
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

  // ----- Items on the set
  /**
   * Where a new thing goes, facing the camera: a prop by the subject (it lands
   * on whatever they are at), a backdrop behind them, anything else beside
   * them. Nudged along if something the same size is already there.
   */
  const placeFor = (kind: string): { x: number; z: number; rot: number } => {
    const c = catalogOf(kind);
    const f = forward(active.yaw, 0);
    const right = { x: Math.cos(rad(active.yaw)), z: -Math.sin(rad(active.yaw)) };
    const rot = Math.round(deg(Math.atan2(-f.x, -f.z)) / 15) * 15;
    let p: { x: number; z: number };
    if (c.category === "prop") p = { x: subjectAt.x - f.x * 0.25, z: subjectAt.z - f.z * 0.25 };
    else if (c.category === "backdrop") p = { x: subjectAt.x + f.x * (c.d / 2 + 1.6), z: subjectAt.z + f.z * (c.d / 2 + 1.6) };
    else p = { x: subjectAt.x + right.x * (c.w / 2 + 0.8), z: subjectAt.z + right.z * (c.w / 2 + 0.8) };
    // A prop is meant to land on whatever is there (that is how it gets onto
    // a table). Anything else must not land on another piece, or the stacking
    // puts the new sofa on top of the table already standing there.
    const reach = (o: { w: number; d: number }) => Math.max(o.w, o.d) / 2;
    const rb = set.kind === "room" ? roomBounds(set.room) : null;
    const outside = (q: { x: number; z: number }) =>
      !!rb && c.category !== "backdrop" &&
      (q.x - reach(c) < rb.minX || q.x + reach(c) > rb.maxX || q.z - reach(c) < rb.minZ || q.z + reach(c) > rb.maxZ);
    const clash = (q: { x: number; z: number }) => outside(q) || items.some((o) => {
      const oc = catalogOf(o.kind).category;
      if (c.category === "prop") return o.kind === kind && Math.hypot(o.x - q.x, o.z - q.z) < Math.max(0.12, c.w * 0.6);
      if (oc === "prop" || oc === "backdrop" || o.kind === "rug") return false;
      if (c.category === "backdrop") return false;
      return Math.hypot(o.x - q.x, o.z - q.z) < (reach(o) + reach(c)) * 0.85;
    });
    const start = p;
    const step = Math.max(0.3, reach(c) * 2 + 0.15);
    for (let i = 1; i <= 16 && clash(p); i++) {
      // Walk out to the right, then the left, then further back.
      const side = i % 2 ? 1 : -1;
      const n = Math.ceil(i / 2);
      const back = Math.floor((n - 1) / 4);
      const along = ((n - 1) % 4) + 1;
      p = {
        x: start.x + right.x * side * step * along + f.x * back * step,
        z: start.z + right.z * side * step * along + f.z * back * step,
      };
    }
    // Nowhere free inside the walls: fall back to the first spot, clamped in.
    if (clash(p)) {
      p = start;
      if (rb) p = { x: Math.min(rb.maxX - reach(c), Math.max(rb.minX + reach(c), p.x)), z: Math.min(rb.maxZ - reach(c), Math.max(rb.minZ + reach(c), p.z)) };
    }
    return { ...p, rot };
  };
  /**
   * A grid fills the room under its ceiling (or hangs 16 ft over an open
   * stage, centred on `near`); a spreader or a polecat runs across the frame
   * through `near`, wall to wall when there are walls, just under the ceiling.
   */
  const rigFor = (kind: RigKind, near: { x: number; z: number }): ItemSpec => {
    const it = newItem(kind, near.x, near.z);
    const room = set.kind === "room" ? set.room : null;
    if (kind === "grid") {
      if (room) {
        const b = roomBounds(room);
        return { ...it, x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, w: room.width - 0.2, d: room.depth - 0.2, raise: room.height - 0.25 };
      }
      return it;
    }
    // Across the frame: the item's length runs along the camera's left-right.
    const rot = Math.round(active.yaw / 90) * 90;
    let next: ItemSpec = { ...it, rot };
    if (room) {
      next.raise = Math.max(1.5, room.height - 0.3);
      // Run it between two real walls: across the frame if both ends land on
      // walls, else the other way, else across the frame anyway (it warns).
      const b = roomBounds(room);
      const across = wallToWall(next, b, room.walls);
      const turned = wallToWall({ ...next, rot: rot + 90 }, b, room.walls);
      if (across?.open.length && turned && !turned.open.length) next.rot = rot + 90;
      const span = wallToWall(next, b, room.walls);
      if (span) next = { ...next, x: span.x, z: span.z, w: kind === "polecat" ? Math.min(span.w, POLECAT_MAX) : span.w };
    }
    return next;
  };
  const addItem = (kind: string) => {
    if (isRig(kind)) {
      const it = rigFor(kind, subjectAt);
      setItems((all) => [...all, it]);
      setSel({ kind: "item", id: it.id });
      setAdding(false);
      return;
    }
    const at = placeFor(kind);
    const it = { ...newItem(kind, at.x, at.z), rot: at.rot };
    setItems((all) => [...all, it]);
    setSel({ kind: "item", id: it.id });
    setAdding(false);
  };
  /** Adds a rig over a light and hangs the light from it, in one go. */
  const hangOnNew = (lightId: string, kind: RigKind) => {
    const l = lights.find((x) => x.id === lightId);
    if (!l) return;
    const rig = rigFor(kind, { x: l.x, z: l.z });
    const all = [...items, rig];
    setItems(all);
    setLights((ls) => ls.map((x) => (x.id === lightId ? snapHung({ ...x, hangFrom: rig.id, y: rigHeight(rig) - 0.6 }, all) : x)));
  };
  const updateItem = (id: string, p: Partial<ItemSpec>) => setItems((all) => all.map((i) => (i.id === id ? { ...i, ...p } : i)));
  // Lights hung from a rig go with it when it moves.
  const rigAt = useRef(new Map<string, { x: number; z: number }>());
  useEffect(() => {
    const moved = new Map<string, { dx: number; dz: number }>();
    const now = new Map<string, { x: number; z: number }>();
    for (const i of items) {
      if (!isRig(i.kind)) continue;
      now.set(i.id, { x: i.x, z: i.z });
      const was = rigAt.current.get(i.id);
      if (was && (Math.abs(was.x - i.x) > 1e-6 || Math.abs(was.z - i.z) > 1e-6)) moved.set(i.id, { dx: i.x - was.x, dz: i.z - was.z });
    }
    rigAt.current = now;
    if (moved.size) {
      setLights((ls) => ls.map((l) => {
        const m = l.hangFrom ? moved.get(l.hangFrom) : undefined;
        return m ? snapHung({ ...l, x: l.x + m.dx, z: l.z + m.dz }, items) : l;
      }));
    }
  }, [items]);
  const removeItem = (id: string) => {
    // Taking a rig down puts what hung from it back on stands, where it was.
    setLights((ls) => ls.map((l) => (l.hangFrom === id ? { ...l, hangFrom: null } : l)));
    setItems((all) => all.filter((i) => i.id !== id));
    setTalent((all) => all.map((t) => (t.holding === id ? { ...t, holding: null } : t)));
    if (sel.kind === "item" && sel.id === id) setSel({ kind: "camera" });
  };
  const duplicateItem = (id: string) => {
    const src = items.find((i) => i.id === id);
    if (!src) return;
    const r = rad(src.rot);
    const step = src.w + 0.15;
    const copy: ItemSpec = { ...src, id: newItem(src.kind, 0, 0).id, x: src.x + Math.cos(r) * step, z: src.z - Math.sin(r) * step };
    setItems((all) => [...all, copy]);
    setSel({ kind: "item", id: copy.id });
  };
  /** Puts an item in somebody's hand (and takes it from whoever had it), or sets it down. */
  const holdItem = (itemId: string, talentId: string | null) =>
    setTalent((all) => all.map((t) => {
      if (t.id === talentId) return { ...t, pose: "holding", holding: itemId };
      return t.holding === itemId ? { ...t, holding: null } : t;
    }));
  const addProduct = async (shape: string, file: File) => {
    setAdding(false);
    try {
      const p = await prepareLabel(file);
      const key = await putAsset(p.blob, file.name);
      await cacheArt(key, p.blob, p.avg);
      const c = catalogOf(shape);
      const at = placeFor(shape);
      // A round product photographed wider than it is tall is almost always a
      // photo with room round it, not a product that shape: cap it so a
      // landscape snapshot does not make a bottle as fat as a bucket.
      const w = Math.max(0.02, c.h * Math.min(c.round ? 0.9 : 2.5, Math.max(0.12, p.aspect)));
      const it: ItemSpec = {
        ...newItem(shape, at.x, at.z), rot: at.rot, label: key,
        name: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 40) || c.name,
        ...(c.round ? { w, d: w } : { w }),
      };
      setItems((all) => [...all, it]);
      setSel({ kind: "item", id: it.id });
      setSaveNote("Product added. Set its real height: the width follows the photo.");
    } catch (e) {
      setSaveNote(e instanceof Error ? e.message : "Could not use that photo");
    }
  };
  const setItemLabel = async (id: string, file: File) => {
    try {
      const p = await prepareLabel(file);
      const key = await putAsset(p.blob, file.name);
      await cacheArt(key, p.blob, p.avg);
      updateItem(id, { label: key });
    } catch (e) {
      setSaveNote(e instanceof Error ? e.message : "Could not use that photo");
    }
  };
  const importModel = async (file: File) => {
    setAdding(false);
    const fmt = modelFormat(file.name);
    if (!fmt) return setSaveNote("Use a GLB, GLTF, OBJ or STL file");
    if (file.size > MAX_MODEL_BYTES) return setSaveNote(`That model is ${Math.round(file.size / 1e6)} MB: keep it under ${Math.round(MAX_MODEL_BYTES / 1e6)} MB`);
    setSaveNote(`Reading ${file.name}...`);
    try {
      // CAD exports (STL) are usually Z-up; GLB and OBJ are Y-up.
      const upZ = fmt === "stl";
      const obj = await loadModel(await file.arrayBuffer(), file.name, upZ);
      const raw = rawSize(obj);
      const unit = guessUnit(file.name, raw);
      const m = UNITS.find((u) => u.id === unit)?.m ?? 1;
      const key = await putAsset(file, file.name);
      models.current.set(`${key}|${upZ}`, { obj, raw: { x: raw.x, y: raw.y, z: raw.z } });
      const big = Math.max(raw.x, raw.z) * m > 4;
      const at = placeFor("model");
      const centre = set.kind === "room" ? { x: set.room.x + set.room.width / 2, z: set.room.z + set.room.depth / 2 } : { x: 0, z: 0 };
      const it: ItemSpec = {
        ...newItem("model", big ? centre.x : at.x, big ? centre.z : at.z),
        rot: big ? 0 : at.rot,
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 40),
        w: raw.x * m, h: raw.y * m, d: raw.z * m,
        model: { key, fileName: file.name, upZ, unit },
      };
      setItems((all) => [...all, it]);
      setSel({ kind: "item", id: it.id });
      setSaveNote(`${file.name}: ${dist(it.w, units)} wide, ${dist(it.h, units)} tall. Check the units if that is wrong.`);
    } catch (e) {
      setSaveNote(e instanceof Error ? e.message : "Could not read that model");
    }
  };

  const removeSelected = () => {
    if (sel.kind === "light") removeLight(sel.id);
    else if (sel.kind === "grip") removeGrip(sel.id);
    else if (sel.kind === "item") removeItem(sel.id);
    else return false;
    return true;
  };
  const targets = [
    ...talent.map((t) => ({ id: t.id, name: t.name })),
    ...items.filter((i) => ["prop", "furniture", "set", "backdrop"].includes(catalogOf(i.kind).category)).map((i) => ({ id: i.id, name: i.name })),
  ];
  const meterTargetName = focusName ?? "the focus point";
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
  // Where the camera stands in the move, for the label on the frame.
  const frameState: "start" | "end" | "unsaved" | "between" | "playing" | null = !hasMove(rawActive)
    ? null
    : playing
      ? "playing"
      : draft
        ? "unsaved"
        : playhead <= 0.001
          ? "start"
          : playhead >= 0.999
            ? "end"
            : "between";
  // The other end (or both, for unsaved framing) outlined in this view.
  const outlines: { letter: "A" | "B"; pts: [number, number][] }[] = [];
  if (view === "lens" && rawActive.move && (frameState === "start" || frameState === "end" || frameState === "unsaved")) {
    if (frameState !== "start") {
      const pts = frameOutline(active, rawActive, aspect.ratio, placeScene(talent, items, 0));
      if (pts) outlines.push({ letter: "A", pts });
    }
    if (frameState !== "end") {
      const sEnd = placeScene(talent, items, 1);
      const pts = frameOutline(active, viewShot(rawActive, 1, sEnd), aspect.ratio, sEnd);
      if (pts) outlines.push({ letter: "B", pts });
    }
  }
  const stats = rawActive.move ? moveStats(rawActive.support, camKey(rawActive), rawActive.move) : null;
  const walkers = talent.filter((t) => t.mark && Math.hypot(t.mark.x - t.x, t.mark.z - t.z) > 0.05);
  const moveWarnings: string[] = [];
  if (rawActive.move && stats) {
    const [lo, hi] = support.lens;
    const ys = [rawActive.pos.y, rawActive.move.end.pos.y];
    if (ys.some((y) => y < lo - 0.01 || y > hi + 0.01)) moveWarnings.push(`The lens leaves the ${support.name.toLowerCase()}'s height range (${dist(lo, units)} to ${dist(hi, units)})`);
    const dolly = rawActive.support === "dana" || rawActive.support === "fisher";
    if (dolly && stats.peak > 1.2) moveWarnings.push("Fast for a dolly grip to land cleanly: give it more time");
    if (rawActive.support === "robot" && stats.peak > 2.5) moveWarnings.push("Near the top speed of a motion control arm");
    if (rawActive.support === "dana" && stats.trackM && stats.trackM > 3.66) moveWarnings.push("Longer than Dana rails usually run (12 ft): a Fisher on track would do it");
    for (const w of walkers) {
      const v = walkSpeed(w, rawActive.move.durationS);
      if (v > 2.2) moveWarnings.push(`${w.name} would have to run (${dist(v, units)}/s): lengthen the move or bring the mark closer`);
    }
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
  // Unsaved framing has to be set or discarded before the move plays: playing
  // over it would either lose it or play a move that is not the one on screen.
  toggleRef.current = () => (playRef.current.on ? finish(nowT()) : draft ? undefined : play(false));
  const clearDraft = (id: string) =>
    setDrafts((d) => {
      if (!(id in d)) return d;
      const r = { ...d };
      delete r[id];
      return r;
    });
  /**
   * Stamps the unsaved framing as the move's start or its end. The end is
   * kept to what the support can do; whatever it cannot travel during the
   * move (any travel on sticks, off the rail on a Dana, sideways on a
   * Fisher) moves the whole setup instead, and says so.
   */
  const stampFrame = (to: "start" | "end") => {
    const s = rawActive;
    const d = drafts[s.id];
    if (!d || !s.move) return;
    let next: Shot;
    let note: string | null = null;
    if (to === "start") {
      next = keepRobotBase(s, { ...s, ...d, rigYaw: rigYawOf(s) });
      next.move = { ...s.move, end: constrainEnd(next.support, camKey(next), s.move.end, s.move.trackYaw) };
    } else {
      next = { ...s };
      const tried = constrainEnd(s.support, camKey(s), d, s.move.trackYaw);
      const dx = d.pos.x - tried.pos.x;
      const dy = d.pos.y - tried.pos.y;
      const dz = d.pos.z - tried.pos.z;
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 0.005) {
        next.pos = { x: s.pos.x + dx, y: Math.max(0.1, s.pos.y + dy), z: s.pos.z + dz };
        note = {
          sticks: "Sticks do not travel during a move, so the whole camera moved there. The move keeps its pan, tilt and zoom.",
          dana: "A Dana only slides along its rail, so the rail moved to reach that frame.",
          fisher: "A Fisher only travels along its track and booms, so the track moved to reach that frame.",
          robot: null,
        }[s.support];
      }
      next.move = { ...s.move, end: constrainEnd(next.support, camKey(next), d, s.move.trackYaw) };
    }
    setShots((all) => all.map((x) => (x.id === s.id ? next : x)));
    clearDraft(s.id);
    setPlayhead(to === "start" ? 0 : 1);
    if (note) setSaveNote(note);
    dirty();
  };
  const discardFrame = () => {
    clearDraft(rawActive.id);
    dirty();
  };
  /** Shows one end of the move, or a moment between; never with unsaved framing. */
  const seek = (t: number) => {
    if (draft) return;
    setPlayhead(t);
  };
  const addMove = () => {
    const k = camKey(rawActive);
    // A small move the support can actually make, so play shows something
    // straight away: a pan on sticks, a slide on the Dana, a push otherwise.
    // Along the rig's own heading, which may not be where the head points.
    const rigYaw = rigYawOf(rawActive);
    const rf = { ...k, yaw: rigYaw };
    let end: CamKey = { ...k };
    if (rawActive.support === "sticks") end = { ...k, yaw: k.yaw - 15 };
    else if (rawActive.support === "dana") end = { ...k, pos: fromLocal(rf, 0.6, 0, 0) };
    else end = { ...k, pos: fromLocal(rf, 0, 0, -0.6), focusM: Math.max(0.3, k.focusM - 0.6) };
    // A shot that was locked off for the action keeps its length.
    const durationS = rawActive.move?.durationS ?? 4;
    clearDraft(rawActive.id);
    updateShot(rawActive.id, { move: { end, durationS, ease: rawActive.move?.ease ?? "smooth", trackYaw: rigYaw }, rigYaw });
    setPlayhead(1);
  };
  /** A timeline with the camera locked off, so the talent's action can play on its own. */
  const addAction = () => {
    const k = camKey(rawActive);
    const longest = Math.max(0, ...walkers.map((w) => Math.hypot(w.mark!.x - w.x, w.mark!.z - w.z)));
    updateShot(rawActive.id, { move: { end: { ...k }, durationS: Math.max(2, Math.round((longest / 1.2) * 2) / 2 + 1), ease: "smooth", trackYaw: rigYawOf(rawActive) }, rigYaw: rigYawOf(rawActive) });
    setPlayhead(0);
  };
  const removeMove = () => {
    clearDraft(rawActive.id);
    updateShot(rawActive.id, { move: null });
    setPlayhead(0);
  };
  const changeMove = (p: Partial<Move>) => updateShot(rawActive.id, (s) => ({ move: s.move ? { ...s.move, ...p } : null }));

  // ----- The setup: kept in this browser, and openable from a file.
  const snapshot = (): Setup => ({
    v: 3, name, set, items, shots, activeId, talent, lights, grips, win, units, aspectId,
  });
  const applySetup = (x: Setup) => {
    setName(x.name);
    setSet(x.set);
    setItems(x.items);
    setShots(x.shots);
    setActiveId(x.activeId);
    setTalent(x.talent);
    setLights(x.lights);
    setGrips(x.grips);
    setWin(x.win);
    setUnits(x.units);
    setAspectId(x.aspectId);
    setPlayhead(0);
    setDrafts({});
    setSel({ kind: "camera" });
    setThumbs({});
    requeue(x.shots.map((s) => s.id));
  };
  useEffect(() => {
    const saved = store ? store.initial : loadSetup();
    if (saved) applySetup(saved);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Project saving. The first snapshot after loading is the baseline, so
  // opening a setup writes nothing; after that only a real change is sent, and
  // a change still waiting when the builder closes (switching setups) is sent
  // on the way out rather than dropped.
  const storeRef = useRef(store);
  storeRef.current = store;
  const lastSaved = useRef<string | null>(null);
  const pending = useRef<Setup | null>(null);
  const flushStore = () => {
    const st = storeRef.current;
    const next = pending.current;
    if (!st || !next) return;
    pending.current = null;
    const { setup, dropped } = setupForStore(next);
    const json = JSON.stringify(setup);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    void st.save(setup).then((err) => {
      if (err) { lastSaved.current = null; setSaveNote(err); }
      else if (dropped) setSaveNote("Saved, without the largest storyboard pictures: they are too big to keep");
    });
  };
  useEffect(() => () => flushStore(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loaded) return;
    if (store) {
      if (!store.canEdit) return;
      const snap = snapshot();
      if (lastSaved.current === null) { lastSaved.current = JSON.stringify(setupForStore(snap).setup); return; }
      pending.current = snap;
      const t = window.setTimeout(flushStore, 800);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      const r = saveSetup(snapshot());
      if (r === "without-boards") setSaveNote("Saved, but storyboard pictures are too big to keep in this browser");
      else if (r === "failed") setSaveNote("This browser would not save the setup: download it to keep it");
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, name, set, items, shots, activeId, talent, lights, grips, win, units, aspectId]);
  useEffect(() => {
    if (!saveNote) return;
    const t = window.setTimeout(() => setSaveNote(null), 6000);
    return () => window.clearTimeout(t);
  }, [saveNote]);
  const newSetup = (which: "studio" | "kitchen" | "bathroom" | "bedroom" | "blank") => {
    const fresh = which === "studio" ? studioSetup()
      : which === "kitchen" ? kitchenSetup()
      : which === "bathroom" ? bathroomSetup()
      : which === "bedroom" ? bedroomSetup()
      : blankSetup(5, 6, 2.8);
    // On a project, New is another setup beside this one, never a replacement.
    if (store) { flushStore(); void store.create(fresh); return; }
    if (!window.confirm("Start a new setup? This one is replaced in this browser. Download it first if you want to keep it.")) return;
    applySetup(fresh);
    if (which === "blank") setSel({ kind: "set" });
  };
  const download = async () => {
    const keys = assetKeys(items);
    if (keys.length) setSaveNote("Packing the photos and models into the file...");
    const assets = keys.length ? await embedAssets(keys) : undefined;
    downloadSetup({ ...snapshot(), ...(assets ? { assets } : {}) });
    setSaveNote("Downloaded");
  };
  const openFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then(async (txt) => {
      let raw: unknown = null;
      try { raw = JSON.parse(txt); } catch { raw = null; }
      const parsed = asSetup(raw);
      if (!parsed) { window.alert("That file is not a scene setup this page can open."); return; }
      const n = await restoreAssets((raw as Setup).assets);
      if (store) { flushStore(); await store.create(parsed); return; }
      applySetup(parsed);
      setSaveNote(`Opened ${parsed.name}${n ? ` with ${n} photo${n === 1 ? "" : "s"} and model${n === 1 ? "" : "s"}` : ""}`);
    });
  };
  const setupFileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);

  // ----- Talent
  const addPerson = () => {
    const id = `t${Date.now()}`;
    const n = talent.length + 1;
    const near = talent[talent.length - 1];
    // Somewhere clear of the furniture and inside the walls: a person dropped
    // into an armchair reads as standing on it.
    const right = { x: Math.cos(rad(active.yaw)), z: -Math.sin(rad(active.yaw)) };
    const toCam = { x: active.pos.x - subjectAt.x, z: active.pos.z - subjectAt.z };
    const tl = Math.hypot(toCam.x, toCam.z) || 1;
    const fwd = { x: toCam.x / tl, z: toCam.z / tl };
    const base = near ? { x: near.x + right.x * 0.8, z: near.z + right.z * 0.8 } : subjectAt;
    const rb = set.kind === "room" ? roomBounds(set.room) : null;
    const blocked = (q: { x: number; z: number }) =>
      (!!rb && (q.x < rb.minX + 0.3 || q.x > rb.maxX - 0.3 || q.z < rb.minZ + 0.3 || q.z > rb.maxZ - 0.3)) ||
      items.some((o) => {
        const k = catalogOf(o.kind);
        return k.category !== "prop" && k.category !== "backdrop" && o.kind !== "rug" && !k.standable && containsPoint(o, q.x, q.z, 0.25);
      }) ||
      talent.some((t) => Math.hypot(t.x - q.x, t.z - q.z) < 0.45);
    let spot = base;
    outer: for (let ring = 1; ring <= 6 && blocked(spot); ring++) {
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1], [0, -1]]) {
        const q = { x: base.x + (right.x * a + fwd.x * b) * 0.5 * ring, z: base.z + (right.z * a + fwd.z * b) * 0.5 * ring };
        if (!blocked(q)) { spot = q; break outer; }
      }
    }
    const x = spot.x;
    const z = spot.z;
    const hues = ["#7a5c99", "#3f7a5c", "#99683f", "#3f5f99", "#993f55"];
    setTalent((all) => [...all, {
      id, name: `Person ${n}`, heightM: 1.75, pose: "standing", x, z, facing: Math.round(deg(Math.atan2(active.pos.x - x, active.pos.z - z))),
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
        // One prop in one hand: handing it to someone takes it from whoever had it.
        return p.holding && t.holding === p.holding ? { ...t, holding: null } : t;
      }
      return { ...t, ...p };
    }));

  const onBoardFile = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => updateShot(active.id, { board: String(r.result) });
    r.readAsDataURL(file);
  };

  // ----- Scout photo to room
  const readPhoto = async (file: File) => {
    try {
      const forReader = await shrinkPhoto(file, 1600, 0.85);
      const photo = await shrinkPhoto(file, 1280, 0.8);
      const res = await readScoutPhoto({ base64: forReader.split(",")[1] ?? "", mediaType: "image/jpeg", fileName: file.name });
      if (!res) return { error: "Your session has ended. Reload the page and sign in again." };
      if ("error" in res) return res;
      return { draft: res.draft, photo };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not read the photo." };
    }
  };
  const buildFromDraft = (d: RoomDraft, photo: string, c: ScoutChoices) => {
    let x0 = set.room.x;
    let z0 = set.room.z;
    if (c.replaceRoom) {
      x0 = -d.width / 2;
      z0 = -d.depth * 0.55;
      setSet({
        kind: "room",
        room: {
          x: x0, z: z0, width: d.width, depth: d.depth, height: d.height, wallColor: d.wallColor, floor: d.floor,
          walls: { back: d.walls.back, left: d.walls.left, right: d.walls.right, front: false },
          openings: d.openings.map((o, i) => ({ ...o, id: `s${Date.now()}${i}` })),
        },
      });
    }
    const added = d.items.filter((_, i) => c.items[i] !== false).map((it) => ({
      ...newItem(it.kind, x0 + it.x, z0 + it.z),
      name: it.name,
      rot: Math.round(it.rot),
      ...(it.w ? { w: it.w } : {}),
      ...(it.d ? { d: it.d } : {}),
      ...(it.h ? { h: it.h } : {}),
      ...(it.color ? { color: it.color } : {}),
    }));
    setItems((all) => [...(c.clearSet ? [] : all), ...added]);
    if (c.addCamera && d.camera) {
      let n = 0;
      while (shots.some((x) => x.code === `1${String.fromCharCode(65 + n)}`)) n++;
      const cam: Shot = {
        ...active,
        id: `s${Date.now()}`,
        code: `1${String.fromCharCode(65 + n)}`,
        title: "Scout photo",
        // A full-frame body, so the photo's 35mm-equivalent focal length is the lens.
        bodyId: "venice2",
        support: "sticks",
        focal: Math.round(d.camera.focal),
        pos: { x: x0 + d.camera.x, y: d.camera.height, z: z0 + d.camera.z },
        yaw: d.camera.yaw,
        pitch: -4,
        focusOn: null,
        focusM: Math.max(1, d.depth * 0.5),
        board: photo,
        move: null,
      };
      setShots((all) => [...all, cam]);
      setActiveId(cam.id);
      setShowBoard(true);
      setBoardOpacity(0.5);
      setView("lens");
    }
    setScout(false);
    setSel({ kind: "set" });
    setSaveNote(`Room built from the photo (${d.confidence} confidence). Check its measurements in the room panel.`);
  };

  const selItem = sel.kind === "item" ? items.find((i) => i.id === sel.id) ?? null : null;
  const placedSel = selItem ? scene.items.find((i) => i.id === selItem.id) ?? null : null;
  const standsOn = (() => {
    if (!placedSel || !placedSel.y) return null;
    const under = scene.items
      .filter((o) => o.id !== placedSel.id && o.w * o.d > placedSel.w * placedSel.d && containsPoint(o, placedSel.x, placedSel.z))
      .sort((a, b) => (b.y ?? 0) + b.h - ((a.y ?? 0) + a.h))[0];
    return under ? `the ${under.name.toLowerCase()}` : null;
  })();
  const selArt = selItem?.label ? art.current.get(selItem.label) : undefined;
  const selModel = selItem?.model ? models.current.get(`${selItem.model.key}|${selItem.model.upZ}`) : undefined;
  const sortedItems = [...items].sort((a, b) =>
    CATEGORIES.findIndex((c) => c.id === catalogOf(a.kind).category) - CATEGORIES.findIndex((c) => c.id === catalogOf(b.kind).category));

  return (
    <div className={`flex ${heightClass} min-h-[640px] flex-col overflow-hidden bg-bg text-text`}>
      <div className="border-b border-border bg-surface px-4 py-1.5 text-xs font-semibold text-text-muted lg:hidden">
        The scene builder is a desktop workspace. Open this on a laptop or larger screen.
      </div>

      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-1.5 border-b border-border bg-surface px-4 py-2">
        <div className="relative mr-3 min-w-0">
          <div className="flex items-center gap-2">
            <input
              aria-label="Setup name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-[190px] truncate rounded-[6px] border border-transparent bg-transparent px-1 font-display text-[15px] font-bold hover:border-border focus:border-border focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
              className="rounded-[8px] border border-border px-2 py-0.5 text-[11px] font-semibold text-text-muted hover:text-text"
            >
              Setup ▾
            </button>
            {store ? null : <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Prototype</span>}
          </div>
          <p className="max-w-[330px] truncate px-1 text-xs text-text-muted">
            {saveNote ?? `${shots.length} shot${shots.length === 1 ? "" : "s"} · ${items.length} thing${items.length === 1 ? "" : "s"} on the set · ${!store ? "saved in this browser" : store.canEdit ? "saved to this project" : "view only, changes are not saved"}`}
          </p>
          {menu ? (
            <div className="absolute left-0 top-full z-30 mt-1 w-[280px] rounded-[12px] border border-border bg-surface p-1.5 shadow-lg" onMouseLeave={() => setMenu(false)}>
              {[
                { l: "New: empty room", d: "5 x 6 m, one window: build from here", f: () => newSetup("blank"), edit: true },
                { l: "New: talent on seamless", d: "Paper backdrop, one person, one camera", f: () => newSetup("studio"), edit: true },
                { l: "New: kitchen", d: "A simple kitchen, one person, one camera", f: () => newSetup("kitchen"), edit: true },
                { l: "New: bathroom", d: "A simple bathroom, one person, one camera", f: () => newSetup("bathroom"), edit: true },
                { l: "New: bedroom", d: "A simple bedroom, one person, one camera", f: () => newSetup("bedroom"), edit: true },
                { l: "Build a room from a scout photo", d: "The AI estimates it, you check it", f: () => setScout(true), edit: true },
                { l: "Download this setup", d: "A file with its photos and models, for another computer", f: () => void download(), edit: false },
                { l: "Open a setup file", d: store ? "Adds it to this project as a new setup" : "One you downloaded before", f: () => setupFileRef.current?.click(), edit: true },
              ].filter((o) => !o.edit || !store || store.canEdit).map((o) => (
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
        <Toggle on={focusMode} onClick={() => setFocusMode(!focusMode)} label="Focus" hint="\\" />
        <Toggle on={clay} onClick={() => setClay(!clay)} label="Clay" hint="C" />
        {view === "free" ? (
          <>
            <Toggle on={houseLights} onClick={() => setHouseLights(!houseLights)} label="House lights" hint="H" />
            <button type="button" onClick={frameAll} title="Fit everything in view (F)" className="rounded-[10px] border border-border px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text">
              Frame all
            </button>
          </>
        ) : null}
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

      <div className={`grid min-h-0 flex-1 ${focusMode ? "grid-cols-[minmax(0,1fr)]" : "grid-cols-[220px_minmax(0,1fr)_300px]"}`}>
        {/* Left rail: what is in the scene */}
        <aside className={`min-h-0 overflow-y-auto border-r border-border bg-surface p-3 text-sm ${focusMode ? "hidden" : ""}`}>
          <RailGroup title="Set">
            <RailItem
              active={sel.kind === "set"} onClick={() => setSel({ kind: "set" })} dot={set.kind === "room" ? set.room.wallColor : "#2b2c2e"}
              label={set.kind === "room" ? "Room" : "Open stage"}
              sub={set.kind === "room" ? `${dist(set.room.width, units)} x ${dist(set.room.depth, units)}, ${dist(set.room.height, units)} ceiling` : "black, no walls"}
            />
            {windows.length ? (
              <RailItem
                active={sel.kind === "daylight"} onClick={() => setSel({ kind: "daylight" })} dot={win.on ? "#8fc2f0" : "#5b6068"}
                label="Daylight" sub={win.on ? `${windows.length} window${windows.length === 1 ? "" : "s"}, ${WINDOW_SKIES[win.sky].name.toLowerCase()}${win.nd ? `, ND ${win.nd.toFixed(1)}` : ""}` : "off"}
              />
            ) : null}
          </RailGroup>
          <RailGroup title="On the set">
            {sortedItems.map((it) => {
              const placed = scene.items.find((x) => x.id === it.id);
              const holder = placed?.heldBy ? talent.find((t) => t.id === placed.heldBy) : null;
              return (
                <RailItem
                  key={it.id}
                  active={sel.kind === "item" && sel.id === it.id}
                  onClick={() => setSel({ kind: "item", id: it.id })}
                  dot={it.light ? (it.light.on ? "#ffc879" : "#5b6068") : it.color}
                  label={it.name}
                  onDelete={() => removeItem(it.id)}
                  deleteLabel={`Delete ${it.name}`}
                  sub={holder ? `in ${holder.name}'s hand` : it.light ? `${it.light.on ? `on, ${Math.round(it.light.dimmer * 100)}%` : "off"}` : `${dist(it.w, units)} x ${dist(it.d, units)} x ${dist(it.h, units)}`}
                />
              );
            })}
            <button type="button" onClick={() => setAdding(!adding)} className="mt-1 w-full rounded-[8px] border border-dashed border-border px-2 py-1 text-xs font-semibold text-text-muted hover:text-text">
              + Add to the set
            </button>
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
                sub={`${dist(t.heightM, units)} · ${(POSES.find((p) => p.id === t.pose)?.name ?? t.pose).toLowerCase()}${t.mark ? " · walks" : ""}`}
              />
            ))}
            <button type="button" onClick={addPerson} className="mt-1 w-full rounded-[8px] border border-dashed border-border px-2 py-1 text-xs font-semibold text-text-muted hover:text-text">+ Add a person</button>
          </RailGroup>
          <RailGroup title="Lights">
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
              onChange={(e) => { const v = e.target.value; if (v.startsWith("window:")) addWindowLight(v.slice(7), "hard"); else if (v) addLight(v); }}
              className="mt-1 w-full rounded-[8px] border border-dashed border-border bg-surface px-2 py-1 text-xs font-semibold text-text-muted"
            >
              <option value="">+ Add a light</option>
              {FIXTURES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              {set.kind === "room" && windows.length ? (
                <optgroup label="Outside, through a window">
                  {windows.map((w) => <option key={w.id} value={`window:${w.id}`}>{windowName(windows, w.id)}</option>)}
                </optgroup>
              ) : null}
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
                sub={`${(BODIES.find((b) => b.id === s.bodyId) ?? BODIES[0]).name}, ${Math.round(s.focal)}mm, ${(SUPPORTS.find((k) => k.id === s.support) ?? SUPPORTS[0]).name}`}
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
              onPointerCancel={() => { drag.current = null; press.current = null; }}
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
            {view === "lens" && frameState && frameState !== "playing" ? (
              // Which frame of the move this is, said on the frame itself: a
              // coloured border and a label for A or B, amber for unsaved
              // framing, and the outline of the other end for reference.
              <div className="pointer-events-none absolute inset-0">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
                  {outlines.map((o) => (
                    <polygon
                      key={o.letter}
                      points={o.pts.map((q) => q.join(",")).join(" ")}
                      fill="none"
                      stroke={o.letter === "A" ? FRAME_A : FRAME_B}
                      strokeWidth={2}
                      strokeDasharray="7 5"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
                {outlines.map((o) => {
                  // On the first corner that is inside the frame, if any is.
                  const c = o.pts.find(([px, py]) => px >= 0.01 && px <= 0.95 && py >= 0.01 && py <= 0.95);
                  if (!c) return null;
                  const [x, y] = c;
                  return (
                    <span
                      key={`l${o.letter}`}
                      className="absolute flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ left: `${x * 100}%`, top: `${y * 100}%`, background: o.letter === "A" ? FRAME_A : FRAME_B }}
                    >
                      {o.letter}
                    </span>
                  );
                })}
                {frameState !== "between" ? (
                  <div
                    className="absolute inset-0 border-[3px]"
                    style={{ borderColor: frameState === "start" ? FRAME_A : frameState === "end" ? FRAME_B : "var(--h-amber)" }}
                  />
                ) : null}
                <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-[8px] bg-black/65 px-2.5 py-1.5 text-[11px] font-semibold text-white">
                  {frameState === "start" || frameState === "end" ? (
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                      style={{ background: frameState === "start" ? FRAME_A : FRAME_B }}
                    >
                      {frameState === "start" ? "A" : "B"}
                    </span>
                  ) : frameState === "unsaved" ? (
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--h-amber)" }} />
                  ) : null}
                  {frameState === "start"
                    ? "Start frame"
                    : frameState === "end"
                      ? "End frame"
                      : frameState === "unsaved"
                        ? "Unsaved framing: set it as the start or end below"
                        : `Previewing ${(playhead * (rawActive.move?.durationS ?? 0)).toFixed(1)}s into the move`}
                </div>
              </div>
            ) : null}
            {view === "lens" ? (
              <div className="pointer-events-none absolute left-3 top-3 rounded-[8px] bg-black/55 px-2.5 py-1.5 font-mono text-[11px] leading-tight text-white/90">
                <div className="font-semibold">{active.code} · {body.name}</div>
                <div>{Math.round(active.focal)}mm · f/{active.stop} · focus {dist(focus, units)}</div>
              </div>
            ) : (
              <div className="pointer-events-none absolute left-3 top-3 rounded-[8px] bg-black/55 px-2.5 py-1.5 text-[11px] text-white/90">
                Free view · drag a thing to move it, shift-drag to raise it · drag empty space to orbit, scroll to zoom · H house lights · F frame all · V for the lens
              </div>
            )}
            {!lights.some((l) => l.on) && !items.some((i) => i.light?.on) && !(set.kind === "room" && windows.length && win.on) ? (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                <div className="rounded-[10px] bg-black/60 px-3 py-2 text-center text-xs text-white/90">
                  {set.kind === "room" ? "Nothing is lit. Add a light from the rail, or a window to the room." : "Nothing is lit. A stage has no daylight: add a light from the rail."}
                </div>
              </div>
            ) : null}
          </div>

          {adding ? (
            <div className="absolute left-3 top-3 z-40">
              <AddMenu onAdd={addItem} onProductPhoto={(s, f) => void addProduct(s, f)} onModelFile={(f) => void importModel(f)} onClose={() => setAdding(false)} />
            </div>
          ) : null}

          <TopDownMap
            talent={talent}
            items={scene.items}
            shots={shots.map((x) => (x.id === activeId ? active : x))}
            rawShots={shots}
            activeId={activeId}
            aspectRatio={aspect.ratio}
            set={set}
            winOn={win.on}
            lights={lights}
            grips={grips}
            selected={sel}
            supportOf={(x, at) => supportPose(x, at)}
            aimOfLight={(l) => aimOf(l, scene)}
            effLight={(l) => effLight(l, scene)}
            onTalent={(id, x, z) => setTalent((all) => all.map((t) => (t.id === id ? { ...t, x, z } : t)))}
            onMark={(id, x, z) => setTalent((all) => all.map((t) => (t.id === id && t.mark ? { ...t, mark: { ...t.mark, x, z } } : t)))}
            onItem={(id, x, z) => {
              // Picking up something held takes it out of the hand.
              setItems((all) => all.map((i) => (i.id === id ? { ...i, x, z } : i)));
              if (scene.items.find((i) => i.id === id)?.heldBy) setTalent((all) => all.map((t) => (t.holding === id ? { ...t, holding: null } : t)));
            }}
            onItemRot={(id, rot) => updateItem(id, { rot })}
            onCamera={(id, x, z, together) => updateShot(id, (s) => {
              const pos = { ...s.pos, x, z };
              // Shift-drag carries an arm's base along; a plain drag leaves it standing.
              if (!together || s.support !== "robot") return { pos };
              const raw = live.current.shots.find((r) => r.id === id) ?? s;
              return { pos, robotBase: robotBaseOf(raw) };
            })}
            onAim={(id, yaw) => updateShot(id, { yaw })}
            onRigYaw={(id, rigYaw) => updateShot(id, { rigYaw })}
            onRobotBase={(id, x, z) => updateShot(id, (s) => {
              // Into the rig's frame, measured from where the camera starts,
              // and kept to what the arm can reach at this height.
              const raw = live.current.shots.find((r) => r.id === id) ?? s;
              const l = toLocal({ ...camKey(raw), yaw: rigYawOf(raw) }, { x, y: 0, z });
              const range = robotBaseRange(raw.pos.y, bodyDrop(raw.bodyId), mountOf(raw));
              const d = Math.hypot(l.lx, l.lz) || 1;
              const k = Math.max(range.min, Math.min(range.max, d)) / d;
              return { robotBase: { x: l.lx * k, z: l.lz * k }, rigYaw: rigYawOf(raw) };
            })}
            onLight={(id, x, z) => setLights((all) => all.map((l) => (l.id === id ? snapHung({ ...l, x, z }, items) : l)))}
            onLightAim={(id, yaw) => setLights((all) => all.map((l) => (l.id === id ? { ...l, ...aimOf(l, scene), yaw, aimAt: null } : l)))}
            onGrip={(id, x, z) => setGrips((all) => all.map((g) => (g.id === id ? { ...g, x, z } : g)))}
            onGripAim={(id, yaw) => setGrips((all) => all.map((g) => (g.id === id ? { ...g, ...aimOf(g, scene), yaw, aimAt: null } : g)))}
            onPick={(k: MapPick) => {
              if (k.kind === "camera") { setActiveId(k.id); setSel({ kind: "camera" }); }
              else if (k.kind === "talent" || k.kind === "mark") setSel({ kind: "talent", id: k.id });
              else if (k.kind === "light") setSel({ kind: "light", id: k.id });
              else if (k.kind === "grip") setSel({ kind: "grip", id: k.id });
              else if (k.kind === "item") setSel({ kind: "item", id: k.id });
              else if (k.kind === "daylight") setSel({ kind: "daylight" });
              else setSel({ kind: "set" });
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
          onSeek={seek}
          onAdd={addMove}
          onRemove={removeMove}
          onChange={changeMove}
          onRecord={() => play(true)}
          onAddAction={walkers.length ? addAction : undefined}
          walkers={walkers.map((w) => w.name)}
          fmtDist={(m) => dist(m, units)}
          fmtSpeed={(v) => (units === "ft" ? `${(v / 0.3048).toFixed(1)} ft/s` : `${v.toFixed(2)} m/s`)}
          canRecord={canRecord}
          lockedOff={!!rawActive.move && !hasMove(rawActive)}
          unsaved={!!draft && hasMove(rawActive)}
          thumbA={thumbs[`${rawActive.id}#a`] ?? null}
          thumbB={thumbs[`${rawActive.id}#b`] ?? null}
          lensA={`${Math.round(rawActive.focal)}mm`}
          lensB={`${Math.round(rawActive.move?.end.focal ?? rawActive.focal)}mm`}
          onStamp={stampFrame}
          onDiscard={discardFrame}
        />
        </div>

        {/* Inspector */}
        <aside className={`min-h-0 overflow-y-auto border-l border-border bg-surface p-4 text-sm ${focusMode ? "hidden" : ""}`}>
          <ShotExposure.Provider value={{ stop: active.stop, iso: active.iso, nd: active.nd }}>
          {sel.kind === "camera" ? (
            <CameraInspector
              pads={<ControlPads pads={camPads(active.id)} caption={<>Keys work too through the lens: W A S D, Q E, and the arrows.</>} />}
              shot={active}
              units={units}
              focus={focus}
              focusName={focusName}
              focusTargets={[
                ...talent.map((t) => ({ id: t.id, name: t.name })),
                ...items.filter((i) => catalogOf(i.kind).category === "prop").map((i) => ({ id: i.id, name: i.name })),
              ]}
              readouts={{ hfov, vfov, near: dof.near, far: dof.far, hyper: dof.hyperfocal, size, angle }}
              onChange={(p) => updateShot(active.id, p)}
              onDelete={shots.length > 1 ? () => removeShot(active.id) : undefined}
              onBoardFile={onBoardFile}
              exposure={
                <ExposurePanel
                  stop={active.stop} iso={active.iso} nd={active.nd} wb={active.wb}
                  reading={meter} targetName={meterTargetName}
                  onChange={(p) => updateShot(active.id, p)}
                />
              }
            />
          ) : sel.kind === "talent" && talent.some((t) => t.id === sel.id) ? (
            <TalentInspector
              t={talent.find((x) => x.id === sel.id)!}
              units={units}
              props={items.filter((i) => catalogOf(i.kind).holdable)}
              moveSeconds={rawActive.move?.durationS ?? null}
              seat={(() => { const p = talent.find((x) => x.id === sel.id); return p && p.pose === "seated" ? seatUnder(items, stackHeights(items), p.x, p.z) : null; })()}
              onChange={(p) => updatePerson(sel.id, p)}
              onDelete={() => removePerson(sel.id)}
            />
          ) : selItem ? (
            <ItemInspector
              item={selItem}
              units={units}
              talent={talent}
              standsOn={standsOn}
              labelAspect={selArt && typeof selArt === "object" ? selArt.aspect : null}
              modelRaw={selModel && typeof selModel === "object" ? selModel.raw : null}
              lamp={selItem.light ? (
                <PracticalInspector
                  id={selItem.id}
                  dimmer={selItem.light.dimmer} cct={selItem.light.cct} on={selItem.light.on}
                  reading={meter} targetName={meterTargetName} fmt={fmt}
                  onChange={(p) => updateItem(selItem.id, { light: { ...selItem.light!, ...p } })}
                />
              ) : null}
              onChange={(p) => updateItem(selItem.id, p)}
              onDelete={() => removeItem(selItem.id)}
              walls={set.kind === "room" ? { ...roomBounds(set.room), has: set.room.walls } : null}
              hungCount={lights.filter((l) => l.hangFrom === selItem.id).length}
              onDuplicate={() => duplicateItem(selItem.id)}
              onLabelFile={(f) => void setItemLabel(selItem.id, f)}
              onClearLabel={() => updateItem(selItem.id, { label: null })}
              onHold={(tid) => holdItem(selItem.id, tid)}
            />
          ) : sel.kind === "light" && lights.some((l) => l.id === sel.id) ? (
            <LightInspector
              s={lights.find((l) => l.id === sel.id)!}
              targets={targets} reading={meter} targetName={meterTargetName} fmt={fmt}
              rigs={items.filter((i) => isRig(i.kind)).map((i) => ({ id: i.id, name: i.name, kind: i.kind }))}
              hung={(() => {
                const l = settleHung(lights.find((x) => x.id === sel.id)!, items);
                const rig = items.find((i) => i.id === l.hangFrom);
                if (l.hungY == null || !rig) return null;
                return { pipeY: l.hungY, maxY: l.hungY - CLAMP_DROP - hangClearance(l.fixtureId, l.modifierId), rigName: rig.name };
              })()}
              onHangNew={(kind) => hangOnNew(sel.id, kind)}
              note={(() => {
                const l = lights.find((x) => x.id === sel.id)!;
                if (set.kind !== "room" || !outsideRoom(set.room, l.x, l.z)) return null;
                const lux = meter?.contributions.find((c) => c.id === l.id)?.lux ?? 0;
                if (!l.on || !meter) return "Outside the room.";
                return lux > 0.5
                  ? "Outside the room, lighting through the window."
                  : "Outside the room, and the wall is in the way: none of it reaches the subject. Move or aim it so the beam goes through a window.";
              })()}
              pads={<ControlPads pads={fixturePads("light", sel.id)} caption="Moves as if you are standing behind the light." />}
              onChange={(p) => updateLight(sel.id, p)}
              onDelete={removeSelected}
            />
          ) : sel.kind === "grip" && grips.some((g) => g.id === sel.id) ? (
            <GripInspector
              pads={<ControlPads pads={fixturePads("grip", sel.id)} caption="Moves as if you are standing behind the board." />}
              g={grips.find((g) => g.id === sel.id)!}
              targets={targets} reading={meter} targetName={meterTargetName} fmt={fmt}
              onChange={(p) => updateGrip(sel.id, p)}
              onDelete={removeSelected}
            />
          ) : sel.kind === "daylight" ? (
            <WindowInspector
              sky={win.sky} nd={win.nd} on={win.on} reading={meter} targetName={meterTargetName} fmt={fmt}
              onChange={(p) => setWin((w) => ({ ...w, ...p }))}
              windows={windows.map((w) => ({ id: w.id, name: windowName(windows, w.id) }))}
              outside={lights.filter((l) => set.kind === "room" && outsideRoom(set.room, l.x, l.z)).map((l) => ({ id: l.id, name: `${l.role} · ${fixtureOf(l).name.replace(/^(Aputure|ARRI|Astera) /, "")}` }))}
              onLightThrough={addWindowLight}
              onSelectLight={(id) => setSel({ kind: "light", id })}
            />
          ) : (
            <RoomInspector set={set} units={units} onChange={setSet} onScout={() => setScout(true)} />
          )}
          </ShotExposure.Provider>
        </aside>
      </div>

      {/* Shots strip */}
      <div className="flex items-center gap-2 border-t border-border bg-surface px-4 py-1.5">
        <button
          type="button"
          onClick={toggleShots}
          aria-expanded={stripOpen}
          className="flex items-center gap-1.5 rounded-[7px] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-text"
        >
          <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${stripOpen ? "" : "-rotate-90"}`} aria-hidden>
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Shots · {shots.length}
        </button>
        {stripOpen ? null : (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            {shots.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setActiveId(s.id); setSel({ kind: "camera" }); setView("lens"); }}
                title={s.title}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  s.id === activeId ? "border-accent bg-accent-soft text-text" : "border-border text-text-muted hover:border-border-strong hover:text-text"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: SHOT_HUES[i % SHOT_HUES.length] }} />
                {s.code}
              </button>
            ))}
            <button
              type="button"
              onClick={addShot}
              className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-semibold text-text-muted hover:border-border-strong hover:text-text"
            >
              + Shot from here
            </button>
          </div>
        )}
      </div>
      {stripOpen ? (
      <footer className="flex gap-3 overflow-x-auto bg-surface px-4 pb-3">
        {shots.map((s, i) => {
          const b = BODIES.find((x) => x.id === s.bodyId) ?? BODIES[0];
          const a = imagedArea(b, aspect.ratio);
          const f = effectiveFocus(s, scene);
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
                {Math.round(s.focal)}mm · f/{s.stop} · {shotSize((a.h * f) / s.focal)}
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
      ) : null}

      {scout ? (
        <ScoutDialog units={units} read={readPhoto} onBuild={buildFromDraft} onClose={() => setScout(false)} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- inspector

/** -180 to 180, the short way round. */
const wrapDeg = (d: number) => ((((d % 360) + 540) % 360) - 180);

/**
 * What the camera is on, apart from where the head points: the heading of a
 * Dana or Fisher track, and where a motion control arm's base stands.
 */
function RigControls({ shot, units, onChange }: { shot: Shot; units: Units; onChange: (p: Partial<Shot>) => void }) {
  if (shot.support === "sticks") return null;
  const rigYaw = rigYawOf(shot);
  const off = Math.round(wrapDeg(shot.yaw - rigYaw));
  if (shot.support === "dana" || shot.support === "fisher") {
    const what = shot.support === "fisher" ? "Track" : "Rails";
    return (
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-text">{what} heading</p>
          <button
            type="button"
            onClick={() => onChange({ rigYaw: shot.yaw })}
            disabled={off === 0}
            className="rounded-[8px] border border-border px-2 py-0.5 text-xs font-semibold text-text-muted hover:border-border-strong hover:text-text disabled:opacity-40"
          >
            Square to the lens
          </button>
        </div>
        <input
          aria-label={`${what} heading, relative to the lens`}
          type="range" min={-180} max={180} step={1} value={-off}
          onChange={(e) => onChange({ rigYaw: shot.yaw + Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
        <p className="text-xs leading-relaxed text-text-muted">
          {off === 0
            ? `The head points along the ${what.toLowerCase()}. Pan as much as you like: the ${what.toLowerCase()} stay where they are.`
            : `The head is panned ${Math.abs(off)}° ${off > 0 ? "left" : "right"} of the ${what.toLowerCase()}. Drag the handle at the end of the ${what.toLowerCase()} on the map to turn them.`}
        </p>
      </div>
    );
  }
  // Motion control arm: where the base stands, relative to the camera.
  const range = robotBaseRange(shot.pos.y, bodyDrop(shot.bodyId), mountOf(shot));
  const b = robotBaseOf(shot);
  const r = Math.hypot(b.x, b.z);
  const ang = Math.round((Math.atan2(b.x, b.z) * 180) / Math.PI);
  // A preset is placed against where the lens points now; the distance
  // slider keeps the base on its bearing. Either way, panning afterwards
  // leaves the base where it stands.
  const place = (deg: number, d0: number, square: boolean) => {
    const a = rad(deg);
    const d = Math.max(range.min, Math.min(range.max, d0));
    onChange({ robotBase: { x: Math.sin(a) * d, z: Math.cos(a) * d }, rigYaw: square ? shot.yaw : rigYaw });
  };
  const SPOTS: { deg: number; name: string }[] = [
    { deg: -90, name: "Left" },
    { deg: -45, name: "Behind left" },
    { deg: 0, name: "Behind" },
    { deg: 45, name: "Behind right" },
    { deg: 90, name: "Right" },
  ];
  const far = r > range.max + 0.02;
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-semibold text-text">Mount</p>
      <div className="flex flex-wrap gap-1">
        <Chip on={mountOf(shot) === "under"} onClick={() => onChange({ robotMount: "under" })}>Underslung</Chip>
        <Chip on={mountOf(shot) === "over"} onClick={() => onChange({ robotMount: "over" })}>Overslung</Chip>
      </div>
      <p className="text-xs leading-relaxed text-text-muted">
        {mountOf(shot) === "under"
          ? "The arm's 6th axis comes down onto the top of the camera through a disc spacer, so the camera hangs under the wrist. The usual way."
          : "The arm meets the camera's baseplate from below. Not the usual way; use it when the top of the camera has to stay clear."}
      </p>
      <p className="pt-1 text-xs font-semibold text-text">Base</p>
      <div className="flex flex-wrap gap-1">
        {SPOTS.map((p) => (
          <Chip key={p.deg} on={off === 0 && Math.abs(wrapDeg(ang - p.deg)) < 3} onClick={() => place(p.deg, r, true)}>{p.name}</Chip>
        ))}
      </div>
      <label className="block text-xs text-text-muted">
        {dist(r, units)} from the camera
        <input
          aria-label="Base distance from the camera"
          type="range" min={range.min} max={range.max} step={0.01} value={Math.min(range.max, Math.max(range.min, r))}
          onChange={(e) => place(ang, Number(e.target.value), false)}
          className="mt-1 w-full accent-[var(--accent)]"
        />
      </label>
      <p className="text-xs leading-relaxed text-text-muted">
        Placed against where the lens points. After that the base stands where it is: pan the head or drag the camera and only the arm moves, until the camera goes past its reach and the base follows. Drag the base on the map to put it anywhere, or shift-drag the camera to move both. A base to one side with the arm reaching across gives the most sideways reach.
      </p>
      {far ? (
        <p className="flex gap-1.5 rounded-[8px] border border-[var(--h-amber)] bg-[var(--h-amber-bg)] px-2 py-1.5 text-xs leading-relaxed text-text">
          <span aria-hidden className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--h-amber)]" />
          The base is {dist(r, units)} away; at this height the arm reaches about {dist(range.max, units)}. Move it closer.
        </p>
      ) : null}
    </div>
  );
}

function CameraInspector({
  shot, units, focus, focusName, focusTargets, readouts, onChange, onDelete, onBoardFile, exposure, pads,
}: {
  shot: Shot;
  /** The controller pads that move and aim this camera. */
  pads: React.ReactNode;
  units: Units;
  focus: number;
  focusName: string | null;
  focusTargets: { id: string; name: string }[];
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
          <input
            aria-label="Shot title"
            value={shot.title}
            onChange={(e) => onChange({ title: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full rounded-[6px] border border-transparent bg-transparent font-display text-base font-bold hover:border-border focus:border-border focus:outline-none"
          />
          <p className="text-xs text-text-muted">Shot {shot.code}</p>
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

      <Field label={`Position · lens ${dist(shot.pos.y, units)} up, tilted ${shot.pitch >= 0 ? "up" : "down"} ${Math.abs(shot.pitch).toFixed(0)}°`}>
        {pads}
      </Field>

      <Field label="Body">
        <select
          value={shot.bodyId}
          onChange={(e) => onChange({ bodyId: e.target.value })}
          className="w-full rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm"
        >
          <optgroup label="Cinema cameras">
            {BODIES.filter((b) => b.group === "cinema").map((b) => <option key={b.id} value={b.id}>{b.name} ({b.format})</option>)}
          </optgroup>
          <optgroup label="Compact and mirrorless">
            {BODIES.filter((b) => b.group === "compact").map((b) => <option key={b.id} value={b.id}>{b.name} ({b.format})</option>)}
          </optgroup>
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
        <RigControls shot={shot} units={units} onChange={onChange} />
      </Field>

      <Field label={`Lens · ${Math.round(shot.focal)}mm`}>
        <div className="flex flex-wrap gap-1">
          {PRIMES.map((f) => (
            <Chip key={f} on={Math.round(shot.focal) === f} onClick={() => onChange({ focal: f })}>{f}</Chip>
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
          {focusTargets.map((t) => (
            <Chip key={t.id} on={shot.focusOn === t.id} onClick={() => onChange({ focusOn: t.id })}>{t.name}</Chip>
          ))}
        </div>
        <input
          aria-label="Focus distance"
          type="range" min={0} max={1} step={0.001} value={toSlider(focus)}
          onChange={(e) => onChange({ focusOn: null, focusM: fromSlider(Number(e.target.value)) })}
          className="mt-2 w-full accent-[var(--accent)]"
        />
        <p className="mt-1 text-xs text-text-muted">
          {focusName ? "Focus follows them as the camera or they move. Drag the slider to pull by hand." : "Pulled by hand."}
        </p>
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
        <Readout k="Lens" v={`${Math.round(shot.focal)}mm at f/${shot.stop}`} />
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
          {shot.board ? (
            <button type="button" onClick={() => onChange({ board: null })} className="rounded-[10px] px-2 py-1.5 text-xs font-semibold text-text-muted hover:text-text">
              Remove
            </button>
          ) : null}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onBoardFile(e.target.files?.[0])} />
        <p className="mt-1 text-xs text-text-muted">Stays in this browser. Nothing is uploaded.</p>
      </Field>
    </div>
  );
}

function TalentInspector({ t, units, props, moveSeconds, seat, onChange, onDelete }: {
  t: TalentSpec; units: Units; props: ItemSpec[]; moveSeconds: number | null;
  seat: { y: number; name: string } | null;
  onChange: (p: Partial<TalentSpec>) => void; onDelete: () => void;
}) {
  const walk = t.mark ? Math.hypot(t.mark.x - t.x, t.mark.z - t.z) : 0;
  const speed = moveSeconds ? walk / moveSeconds : null;
  const pace = speed === null ? null : speed < 0.6 ? "a slow stroll" : speed < 1.6 ? "a natural walk" : speed < 2.2 ? "a brisk walk" : "a run";
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">Talent</p>
          <input
            aria-label="Name"
            value={t.name}
            onChange={(e) => onChange({ name: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
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
        {t.pose === "seated" ? (
          <p className="mt-2 text-xs text-text-muted">
            {seat
              ? `Sitting on the ${seat.name.toLowerCase()}, seat ${dist(seat.y, units)} up.`
              : `Nothing under them, so they sit on an implied chair (${dist(0.47, units)}). Drag them onto a bed, sofa or chair to sit on it.`}
          </p>
        ) : null}
        {t.pose === "holding" && props.length ? (
          <div className="mt-2">
            <p className="mb-1 text-xs text-text-muted">In the right hand</p>
            <div className="flex flex-wrap gap-1">
              <Chip on={!t.holding} onClick={() => onChange({ holding: null })}>Nothing</Chip>
              {props.map((p) => <Chip key={p.id} on={t.holding === p.id} onClick={() => onChange({ holding: p.id })}>{p.name}</Chip>)}
            </div>
          </div>
        ) : null}
      </Field>
      <Field label={`Facing · ${Math.round(t.facing)}°`}>
        <input
          aria-label="Facing"
          type="range" min={-180} max={180} step={1} value={t.facing}
          onChange={(e) => onChange({ facing: Number(e.target.value) })}
          className="w-full accent-[var(--accent)]"
        />
        <p className="mt-1 text-xs text-text-muted">0° faces the camera side of the room.</p>
      </Field>
      <Field label="Action">
        {t.mark ? (
          <>
            <p className="text-sm">
              Walks {dist(walk, units)} to a mark
              {speed !== null ? <>, {dist(speed, units)}/s: <span className="font-semibold">{pace}</span></> : null}.
            </p>
            <p className="mb-2 text-xs text-text-muted">
              {moveSeconds ? "They set off as the shot plays and land on the mark at the end of the move." : "Give the shot a timeline to play it: a camera move, or Play the action under the frame."}
              {" "}Drag the dashed circle on the map to move the mark.
            </p>
            <Field label={`Facing on the mark · ${Math.round(t.mark.facing)}°`}>
              <input
                aria-label="Facing on the mark"
                type="range" min={-180} max={180} step={1} value={t.mark.facing}
                onChange={(e) => onChange({ mark: { ...t.mark!, facing: Number(e.target.value) } })}
                className="w-full accent-[var(--accent)]"
              />
            </Field>
            <button type="button" onClick={() => onChange({ mark: null })} className="mt-2 text-xs font-semibold text-text-muted hover:text-text">
              Stay put instead
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onChange({ mark: { x: t.x + 1.2, z: t.z, facing: t.facing } })}
            className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-semibold hover:border-border-strong"
          >
            + Walk to a mark
          </button>
        )}
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
      <p className="text-xs text-text-muted">Drag them on the map to block the scene. On a riser or an apple box they stand on it; seated, they sit on whatever is under them. No faces, on purpose: these are stand-ins, not likenesses.</p>
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
    ["Free view", "drag a light, person, grip or set piece to move it; shift-drag to raise it; click to select"],
    ["1, 2, 3", "switch shots"],
    ["Space", "play or stop the camera move"],
    ["V", "through the lens / free view"],
    ["C", "clay view"],
    ["H", "house lights in free view: see the whole stage; never in the shot or the meter"],
    ["F", "frame all: fit every light, camera and set piece in free view"],
    ["B", "storyboard overlay"],
    ["Map", "drag anything; drag a white dot to aim it or turn it"],
    ["Z", "zebras: stripes where the picture clips"],
    ["\\", "focus: hide both side panels and the shot cards for a bigger picture (Esc to leave)"],
    ["Delete", "delete the selected thing, light, bounce or flag"],
    ["Cmd or Ctrl + D", "duplicate the selected thing"],
  ];
  return (
    <div className="absolute left-3 top-14 w-[340px] rounded-[12px] border border-border bg-surface p-4 text-sm shadow-lg">
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
