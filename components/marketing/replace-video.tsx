"use client";

import type { CSSProperties, ReactNode } from "react";
import { Burst, clamp01, easeInOut, easeOut, lerp, ramp, spring } from "./scene-kit";
import { GLOW, H, MarkTile, W, Words } from "./brand-video";
import { BudgetScene, CallSheetScene, ReviewScene } from "./scenes-hero";
import { ScheduleScene } from "./scenes-panels";
import { ChatGlyph, GmailGlyph, SlackGlyph } from "@/components/communication/comms-ui";

/*
 * "WE'RE REPLACING THE REPLY-ALL YOU HATE": a third Reel, 1080x1920, built on
 * the structure of a reference the operator liked (an AI-coworker launch that
 * flies a camera through a 3D-tilted chat app). Same contract as the launch
 * and journey films: one pure function of t, rendered frame by frame.
 *
 * The story, in six movements:
 *  1. HOOK    small type on black, the line the whole film answers.
 *  2. CHAOS   a production group chat, tilted in 3D, the camera pushing in
 *             as the questions pile up and the unread count climbs.
 *  3. REVEAL  the mark spins out of depth: your first production hub, your
 *             last spreadsheet.
 *  4. ANSWERS each question from the chat comes back and is answered by the
 *             REAL product scene (review, call sheet, schedule, budget), with
 *             the answer popping off the card toward camera.
 *  5. CONNECT the tools it plugs into, orbiting. Only ones that exist today:
 *             no counts, no "featured by", no security claim (parked on 2FA).
 *  6. HOME    a crew member confirms from their phone, then the producer's
 *             own phone: wrapped early, home in 20. "We're replacing your
 *             Sunday nights." It ends on black, so it loops into the hook.
 *
 * Silent on purpose, like the other two: music is added in Instagram.
 * Everything that must be read sits between y=200 and y=1560.
 */

const HOOK = 0;
const CHAOS = 2300;
const REVEAL = 9600;
const ANSWERS = 13300;
const ANSWER = 4300;
const CONNECT = ANSWERS + ANSWER * 4; // 30500
const CREWPHONE = CONNECT + 4600; // 35100
const HOME = CREWPHONE + 4800; // 39900
const OUTRO = HOME + 5000; // 44900
export const REPLACE_MS = OUTRO + 5600; // 50500

const BLACK = "#030207";
const easeIn = (p: number) => p * p * p;

/* ------------------------------------------------------------ MOTION BLUR */

/**
 * Directional blur for whips, from an SVG filter (CSS blur is round, and a
 * camera whip smears along the move). Rendered as a sibling so the filter is
 * defined before the element that uses it.
 */
function MB({ id, x, y = 0, style, children }: { id: string; x: number; y?: number; style?: CSSProperties; children: ReactNode }) {
  const on = x > 0.4 || y > 0.4;
  return (
    <>
      {on ? (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
          <filter id={id} x="-60%" y="-20%" width="220%" height="140%">
            <feGaussianBlur stdDeviation={`${x.toFixed(1)} ${y.toFixed(1)}`} />
          </filter>
        </svg>
      ) : null}
      <div style={{ ...style, filter: on ? `url(#${id})` : undefined }}>{children}</div>
    </>
  );
}

/* ------------------------------------------------------------------- HOOK */

