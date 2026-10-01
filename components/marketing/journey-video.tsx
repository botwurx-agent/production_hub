"use client";

import type { CSSProperties, ReactNode } from "react";
import { clamp01, easeInOut, easeOut, lerp, ramp, spring } from "./scene-kit";
import { DARK, GLOW, H, MarkTile, W, Words } from "./brand-video";
import { GmailGlyph } from "@/components/communication/comms-ui";
import { DealScene } from "./scenes-deal";
import { CommsScene, StoryboardScene } from "./scenes-panels";
import { MoodboardScene } from "./scenes-more";
import { CallSheetScene, ReviewScene } from "./scenes-hero";
import { CrewRosterScene } from "./scenes-crew";
import { BudgetLinesScene } from "./scenes-budget";
import { CallSheetMealsScene } from "./scenes-callsheet";
import { InvoiceFlowScene } from "./scenes-invoicing";

/*
 * THE PRODUCER'S JOURNEY: a second Reel, 1080x1920, told as one job from the
 * first email to the final invoice. Same contract as the launch video
 * (brand-video.tsx): one pure function of t, rendered frame by frame.
 *
 * What makes it a different film rather than a recut:
 * - A JOURNEY TRACK across the top fills node by node, and a split-flap CLOCK
 *   rolls forward through the weeks, so the viewer always knows where in the
 *   job they are and that time is passing.
 * - Stops SCROLL UP like a feed, one into the next, instead of cutting.
 * - Phases are announced by a CLAPPERBOARD that snaps shut (pre-production,
 *   shoot day, wrap), and the cut into and out of a slate is a sweep of slate
 *   stripes.
 * Every stop is a real marketing scene of a shipped feature.
 */

const easeIn = (p: number) => p * p * p;

/* --------------------------------------------------------------- SEQUENCE */

type Stop = {
  kind: "stop";
  name: string;
  phase: string;
  hue: string;
  clock: string;
  line1: string;
  line2: string;
  caption: string;
  scene: (t: number) => ReactNode;
  from: number;
  speed: number;
  stamp?: number;
  dur: number;
};
type Slate = { kind: "slate"; title: string; scene: string; take: string; note: string; sub: string; dur: number };
type Seg = Stop | Slate | { kind: "open"; dur: number } | { kind: "finale"; dur: number } | { kind: "end"; dur: number };

const STOP = 3400;

