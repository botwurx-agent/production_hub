/**
 * A game controller (Xbox, PlayStation, any pad the browser lists) as the
 * camera's hand controller in shot blocking. Pure: what each control does,
 * the default layout, reading a layout back out of storage, and turning a
 * pad's raw sticks and buttons into camera motion. No DOM, so it is tested
 * on its own.
 *
 * The model is a motion control desk's: the sticks JOG the camera to a
 * framing, and a button STORES that framing as a keyframe at the playhead.
 * Jogging by itself writes nothing.
 */

/** Things a stick or a pair of buttons drives, each a signed amount. */
export const ANALOG_ACTIONS = [
  { id: "truck", name: "Truck", neg: "left", pos: "right" },
  { id: "push", name: "Push in / pull out", neg: "pull out", pos: "push in" },
  { id: "boom", name: "Boom", neg: "down", pos: "up" },
  { id: "pan", name: "Pan", neg: "left", pos: "right" },
  { id: "tilt", name: "Tilt", neg: "down", pos: "up" },
  { id: "zoom", name: "Zoom", neg: "out", pos: "in" },
  { id: "roll", name: "Roll", neg: "left", pos: "right" },
] as const;
export type AnalogAction = (typeof ANALOG_ACTIONS)[number]["id"];

/** Things one press does. */
export const BUTTON_ACTIONS = [
  { id: "key", name: "Set a keyframe", hint: "Stores the framing at the playhead" },
  { id: "discard", name: "Discard the framing", hint: "Back to where the keyframes put the camera" },
  { id: "play", name: "Play / pause" },
  { id: "view", name: "Camera view / free view" },
  { id: "prevFrame", name: "Back one frame", repeat: true },
  { id: "nextFrame", name: "Forward one frame", repeat: true },
  { id: "prevKey", name: "Previous keyframe" },
  { id: "nextKey", name: "Next keyframe" },
  { id: "undo", name: "Undo" },
  { id: "redo", name: "Redo" },
  { id: "speed", name: "Change speed", hint: "Fine, Normal, Fast" },
  { id: "level", name: "Level the camera", hint: "Tilt and roll back to zero" },
  { id: "deleteKey", name: "Delete the keyframe here" },
  { id: "start", name: "Jump to the start" },
] as const;
export type ButtonAction = (typeof BUTTON_ACTIONS)[number]["id"];

export type AnalogBinding =
  | { kind: "axis"; index: number; invert: boolean }
  | { kind: "buttons"; neg: number; pos: number }
  | null;

export type PadMap = {
  analog: Record<AnalogAction, AnalogBinding>;
  buttons: Record<ButtonAction, number | null>;
};

export type PadSpeed = "fine" | "normal" | "fast";
export type PadSettings = {
  speed: PadSpeed;
  /** Stick travel ignored round the centre, 0.05 to 0.4. */
  deadZone: number;
  invertTilt: boolean;
  /** A short buzz when a keyframe is stored. */
  rumble: boolean;
};

export type PadConfig = { map: PadMap; settings: PadSettings };

/**
 * The default layout, on the browser's "standard" numbering (an Xbox pad):
 * axes 0/1 left stick, 2/3 right stick; buttons 0 A, 1 B, 2 X, 3 Y, 4 LB,
 * 5 RB, 6 LT, 7 RT, 8 View, 9 Menu, 10 L3, 11 R3, 12 to 15 the D-pad.
 * A stick's up is negative, so push and tilt are inverted.
 */
export const DEFAULT_MAP: PadMap = {
  analog: {
    truck: { kind: "axis", index: 0, invert: false },
    push: { kind: "axis", index: 1, invert: true },
    pan: { kind: "axis", index: 2, invert: false },
    tilt: { kind: "axis", index: 3, invert: true },
    boom: { kind: "buttons", neg: 6, pos: 7 },
    zoom: { kind: "buttons", neg: 4, pos: 5 },
    roll: null,
  },
  buttons: {
    key: 0,
    discard: 1,
    play: 2,
    view: 3,
    prevFrame: 14,
    nextFrame: 15,
    nextKey: 12,
    prevKey: 13,
    undo: 8,
    redo: 9,
    speed: 10,
    level: 11,
    deleteKey: null,
    start: null,
  },
};

export const DEFAULT_SETTINGS: PadSettings = { speed: "normal", deadZone: 0.15, invertTilt: false, rumble: true };

export const defaultConfig = (): PadConfig => ({
  map: { analog: { ...DEFAULT_MAP.analog }, buttons: { ...DEFAULT_MAP.buttons } },
  settings: { ...DEFAULT_SETTINGS },
});

const MAX_INDEX = 63;
const index = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_INDEX ? v : null;

function analogBinding(v: unknown): AnalogBinding | undefined {
  if (v === null) return null;
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (o.kind === "axis") {
    const i = index(o.index);
    return i === null ? undefined : { kind: "axis", index: i, invert: o.invert === true };
  }
  if (o.kind === "buttons") {
    const n = index(o.neg);
    const p = index(o.pos);
    return n === null || p === null || n === p ? undefined : { kind: "buttons", neg: n, pos: p };
  }
  return undefined;
}

