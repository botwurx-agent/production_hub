"use client";

import type { CSSProperties, ReactNode } from "react";
import { clamp01, lerp, ramp, spring } from "./scene-kit";
import { MARK_BARS } from "@/lib/brand-mark";

/*
 * THE EDIT KIT for films cut from real product footage (tour-film.tsx).
 *
 * Same contract as every marketing scene: everything is a pure function of
 * time, so any frame can be drawn at any moment and a render is identical
 * every run. What is new here is that the picture underneath is REAL: frames
 * photographed out of the running app by scripts/film/capture-tour.mjs. This
 * file is the camera, the pointer and the graphics that go over them.
 *
 * COORDINATES. The footage is a 1280x720 page photographed at 2x or 3x. The
 * film is 1920x1080. So at zoom 1 the page fills the frame exactly, and every
 * position an edit names (where to look, what to circle) is in PAGE pixels,
 * the same numbers the browser reports. Nothing here is measured off a
 * rendered frame by eye.
 */

export const W = 1920;
export const H = 1080;
export const SRC_W = 1280;
export const SRC_H = 720;
const K = W / SRC_W;
const UNDER = 250;

export const INK = "#07061a";
export const GLOW = "color-mix(in oklch, var(--h-indigo) 52%, white)";
export const ACCENT = "var(--h-indigo)";
export const DISPLAY = "var(--font-display), system-ui, sans-serif";
export const BODY = "var(--font-body), system-ui, sans-serif";

export const easeOut4 = (p: number) => 1 - Math.pow(1 - clamp01(p), 4);
export const easeIn4 = (p: number) => Math.pow(clamp01(p), 4);
export const easeIO4 = (p: number) => {
  const q = clamp01(p);
  return q < 0.5 ? 8 * q * q * q * q : 1 - Math.pow(-2 * q + 2, 4) / 2;
};
export const easeOut3 = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);

/* ----------------------------------------------------------------- FOOTAGE */

export type Frame = { i: number; x: number; y: number; d: number };
export type TakeData = { name: string; files: number; marks: Record<string, number>; frames: Frame[] };
export type Takes = Record<string, TakeData>;

export const frameSrc = (take: string, i: number) => `/film-src/${take}/${String(i).padStart(4, "0")}.jpg`;
export const stillSrc = (name: string) => `/film-src/stills/${name}.jpg`;

/**
 * Film time to take frame. `map` is a list of [ms, frame] points, straight
 * lines between them, so an edit can hurry the pointer across the page and
 * then sit on the payoff without the footage being re-shot.
 */
export function frameAt(take: TakeData | undefined, map: [number, number][], t: number): Frame & { n: number } {
  const none = { i: 0, x: -100, y: -100, d: 0, n: 0 };
  if (!take || !take.frames.length) return none;
  let f = map[0][1];
  if (t >= map[map.length - 1][0]) f = map[map.length - 1][1];
  else
    for (let k = 0; k < map.length - 1; k++) {
      const [t0, f0] = map[k];
      const [t1, f1] = map[k + 1];
      if (t >= t0 && t < t1) {
        f = lerp(f0, f1, (t - t0) / (t1 - t0));
        break;
      }
    }
  const n = Math.max(0, Math.min(take.frames.length - 1, Math.round(f)));
  return { ...take.frames[n], n };
}

/** How many frames ago the pointer last went down, or -1. Drives the click ring. */
export function sinceClick(take: TakeData | undefined, n: number): number {
  if (!take) return -1;
  for (let k = n; k > 0 && n - k < 20; k--) {
    if (take.frames[k].d && !take.frames[k - 1].d) return n - k;
  }
  return -1;
}

/* ------------------------------------------------------------------ CAMERA */

export type Cam = { x: number; y: number; z: number };
export type CamKey = Cam & { t: number };

/** Where the camera is at `t`. Zoom moves in log space so a push feels even. */
export function camAt(keys: CamKey[], t: number): Cam {
  if (t <= keys[0].t) return keys[0];
  const last = keys[keys.length - 1];
  if (t >= last.t) return last;
  for (let k = 0; k < keys.length - 1; k++) {
    const a = keys[k];
    const b = keys[k + 1];
    if (t >= a.t && t < b.t) {
      const p = easeIO4((t - a.t) / (b.t - a.t));
      return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), p)) };
    }
  }
  return last;
}

/** The whole page, framed as a window floating on the ground. */
export const WIDE: Cam = { x: SRC_W / 2, y: SRC_H / 2, z: 0.84 };
export const FULL: Cam = { x: SRC_W / 2, y: SRC_H / 2, z: 1 };