const STOPS: Omit<Stop, "kind" | "dur">[] = [
  {
    name: "Win the client",
    phase: "CRM",
    hue: "green",
    clock: "WK1 MON 9:12 AM",
    line1: "Win the job.",
    line2: "Log it once.",
    caption: "Bidding to awarded. The prospect becomes a client.",
    scene: (t) => <DealScene t={t} />,
    from: 500,
    speed: 1.45,
  },
  {
    name: "Talk it through",
    phase: "Communication",
    hue: "cyan",
    clock: "WK1 MON 11:40 AM",
    line1: "Talk where",
    line2: "the work is.",
    caption: "Gmail, Slack and Chat, linked to the job.",
    scene: (t) => <CommsScene t={t} />,
    from: 400,
    speed: 2,
  },
  {
    name: "Moodboard",
    phase: "Pre-production",
    hue: "pink",
    clock: "WK1 TUE 10:05 AM",
    line1: "Find",
    line2: "the look.",
    caption: "References, notes and colour on one board.",
    scene: (t) => <MoodboardScene t={t} />,
    from: 500,
    speed: 1.95,
  },
  {
    name: "Storyboard",
    phase: "Pre-production",
    hue: "purple",
    clock: "WK1 WED 2:30 PM",
    line1: "Sketch it.",
    line2: "Board it.",
    caption: "Pencil frames to a finished storyboard.",
    scene: (t) => <StoryboardScene t={t} />,
    from: 0,
    speed: 1.18,
  },
  {
    name: "Client approval",
    phase: "Approvals",
    hue: "indigo",
    clock: "WK1 THU 4:15 PM",
    line1: "Get the",
    line2: "client's yes.",
    caption: "Pinned notes, then a clear approval. No login.",
    scene: (t) => <ReviewScene t={t} />,
    from: 800,
    speed: 1.95,
  },
  {
    name: "Shot list",
    phase: "Approvals",
    hue: "blue",
    clock: "WK1 FRI 1:00 PM",
    line1: "Shot list,",
    line2: "signed off.",
    caption: "Frames become shots. The client approves again.",
    scene: (t) => <StoryboardScene t={t} />,
    from: 3900,
    speed: 1.32,
    stamp: 2150,
  },
  {
    name: "Crew",
    phase: "Pre-production",
    hue: "orange",
    clock: "WK2 MON 9:30 AM",
    line1: "Build",
    line2: "your crew.",
    caption: "Crew, talent and vendors on one roster.",
    scene: (t) => <CrewRosterScene t={t} />,
    from: 1300,
    speed: 2,
  },
  {
    name: "Budget",
    phase: "Pre-production",
    hue: "purple",
    clock: "WK2 WED 3:20 PM",
    line1: "Watch",
    line2: "the money.",
    caption: "Every invoice lands on its budget line.",
    scene: (t) => <BudgetLinesScene t={t} />,
    from: 2000,
    speed: 1.95,
  },
  {
    name: "Call sheet",
    phase: "Shoot day",
    hue: "amber",
    clock: "WK3 THU 6:00 PM",
    line1: "Call sheet",
    line2: "goes out.",
    caption: "See who opened it, and who confirmed.",
    scene: (t) => <CallSheetScene t={t} />,
    from: 300,
    speed: 1.95,
  },
  {
    name: "Lunch",
    phase: "Shoot day",
    hue: "pink",
    clock: "WK3 FRI 9:40 AM",
    line1: "Lunch,",
    line2: "handled.",
    caption: "One order link out. Chase whoever forgets.",
    scene: (t) => <CallSheetMealsScene t={t} />,
    from: 3900,
    speed: 1.62,
  },
  {
    name: "Deliver and invoice",
    phase: "Post",
    hue: "green",
    clock: "WK4 MON 11:00 AM",
    line1: "Deliver.",
    line2: "Invoice.",
    caption: "The invoice goes out. The margin is right there.",
    scene: (t) => <InvoiceFlowScene t={t} />,
    from: 8400,
    speed: 1.3,
  },
];

const stop = (i: number): Stop => ({ ...STOPS[i], kind: "stop", dur: STOP });

const SEQ: Seg[] = [
  { kind: "open", dur: 3300 },
  { kind: "slate", title: "PRE-PRODUCTION", scene: "1", take: "1", note: "3 WKS OUT", sub: "Three weeks to shoot day.", dur: 1700 },
  ...STOPS.slice(0, 8).map((_, i) => stop(i)),
  { kind: "slate", title: "SHOOT DAY", scene: "2", take: "1", note: "DAY 1", sub: "Tomorrow, 6:15 AM call.", dur: 1700 },
  stop(8),
  stop(9),
  { kind: "slate", title: "THAT'S A WRAP", scene: "3", take: "1", note: "POST", sub: "Shoot done. On to post.", dur: 1900 },
  stop(10),
  { kind: "finale", dur: 3600 },
  { kind: "end", dur: 5000 },
];
const STARTS = SEQ.reduce<number[]>((a, s, i) => [...a, i === 0 ? 0 : a[i - 1] + SEQ[i - 1].dur], []);
export const JOURNEY_MS = STARTS[STARTS.length - 1] + SEQ[SEQ.length - 1].dur;

/* Which stop (0..10) is on screen or was last, for the track and the clock. */
const STOP_INDEX = SEQ.map((s, i) => SEQ.slice(0, i + 1).filter((x) => x.kind === "stop").length - 1);

/** How long the scroll from one stop into the next takes. */
const TR = 560;

/* ------------------------------------------------------------------ PIECES */

