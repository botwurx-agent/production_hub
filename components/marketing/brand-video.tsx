"use client";

import type { CSSProperties, ReactNode } from "react";
import { clamp01, easeInOut, easeOut, lerp, ramp, spring } from "./scene-kit";
import { MARK_BARS, MARK_BOX } from "@/lib/brand-mark";
import { BudgetScene, CallSheetScene, ReviewScene } from "./scenes-hero";
import { ScheduleScene } from "./scenes-panels";
import { PipelineScene } from "./scenes-more";

/*
 * THE LAUNCH VIDEO: a 1080x1920 Instagram Reel, about 34 seconds, as ONE pure
 * function of time. Same contract as every marketing scene: nothing animates
 * on its own, everything is derived from `t`, so a frame can be rendered at
 * any moment and the render is identical every time (the HyperFrames idea,
 * done with the components the site already ships, so the product shown here
 * cannot drift from the product).
 *
 * Cuts sit on a 500ms grid (120bpm), so any upbeat track added in Instagram
 * lands its downbeats on them. Everything that must be read sits between
 * y=200 and y=1560, clear of Instagram's own overlays top and bottom.
 *
 * The five product beats are the REAL scenes (ReviewScene, CallSheetScene,
 * ScheduleScene, PipelineScene, BudgetScene) played through a time window,
 * slightly faster than on the site, so each beat ends on its payoff.
 */

export const W = 1080;
export const H = 1920;

const HOOK = 0;
const CONVERGE = 3000;
const TAG = 4600;
const BEATS = 6600;
const BEAT = 3600;
const MONTAGE = BEATS + BEAT * 5; // 24600
const END = MONTAGE + 4000; // 28600
export const VIDEO_MS = END + 5000; // 33600

/** Deep brand ground for the type-led sections, derived from the accent. */
const DARK = "color-mix(in oklch, var(--h-indigo) 18%, #05040c)";
const DARK_2 = "color-mix(in oklch, var(--h-indigo) 30%, #0a0820)";
/** The accent lifted so it reads on the dark ground. */
const GLOW = "color-mix(in oklch, var(--h-indigo) 55%, white)";
const easeIn = (p: number) => p * p * p;

/* ------------------------------------------------------------------ TYPE */

/**
 * Words rise out of a mask one after another. The mask is a per-word
 * overflow box with a little bottom padding so descenders are not clipped.
 */
