"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * The toolkit the animated marketing scenes are built from (the home hero and
 * the feature panels under it).
 *
 * ONE IDEA DRIVES ALL OF IT: a scene is a pure function of time. The clock hands
 * a scene `t` in milliseconds and every position, count, chip and cursor is
 * DERIVED from it, never stepped by timers. That is what makes a scene
 * pausable when it scrolls off screen, restartable for the clip recorder, and
 * identical on every run, and it is why reduced motion is just "t = the end":
 * the finished picture, still, with no special case in any scene.
 *
 * SCENES ARE DRAWN, NOT PHOTOGRAPHED (section 4.6): simplified product UI in the
 * app's own tokens, clearly illustration. Each one is a fixed 640x440 drawing
 * that FitStage scales to its room, so nothing is ever cropped, which was the
 * operator's complaint about the screenshot panels this replaced.
 */

export const SCENE_W = 640;
export const SCENE_H = 440;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const ramp = (t: number, start: number, dur = 400) => clamp01((t - start) / dur);
export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
/** Back-out: arrives, overshoots a little, settles. The "snappy" in snappy. */
export const spring = (p: number) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** Text that types in from `start`, a character every `per` ms. */
export const typed = (text: string, t: number, start: number, per = 22) =>
  text.slice(0, Math.max(0, Math.floor((t - start) / per)));
/** A number that rolls from a to b over [start, start+dur]. */
export const roll = (a: number, b: number, t: number, start: number, dur = 700) =>
  Math.round(lerp(a, b, easeOut(ramp(t, start, dur))));

export const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * The scene clock. rAF-driven, resumes from where it paused, and either loops
 * or holds at the end and calls onEnd once. `resetKey` restarts it from zero.
 */
export function useSceneClock({
  duration,
  playing,
  loop = false,
  onEnd,
  resetKey = 0,
}: {
  duration: number;
  playing: boolean;
  loop?: boolean;
  onEnd?: () => void;
  resetKey?: number;
}) {
  const reduced = useReducedMotion();
  const [t, setT] = useState(0);
  const tRef = useRef(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    tRef.current = 0;
    setT(0);
  }, [resetKey]);

  useEffect(() => {
    if (reduced) {
      tRef.current = duration;
      setT(duration);
      return;
    }
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Capped so a backgrounded tab does not leap a whole scene on return.
      const dt = Math.min(now - last, 64);
      last = now;
      let next = tRef.current + dt;
      if (next >= duration) {
        if (loop) next = 0;
        else {
          tRef.current = duration;
          setT(duration);
          endRef.current?.();
          return;
        }
      }
      tRef.current = next;
      setT(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration, loop, reduced, resetKey]);

  return t;
}

/** True while at least `threshold` of the element is on screen. */
export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

/**
 * Scales a fixed drawing to its container, never cropping it. When the
 * container is absolutely positioned (a pinned panel gives it a real height) it
 * fits BOTH dimensions; otherwise it fits the width and takes the height that
 * implies, since measuring a height the child itself decides would loop.
 */