/** A split-flap clock: each character rolls when it changes. */
function FlipText({ prev, cur, t, at, style }: { prev: string; cur: string; t: number; at: number; style?: CSSProperties }) {
  const n = Math.max(prev.length, cur.length);
  return (
    <span style={{ display: "inline-flex", ...style }}>
      {Array.from({ length: n }).map((_, i) => {
        const a = prev[i] ?? " ";
        const b = cur[i] ?? " ";
        const p = a === b ? 1 : easeInOut(ramp(t, at + i * 28, 300));
        return (
          <span key={i} style={{ position: "relative", display: "inline-block", overflow: "hidden", height: "1.15em", verticalAlign: "top" }}>
            {/* The arriving character sets the width; both faces ride over it. */}
            <span style={{ visibility: "hidden", whiteSpace: "pre" }}>{b}</span>
            <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${-p * 100}%)`, whiteSpace: "pre" }}>{a}</span>
            <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - p) * 100}%)`, whiteSpace: "pre" }}>{b}</span>
          </span>
        );
      })}
    </span>
  );
}

/** A sweep of clapperboard stripes that covers a cut. Centred on `at`. */
function StripeWipe({ t, at, dur = 820 }: { t: number; at: number; dur?: number }) {
  const p = ramp(t, at - dur / 2, dur);
  if (p <= 0 || p >= 1) return null;
  const x = lerp(-2860, 1940, easeInOut(p));
  return (
    <div
      style={{
        position: "absolute",
        top: -500,
        left: x,
        width: 2000,
        height: 2920,
        transform: "rotate(18deg)",
        zIndex: 60,
        background: "repeating-linear-gradient(-45deg, #0b0a12 0 90px, #f4f3f8 90px 180px)",
        boxShadow: "0 0 0 40px #0b0a12",
      }}
    />
  );
}

