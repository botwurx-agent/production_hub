"use client";

import type { ReactNode } from "react";
import { Chip, Window, clamp01, easeInOut, easeOut, lerp, ramp, spring } from "./scene-kit";
import { GLOW, H, MarkTile, W, Words } from "./brand-video";
import { PrevizHeroScene } from "./scenes-previz";
import { StoryboardReviewScene } from "./scenes-storyboard";
import { ShotShareScene } from "./scenes-shotlist";
import { CallSheetMealsScene, CallSheetSendScene } from "./scenes-callsheet";
import { ReviewVersionsScene, ReviewVideoScene } from "./scenes-review";
import { InvoiceSendScene } from "./scenes-invoicing";
import { GmailGlyph } from "@/components/communication/comms-ui";

/*
 * "FROM THE FIRST FRAME TO THE FINAL INVOICE": the A-to-Z film, 1080x1920,
 * about two minutes, cut for a voiceover. The operator's brief: the product
 * is all-in-one, but the reason it exists is that the conversation with the
 * client lives with the work, not in Gmail. So ONE client thread runs under
 * the whole film, and every chapter ends with a message landing in it: the
 * previz frame, the boards, the shot list, the call sheet, the cut, the final
 * files, the invoice. By the third time the viewer has the point.
 *
 * Paced to be read, not skimmed (operator, after the Stop chasing cut): each
 * chapter holds 10 to 15 seconds, the product scenes play at their natural
 * speed, and the on-screen line IS the voiceover script, so a recorded read
 * can be laid over this picture without re-timing it.
 *
 * Every chapter shows something the product does today. The invoice ends on
 * "Viewed", not "Paid": clients cannot pay inside the app yet.
 */

/* ------------------------------------------------------------- CHAPTERS */

type Chapter = {
  key: string;
  label: string;
  phase: string;
  hue: string;
  line: [string, string];
  dur: number;
  card: (t: number) => ReactNode;
};

const INTRO = 15500;

const CHAPTERS: Chapter[] = [
  { key: "scene", label: "Scene", phase: "Pre-production", hue: "indigo", line: ["Start by building the scene.", "Camera, lens and light, before anyone is on set."], dur: 10500, card: (t) => <PrevizHeroScene t={600 + t} /> },
  { key: "boards", label: "Boards", phase: "Pre-production", hue: "purple", line: ["Turn it into boards and send them to your client.", "Their notes land right on the frame."], dur: 10500, card: (t) => <StoryboardReviewScene t={3600 + t} /> },
  { key: "shots", label: "Shot list", phase: "Pre-production", hue: "blue", line: ["Share the shot list the same way.", "Same thread. Same place."], dur: 10500, card: (t) => <ShotShareScene t={400 + t} /> },
  { key: "call", label: "Call sheet", phase: "Shoot day", hue: "amber", line: ["Send the call sheet.", "See who opened it, and who confirmed."], dur: 11000, card: (t) => <CallSheetSendScene t={3000 + t} /> },
  { key: "lunch", label: "Lunch", phase: "Shoot day", hue: "orange", line: ["Even the lunch order", "goes out from here."], dur: 10500, card: (t) => <CallSheetMealsScene t={1500 + t} /> },
  {
    key: "review",
    label: "Review",
    phase: "Post",
    hue: "pink",
    line: ["After wrap, share the work.", "Notes on the exact frame, then the next version, approved."],
    dur: 15000,
    card: (t) => (t < 7000 ? <ReviewVideoScene t={t} /> : <ReviewVersionsScene t={1800 + (t - 7000)} />),
  },
  { key: "deliver", label: "Deliver", phase: "Delivery", hue: "green", line: ["Final files unlock", "the moment your client signs off."], dur: 10500, card: (t) => <DeliverScene t={t} /> },
  { key: "invoice", label: "Invoice", phase: "Billing", hue: "indigo", line: ["Then send the invoice from the same place,", "and see when it has been viewed."], dur: 12500, card: (t) => <InvoiceSendScene t={1800 + t} /> },
];

const STARTS = CHAPTERS.reduce<number[]>((a, c, i) => [...a, i === 0 ? INTRO : a[i - 1] + CHAPTERS[i - 1].dur], []);
const OUTRO = STARTS[STARTS.length - 1] + CHAPTERS[CHAPTERS.length - 1].dur;
const OUTRO_DUR = 14000;
export const FLOW_MS = OUTRO + OUTRO_DUR;