function HookSection({ t }: { t: number }) {
  const out = ramp(t, 1900, 400);
  return (
    <div
      className="font-display"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 830,
        textAlign: "center",
        color: "white",
        fontSize: 76,
        fontWeight: 800,
        letterSpacing: "-0.03em",
        lineHeight: 1.08,
        opacity: 1 - out,
        transform: `scale(${1 - out * 0.12})`,
        filter: out > 0 ? `blur(${out * 10}px)` : undefined,
      }}
    >
      <Words text="We're replacing" t={t} at={150} stagger={90} style={{ display: "block" }} />
      <Words text="the reply-all you hate." t={t} at={520} stagger={90} accent={{ words: [1], color: GLOW }} style={{ display: "block" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ CHAOS */

const CHAT = {
  bg: "#16141e",
  side: "#221a38",
  line: "rgba(255,255,255,.08)",
  text: "#efecf7",
  muted: "#9a95ad",
};

type Msg = { who: string; role: string; hue: string; text: string; at: number; time: string };

const MSGS: Msg[] = [
  { who: "Jon", role: "Agency", hue: "cyan", text: "which cut did the client sign off on?? v3 or v3_FINAL", at: 900, time: "9:41 PM" },
  { who: "Leo", role: "Gaffer", hue: "amber", text: "is my call 6:45 or 7 tomorrow?", at: 1900, time: "9:52 PM" },
  { who: "Sam", role: "1st AD", hue: "green", text: "sofa scene is running long. do we still make lunch?", at: 2900, time: "10:07 PM" },
  { who: "Morgan", role: "Exec producer", hue: "indigo", text: "so... did we actually make money on this one?", at: 3900, time: "11:18 PM" },
];
const ROW0 = 210;
const ROWH = 210;
const CHANNELS = ["general", "hint-shoot", "crew", "post", "accounts", "random"];

function Dot({ hue, size }: { hue: string; size: number }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: 999, background: `var(--h-${hue})` }} />;
}

function ChatAvatar({ name, hue, size }: { name: string; hue: string; size: number }) {
  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size * 0.26,
        background: `linear-gradient(150deg, color-mix(in oklch, var(--h-${hue}) 80%, white), var(--h-${hue}))`,
        color: "white",
        fontWeight: 800,
        fontSize: size * 0.42,
      }}
    >
      {name[0]}
    </span>
  );
}

/** One message row, as the chat draws it (also reused in the answers). */
function ChatRow({ m, scale = 1, style }: { m: Msg; scale?: number; style?: CSSProperties }) {
  const s = scale;
  return (
    <div style={{ display: "flex", gap: 22 * s, alignItems: "flex-start", ...style }}>
      <ChatAvatar name={m.who} hue={m.hue} size={72 * s} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 * s, whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 34 * s, fontWeight: 800, color: CHAT.text }}>{m.who}</span>
          <span style={{ fontSize: 22 * s, fontWeight: 700, color: `var(--h-${m.hue})`, padding: `${3 * s}px ${10 * s}px`, borderRadius: 8 * s, background: `color-mix(in oklch, var(--h-${m.hue}) 20%, transparent)` }}>{m.role}</span>
          <span style={{ fontSize: 22 * s, color: CHAT.muted }}>{m.time}</span>
        </div>
        <div style={{ marginTop: 6 * s, fontSize: 36 * s, lineHeight: 1.3, color: CHAT.text }}>
          <span style={{ color: "var(--h-blue)", fontWeight: 700 }}>@here </span>
          {m.text}
        </div>
      </div>
    </div>
  );
}