/** The clapperboard. The arm snaps shut at `snap`. */
function Clapper({ t, snap, title, scene, take, note }: { t: number; snap: number; title: string; scene: string; take: string; note: string }) {
  const enter = spring(ramp(t, snap - 650, 520));
  const close = easeIn(ramp(t, snap - 380, 380));
  const bounce = t > snap ? Math.sin(ramp(t, snap, 260) * Math.PI) * 4 * (1 - ramp(t, snap, 260)) : 0;
  const angle = lerp(-26, 0, close) - bounce;
  const shake = t > snap && t < snap + 220 ? Math.sin(t * 0.7) * 9 * (1 - ramp(t, snap, 220)) : 0;
  const stripes = "repeating-linear-gradient(-58deg, #f4f3f8 0 46px, #0b0a12 46px 92px)";
  const cell = (label: string, value: string, flex = 1): ReactNode => (
    <div style={{ flex, padding: "14px 22px", borderRight: "3px solid rgba(255,255,255,.75)" }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,.55)" }}>{label}</div>
      <div className="font-display" style={{ fontSize: 50, fontWeight: 800, color: "white", lineHeight: 1.1 }}>{value}</div>
    </div>
  );
  return (
    <div style={{ position: "relative", width: 820, transform: `translateX(${shake}px) scale(${0.6 + 0.4 * enter}) rotate(${(1 - enter) * -8}deg)`, opacity: clamp01(enter * 1.6) }}>
      {/* Arm */}
      <div style={{ position: "relative", height: 112, transformOrigin: "14px 100%", transform: `rotate(${angle}deg)`, zIndex: 2 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "16px 16px 6px 6px", background: stripes, boxShadow: "0 10px 30px rgba(0,0,0,.4)" }} />
      </div>
      {/* Fixed stripe bar under the arm */}
      <div style={{ height: 96, marginTop: 6, background: "repeating-linear-gradient(58deg, #f4f3f8 0 46px, #0b0a12 46px 92px)", borderRadius: 6 }} />
      {/* Board */}
      <div style={{ marginTop: 6, borderRadius: "6px 6px 26px 26px", background: "#141320", border: "3px solid rgba(255,255,255,.75)", overflow: "hidden", boxShadow: "0 40px 90px -30px rgba(0,0,0,.8)" }}>
        <div style={{ display: "flex", borderBottom: "3px solid rgba(255,255,255,.75)" }}>
          {cell("PROD.", "Bright Water", 3)}
          <div style={{ flex: 1.2, padding: "14px 22px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,.55)" }}>ROLL</div>
            <div className="font-display" style={{ fontSize: 50, fontWeight: 800, color: "white", lineHeight: 1.1 }}>A01</div>
          </div>
        </div>
        <div className="font-display" style={{ padding: "26px 22px 22px", borderBottom: "3px solid rgba(255,255,255,.75)", fontSize: title.length > 12 ? 76 : 100, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color: GLOW, whiteSpace: "nowrap" }}>
          {title}
        </div>
        <div style={{ display: "flex" }}>
          {cell("SCENE", scene)}
          {cell("TAKE", take)}
          <div style={{ flex: 1.6, padding: "14px 22px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.14em", color: "rgba(255,255,255,.55)" }}>WHEN</div>
            <div className="font-display" style={{ fontSize: 50, fontWeight: 800, color: "white", lineHeight: 1.1 }}>{note}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The rubber stamp that lands on the shot list. */
function ApprovedStamp({ t, at }: { t: number; at: number }) {
  if (t < at) return null;
  const p = ramp(t, at, 360);
  const s = lerp(2.4, 1, easeIn(p)) + (p >= 1 ? Math.sin(ramp(t, at + 360, 240) * Math.PI) * 0.05 * (1 - ramp(t, at + 360, 240)) : 0);
  const ring = ramp(t, at + 330, 600);
  return (
    <div style={{ position: "absolute", right: 130, bottom: 110, zIndex: 20 }}>
      {ring > 0 && ring < 1 ? (
        <span style={{ position: "absolute", left: "50%", top: "50%", width: 420 + ring * 500, height: 220 + ring * 300, borderRadius: 40, border: `${lerp(10, 2, ring)}px solid var(--h-green)`, transform: "translate(-50%,-50%) rotate(-10deg)", opacity: 1 - ring }} />
      ) : null}
      <div
        style={{
          transform: `rotate(-10deg) scale(${s})`,
          opacity: clamp01(p * 2.2),
          padding: "18px 34px",
          borderRadius: 26,
          border: "9px solid var(--h-green)",
          background: "color-mix(in oklch, var(--h-green-bg) 88%, transparent)",
          color: "var(--h-green)",
          textAlign: "center",
          boxShadow: "0 24px 60px -24px color-mix(in oklch, var(--h-green) 70%, transparent)",
        }}
      >
        <div className="font-display" style={{ fontSize: 84, fontWeight: 900, letterSpacing: "0.06em", lineHeight: 1 }}>APPROVED</div>
        <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800 }}>Maya Torres · Bright Water</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- OPEN */

function OpenSection({ t }: { t: number }) {
  const card = spring(ramp(t, 150, 620));
  const glow = 0.5 + 0.5 * Math.sin(t / 260);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          top: 300,
          borderRadius: 40,
          padding: "30px 34px",
          background: "rgba(255,255,255,.97)",
          color: "#1d1b2e",
          transform: `translateY(${(1 - card) * -360}px) scale(${0.92 + 0.08 * card})`,
          boxShadow: `0 40px 90px -30px rgba(0,0,0,.7), 0 0 ${40 + glow * 40}px color-mix(in oklch, var(--h-indigo) 40%, transparent)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ display: "grid", placeItems: "center", width: 70, height: 70, borderRadius: 18, background: "#f1f0f6" }}>
            <GmailGlyph size={40} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 34, fontWeight: 800 }}>Maya Torres · Bright Water</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#6b6880" }}>New project inquiry · just now</div>
          </div>
          <span style={{ width: 20, height: 20, borderRadius: 99, background: "var(--h-red)" }} />
        </div>
        <div style={{ marginTop: 20, fontSize: 36, fontWeight: 600, lineHeight: 1.32 }}>
          Loved your reel. We need a 30s hero spot for the spring launch. Can you shoot in three weeks?
        </div>
      </div>
      <div className="font-display" style={{ position: "absolute", left: 80, top: 860, width: 940, fontSize: 150, fontWeight: 800, lineHeight: 0.95, letterSpacing: "-0.045em", color: "white" }}>
        <Words text="The job" t={t} at={900} stagger={110} />
        <Words text="just landed." t={t} at={1150} stagger={110} />
        <Words text="Now run it." t={t} at={2050} stagger={130} style={{ color: GLOW, marginTop: 34 }} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ SLATE */

function SlateSection({ s, t }: { s: Slate; t: number }) {
  const snap = 760;
  const flash = t > snap && t < snap + 260 ? (1 - ramp(t, snap, 260)) * 0.28 : 0;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 46%, color-mix(in oklch, var(--h-indigo) ${30 * ramp(t, snap, 400)}%, transparent), transparent 62%)` }} />
      <div style={{ position: "absolute", left: 130, top: 470 }}>
        <Clapper t={t} snap={snap} title={s.title} scene={s.scene} take={s.take} note={s.note} />
      </div>
      <div className="font-display" style={{ position: "absolute", left: 0, right: 0, top: 1240, textAlign: "center", fontSize: 72, fontWeight: 800, letterSpacing: "-0.03em", color: "white" }}>
        <Words text={s.sub} t={t} at={snap + 120} stagger={70} style={{ display: "inline-block" }} />
      </div>
      {flash > 0 ? <div style={{ position: "absolute", inset: 0, background: "white", opacity: flash }} /> : null}
    </>
  );
}