function Words({
  text,
  t,
  at,
  stagger = 70,
  dur = 520,
  style,
  className = "",
  accent,
}: {
  text: string;
  t: number;
  at: number;
  stagger?: number;
  dur?: number;
  style?: CSSProperties;
  className?: string;
  /** Words (by index) drawn in this colour. */
  accent?: { words: number[]; color: string };
}) {
  const words = text.split(" ");
  return (
    <span className={className} style={{ display: "block", ...style }}>
      {words.map((w, i) => {
        const p = easeOut(ramp(t, at + i * stagger, dur));
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.14em", marginBottom: "-0.14em", verticalAlign: "top" }}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - p) * 112}%) rotate(${(1 - p) * 6}deg)`,
                transformOrigin: "0 100%",
                color: accent?.words.includes(i) ? accent.color : undefined,
              }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Fade + lift out, for a whole block leaving. */
function leave(t: number, at: number, dur = 320, dy = -60): CSSProperties {
  const p = easeIn(ramp(t, at, dur));
  return { opacity: 1 - p, transform: `translateY(${p * dy}px)`, filter: p > 0 ? `blur(${p * 8}px)` : undefined };
}

/* ------------------------------------------------------------------ MARK */

/** The SF mark as a tile, its three strokes drawing in one after another. */
function MarkTile({ size, t, at, glow = true }: { size: number; t: number; at: number; glow?: boolean }) {
  const s = spring(ramp(t, at, 620));
  const unit = (size * 0.62) / MARK_BOX;
  const pad = (size - MARK_BOX * unit) / 2;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: "linear-gradient(145deg, color-mix(in oklch, var(--h-indigo) 85%, white), var(--h-indigo) 55%, color-mix(in oklch, var(--h-indigo) 70%, black))",
        transform: `scale(${s}) rotate(${(1 - s) * -14}deg)`,
        boxShadow: glow ? `0 0 ${size * 0.5}px color-mix(in oklch, var(--h-indigo) 70%, transparent), 0 ${size * 0.12}px ${size * 0.3}px rgba(0,0,0,.45)` : undefined,
        position: "relative",
      }}
    >
      {MARK_BARS.map((b, i) => {
        const p = easeOut(ramp(t, at + 260 + i * 110, 380));
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: pad + b.left * unit,
              top: pad + b.top * unit,
              width: b.width * unit * p,
              height: b.height * unit,
              borderRadius: b.height * unit,
              background: "white",
            }}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- HOOK */

const CHIPS = [
  { name: "Budget_v7_FINAL.xlsx", kind: "XLS", hue: "green", x: 610, y: 300, r: 7 },
  { name: "Call sheet (2).pdf", kind: "PDF", hue: "red", x: 70, y: 1240, r: -6 },
  { name: "Re: Re: Fwd: boards", kind: "MAIL", hue: "blue", x: 520, y: 1420, r: 4 },
  { name: "Shot list OLD.gsheet", kind: "XLS", hue: "green", x: 120, y: 330, r: -8 },
  { name: "#hint-shoot", kind: "SLACK", hue: "purple", x: 640, y: 1150, r: 9 },
  { name: "Storyboard_v3.pdf", kind: "PDF", hue: "red", x: 300, y: 1580, r: -3 },
  { name: "Treatment_FINAL2.pdf", kind: "PDF", hue: "red", x: 560, y: 520, r: -5 },
  { name: "Crew contacts.csv", kind: "CSV", hue: "green", x: 60, y: 1460, r: 5 },
  { name: "Invoice_draft.docx", kind: "DOC", hue: "blue", x: 600, y: 1680, r: -9 },
  { name: "Moodboard.key", kind: "KEY", hue: "amber", x: 40, y: 520, r: 6 },
  { name: "Schedule (copy).xlsx", kind: "XLS", hue: "green", x: 520, y: 1290, r: -4 },
  { name: "Props sheet.gsheet", kind: "XLS", hue: "green", x: 230, y: 1700, r: 8 },
  { name: "Lunch order thread", kind: "MAIL", hue: "blue", x: 640, y: 420, r: 3 },
  { name: "Release forms.zip", kind: "ZIP", hue: "orange", x: 110, y: 1350, r: -7 },
];
const CHIP_AT = (i: number) => 1050 + i * 115;

function Chip({ c, style }: { c: (typeof CHIPS)[number]; style: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 24px 16px 16px",
        borderRadius: 20,
        background: "rgba(255,255,255,.96)",
        boxShadow: "0 20px 50px -12px rgba(0,0,0,.6)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 58,
          height: 58,
          borderRadius: 13,
          background: `var(--h-${c.hue})`,
          color: "white",
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: "0.04em",
        }}
      >
        {c.kind}
      </span>
      <span style={{ fontSize: 32, fontWeight: 700, color: "#1d1b2e" }}>{c.name}</span>
    </div>
  );
}

function HookSection({ t }: { t: number }) {
  const out = t - CONVERGE; // > 0 once the converge starts
  const tabs = Math.round(lerp(1, 14, easeOut(ramp(t, 1050, 1550))));
  const shake = t > 2300 && out < 0 ? Math.min(1, (t - 2300) / 600) : 0;
  const jx = Math.sin(t * 0.09) * 7 * shake;
  const jy = Math.cos(t * 0.11) * 5 * shake;
  return (
    <>
      {/* The clutter */}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${jx}px, ${jy}px)` }}>
        {CHIPS.map((c, i) => {
          const at = CHIP_AT(i);
          if (t < at) return null;
          const s = spring(ramp(t, at, 380));
          // Sucked into the centre during the converge.
          const k = easeIn(ramp(out, 60 + (i % 5) * 40, 520));
          const x = lerp(c.x, 540 - 170, k);
          const y = lerp(c.y, 900, k);
          return (
            <Chip
              key={c.name}
              c={c}
              style={{
                left: x,
                top: y,
                transform: `rotate(${c.r + k * 160}deg) scale(${(0.5 + 0.5 * s) * (1 - k * 0.92)})`,
                opacity: Math.min(1, s * 1.4) * (1 - k),
              }}
            />
          );
        })}
      </div>
      {/* The line */}
      <div style={{ position: "absolute", left: 80, top: 640, width: 940, ...(out > 0 ? leave(out, 0, 300) : {}) }}>
        <div className="font-display" style={{ fontSize: 104, fontWeight: 800, lineHeight: 1.0, letterSpacing: "-0.03em", color: "white", textShadow: "0 6px 30px rgba(0,0,0,.6)" }}>
          <Words text="Running a shoot" t={t} at={-260} dur={520} />
          <Words text="shouldn't take" t={t} at={450} style={{ color: "rgba(255,255,255,.72)" }} />
        </div>
        <div
          className="font-display"
          style={{
            marginTop: 18,
            fontSize: 250,
            fontWeight: 800,
            lineHeight: 0.92,
            letterSpacing: "-0.05em",
            color: GLOW,
            textShadow: "0 10px 60px rgba(0,0,0,.7)",
            transform: `scale(${0.85 + 0.15 * spring(ramp(t, 1000, 500))})`,
            transformOrigin: "0 50%",
            opacity: ramp(t, 1000, 160),
          }}
        >
          {tabs} tabs.
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- CONVERGE */

function ConvergeSection({ t }: { t: number }) {
  // t is local (0 at CONVERGE), and runs on through the tagline.
  const ring = ramp(t, 480, 700);
  const lift = easeInOut(ramp(t, 1650, 450)); // moves up for the tagline
  const tileSize = lerp(300, 150, lift);
  const cy = lerp(800, 330, lift);
  return (
    <>
      {ring > 0 && ring < 1 ? (
        <span
          style={{
            position: "absolute",
            left: 540,
            top: 800,
            width: 300 + easeOut(ring) * 1500,
            height: 300 + easeOut(ring) * 1500,
            borderRadius: 999,
            border: `${lerp(10, 2, ring)}px solid ${GLOW}`,
            transform: "translate(-50%, -50%)",
            opacity: 1 - ring,
          }}
        />
      ) : null}
      {/* Flash */}
      {t > 420 && t < 700 ? <div style={{ position: "absolute", inset: 0, background: "white", opacity: (1 - ramp(t, 440, 240)) * 0.22 }} /> : null}
      <div style={{ position: "absolute", left: 540, top: cy, transform: "translate(-50%, -50%)" }}>
        <MarkTile size={tileSize} t={t} at={420} />
      </div>
      <div
        className="font-display"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: lerp(1010, 440, lift),
          textAlign: "center",
          fontSize: lerp(124, 64, lift),
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: "white",
        }}
      >
        <Words text="Studio Flows" t={t} at={880} stagger={110} style={{ display: "inline-block" }} />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- TAG */

function TagSection({ t }: { t: number }) {
  // local, 0 at TAG
  return (
    <div style={{ position: "absolute", left: 80, top: 700, width: 940 }}>
      <div className="font-display" style={{ fontSize: 168, fontWeight: 800, lineHeight: 0.98, letterSpacing: "-0.045em", color: "white" }}>
        <Words text="Every job." t={t} at={250} stagger={120} />
        <Words text="One place." t={t} at={600} stagger={120} style={{ color: GLOW }} />
      </div>
      <div style={{ marginTop: 44, fontSize: 46, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>
        <Words text="Built for commercial production." t={t} at={1000} stagger={45} dur={420} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ BEATS */

type Beat = {
  n: string;
  label: string;
  hue: string;
  line1: string;
  line2: string;
  caption: string;
  scene: (t: number) => ReactNode;
  /** Scene time at the start of the beat, and how fast it plays. */
  from: number;
  speed: number;
};

const BEAT_LIST: Beat[] = [
  {
    n: "01",
    label: "Client review",
    hue: "pink",
    line1: "Clients approve",
    line2: "with a pin.",
    caption: "Notes on the frame. A clear yes. No login.",
    scene: (t) => <ReviewScene t={t} />,
    from: 2300,
    speed: 1.45,
  },
  {
    n: "02",
    label: "Call sheets",
    hue: "amber",
    line1: "Crew confirms",
    line2: "in one tap.",
    caption: "Every crew member, viewed and confirmed.",
    scene: (t) => <CallSheetScene t={t} />,
    from: 1700,
    speed: 1.55,
  },
  {
    n: "03",
    label: "Shooting schedule",
    hue: "green",
    line1: "Your day",
    line2: "re‑flows itself.",
    caption: "Change one scene. Everything after it moves.",
    scene: (t) => <ScheduleScene t={t} />,
    from: 900,
    speed: 1.55,
  },
  {
    n: "04",
    label: "AI pipeline",
    hue: "purple",
    line1: "A hundred takes.",
    line2: "One pick.",
    caption: "Every generation on record, the best one in the cut.",
    scene: (t) => <PipelineScene t={t} />,
    from: 6200,
    speed: 1.6,
  },
  {
    n: "05",
    label: "Budget",
    hue: "indigo",
    line1: "Know what",
    line2: "the job made.",
    caption: "Bid, actual and margin, before the job wraps.",
    scene: (t) => <BudgetScene t={t} />,
    from: 2800,
    speed: 1.35,
  },
];

function BeatSection({ b, i, t }: { b: Beat; i: number; t: number }) {
  // local 0..BEAT
  const enter = easeOut(ramp(t, 0, 520));
  const exit = easeIn(ramp(t, BEAT - 420, 420));
  const cardX = (1 - enter) * 1150 - exit * 1150;
  const cardR = (1 - enter) * 9 - exit * 9;
  const sceneT = b.from + Math.max(0, t - 200) * b.speed;
  const textOut = ramp(t, BEAT - 360, 300);
  // A slow push-in, so the product grows as the beat plays.
  const cam = lerp(1.56, 1.72, easeInOut(ramp(t, 300, BEAT - 600)));
  return (
    <>
      {/* Hue bloom behind everything */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 80% 18%, color-mix(in oklch, var(--h-${b.hue}) 22%, transparent), transparent 55%), radial-gradient(circle at 10% 95%, color-mix(in oklch, var(--h-${b.hue}) 14%, transparent), transparent 50%)`,
          opacity: 1 - exit * 0.6,
        }}
      />
      {/* Watermark numeral */}
      <div
        className="font-display"
        style={{
          position: "absolute",
          right: -30,
          top: 150,
          fontSize: 560,
          fontWeight: 800,
          letterSpacing: "-0.06em",
          lineHeight: 1,
          color: `color-mix(in oklch, var(--h-${b.hue}) 13%, transparent)`,
          transform: `translateY(${(1 - enter) * 80 - exit * 80}px)`,
        }}
      >
        {b.n}
      </div>
      {/* Words */}
      <div style={{ position: "absolute", left: 70, top: 280, width: 960, opacity: 1 - textOut, transform: `translateY(${-textOut * 40}px)` }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 26px 12px 14px",
            borderRadius: 999,
            background: `var(--h-${b.hue}-bg)`,
            color: `var(--h-${b.hue})`,
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            transform: `scale(${spring(ramp(t, 60, 420))})`,
            transformOrigin: "0 50%",
          }}
        >
          <span style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 999, background: `var(--h-${b.hue})`, color: "white", fontSize: 20, letterSpacing: 0 }}>{b.n}</span>
          {b.label}
        </div>
        <div className="font-display" style={{ marginTop: 26, fontSize: 112, fontWeight: 800, lineHeight: 0.98, letterSpacing: "-0.035em", color: "var(--text)" }}>
          <Words text={b.line1} t={t} at={150} />
          <Words text={b.line2} t={t} at={330} style={{ color: `var(--h-${b.hue})` }} />
        </div>
      </div>
      {/* The product, on its canvas */}
      <div
        style={{
          position: "absolute",
          left: 24,
          top: 680,
          width: 1032,
          height: 790,
          borderRadius: 56,
          background: `linear-gradient(150deg, var(--h-${b.hue}-bg) 0%, var(--surface-2) 70%, var(--surface) 100%)`,
          boxShadow: `0 50px 120px -40px color-mix(in oklch, var(--h-${b.hue}) 55%, transparent)`,
          transform: `translateX(${cardX}px) rotate(${cardR}deg)`,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 516, top: 395, width: 640, height: 440, transform: `translate(-50%, -50%) scale(${cam})`, transformOrigin: "50% 50%" }}>
          {b.scene(sceneT)}
        </div>
      </div>
      {/* Caption */}
      <div style={{ position: "absolute", left: 70, top: 1505, width: 940, fontSize: 40, fontWeight: 600, color: "var(--text-muted)", opacity: 1 - textOut }}>
        <Words text={b.caption} t={t} at={650} stagger={35} dur={420} />
      </div>
      {/* Progress */}
      <div style={{ position: "absolute", left: 70, right: 70, top: 220, display: "flex", gap: 10 }}>
        {BEAT_LIST.map((_, k) => (
          <span key={k} style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
            <span
              style={{
                display: "block",
                height: "100%",
                borderRadius: 99,
                width: `${(k < i ? 1 : k > i ? 0 : clamp01(t / BEAT)) * 100}%`,
                background: `var(--h-${BEAT_LIST[k].hue})`,
              }}
            />
          </span>
        ))}
      </div>
    </>
  );
}

