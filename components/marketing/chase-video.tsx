"use client";

import type { CSSProperties, ReactNode } from "react";
import { clamp01, easeInOut, easeOut, lerp, ramp, spring } from "./scene-kit";
import { GLOW, H, MarkTile, W, Words } from "./brand-video";
import { BudgetScene, CallSheetScene, ReviewScene } from "./scenes-hero";
import { ScheduleScene } from "./scenes-panels";
import { ChatGlyph, GmailGlyph, SlackGlyph } from "@/components/communication/comms-ui";

/*
 * "STOP CHASING": the third Reel, 1080x1920, ~51 seconds. Built to the
 * standard of a reference the operator chose: ONE continuous camera moving
 * through large worlds (a production group chat, then the product itself),
 * swooping, tilting, pushing in until the type fills the frame, and
 * whip-panning between beats. Nothing slides on as a card.
 *
 * The craft pieces, all derived from t so every frame renders identically:
 * - A CAMERA RIG (camAt): keyframed position, zoom and three-axis rotation
 *   over a world div, under real CSS perspective.
 * - MOTION BLUR from the camera's actual velocity (camBlur): directional, so
 *   a whip smears sideways and a crash zoom smears both ways.
 * - TILT-SHIFT depth of field that grows with how far the camera is tilted.
 * - THE MARK AS A PORTAL: the logo tumbles in, settles into the lockup, then
 *   opens into the window the camera flies through into the product.
 * - Answers that PUNCH OUT toward the lens and fly past it on the whip.
 * - A true 3D RING of the tools it connects to, passing behind the headline.
 * - Film grain, so the flat UI reads as footage.
 *
 * Honesty rules held from the first cut: the tools are the ten connections
 * that exist today (no count), no security or "featured" claims, phones show
 * the real no-login links (crew confirm, client approve), not a mobile app.
 * Silent; music is added in Instagram. Readable content sits in y 200-1600.
 */

/* ------------------------------------------------------------- TIMELINE */

const CHAOS_END = 15200;
const REVEAL = 15000;
const PORTAL = 18500; // product world starts drawing inside the mark
const PRODUCT_END = 36200;
const CONNECT = 36000;
const PHONES = 40800;
const CLIENT_PHONE = 3700; // local to PHONES
const OUTRO = 48600;
export const CHASE_MS = OUTRO + 7400; // 56000

const BLACK = "#030207";
const INK = "#17142b";
const easeIn = (p: number) => p * p * p;

/* --------------------------------------------------------------- CAMERA */

type Cam = { x: number; y: number; z: number; rx: number; ry: number; rz: number };
type Key = Cam & { t: number; e?: (p: number) => number };

function camAt(keys: Key[], t: number): Cam {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t <= b.t) {
      const p = (b.e ?? easeInOut)(clamp01((t - a.t) / (b.t - a.t)));
      return {
        x: lerp(a.x, b.x, p),
        y: lerp(a.y, b.y, p),
        // Zoom is multiplicative, so a crash zoom feels even all the way.
        z: a.z * Math.pow(b.z / a.z, p),
        rx: lerp(a.rx, b.rx, p),
        ry: lerp(a.ry, b.ry, p),
        rz: lerp(a.rz, b.rz, p),
      };
    }
  }
  return keys[keys.length - 1];
}

/** Motion blur in screen px, from how far the camera moved in one frame. */
function camBlur(keys: Key[], t: number) {
  const a = camAt(keys, t - 33);
  const b = camAt(keys, t);
  const dz = Math.abs(Math.log(b.z / a.z)) * 520;
  const x = Math.abs(b.x - a.x) * b.z * 0.34 + Math.abs(b.ry - a.ry) * 9 + Math.abs(b.rz - a.rz) * 6 + dz;
  const y = Math.abs(b.y - a.y) * b.z * 0.34 + Math.abs(b.rx - a.rx) * 9 + Math.abs(b.rz - a.rz) * 6 + dz;
  // A slow drift stays crisp; only real moves smear.
  const k = (v: number) => Math.min(60, Math.max(0, v - 5) * 0.9);
  return { x: k(x), y: k(y) };
}

/** Directional blur from an SVG filter (CSS blur is round). */
function MB({ id, x, y = 0, style, children }: { id: string; x: number; y?: number; style?: CSSProperties; children: ReactNode }) {
  const on = x > 0.6 || y > 0.6;
  return (
    <>
      {on ? (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id={id} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${x.toFixed(1)} ${y.toFixed(1)}`} />
          </filter>
        </svg>
      ) : null}
      <div style={{ ...style, filter: on ? `url(#${id})` : undefined }}>{children}</div>
    </>
  );
}

/** A world seen through the camera: the camera point lands at frame centre. */
function World({ id, keys, t, w, h, children, extra, persp = 1500, tilt = 1 }: { id: string; keys: Key[]; t: number; w: number; h: number; children: ReactNode; extra?: ReactNode; persp?: number; tilt?: number }) {
  const c = camAt(keys, t);
  const b = camBlur(keys, t);
  const shift = Math.min(10, Math.max(0, Math.abs(c.rx) * 0.3 + Math.abs(c.ry) * 0.18 - 3) * tilt);
  return (
    <MB id={id} x={b.x} y={b.y} style={{ position: "absolute", inset: 0, perspective: persp, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: w,
          height: h,
          transformOrigin: "0 0",
          transform: `translate(540px, 960px) rotateX(${c.rx}deg) rotateY(${c.ry}deg) rotateZ(${c.rz}deg) scale(${c.z}) translate(${-c.x}px, ${-c.y}px)`,
        }}
      >
        {children}
      </div>
      {shift > 0.5 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backdropFilter: `blur(${shift.toFixed(1)}px)`,
            WebkitMaskImage: "linear-gradient(to bottom, #000 0%, transparent 30%, transparent 70%, #000 100%)",
            maskImage: "linear-gradient(to bottom, #000 0%, transparent 30%, transparent 70%, #000 100%)",
          }}
        />
      ) : null}
      {extra}
    </MB>
  );
}

/* ---------------------------------------------------------------- GRAIN */

function Grain({ t }: { t: number }) {
  const seed = Math.floor(t / 42) % 97;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.11 }} aria-hidden>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}

