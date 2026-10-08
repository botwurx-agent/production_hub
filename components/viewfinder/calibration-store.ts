"use client";

// Where a phone keeps what it has learned about its own cameras. In this
// browser's localStorage, because a calibration is a fact about THIS PHONE'S
// lens, not about a person or a studio: the same account on a different phone
// needs its own. Clearing site data loses it, and the viewfinder says so.
import { summarize, type Reading } from "@/lib/viewfinder";

const KEY = "viewfinder.calibration.v1";
const SETTINGS = "viewfinder.settings.v1";

export type CameraCalibration = {
  label: string;
  deviceId: string;
  readings: Reading[];
  fNorm: number;
  at: string;
};

type Store = Record<string, CameraCalibration>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === "object" ? (o as Store) : {};
  } catch {
    return {};
  }
}

function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: the calibration lasts this visit only */
  }
}

/**
 * Keyed by the camera's LABEL ("Back Ultra Wide Camera"), falling back to the
 * device id, because Safari can rotate device ids between visits while the
 * label of a physical lens stays put.
 */
export const camKey = (c: { label: string; deviceId: string }) => (c.label || c.deviceId).trim();

export function allCalibrations(): Store {
  return read();
}

export function calibrationFor(c: { label: string; deviceId: string }): CameraCalibration | null {
  const s = read();
  return s[camKey(c)] ?? Object.values(s).find((x) => x.deviceId === c.deviceId) ?? null;
}

export function saveCalibration(c: { label: string; deviceId: string }, readings: Reading[]): CameraCalibration | null {
  const sum = summarize(readings);
  if (!sum) return null;
  const s = read();
  const rec: CameraCalibration = { label: c.label, deviceId: c.deviceId, readings, fNorm: sum.fNorm, at: new Date().toISOString() };
  s[camKey(c)] = rec;
  write(s);
  return rec;
}

export function clearCalibration(c: { label: string; deviceId: string }) {
  const s = read();
  delete s[camKey(c)];
  write(s);
}

export type ViewSettings = { bodyId: string; focal: number; aspectId: string; units: "ft" | "m"; autoCam: boolean };

export function readSettings(): Partial<ViewSettings> {
  try {
    const raw = localStorage.getItem(SETTINGS);
    return raw ? (JSON.parse(raw) as Partial<ViewSettings>) : {};
  } catch {
    return {};
  }
}

export function writeSettings(v: ViewSettings) {
  try {
    localStorage.setItem(SETTINGS, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