const INK = "#17142b";
const BG = "#f6f5fb";
const DARK = "#07060d";
const easeIn = (p: number) => p * p * p;

/* --------------------------------------------------------------- THREAD */

type Item =
  | { kind: "msg"; who: "you" | "maya"; text: string; att?: { icon: string; label: string; hue: string }; at: number }
  | { kind: "event"; text: string; hue: string; at: number };

const ch = (i: number, local: number) => STARTS[i] + local;

/** The one conversation the whole film is about, in the order it happens. */
const THREAD: Item[] = [
  { kind: "msg", who: "you", text: "Here's the hero setup from the scene builder.", att: { icon: "🎬", label: "1A Wide · previz", hue: "indigo" }, at: ch(0, 7800) },
  { kind: "msg", who: "you", text: "Storyboard is ready for your notes.", att: { icon: "▦", label: "Storyboard · review", hue: "purple" }, at: ch(1, 2100) },
  { kind: "msg", who: "maya", text: "Love frame 3. Keep this light.", at: ch(1, 3700) },
  { kind: "event", text: "Maya approved the storyboard", hue: "green", at: ch(1, 5900) },
  { kind: "msg", who: "you", text: "Shot list for Day 1.", att: { icon: "≣", label: "Shot list · PDF", hue: "blue" }, at: ch(2, 4400) },
  { kind: "msg", who: "maya", text: "Looks right to us 👍", at: ch(2, 8500) },
  { kind: "event", text: "Call sheet · Day 1 sent to 8 crew", hue: "amber", at: ch(3, 5100) },
  { kind: "event", text: "5 crew confirmed · 1 viewed", hue: "green", at: ch(3, 8600) },
  { kind: "event", text: "Lunch order sent · order by 10:00 AM", hue: "orange", at: ch(4, 3300) },
  { kind: "event", text: "Reminder sent to the people who haven't ordered", hue: "orange", at: ch(4, 7600) },
  { kind: "msg", who: "you", text: "The 30s cut, v2, is up for review.", att: { icon: "▶", label: "Coastline · 30s v2", hue: "pink" }, at: ch(5, 700) },
  { kind: "msg", who: "maya", text: "0:08 · Hold on the car a beat longer.", at: ch(5, 2500) },
  { kind: "msg", who: "maya", text: "0:14 to 0:21 · This whole stretch drags.", at: ch(5, 5400) },
  { kind: "msg", who: "you", text: "Hero still v4 is up.", att: { icon: "◩", label: "First light · v4", hue: "pink" }, at: ch(5, 7400) },
  { kind: "event", text: "Maya approved First light v4", hue: "green", at: ch(5, 13300) },
  { kind: "msg", who: "you", text: "Final files are ready to download.", att: { icon: "⬇", label: "Deliverables · 6 files", hue: "green" }, at: ch(6, 4600) },
  { kind: "msg", who: "maya", text: "Got them. Thank you! 🙌", at: ch(6, 7800) },
  { kind: "msg", who: "you", text: "Invoice INV-021 for the hero spot.", att: { icon: "$", label: "INV-021 · $24,800", hue: "indigo" }, at: ch(7, 4100) },
  { kind: "event", text: "Maya viewed INV-021", hue: "blue", at: ch(7, 10900) },
];

const ROW = 104;

function Avatar({ who, size = 56 }: { who: "you" | "maya"; size?: number }) {
  const you = who === "you";
  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 999,
        background: you ? "linear-gradient(150deg, color-mix(in oklch, var(--h-indigo) 70%, white), var(--h-indigo))" : "linear-gradient(150deg, color-mix(in oklch, var(--h-pink) 70%, white), var(--h-pink))",
        color: "white",
        fontWeight: 800,
        fontSize: size * 0.38,
      }}
    >
      {you ? "DR" : "MT"}
    </span>
  );
}

