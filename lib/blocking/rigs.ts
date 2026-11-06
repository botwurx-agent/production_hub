// Shot blocking: what the camera is on. The keys say where the camera goes;
// the rig says how it gets there, the way an operator's rig would carry it:
// a tripod never travels, a gimbal holds the horizon and floats, a Steadicam
// bobs and sways with the operator's stride, a shoulder rig shakes and steps,
// a drone hovers level, an FPV drone banks into its turns.
//
// Pure (no three.js), so it can be tested in node. Everything here is a
// function of time and the keys alone, so a scrub and a recorded clip get the
// same frame.
import { evalCamera, shakeAt, type FlowOpts } from "./keys";
import type { CamKey, Shake, Vec3 } from "./scene";

export type CameraRig = "free" | "tripod" | "gimbal" | "steadicam" | "handheld" | "drone" | "fpv";

export const CAMERA_RIGS: { id: CameraRig; name: string; hint: string; shake: Shake }[] = [
  { id: "free", name: "Free", hint: "Exactly what the keys say, with nothing added.", shake: { amount: 0, speed: 1 } },
  { id: "tripod", name: "Tripod", hint: "Stays where its first key puts it, so it only pans, tilts and zooms. No shake.", shake: { amount: 0, speed: 1 } },
  { id: "gimbal", name: "Gimbal", hint: "Smooth with the horizon held level, a light float, and a soft step while the operator walks.", shake: { amount: 0.1, speed: 0.6 } },
  { id: "steadicam", name: "Steadicam", hint: "Floats: a gentle bob and sway with the operator's stride, and a slow drift in the frame.", shake: { amount: 0.14, speed: 0.45 } },
  { id: "handheld", name: "Handheld", hint: "On the shoulder: shake all the time, and a step in every stride while the operator walks.", shake: { amount: 0.45, speed: 1 } },
  { id: "drone", name: "Drone", hint: "Smooth and level, with a slow hover drift.", shake: { amount: 0.05, speed: 0.3 } },
  { id: "fpv", name: "FPV drone", hint: "Banks into every turn, harder the faster it goes, with a little buzz.", shake: { amount: 0.08, speed: 1.8 } },
];

export const isRig = (v: unknown): v is CameraRig => CAMERA_RIGS.some((r) => r.id === v);
export const rigOf = (id: CameraRig | undefined) => CAMERA_RIGS.find((r) => r.id === (id ?? "free")) ?? CAMERA_RIGS[0];

/** A rig whose position stays put: the camera only turns and zooms. */
export const holdsPosition = (rig: CameraRig | undefined) => rig === "tripod";

/** How an operator on foot steps: one step every STEP metres. */
const STEP = 0.72;

/** Per rig: vertical dip per step, side sway per stride, roll and nod per step (degrees). */
const STRIDE: Partial<Record<CameraRig, { dip: number; sway: number; roll: number; nod: number }>> = {
  gimbal: { dip: 0.006, sway: 0.003, roll: 0, nod: 0.08 },
  steadicam: { dip: 0.012, sway: 0.009, roll: 0.25, nod: 0.15 },
  handheld: { dip: 0.024, sway: 0.012, roll: 0.9, nod: 0.45 },
};

const smoothstep = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

type PathOpts = { smooth: boolean } & FlowOpts;
const posAt = (keys: CamKey[], t: number, o: PathOpts) => evalCamera(keys, t, o.smooth, o).p;

/** Horizontal velocity of the path at t, in the camera's parent frame. */
function velocity(keys: CamKey[], t: number, o: PathOpts, h: number): [number, number] {
  const t0 = Math.max(0, t - h);
  const a = posAt(keys, t0, o);
  const b = posAt(keys, t + h, o);
  const span = t + h - t0;
  return [(b[0] - a[0]) / span, (b[2] - a[2]) / span];
}