function Vignette({ strength = 0.6 }: { strength?: number }) {
  return <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,${strength}))` }} />;
}

/* ------------------------------------------------------------ CHAT WORLD */

const CHAT = { bg: "#15131d", panel: "#1c1926", side: "#211936", line: "rgba(255,255,255,.08)", text: "#f1eef9", muted: "#9b96ae" };

/*
 * The opening was cut at reading speed for nobody: everything before the
 * logo now takes 15 seconds. M() stretches WHEN things happen (the hook's
 * lines, each message landing, every camera move) without slowing HOW they
 * animate, so a message still lands with a snap and then holds to be read.
 * Times below are written on the original 10s clock and passed through M().
 */
const STRETCH: [number, number][] = [
  [0, 0],
  [2900, 4400],
  [3550, 5300],
  [7100, 11300],
  [8100, 12500],
  [9450, 14300],
  [10200, 15000],
];
function M(x: number) {
  for (let i = 1; i < STRETCH.length; i++) {
    const [a0, b0] = STRETCH[i - 1];
    const [a1, b1] = STRETCH[i];
    if (x <= a1 || i === STRETCH.length - 1) return b0 + ((x - a0) * (b1 - b0)) / (a1 - a0);
  }
  return x;
}

function stretchMsg(m: Msg): Msg {
  return { ...m, at: M(m.at), react: m.react ? { ...m.react, at: M(m.react.at) } : undefined };
}
type Msg = { who: string; role: string; hue: string; text: string; at: number; time: string; react?: { e: string; n: number; at: number }; replies?: number };

const MSGS: Msg[] = ([
  { who: "Jon", role: "Agency", hue: "cyan", text: "which cut did the client approve?? v3 or v3_FINAL", at: 3300, time: "9:41 PM", react: { e: "👀", n: 4, at: 3900 }, replies: 4 },
  { who: "Priya", role: "DP", hue: "blue", text: "not sure, check the email thread?", at: 4000, time: "9:44 PM" },
  { who: "Leo", role: "Gaffer", hue: "amber", text: "is my call 6:45 or 7 tomorrow?", at: 4700, time: "9:52 PM" },
  { who: "Sam", role: "1st AD", hue: "green", text: "we're 40 min behind. do we still make lunch?", at: 5400, time: "10:07 PM", react: { e: "😬", n: 3, at: 5900 } },
  { who: "Morgan", role: "Exec producer", hue: "purple", text: "did we actually make money on this job?", at: 6100, time: "10:58 PM" },
  { who: "Ava", role: "Prop stylist", hue: "pink", text: "who has the prop house invoice??", at: 6800, time: "11:03 PM", react: { e: "🙏", n: 2, at: 7300 } },
] as Msg[]).map(stretchMsg);
const THREAD: Msg[] = ([
  { who: "Priya", role: "DP", hue: "blue", text: "v3?", at: 8150, time: "9:45 PM" },
  { who: "Theo", role: "Food stylist", hue: "orange", text: "I've got v3_FINAL_v2 😅", at: 8550, time: "9:47 PM" },
  { who: "Dana", role: "Director", hue: "purple", text: "client said the warm one?", at: 8950, time: "9:49 PM" },
  { who: "Jon", role: "Agency", hue: "cyan", text: "...so which one is it", at: 9350, time: "9:58 PM" },
] as Msg[]).map(stretchMsg);
const ROW0 = 200;
const ROWH = 250;
const MAIN_X = 470;
const THREAD_X = 1580;

function Squircle({ name, hue, size }: { name: string; hue: string; size: number }) {
  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size * 0.3,
        background: `linear-gradient(150deg, color-mix(in oklch, var(--h-${hue}) 75%, white), var(--h-${hue}) 60%, color-mix(in oklch, var(--h-${hue}) 70%, black))`,
        color: "white",
        fontWeight: 800,
        fontSize: size * 0.44,
        boxShadow: `0 ${size * 0.1}px ${size * 0.3}px -${size * 0.1}px color-mix(in oklch, var(--h-${hue}) 80%, black)`,
      }}
    >
      {name[0]}
    </span>
  );
}

function Row({ m, t, width, at = m.at }: { m: Msg; t: number; width: number; at?: number }) {
  const p = spring(ramp(t, at, 480));
  if (t < at) return null;
  return (
    <div style={{ display: "flex", gap: 26, width, opacity: clamp01(p * 1.6), transform: `translateY(${(1 - p) * 50}px) scale(${0.96 + p * 0.04})`, transformOrigin: "0 0" }}>
      <Squircle name={m.who} hue={m.hue} size={88} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: CHAT.text }}>{m.who}</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: `var(--h-${m.hue})`, padding: "3px 12px", borderRadius: 9, background: `color-mix(in oklch, var(--h-${m.hue}) 22%, transparent)` }}>{m.role}</span>
          <span style={{ fontSize: 26, color: CHAT.muted }}>{m.time}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 46, lineHeight: 1.22, color: CHAT.text, letterSpacing: "-0.01em" }}>{m.text}</div>
        {m.react && t >= m.react.at ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 14, padding: "6px 16px", borderRadius: 99, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", fontSize: 30, color: CHAT.text, transform: `scale(${spring(ramp(t, m.react.at, 380))})`, transformOrigin: "0 50%" }}>
            {m.react.e} <b>{Math.min(m.react.n, 1 + Math.floor((t - m.react.at) / 150))}</b>
          </div>
        ) : null}
        {m.replies && t >= m.at + 900 ? (
          <span style={{ display: "inline-block", marginTop: 14, marginLeft: m.react ? 16 : 0, fontSize: 30, fontWeight: 700, color: "var(--h-blue)" }}>{Math.min(m.replies, 1 + Math.floor((t - m.at - 900) / 500))} replies</span>
        ) : null}
      </div>
    </div>
  );
}

const CHANNELS: [string, number, number][] = [
  ["general", 0, 0],
  ["hint-shoot", 0, 0],
  ["crew", 12, M(4300)],
  ["post", 7, M(5600)],
  ["accounts", 4, M(6600)],
  ["client-bright-water", 9, M(5000)],
  ["random", 0, 0],
];

function ChatWorld({ t }: { t: number }) {
  const unread = Math.round(lerp(1, 47, easeOut(ramp(t, M(3300), M(9200) - M(3300)))));
  const typing = "one sec, digging through my email...".slice(0, Math.max(0, Math.floor((t - M(7000)) / 45)));
  return (
    <div style={{ position: "relative", width: 2300, height: 2050, borderRadius: 48, overflow: "hidden", background: CHAT.bg, boxShadow: "0 0 0 2px rgba(255,255,255,.06), 0 120px 240px -60px rgba(0,0,0,.9)" }}>
      {/* Sidebar */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 420, background: CHAT.side, padding: "44px 30px", fontSize: 32, color: CHAT.muted }}>
        <div style={{ color: "white", fontWeight: 800, fontSize: 40, marginBottom: 6 }}>Bright Water</div>
        <div style={{ fontSize: 26, marginBottom: 40 }}>Hint shoot · 14 people</div>
        {CHANNELS.map(([c, n, at]) => {
          const active = c === "hint-shoot";
          const on = n > 0 && t >= at;
          return (
            <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", marginBottom: 6, borderRadius: 14, whiteSpace: "nowrap", background: active ? "color-mix(in oklch, var(--h-indigo) 58%, transparent)" : undefined, color: active || on ? "white" : CHAT.muted, fontWeight: active || on ? 800 : 500 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}># {c}</span>
              {on ? <span style={{ fontSize: 24, fontWeight: 800, color: "white", background: "var(--h-red)", borderRadius: 99, padding: "2px 12px", transform: `scale(${spring(ramp(t, at, 380))})` }}>{n}</span> : null}
            </div>
          );
        })}
        <div style={{ marginTop: 40, marginBottom: 10, fontSize: 24, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Direct messages</div>
        {MSGS.map((m, i) => (
          <div key={m.who + i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 18px", color: t > m.at ? "white" : CHAT.muted, fontWeight: t > m.at ? 800 : 500 }}>
            <span style={{ width: 16, height: 16, borderRadius: 99, background: `var(--h-${m.hue})` }} /> {m.who}
          </div>
        ))}
      </div>
      {/* Channel header */}
      <div style={{ position: "absolute", left: 420, width: 1120, top: 0, height: 140, borderBottom: `2px solid ${CHAT.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 50px" }}>
        <span style={{ fontSize: 46, fontWeight: 800, color: CHAT.text }}># hint-shoot</span>
        <span style={{ fontSize: 30, fontWeight: 800, color: "white", background: "var(--h-red)", borderRadius: 99, padding: "8px 24px", boxShadow: "0 0 30px color-mix(in oklch, var(--h-red) 60%, transparent)" }}>{unread} unread</span>
      </div>
      {/* Feed */}
      {MSGS.map((m, i) => (
        <div key={i} style={{ position: "absolute", left: MAIN_X, top: ROW0 + i * ROWH }}>
          <Row m={m} t={t} width={1020} />
        </div>
      ))}
      {/* Composer */}
      <div style={{ position: "absolute", left: MAIN_X, width: 1020, top: 1720, height: 250, borderRadius: 30, border: `2px solid ${t > M(7000) ? "rgba(255,255,255,.3)" : CHAT.line}`, padding: "30px 34px", fontSize: 42, color: CHAT.muted }}>
        {t > M(7000) ? (
          <span style={{ color: CHAT.text }}>
            {typing}
            <span style={{ opacity: Math.floor(t / 260) % 2 ? 1 : 0.15 }}>|</span>
          </span>
        ) : (
          "Message # hint-shoot"
        )}
        <div style={{ position: "absolute", left: 34, bottom: 24, display: "flex", gap: 30, fontWeight: 900, fontSize: 32, color: CHAT.muted }}>
          <span>B</span>
          <span style={{ fontStyle: "italic" }}>I</span>
          <span style={{ textDecoration: "underline" }}>U</span>
          <span>S</span>
          <span>+</span>
        </div>
      </div>
      {/* Thread panel */}
      <div style={{ position: "absolute", left: 1540, right: 0, top: 0, bottom: 0, background: CHAT.panel, borderLeft: `2px solid ${CHAT.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 44px", height: 140, borderBottom: `2px solid ${CHAT.line}` }}>
          <span style={{ fontSize: 48, fontWeight: 800, color: CHAT.text }}>Thread</span>
          <span style={{ fontSize: 40, color: CHAT.muted }}>×</span>
        </div>
        <div style={{ position: "absolute", left: 40, top: 190 }}>
          <Row m={MSGS[0]} t={t} width={640} at={MSGS[0].at} />
        </div>
        <div style={{ position: "absolute", left: 40, right: 40, top: 520, display: "flex", alignItems: "center", gap: 18, fontSize: 28, color: CHAT.muted, fontWeight: 700 }}>
          4 replies <span style={{ flex: 1, height: 2, background: CHAT.line }} />
        </div>
        {THREAD.map((m, i) => (
          <div key={i} style={{ position: "absolute", left: 40, top: 600 + i * 270 }}>
            <Row m={m} t={t} width={640} />
          </div>
        ))}
        {t > M(9500) ? (
          <div style={{ position: "absolute", left: 44, top: 1700, fontSize: 30, color: CHAT.muted, fontStyle: "italic" }}>
            3 people are typing
            {".".repeat(1 + (Math.floor(t / 300) % 3))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/*
 * The camera reads like a person reading: it HOLDS while a message lands,
 * then snaps down to the next one, with a small change of angle each time.
 */
const focusY = (i: number) => ROW0 + i * ROWH - 170;
const CHAOS_KEYS: Key[] = (() => {
  const k: Key[] = [
    { t: 0, x: 1250, y: 1050, z: 0.3, rx: 42, ry: -32, rz: 9 },
    { t: M(2950), x: 1100, y: 980, z: 0.42, rx: 30, ry: -20, rz: 5 },
    { t: M(3550), x: 965, y: focusY(0) + 40, z: 1.14, rx: 9, ry: -7, rz: 0, e: easeInOut },
  ];
  for (let i = 1; i < MSGS.length; i++) {
    const side = i % 2 ? 1 : -1;
    const prev = k[k.length - 1];
    k.push({ ...prev, t: MSGS[i].at - 120, z: prev.z * 1.025, e: easeInOut });
    k.push({ t: MSGS[i].at + 180, x: 965 + side * 10, y: focusY(i), z: 1.17 + (i % 2) * 0.05, rx: 6 + (i % 2) * 2, ry: side * 4, rz: side * -0.6, e: easeInOut });
  }
  const last = k[k.length - 1];
  k.push({ ...last, t: M(7150), z: last.z * 1.03 });
  k.push({ t: M(7450), x: 990, y: 1560, z: 1.2, rx: 5, ry: 6, rz: 0, e: easeInOut });
  k.push({ t: M(7800), x: 1000, y: 1590, z: 1.24, rx: 5, ry: 7, rz: 0 });
  k.push({ t: M(8100), x: 1930, y: 640, z: 1.12, rx: 4, ry: 20, rz: 0, e: easeInOut });
  k.push({ t: M(9450), x: 1930, y: 1180, z: 1.26, rx: 6, ry: 12, rz: -2 });
  k.push({ t: M(10200), x: 1300, y: 1000, z: 0.1, rx: 24, ry: -32, rz: -28, e: easeIn });
  return k;
})();

function ChaosSection({ t }: { t: number }) {
  const hook = 1 - ramp(t, M(2900), 600); // world sits dim and soft under the hook
  return (
    <div style={{ position: "absolute", inset: 0, opacity: ramp(t, 200, 1100) * (1 - ramp(t, M(9900), 300)) }}>
      <World
        id="chaos"
        keys={CHAOS_KEYS}
        t={t}
        w={2300}
        h={2050}
        extra={hook > 0 ? <div style={{ position: "absolute", inset: 0, background: BLACK, opacity: hook * 0.62, backdropFilter: `blur(${hook * 6}px)` }} /> : null}
      >
        <ChatWorld t={t} />
      </World>
      <Vignette strength={0.7} />
    </div>
  );
}

function HookText({ t }: { t: number }) {
  const out = ramp(t, M(2700), 380);
  return (
    <div
      className="font-display"
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        top: 760,
        textAlign: "center",
        color: "white",
        fontSize: 80,
        fontWeight: 800,
        letterSpacing: "-0.035em",
        lineHeight: 1.06,
        opacity: 1 - out,
        transform: `scale(${1 + out * 0.25})`,
        filter: out > 0 ? `blur(${out * 14}px)` : undefined,
        textShadow: "0 8px 40px rgba(0,0,0,.8)",
      }}
    >
      <Words text="Every shoot has someone" t={t} at={M(100)} stagger={75} style={{ display: "block" }} />
      <Words text="chasing answers at 11 PM." t={t} at={M(480)} stagger={75} style={{ display: "block" }} />
      <div style={{ marginTop: 34, fontSize: 112, color: GLOW, transform: `scale(${0.8 + 0.2 * spring(ramp(t, M(1500), 520))})`, opacity: ramp(t, M(1500), 160) }}>It&apos;s usually you.</div>
    </div>
  );
}

/* ---------------------------------------------------------------- REVEAL */

/** Words that swing in on their own vertical axis, out of depth. */
function SwingWords({ text, t, at, size, color, stagger = 90 }: { text: string; t: number; at: number; size: number; color: string; stagger?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: size * 0.26, perspective: 900 }}>
      {text.split(" ").map((w, i) => {
        const p = easeOut(ramp(t, at + i * stagger, 700));
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color,
              fontSize: size,
              transform: `rotateY(${(1 - p) * 85}deg) translateZ(${(1 - p) * -300}px)`,
              transformOrigin: "0 50%",
              opacity: clamp01(p * 2),
              filter: p < 1 ? `blur(${(1 - p) * 12}px)` : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </span>
  );
}

/** Where the tumbling mark is, and how it is turned, at local time u. */
function markPose(u: number) {
  const p = easeOut(ramp(u, 0, 1200));
  const x = lerp(-260, 540, p) + Math.sin(p * Math.PI) * -120;
  const y = lerp(1750, 860, p) - Math.sin(p * Math.PI) * 260;
  return { x, y, rx: (1 - p) * 300, ry: (1 - p) * -520, rz: (1 - p) * 80, s: lerp(1.9, 1, p) };
}

function RevealSection({ t }: { t: number }) {
  const settle = easeInOut(ramp(t, 1250, 650));
  const textOut = easeIn(ramp(t, 3050, 420));
  const pulse = 0.5 + 0.5 * Math.sin(t / 380);
  const pose = markPose(t);
  const tile = lerp(250, 140, settle);
  const lockX = lerp(pose.x, 540 - 345, settle);
  const ghosts = [90, 60, 30];
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 45%, color-mix(in oklch, var(--h-indigo) ${26 + pulse * 10}%, transparent), transparent 58%)`, opacity: ramp(t, 300, 900) * (1 - textOut) }} />
      {/* The trail, then the mark */}
      {t < 1300
        ? ghosts.map((g, i) => {
            const q = markPose(t - g);
            return (
              <div key={g} style={{ position: "absolute", left: q.x, top: q.y, perspective: 1000, opacity: 0.12 + i * 0.08, filter: "blur(6px)" }}>
                <div style={{ transform: `translate(-50%, -50%) rotateX(${q.rx}deg) rotateY(${q.ry}deg) rotateZ(${q.rz}deg) scale(${q.s})` }}>
                  <MarkTile size={250} t={10000} at={0} glow={false} />
                </div>
              </div>
            );
          })
        : null}
      <div style={{ position: "absolute", left: lockX, top: pose.y, perspective: 1000, opacity: 1 - ramp(t, 3350, 1) }}>
        <div style={{ transform: `translate(-50%, -50%) rotateX(${pose.rx}deg) rotateY(${pose.ry}deg) rotateZ(${pose.rz}deg) scale(${pose.s})` }}>
          <MarkTile size={tile} t={t} at={250} />
        </div>
      </div>
      <div style={{ opacity: 1 - textOut, filter: textOut > 0 ? `blur(${textOut * 16}px)` : undefined, transform: `scale(${1 + textOut * 0.3})`, transformOrigin: "50% 48%" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", fontWeight: 700 }}>
          <SwingWords text="One home for the whole job" t={t} at={700} size={46} color="rgba(255,255,255,.75)" stagger={70} />
        </div>
        <div className="font-display" style={{ position: "absolute", left: lockX + 100, top: 860, transform: "translateY(-50%)", width: lerp(0, 740, settle), overflow: "hidden", whiteSpace: "nowrap", fontSize: 116, fontWeight: 800, letterSpacing: "-0.045em", color: "white" }}>
          Studio Flows
        </div>
        <div className="font-display" style={{ position: "absolute", left: 0, right: 0, top: 1000, textAlign: "center", fontWeight: 800, letterSpacing: "-0.035em" }}>
          <SwingWords text="Brief to final invoice." t={t} at={1850} size={98} color={GLOW} stagger={110} />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- PRODUCT WORLD */

type Beat = {
  q: Msg;
  hue: string;
  gx: number;
  gy: number;
  scene: (t: number) => ReactNode;
  pay: number; // scene time of the payoff
  speed: number;
  pop: "approve" | "ring" | "clock" | "margin";
  line: [string, string];
};

const BEATS: Beat[] = [
  { q: MSGS[0], hue: "pink", gx: 100, gy: 100, scene: (t) => <ReviewScene t={t} />, pay: 6600, speed: 1.4, pop: "approve", line: ["Approved.", "Right on the frame."] },
  { q: MSGS[2], hue: "amber", gx: 1550, gy: 760, scene: (t) => <CallSheetScene t={t} />, pay: 6900, speed: 1.4, pop: "ring", line: ["Every call time.", "Confirmed."] },
  { q: MSGS[3], hue: "green", gx: 120, gy: 1800, scene: (t) => <ScheduleScene t={t} />, pay: 5300, speed: 1.6, pop: "clock", line: ["The day", "re-flows itself."] },
  { q: MSGS[4], hue: "indigo", gx: 1560, gy: 2480, scene: (t) => <BudgetScene t={t} />, pay: 6800, speed: 1.4, pop: "margin", line: ["Know what", "the job made."] },
];
const A0 = 1500; // product-local time the camera settles on the first beat
const STEP = 4100;
const arriveAt = (i: number) => A0 + i * STEP;
const payAt = (i: number) => arriveAt(i) + 1700;
const sceneTime = (b: Beat, i: number, u: number) => b.pay - 2300 * b.speed + Math.max(0, u - (arriveAt(i) - 600)) * b.speed;
const groupCam = (b: Beat): [number, number] => [b.gx + 560, b.gy + 540];

const PRODUCT_KEYS: Key[] = (() => {
  const k: Key[] = [];
  const [x0, y0] = groupCam(BEATS[0]);
  k.push({ t: 0, x: x0, y: y0 + 120, z: 0.42, rx: 18, ry: -16, rz: -22 });
  BEATS.forEach((b, i) => {
    const [x, y] = groupCam(b);
    const side = i % 2 ? 1 : -1;
    k.push({ t: arriveAt(i), x, y: y + 40, z: 0.9, rx: 7, ry: 9 * side, rz: side * -1.5, e: i === 0 ? easeOut : easeOut });
    k.push({ t: arriveAt(i) + 3500, x: x + side * 20, y: y + 10, z: 0.99, rx: 3, ry: 2 * side, rz: 0, e: easeInOut });
  });
  // Final: crash into the margin.
  const [xl, yl] = groupCam(BEATS[3]);
  k.push({ t: arriveAt(3) + 4100, x: xl + 300, y: yl - 160, z: 4.5, rx: 0, ry: 0, rz: 4, e: easeIn });
  return k;
})();

function QuestionBubble({ m, t, at }: { m: Msg; t: number; at: number }) {
  const p = spring(ramp(t, at, 560));
  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        top: 0,
        width: 1040,
        padding: "34px 40px",
        borderRadius: 40,
        background: CHAT.bg,
        boxShadow: "0 40px 90px -30px rgba(10,6,30,.55)",
        transform: `translateY(${(1 - p) * 60}px) scale(${0.9 + 0.1 * p})`,
        opacity: clamp01(p * 1.5),
        transformOrigin: "10% 100%",
      }}
    >
      <div style={{ position: "absolute", left: 60, bottom: -22, width: 44, height: 44, background: CHAT.bg, transform: "rotate(45deg)", borderRadius: 6 }} />
      <div style={{ display: "flex", gap: 24 }}>
        <Squircle name={m.who} hue={m.hue} size={84} />
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: CHAT.text }}>{m.who}</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: `var(--h-${m.hue})` }}>{m.role}</span>
            <span style={{ fontSize: 26, color: CHAT.muted }}>{m.time} · #hint-shoot</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 44, lineHeight: 1.2, color: CHAT.text }}>{m.text}</div>
        </div>
      </div>
    </div>
  );
}