/**
 * A layout read back from storage. Anything unreadable falls back to the
 * default for that one control, so a half-broken value never leaves the
 * controller dead.
 */
export function parseConfig(raw: unknown): PadConfig {
  const out = defaultConfig();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  const m = (r.map ?? {}) as Record<string, unknown>;
  const a = (m.analog ?? {}) as Record<string, unknown>;
  const b = (m.buttons ?? {}) as Record<string, unknown>;
  for (const act of ANALOG_ACTIONS) {
    if (!(act.id in a)) continue;
    const v = analogBinding(a[act.id]);
    if (v !== undefined) out.map.analog[act.id] = v;
  }
  for (const act of BUTTON_ACTIONS) {
    if (!(act.id in b)) continue;
    const v = b[act.id];
    if (v === null) out.map.buttons[act.id] = null;
    else {
      const i = index(v);
      if (i !== null) out.map.buttons[act.id] = i;
    }
  }
  const s = (r.settings ?? {}) as Record<string, unknown>;
  if (s.speed === "fine" || s.speed === "normal" || s.speed === "fast") out.settings.speed = s.speed;
  if (typeof s.deadZone === "number" && Number.isFinite(s.deadZone)) out.settings.deadZone = Math.min(0.4, Math.max(0.05, s.deadZone));
  if (typeof s.invertTilt === "boolean") out.settings.invertTilt = s.invertTilt;
  if (typeof s.rumble === "boolean") out.settings.rumble = s.rumble;
  return out;
}

/** What a pad reports at one moment, copied out of the browser's object. */
export type PadState = { axes: number[]; buttons: number[] };

/**
 * A stick's travel as a drive amount: nothing inside the dead zone, then a
 * squared curve to full, so small pushes are fine moves and the last of the
 * travel is where the speed is.
 */
export function shape(v: number, deadZone: number): number {
  if (!Number.isFinite(v)) return 0;
  const m = Math.abs(v);
  if (m <= deadZone) return 0;
  const k = Math.min(1, (m - deadZone) / (1 - deadZone));
  return Math.sign(v) * k * k;
}

/** A trigger or button as 0..1 (triggers are analogue; a small rest value is ignored). */
const pressure = (v: number | undefined) => (typeof v === "number" && v > 0.06 ? Math.min(1, v) : 0);

/** One control's signed amount, -1..1. */
export function readAnalog(pad: PadState, b: AnalogBinding, deadZone: number): number {
  if (!b) return 0;
  if (b.kind === "axis") {
    const v = shape(pad.axes[b.index] ?? 0, deadZone);
    return b.invert ? -v : v;
  }
  return pressure(pad.buttons[b.pos]) - pressure(pad.buttons[b.neg]);
}

export type Drive = Record<AnalogAction, number>;

export function readDrive(pad: PadState, cfg: PadConfig): Drive {
  const d = {} as Drive;
  for (const a of ANALOG_ACTIONS) d[a.id] = readAnalog(pad, cfg.map.analog[a.id], cfg.settings.deadZone);
  if (cfg.settings.invertTilt) d.tilt = -d.tilt;
  return d;
}

export const driving = (d: Drive) => ANALOG_ACTIONS.some((a) => d[a.id] !== 0);

export const SPEEDS: { id: PadSpeed; name: string; k: number }[] = [
  { id: "fine", name: "Fine", k: 0.3 },
  { id: "normal", name: "Normal", k: 1 },
  { id: "fast", name: "Fast", k: 3 },
];
export const nextSpeed = (s: PadSpeed): PadSpeed => SPEEDS[(SPEEDS.findIndex((x) => x.id === s) + 1) % SPEEDS.length].id;

/** Rates at Normal with a control held fully over. */
export const RATES = { move: 1.5, boom: 1, pan: 60, tilt: 45, roll: 30, zoom: 0.9 };

export type JogPose = { p: [number, number, number]; r: [number, number, number]; lens: number };

/**
 * One frame of jogging. Truck and push stay level with the floor, the way a
 * dolly moves; boom is straight up. Pan and tilt slow down on a long lens,
 * so a subject crosses the frame at about the same speed at 24mm and 135mm.
 * Angles follow the editor's: yaw turns left when it grows, pitch is up.
 */
export function jog(pose: JogPose, d: Drive, dt: number, speed: PadSpeed): JogPose {
  const k = (SPEEDS.find((s) => s.id === speed)?.k ?? 1) * dt;
  const y = (pose.r[0] * Math.PI) / 180;
  const side = d.truck * RATES.move * k;
  const fwd = d.push * RATES.move * k;
  const turn = Math.min(1.5, Math.max(0.15, 35 / Math.max(1, pose.lens)));
  return {
    p: [
      pose.p[0] + Math.cos(y) * side - Math.sin(y) * fwd,
      Math.max(0.05, pose.p[1] + d.boom * RATES.boom * k),
      pose.p[2] - Math.sin(y) * side - Math.cos(y) * fwd,
    ],
    r: [
      pose.r[0] - d.pan * RATES.pan * turn * k,
      Math.max(-89, Math.min(89, pose.r[1] + d.tilt * RATES.tilt * turn * k)),
      Math.max(-90, Math.min(90, pose.r[2] + d.roll * RATES.roll * k)),
    ],
    lens: Math.min(600, Math.max(8, pose.lens * Math.exp(d.zoom * RATES.zoom * k))),
  };
}