function AttChip({ a, scale = 1 }: { a: { icon: string; label: string; hue: string }; scale?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10 * scale,
        padding: `${6 * scale}px ${16 * scale}px ${6 * scale}px ${6 * scale}px`,
        borderRadius: 14 * scale,
        background: `var(--h-${a.hue}-bg)`,
        border: `1.5px solid color-mix(in oklch, var(--h-${a.hue}) 30%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ display: "grid", placeItems: "center", width: 34 * scale, height: 34 * scale, borderRadius: 9 * scale, background: `var(--h-${a.hue})`, color: "white", fontSize: 18 * scale, fontWeight: 800 }}>{a.icon}</span>
      <span style={{ fontSize: 23 * scale, fontWeight: 800, color: INK }}>{a.label}</span>
    </span>
  );
}

function ThreadRow({ it }: { it: Item }) {
  if (it.kind === "event") {
    return (
      <div style={{ height: ROW, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 22px", borderRadius: 99, background: `var(--h-${it.hue}-bg)`, fontSize: 25, fontWeight: 700, color: INK }}>
          <span style={{ width: 12, height: 12, borderRadius: 99, background: `var(--h-${it.hue})` }} />
          {it.text}
        </span>
      </div>
    );
  }
  const you = it.who === "you";
  return (
    <div style={{ height: ROW, display: "flex", alignItems: "center", gap: 18, padding: "0 30px" }}>
      <Avatar who={it.who} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: INK }}>{you ? "You" : "Maya Torres"}</span>
          <span style={{ fontSize: 21, color: "#8b879c" }}>{you ? "Studio" : "Bright Water · client"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ fontSize: 28, color: INK, overflow: "hidden", textOverflow: "ellipsis" }}>{it.text}</span>
        </div>
      </div>
      {it.att ? <AttChip a={it.att} scale={0.9} /> : null}
    </div>
  );
}

/** The conversation panel: newest at the bottom, history scrolling up. */
function ThreadPanel({ t, rows = 3, top, height, scrollBack = 0 }: { t: number; rows?: number; top: number; height: number; scrollBack?: number }) {
  const S = THREAD.reduce((s, it) => s + easeOut(ramp(t, it.at, 560)), 0);
  const area = rows * ROW;
  const arrivedCount = THREAD.filter((it) => t >= it.at).length;
  return (
    <div
      style={{
        position: "absolute",
        left: 50,
        right: 50,
        top,
        height,
        borderRadius: 38,
        background: "white",
        boxShadow: "0 40px 90px -40px rgba(30,20,80,.45), 0 0 0 1.5px rgba(30,20,80,.06)",
        overflow: "hidden",
      }}
    >
      <div style={{ height: 76, display: "flex", alignItems: "center", gap: 16, padding: "0 30px", borderBottom: "1.5px solid #ece9f4" }}>
        <GmailGlyph size={34} />
        <span style={{ fontSize: 28, fontWeight: 800, color: INK }}>Bright Water · Hero spot</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 700, color: "var(--h-indigo)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--h-green)" }} />
          in Studio Flows · {arrivedCount} messages
        </span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 76, bottom: 0, overflow: "hidden" }}>
        {THREAD.map((it, i) => {
          const y = area - ROW * (S - i) + scrollBack * ROW;
          if (t < it.at - 50 || y < -ROW || y > height) return null;
          const p = easeOut(ramp(t, it.at, 560));
          const fresh = 1 - ramp(t, it.at + 600, 1400);
          return (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: y, opacity: clamp01(p * 1.4), background: fresh > 0 ? `color-mix(in oklch, var(--h-indigo-bg) ${Math.round(fresh * 100)}%, transparent)` : undefined }}>
              <ThreadRow it={it} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A thumbnail of what is being sent, travelling from the work into the thread. */
function SendFlight({ t, cardTop, threadTop }: { t: number; cardTop: number; threadTop: number }) {
  const it = THREAD.find((x) => x.kind === "msg" && x.who === "you" && x.att && t > x.at - 750 && t < x.at + 100);
  if (!it || it.kind !== "msg" || !it.att) return null;
  const p = easeInOut(ramp(t, it.at - 750, 750));
  const x = lerp(540, 690, p);
  const y = lerp(cardTop + 340, threadTop + 76 + 3 * ROW - ROW / 2, p) - Math.sin(p * Math.PI) * 120;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${lerp(1.5, 0.9, p)}) rotate(${Math.sin(p * Math.PI) * -6}deg)`, opacity: 1 - ramp(t, it.at - 80, 160), filter: "drop-shadow(0 18px 30px rgba(30,20,80,.35))", zIndex: 30 }}>
      <AttChip a={it.att} />
    </div>
  );
}

