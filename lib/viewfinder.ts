// The phone viewfinder's maths: calibrating a phone camera, framing a cine
// lens through it, and reading tilt and roll off the motion sensor.
//
// Pure (no "server-only", no DOM), so it can be unit tested, and so the
// viewfinder, the calibration screen and a still's stored metadata all agree.
//
// THE MODEL IS A PINHOLE, measured rather than looked up. A website cannot ask
// a phone how wide its lens is, and the published "26mm" is a rounded,
// marketing-friendly figure for a stream the browser may then crop. So the
// app learns each camera's focal length IN STREAM PIXELS from a measurement:
// a flat object of known width W, square to the lens at distance D, spans p
// pixels, and for a pinhole p = f * W / D exactly, wherever the object sits in
// the frame. That is what makes the calibration honest rather than a guess.
//
// f is stored NORMALISED by the stream's long side, because the same camera
// streams at different sizes (and portrait swaps width and height) while the
// long side keeps covering the full sensor width. Phones that crop a 16:9
// stream out of a 4:3 sensor crop the SHORT side, so the long side still
// spans the same angle and the normalised figure carries across.
import { BODIES, imagedArea, type CameraBody } from "./previz/optics";

export type Reading = {
  /** The object's width, metres. */
  widthM: number;
  /** Lens to the object's plane, metres, measured square to it. */
  distanceM: number;
  /** How many stream pixels the object spans. */
  spanPx: number;
  /** The stream's long side when it was read, pixels. */
  longPx: number;
};

/** Focal length in stream pixels per stream-long-side pixel. */
export function focalNorm(r: Reading): number | null {
  if (!(r.widthM > 0) || !(r.distanceM > 0) || !(r.spanPx > 0) || !(r.longPx > 0)) return null;
  return (r.spanPx * r.distanceM) / r.widthM / r.longPx;
}

/** Horizontal field of view across the long side, in degrees. */
export function longFovDeg(fNorm: number): number {
  return (2 * Math.atan(1 / (2 * fNorm)) * 180) / Math.PI;
}

export type CalibrationSummary = {
  fNorm: number;
  fovDeg: number;
  /** Largest disagreement between two readings, in degrees of field. */
  spreadDeg: number;
  count: number;
};

/**
 * Average several readings. They are averaged as field of view rather than as
 * focal length, since the field is what the frame lines depend on, and the
 * spread is reported so a bad reading (the tape slipped, a distance typed as
 * feet) is visible rather than quietly pulling the mean.
 */
export function summarize(readings: Reading[]): CalibrationSummary | null {
  const fs = readings.map(focalNorm).filter((f): f is number => f !== null && Number.isFinite(f));
  if (!fs.length) return null;
  const fovs = fs.map(longFovDeg);
  const mean = fovs.reduce((a, b) => a + b, 0) / fovs.length;
  const fNorm = 1 / (2 * Math.tan((mean * Math.PI) / 360));
  return { fNorm, fovDeg: mean, spreadDeg: Math.max(...fovs) - Math.min(...fovs), count: fs.length };
}

/**
 * How far one reading sits from the rest, in degrees, so the screen can point
 * at the odd one out. Zero for a single reading.
 */
export function outlierDeg(readings: Reading[], i: number): number {
  const others = readings.filter((_, j) => j !== i);
  const me = focalNorm(readings[i]);
  const rest = summarize(others);
  if (me === null || !rest) return 0;
  return Math.abs(longFovDeg(me) - rest.fovDeg);
}

/**
 * The frame a cine lens draws, as half-angle tangents. tanX is across the
 * frame's width and tanY across its height, so the box on screen is
 * 2*f*tanX by 2*f*tanY stream pixels.
 */
export function targetTans(body: CameraBody, focalMm: number, aspect: number): { tanX: number; tanY: number } {
  const a = imagedArea(body, aspect);
  return { tanX: a.w / (2 * focalMm), tanY: a.h / (2 * focalMm) };
}

export type Crop = {
  /** The target frame in stream pixels, centred on the stream. */
  w: number;
  h: number;
  x: number;
  y: number;
  /** False when the lens sees more than this phone camera does. */
  fits: boolean;
};

/** Where the cine frame sits on the phone's stream. */
export function cropFor(
  fNorm: number,
  stream: { w: number; h: number },
  tans: { tanX: number; tanY: number },
): Crop {
  const f = fNorm * Math.max(stream.w, stream.h);
  const w = 2 * f * tans.tanX;
  const h = 2 * f * tans.tanY;
  return {
    w, h,
    x: (stream.w - w) / 2,
    y: (stream.h - h) / 2,
    fits: w <= stream.w + 0.5 && h <= stream.h + 0.5,
  };
}

