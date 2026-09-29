"use client";

import type { ReactNode } from "react";
import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, easeOut, lerp, ramp, spring, typed } from "./scene-kit";

/*
 * The client review page's chapter scenes (640x440, a pure function of t, one
 * labelled action about a second apart). Everything shown is the shipped
 * review stack: the no-login portal with a name gate and a respond-by date,
 * pins on images and PDF pages, frame-accurate video with range comments and
 * crop guides, drawn markup with threads, and versions with compare and
 * sign-off.
 */

function Btn({ children, press, tone = "accent", on }: { children: ReactNode; press?: boolean; tone?: "accent" | "quiet" | "green"; on?: boolean }) {
  const bg = tone === "accent" ? "var(--accent)" : tone === "green" ? "var(--h-green)" : on ? "var(--accent-soft)" : "var(--surface)";
  const fg = tone === "quiet" ? (on ? "var(--accent)" : "var(--text-muted)") : "white";
  return (
    <span
      className="inline-flex items-center justify-center rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold"
      style={{ background: bg, color: fg, border: tone === "quiet" ? "1px solid var(--border)" : "none", transform: `scale(${press ? 0.93 : 1})` }}
    >
      {children}
    </span>
  );
}

/** The frame under review, drawn: a pack shot on a gradient. */
function Frame({ hue = "cyan", warm = false }: { hue?: string; warm?: boolean }) {
  return (
    <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, var(--h-${hue}-bg), ${warm ? "var(--h-amber-bg)" : "var(--h-blue-bg)"} 60%, var(--surface-2))` }}>
      <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <ellipse cx="150" cy="180" rx="130" ry="14" fill="var(--surface)" opacity=".7" />
        <rect x="132" y="30" width="36" height="14" rx="4" fill="var(--h-indigo)" />
        <path d="M128 44 h44 q10 14 10 30 v96 q0 8 -8 8 h-48 q-8 0 -8 -8 v-96 q0 -16 10 -30z" fill={warm ? "var(--h-orange)" : "var(--h-blue)"} opacity=".85" />
        <rect x="122" y="92" width="56" height="44" rx="6" fill="var(--surface)" />
        <path d="M206 120 h40 l-6 52 q-1 6 -7 6 h-14 q-6 0 -7 -6z" fill="var(--surface)" opacity=".75" stroke="var(--h-cyan)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function Pin({ n, x, y, t, at, done }: { n: number; x: number; y: number; t: number; at: number; done?: boolean }) {
  const s = spring(ramp(t, at, 480));
  if (s <= 0) return null;
  return (
    <span
      className="absolute grid h-7 w-7 place-items-center rounded-full text-[12px] font-black text-white"
      style={{ left: x - 14, top: y - 14, transform: `scale(${s})`, background: done ? "var(--h-green)" : "var(--accent)", boxShadow: "0 0 0 3px white, 0 6px 14px -4px rgba(20,15,60,.45)" }}
    >
      {done ? "✓" : n}
    </span>
  );
}

/* ------------------------------------------------------------------ SHARE */

export const RV_SHARE_MS = 12500;

const EMAIL_AT = 900;
const DUE_AT = 2100;
const SEND_AT = 3400;
const OPEN_AT = 4600;
const NAME_AT = 5600;
const IN_AT = 7000;
const LATE_AT = 9200;

export function ReviewShareScene({ t }: { t: number }) {
  const portal = t >= OPEN_AT;
  const late = t >= LATE_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      {!portal ? (
        <Window title="Hero pack shot · v3" sub="Review · Bright Water" right={<Btn tone="quiet" on={t >= EMAIL_AT - 300} press={t >= EMAIL_AT - 60 && t < EMAIL_AT + 80}>Email for review</Btn>}>
          <div className="absolute overflow-hidden rounded-[12px]" style={{ left: 16, top: 66, width: 300, height: 200 }}>
            <Frame />
          </div>
          {t >= EMAIL_AT ? (
            <div className="absolute rounded-[14px] border border-border bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(40,30,90,.55)]" style={{ left: 200, top: 110, width: 400, ...arrive(t, EMAIL_AT, 12) }}>
              <p className="text-[13px] font-extrabold">Send for review</p>
              <div className="mt-2 space-y-2 text-[11.5px]">
                <div className="flex items-center gap-2"><span className="w-16 text-text-faint">To</span><span className="flex-1 rounded-[7px] border border-border px-2 py-1 font-semibold">maya@brightwater.co</span></div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-text-faint">Respond by</span>
                  <span className="rounded-[7px] border px-2 py-1 font-semibold" style={{ borderColor: t >= DUE_AT - 200 && t < DUE_AT + 800 ? "var(--accent)" : "var(--border)" }}>{t >= DUE_AT ? "Fri, Oct 7" : "Pick a date"}</span>
                </div>
                <div className="flex items-start gap-2"><span className="w-16 text-text-faint">Message</span><span className="flex-1 rounded-[7px] border border-border px-2 py-1">Here's v3 with the warmer glass. Pin anything you'd change.</span></div>
              </div>
              <div className="mt-3 flex justify-end">
                <Btn press={t >= SEND_AT - 60 && t < SEND_AT + 80}>{t >= SEND_AT ? "Sent ✓" : "Send"}</Btn>
              </div>
            </div>
          ) : null}
        </Window>
      ) : (
        <div style={arrive(t, OPEN_AT, 10)}>
          <Window title="studio-flows.com/r/8f2k…" sub="Northline Studio shared Hero pack shot · v3" right={<span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: "var(--surface-2)" }}>No account needed</span>}>
            <div className="absolute flex items-center gap-2 rounded-[10px] px-3 py-2 text-[11.5px] font-bold" style={{ left: 16, top: 62, width: 608, background: late ? "var(--h-red-bg)" : "var(--h-amber-bg)", color: late ? "var(--h-red)" : "var(--h-amber)", transition: "all .4s" }}>
              {late ? "Response was due Fri, Oct 7" : "Please respond by Fri, Oct 7"}
            </div>
            <div className="absolute overflow-hidden rounded-[12px]" style={{ left: 16, top: 104, width: 400, height: 310, filter: t < IN_AT ? "blur(3px)" : undefined, transition: "filter .4s" }}>
              <Frame />
            </div>
            <div className="absolute" style={{ left: 432, top: 104, width: 192 }}>
              <div className="flex gap-1.5">
                <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-bold text-text-muted">v1</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-bold text-text-muted">v2</span>
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>v3 · latest</span>
              </div>
              <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Comments</p>
              <p className="mt-1 text-[11.5px] text-text-muted">{t >= IN_AT ? "Click the frame to pin a note." : "Tell us your name to comment."}</p>
              <div className="mt-6 space-y-2">
                <Btn tone="green">Approve</Btn>
                <div><Btn tone="quiet">Request changes</Btn></div>
              </div>
            </div>
            {/* Name gate */}
            {t < IN_AT ? (
              <div className="absolute rounded-[14px] border border-border bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(40,30,90,.55)]" style={{ left: 90, top: 190, width: 260, ...arrive(t, OPEN_AT + 300, 10) }}>
                <p className="text-[13px] font-extrabold">Your name</p>
                <p className="text-[11px] text-text-faint">So the studio knows who said what.</p>
                <div className="mt-2 rounded-[8px] border px-2 py-1.5 text-[12px] font-semibold" style={{ borderColor: "var(--accent)" }}>
                  {typed("Maya Torres", t, NAME_AT, 70)}
                </div>
                <div className="mt-2 flex justify-end"><Btn press={t >= IN_AT - 60}>Start reviewing</Btn></div>
              </div>
            ) : null}
            {late ? (
              <div className="absolute flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-2 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ left: 60, bottom: 30, ...arrive(t, LATE_AT + 500, 10) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--h-amber)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                <span className="text-[11.5px] font-semibold">Reminder emailed to Maya · at most 3, two days apart</span>
              </div>
            ) : null}
          </Window>
        </div>
      )}
      <ActionLabel t={t} at={EMAIL_AT} x={560} y={20} text="Email the review" />
      <ActionLabel t={t} at={DUE_AT} x={330} y={160} text="Set a respond-by date" tone="amber" />
      <ActionLabel t={t} at={NAME_AT} x={250} y={230} text="The client just types their name" tone="green" after={900} />
      <ActionLabel t={t} at={LATE_AT} x={200} y={62} text="Late? It reminds them for you" tone="red" after={1800} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 400, x: 320, y: 360 },
          { t: EMAIL_AT, x: 580, y: 26, click: true },
          { t: DUE_AT, x: 300, y: 172, click: true },
          { t: SEND_AT, x: 574, y: 272, click: true },
          { t: IN_AT, x: 300, y: 296, click: true },
        ]}
      />
    </div>
  );
}

/* --------------------------------------------------------- IMAGES + PDFs */

export const RV_PINS_MS = 12500;

const IMG_PINS = [
  { n: 1, x: 210, y: 200, at: 900, text: "Turn the label to camera." },
  { n: 2, x: 330, y: 250, at: 2200, text: "Warmer light on the glass." },
];
const PDF_AT = 4200;
const PAGE_AT = 5600;
const ZOOM_AT = 7000;
const PDF_PIN = { n: 1, x: 250, y: 220, at: 8600, text: "Frame 3: tighter on the pour." };

export function ReviewPinsScene({ t }: { t: number }) {
  const pdf = t >= PDF_AT;
  const page = t >= PAGE_AT ? 2 : 1;
  const zoom = 1 + 0.35 * easeOut(ramp(t, ZOOM_AT, 600));
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title={pdf ? "Director's board · PDF" : "Hero pack shot · v3"} sub={pdf ? "Pinned, page by page" : "Click anywhere to pin a note"} right={<Chip tone="green" t={t}>{pdf ? "PDF" : "Image"}</Chip>}>
        {!pdf ? (
          <>
            <div className="absolute overflow-hidden rounded-[12px]" style={{ left: 16, top: 66, width: 400, height: 358 }}>
              <Frame />
            </div>
            {IMG_PINS.map((p) => <Pin key={p.n} {...p} t={t} />)}
          </>
        ) : (
          <div style={arrive(t, PDF_AT, 10)}>
            <div className="absolute flex gap-1.5" style={{ left: 16, top: 62 }}>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: n === page ? "var(--accent-soft)" : "var(--surface-2)", color: n === page ? "var(--accent)" : "var(--text-muted)" }}>
                  Page {n}{n === 2 && t >= PDF_PIN.at ? " · 1" : ""}
                </span>
              ))}
              <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-bold">{t >= ZOOM_AT ? "2x" : "Fit"}</span>
            </div>
            <div className="absolute overflow-hidden rounded-[8px] border border-border bg-white" style={{ left: 16, top: 90, width: 400, height: 334 }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: "40% 40%", padding: 16 }}>
                <p className="text-[9px] font-extrabold tracking-[0.14em] text-[#555]">HERO SPOT · STORYBOARD · PAGE {page}</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i}>
                      <div className="h-[92px] rounded-[4px]" style={{ background: `linear-gradient(135deg, var(--h-${["amber", "cyan", "pink", "blue"][(i + page) % 4]}-bg), #eee)` }} />
                      <p className="mt-1 text-[8.5px] text-[#333]">{page * 4 - 3 + i}. The pour, from the side</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Pin {...PDF_PIN} t={t} />
          </div>
        )}
        {/* Comment rail */}
        <div className="absolute space-y-2" style={{ left: 432, top: 66, width: 192 }}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-text-faint">{pdf ? `Page ${page}` : "Comments"}</p>
          {(pdf ? (t >= PDF_PIN.at ? [PDF_PIN] : []) : IMG_PINS.filter((p) => t >= p.at)).map((p) => (
            <div key={`${pdf}${p.n}`} className="rounded-[10px] border border-border bg-surface p-2" style={arrive(t, p.at + 60)}>
              <div className="flex items-center gap-1.5">
                <span className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-black text-white" style={{ background: "var(--accent)" }}>{p.n}</span>
                <span className="text-[11.5px] font-bold">Maya</span>
                <span className="text-[10px] text-text-faint">Client</span>
              </div>
              <p className="mt-1 text-[11.5px] text-text-muted">{typed(p.text, t, p.at + 250, 22)}</p>
            </div>
          ))}
        </div>
      </Window>
      <ActionLabel t={t} at={IMG_PINS[0].at} x={IMG_PINS[0].x} y={IMG_PINS[0].y} text="Click the spot, write the note" />
      <ActionLabel t={t} at={PDF_AT + 300} x={60} y={250} text="PDFs too, page by page" tone="green" after={1200} />
      <ActionLabel t={t} at={ZOOM_AT} x={250} y={60} text="Zoom re-renders sharp" tone="indigo" after={1100} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 400, x: 320, y: 380 },
          ...IMG_PINS.map((p) => ({ t: p.at, x: p.x + 2, y: p.y + 2, click: true })),
          { t: PAGE_AT, x: 110, y: 70, click: true },
          { t: ZOOM_AT, x: 280, y: 70, click: true },
          { t: PDF_PIN.at, x: PDF_PIN.x + 2, y: PDF_PIN.y + 2, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ VIDEO */

export const RV_VIDEO_MS = 13000;

const DUR = 30;
const PAUSE_AT = 1500;
const POINT = { at: 2300, tc: 8.4, text: "Hold on the pour a beat longer." };
const RANGE = { in: 14, out: 21, at: 5200, text: "This whole stretch drags." };
const GUIDE_AT = 8200;
const CROP_AT = 9400;

const tcode = (s: number) => {
  const f = Math.floor((s % 1) * 24);
  const ss = Math.floor(s);
  return `00:00:${String(ss).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
};

export function ReviewVideoScene({ t }: { t: number }) {
  // Playhead: plays to 8.4s, pauses, jumps to 14, set range to 21, plays on.
  const head =
    t < PAUSE_AT ? lerp(0, POINT.tc, ramp(t, 0, PAUSE_AT)) : t < 3900 ? POINT.tc : t < 4400 ? lerp(POINT.tc, RANGE.in, ramp(t, 3900, 500)) : t < RANGE.at ? lerp(RANGE.in, RANGE.out, ramp(t, 4400, RANGE.at - 4400)) : RANGE.out + (t - RANGE.at) / 1400;
  const hx = (s: number) => 16 + (s / DUR) * 608;
  const crop = t >= CROP_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Hero spot · cut v2" sub="Frame-accurate notes on the cut" right={<span className="rounded-[7px] bg-surface-2 px-2 py-1 font-mono text-[11px] font-bold tabular-nums">{tcode(Math.min(head, DUR))}</span>}>
        <div className="absolute overflow-hidden rounded-[10px]" style={{ left: 16, top: 62, width: 608, height: 262, background: "#0d0d14" }}>
          <div className="absolute inset-[18px] overflow-hidden rounded-[6px]" style={{ opacity: 0.95 }}>
            <Frame warm={head > 12} />
          </div>
          {t >= GUIDE_AT ? (
            <>
              <div className="absolute rounded-[3px] border border-dashed" style={{ inset: "11%", borderColor: "rgba(255,255,255,.55)", ...arrive(t, GUIDE_AT, 0) }} />
              <div className="absolute rounded-[3px] border border-dashed" style={{ inset: "6%", borderColor: "rgba(255,255,255,.3)", ...arrive(t, GUIDE_AT, 0) }} />
            </>
          ) : null}
          {crop ? (
            <>
              <div className="absolute inset-y-0 left-0" style={{ width: `${(1 - 147 / 608) * 50}%`, background: "rgba(0,0,0,.62)", ...arrive(t, CROP_AT, 0) }} />
              <div className="absolute inset-y-0 right-0" style={{ width: `${(1 - 147 / 608) * 50}%`, background: "rgba(0,0,0,.62)", ...arrive(t, CROP_AT, 0) }} />
              <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: "rgba(0,0,0,.6)" }}>9:16 crop</span>
            </>
          ) : null}
        </div>
        {/* Scrub bar with markers */}
        <div className="absolute" style={{ left: 16, top: 336, width: 608, height: 26 }}>
          <div className="absolute top-[11px] h-1 w-full rounded-full bg-surface-2" />
          <div className="absolute top-[11px] h-1 rounded-full" style={{ width: `${(Math.min(head, DUR) / DUR) * 100}%`, background: "var(--accent)" }} />
          {t >= RANGE.at ? <div className="absolute top-[8px] h-[10px] rounded-full" style={{ left: hx(RANGE.in) - 16, width: hx(RANGE.out) - hx(RANGE.in), background: "color-mix(in oklch, var(--h-amber) 45%, transparent)" }} /> : null}
          {t >= POINT.at ? <span className="absolute top-[4px] grid h-[18px] w-[18px] place-items-center rounded-full text-[9px] font-black text-white" style={{ left: hx(POINT.tc) - 16 - 9, background: "var(--accent)", transform: `scale(${spring(ramp(t, POINT.at, 400))})` }}>1</span> : null}
          {t >= RANGE.at ? <span className="absolute top-[4px] grid h-[18px] w-[18px] place-items-center rounded-full text-[9px] font-black text-white" style={{ left: hx(RANGE.in) - 16 - 9, background: "var(--h-amber)", transform: `scale(${spring(ramp(t, RANGE.at, 400))})` }}>2</span> : null}
          <span className="absolute top-0 h-[26px] w-[2px]" style={{ left: `${(Math.min(head, DUR) / DUR) * 100}%`, background: "var(--text)" }} />
        </div>
        {/* Comments */}
        <div className="absolute flex gap-2" style={{ left: 16, top: 372, width: 608 }}>
          {t >= POINT.at ? (
            <div className="flex-1 rounded-[10px] border border-border px-2.5 py-1.5" style={arrive(t, POINT.at, 6)}>
              <p className="text-[10.5px] font-bold"><span style={{ color: "var(--accent)" }}>{tcode(POINT.tc).slice(3)}</span> · Maya</p>
              <p className="text-[11.5px] text-text-muted">{typed(POINT.text, t, POINT.at + 200, 20)}</p>
            </div>
          ) : null}
          {t >= RANGE.at ? (
            <div className="flex-1 rounded-[10px] border border-border px-2.5 py-1.5" style={arrive(t, RANGE.at, 6)}>
              <p className="text-[10.5px] font-bold"><span style={{ color: "var(--h-amber)" }}>0:14 to 0:21</span> · Jon</p>
              <p className="text-[11.5px] text-text-muted">{typed(RANGE.text, t, RANGE.at + 200, 20)}</p>
            </div>
          ) : null}
        </div>
      </Window>
      <ActionLabel t={t} at={POINT.at} x={hx(POINT.tc)} y={330} text="Pause, and comment on that frame" after={1200} />
      <ActionLabel t={t} at={4400} x={hx(RANGE.in)} y={320} text="Or mark a whole stretch" tone="amber" after={1400} />
      <ActionLabel t={t} at={GUIDE_AT} x={200} y={90} text="Safe-area guides" tone="muted" after={700} />
      <ActionLabel t={t} at={CROP_AT} x={200} y={110} text="Does it survive the vertical cut?" tone="indigo" after={2200} />
      <Cursor
        t={t}
        travel={600}
        path={[
          { t: 800, x: 320, y: 200 },
          { t: PAUSE_AT, x: 320, y: 200, click: true },
          { t: 3900, x: hx(RANGE.in), y: 348, click: true },
          { t: RANGE.at - 200, x: hx(RANGE.out), y: 348, click: true },
          { t: GUIDE_AT, x: 560, y: 90, click: true },
          { t: CROP_AT, x: 560, y: 90, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------ DRAW + TALK */

export const RV_DRAW_MS = 12500;

const TOOL_AT = 800;
const ARROW = { at: 1600, dur: 700 };
const BOX = { at: 3000, dur: 700 };
const COLOR_AT = 2600;
const POST_AT = 4600;
const REPLY_AT = 6400;
const REACT_AT = 8200;
const RESOLVE_AT = 9600;

export function ReviewDrawScene({ t }: { t: number }) {
  const a = easeOut(ramp(t, ARROW.at, ARROW.dur));
  const b = easeOut(ramp(t, BOX.at, BOX.dur));
  const col = t >= COLOR_AT ? "var(--h-amber)" : "var(--h-red)";
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Hero pack shot · v3" sub="Draw on it, then say why" right={t >= RESOLVE_AT ? <Chip tone="green" t={t} since={RESOLVE_AT}>Resolved</Chip> : <Chip tone="amber" t={t}>1 open</Chip>}>
        <div className="absolute overflow-hidden rounded-[12px]" style={{ left: 16, top: 104, width: 400, height: 320 }}>
          <Frame />
        </div>
        {/* Draw toolbar */}
        <div className="absolute flex items-center gap-1 rounded-[10px] border border-border bg-surface p-1" style={{ left: 16, top: 62 }}>
          {["↗", "╱", "▭", "◯", "✎"].map((g, i) => (
            <span key={g} className="grid h-7 w-7 place-items-center rounded-[7px] text-[13px] font-bold" style={{ background: (i === 0 && t >= TOOL_AT && t < BOX.at - 300) || (i === 2 && t >= BOX.at - 300 && t < POST_AT) ? "var(--accent-soft)" : undefined, color: "var(--text-muted)" }}>
              {g}
            </span>
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          {["red", "amber", "green", "blue", "text"].map((h) => (
            <span key={h} className="h-5 w-5 rounded-full" style={{ background: h === "text" ? "var(--text)" : `var(--h-${h})`, boxShadow: (h === "red" && t < COLOR_AT) || (h === "amber" && t >= COLOR_AT) ? "0 0 0 2px var(--surface), 0 0 0 4px var(--accent)" : undefined }} />
          ))}
          <span className="mx-1 h-5 w-px bg-border" />
          <span className="px-1 text-[11px] font-bold text-text-muted">Undo</span>
          <span className="px-1 text-[11px] font-bold text-text-muted">Redo</span>
        </div>
        <svg className="pointer-events-none absolute left-0 top-0" width="640" height="440" aria-hidden="true">
          <defs>
            <marker id="rv-ar" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--h-red)" />
            </marker>
          </defs>
          {t >= ARROW.at ? <path d={`M90 150 L ${lerp(90, 196, a)} ${lerp(150, 236, a)}`} stroke="var(--h-red)" strokeWidth="4" strokeLinecap="round" markerEnd={a > 0.9 ? "url(#rv-ar)" : undefined} /> : null}
          {t >= BOX.at ? <rect x={270} y={296} width={lerp(0, 90, b)} height={lerp(0, 110, b)} rx="6" fill="none" stroke={col} strokeWidth="4" /> : null}
        </svg>
        <Pin n={1} x={210} y={250} t={t} at={POST_AT} done={t >= RESOLVE_AT} />
        {/* Thread */}
        <div className="absolute" style={{ left: 432, top: 104, width: 192 }}>
          {t >= POST_AT ? (
            <div className="rounded-[10px] border border-border bg-surface p-2" style={arrive(t, POST_AT, 6)}>
              <div className="flex items-center gap-1.5">
                <Avatar name="Maya Torres" hue="pink" size={18} />
                <span className="text-[11.5px] font-bold">Maya</span>
                <span className="ml-auto text-[9.5px] font-bold" style={{ color: "var(--h-red)" }}>drawing</span>
              </div>
              <p className="mt-1 text-[11.5px] text-text-muted">Label to camera, and this glass reads cold.</p>
              {t >= REACT_AT ? (
                <div className="mt-1.5 flex gap-1" style={arrive(t, REACT_AT, 4)}>
                  <span className="rounded-full px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>👍 2</span>
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px]">🙌 1</span>
                </div>
              ) : null}
              {t >= REPLY_AT ? (
                <div className="mt-2 border-l-2 pl-2" style={{ borderColor: "var(--accent)", ...arrive(t, REPLY_AT, 4) }}>
                  <p className="text-[10.5px] font-bold">Studio <span className="font-semibold text-text-faint">· reply</span></p>
                  <p className="text-[11px] text-text-muted">{typed("On it. Warmer glass in v4 tomorrow.", t, REPLY_AT + 200, 24)}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-2 flex gap-1 text-[10px] font-bold text-text-faint">
            {["All", "Open", "Resolved", "Mine"].map((f, i) => (
              <span key={f} className="rounded-full px-2 py-0.5" style={{ background: i === 0 ? "var(--surface-2)" : undefined }}>{f}</span>
            ))}
          </div>
        </div>
      </Window>
      <ActionLabel t={t} at={ARROW.at} x={90} y={150} text="Draw an arrow" tone="red" />
      <ActionLabel t={t} at={BOX.at} x={270} y={296} text="Box the problem" tone="amber" />
      <ActionLabel t={t} at={REPLY_AT} x={440} y={200} text="Reply in the thread" after={1000} />
      <ActionLabel t={t} at={REACT_AT} x={440} y={180} text="React" tone="pink" />
      <ActionLabel t={t} at={RESOLVE_AT} x={210} y={250} text="Resolve when it's done" tone="green" after={1300} />
      <Cursor
        t={t}
        travel={600}
        path={[
          { t: 300, x: 320, y: 380 },
          { t: TOOL_AT, x: 30, y: 76, click: true },
          { t: ARROW.at, x: 90, y: 150, click: true },
          { t: ARROW.at + ARROW.dur, x: 196, y: 236 },
          { t: COLOR_AT, x: 214, y: 76, click: true },
          { t: BOX.at, x: 270, y: 296, click: true },
          { t: BOX.at + BOX.dur, x: 360, y: 406 },
          { t: RESOLVE_AT, x: 212, y: 252, click: true },
        ]}
      />
    </div>
  );
}

/* --------------------------------------------------------------- VERSIONS */

export const RV_VERS_MS = 12500;

const UP_AT = 900;
const CMP_AT = 2600;
const SLIDE = { at: 3400, dur: 1600 };
const BACK_AT = 6400;
const APPROVE_AT = 8000;

export function ReviewVersionsScene({ t }: { t: number }) {
  const v4 = t >= UP_AT + 600;
  const compare = t >= CMP_AT && t < BACK_AT;
  const approved = t >= APPROVE_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Hero pack shot" sub="Every version kept, every note on the version it was about" right={approved ? <Chip tone="green" t={t} since={APPROVE_AT}>Approved · v4</Chip> : <Chip tone="amber" t={t}>Changes requested · v3</Chip>}>
        <div className="absolute flex items-center gap-1.5" style={{ left: 16, top: 62 }}>
          {["v1", "v2", "v3"].map((v) => (
            <span key={v} className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-bold text-text-muted">{v}</span>
          ))}
          {v4 ? <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: "var(--accent-soft)", color: "var(--accent)", ...arrive(t, UP_AT + 600, 4) }}>v4 · latest</span> : null}
          <span className="ml-3"><Btn tone="quiet" on={t >= UP_AT - 300 && t < UP_AT + 600} press={t >= UP_AT - 60 && t < UP_AT + 80}>Upload new version</Btn></span>
          <span className="ml-1"><Btn tone="quiet" on={compare} press={t >= CMP_AT - 60 && t < CMP_AT + 80}>{compare ? "Back to review" : "Compare versions"}</Btn></span>
        </div>
        {compare ? (
          <div className="absolute grid grid-cols-2 gap-3" style={{ left: 16, top: 96, width: 608, height: 290, ...arrive(t, CMP_AT, 8) }}>
            {[
              ["v3", false],
              ["v4", true],
            ].map(([v, warm]) => (
              <div key={v as string} className="relative overflow-hidden rounded-[12px]">
                <Frame warm={warm as boolean} />
                <span className="absolute left-2 top-2 rounded-full bg-surface px-2 py-0.5 text-[10.5px] font-extrabold">{v as string}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute overflow-hidden rounded-[12px]" style={{ left: 16, top: 96, width: 400, height: 290 }}>
            <Frame warm={v4} />
          </div>
        )}
        {!compare ? (
          <div className="absolute space-y-2" style={{ left: 432, top: 96, width: 192 }}>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-text-faint">{v4 ? "v4 · no notes yet" : "v3 · 2 notes"}</p>
            <p className="text-[11px] text-text-muted">Notes on v3 stay on v3. Open it any time to see them.</p>
            <div className="pt-2">
              <span className="block"><Btn tone="green" press={t >= APPROVE_AT - 60 && t < APPROVE_AT + 120}>{approved ? "Approved ✓" : "Approve"}</Btn></span>
              <span className="mt-2 block"><Btn tone="quiet">Request changes</Btn></span>
            </div>
          </div>
        ) : null}
        {/* Where it shows up next */}
        {t >= APPROVE_AT + 700 ? (
          <div className="absolute flex items-center gap-2 rounded-[12px] border border-border bg-surface px-3 py-2 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ left: 16, bottom: 12, width: 608, ...arrive(t, APPROVE_AT + 700, 10) }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            </svg>
            <span className="text-[11.5px] font-semibold">Maya approved Hero pack shot v4 · it moves to Approved on the project's Review page</span>
          </div>
        ) : null}
        <Burst t={t} at={APPROVE_AT} x={480} y={210} spread={1.3} />
      </Window>
      <ActionLabel t={t} at={UP_AT} x={320} y={60} text="Upload v4 on top" />
      <ActionLabel t={t} at={CMP_AT} x={420} y={60} text="Compare side by side" tone="indigo" after={1800} />
      <ActionLabel t={t} at={APPROVE_AT} x={440} y={180} text="The client signs it off" tone="green" after={1300} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 320, y: 380 },
          { t: UP_AT, x: 330, y: 70, click: true },
          { t: CMP_AT, x: 430, y: 70, click: true },
          { t: SLIDE.at, x: 300, y: 250 },
          { t: BACK_AT, x: 430, y: 70, click: true },
          { t: APPROVE_AT, x: 470, y: 196, click: true },
        ]}
      />
    </div>
  );
}