function ChatPanel({ t }: { t: number }) {
  const unread = Math.round(lerp(3, 47, easeOut(ramp(t, 1000, 4600))));
  const typing = t > 4600;
  return (
    <div style={{ position: "relative", width: 1000, height: 1400, borderRadius: 40, overflow: "hidden", background: CHAT.bg, boxShadow: "0 80px 160px -40px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.06)" }}>
      {/* Sidebar */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 250, background: CHAT.side, padding: "36px 24px", color: CHAT.muted, fontSize: 26 }}>
        <div style={{ color: "white", fontWeight: 800, fontSize: 30, marginBottom: 34 }}>Bright Water</div>
        {CHANNELS.map((c, i) => {
          const active = c === "hint-shoot";
          const badge = i === 2 ? (t > 2400 ? 12 : 0) : i === 4 ? (t > 4100 ? 4 : 0) : i === 3 ? (t > 3300 ? 7 : 0) : 0;
          return (
            <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", marginBottom: 6, borderRadius: 12, background: active ? "color-mix(in oklch, var(--h-indigo) 55%, transparent)" : undefined, color: active || badge ? "white" : CHAT.muted, fontWeight: active || badge ? 800 : 500 }}>
              <span># {c}</span>
              {badge ? (
                <span style={{ fontSize: 20, fontWeight: 800, color: "white", background: "var(--h-red)", borderRadius: 999, padding: "2px 10px", transform: `scale(${spring(ramp(t, i === 2 ? 2400 : i === 4 ? 4100 : 3300, 360))})` }}>{badge}</span>
              ) : null}
            </div>
          );
        })}
        <div style={{ marginTop: 34, fontSize: 22, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Direct messages</div>
        {["Jon", "Leo", "Sam", "Morgan"].map((n, i) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", color: t > 1200 + i * 900 ? "white" : CHAT.muted, fontWeight: t > 1200 + i * 900 ? 800 : 500 }}>
            <Dot hue={MSGS[i].hue} size={14} /> {n}
          </div>
        ))}
      </div>
      {/* Header */}
      <div style={{ position: "absolute", left: 250, right: 0, top: 0, height: 110, borderBottom: `1px solid ${CHAT.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 36px" }}>
        <span style={{ fontSize: 34, fontWeight: 800, color: CHAT.text }}># hint-shoot</span>
        <span style={{ fontSize: 24, fontWeight: 800, color: "white", background: "var(--h-red)", borderRadius: 999, padding: "6px 18px" }}>{unread} unread</span>
      </div>
      {/* Messages */}
      {MSGS.map((m, i) => {
        if (t < m.at) return null;
        const p = spring(ramp(t, m.at, 460));
        return <ChatRow key={i} m={m} style={{ position: "absolute", left: 290, right: 40, top: ROW0 + i * ROWH, opacity: clamp01(p * 1.5), transform: `translateY(${(1 - p) * 40}px)` }} />;
      })}
      {/* Composer */}
      <div style={{ position: "absolute", left: 290, right: 40, bottom: 40, height: 150, borderRadius: 24, border: `2px solid ${CHAT.line}`, padding: "24px 28px", color: CHAT.muted, fontSize: 32 }}>
        {typing ? (
          <span style={{ color: CHAT.text }}>
            {"one sec, let me find it".slice(0, Math.max(0, Math.floor((t - 4600) / 55)))}
            <span style={{ opacity: Math.floor(t / 260) % 2 ? 1 : 0.2 }}>|</span>
          </span>
        ) : (
          "Message # hint-shoot"
        )}
        <div style={{ position: "absolute", left: 28, bottom: 18, display: "flex", gap: 24, fontWeight: 900, fontSize: 26, color: CHAT.muted }}>
          <span>B</span>
          <span style={{ fontStyle: "italic" }}>I</span>
          <span style={{ textDecoration: "underline" }}>U</span>
          <span>+</span>
        </div>
      </div>
    </div>
  );
}

function ChaosSection({ t }: { t: number }) {
  // Fly in from depth, then push in, following the newest message.
  const fly = easeOut(ramp(t, 0, 1100));
  const push = easeInOut(ramp(t, 900, 4600));
  const whip = easeIn(ramp(t, 6700, 600));
  const latest = Math.max(0, MSGS.filter((m) => t >= m.at - 300).length - 1);
  const fy = lerp(700, ROW0 + 60 + lerp(0, latest * ROWH, 1), push);
  const fx = lerp(500, 610, push);
  const s = lerp(0.42, 0.74, fly) * lerp(1, 1.75, push) * (1 + whip * 0.25);
  const ry = lerp(42, 20, fly) * (1 - push * 0.6) + whip * -70;
  const rx = lerp(28, 12, fly) * (1 - push * 0.5);
  const rz = lerp(-8, -3, fly) * (1 - push);
  const tx = whip * -1500;
  // A shake as the unread count climbs past what anyone can answer.
  const shake = ramp(t, 4400, 600) * (1 - whip);
  const jx = Math.sin(t * 0.08) * 6 * shake;
  const jy = Math.cos(t * 0.1) * 4 * shake;
  return (
    <MB id="chaos-mb" x={whip * 60} style={{ position: "absolute", inset: 0, perspective: 1600, opacity: 1 - ramp(t, 7100, 200) }}>
      <div
        style={{
          position: "absolute",
          left: 540 - fx,
          top: 960 - fy,
          transformOrigin: `${fx}px ${fy}px`,
          transform: `translate(${tx + jx}px, ${jy}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`,
        }}
      >
        <ChatPanel t={t} />
      </div>
    </MB>
  );
}

/* ----------------------------------------------------------------- REVEAL */

function RevealSection({ t }: { t: number }) {
  const spin = easeOut(ramp(t, 0, 900));
  const settle = easeInOut(ramp(t, 1300, 600));
  const out = easeIn(ramp(t, 3350, 350));
  const pulse = 0.5 + 0.5 * Math.sin(t / 400);
  return (
    <MB id="reveal-mb" x={out * 70} style={{ position: "absolute", inset: 0, transform: `translateX(${out * -900}px)` }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 46%, color-mix(in oklch, var(--h-indigo) ${30 + pulse * 10}%, transparent), transparent 55%)`, opacity: ramp(t, 200, 700) }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: lerp(700, 690, settle), textAlign: "center", fontSize: 44, fontWeight: 600, color: "rgba(255,255,255,.72)" }}>
        <Words text="Your first production hub" t={t} at={900} stagger={60} style={{ display: "inline-block" }} />
      </div>
      <div style={{ position: "absolute", left: 540, top: 880, transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", gap: lerp(0, 34, settle), perspective: 1200 }}>
        <div style={{ transform: `rotateY(${(1 - spin) * 540}deg) rotateX(${(1 - spin) * 40}deg) scale(${lerp(2.2, 1, spin)})`, filter: spin < 1 ? `blur(${(1 - spin) * 14}px)` : undefined }}>
          <MarkTile size={lerp(220, 130, settle)} t={t} at={0} />
        </div>
        <div className="font-display" style={{ width: lerp(0, 720, settle), overflow: "hidden", whiteSpace: "nowrap", fontSize: 112, fontWeight: 800, letterSpacing: "-0.04em", color: "white" }}>
          Studio Flows
        </div>
      </div>
      <div className="font-display" style={{ position: "absolute", left: 0, right: 0, top: 1010, textAlign: "center", fontSize: 92, fontWeight: 800, letterSpacing: "-0.035em", color: GLOW }}>
        <Words text="Your last spreadsheet." t={t} at={1900} stagger={110} style={{ display: "inline-block" }} />
      </div>
    </MB>
  );
}

/* ---------------------------------------------------------------- ANSWERS */

type Answer = {
  q: Msg;
  hue: string;
  scene: (t: number) => ReactNode;
  from: number;
  speed: number;
  /** Local time the scene lands its payoff, and the sticker that pops off. */
  pay: number;
  sticker: string;
  line: string;
};

const ANSWER_LIST: Answer[] = [
  { q: MSGS[0], hue: "pink", scene: (t) => <ReviewScene t={t} />, from: 3000, speed: 1.4, pay: 3000, sticker: "v3 · Approved by Maya", line: "Signed off on the frame." },
  { q: MSGS[1], hue: "amber", scene: (t) => <CallSheetScene t={t} />, from: 3300, speed: 1.5, pay: 2850, sticker: "Leo · call 6:45 AM ✓", line: "Everyone knows their call." },
  { q: MSGS[2], hue: "green", scene: (t) => <ScheduleScene t={t} />, from: 900, speed: 1.6, pay: 3150, sticker: "Back on target · wrap 6 PM", line: "The day re-flows itself." },
  { q: MSGS[3], hue: "indigo", scene: (t) => <BudgetScene t={t} />, from: 3000, speed: 1.35, pay: 3250, sticker: "31% margin", line: "Bid, actual, margin. Live." },
];

function AnswerSection({ a, i, t }: { a: Answer; i: number; t: number }) {
  const ask = spring(ramp(t, 0, 520));
  const swing = easeOut(ramp(t, 260, 760));
  const exit = easeIn(ramp(t, ANSWER - 420, 420));
  const sceneT = a.from + Math.max(0, t - 400) * a.speed;
  const pop = spring(ramp(t, a.pay, 520));
  const push = easeInOut(ramp(t, 800, ANSWER - 1300));
  const enterBlur = (1 - swing) * 50;
  return (
    <MB id={`ans-mb-${i}`} x={exit * 70 + (i === 0 ? 0 : enterBlur * (1 - ramp(t, 0, 500)))} style={{ position: "absolute", inset: 0, transform: `translateX(${-exit * 1300}px)` }}>
      {/* Hue bloom */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 75% 60%, color-mix(in oklch, var(--h-${a.hue}) 30%, transparent), transparent 55%)` }} />
      {/* Counter */}
      <div style={{ position: "absolute", left: 70, top: 230, display: "flex", gap: 10 }}>
        {ANSWER_LIST.map((x, k) => (
          <span key={k} style={{ width: 80, height: 8, borderRadius: 99, background: k < i ? `var(--h-${x.hue})` : "rgba(255,255,255,.14)", overflow: "hidden" }}>
            {k === i ? <span style={{ display: "block", height: "100%", width: `${clamp01(t / ANSWER) * 100}%`, background: `var(--h-${x.hue})` }} /> : null}
          </span>
        ))}
      </div>
      {/* The question, back from the chat */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 290,
          padding: "30px 34px",
          borderRadius: 32,
          background: CHAT.bg,
          border: "1px solid rgba(255,255,255,.1)",
          boxShadow: "0 30px 80px -30px rgba(0,0,0,.8)",
          transform: `translateY(${(1 - ask) * -60}px) scale(${0.9 + ask * 0.1})`,
          opacity: clamp01(ask * 1.4),
        }}
      >
        <ChatRow m={a.q} scale={0.95} />
      </div>
      {/* The answer: the real product, swinging in from depth */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, height: 820, perspective: 1800 }}>
        <div
          style={{
            position: "absolute",
            left: 30,
            top: 0,
            width: 1020,
            height: 760,
            borderRadius: 52,
            overflow: "hidden",
            background: `linear-gradient(150deg, var(--h-${a.hue}-bg), var(--surface-2) 70%, var(--surface))`,
            boxShadow: `0 60px 140px -40px color-mix(in oklch, var(--h-${a.hue}) 70%, transparent)`,
            transformOrigin: "100% 50%",
            transform: `translateX(${(1 - swing) * 700}px) rotateY(${(1 - swing) * -55}deg) rotateX(${(1 - swing) * 8}deg)`,
            opacity: clamp01(swing * 2),
          }}
        >
          <div style={{ position: "absolute", left: 510, top: 380, width: 640, height: 440, transform: `translate(-50%, -50%) scale(${lerp(1.52, 1.66, push)})` }}>{a.scene(sceneT)}</div>
        </div>
        {/* The answer pops off the card toward camera */}
        {t >= a.pay ? (
          <div
            style={{
              position: "absolute",
              right: 60,
              top: 640,
              transform: `scale(${pop}) rotate(${-5 + (1 - pop) * -20}deg)`,
              transformOrigin: "80% 50%",
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "26px 40px 26px 26px",
              borderRadius: 999,
              background: `var(--h-${a.hue})`,
              color: "white",
              fontSize: 46,
              fontWeight: 800,
              whiteSpace: "nowrap",
              boxShadow: `0 30px 70px -20px color-mix(in oklch, var(--h-${a.hue}) 90%, black)`,
            }}
          >
            <span style={{ display: "grid", placeItems: "center", width: 66, height: 66, borderRadius: 999, background: "rgba(255,255,255,.25)", fontSize: 38 }}>✓</span>
            {a.sticker}
            <div style={{ position: "absolute", right: 120, top: 40 }}>
              <Burst t={t} at={a.pay} spread={2.6} />
            </div>
          </div>
        ) : null}
      </div>
      {/* The line */}
      <div className="font-display" style={{ position: "absolute", left: 70, right: 70, top: 1480, fontSize: 70, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, color: "white" }}>
        <Words text={a.line} t={t} at={a.pay + 250} stagger={80} />
      </div>
    </MB>
  );
}

/* ---------------------------------------------------------------- CONNECT */

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

/** The connections that exist today. Names only where we have no mark to draw. */
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
  const bg = ramp(t, 0, 380);
  const out = easeIn(ramp(t, 4250, 350));
  return (
    <div style={{ position: "absolute", inset: 0, background: "#f8f7fc", clipPath: `circle(${easeOut(bg) * 130}% at 50% 50%)`, opacity: 1 - out }}>
      {TOOLS.map((tool, i) => {
        const appear = easeOut(ramp(t, 200 + i * 90, 700));
        const a = (i / TOOLS.length) * Math.PI * 2 + t / 2600 + (1 - appear) * 1.6;
        const depth = (Math.sin(a) + 1) / 2; // 0 = far (top), 1 = near (bottom)
        const x = 540 + Math.cos(a) * 500 * appear;
        const y = 900 + Math.sin(a) * 600 * appear;
        const sc = lerp(0.62, 1.18, depth) * appear;
        const blur = (1 - depth) * 3 + (1 - appear) * 18;
        return (
          <div
            key={tool.name}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${sc})`,
              zIndex: Math.round(depth * 10),
              filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: tool.mark ? "22px 30px 22px 22px" : "26px 36px",
              borderRadius: 30,
              background: "white",
              boxShadow: "0 24px 60px -24px rgba(30,20,80,.35), 0 0 0 1px rgba(30,20,80,.06)",
              whiteSpace: "nowrap",
              opacity: clamp01(appear * 1.6),
            }}
          >
            {tool.mark ? tool.mark(64) : null}
            <span style={{ fontSize: 38, fontWeight: 800, color: "#1d1b2e" }}>{tool.name}</span>
          </div>
        );
      })}
      <div className="font-display" style={{ position: "absolute", left: 0, right: 0, top: 810, zIndex: 20, textAlign: "center", fontSize: 84, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.04, color: "#17142b", textShadow: "0 0 30px #f8f7fc, 0 0 60px #f8f7fc" }}>
        <Words text="Plugs into the tools" t={t} at={600} stagger={80} style={{ display: "block" }} />
        <Words text="you already use." t={t} at={900} stagger={80} accent={{ words: [2], color: "var(--h-indigo)" }} style={{ display: "block" }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ PHONES */

function Phone({ children, light = true, w = 560, h = 1140 }: { children: ReactNode; light?: boolean; w?: number; h?: number }) {
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: 90, padding: 16, background: light ? "linear-gradient(150deg, #f4f3f7, #c9c6d2)" : "linear-gradient(150deg, #3a3842, #121117)", boxShadow: "0 80px 140px -40px rgba(0,0,0,.9), inset 0 0 0 2px rgba(255,255,255,.25)" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 76, overflow: "hidden", background: light ? "#ffffff" : "#0d0c12" }}>
        <div style={{ position: "absolute", left: "50%", top: 22, width: 170, height: 50, borderRadius: 99, background: "#000", transform: "translateX(-50%)", zIndex: 5 }} />
        {children}
      </div>
    </div>
  );
}

