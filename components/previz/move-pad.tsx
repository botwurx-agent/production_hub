"use client";

// Controller-style pads for moving a camera, a light or a board from the
// inspector (operator, 2026-10-07: "more of like a video game controller").
// Each pad is a ring of four buttons round a hub, with an optional outer ring
// for a second pair (push in and pull out on the camera). Press once for a
// small nudge; hold and it keeps going, the way a stick does. One speed
// setting serves both pads and is remembered per browser.
//
// The pad knows nothing about cameras: each button is a label plus an `act`
// that is handed the amount of time to apply (seconds, already scaled by the
// speed). The caller decides what a second of "boom up" means.
import { useEffect, useRef, useState } from "react";

export type PadAct = { label: string; act: (t: number) => void } | null;
export type PadSpec = {
  title: string;
  up: PadAct;
  down: PadAct;
  left: PadAct;
  right: PadAct;
  /** A second pair on the outer ring, top and bottom (push in, pull out). */
  outerUp?: PadAct;
  outerDown?: PadAct;
};

type Dir = "up" | "down" | "left" | "right";
const ANGLE: Record<Dir, number> = { up: -90, right: 0, down: 90, left: 180 };

const SPEEDS = [
  { id: "fine", label: "Fine", k: 0.25 },
  { id: "normal", label: "Normal", k: 1 },
  { id: "fast", label: "Fast", k: 3 },
] as const;
type SpeedId = (typeof SPEEDS)[number]["id"];
const SPEED_KEY = "previz.padSpeed";

/** How much one tap moves: a tenth of a second at the current speed. */
const NUDGE = 0.1;
/** How long a press is held before it starts moving continuously. */
const HOLD_DELAY = 220;

const SIZE = 132;
const C = SIZE / 2;
const R_OUT = 64;
const R_MID = 45;
const R_HUB = 18;

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (r: number, a: number) => [C + r * Math.cos(rad(a)), C + r * Math.sin(rad(a))] as const;