/**
 * The widest lens this calibrated camera can show on a body at an aspect,
 * rounded up to the next whole millimetre, so "wider than this phone" can be
 * stated as a number before anyone picks one.
 */
export function widestFocal(fNorm: number, stream: { w: number; h: number }, body: CameraBody, aspect: number): number {
  const f = fNorm * Math.max(stream.w, stream.h);
  const a = imagedArea(body, aspect);
  // w = f * a.w / focal <= stream.w, so focal >= f * a.w / stream.w.
  return Math.ceil(Math.max((f * a.w) / stream.w, (f * a.h) / stream.h));
}

export type PhoneCamera = { id: string; label: string; fNorm: number };

/**
 * Which calibrated phone camera to frame a lens through: the NARROWEST one
 * that still shows the whole frame, since cropping less of the sensor keeps
 * more resolution (a 100mm through the telephoto is sharper than through the
 * main camera's middle). Falls back to the widest when none can show it all.
 */
export function bestCamera(
  cams: PhoneCamera[],
  stream: { w: number; h: number },
  tans: { tanX: number; tanY: number },
): PhoneCamera | null {
  if (!cams.length) return null;
  const fitting = cams.filter((c) => cropFor(c.fNorm, stream, tans).fits);
  if (fitting.length) return fitting.reduce((a, b) => (b.fNorm > a.fNorm ? b : a));
  return cams.reduce((a, b) => (b.fNorm < a.fNorm ? b : a));
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Tilt of the back camera's axis, degrees, positive looking up, from the
 * DeviceOrientation beta and gamma. The camera looks down the device's -Z, and
 * with the spec's Z-X'-Y'' order that axis's vertical component is
 * cos(beta) * cos(gamma). Being one component of a rotation matrix, it is
 * continuous through the landscape positions where beta and gamma themselves
 * jump, so it holds whichever way the phone is turned.
 */
export function cameraTilt(betaDeg: number, gammaDeg: number): number {
  const up = -Math.cos(rad(betaDeg)) * Math.cos(rad(gammaDeg));
  return deg(Math.asin(Math.max(-1, Math.min(1, up))));
}

/**
 * Roll of the picture, degrees, zero when the screen's horizontal is level,
 * positive when the right side of the screen is low. `screenAngle` is
 * screen.orientation.angle (0 portrait, 90 when the phone is turned
 * counterclockwise into landscape, 270 the other way).
 *
 * Gravity in device coordinates is (cos b sin g, -sin b, -cos b cos g). The
 * screen's right and up axes are the device's x and y rotated by the screen
 * angle, and roll is gravity's lean away from screen-down.
 */
export function cameraRoll(betaDeg: number, gammaDeg: number, screenAngle: number): number {
  const b = rad(betaDeg);
  const g = rad(gammaDeg);
  const gx = Math.cos(b) * Math.sin(g);
  const gy = -Math.sin(b);
  const a = rad(screenAngle);
  const right = gx * Math.cos(a) - gy * Math.sin(a);
  const up = gx * Math.sin(a) + gy * Math.cos(a);
  return deg(Math.atan2(right, -up));
}

/** Distances typed on set: 8' 6", 8'6, 8.5 ft, 2.6 m, 260 cm, 102 in, or a bare number in the given unit. */
export function parseDistance(raw: string, unit: "ft" | "m"): number | null {
  const s = raw.trim().toLowerCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  if (!s) return null;
  const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/);
  if (ftIn) return Number(ftIn[1]) * 0.3048 + (ftIn[2] ? Number(ftIn[2]) * 0.0254 : 0);
  const inch = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)$/);
  if (inch) return Number(inch[1]) * 0.0254;
  const cm = s.match(/^(\d+(?:\.\d+)?)\s*cm$/);
  if (cm) return Number(cm[1]) / 100;
  const mm = s.match(/^(\d+(?:\.\d+)?)\s*mm$/);
  if (mm) return Number(mm[1]) / 1000;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*m$/);
  if (m) return Number(m[1]);
  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return unit === "ft" ? Number(bare[1]) * 0.3048 : Number(bare[1]);
  return null;
}

export function bodyById(id: string | null | undefined): CameraBody {
  return BODIES.find((b) => b.id === id) ?? BODIES.find((b) => b.id === "alexamini")!;
}