function CrewPhoneSection({ t }: { t: number }) {
  const inP = easeOut(ramp(t, 0, 900));
  const tap = 2500;
  const confirmed = t >= tap;
  const press = t > tap - 150 && t < tap + 120 ? 0.94 : 1;
  const out = easeIn(ramp(t, 4400, 400));
  const ry = lerp(-40, -14, inP) + Math.sin(t / 900) * 3 + out * 50;
  const rx = lerp(20, 8, inP);
  return (
    <MB id="crew-mb" x={out * 60} style={{ position: "absolute", inset: 0, transform: `translateX(${out * 1200}px)` }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 60%, color-mix(in oklch, var(--h-amber) 26%, transparent), transparent 55%)" }} />
      <div className="font-display" style={{ position: "absolute", left: 70, right: 70, top: 250, fontSize: 84, fontWeight: 800, lineHeight: 1.0, letterSpacing: "-0.035em", color: "white" }}>
        <Words text="Crew confirms" t={t} at={200} stagger={90} />
        <Words text="from their phone." t={t} at={420} stagger={90} style={{ color: "var(--h-amber)" }} />
        <div style={{ marginTop: 18, fontSize: 40, fontWeight: 600, letterSpacing: 0, color: "rgba(255,255,255,.66)" }}>
          <Words text="No app. No login." t={t} at={800} stagger={70} dur={420} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 540, top: 1120, perspective: 1600 }}>
        <div style={{ transform: `translate(-50%, -50%) translateY(${(1 - inP) * 500}px) rotateY(${ry}deg) rotateX(${rx}deg) scale(0.84)` }}>
          <Phone light={false}>
            <div style={{ position: "absolute", inset: 0, padding: "110px 34px 40px", color: "white" }}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--h-amber)" }}>Call sheet · Day 1</div>
              <div className="font-display" style={{ marginTop: 10, fontSize: 52, fontWeight: 800, letterSpacing: "-0.03em" }}>Bright Water</div>
              <div style={{ fontSize: 28, color: "rgba(255,255,255,.6)" }}>Thu, Oct 6 · Stage 2, Culver City</div>
              <div style={{ marginTop: 34, padding: 28, borderRadius: 30, background: "linear-gradient(140deg, color-mix(in oklch, var(--h-amber) 45%, #1a1720), #1a1720)" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,.7)" }}>Your call, Leo</div>
                <div className="font-display" style={{ fontSize: 96, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05 }}>6:45 AM</div>
                <div style={{ fontSize: 26, color: "rgba(255,255,255,.7)" }}>Gaffer · Breakfast 6:30</div>
              </div>
              {[
                ["General call", "7:00 AM"],
                ["Lunch", "12:30 PM"],
                ["Wrap", "6:00 PM"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "18px 6px", borderBottom: "1px solid rgba(255,255,255,.1)", fontSize: 30 }}>
                  <span style={{ color: "rgba(255,255,255,.6)" }}>{k}</span>
                  <span style={{ fontWeight: 800 }}>{v}</span>
                </div>
              ))}
              <div
                style={{
                  position: "absolute",
                  left: 34,
                  right: 34,
                  bottom: 60,
                  height: 120,
                  borderRadius: 32,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 40,
                  fontWeight: 800,
                  background: confirmed ? "var(--h-green)" : "white",
                  color: confirmed ? "white" : "#141219",
                  transform: `scale(${press})`,
                }}
              >
                {confirmed ? "✓ Confirmed" : "Confirm I'll be there"}
                {confirmed ? (
                  <div style={{ position: "absolute", left: "50%", top: "50%" }}>
                    <Burst t={t} at={tap} spread={2.4} />
                  </div>
                ) : null}
              </div>
              {/* The thumb */}
              {t > tap - 900 && t < tap + 500 ? (
                <div style={{ position: "absolute", left: lerp(380, 250, easeOut(ramp(t, tap - 900, 700))), top: lerp(1100, 990, easeOut(ramp(t, tap - 900, 700))), width: 90, height: 90, borderRadius: 99, background: "rgba(255,255,255,.35)", border: "3px solid rgba(255,255,255,.8)", opacity: 1 - ramp(t, tap + 200, 300) }} />
              ) : null}
            </div>
          </Phone>
        </div>
      </div>
    </MB>
  );
}