/* ---------- pressing buttons ---------- */

const DOWN = 0.5;
export const isDown = (pad: PadState, i: number | null) => i !== null && (pad.buttons[i] ?? 0) > DOWN;

/** Buttons that went down since the last look. */
export function pressed(prev: PadState | null, now: PadState): number[] {
  const out: number[] = [];
  for (let i = 0; i < now.buttons.length; i++) {
    if ((now.buttons[i] ?? 0) > DOWN && !((prev?.buttons[i] ?? 0) > DOWN)) out.push(i);
  }
  return out;
}

/* ---------- learning a new control ---------- */

export type Heard = { kind: "axis"; index: number; invert: boolean } | { kind: "button"; index: number };

/**
 * What the person just did, against how the pad sat when listening began:
 * a button newly down, else the stick pushed furthest (past 0.6). A trigger
 * that reports as an axis and rests at -1 is handled by comparing with rest.
 */
export function hear(rest: PadState, now: PadState): Heard | null {
  for (let i = 0; i < now.buttons.length; i++) {
    if ((now.buttons[i] ?? 0) > 0.6 && !((rest.buttons[i] ?? 0) > 0.3)) return { kind: "button", index: i };
  }
  let best = -1;
  let move = 0;
  for (let i = 0; i < now.axes.length; i++) {
    const d = (now.axes[i] ?? 0) - (rest.axes[i] ?? 0);
    if (Math.abs(d) > Math.abs(move)) { move = d; best = i; }
  }
  if (best >= 0 && Math.abs(move) > 0.6) return { kind: "axis", index: best, invert: move < 0 };
  return null;
}

/** Whether a binding uses this raw control. */
const usesButton = (b: AnalogBinding, i: number) => !!b && b.kind === "buttons" && (b.neg === i || b.pos === i);
const usesAxis = (b: AnalogBinding, i: number) => !!b && b.kind === "axis" && b.index === i;

/**
 * Gives a control to an action. Whatever else used that same stick or button
 * loses it, so one press never does two things; the names of what lost it
 * come back so the window can say so.
 */
export function bindAnalog(map: PadMap, action: AnalogAction, b: AnalogBinding): { map: PadMap; freed: string[] } {
  const next: PadMap = { analog: { ...map.analog }, buttons: { ...map.buttons } };
  const freed: string[] = [];
  const takeButton = (i: number) => {
    for (const a of ANALOG_ACTIONS) if (a.id !== action && usesButton(next.analog[a.id], i)) { next.analog[a.id] = null; freed.push(a.name); }
    for (const a of BUTTON_ACTIONS) if (next.buttons[a.id] === i) { next.buttons[a.id] = null; freed.push(a.name); }
  };
  if (b?.kind === "axis") {
    for (const a of ANALOG_ACTIONS) if (a.id !== action && usesAxis(next.analog[a.id], b.index)) { next.analog[a.id] = null; freed.push(a.name); }
  } else if (b?.kind === "buttons") {
    takeButton(b.neg);
    takeButton(b.pos);
  }
  next.analog[action] = b;
  return { map: next, freed };
}

export function bindButton(map: PadMap, action: ButtonAction, i: number | null): { map: PadMap; freed: string[] } {
  const next: PadMap = { analog: { ...map.analog }, buttons: { ...map.buttons } };
  const freed: string[] = [];
  if (i !== null) {
    for (const a of ANALOG_ACTIONS) if (usesButton(next.analog[a.id], i)) { next.analog[a.id] = null; freed.push(a.name); }
    for (const a of BUTTON_ACTIONS) if (a.id !== action && next.buttons[a.id] === i) { next.buttons[a.id] = null; freed.push(a.name); }
  }
  next.buttons[action] = i;
  return { map: next, freed };
}

/* ---------- names ---------- */

const XBOX_BUTTONS = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "Left stick click", "Right stick click", "D-pad up", "D-pad down", "D-pad left", "D-pad right", "Xbox button"];
const XBOX_AXES = ["Left stick, left and right", "Left stick, up and down", "Right stick, left and right", "Right stick, up and down"];

/** `standard` is the browser saying the pad follows the usual numbering. */
export const buttonName = (i: number, standard: boolean) => (standard && XBOX_BUTTONS[i]) || `Button ${i + 1}`;
export const axisName = (i: number, standard: boolean) => (standard && XBOX_AXES[i]) || `Axis ${i + 1}`;

export function bindingName(b: AnalogBinding, standard: boolean): string {
  if (!b) return "Not set";
  if (b.kind === "axis") return axisName(b.index, standard);
  return `${buttonName(b.neg, standard)} / ${buttonName(b.pos, standard)}`;
}