/** A diagonal band of the next beat's colour that sweeps across each cut. */
function Sweep({ t }: { t: number }) {
  const bands: ReactNode[] = [];
  for (let i = 1; i < BEAT_LIST.length; i++) {
    const at = BEATS + i * BEAT - 260;
    const p = ramp(t, at, 560);
    if (p <= 0 || p >= 1) continue;
    const x = lerp(-1600, 1400, easeInOut(p));
    bands.push(
      <div
        key={i}
        style={{
          position: "absolute",
          top: -400,
          left: x,
          width: 520,
          height: 2800,
          transform: "rotate(16deg)",
          background: `linear-gradient(90deg, transparent, var(--h-${BEAT_LIST[i].hue}) 30%, var(--h-${BEAT_LIST[i].hue}) 70%, transparent)`,
          opacity: 0.9,
        }}
      />,
    );
  }
  return <>{bands}</>;
}

/* ---------------------------------------------------------------- MONTAGE */

const MODULES: { name: string; from: string; to: string }[] = [
  { name: "Brief", from: "indigo", to: "blue" },
  { name: "Assets", from: "blue", to: "cyan" },
  { name: "AI Pipeline", from: "purple", to: "indigo" },
  { name: "Elements", from: "pink", to: "purple" },
  { name: "Storyboards", from: "indigo", to: "purple" },
  { name: "Shot list", from: "purple", to: "pink" },
  { name: "Moodboard", from: "pink", to: "orange" },
  { name: "Approvals", from: "green", to: "cyan" },
  { name: "Comms", from: "cyan", to: "blue" },
  { name: "Tasks", from: "purple", to: "blue" },
  { name: "Contacts", from: "orange", to: "pink" },
  { name: "Calendar", from: "blue", to: "indigo" },
  { name: "Call sheet", from: "green", to: "cyan" },
  { name: "Gear & crew", from: "cyan", to: "green" },
  { name: "Props", from: "pink", to: "red" },
  { name: "Budget", from: "indigo", to: "purple" },
  { name: "Delivery", from: "amber", to: "orange" },
  { name: "Binder", from: "blue", to: "cyan" },
  { name: "Agreements", from: "purple", to: "pink" },
  { name: "Documents", from: "cyan", to: "blue" },
  { name: "Invoices", from: "orange", to: "amber" },
];
const CYCLE = ["Shot lists.", "Storyboards.", "Moodboards.", "Schedules.", "Props.", "Contracts.", "Invoices.", "All of it."];