function HomeSection({ t }: { t: number }) {
  const inP = easeOut(ramp(t, 0, 900));
  const out = easeInOut(ramp(t, 4400, 600));
  const ry = lerp(30, 10, inP) - out * 30;
  const rx = lerp(16, 6, inP);
  const bubbles: { me: boolean; text: string; at: number }[] = [
    { me: false, text: "you home for dinner tonight?", at: 500 },
    { me: true, text: "wrapped early 🎬", at: 1500 },
    { me: true, text: "home in 20.", at: 2100 },
    { me: false, text: "🍝 saving you a plate", at: 3100 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - out, transform: `scale(${1 - out * 0.15})` }}>
      <div style={{ position: "absolute", left: 540, top: 960, perspective: 1600 }}>
        <div style={{ transform: `translate(-50%, -50%) translateY(${(1 - inP) * 600}px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${-3 + out * 6}deg) scale(0.92)` }}>
          <Phone>
            <div style={{ position: "absolute", left: 0, right: 0, top: 96, textAlign: "center" }}>
              <div style={{ margin: "0 auto", width: 110, height: 110, borderRadius: 99, background: "linear-gradient(150deg, #f5c6e8, #b8b5ff)" }} />
              <div style={{ marginTop: 12, fontSize: 32, fontWeight: 700, color: "#1d1b2e" }}>Sam</div>
              <div style={{ fontSize: 22, color: "#8a8799" }}>Today 5:42 PM</div>
            </div>
            <div style={{ position: "absolute", left: 28, right: 28, top: 330, display: "flex", flexDirection: "column", gap: 16 }}>
              {bubbles.map((b, i) => {
                if (t < b.at) return null;
                const p = spring(ramp(t, b.at, 420));
                return (
                  <div
                    key={i}
                    style={{
                      alignSelf: b.me ? "flex-end" : "flex-start",
                      maxWidth: "78%",
                      padding: "20px 28px",
                      borderRadius: 40,
                      fontSize: 34,
                      lineHeight: 1.25,
                      background: b.me ? "#0a84ff" : "#e9e8ee",
                      color: b.me ? "white" : "#1d1b2e",
                      transform: `scale(${p})`,
                      transformOrigin: b.me ? "100% 100%" : "0 100%",
                    }}
                  >
                    {b.text}
                  </div>
                );
              })}
              {t > 2600 && t < 3100 ? (
                <div style={{ alignSelf: "flex-start", padding: "22px 30px", borderRadius: 40, background: "#e9e8ee", display: "flex", gap: 10 }}>
                  {[0, 1, 2].map((k) => (
                    <span key={k} style={{ width: 14, height: 14, borderRadius: 99, background: "#8a8799", opacity: 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 120 - k)) }} />
                  ))}
                </div>
              ) : null}
            </div>
          </Phone>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ OUTRO */