/* --------------------------------------------------------------- DELIVER */

const FILES = [
  { n: "Hero :30 · 16x9", s: "ProRes 422 HQ · 2.1 GB", tag: "MOV" },
  { n: "Cutdown :15 · 16x9", s: "ProRes 422 HQ · 1.0 GB", tag: "MOV" },
  { n: "Social :15 · 9x16", s: "H.264 · 84 MB", tag: "MP4" },
  { n: "Feed :06 · 4x5", s: "H.264 · 31 MB", tag: "MP4" },
  { n: "Stills · 24 frames", s: "TIFF · 640 MB", tag: "ZIP" },
  { n: "Delivery report", s: "PDF · 2 MB", tag: "PDF" },
];
const D_APPROVE = 1500;

function Lock({ open, size = 18 }: { open: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M7 11V8a5 5 0 0 1 9.6-2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ transform: `translate(${open * 4}px, ${-open * 3}px) rotate(${open * 18}deg)`, transformOrigin: "16px 8px" }} />
      <rect x="4.5" y="11" width="15" height="10" rx="2.5" fill="currentColor" />
    </svg>
  );
}

function DeliverScene({ t }: { t: number }) {
  const approved = t >= D_APPROVE;
  const allOpen = t >= D_APPROVE + 300 + FILES.length * 220;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Deliverables · Hero spot" sub="Client portal · downloads open once approved" right={approved ? <Chip tone="green" t={t} since={D_APPROVE}>Approved by Maya</Chip> : <Chip tone="amber" t={t}>Locked until approved</Chip>}>
        <div className="absolute" style={{ left: 16, top: 66, width: 608 }}>
          {FILES.map((f, i) => {
            const o = easeOut(ramp(t, D_APPROVE + 300 + i * 220, 380));
            return (
              <div key={f.n} className="flex items-center gap-3 border-b border-border" style={{ height: 50 }}>
                <span className="grid place-items-center rounded-[8px] text-[9.5px] font-extrabold text-white" style={{ width: 38, height: 30, background: o > 0.5 ? "var(--h-green)" : "var(--text-faint)" }}>
                  {f.tag}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{f.n}</p>
                  <p className="truncate text-[11px] text-text-faint">{f.s}</p>
                </div>
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: o > 0.5 ? "var(--h-green)" : "var(--text-faint)" }}>
                  <Lock open={o} />
                  {o > 0.5 ? "Download" : "Locked"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="absolute flex items-center justify-between" style={{ left: 16, right: 16, bottom: 14 }}>
          <span className="text-[11.5px] text-text-faint">Shared with Maya Torres · Bright Water</span>
          <span className="rounded-full px-4 py-1.5 text-[12.5px] font-extrabold text-white" style={{ background: allOpen ? "var(--accent)" : "var(--text-faint)", transform: `scale(${allOpen ? 0.9 + 0.1 * spring(ramp(t, D_APPROVE + 300 + FILES.length * 220, 400)) : 1})` }}>
            Download all · 6 files
          </span>
        </div>
      </Window>
    </div>
  );
}

/* ------------------------------------------------------------- LAYOUT */

const BAR_Y = 150;
const LINE_Y = 290;
const CARD_Y = 560;
const CARD_H = 650;
const THREAD_Y = 1236;
const THREAD_H = 76 + 3 * ROW + 6;

function JobBar({ t, alpha }: { t: number; alpha: number }) {
  const n = CHAPTERS.length;
  let pos = -0.6;
  for (let i = 0; i < n; i++) {
    if (t >= STARTS[i]) pos = i + clamp01((t - STARTS[i]) / CHAPTERS[i].dur);
  }
  const x0 = 90;
  const x1 = 990;
  const step = (x1 - x0) / (n - 1);
  const cur = Math.floor(pos);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: BAR_Y, height: 90, opacity: alpha }}>
      <div style={{ position: "absolute", left: x0, width: x1 - x0, top: 14, height: 6, borderRadius: 9, background: "rgba(30,20,80,.1)" }} />
      <div style={{ position: "absolute", left: x0, width: Math.max(0, Math.min(1, pos / (n - 1))) * (x1 - x0), top: 14, height: 6, borderRadius: 9, background: "linear-gradient(90deg, var(--h-indigo), var(--h-pink))" }} />
      {CHAPTERS.map((c, i) => {
        const done = i < cur || pos >= n;
        const active = i === cur && pos < n;
        const s = active ? 1 + 0.18 * spring(ramp(t, STARTS[i], 500)) : 1;
        return (
          <div key={c.key} style={{ position: "absolute", left: x0 + i * step, top: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 99, background: done || active ? `var(--h-${c.hue})` : "white", border: done || active ? "none" : "3px solid rgba(30,20,80,.16)", transform: `scale(${s})`, boxShadow: active ? `0 0 0 8px color-mix(in oklch, var(--h-${c.hue}) 22%, transparent)` : undefined, display: "grid", placeItems: "center", color: "white", fontSize: 18, fontWeight: 900 }}>
              {done ? "✓" : ""}
            </span>
            <span style={{ fontSize: 20, fontWeight: active ? 800 : 600, color: active ? INK : "#8b879c", whiteSpace: "nowrap" }}>{c.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChapterView({ i, local, alphaIn, alphaOut }: { i: number; local: number; alphaIn: number; alphaOut: number }) {
  const c = CHAPTERS[i];
  const a = alphaIn * (1 - alphaOut);
  const push = lerp(1, 1.035, easeInOut(clamp01(local / c.dur)));
  const lift = (1 - alphaIn) * 70 - alphaOut * 50;
  return (
    <>
      {/* The line the voiceover reads */}
      <div style={{ position: "absolute", left: 70, right: 70, top: LINE_Y, opacity: 1 - alphaOut, transform: `translateY(${-alphaOut * 30}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: `var(--h-${c.hue})`, opacity: ramp(local, 100, 500) }}>
          <span>{String(i + 1).padStart(2, "0")}</span>
          <span style={{ width: 40, height: 3, borderRadius: 3, background: `var(--h-${c.hue})` }} />
          <span>{c.phase}</span>
        </div>
        <div className="font-display" style={{ marginTop: 16, fontSize: 60, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.08, color: INK }}>
          <Words text={c.line[0]} t={local} at={350} stagger={70} dur={620} />
        </div>
        <div style={{ marginTop: 12, fontSize: 38, fontWeight: 600, lineHeight: 1.25, color: "#5f5b73" }}>
          <Words text={c.line[1]} t={local} at={1300} stagger={55} dur={560} />
        </div>
      </div>
      {/* The work */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: CARD_Y,
          height: CARD_H,
          borderRadius: 48,
          overflow: "hidden",
          background: `linear-gradient(155deg, var(--h-${c.hue}-bg), #ffffff 75%)`,
          boxShadow: `0 60px 120px -50px color-mix(in oklch, var(--h-${c.hue}) 65%, transparent), 0 0 0 1.5px rgba(30,20,80,.05)`,
          opacity: a,
          transform: `translateY(${lift}px) scale(${0.97 + 0.03 * alphaIn})`,
        }}
      >
        <div style={{ position: "absolute", left: 480, top: 325, width: 640, height: 440, transform: `translate(-50%, -50%) scale(${1.4 * push})` }}>{c.card(local)}</div>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- INTRO */

const TABS = [
  { n: "Storyboard_v3_FINAL.pdf", k: "PDF", hue: "red", x: 120, y: 700, r: -7 },
  { n: "Shot list (copy).xlsx", k: "XLS", hue: "green", x: 560, y: 640, r: 6 },
  { n: "Call sheet Day 1.pdf", k: "PDF", hue: "red", x: 80, y: 980, r: 4 },
  { n: "Hero_cut_v2_FINAL.mov", k: "MOV", hue: "purple", x: 540, y: 930, r: -5 },
  { n: "Budget_v7.xlsx", k: "XLS", hue: "green", x: 150, y: 1250, r: -3 },
  { n: "Delivery specs.docx", k: "DOC", hue: "blue", x: 580, y: 1210, r: 7 },
  { n: "Lunch order (reply all)", k: "MAIL", hue: "amber", x: 300, y: 1470, r: -6 },
  { n: "Invoice_draft.docx", k: "DOC", hue: "blue", x: 640, y: 1460, r: 3 },
];
const TAB_AT = (i: number) => 1300 + i * 520;

function TabWindow({ tab }: { tab: (typeof TABS)[number] }) {
  return (
    <div style={{ width: 420, borderRadius: 22, overflow: "hidden", background: "#fbfaff", boxShadow: "0 40px 80px -30px rgba(0,0,0,.8)" }}>
      <div style={{ height: 50, background: "#e9e6f2", display: "flex", alignItems: "center", gap: 8, padding: "0 16px" }}>
        {["#ff6b6b", "#ffc14d", "#4cd964"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c }} />
        ))}
        <span style={{ marginLeft: 10, padding: "6px 14px", borderRadius: "10px 10px 0 0", background: "#fbfaff", fontSize: 18, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 300 }}>{tab.n}</span>
      </div>
      <div style={{ padding: 20, display: "flex", gap: 16 }}>
        <span style={{ display: "grid", placeItems: "center", width: 64, height: 64, borderRadius: 14, background: `var(--h-${tab.hue})`, color: "white", fontWeight: 900, fontSize: 17 }}>{tab.k}</span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
          {[90, 70, 80].map((w, i) => (
            <span key={i} style={{ height: 10, width: `${w}%`, borderRadius: 6, background: "#e4e1ee" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const INBOX = [
  { from: "Maya Torres", sub: "Re: Re: Fwd: storyboard v3 (notes inside)", time: "9:41 PM" },
  { from: "Leo Park", sub: "Call time tomorrow??", time: "9:52 PM" },
  { from: "Jon Kim", sub: "Which cut is the final one?", time: "10:07 PM" },
  { from: "Sam Ortiz", sub: "Lunch order, still need yours", time: "10:30 PM" },
  { from: "Maya Torres", sub: "Fwd: delivery specs (updated)", time: "10:58 PM" },
  { from: "Accounts", sub: "Re: invoice INV-021?", time: "11:03 PM" },
];
const INBOX_AT = (i: number) => 6900 + i * 520;

function IntroSection({ t }: { t: number }) {
  const phaseB = ramp(t, 5800, 900);
  const conv = easeIn(ramp(t, 10900, 1400)); // everything pulled into the mark
  const markIn = t >= 11900;
  const lightWipe = easeInOut(ramp(t, 13000, 1300));
  const capA = t < 5900;
  const capB = t >= 5900 && t < 10900;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%, #1a1530, #07060d 70%)" }} />
      {/* Tabs */}
      <div style={{ position: "absolute", inset: 0, perspective: 1600 }}>
        {TABS.map((tab, i) => {
          if (t < TAB_AT(i)) return null;
          const s = spring(ramp(t, TAB_AT(i), 700));
          const drift = Math.sin(t / 1800 + i) * 10;
          const back = phaseB;
          const x = lerp(tab.x, 540 - 210, conv);
          const y = lerp(tab.y, 1000 - 70, conv);
          return (
            <div
              key={tab.n}
              style={{
                position: "absolute",
                left: x,
                top: y + drift,
                opacity: clamp01(s * 1.3) * (1 - back * 0.55) * (1 - conv),
                filter: back > 0 || conv > 0 ? `blur(${back * 5 + conv * 10}px)` : undefined,
                transform: `rotateY(${(i % 2 ? -1 : 1) * 14}deg) rotateZ(${tab.r * (1 - conv)}deg) scale(${(0.6 + 0.4 * s) * (1 - back * 0.12) * (1 - conv * 0.8)})`,
              }}
            >
              <TabWindow tab={tab} />
            </div>
          );
        })}
      </div>
      {/* The inbox */}
      {t >= 5800 ? (
        <div style={{ position: "absolute", left: 70, right: 70, top: lerp(lerp(760, 640, easeOut(phaseB)), 900, conv), opacity: easeOut(phaseB) * (1 - conv), transform: `scale(${lerp(0.94, 1, easeOut(phaseB)) * (1 - conv * 0.85)})`, filter: conv > 0 ? `blur(${conv * 10}px)` : undefined }}>
          <div style={{ borderRadius: 36, overflow: "hidden", background: "white", boxShadow: "0 60px 120px -40px rgba(0,0,0,.9)" }}>
            <div style={{ height: 90, display: "flex", alignItems: "center", gap: 18, padding: "0 32px", borderBottom: "1.5px solid #ece9f4" }}>
              <GmailGlyph size={40} />
              <span style={{ fontSize: 34, fontWeight: 800, color: INK }}>Inbox</span>
              <span style={{ marginLeft: "auto", fontSize: 26, fontWeight: 800, color: "white", background: "var(--h-red)", borderRadius: 99, padding: "6px 18px" }}>{Math.round(lerp(12, 47, easeOut(ramp(t, 6600, 3600))))} unread</span>
            </div>
            {INBOX.map((m, i) => {
              const p = spring(ramp(t, INBOX_AT(i), 520));
              if (t < INBOX_AT(i)) return <div key={i} style={{ height: 100 }} />;
              return (
                <div key={i} style={{ height: 100, display: "flex", alignItems: "center", gap: 20, padding: "0 32px", borderBottom: "1.5px solid #f1eff7", opacity: clamp01(p * 1.4), transform: `translateX(${(1 - p) * 60}px)` }}>
                  <span style={{ width: 14, height: 14, borderRadius: 99, background: "var(--h-blue)", flexShrink: 0 }} />
                  <span style={{ width: 200, flexShrink: 0, fontSize: 27, fontWeight: 800, color: INK, whiteSpace: "nowrap" }}>{m.from}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 27, fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.sub}</span>
                  <span style={{ fontSize: 22, color: "#8b879c", whiteSpace: "nowrap" }}>{m.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {/* The mark everything is pulled into */}
      {markIn ? (
        <div style={{ position: "absolute", left: 540, top: 1000, transform: `translate(-50%, -50%) scale(${1 + lightWipe * 0.1})`, opacity: 1 - ramp(t, 14600, 700) }}>
          <MarkTile size={220} t={t - 11900} at={0} />
        </div>
      ) : null}
      {/* Light opens from the mark into the product */}
      {lightWipe > 0 ? <div style={{ position: "absolute", inset: 0, background: BG, clipPath: `circle(${lightWipe * 130}% at 50% 52%)` }} /> : null}
      {/* Captions */}
      <div className="font-display" style={{ position: "absolute", left: 70, right: 70, top: 300, fontSize: 70, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.06, color: lightWipe > 0.6 ? INK : "white" }}>
        {capA ? (
          <div style={{ opacity: 1 - ramp(t, 5500, 400) }}>
            <Words text="A commercial job lives" t={t} at={300} stagger={80} dur={620} />
            <Words text="in a dozen tabs." t={t} at={1000} stagger={80} dur={620} style={{ color: GLOW }} />
          </div>
        ) : capB ? (
          <div style={{ opacity: 1 - ramp(t, 10500, 400) }}>
            <Words text="And the conversation with your client" t={t} at={6100} stagger={70} dur={620} />
            <Words text="lives in your inbox." t={t} at={7100} stagger={80} dur={620} style={{ color: GLOW }} />
          </div>
        ) : (
          <div>
            <Words text="Studio Flows brings the work" t={t} at={11300} stagger={70} dur={620} />
            <Words text="and the conversation into one place." t={t} at={12200} stagger={70} dur={620} style={{ color: lightWipe > 0.6 ? "var(--h-indigo)" : GLOW }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- OUTRO */

function OutroSection({ t }: { t: number }) {
  // local, 0 at OUTRO. The card clears, the thread grows to show the whole job.
  const grow = easeInOut(ramp(t, 300, 1400));
  const scroll = easeInOut(ramp(t, 1800, 4200)); // read back up through the job
  const out = easeIn(ramp(t, 6200, 700));
  const top = lerp(THREAD_Y, 620, grow);
  const height = lerp(THREAD_H, 1000, grow);
  const rows = 9;
  const lock = t >= 6800;
  return (
    <>
      {!lock ? (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - out, transform: `scale(${1 - out * 0.06})` }}>
          <div className="font-display" style={{ position: "absolute", left: 70, right: 70, top: LINE_Y, fontSize: 84, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.02, color: INK }}>
            <Words text="Every step. Every message." t={t} at={500} stagger={110} dur={650} />
            <Words text="One place." t={t} at={1700} stagger={110} dur={650} style={{ color: "var(--h-indigo)" }} />
          </div>
          <ThreadPanel t={OUTRO + t} rows={rows} top={top} height={height} scrollBack={scroll * Math.max(0, THREAD.length - rows)} />
        </div>
      ) : null}
      {lock ? (
        <>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 44%, color-mix(in oklch, var(--h-indigo) 16%, transparent), transparent 60%)`, opacity: ramp(t, 6800, 800) }} />
          <div style={{ position: "absolute", left: 540, top: 720, transform: "translate(-50%, -50%)" }}>
            <MarkTile size={210} t={t - 6800} at={0} glow={false} />
          </div>
          <div className="font-display" style={{ position: "absolute", left: 0, right: 0, top: 860, textAlign: "center", fontSize: 136, fontWeight: 800, letterSpacing: "-0.05em", color: INK }}>
            <Words text="Studio Flows" t={t - 6800} at={300} stagger={120} style={{ display: "inline-block" }} />
          </div>
          <div style={{ position: "absolute", left: 60, right: 60, top: 1050, textAlign: "center", fontSize: 50, fontWeight: 700, color: "var(--h-indigo)" }}>
            <Words text="From the first frame to the final invoice." t={t - 6800} at={900} stagger={70} style={{ display: "inline-block" }} />
          </div>
          <div style={{ position: "absolute", left: "50%", top: 1200, transform: `translateX(-50%) scale(${spring(ramp(t - 6800, 2000, 560))})`, padding: "28px 60px", borderRadius: 999, background: "var(--h-indigo)", color: "white", fontSize: 48, fontWeight: 800, whiteSpace: "nowrap", boxShadow: "0 30px 70px -24px color-mix(in oklch, var(--h-indigo) 80%, black)" }}>
            studio-flows.com
          </div>
        </>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- STAGE */

export function FlowVideo({ t }: { t: number }) {
  const inChapters = t >= INTRO - 1500 && t < OUTRO + 1600;
  let ci = 0;
  for (let i = 0; i < CHAPTERS.length; i++) if (t >= STARTS[i]) ci = i;
  const local = t - STARTS[ci];
  const prev = ci > 0 && local < 700 ? ci - 1 : -1;
  const hue = CHAPTERS[ci].hue;
  const layoutIn = easeOut(ramp(t, INTRO - 1200, 1200));
  const outroFade = ramp(t, OUTRO, 600);
  return (
    <div data-theme="light" data-accent="indigo" className="font-body" style={{ position: "relative", width: W, height: H, overflow: "hidden", background: t < INTRO - 1500 ? DARK : BG, color: "var(--text)" }}>
      {t < INTRO + 200 ? <IntroSection t={t} /> : null}
      {inChapters ? (
        <div style={{ position: "absolute", inset: 0, opacity: t >= INTRO ? 1 : layoutIn }}>
          <div style={{ position: "absolute", inset: 0, background: BG }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(40,30,90,.09) 2.5px, transparent 2.5px)", backgroundSize: "54px 54px" }} />
          <div style={{ position: "absolute", left: -200, right: -200, top: 300, height: 1300, background: `radial-gradient(ellipse at 50% 50%, color-mix(in oklch, var(--h-${hue}) 20%, transparent), transparent 62%)`, transition: "none" }} />
          <JobBar t={t} alpha={layoutIn} />
          {t >= INTRO && t < OUTRO + 700 ? (
            <div style={{ position: "absolute", inset: 0, opacity: 1 - outroFade }}>
              {prev >= 0 ? <ChapterView i={prev} local={CHAPTERS[prev].dur + local} alphaIn={1} alphaOut={easeIn(ramp(local, 0, 500))} /> : null}
              <ChapterView i={ci} local={local} alphaIn={easeOut(ramp(local, ci === 0 ? 0 : 250, 750))} alphaOut={0} />
            </div>
          ) : null}
          {t < OUTRO + 300 ? <ThreadPanel t={t} top={THREAD_Y} height={THREAD_H} /> : null}
          {t >= INTRO && t < OUTRO ? <SendFlight t={t} cardTop={CARD_Y} threadTop={THREAD_Y} /> : null}
        </div>
      ) : null}
      {t >= OUTRO ? <OutroSection t={t - OUTRO} /> : null}
    </div>
  );
}

/** Where each chapter starts, for timing a recorded voiceover to the picture. */
export const FLOW_CHAPTERS = CHAPTERS.map((c, i) => ({ key: c.key, start: STARTS[i], dur: c.dur, line: c.line.join(" ") }));
export const FLOW_INTRO_MS = INTRO;
export const FLOW_OUTRO_AT = OUTRO;