/** An annular sector between two radii, from angle a0 to a1 (degrees). */
function sector(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = pt(r1, a0);
  const [x1, y1] = pt(r1, a1);
  const [x2, y2] = pt(r0, a1);
  const [x3, y3] = pt(r0, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0} A${r1} ${r1} 0 ${big} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${big} 0 ${x3} ${y3} Z`;
}

/** A small arrowhead pointing outward along angle a, centred at radius r. */
function arrow(r: number, a: number, s = 6) {
  const [x, y] = pt(r, a);
  const tip = [x + s * Math.cos(rad(a)), y + s * Math.sin(rad(a))];
  const l = [x + s * 0.9 * Math.cos(rad(a + 120)), y + s * 0.9 * Math.sin(rad(a + 120))];
  const rr = [x + s * 0.9 * Math.cos(rad(a - 120)), y + s * 0.9 * Math.sin(rad(a - 120))];
  return `M${tip[0]} ${tip[1]} L${l[0]} ${l[1]} L${rr[0]} ${rr[1]} Z`;
}

/** Two stacked chevrons pointing along angle a, for the outer ring. */
function chevrons(r: number, a: number) {
  const out: string[] = [];
  for (const off of [-3, 3]) {
    const [x, y] = pt(r + off, a);
    const s = 4.5;
    const tip = [x + s * 0.6 * Math.cos(rad(a)), y + s * 0.6 * Math.sin(rad(a))];
    const l = [x + s * Math.cos(rad(a + 135)), y + s * Math.sin(rad(a + 135))];
    const rr = [x + s * Math.cos(rad(a - 135)), y + s * Math.sin(rad(a - 135))];
    out.push(`M${l[0]} ${l[1]} L${tip[0]} ${tip[1]} L${rr[0]} ${rr[1]}`);
  }
  return out.join(" ");
}

function readSpeed(): SpeedId {
  try {
    const v = localStorage.getItem(SPEED_KEY);
    if (v === "fine" || v === "normal" || v === "fast") return v;
  } catch {
    /* storage unavailable: the default stands */
  }
  return "normal";
}

/**
 * One or more pads with a shared speed and a line that names whatever the
 * pointer is over, so every button explains itself without a legend.
 */
export function ControlPads({ pads, caption }: { pads: PadSpec[]; caption?: React.ReactNode }) {
  const [speed, setSpeed] = useState<SpeedId>("normal");
  useEffect(() => setSpeed(readSpeed()), []);
  const pickSpeed = (s: SpeedId) => {
    setSpeed(s);
    try {
      localStorage.setItem(SPEED_KEY, s);
    } catch {
      /* not remembered, still applied */
    }
  };
  const k = SPEEDS.find((s) => s.id === speed)?.k ?? 1;
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="rounded-[12px] border border-border bg-surface-2 p-2.5">
      <div className={`grid gap-2 ${pads.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {pads.map((p) => (
          <Pad key={p.title} spec={p} speed={k} onHover={setHover} />
        ))}
      </div>
      <p className="mt-2 min-h-[1.25rem] text-center text-xs font-semibold text-text" aria-live="polite">
        {hover ?? <span className="font-normal text-text-muted">Tap to nudge, hold to keep moving.</span>}
      </p>
      <div className="mt-2 flex items-center justify-center gap-1">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => pickSpeed(s.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${speed === s.id ? "border-accent bg-accent text-accent-fg" : "border-border text-text-muted hover:border-border-strong hover:text-text"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {caption ? <div className="mt-2 text-center text-xs text-text-muted">{caption}</div> : null}
    </div>
  );
}

function Pad({ spec, speed, onHover }: { spec: PadSpec; speed: number; onHover: (s: string | null) => void }) {
  // The latest actions, so a held button always applies the current state's
  // move rather than the one captured when the press began.
  const specRef = useRef(spec);
  specRef.current = spec;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [pressed, setPressed] = useState<string | null>(null);
  const hold = useRef<{ timer: number; raf: number; last: number } | null>(null);

  const actOf = (id: string): PadAct => {
    const s = specRef.current;
    return (s as unknown as Record<string, PadAct | undefined>)[id] ?? null;
  };

  const stop = () => {
    const h = hold.current;
    if (h) {
      window.clearTimeout(h.timer);
      cancelAnimationFrame(h.raf);
    }
    hold.current = null;
    setPressed(null);
  };
  useEffect(() => stop, []);

  const start = (id: string) => {
    const a = actOf(id);
    if (!a) return;
    stop();
    setPressed(id);
    a.act(NUDGE * speedRef.current);
    const h = { timer: 0, raf: 0, last: 0 };
    hold.current = h;
    h.timer = window.setTimeout(() => {
      h.last = performance.now();
      const tick = (now: number) => {
        if (hold.current !== h) return;
        // Capped so a stalled tab does not jump, but loose enough that a slow
        // frame rate still moves at the stated speed.
        const dt = Math.min(0.15, (now - h.last) / 1000);
        h.last = now;
        actOf(id)?.act(dt * speedRef.current);
        h.raf = requestAnimationFrame(tick);
      };
      h.raf = requestAnimationFrame(tick);
    }, HOLD_DELAY);
  };

  const button = (id: string, path: string, glyph: string, glyphStroke: boolean) => {
    const a = actOf(id);
    if (!a) {
      return (
        <g key={id} aria-hidden>
          <path d={path} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} opacity={0.55} />
        </g>
      );
    }
    const on = pressed === id;
    return (
      <g
        key={id}
        role="button"
        tabIndex={0}
        aria-label={a.label}
        className="cursor-pointer outline-none [&:focus-visible>path:first-child]:stroke-[var(--accent)]"
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          start(id);
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onPointerEnter={() => onHover(a.label)}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(a.label)}
        onBlur={() => onHover(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            a.act(NUDGE * speedRef.current);
          }
        }}
      >
        <path
          d={path}
          fill={on ? "var(--accent)" : "var(--surface)"}
          stroke="var(--border-strong)"
          strokeWidth={1}
          className={on ? "" : "transition-[fill] hover:fill-[var(--accent-soft)]"}
        />
        <path
          d={glyph}
          fill={glyphStroke ? "none" : on ? "var(--accent-fg)" : "var(--text)"}
          stroke={glyphStroke ? (on ? "var(--accent-fg)" : "var(--text)") : "none"}
          strokeWidth={glyphStroke ? 1.6 : 0}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      </g>
    );
  };

  const hasOuter = !!(spec.outerUp || spec.outerDown);
  const rIn = hasOuter ? R_MID : R_OUT - 4;
  const dirs: Dir[] = ["up", "right", "down", "left"];
  return (
    <div className="flex min-w-0 flex-col items-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="aspect-square w-full max-w-[132px] touch-none select-none">
        {hasOuter
          ? (["up", "down"] as const).map((d) => {
              const id = d === "up" ? "outerUp" : "outerDown";
              const a = ANGLE[d];
              return button(id, sector(R_MID + 2, R_OUT, a - 42, a + 42), chevrons((R_MID + R_OUT) / 2 + 1, a), true);
            })
          : null}
        {hasOuter
          ? (["left", "right"] as const).map((d) => {
              const a = ANGLE[d];
              return <path key={d} d={sector(R_MID + 2, R_OUT, a - 42, a + 42)} fill="var(--surface)" stroke="var(--border)" opacity={0.4} aria-hidden />;
            })
          : null}
        {dirs.map((d) => {
          const a = ANGLE[d];
          return button(d, sector(R_HUB + 2, rIn, a - 43, a + 43), arrow((R_HUB + rIn) / 2 + 1, a), false);
        })}
        <circle cx={C} cy={C} r={R_HUB} fill="var(--surface-2)" stroke="var(--border-strong)" />
      </svg>
      <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-faint">{spec.title}</span>
    </div>
  );
}