function ProductWorld({ u }: { u: number }) {
  // The route from beat to beat, drawn as the camera travels it.
  const pts = BEATS.map((b) => groupCam(b));
  const d = pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `C ${pts[i - 1][0]} ${pts[i - 1][1] + 700}, ${p[0]} ${p[1] - 700}, ${p[0]} ${p[1]}`)).join(" ");
  const drawn = clamp01((u - 400) / (arriveAt(3) + 600));
  return (
    <div data-theme="light" style={{ position: "relative", width: 3200, height: 4400, background: "#f6f5fb", color: "var(--text)" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(40,30,90,.13) 3px, transparent 3px)", backgroundSize: "70px 70px" }} />
      {BEATS.map((b, i) => (
        <div key={i} style={{ position: "absolute", left: b.gx - 500, top: b.gy - 400, width: 2100, height: 1900, background: `radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--h-${b.hue}) 22%, transparent), transparent 62%)` }} />
      ))}
      <svg width={3200} height={4400} style={{ position: "absolute", inset: 0 }} aria-hidden>
        <path d={d} fill="none" stroke="color-mix(in oklch, var(--h-indigo) 25%, transparent)" strokeWidth={14} strokeDasharray="2 34" strokeLinecap="round" />
        <path d={d} fill="none" stroke="var(--h-indigo)" strokeWidth={14} strokeLinecap="round" pathLength={1} strokeDasharray={`${drawn} 1`} />
      </svg>
      {BEATS.map((b, i) => {
        const near = u > arriveAt(i) - 2400 && u < arriveAt(i) + STEP + 800;
        return (
          <div key={i} style={{ position: "absolute", left: b.gx, top: b.gy, width: 1120, height: 1080 }}>
            <QuestionBubble m={b.q} t={u} at={arriveAt(i) - 450} />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 270,
                width: 1120,
                height: 790,
                borderRadius: 56,
                overflow: "hidden",
                background: `linear-gradient(150deg, var(--h-${b.hue}-bg), var(--surface-2) 70%, var(--surface))`,
                boxShadow: `0 70px 140px -50px color-mix(in oklch, var(--h-${b.hue}) 75%, transparent), 0 0 0 2px rgba(255,255,255,.7)`,
              }}
            >
              {near ? <div style={{ position: "absolute", left: 560, top: 395, width: 640, height: 440, transform: "translate(-50%, -50%) scale(1.68)" }}>{b.scene(sceneTime(b, i, u))}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Pop-outs: the answer leaves the screen and comes at the lens. */
function PopOut({ b, t }: { b: Beat; t: number }) {
  // t is local: 0 at the payoff.
  const inP = spring(ramp(t, 0, 620));
  const fly = easeIn(ramp(t, 1900, 420)); // as the camera whips away
  const bob = Math.sin(t / 420) * 10;
  const s = lerp(0.2, 1, inP) * lerp(1, 4.2, fly);
  const blur = fly * 26 + (1 - inP) * 10;
  const hue = `var(--h-${b.hue})`;
  let face: ReactNode = null;
  if (b.pop === "approve") {
    face = (
      <>
        <div style={{ width: 230, height: 230, borderRadius: 999, display: "grid", placeItems: "center", background: "linear-gradient(150deg, color-mix(in oklch, var(--h-green) 70%, white), var(--h-green))", boxShadow: "0 30px 60px -20px color-mix(in oklch, var(--h-green) 90%, black), inset 0 6px 0 rgba(255,255,255,.4)" }}>
          <svg width="120" height="120" viewBox="0 0 24 24" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${easeOut(ramp(t, 150, 450))} 1`} />
          </svg>
        </div>
        <div style={{ marginTop: 22, padding: "16px 30px", borderRadius: 99, background: "white", fontSize: 40, fontWeight: 800, color: INK, boxShadow: "0 20px 40px -18px rgba(20,10,60,.4)", whiteSpace: "nowrap" }}>v3 approved by Maya</div>
      </>
    );
  } else if (b.pop === "ring") {
    const k = easeOut(ramp(t, 0, 700));
    const C = 2 * Math.PI * 100;
    face = (
      <>
        <div style={{ position: "relative", width: 260, height: 260, borderRadius: 999, background: "white", boxShadow: "0 30px 60px -20px rgba(120,70,0,.5)", display: "grid", placeItems: "center" }}>
          <svg width="260" height="260" viewBox="0 0 260 260" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} aria-hidden>
            <circle cx="130" cy="130" r="100" fill="none" stroke="var(--h-amber-bg)" strokeWidth="26" />
            <circle cx="130" cy="130" r="100" fill="none" stroke={hue} strokeWidth="26" strokeLinecap="round" strokeDasharray={`${C * k} ${C}`} />
          </svg>
          <span className="font-display" style={{ fontSize: 84, fontWeight: 800, letterSpacing: "-0.04em", color: INK }}>{Math.round(lerp(5, 8, k))}/8</span>
        </div>
        <div style={{ marginTop: 22, padding: "16px 30px", borderRadius: 99, background: hue, fontSize: 40, fontWeight: 800, color: "white", whiteSpace: "nowrap" }}>Crew confirmed</div>
      </>
    );
  } else if (b.pop === "clock") {
    const k = easeInOut(ramp(t, 0, 900));
    const min = lerp(-75, 0, k); // the wrap comes back from 7:15 to 6:00
    face = (
      <>
        <div style={{ position: "relative", width: 250, height: 250, borderRadius: 999, background: "white", border: `14px solid ${hue}`, boxShadow: "0 30px 60px -20px rgba(0,80,40,.5)" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} style={{ position: "absolute", left: "50%", top: "50%", width: 6, height: 20, marginLeft: -3, background: "#cfcbe0", borderRadius: 3, transform: `rotate(${i * 30}deg) translateY(-96px)` }} />
          ))}
          <span style={{ position: "absolute", left: "50%", top: "50%", width: 12, height: 64, marginLeft: -6, marginTop: -64, background: INK, borderRadius: 6, transformOrigin: "50% 100%", transform: `rotate(${180 + min * 0.5}deg)` }} />
          <span style={{ position: "absolute", left: "50%", top: "50%", width: 8, height: 92, marginLeft: -4, marginTop: -92, background: hue, borderRadius: 4, transformOrigin: "50% 100%", transform: `rotate(${min * 6}deg)` }} />
          <span style={{ position: "absolute", left: "50%", top: "50%", width: 22, height: 22, margin: -11, borderRadius: 99, background: INK }} />
        </div>
        <div style={{ marginTop: 22, padding: "16px 30px", borderRadius: 99, background: hue, fontSize: 40, fontWeight: 800, color: "white", whiteSpace: "nowrap" }}>Wrap 6:00 PM · on target</div>
      </>
    );
  } else {
    face = (
      <>
        <div className="font-display" style={{ fontSize: 260, fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 0.9, background: "linear-gradient(160deg, color-mix(in oklch, var(--h-indigo) 55%, white), var(--h-indigo) 50%, var(--h-purple))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "drop-shadow(0 24px 30px rgba(40,20,120,.35))" }}>
          {Math.round(lerp(0, 31, easeOut(ramp(t, 0, 800))))}%
        </div>
        <div style={{ marginTop: 10, padding: "16px 30px", borderRadius: 99, background: hue, fontSize: 40, fontWeight: 800, color: "white", whiteSpace: "nowrap" }}>margin on Bright Water</div>
      </>
    );
  }
  return (
    <div style={{ position: "absolute", left: 600, top: 1030, perspective: 1200, opacity: 1 - ramp(t, 2150, 170) }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translate(-50%, -50%) translateY(${bob}px) rotateY(${(1 - inP) * -60 + Math.sin(t / 700) * 10}deg) rotateX(${(1 - inP) * 30 + 6}deg) rotateZ(${(1 - inP) * -20 - 4}deg) scale(${s})`,
          filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
        }}
      >
        {face}
      </div>
    </div>
  );
}

function Headline({ b, t }: { b: Beat; t: number }) {
  // t local: 0 at the payoff
  const out = ramp(t, 1950, 250);
  return (
    <div className="font-display" style={{ position: "absolute", left: 60, right: 60, top: 1430, textAlign: "center", fontSize: 92, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.0, color: INK, opacity: 1 - out, textShadow: "0 0 40px #f6f5fb, 0 0 80px #f6f5fb" }}>
      <Words text={b.line[0]} t={t} at={150} stagger={80} style={{ display: "block" }} />
      <Words text={b.line[1]} t={t} at={330} stagger={80} accent={{ words: [0, 1, 2, 3], color: `var(--h-${b.hue})` }} style={{ display: "block" }} />
    </div>
  );
}

function ProductSection({ u }: { u: number }) {
  const i = Math.min(3, Math.max(0, Math.floor((u - A0 + 600) / STEP)));
  const b = BEATS[i];
  const local = u - payAt(i);
  return (
    <>
      <World id="product" keys={PRODUCT_KEYS} t={u} w={3200} h={4400} persp={1700} tilt={0.8}>
        <ProductWorld u={u} />
      </World>
      {local > 0 && local < 2400 ? <PopOut b={b} t={local} /> : null}
      {local > 0 && local < 2300 ? <Headline b={b} t={local} /> : null}
      {/* Progress pips */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 210, display: "flex", justifyContent: "center", gap: 14, opacity: ramp(u, 1200, 400) }}>
        {BEATS.map((x, k) => (
          <span key={k} style={{ width: k === i ? 90 : 26, height: 12, borderRadius: 99, background: k <= i ? `var(--h-${x.hue})` : "rgba(30,20,70,.15)" }} />
        ))}
      </div>
    </>
  );
}

/** The mark opening into the product: a window the camera flies through. */
function Portal({ t }: { t: number }) {
  // t local to PORTAL. The window grows from the settled lockup position.
  const g = easeIn(ramp(t, 0, 950));
  const size = 140 * Math.pow(45, g);
  const cx = lerp(540 - 345, 540, easeInOut(ramp(t, 0, 600)));
  const cy = 860 + lerp(0, 100, easeInOut(ramp(t, 0, 700)));
  const r = size * 0.28;
  const rot = (1 - g) * 0;
  const rim = Math.max(6, size * 0.045);
  const half = size / 2;
  return { cx, cy, size, r, rot, rim, half, done: g >= 1 };
}

/* -------------------------------------------------------------- CONNECT */

function GDrive({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87 78" aria-hidden>
      <path fill="#0066DA" d="M6.6 66.9l3.9 6.7c.8 1.4 1.9 2.5 3.2 3.3l13.8-23.9H0c0 1.6.4 3.1 1.2 4.5z" />
      <path fill="#00AC47" d="M43.7 25.2L29.9 1.3c-1.3.8-2.4 1.9-3.2 3.3L1.2 48.5C.4 49.9 0 51.5 0 53h27.5z" />
      <path fill="#EA4335" d="M73.6 76.9c1.3-.8 2.4-1.9 3.2-3.3l1.6-2.8 7.7-13.3c.8-1.4 1.2-2.9 1.2-4.5H59.8l5.9 11.5z" />
      <path fill="#00832D" d="M43.7 25.2L57.5 1.3C56.2.5 54.7 0 53.1 0H34.3c-1.6 0-3.1.5-4.4 1.3z" />
      <path fill="#2684FC" d="M59.8 53H27.5L13.7 76.9c1.3.8 2.8 1.2 4.4 1.2h51.1c1.6 0 3.1-.5 4.4-1.2z" />
      <path fill="#FFBA00" d="M73.4 26.7l-12.7-22c-.8-1.4-1.9-2.5-3.2-3.3L43.7 25.2 59.8 53h27.4c0-1.6-.4-3.1-1.2-4.5z" />
    </svg>
  );
}
function GCal({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="2" y="3" width="20" height="19" rx="3" fill="white" stroke="#4285F4" strokeWidth="2" />
      <rect x="2" y="3" width="20" height="5" rx="2" fill="#4285F4" />
      <text x="12" y="18.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#4285F4" fontFamily="system-ui">31</text>
    </svg>
  );
}
function Figma({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 57" aria-hidden>
      <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
      <path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
      <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19z" />
      <path fill="#F24E1E" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
      <path fill="#A259FF" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
    </svg>
  );
}

const TOOLS: { name: string; mark?: (s: number) => ReactNode }[] = [
  { name: "Gmail", mark: (s) => <GmailGlyph size={s} /> },
  { name: "Slack", mark: (s) => <SlackGlyph size={s} /> },
  { name: "Google Drive", mark: (s) => <GDrive size={s} /> },
  { name: "Claude" },
  { name: "Figma", mark: (s) => <Figma size={s * 0.8} /> },
  { name: "Google Chat", mark: (s) => <ChatGlyph size={s} /> },
  { name: "ChatGPT" },
  { name: "Calendar", mark: (s) => <GCal size={s} /> },
  { name: "BILL" },
  { name: "Higgsfield" },
];

function ConnectSection({ t }: { t: number }) {
  const open = easeOut(ramp(t, 0, 1300));
  const close = easeInOut(ramp(t, 3700, 700));
  const tilt = lerp(lerp(89.5, 63, open), 89.5, close);
  const spin = t / 24 + 40;
  const R = lerp(260, 780, open);
  const flash = 1 - ramp(t, 0, 600);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#f8f7fc", opacity: 1 - ramp(t, 4450, 350) }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--h-indigo) 16%, transparent), transparent 60%)" }} />
      <div style={{ position: "absolute", left: 540, top: 960, perspective: 1300, transformStyle: "preserve-3d" }}>
        <div style={{ transformStyle: "preserve-3d", transform: `scale(${lerp(1, 0.75, close)})` }}>
          {/* The headline sits in the plane the ring passes through. */}
          <div className="font-display" style={{ position: "absolute", left: -470, width: 940, top: -110, textAlign: "center", fontSize: 96, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1.0, color: INK, transform: "translateZ(0)" }}>
            <Words text="Plugs into the tools" t={t} at={500} stagger={80} style={{ display: "block" }} />
            <Words text="you already use." t={t} at={760} stagger={80} accent={{ words: [2], color: "var(--h-indigo)" }} style={{ display: "block" }} />
          </div>
          <div style={{ transformStyle: "preserve-3d", transform: `translateY(${lerp(0, 330, close)}px) rotateX(${tilt}deg) rotateZ(${spin}deg)` }}>
            {TOOLS.map((tool, i) => {
              const a = (i / TOOLS.length) * 360;
              const world = ((a + spin) * Math.PI) / 180;
              const depth = (Math.sin(world) + 1) / 2; // 1 = nearest the camera
              const blur = (1 - depth) * 5;
              return (
                <div key={tool.name} style={{ position: "absolute", left: 0, top: 0, transformStyle: "preserve-3d", transform: `rotateZ(${a}deg) translateX(${R}px) rotateZ(${-a - spin}deg) rotateX(${-tilt}deg)` }}>
                  <div
                    style={{
                      transform: "translate(-50%, -50%)",
                      display: "flex",
                      alignItems: "center",
                      gap: 18,
                      padding: tool.mark ? "22px 34px 22px 24px" : "26px 38px",
                      borderRadius: 32,
                      background: "white",
                      boxShadow: "0 30px 60px -24px rgba(30,20,80,.4), 0 0 0 1px rgba(30,20,80,.06)",
                      whiteSpace: "nowrap",
                      filter: blur > 0.4 ? `blur(${blur}px)` : undefined,
                    }}
                  >
                    {tool.mark ? tool.mark(70) : null}
                    <span style={{ fontSize: 42, fontWeight: 800, color: INK }}>{tool.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {flash > 0 ? <div style={{ position: "absolute", inset: 0, background: "white", opacity: flash }} /> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- PHONES */

function Phone({ children, light = true }: { children: ReactNode; light?: boolean }) {
  return (
    <div style={{ position: "relative", width: 600, height: 1220, borderRadius: 100, padding: 18, background: light ? "linear-gradient(150deg, #fafafc, #c3bfcf 60%, #8e8a9c)" : "linear-gradient(150deg, #4a4752, #17161c 55%, #08080b)", boxShadow: "0 100px 160px -50px rgba(0,0,0,.95), inset 0 0 0 3px rgba(255,255,255,.22)" }}>
      <span style={{ position: "absolute", right: -7, top: 300, width: 7, height: 150, borderRadius: 4, background: light ? "#b6b2c2" : "#2a2830" }} />
      <span style={{ position: "absolute", left: -7, top: 260, width: 7, height: 90, borderRadius: 4, background: light ? "#b6b2c2" : "#2a2830" }} />
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 84, overflow: "hidden", background: light ? "#ffffff" : "#0c0b11" }}>
        <div style={{ position: "absolute", left: "50%", top: 24, width: 190, height: 56, borderRadius: 99, background: "#000", transform: "translateX(-50%)", zIndex: 5 }} />
        <div style={{ position: "absolute", left: 50, right: 50, top: 36, display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 700, color: light ? INK : "white", zIndex: 4 }}>
          <span>6:02</span>
          <span>●●● 5G</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Tap({ t, at, x, y }: { t: number; at: number; x: number; y: number }) {
  if (t < at - 700 || t > at + 600) return null;
  const move = easeOut(ramp(t, at - 700, 600));
  const ring = ramp(t, at, 500);
  return (
    <div style={{ position: "absolute", left: lerp(x + 140, x, move), top: lerp(y + 220, y, move), opacity: 1 - ramp(t, at + 300, 300), zIndex: 9 }}>
      <span style={{ position: "absolute", left: -50, top: -50, width: 100, height: 100, borderRadius: 99, background: "rgba(255,255,255,.28)", border: "3px solid rgba(255,255,255,.85)", transform: `scale(${t > at - 120 && t < at + 120 ? 0.82 : 1})` }} />
      {ring > 0 && ring < 1 ? <span style={{ position: "absolute", left: -50, top: -50, width: 100, height: 100, borderRadius: 99, border: "4px solid white", transform: `scale(${1 + ring * 1.4})`, opacity: 1 - ring }} /> : null}
    </div>
  );
}

function CrewScreen({ t, tap }: { t: number; tap: number }) {
  const ok = t >= tap;
  return (
    <div style={{ position: "absolute", inset: 0, padding: "120px 40px 40px", color: "white" }}>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--h-amber)" }}>Call sheet · Day 1</div>
      <div className="font-display" style={{ marginTop: 10, fontSize: 60, fontWeight: 800, letterSpacing: "-0.035em" }}>Bright Water</div>
      <div style={{ fontSize: 30, color: "rgba(255,255,255,.6)" }}>Thu, Oct 6 · Stage 2, Culver City</div>
      <div style={{ marginTop: 36, padding: 32, borderRadius: 34, background: "linear-gradient(140deg, color-mix(in oklch, var(--h-amber) 50%, #1a1720), #17151d)" }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,.75)" }}>Your call, Leo</div>
        <div className="font-display" style={{ fontSize: 118, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1.02 }}>6:45 AM</div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,.75)" }}>Gaffer · Breakfast 6:30</div>
      </div>
      {[
        ["General call", "7:00 AM"],
        ["Lunch", "12:30 PM"],
        ["Wrap", "6:00 PM"],
      ].map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "22px 6px", borderBottom: "1px solid rgba(255,255,255,.1)", fontSize: 34 }}>
          <span style={{ color: "rgba(255,255,255,.6)" }}>{k}</span>
          <span style={{ fontWeight: 800 }}>{v}</span>
        </div>
      ))}
      <div style={{ position: "absolute", left: 40, right: 40, bottom: 70, height: 140, borderRadius: 36, display: "grid", placeItems: "center", fontSize: 44, fontWeight: 800, background: ok ? "var(--h-green)" : "white", color: ok ? "white" : "#141219", transform: `scale(${t > tap - 120 && t < tap + 100 ? 0.95 : 1})`, boxShadow: ok ? "0 0 60px color-mix(in oklch, var(--h-green) 70%, transparent)" : undefined }}>
        {ok ? "✓  Confirmed" : "Confirm I'll be there"}
      </div>
      <Tap t={t} at={tap} x={300} y={1040} />
    </div>
  );
}

function ClientScreen({ t, tap }: { t: number; tap: number }) {
  const ok = t >= tap;
  return (
    <div style={{ position: "absolute", inset: 0, padding: "120px 36px 40px", color: INK, background: "#fbfaff" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--h-pink)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Review · no login</div>
      <div className="font-display" style={{ marginTop: 8, fontSize: 52, fontWeight: 800, letterSpacing: "-0.035em" }}>Hero pack shot · v3</div>
      <div style={{ position: "relative", marginTop: 26, height: 560, borderRadius: 34, overflow: "hidden", background: "linear-gradient(170deg, #c9f3fb, #e8f7ff 60%, #fff7e6)" }}>
        <div style={{ position: "absolute", left: 120, right: 120, bottom: 50, height: 70, borderRadius: "50%", background: "rgba(255,255,255,.8)" }} />
        <div style={{ position: "absolute", left: 175, top: 90, width: 76, height: 50, borderRadius: 12, background: "var(--h-indigo)" }} />
        <div style={{ position: "absolute", left: 135, top: 130, width: 156, height: 380, borderRadius: "60px 60px 34px 34px", background: "linear-gradient(90deg, #1d7fe0, #2b9cf2 50%, #1878d6)" }} />
        <div style={{ position: "absolute", left: 152, top: 270, width: 122, height: 110, borderRadius: 14, background: "white" }} />
        <div style={{ position: "absolute", left: 340, top: 340, width: 110, height: 170, borderRadius: "8px 8px 22px 22px", border: "6px solid #39b7cf", background: "linear-gradient(transparent 30%, #f3c86c 30%)" }} />
        {[
          [190, 300, 1],
          [395, 330, 2],
        ].map(([x, y, n]) => (
          <span key={n} style={{ position: "absolute", left: x, top: y, width: 58, height: 58, margin: -29, borderRadius: 99, display: "grid", placeItems: "center", background: ok ? "var(--h-green)" : "var(--h-pink)", color: "white", fontWeight: 800, fontSize: 28, border: "4px solid white", boxShadow: "0 8px 20px rgba(0,0,0,.2)" }}>
            {ok ? "✓" : n}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 22, padding: "20px 24px", borderRadius: 24, background: "white", boxShadow: "0 10px 30px -14px rgba(20,10,60,.25)", fontSize: 30 }}>
        <b>Maya</b> <span style={{ color: "#8a8799" }}>Client</span>
        <div>The splash is perfect. Keep it.</div>
      </div>
      <div style={{ position: "absolute", left: 36, right: 36, bottom: 70, display: "flex", gap: 18 }}>
        {ok ? (
          <div style={{ flex: 1, height: 130, borderRadius: 34, display: "grid", placeItems: "center", fontSize: 44, fontWeight: 800, color: "white", background: "var(--h-green)", boxShadow: "0 0 60px color-mix(in oklch, var(--h-green) 60%, transparent)" }}>✓  Approved</div>
        ) : (
          <>
            <div style={{ flex: 1, height: 130, borderRadius: 34, display: "grid", placeItems: "center", fontSize: 34, fontWeight: 800, border: "3px solid #dcd8ea", color: INK }}>Request changes</div>
            <div style={{ flex: 1, height: 130, borderRadius: 34, display: "grid", placeItems: "center", fontSize: 40, fontWeight: 800, color: "white", background: "var(--h-indigo)", transform: `scale(${t > tap - 120 ? 0.95 : 1})` }}>Approve</div>
          </>
        )}
      </div>
      <Tap t={t} at={tap} x={410} y={1060} />
    </div>
  );
}

function PhonesSection({ t }: { t: number }) {
  // Crew phone drops in from above, seen from high, then whips off.
  const drop = easeOut(ramp(t, 0, 1100));
  const crewOut = easeIn(ramp(t, CLIENT_PHONE - 450, 500));
  const crewT = t;
  const clientT = t - CLIENT_PHONE;
  const clientIn = easeOut(ramp(clientT, -100, 700));
  const clientOut = easeInOut(ramp(clientT, 3300, 700));
  const titleA = t < CLIENT_PHONE - 300;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 62%, color-mix(in oklch, var(--h-${titleA ? "amber" : "pink"}) 28%, transparent), transparent 55%)`, opacity: 1 - clientOut }} />
      {/* Titles */}
      <div className="font-display" style={{ position: "absolute", left: 70, right: 70, top: 230, fontSize: 92, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.0, color: "white", opacity: 1 - clientOut }}>
        {titleA ? (
          <div style={{ opacity: 1 - ramp(t, CLIENT_PHONE - 600, 250) }}>
            <Words text="Crew confirms" t={t} at={300} stagger={80} />
            <Words text="from their phone." t={t} at={520} stagger={80} style={{ color: "var(--h-amber)" }} />
          </div>
        ) : (
          <div>
            <Words text="Clients approve" t={clientT} at={0} stagger={80} />
            <Words text="from theirs." t={clientT} at={200} stagger={80} style={{ color: "var(--h-pink)" }} />
            <div style={{ marginTop: 20, fontSize: 44, fontWeight: 600, letterSpacing: 0, color: "rgba(255,255,255,.7)" }}>
              <Words text="No app. No login." t={clientT} at={700} stagger={80} dur={420} />
            </div>
          </div>
        )}
      </div>
      {t < CLIENT_PHONE + 100 ? (
        <MB id="crewphone" x={crewOut * 70} y={(1 - drop) * 30} style={{ position: "absolute", left: 540, top: 1200, perspective: 1500 }}>
          <div style={{ transform: `translate(-50%, -50%) translateY(${(1 - drop) * -1500}px) translateX(${crewOut * -1300}px) rotateX(${lerp(72, 14, drop)}deg) rotateY(${-14 + Math.sin(t / 900) * 4 - crewOut * 40}deg) rotateZ(${lerp(-12, -2, drop)}deg) scale(0.86)` }}>
            <Phone light={false}>
              <CrewScreen t={crewT} tap={2100} />
            </Phone>
          </div>
        </MB>
      ) : null}
      {clientT > -150 ? (
        <MB id="clientphone" x={(1 - clientIn) * 60} style={{ position: "absolute", left: 540, top: 1200, perspective: 1500 }}>
          <div style={{ transform: `translate(-50%, -50%) translateX(${(1 - clientIn) * 1300}px) translateY(${clientOut * 300}px) rotateX(${10 + clientOut * 40}deg) rotateY(${lerp(50, 12, clientIn) + Math.sin(t / 900) * 4}deg) rotateZ(2deg) scale(${0.86 * (1 - clientOut * 0.35)})`, opacity: 1 - clientOut }}>
            <Phone>
              <ClientScreen t={clientT} tap={1900} />
            </Phone>
          </div>
        </MB>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- OUTRO */

function OutroSection({ t }: { t: number }) {
  const lineOut = easeIn(ramp(t, 2300, 400));
  const grow = easeIn(ramp(t, 2350, 900));
  const rimSize = 60 * Math.pow(70, grow);
  const lock = t >= 3150;
  const fade = ramp(t, 6700, 700);
  const push = lerp(1, 1.08, ramp(t, 0, 2400));
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - fade }}>
      <div className="font-display" style={{ position: "absolute", left: 40, right: 40, top: 740, textAlign: "center", color: "white", fontSize: 150, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 0.98, opacity: 1 - lineOut, filter: lineOut > 0 ? `blur(${lineOut * 18}px)` : undefined, transform: `scale(${push * (1 + lineOut * 0.4)})` }}>
        <Words text="Stop chasing." t={t} at={150} stagger={130} style={{ display: "block" }} />
        <Words text="Start shooting." t={t} at={850} stagger={130} style={{ display: "block", color: GLOW }} />
      </div>
      {t > 2350 && t < 3350 ? (
        <div
          style={{
            position: "absolute",
            left: 540,
            top: 960,
            width: rimSize,
            height: rimSize,
            borderRadius: rimSize * 0.28,
            transform: `translate(-50%, -50%) rotate(${(1 - grow) * 45}deg)`,
            border: `${Math.max(8, rimSize * 0.07)}px solid transparent`,
            background: "linear-gradient(#030207, #030207) padding-box, conic-gradient(from 210deg, var(--h-indigo), var(--h-purple), var(--h-pink), var(--h-amber), var(--h-indigo)) border-box",
            boxShadow: "0 0 120px color-mix(in oklch, var(--h-purple) 60%, transparent)",
            opacity: 1 - ramp(t, 3150, 200),
          }}
        />
      ) : null}
      {lock ? (
        <>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 44%, color-mix(in oklch, var(--h-indigo) 36%, transparent), transparent 58%)`, opacity: ramp(t, 3150, 500) }} />
          <div style={{ position: "absolute", left: 540, top: 740, transform: "translate(-50%, -50%)" }}>
            <MarkTile size={210} t={t - 3150} at={0} />
          </div>
          <div className="font-display" style={{ position: "absolute", left: 0, right: 0, top: 880, textAlign: "center", fontSize: 140, fontWeight: 800, letterSpacing: "-0.05em", color: "white" }}>
            <Words text="Studio Flows" t={t - 3150} at={250} stagger={110} style={{ display: "inline-block" }} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 1070, textAlign: "center", fontSize: 54, fontWeight: 700, color: GLOW }}>
            <Words text="Every job, in one place." t={t - 3150} at={650} stagger={70} style={{ display: "inline-block" }} />
          </div>
          <div style={{ position: "absolute", left: "50%", top: 1210, transform: `translateX(-50%) scale(${spring(ramp(t - 3150, 1100, 520))})`, padding: "30px 64px", borderRadius: 999, background: "white", color: "var(--h-indigo)", fontSize: 50, fontWeight: 800, whiteSpace: "nowrap", boxShadow: "0 30px 70px -20px rgba(0,0,0,.7), 0 0 80px color-mix(in oklch, var(--h-indigo) 50%, transparent)" }}>
            studio-flows.com
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- STAGE */

export function ChaseVideo({ t }: { t: number }) {
  const portal = t >= PORTAL ? Portal({ t: t - PORTAL }) : null;
  const inProduct = t >= PORTAL && t < PRODUCT_END + 200;
  return (
    <div data-theme="light" data-accent="indigo" className="font-body" style={{ position: "relative", width: W, height: H, overflow: "hidden", background: BLACK, color: "var(--text)" }}>
      {t < CHAOS_END ? <ChaosSection t={t} /> : null}
      {t < M(3200) ? <HookText t={t} /> : null}
      {t >= REVEAL && t < PORTAL + 1000 ? <RevealSection t={t - REVEAL} /> : null}

      {inProduct && portal ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: portal.done ? undefined : `inset(${portal.cy - portal.half}px ${W - portal.cx - portal.half}px ${H - portal.cy - portal.half}px ${portal.cx - portal.half}px round ${portal.r}px)`,
          }}
        >
          <ProductSection u={t - PORTAL} />
        </div>
      ) : null}
      {/* The rim of the portal and the mark's bars flying past */}
      {portal && !portal.done ? (
        <div
          style={{
            position: "absolute",
            left: portal.cx - portal.half,
            top: portal.cy - portal.half,
            width: portal.size,
            height: portal.size,
            borderRadius: portal.r,
            border: `${portal.rim}px solid transparent`,
            background: "conic-gradient(from 200deg, var(--h-indigo), var(--h-purple), var(--h-pink), var(--h-indigo)) border-box",
            WebkitMask: "linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0)",
            mask: "linear-gradient(#000 0 0) padding-box exclude, linear-gradient(#000 0 0)",
            boxShadow: "0 0 80px color-mix(in oklch, var(--h-indigo) 70%, transparent)",
          }}
        />
      ) : null}
      {/* White bloom out of the budget, into the ring */}
      {t > PRODUCT_END - 500 && t < CONNECT + 200 ? <div style={{ position: "absolute", inset: 0, background: "white", opacity: easeIn(ramp(t, PRODUCT_END - 500, 520)) }} /> : null}
      {t >= CONNECT && t < PHONES + 100 ? <ConnectSection t={t - CONNECT} /> : null}
      {t >= PHONES && t < OUTRO ? <PhonesSection t={t - PHONES} /> : null}
      {t >= OUTRO ? <OutroSection t={t - OUTRO} /> : null}
      <Grain t={t} />
    </div>
  );
}