/* ------------------------------------------------------------------- STOP */

function StopLayer({ s, t }: { s: Stop; t: number }) {
  // t is local to the stop; content starts as the scroll lands.
  const sceneT = s.from + Math.max(0, t - 240) * s.speed;
  const cam = lerp(1.5, 1.6, easeInOut(ramp(t, 300, STOP - 400)));
  return (
    <>
      <div style={{ position: "absolute", left: 70, top: 380, width: 960 }}>
        <div className="font-display" style={{ fontSize: 124, fontWeight: 800, lineHeight: 0.97, letterSpacing: "-0.04em", color: "var(--text)" }}>
          <Words text={s.line1} t={t} at={260} />
          <Words text={s.line2} t={t} at={430} style={{ color: `var(--h-${s.hue})` }} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 24,
          top: 690,
          width: 1032,
          height: 740,
          borderRadius: 56,
          background: `linear-gradient(155deg, var(--h-${s.hue}-bg) 0%, var(--surface-2) 72%, var(--surface) 100%)`,
          boxShadow: `0 50px 120px -46px color-mix(in oklch, var(--h-${s.hue}) 60%, transparent)`,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 516, top: 370, width: 640, height: 440, transform: `translate(-50%, -50%) scale(${cam})` }}>{s.scene(sceneT)}</div>
        {s.stamp !== undefined ? <ApprovedStamp t={t} at={s.stamp} /> : null}
      </div>
      <div style={{ position: "absolute", left: 70, top: 1466, width: 940, fontSize: 40, fontWeight: 600, color: "var(--text-muted)" }}>
        <Words text={s.caption} t={t} at={700} stagger={32} dur={420} />
      </div>
    </>
  );
}