/** Distance along the ground so far, sampled every DT, per keys array (an edit makes a new one). */
const DT = 1 / 60;
const tables = new WeakMap<CamKey[], Map<string, number[]>>();
function distanceAt(keys: CamKey[], t: number, o: PathOpts): number {
  let byOpts = tables.get(keys);
  if (!byOpts) { byOpts = new Map(); tables.set(keys, byOpts); }
  const ok = `${o.smooth}|${o.flow}|${o.easeEnds}`;
  let tab = byOpts.get(ok);
  if (!tab) { tab = [0]; byOpts.set(ok, tab); }
  const need = Math.ceil(Math.max(0, t) / DT) + 1;
  let prev = posAt(keys, (tab.length - 1) * DT, o);
  while (tab.length <= need) {
    const cur = posAt(keys, tab.length * DT, o);
    tab.push(tab[tab.length - 1] + Math.hypot(cur[0] - prev[0], cur[2] - prev[2]));
    prev = cur;
  }
  const x = Math.max(0, t) / DT;
  const i = Math.floor(x);
  return tab[i] + (tab[i + 1] - tab[i]) * (x - i);
}

/** Which way the path heads, as a camera yaw (0 looks down -Z), degrees. */
const heading = (v: [number, number]) => (Math.atan2(-v[0], -v[1]) * 180) / Math.PI;

/**
 * What the rig adds at t, on top of the camera as the keys (and any aim lock)
 * put it: an offset in metres in the camera's parent frame, and degrees of
 * yaw, pitch and roll. The shake is included, shaped to the rig.
 */
export function rigMotion(rig: CameraRig | undefined, keys: CamKey[], t: number, o: PathOpts, shake: Shake): { p: Vec3; r: Vec3 } {
  const id = rig ?? "free";
  if (id === "tripod") return { p: [0, 0, 0], r: [0, 0, 0] };
  const sh = shakeAt(t, shake.amount, shake.speed);
  const p: Vec3 = [...sh.p];
  const r: Vec3 = [...sh.r];
  // A gimbal and a cinema drone hold the horizon: the shake floats, it never tilts.
  if (id === "gimbal" || id === "drone") r[2] = 0;
  if (keys.length < 2) return { p, r };

  const stride = STRIDE[id];
  if (stride) {
    const v = velocity(keys, t, o, 1 / 30);
    const speed = Math.hypot(v[0], v[1]);
    // The operator is walking (or running): not standing, and not in a car.
    const w = smoothstep(0.15, 0.6, speed) * (1 - smoothstep(5, 8, speed));
    if (w > 1e-3) {
      const phase = distanceAt(keys, t, o) / STEP;
      const dip = -stride.dip * (1 - Math.cos(2 * Math.PI * phase)) * 0.5;
      const sway = stride.sway * Math.sin(Math.PI * phase);
      // Sideways is across the direction of travel.
      const rx = v[1] / speed;
      const rz = -v[0] / speed;
      p[0] += w * sway * rx;
      p[1] += w * dip;
      p[2] += w * sway * rz;
      r[1] += w * stride.nod * Math.sin(2 * Math.PI * phase);
      r[2] += w * stride.roll * Math.sin(Math.PI * phase);
    }
  }

  if (id === "fpv") {
    // Banked into the turn: the angle a craft leans to turn at this speed
    // (tan(bank) = lateral acceleration / g), read over a fifth of a second
    // so it eases in and out rather than snapping.
    const h = 0.2;
    const v0 = velocity(keys, Math.max(0, t - h), o, 1 / 30);
    const v1 = velocity(keys, t + h, o, 1 / 30);
    const speed = (Math.hypot(v0[0], v0[1]) + Math.hypot(v1[0], v1[1])) / 2;
    if (speed > 0.3) {
      let dpsi = heading(v1) - heading(v0);
      dpsi = ((dpsi + 540) % 360) - 180;
      const span = t + h - Math.max(0, t - h);
      const omega = (dpsi * Math.PI) / 180 / span;
      const bank = (Math.atan((speed * omega) / 9.81) * 180) / Math.PI;
      // Turning left (yaw rising) leans left, which is negative roll here.
      r[2] += -Math.max(-40, Math.min(40, bank)) * smoothstep(0.3, 2, speed);
    }
  }
  return { p, r };
}