function Shutter({ t, at, dir = 1 }: { t: number; at: number; dir?: 1 | -1 }) {
  // Horizontal dark bars closing over the frame, staggered top to bottom.
  const bars = 8;
  return (
    <>
      {Array.from({ length: bars }).map((_, i) => {
        const p = easeInOut(ramp(t, at + i * 45, 380));
        if (p <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: (H / bars) * i,
              height: H / bars + 1,
              left: dir === 1 ? 0 : undefined,
              right: dir === 1 ? undefined : 0,
              width: `${p * 100}%`,
              background: DARK,
            }}
          />
        );
      })}
    </>
  );
}

function MontageSection({ t }: { t: number }) {
  // local 0 at MONTAGE
  const step = 310;
  const idx = Math.min(CYCLE.length - 1, Math.max(0, Math.floor((t - 450) / step)));
  const within = (t - 450) - idx * step;
  const out = ramp(t, 3650, 350);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - out, transform: `scale(${1 + out * 0.08})` }}>
      <div style={{ position: "absolute", left: 80, top: 270, width: 920 }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: "rgba(255,255,255,.6)", letterSpacing: "0.02em" }}>
          <Words text="And everything around it." t={t} at={250} stagger={40} dur={400} />
        </div>
        <div className="font-display" style={{ marginTop: 10, height: 150, overflow: "hidden", fontSize: 132, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, color: GLOW }}>
          {t >= 450 ? (
            <div style={{ transform: `translateY(${idx === CYCLE.length - 1 && within > step ? 0 : (1 - easeOut(clamp01(within / 180))) * 100}%)` }}>{CYCLE[idx]}</div>
          ) : null}
        </div>
      </div>
      <div style={{ position: "absolute", left: 60, top: 540, width: 960, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {MODULES.map((m, i) => {
          const at = 350 + i * 75;
          const s = spring(ramp(t, at, 420));
          return (
            <div
              key={m.name}
              style={{
                height: 96,
                borderRadius: 22,
                padding: "0 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: DARK_2,
                border: "1px solid rgba(255,255,255,.1)",
                transform: `scale(${s}) translateY(${(1 - s) * 30}px)`,
                opacity: clamp01(s * 1.5),
              }}
            >
              <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 13, background: `linear-gradient(140deg, var(--h-${m.from}), var(--h-${m.to}))` }} />
              <span style={{ fontSize: 31, fontWeight: 700, color: "white", whiteSpace: "nowrap" }}>{m.name}</span>
            </div>
          );
        })}
      </div>
      <div className="font-display" style={{ position: "absolute", left: 80, top: 1350, width: 920, fontSize: 96, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1, color: "white" }}>
        <Words text="21 tools." t={t} at={2200} stagger={100} />
        <Words text="One job." t={t} at={2450} stagger={100} style={{ color: GLOW }} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- END */