/**
 * The camera, resolved: never lets the edge of the page into frame once the
 * page is big enough to cover it. `cy` is where the look-at point sits on
 * screen, lifted a little when a caption is taking the bottom of the frame.
 */
export function resolve(cam: Cam, cy = H / 2) {
  const s = K * cam.z;
  let { x, y } = cam;
  if (SRC_W * s >= W) x = Math.max(W / 2 / s, Math.min(SRC_W - W / 2 / s, x));
  else x = SRC_W / 2;
  // The foot of the frame belongs to the caption, so the page may ride up
  // to UNDER px above it: what shows below the page is the same dark ground
  // the caption's scrim is made of.
  if (SRC_H * s >= H) y = Math.max(cy / s, Math.min(SRC_H - (H - UNDER - cy) / s, y));
  else {
    y = SRC_H / 2;
    cy = H / 2 - (H / 2 - cy) * 0.5;
  }
  return { s, x, y, cy, tx: W / 2 - x * s, ty: cy - y * s };
}

/** Page point to screen point under a camera. */
export function project(cam: Cam, px: number, py: number, cy = H / 2) {
  const r = resolve(cam, cy);
  return { x: r.tx + px * r.s, y: r.ty + py * r.s, s: r.s };
}

/**
 * One piece of footage under a camera. Children are laid out in PAGE pixels
 * and ride with the page (spotlights, pins); anything that must stay a fixed
 * size on screen (the pointer) undoes the scale itself.
 */
export function Screen({ src, cam, cy = H / 2, children, dim = 0 }: { src: string; cam: Cam; cy?: number; children?: ReactNode; dim?: number }) {
  const r = resolve(cam, cy);
  const windowed = clamp01((1 - cam.z) / 0.1);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: SRC_W,
        height: SRC_H,
        transformOrigin: "0 0",
        transform: `translate(${r.tx}px, ${r.ty}px) scale(${r.s})`,
        borderRadius: 14 * windowed,
        overflow: "hidden",
        boxShadow: windowed > 0 ? `0 ${30 / r.s}px ${90 / r.s}px rgba(0,0,0,${0.55 * windowed}), 0 0 0 ${1 / r.s}px rgba(255,255,255,${0.14 * windowed})` : undefined,
        background: "#fff",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={src} src={src} alt="" data-film="1" style={{ display: "block", width: SRC_W, height: SRC_H }} />
      {children}
      {dim > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(7,6,26,${dim})` }} />}
    </div>
  );
}

/* ----------------------------------------------------------------- POINTER */

/** The pointer, drawn by the film so it is never blurred or scaled by a zoom. */
export function Pointer({ x, y, down, since, s }: { x: number; y: number; down: boolean; since: number; s: number }) {
  const ring = since >= 0 && since < 16 ? since / 16 : -1;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `scale(${1 / s})`, transformOrigin: "0 0", zIndex: 50 }}>
      {ring >= 0 && (
        <div
          style={{
            position: "absolute",
            left: -70,
            top: -70,
            width: 140,
            height: 140,
            borderRadius: 999,
            border: `5px solid ${ACCENT}`,
            background: "color-mix(in oklch, var(--h-indigo) 18%, transparent)",
            transform: `scale(${0.25 + 0.75 * easeOut3(ring)})`,
            opacity: 1 - easeIn4(ring),
          }}
        />
      )}
      <svg width="46" height="46" viewBox="0 0 24 24" style={{ position: "absolute", left: -6, top: -4, transform: `scale(${down ? 0.84 : 1})`, transformOrigin: "6px 4px", filter: "drop-shadow(0 4px 6px rgba(0,0,0,.35))" }}>
        <path d="M5 3.2v15.4l4.1-3.9 2.6 5.9 2.5-1.1-2.6-5.8h5.6z" fill="#111" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------- GRAPHICS */

/** Dim the page around one rectangle (page pixels). `p` is 0..1. */
export function Spot({ x, y, w, h, p, r = 10, s, ring = true }: { x: number; y: number; w: number; h: number; p: number; r?: number; s: number; ring?: boolean }) {
  if (p <= 0) return null;
  const grow = lerp(14, 0, easeOut4(p));
  return (
    <div
      style={{
        position: "absolute",
        left: x - grow,
        top: y - grow,
        width: w + grow * 2,
        height: h + grow * 2,
        borderRadius: r,
        boxShadow: `0 0 0 4000px rgba(7,6,26,${0.62 * clamp01(p)})${ring ? `, 0 0 0 ${4 / s}px ${GLOW}, 0 0 ${40 / s}px ${10 / s}px color-mix(in oklch, var(--h-indigo) 55%, transparent)` : ""}`,
        zIndex: 20,
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * A magnifying glass over the page: the same picture again, bigger, in a ring.
 * (px, py) is the page point under the middle of the glass.
 */
export function Lens({ src, cam, cy, px, py, d = 400, m = 2.1, p, label }: { src: string; cam: Cam; cy?: number; px: number; py: number; d?: number; m?: number; p: number; label?: string }) {
  if (p <= 0) return null;
  const at = project(cam, px, py, cy);
  const s = at.s * m;
  const e = spring(clamp01(p));
  return (
    <div style={{ position: "absolute", left: at.x - d / 2, top: at.y - d / 2, width: d, height: d, transform: `scale(${e})`, opacity: clamp01(p * 3), zIndex: 40 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          overflow: "hidden",
          background: "#fff",
          boxShadow: `0 0 0 7px #fff, 0 0 0 11px ${ACCENT}, 0 40px 90px rgba(0,0,0,.55), 0 0 80px color-mix(in oklch, var(--h-indigo) 45%, transparent)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={src} src={src} alt="" data-film="1" style={{ position: "absolute", left: 0, top: 0, width: SRC_W, height: SRC_H, maxWidth: "none", transformOrigin: "0 0", transform: `translate(${d / 2 - px * s}px, ${d / 2 - py * s}px) scale(${s})` }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, boxShadow: "inset 0 0 40px rgba(7,6,26,.22)", background: "linear-gradient(135deg, rgba(255,255,255,.28) 0%, rgba(255,255,255,0) 32%)" }} />
      </div>
      {label && (
        <div style={{ position: "absolute", left: "50%", top: d + 26, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
          <Pill text={label} />
        </div>
      )}
    </div>
  );
}

export type Tone = "dark" | "accent" | "green" | "red";
export function Pill({ text, tone = "dark", size = 34 }: { text: string; tone?: Tone; size?: number }) {
  const bg = tone === "accent" ? ACCENT : tone === "green" ? "color-mix(in oklch, var(--h-green) 80%, black)" : tone === "red" ? "color-mix(in oklch, var(--h-red) 88%, black)" : "rgba(10,9,32,.94)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: `${size * 0.36}px ${size * 0.7}px`,
        borderRadius: 999,
        background: bg,
        color: "#fff",
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: "-0.01em",
        lineHeight: 1,
        boxShadow: "0 14px 40px rgba(0,0,0,.4), inset 0 0 0 1.5px rgba(255,255,255,.16)",
      }}
    >
      {text}
    </span>
  );
}