export function FitStage({
  w = SCENE_W,
  h = SCENE_H,
  max = 1.25,
  className = "",
  children,
}: {
  w?: number;
  h?: number;
  max?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const boxed = getComputedStyle(el).position === "absolute";
      const byW = r.width / w;
      const byH = boxed && r.height > 0 ? r.height / h : Infinity;
      setS(Math.min(byW, byH, max));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, max]);
  return (
    <div ref={ref} className={`flex items-center justify-center ${className}`}>
      <div className="relative" style={{ width: w * s, height: h * s, opacity: s ? 1 : 0 }}>
        <div
          className="absolute left-0 top-0"
          style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export type Tone = "muted" | "amber" | "blue" | "green" | "indigo" | "red" | "pink" | "purple";

export const TONE: Record<Tone, { fg: string; bg: string }> = {
  muted: { fg: "var(--text-muted)", bg: "var(--surface-2)" },
  amber: { fg: "var(--h-amber)", bg: "var(--h-amber-bg)" },
  blue: { fg: "var(--h-blue)", bg: "var(--h-blue-bg)" },
  green: { fg: "var(--h-green)", bg: "var(--h-green-bg)" },
  indigo: { fg: "var(--h-indigo)", bg: "var(--h-indigo-bg)" },
  red: { fg: "var(--h-red)", bg: "var(--h-red-bg)" },
  pink: { fg: "var(--h-pink)", bg: "var(--h-pink-bg)" },
  purple: { fg: "var(--h-purple)", bg: "var(--h-purple-bg)" },
};

/**
 * A status chip that pops when it changes. `since` is the time its current
 * value arrived, so the pop is derived from the clock like everything else.
 */
export function Chip({
  tone,
  t,
  since = -1e9,
  className = "",
  style,
  children,
}: {
  tone: Tone;
  t: number;
  since?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const p = spring(ramp(t, since, 420));
  const c = TONE[tone];
  return (
    <span
      className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold ${className}`}
      style={{ color: c.fg, background: c.bg, transform: `scale(${0.6 + 0.4 * p})`, ...style }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      {children}
    </span>
  );
}

/** Dots thrown out of a point when something lands on done. */
export function Burst({ t, at, x = 0, y = 0, spread = 1 }: { t: number; at: number; x?: number; y?: number; spread?: number }) {
  const p = ramp(t, at, 650);
  if (p <= 0 || p >= 1) return null;
  const e = easeOut(p);
  const hues = ["green", "amber", "blue", "pink"];
  return (
    <span aria-hidden="true" className="pointer-events-none absolute" style={{ left: x, top: y }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{
              background: `var(--h-${hues[i % 4]})`,
              transform: `translate(${Math.cos(a) * 44 * spread * e - 3}px, ${Math.sin(a) * 30 * spread * e - 3}px) scale(${1 - 0.7 * e})`,
              opacity: 1 - p,
            }}
          />
        );
      })}
    </span>
  );
}

/**
 * The pointer that makes a scene read as somebody USING the product. A path of
 * waypoints in scene coordinates; `click` puts a ring on that stop.
 */
export function Cursor({
  t,
  path,
  travel = 450,
}: {
  t: number;
  path: { t: number; x: number; y: number; click?: boolean }[];
  /** How long each move takes, in ms. Longer reads calmer. */
  travel?: number;
}) {
  if (!path.length) return null;
  let x = path[0].x;
  let y = path[0].y;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (t < a.t) break;
    if (!b || t < b.t) {
      x = a.x;
      y = a.y;
      if (b) {
        // Travel in the last `travel` ms before the next stop, dwell otherwise.
        const move = Math.min(travel, b.t - a.t);
        const p = easeInOut(ramp(t, b.t - move, move));
        x = lerp(a.x, b.x, p);
        y = lerp(a.y, b.y, p);
      }
      break;
    }
  }
  const clickAt = path.filter((p) => p.click && t >= p.t).map((p) => p.t).pop();
  const cp = clickAt === undefined ? 1 : ramp(t, clickAt, 450);
  const visible = ramp(t, path[0].t - 200, 200);
  return (
    <div className="pointer-events-none absolute z-30" style={{ left: x, top: y, opacity: visible }}>
      {cp < 1 ? (
        <span
          className="absolute rounded-full border-2"
          style={{
            borderColor: "var(--accent)",
            width: 36,
            height: 36,
            left: -18,
            top: -18,
            transform: `scale(${0.3 + cp})`,
            opacity: 1 - cp,
          }}
        />
      ) : null}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        style={{ transform: `translate(-3px,-2px) scale(${cp < 0.25 ? 0.85 : 1})`, filter: "drop-shadow(0 3px 6px rgba(20,15,50,.35))" }}
      >
        <path d="M4 2 L4 19 L8.6 14.8 L11.6 21.5 L14.4 20.3 L11.4 13.7 L17.6 13.4 Z" fill="var(--text)" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** The window every scene sits in: a quiet header naming the document. */
export function Window({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-[20px] border border-border bg-surface text-text shadow-[0_30px_80px_-30px_rgba(40,30,90,.35)]"
      style={{ width: SCENE_W, height: SCENE_H }}
    >
      <div className="flex h-[52px] items-center gap-3 border-b border-border px-4">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-surface-2 ring-1 ring-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-surface-2 ring-1 ring-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-surface-2 ring-1 ring-border" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[14px] font-extrabold leading-tight">{title}</p>
          {sub ? <p className="truncate text-[11px] leading-tight text-text-faint">{sub}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Initials in a tinted circle. */
export function Avatar({ name, hue, size = 26 }: { name: string; hue: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-extrabold"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `var(--h-${hue}-bg)`, color: `var(--h-${hue})` }}
    >
      {initials}
    </span>
  );
}

/** Appears with a spring from `at`: fades, rises and scales in. */
export function arrive(t: number, at: number, dy = 10): CSSProperties {
  const p = ramp(t, at, 420);
  const s = spring(p);
  return { opacity: clamp01(p * 2), transform: `translateY(${(1 - s) * dy}px) scale(${0.94 + 0.06 * s})` };
}

/**
 * A small label beside the pointer saying what the next click does. Shown from
 * `before` ms ahead of the action until `after` ms past it, so the viewer
 * reads the intent and then sees it happen. Flips to the pointer's left near
 * the right edge so it never spills out of the scene.
 */
export function ActionLabel({
  t,
  at,
  x,
  y,
  text,
  tone = "indigo",
  before = 550,
  after = 650,
}: {
  t: number;
  at: number;
  x: number;
  y: number;
  text: string;
  tone?: Tone;
  before?: number;
  after?: number;
}) {
  const show = ramp(t, at - before, 200) * (1 - ramp(t, at + after, 200));
  if (show <= 0) return null;
  const c = TONE[tone];
  return (
    <span
      className="pointer-events-none absolute z-40 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-extrabold"
      style={{
        ...(x > 470 ? { right: SCENE_W - x + 8 } : { left: x + 20 }),
        top: y + 16,
        opacity: show,
        color: c.fg,
        background: c.bg,
        boxShadow: "0 6px 16px -8px rgba(40,30,90,.45)",
      }}
    >
      {text}
    </span>
  );
}

/** Where something dragged is at time t: eased from `from` to `to` over [start, start+dur]. */
export function dragAt(t: number, start: number, dur: number, from: { x: number; y: number }, to: { x: number; y: number }) {
  const p = easeInOut(ramp(t, start, dur));
  return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p), p };
}
