// Camera and lens truth for the Scene Setup previz (see CLAUDE.md, "Scene
// Setup: 3D previz"). Pure maths, no three.js and no "server-only", so it can be
// unit tested and so the viewport, the readouts and (later) the shot list all
// agree about what a 35mm on a given body actually sees.
//
// Units: millimetres for anything optical (focal length, sensor, circle of
// confusion), metres for anything in the scene (distances, heights). The two
// meet in dofLimits / blurDiameterMm, which convert explicitly.

export type CameraBody = {
  id: string;
  name: string;
  /** The recording area used here, in mm. Open gate where the body has one. */
  sensorW: number;
  sensorH: number;
  format: "S35" | "FF" | "LF";
};

// Recording areas, not marketing sensor sizes: what a DP frames with.
export const BODIES: CameraBody[] = [
  { id: "alexa35", name: "ARRI Alexa 35", sensorW: 27.99, sensorH: 19.22, format: "S35" },
  { id: "alexamini", name: "ARRI Alexa Mini", sensorW: 28.25, sensorH: 18.17, format: "S35" },
  { id: "alexaminilf", name: "ARRI Alexa Mini LF", sensorW: 36.7, sensorH: 25.54, format: "LF" },
  { id: "venice2", name: "Sony Venice 2", sensorW: 36.0, sensorH: 24.0, format: "FF" },
  { id: "fx6", name: "Sony FX6", sensorW: 35.6, sensorH: 20.0, format: "FF" },
  { id: "vraptor", name: "RED V-Raptor 8K VV", sensorW: 40.96, sensorH: 21.6, format: "LF" },
  { id: "komodo", name: "RED Komodo 6K", sensorW: 27.03, sensorH: 14.26, format: "S35" },
  { id: "c70", name: "Canon C70", sensorW: 26.2, sensorH: 13.8, format: "S35" },
  { id: "pocket6k", name: "Blackmagic Pocket 6K", sensorW: 23.1, sensorH: 12.99, format: "S35" },
];

export const PRIMES = [14, 18, 21, 25, 29, 32, 35, 40, 50, 65, 75, 85, 100, 135];
export const STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];

export type FrameAspect = { id: string; label: string; ratio: number };
export const ASPECTS: FrameAspect[] = [
  { id: "16x9", label: "16:9", ratio: 16 / 9 },
  { id: "239", label: "2.39:1", ratio: 2.39 },
  { id: "185", label: "1.85:1", ratio: 1.85 },
  { id: "4x5", label: "4:5", ratio: 4 / 5 },
  { id: "9x16", label: "9:16", ratio: 9 / 16 },
  { id: "1x1", label: "1:1", ratio: 1 },
];

/**
 * The part of the sensor a delivery aspect actually uses, in mm. A frame wider
 * than the sensor uses the full width and crops height; a taller one uses the
 * full height and crops width. 9:16 on a landscape body is therefore a crop,
 * which is honest: nobody rotated the camera in this prototype.
 */
export function imagedArea(body: CameraBody, ratio: number): { w: number; h: number } {
  const sensorRatio = body.sensorW / body.sensorH;
  if (ratio >= sensorRatio) return { w: body.sensorW, h: body.sensorW / ratio };
  return { w: body.sensorH * ratio, h: body.sensorH };
}

/** Field of view in degrees across one dimension of the imaged area. */
export function fovDeg(sizeMm: number, focalMm: number): number {
  return (2 * Math.atan(sizeMm / (2 * focalMm)) * 180) / Math.PI;
}

/**
 * Acceptable circle of confusion, from the usual diagonal / 1500 convention.
 * Lands near 0.025mm on Super 35 and 0.029mm on full frame, matching the
 * values the common DOF calculators use for those formats.
 */
export function circleOfConfusion(body: CameraBody): number {
  return Math.hypot(body.sensorW, body.sensorH) / 1500;
}

/**
 * Near and far limits of acceptable focus, in metres. `far` is Infinity past
 * the hyperfocal distance. Standard thin-lens formulas.
 */
export function dofLimits(
  focalMm: number,
  stop: number,
  focusM: number,
  cocMm: number,
): { near: number; far: number; hyperfocal: number } {
  const f = focalMm;
  const s = Math.max(focusM * 1000, f * 1.01);
  const H = (f * f) / (stop * cocMm) + f;
  const near = (s * (H - f)) / (H + s - 2 * f);
  const far = s >= H ? Infinity : (s * (H - f)) / (H - s);
  return { near: near / 1000, far: far / 1000, hyperfocal: H / 1000 };
}

/**
 * Diameter of the blur circle on the sensor, in mm, for a point at `pointM`
 * when focused at `focusM`. This is what the viewport's depth of field shader
 * draws, converted to pixels, so the softness on screen is the lens's and not a
 * slider somebody tuned by eye.
 */
export function blurDiameterMm(focalMm: number, stop: number, focusM: number, pointM: number): number {
  const f = focalMm;
  const s = Math.max(focusM * 1000, f * 1.01);
  const d = Math.max(pointM * 1000, f * 1.01);
  return ((f * f) / (stop * (s - f))) * (Math.abs(d - s) / d);
}

/**
 * Shot size in the shot list's own vocabulary (components/production/
 * shot-board-editor.tsx SHOT_SIZES), read from how much vertical height the
 * frame covers at the subject's distance. A person is the yardstick, so these
 * are about people; on a tabletop the same numbers describe the product.
 */
export function shotSize(frameHeightM: number): string {
  if (frameHeightM < 0.22) return "Extreme Close-up";
  if (frameHeightM < 0.42) return "Close-up";
  if (frameHeightM < 0.7) return "Medium Close-up";
  if (frameHeightM < 1.05) return "Medium Shot";
  if (frameHeightM < 1.45) return "Medium Full Shot";
  if (frameHeightM < 2.4) return "Full Shot";
  if (frameHeightM < 6) return "Wide Shot";
  return "Extreme Wide Shot";
}

/** Camera angle, again in the shot list's words, from the tilt in degrees. */
export function cameraAngle(tiltDeg: number, heightM: number): string {
  if (tiltDeg <= -70) return "Overhead";
  if (heightM < 0.35) return "Ground Level";
  if (tiltDeg <= -12) return "High Angle";
  if (tiltDeg >= 12) return "Low Angle";
  return "Eye Level";
}

/** 2.44 -> 8' 0". Distances on set are spoken in feet in the US. */
export function feet(m: number): string {
  if (!Number.isFinite(m)) return "infinity";
  const totalIn = Math.round(m * 39.3701);
  const ft = Math.floor(totalIn / 12);
  const inch = totalIn % 12;
  return `${ft}' ${inch}"`;
}

export function metres(m: number): string {
  if (!Number.isFinite(m)) return "infinity";
  return m < 10 ? `${m.toFixed(2)} m` : `${m.toFixed(1)} m`;
}