function EndSection({ t }: { t: number }) {
  // local 0 at END
  const pulse = 0.5 + 0.5 * Math.sin(t / 700);
  const shine = (at: number) => ramp(t, at, 900);
  const s1 = shine(2300);
  const s2 = shine(3900);
  const sh = s1 > 0 && s1 < 1 ? s1 : s2 > 0 && s2 < 1 ? s2 : -1;
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 42%, color-mix(in oklch, var(--h-indigo) ${38 + pulse * 10}%, transparent), transparent 60%)`,
          opacity: ramp(t, 0, 600),
        }}
      />
      <div style={{ position: "absolute", left: 540, top: 690, transform: "translate(-50%, -50%)" }}>
        <MarkTile size={230} t={t} at={150} />
      </div>
      <div className="font-display" style={{ position: "absolute", left: 0, right: 0, top: 880, textAlign: "center", fontSize: 132, fontWeight: 800, letterSpacing: "-0.035em", color: "white" }}>
        <Words text="Studio Flows" t={t} at={550} stagger={110} style={{ display: "inline-block" }} />
      </div>
      <div className="font-display" style={{ position: "absolute", left: 0, right: 0, top: 1060, textAlign: "center", fontSize: 62, fontWeight: 700, letterSpacing: "-0.02em", color: GLOW }}>
        <Words text="Every job, in one place." t={t} at={950} stagger={60} style={{ display: "inline-block" }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 1230,
          transform: `translateX(-50%) scale(${spring(ramp(t, 1500, 520))})`,
          padding: "30px 56px",
          borderRadius: 999,
          background: "white",
          color: "var(--h-indigo)",
          fontSize: 46,
          fontWeight: 800,
          whiteSpace: "nowrap",
          overflow: "hidden",
          boxShadow: "0 24px 60px -20px rgba(0,0,0,.6)",
        }}
      >
        Start free at studio-flows.com
        {sh >= 0 ? (
          <span
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${lerp(-30, 120, sh)}%`,
              width: 120,
              transform: "skewX(-20deg)",
              background: "linear-gradient(90deg, transparent, rgba(99,102,241,.25), transparent)",
            }}
          />
        ) : null}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1400, textAlign: "center", fontSize: 36, fontWeight: 600, color: "rgba(255,255,255,.6)" }}>
        <Words text="Built for commercial production." t={t} at={2000} stagger={40} dur={420} style={{ display: "inline-block" }} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ STAGE */