/** Phase chip, journey track and clock: fixed while the stops scroll under. */
function Hud({ t }: { t: number }) {
  const segIdx = segAt(t);
  const si = STOP_INDEX[segIdx];
  if (si < 0) return null;
  const local = t - STARTS[segIdx];
  const seg = SEQ[segIdx];
  const cur = STOPS[si];
  const prevStop = si > 0 ? STOPS[si - 1] : null;
  // Arriving at a stop: the track runs on to its node and the clock flips.
  const arriving = seg.kind === "stop";
  const p = arriving ? easeInOut(clamp01(local / (TR + 200))) : 1;
  const nodeX = (i: number) => 90 + (i * 900) / (STOPS.length - 1);
  const fillX = lerp(prevStop ? nodeX(si - 1) : nodeX(0), nodeX(si), p);
  const pulse = 0.5 + 0.5 * Math.sin(t / 180);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 196, height: 150, zIndex: 30 }}>
      {/* A band of ground, so stops scrolling up pass under the track. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: -196, height: 196 + 175, background: "linear-gradient(180deg, var(--bg) 82%, transparent)" }} />
      <div style={{ position: "absolute", left: 70, top: 0, display: "flex", alignItems: "center", gap: 14 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 24px 10px 16px",
            borderRadius: 999,
            background: `var(--h-${cur.hue}-bg)`,
            color: `var(--h-${cur.hue})`,
            fontSize: 27,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ width: 14, height: 14, borderRadius: 99, background: `var(--h-${cur.hue})` }} />
          {cur.phase}
        </span>
      </div>
      <div className="font-display" style={{ position: "absolute", right: 70, top: 4, fontSize: 38, fontWeight: 800, letterSpacing: "0.02em", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
        <FlipText prev={arriving && prevStop ? prevStop.clock : cur.clock} cur={cur.clock} t={local} at={arriving ? 60 : -1e6} />
      </div>
      {/* Track */}
      <div style={{ position: "absolute", left: nodeX(0), width: nodeX(10) - nodeX(0), top: 104, height: 6, borderRadius: 9, background: "var(--surface-2)" }} />
      <div style={{ position: "absolute", left: nodeX(0), width: fillX - nodeX(0), top: 104, height: 6, borderRadius: 9, background: `linear-gradient(90deg, var(--h-indigo), var(--h-${cur.hue}))` }} />
      {STOPS.map((s, i) => {
        const done = nodeX(i) <= fillX + 0.5;
        const here = i === si;
        const size = here ? 30 + 6 * p : done ? 20 : 16;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: nodeX(i),
              top: 107,
              width: size,
              height: size,
              borderRadius: 99,
              transform: "translate(-50%, -50%)",
              background: done ? `var(--h-${s.hue})` : "var(--surface)",
              border: done ? "none" : "4px solid var(--border-strong)",
              boxShadow: here ? `0 0 0 ${8 + pulse * 8}px color-mix(in oklch, var(--h-${s.hue}) ${22 - pulse * 10}%, transparent)` : undefined,
            }}
          />
        );
      })}
      <div style={{ position: "absolute", left: 0, top: 128, transform: `translateX(${Math.min(880, Math.max(200, lerp(prevStop ? nodeX(si - 1) : nodeX(si), nodeX(si), p)))}px)` }}>
        <span style={{ display: "block", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 24, fontWeight: 800, color: "var(--text-muted)" }}>
          {si + 1}/{STOPS.length} · {cur.name}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- FINALE */