function OutroSection({ t }: { t: number }) {
  const lineOut = ramp(t, 2300, 300);
  // The mark swells to fill the frame, then settles into the lockup.
  const swell = easeInOut(ramp(t, 2300, 700));
  const settle = easeInOut(ramp(t, 3000, 700));
  const size = t < 3000 ? lerp(40, 1500, swell) : lerp(1500, 150, settle);
  const fade = ramp(t, 5100, 500);
  const lock = settle;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - fade }}>
      <div
        className="font-display"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 830,
          textAlign: "center",
          color: "white",
          fontSize: 76,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.08,
          opacity: 1 - lineOut,
          filter: lineOut > 0 ? `blur(${lineOut * 10}px)` : undefined,
        }}
      >
        <Words text="We're replacing" t={t} at={200} stagger={90} style={{ display: "block" }} />
        <Words text="your Sunday nights." t={t} at={600} stagger={90} accent={{ words: [1, 2], color: GLOW }} style={{ display: "block" }} />
      </div>
      {t >= 2300 ? (
        <div style={{ position: "absolute", left: 540, top: 900, transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", gap: lerp(0, 36, lock) }}>
          <div style={{ transform: `rotate(${(1 - settle) * 45 * swell}deg)` }}>
            <MarkTile size={size} t={10000} at={0} />
          </div>
          <div className="font-display" style={{ width: lerp(0, 560, lock), overflow: "hidden", whiteSpace: "nowrap", fontSize: 92, fontWeight: 800, letterSpacing: "-0.04em", color: "white" }}>
            Studio Flows
          </div>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: "50%", top: 1070, transform: `translateX(-50%) scale(${spring(ramp(t, 3600, 520))})`, padding: "26px 54px", borderRadius: 999, background: "white", color: "var(--h-indigo)", fontSize: 44, fontWeight: 800, whiteSpace: "nowrap", boxShadow: "0 24px 60px -20px rgba(0,0,0,.6)" }}>
        studio-flows.com
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1200, textAlign: "center", fontSize: 36, fontWeight: 600, color: "rgba(255,255,255,.6)" }}>
        <Words text="Every job, in one place." t={t} at={4000} stagger={60} dur={420} style={{ display: "inline-block" }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ STAGE */

export function ReplaceVideo({ t }: { t: number }) {
  const ai = Math.min(ANSWER_LIST.length - 1, Math.max(0, Math.floor((t - ANSWERS) / ANSWER)));
  return (
    <div data-theme="light" data-accent="indigo" className="font-body" style={{ position: "relative", width: W, height: H, overflow: "hidden", background: BLACK, color: "var(--text)" }}>
      {t < CHAOS + 200 ? <HookSection t={t - HOOK} /> : null}
      {t >= CHAOS - 300 && t < REVEAL ? <ChaosSection t={t - CHAOS + 300} /> : null}
      {t >= REVEAL && t < ANSWERS ? <RevealSection t={t - REVEAL} /> : null}
      {t >= ANSWERS && t < CONNECT ? <AnswerSection key={ai} a={ANSWER_LIST[ai]} i={ai} t={t - ANSWERS - ai * ANSWER} /> : null}
      {t >= CONNECT && t < CREWPHONE ? <ConnectSection t={t - CONNECT} /> : null}
      {t >= CREWPHONE && t < HOME ? <CrewPhoneSection t={t - CREWPHONE} /> : null}
      {t >= HOME && t < OUTRO ? <HomeSection t={t - HOME} /> : null}
      {t >= OUTRO ? <OutroSection t={t - OUTRO} /> : null}
    </div>
  );
}