export function BrandVideo({ t }: { t: number }) {
  // The light product world opens as a circle from the tagline.
  const wipe = easeInOut(ramp(t, TAG + 1500, 500));
  const showDark = t < BEATS + 50 || t >= MONTAGE;
  const inBeats = t >= TAG + 1500 && t < MONTAGE + 900;
  const beatIdx = Math.min(BEAT_LIST.length - 1, Math.max(0, Math.floor((t - BEATS) / BEAT)));
  return (
    <div
      data-theme="light"
      data-accent="indigo"
      className="font-body"
      style={{ position: "relative", width: W, height: H, overflow: "hidden", background: DARK, color: "var(--text)" }}
    >
      {showDark ? (
        <>
          {/* Faint grid on the dark ground */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
              backgroundSize: "90px 90px",
              backgroundPosition: `0 ${(t / 40) % 90}px`,
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 40%, transparent 40%, rgba(0,0,0,.55))" }} />
        </>
      ) : null}

      {t < CONVERGE + 700 ? <HookSection t={t} /> : null}
      {t >= CONVERGE && t < BEATS + 100 ? (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - ramp(t, TAG + 1500, 300) }}>
          <ConvergeSection t={t - CONVERGE} />
          {t >= TAG ? <TagSection t={t - TAG} /> : null}
        </div>
      ) : null}

      {inBeats ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--bg)",
            clipPath: `circle(${wipe * 125}% at 50% 52%)`,
          }}
        >
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(color-mix(in oklch, var(--text) 9%, transparent) 2px, transparent 2px)", backgroundSize: "36px 36px" }} />
          {t >= BEATS && t < MONTAGE ? <BeatSection key={beatIdx} b={BEAT_LIST[beatIdx]} i={beatIdx} t={t - BEATS - beatIdx * BEAT} /> : null}
          <Sweep t={t} />
        </div>
      ) : null}

      {t >= MONTAGE - 100 && t < MONTAGE + 900 ? <Shutter t={t} at={MONTAGE - 100} /> : null}
      {t >= MONTAGE && t < END + 200 ? <MontageSection t={t - MONTAGE} /> : null}
      {t >= END ? <EndSection t={t - END} /> : null}
    </div>
  );
}