/** A label pinned to a page point, with a dot on the thing it names. */
export function Tag({ cam, cy, px, py, text, t, at, dx = 0, dy = -74, tone }: { cam: Cam; cy?: number; px: number; py: number; text: string; t: number; at: number; dx?: number; dy?: number; tone?: Tone }) {
  const p = ramp(t, at, 420);
  if (p <= 0) return null;
  const a = project(cam, px, py, cy);
  const e = spring(p);
  return (
    <div style={{ position: "absolute", left: a.x, top: a.y, zIndex: 35, opacity: clamp01(p * 3) }}>
      <div style={{ position: "absolute", left: -9, top: -9, width: 18, height: 18, borderRadius: 99, background: "#fff", boxShadow: `0 0 0 5px ${ACCENT}, 0 0 30px ${ACCENT}`, transform: `scale(${e})` }} />
      <div style={{ position: "absolute", left: dx, top: dy, transform: `translate(-50%, -50%) scale(${e})`, whiteSpace: "nowrap" }}>
        <Pill text={text} tone={tone} size={30} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- TYPE */

/** Words rise out of a mask one after another. `hi` words take the accent. */
export function Rise({ text, t, at, stagger = 60, dur = 520, hi = [], style }: { text: string; t: number; at: number; stagger?: number; dur?: number; hi?: number[]; style?: CSSProperties }) {
  return (
    <span style={{ display: "block", ...style }}>
      {text.split(" ").map((w, i) => {
        const p = easeOut4(ramp(t, at + i * stagger, dur));
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.16em", marginBottom: "-0.16em", verticalAlign: "top" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 105}%)`, color: hi.includes(i) ? GLOW : undefined, whiteSpace: "pre" }}>{w + " "}</span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * The caption: a chapter line over one big sentence, on a scrim at the foot
 * of the frame. Sized to still read when the film is half a phone screen.
 */
export function Caption({ t, a, b, kicker, text, hi, fast }: { t: number; a: number; b: number; kicker: string; text: string; hi?: number[]; fast?: boolean }) {
  if (t < a || t > b) return null;
  const out = easeIn4(ramp(t, b - 220, 220));
  const scrim = easeOut3(ramp(t, a, 300)) * (1 - out);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 330, background: "linear-gradient(to top, rgba(7,6,26,.97) 0%, rgba(7,6,26,.9) 42%, rgba(7,6,26,0) 100%)", opacity: scrim }} />
      <div style={{ position: "absolute", left: 96, right: 96, bottom: 70, opacity: 1 - out, transform: `translateY(${out * 24}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, opacity: easeOut3(ramp(t, a + 60, 300)) }}>
          <span style={{ width: 34, height: 6, borderRadius: 9, background: GLOW, transform: `scaleX(${easeOut4(ramp(t, a + 60, 420))})`, transformOrigin: "0 50%" }} />
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 26, letterSpacing: "0.16em", textTransform: "uppercase", color: GLOW }}>{kicker}</span>
        </div>
        <Rise text={text} t={t} at={a + (fast ? 30 : 120)} stagger={fast ? 35 : 60} dur={fast ? 300 : 520} hi={hi} style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 78, lineHeight: 1.04, letterSpacing: "-0.035em", color: "#fff", textShadow: "0 2px 30px rgba(7,6,26,.6)" }} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- TRANSITIONS */

export type Trans = "zoom" | "whip" | "rise" | "cut" | "none";
const IN_MS = 340;
const OUT_MS = 260;

/**
 * One shot of the film, with how it arrives and leaves. A shot starts while
 * the one before it is still leaving, so a cut is a single continuous move
 * (both pictures travelling the same way) rather than a dip to the ground.
 */
export function Shot({ t, a, b, enter = "zoom", exit = "zoom", z = 1, children }: { t: number; a: number; b: number; enter?: Trans; exit?: Trans; z?: number; children: ReactNode }) {
  if (t < a || t >= b) return null;
  const pi = enter === "none" ? 1 : ramp(t, a, enter === "cut" ? 220 : IN_MS);
  const po = exit === "none" || exit === "cut" ? 0 : ramp(t, b - OUT_MS, OUT_MS);
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let blur = 0;
  let opacity = 1;
  if (pi < 1) {
    const e = easeOut4(pi);
    if (enter === "zoom") {
      scale *= lerp(0.72, 1, e);
      blur += (1 - e) * 16;
      opacity *= clamp01(pi * 2.4);
    } else if (enter === "whip") {
      tx += (1 - e) * W * 0.9;
      blur += (1 - e) * 22;
    } else if (enter === "rise") {
      ty += (1 - e) * H * 0.85;
      blur += (1 - e) * 16;
    } else if (enter === "cut") {
      scale *= lerp(1.07, 1, e);
    }
  }
  if (po > 0) {
    const e = easeIn4(po);
    if (exit === "zoom") {
      scale *= lerp(1, 1.5, e);
      blur += e * 14;
      opacity *= 1 - clamp01((po - 0.5) / 0.5);
    } else if (exit === "whip") {
      tx -= e * W * 0.9;
      blur += e * 22;
    } else if (exit === "rise") {
      ty -= e * H * 0.85;
      blur += e * 16;
    }
  }
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: z, transform: `translate(${tx}px, ${ty}px) scale(${scale})`, filter: blur > 0.2 ? `blur(${blur}px)` : undefined, opacity, willChange: "transform" }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ BRAND */

/** The mark as three bars, each able to draw on by itself. */
export function Mark({ size, p = 1, color = "#fff" }: { size: number; p?: number; color?: string }) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {MARK_BARS.map((bar, i) => {
        const e = easeOut4(clamp01(p * 1.6 - i * 0.3));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${bar.left}%`,
              top: `${bar.top}%`,
              width: `${bar.width}%`,
              height: `${bar.height}%`,
              borderRadius: 999,
              background: color,
              transform: `scaleX(${e})`,
              transformOrigin: i === 0 ? "100% 50%" : "0 50%",
            }}
          />
        );
      })}
    </div>
  );
}

/** The dark ground everything sits on: brand ink with two slow lights in it. */
export function Ground({ t }: { t: number }) {
  const a = Math.sin(t / 5200) * 60;
  const b = Math.cos(t / 6100) * 50;
  return (
    <div style={{ position: "absolute", inset: 0, background: INK, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -300 + a, top: -420 + b, width: 1500, height: 1500, borderRadius: 9999, background: "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--h-indigo) 62%, transparent) 0%, transparent 62%)", opacity: 0.55 }} />
      <div style={{ position: "absolute", right: -500 - a, bottom: -700 - b, width: 1700, height: 1700, borderRadius: 9999, background: "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--h-purple) 55%, transparent) 0%, transparent 60%)", opacity: 0.38 }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.07) 1.5px, transparent 1.5px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse at 50% 50%, black 30%, transparent 85%)" }} />
    </div>
  );
}