function FinaleSection({ t }: { t: number }) {
  const lineH = easeOut(ramp(t, 150, 11 * 120));
  return (
    <>
      <div style={{ position: "absolute", left: 128, top: 300, width: 6, height: (STOPS.length - 1) * 82 * lineH, borderRadius: 9, background: `linear-gradient(180deg, var(--h-green), var(--h-indigo), var(--h-amber), var(--h-green))` }} />
      {STOPS.map((s, i) => {
        const at = 200 + i * 120;
        const p = spring(ramp(t, at, 420));
        return (
          <div key={i} style={{ position: "absolute", left: 104, top: 278 + i * 82, display: "flex", alignItems: "center", gap: 28, opacity: clamp01(p * 1.5), transform: `translateX(${(1 - p) * 60}px)` }}>
            <span style={{ display: "grid", placeItems: "center", width: 54, height: 54, borderRadius: 99, background: `var(--h-${s.hue})`, color: "white", fontSize: 26, fontWeight: 900, transform: `scale(${p})` }}>✓</span>
            <span className="font-display" style={{ fontSize: 50, fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>{s.name}</span>
          </div>
        );
      })}
      <div className="font-display" style={{ position: "absolute", left: 80, top: 278 + STOPS.length * 82 + 40, width: 940, fontSize: 92, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em", color: "white" }}>
        <Words text="First email to final invoice." t={t} at={1700} stagger={70} />
        <Words text="One place." t={t} at={2300} stagger={110} style={{ color: GLOW, marginTop: 10 }} />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- END */

function EndSection({ t }: { t: number }) {
  const pulse = 0.5 + 0.5 * Math.sin(t / 700);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 42%, color-mix(in oklch, var(--h-indigo) ${38 + pulse * 10}%, transparent), transparent 60%)`, opacity: ramp(t, 0, 600) }} />
      <div style={{ position: "absolute", left: 540, top: 690, transform: "translate(-50%, -50%)" }}>
        <MarkTile size={230} t={t} at={150} />
      </div>
      <div className="font-display" style={{ position: "absolute", left: 0, right: 0, top: 880, textAlign: "center", fontSize: 132, fontWeight: 800, letterSpacing: "-0.035em", color: "white" }}>
        <Words text="Studio Flows" t={t} at={550} stagger={110} style={{ display: "inline-block" }} />
      </div>
      <div className="font-display" style={{ position: "absolute", left: 0, right: 0, top: 1060, textAlign: "center", fontSize: 62, fontWeight: 700, letterSpacing: "-0.02em", color: GLOW }}>
        <Words text="Run the whole job in one place." t={t} at={950} stagger={60} style={{ display: "inline-block" }} />
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
          boxShadow: "0 24px 60px -20px rgba(0,0,0,.6)",
        }}
      >
        Start free at studio-flows.com
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1400, textAlign: "center", fontSize: 36, fontWeight: 600, color: "rgba(255,255,255,.6)" }}>
        <Words text="Built for commercial production." t={t} at={2000} stagger={40} dur={420} style={{ display: "inline-block" }} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ STAGE */

function segAt(t: number) {
  let i = 0;
  while (i < SEQ.length - 1 && t >= STARTS[i + 1]) i++;
  return i;
}

const dark = (k: Seg["kind"]) => k !== "stop";

export function JourneyVideo({ t }: { t: number }) {
  const i = segAt(t);
  const seg = SEQ[i];
  const local = t - STARTS[i];
  const prev = i > 0 ? SEQ[i - 1] : null;
  // Scroll from one stop into the next.
  const scrolling = seg.kind === "stop" && prev?.kind === "stop" && local < TR;
  const sp = scrolling ? easeInOut(local / TR) : 1;
  // A stripe sweep covers every cut that changes ground (light to dark).
  const wipes = STARTS.filter((_, k) => k > 0 && (SEQ[k].kind === "slate" || dark(SEQ[k].kind) !== dark(SEQ[k - 1].kind)));
  const lightNow = seg.kind === "stop";

  return (
    <div data-theme="light" data-accent="indigo" className="font-body" style={{ position: "relative", width: W, height: H, overflow: "hidden", background: lightNow ? "var(--bg)" : DARK, color: "var(--text)" }}>
      {lightNow ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(color-mix(in oklch, var(--text) 9%, transparent) 2px, transparent 2px)",
            backgroundSize: "36px 36px",
            backgroundPosition: `0 ${-(STOP_INDEX[i] * 400 + sp * 400)}px`,
          }}
        />
      ) : (
        <>
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
      )}

      {seg.kind === "open" ? <OpenSection t={local} /> : null}
      {seg.kind === "slate" ? <SlateSection key={i} s={seg} t={local} /> : null}
      {seg.kind === "finale" ? (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - ramp(local, seg.dur - 380, 380), transform: `scale(${1 - 0.05 * ramp(local, seg.dur - 380, 380)})` }}>
          <FinaleSection t={local} />
        </div>
      ) : null}
      {seg.kind === "end" ? <EndSection t={local} /> : null}

      {seg.kind === "stop" ? (
        <>
          {scrolling && prev?.kind === "stop" ? (
            <div style={{ position: "absolute", inset: 0, transform: `translateY(${-sp * H * 0.8}px)`, opacity: 1 - sp * 0.9, filter: `blur(${sp * 6}px)` }}>
              <StopLayer s={prev} t={prev.dur + local} />
            </div>
          ) : null}
          <div key={i} style={{ position: "absolute", inset: 0, transform: `translateY(${(1 - sp) * H * 0.95}px)` }}>
            <StopLayer s={seg} t={local} />
          </div>
          <Hud t={t} />
        </>
      ) : null}

      {wipes.map((at) => (
        <StripeWipe key={at} t={t} at={at} />
      ))}
    </div>
  );
}
