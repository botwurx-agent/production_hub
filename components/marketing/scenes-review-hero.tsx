"use client";

import type { ReactNode } from "react";
import { ActionLabel, Burst, Chip, Cursor, Window, arrive, clamp01, easeInOut, easeOut, lerp, ramp, spring, typed } from "./scene-kit";

/*
 * The home hero's client review: the CLIENT's side of a video review, showing
 * the ways they can leave a note, one after another. Every one is shipped:
 * a comment pinned to the exact frame (timecode), drawing on the frame, a
 * range comment over a stretch of the cut, a voice note, and a one-click
 * approval on a link with no login.
 */

export const REVIEW_HERO_MS = 23000;

const FPS = 24;
const CLIP = 15; // seconds in the cut
const VX = 16;
const VY = 64;
const VW = 400;
const VH = 225;
const BAR_Y = 318;

// Paced to be read, not skimmed: each beat holds long enough to see what
// happened before the next one starts.
const TYPE = 55; // ms per character
const TRAVEL = 750; // ms for the pointer to cross between stops
const PAUSE_AT = 1400;
const C1 = { at: 1800, post: 4400, text: "Hold on the pour a beat longer." };
const DRAW_TOOL = 5200;
const ARROW = [5700, 6800];
const RING = [6900, 7900];
const C2 = { at: 8100, post: 9700, text: "Make the logo bigger here." };
const SCRUB = [10300, 11000];
const OUT = [11400, 12300];
const C3 = { at: 12400, post: 14300, text: "This stretch drags. Trim 2s." };
const MIC = 15000;
const REC_END = 17400;
const C4 = { post: 17900 };
const PLAY_VOICE = 18400;
const VOICE_LEN = 2000;
const APPROVE_AT = 20600;

/*
 * The shot: a hand pours from the bottle into the glass. The bottle is drawn
 * upright in its own coordinates (mouth at 0,0, body running down +y) and
 * placed by POUR, so the label the client circles is always where the
 * drawing points.
 */
const POUR = { x: 252, y: 108, angle: 127 };
const LABEL = { x: 211, y: 77 }; // the label's centre in frame coordinates

const sx = (s: number) => VX + (VW * s) / CLIP;

function tc(s: number) {
  const f = Math.round(s * FPS);
  const ss = Math.floor(f / FPS);
  const ff = f % FPS;
  const p = (n: number) => String(n).padStart(2, "0");
  return `00:00:${p(ss)}:${p(ff)}`;
}
const short = (s: number) => {
  const f = Math.round(s * FPS);
  return `${String(Math.floor(f / FPS)).padStart(2, "0")}:${String(f % FPS).padStart(2, "0")}`;
};

/** Where the playhead is, in seconds of the cut. */
function playhead(t: number) {
  if (t < PAUSE_AT) return 2 + (t / PAUSE_AT) * 2.5;
  if (t < SCRUB[0]) return 4.5;
  if (t < SCRUB[1] + 1) return lerp(4.5, 7, easeInOut(ramp(t, SCRUB[0], SCRUB[1] - SCRUB[0])));
  if (t < OUT[0]) return 7;
  if (t < MIC) return lerp(7, 10, easeInOut(ramp(t, OUT[0], OUT[1] - OUT[0])));
  return 10;
}

/** The cut: a bottle pouring into a glass, the level rising as it plays. */
function Frame({ s }: { s: number }) {
  const level = clamp01(s / CLIP);
  const glassTop = 150;
  const glassBottom = 205;
  const fillY = lerp(glassBottom - 4, glassTop + 8, level);
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="rh-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--h-cyan-bg)" />
          <stop offset="1" stopColor="var(--h-blue-bg)" />
        </linearGradient>
      </defs>
      <rect width={VW} height={VH} fill="url(#rh-bg)" />
      <ellipse cx="200" cy="212" rx="190" ry="16" fill="var(--surface)" opacity=".7" />
      {/* the arm, coming in from the left edge */}
      <path d="M-20 150 Q90 120 176 66" stroke="var(--h-indigo)" strokeWidth="30" strokeLinecap="round" fill="none" opacity=".85" />
      <path d="M150 80 L182 62" stroke="color-mix(in oklch, var(--h-orange) 35%, var(--surface))" strokeWidth="22" strokeLinecap="round" fill="none" />
      {/* the bottle, held and tipped over the glass */}
      <g transform={`translate(${POUR.x} ${POUR.y}) rotate(${POUR.angle})`}>
        <rect x="-8" y="-2" width="16" height="22" rx="3" fill="var(--h-blue)" opacity=".9" />
        <path d="M-8 20 q-12 6 -14 18 v66 q0 8 8 8 h28 q8 0 8 -8 v-66 q-2 -12 -14 -18z" fill="var(--h-blue)" opacity=".9" />
        <rect x="-20" y="40" width="40" height="30" rx="4" fill="var(--surface)" />
        <rect x="-13" y="48" width="26" height="6" rx="3" fill="var(--h-indigo)" />
        <rect x="-10" y="59" width="20" height="3.5" rx="1.75" fill="var(--text-faint)" />
        {/* the hand round the lower body: palm on one side, fingers wrapping the other */}
        <rect x="-25" y="78" width="12" height="28" rx="6" fill="color-mix(in oklch, var(--h-orange) 35%, var(--surface))" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="13" y={78 + i * 7.5} width="12" height="7" rx="3.5" fill="color-mix(in oklch, var(--h-orange) 38%, var(--surface))" stroke="color-mix(in oklch, var(--h-orange) 50%, var(--surface))" strokeWidth="0.8" />
        ))}
        <rect x="-16" y="76" width="32" height="10" rx="5" fill="color-mix(in oklch, var(--h-orange) 32%, var(--surface))" />
      </g>
      {/* the pour, falling from the mouth into the glass */}
      <path d={`M${POUR.x + 4} ${POUR.y + 2} Q${POUR.x + 12} ${POUR.y + 14} ${POUR.x + 12} ${fillY}`} stroke="var(--h-amber)" strokeWidth="5" fill="none" opacity=".75" strokeLinecap="round" />
      {/* glass */}
      <path d={`M240 ${glassTop} h56 l-6 ${glassBottom - glassTop} h-44z`} fill="var(--surface)" opacity=".75" stroke="var(--h-cyan)" strokeWidth="2" />
      <path d={`M${242 + (fillY - glassTop) * 0.1} ${fillY} h${52 - (fillY - glassTop) * 0.2} l-${Math.max(0, (glassBottom - fillY) * 0.1)} ${glassBottom - fillY - 2} h-${Math.max(0, 44 - 2)}z`} fill="var(--h-amber)" opacity=".6" />
      {/* bubbles rise with the cut */}
      {[0, 1, 2, 3].map((i) => {
        const y = glassBottom - 8 - (((s * 30 + i * 13) % 40) * (glassBottom - fillY)) / 40;
        return y > fillY ? <circle key={i} cx={252 + i * 9} cy={y} r={2} fill="white" opacity=".8" /> : null;
      })}
    </svg>
  );
}

function Tool({ on, children, label }: { on?: boolean; children: ReactNode; label: string }) {
  return (
    <span
      className="inline-flex h-[24px] items-center gap-1 rounded-[7px] border px-1.5 text-[10.5px] font-bold"
      style={{
        borderColor: on ? "var(--accent)" : "var(--border)",
        background: on ? "var(--accent-soft)" : "var(--surface)",
        color: on ? "var(--accent)" : "var(--text-muted)",
      }}
    >
      {children}
      {label}
    </span>
  );
}

const ico = (d: ReactNode) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const PEN = ico(<path d="M4 20l4-1 11-11-3-3L5 16z" />);
const RANGE = ico(<><path d="M4 6v12M20 6v12" /><path d="M8 12h8" /></>);
const MICI = ico(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>);
const CLOCK = ico(<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>);

/** A voice note's bars: live while recording, then a fixed shape that fills as it plays. */
function Wave({ t, n, live, progress = 0, h = 16 }: { t: number; n: number; live?: boolean; progress?: number; h?: number }) {
  return (
    <span className="inline-flex items-center gap-[2px]" style={{ height: h }}>
      {Array.from({ length: n }).map((_, i) => {
        const base = 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6));
        const v = live ? 0.25 + 0.75 * Math.abs(Math.sin(t / 90 + i * 0.9)) * base : base;
        return (
          <span
            key={i}
            className="w-[2px] rounded-full"
            style={{ height: Math.max(3, v * h), background: i / n < progress ? "var(--accent)" : live ? "var(--h-red)" : "var(--text-faint)" }}
          />
        );
      })}
    </span>
  );
}

type Note = { at: number; n: number; when: string; text?: string; badge?: ReactNode; voice?: boolean };

export function ReviewHeroScene({ t }: { t: number }) {
  const s = playhead(t);
  const playing = t < PAUSE_AT;
  const approved = t >= APPROVE_AT;
  const drawMode = t >= DRAW_TOOL && t < C2.post;
  const rangeMode = t >= SCRUB[1] && t < C3.post;
  const recording = t >= MIC && t < REC_END;
  const voiceDraft = t >= REC_END && t < C4.post;
  const recSecs = Math.min(6, Math.floor((t - MIC) / 400));

  // The composer: whatever is being written right now.
  let draft = "";
  let draftAt = "";
  if (t >= C1.at && t < C1.post) [draft, draftAt] = [typed(C1.text, t, C1.at + 200, TYPE), tc(4.5)];
  else if (t >= C2.at && t < C2.post) [draft, draftAt] = [typed(C2.text, t, C2.at, TYPE), tc(4.5)];
  else if (t >= C3.at && t < C3.post) [draft, draftAt] = [typed(C3.text, t, C3.at, TYPE), `${tc(7)} to ${tc(10)}`];
  else if (recording || voiceDraft) draftAt = tc(10);
  else draftAt = tc(s);

  const notes: Note[] = [
    { at: C1.post, n: 1, when: short(4.5), text: C1.text },
    { at: C2.post, n: 2, when: short(4.5), text: C2.text, badge: <span style={{ color: "var(--h-red)" }}>{PEN}</span> },
    { at: C3.post, n: 3, when: `${short(7)}–${short(10)}`, text: C3.text },
    { at: C4.post, n: 4, when: short(10), voice: true },
  ];

  const arrowP = easeOut(ramp(t, ARROW[0], ARROW[1] - ARROW[0]));
  const ringP = easeInOut(ramp(t, RING[0], RING[1] - RING[0]));
  // The drawing shows while being made and again whenever the playhead sits on its frame.
  const showDraw = t >= ARROW[0] && s < 4.6;
  const outP = ramp(t, OUT[0], OUT[1] - OUT[0]);

  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="Hero spot · v3 cut"
        sub="Shared with Maya at Bright Water · no login"
        right={approved ? <Chip tone="green" t={t} since={APPROVE_AT}>Approved</Chip> : <Chip tone="amber" t={t}>In review</Chip>}
      >
        {/* Player */}
        <div className="absolute overflow-hidden rounded-[12px]" style={{ left: VX, top: VY, width: VW, height: VH }}>
          <Frame s={s} />
          {showDraw ? (
            <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
              <path d={`M330 30 L${LABEL.x + 15} ${LABEL.y - 3}`} pathLength={1} stroke="var(--h-red)" strokeWidth="4" strokeLinecap="round" fill="none" strokeDasharray="1" strokeDashoffset={1 - arrowP} />
              {arrowP > 0.95 ? <path d={`M${LABEL.x + 15} ${LABEL.y - 3} l17 2 M${LABEL.x + 15} ${LABEL.y - 3} l10 -14`} stroke="var(--h-red)" strokeWidth="4" strokeLinecap="round" fill="none" /> : null}
              <ellipse cx={LABEL.x} cy={LABEL.y} rx="30" ry="23" transform={`rotate(37 ${LABEL.x} ${LABEL.y})`} pathLength={1} stroke="var(--h-red)" strokeWidth="4" fill="none" strokeDasharray="1" strokeDashoffset={1 - ringP} />
            </svg>
          ) : null}
          {drawMode && t < C2.at ? (
            <div className="absolute flex gap-1 rounded-[9px] bg-surface p-1 shadow-[0_8px_20px_-8px_rgba(20,15,60,.5)]" style={{ right: 8, top: 8, ...arrive(t, DRAW_TOOL, 6) }}>
              {["Arrow", "Circle", "Pen"].map((k, i) => (
                <span key={k} className="rounded-[6px] px-1.5 py-0.5 text-[10px] font-bold" style={{ background: i === (t < RING[0] ? 0 : 1) ? "var(--h-red-bg)" : undefined, color: i === (t < RING[0] ? 0 : 1) ? "var(--h-red)" : "var(--text-muted)" }}>
                  {k}
                </span>
              ))}
              {["red", "amber", "blue"].map((h) => (
                <span key={h} className="h-4 w-4 rounded-full" style={{ background: `var(--h-${h})`, boxShadow: h === "red" ? "0 0 0 2px var(--surface), 0 0 0 3px var(--h-red)" : undefined }} />
              ))}
            </div>
          ) : null}
          {/* play state */}
          <span className="absolute bottom-2 left-2 rounded-[6px] bg-black/55 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-white">
            {playing ? "▶" : "❚❚"} {tc(s)}
          </span>
        </div>

        {/* Scrubber with markers */}
        <div className="absolute rounded-full bg-surface-2" style={{ left: VX, top: BAR_Y, width: VW, height: 6 }} />
        <div className="absolute rounded-full" style={{ left: VX, top: BAR_Y, width: sx(s) - VX, height: 6, background: "var(--accent)" }} />
        {/* range being set, then kept */}
        {t >= SCRUB[1] ? (
          <div
            className="absolute rounded-full"
            style={{ left: sx(7), top: BAR_Y - 3, width: sx(t >= OUT[1] ? 10 : lerp(7, 10, easeInOut(outP))) - sx(7), height: 12, background: "color-mix(in oklch, var(--h-purple) 40%, transparent)", border: "1.5px solid var(--h-purple)" }}
          />
        ) : null}
        {notes.map((no) => {
          if (t < no.at) return null;
          const p = spring(ramp(t, no.at, 420));
          const x = no.n === 3 ? sx(7) : sx(no.n === 4 ? 10 : 4.5) + (no.n === 2 ? 20 : 0);
          return (
            <span
              key={no.n}
              className="absolute grid h-[18px] w-[18px] place-items-center rounded-full text-[9.5px] font-black text-white"
              style={{ left: x - 9, top: BAR_Y - 22, transform: `scale(${p})`, background: no.voice ? "var(--h-pink)" : no.n === 2 ? "var(--h-red)" : no.n === 3 ? "var(--h-purple)" : "var(--accent)", boxShadow: "0 0 0 2px var(--surface)" }}
            >
              {no.n}
            </span>
          );
        })}
        <span className="absolute h-[16px] w-[3px] rounded-full bg-text" style={{ left: sx(s) - 1.5, top: BAR_Y - 5 }} />

        {/* Composer */}
        <div className="absolute rounded-[11px] border bg-surface" style={{ left: VX, top: 340, width: VW, height: 86, borderColor: draft || recording ? "var(--accent)" : "var(--border)" }}>
          <div className="flex items-center gap-1.5 px-2.5 pt-2 text-[10px] font-bold" style={{ color: "var(--accent)" }}>
            {CLOCK}
            <span className="font-mono">{draftAt}</span>
          </div>
          <div className="flex h-[26px] items-center px-2.5 text-[12px]">
            {recording ? (
              <span className="flex items-center gap-2 font-bold" style={{ color: "var(--h-red)" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--h-red)", opacity: 0.5 + 0.5 * Math.sin(t / 120) }} />
                0:0{recSecs}
                <Wave t={t} n={26} live />
              </span>
            ) : voiceDraft ? (
              <span className="flex items-center gap-2 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--h-pink-bg)", color: "var(--h-pink)", ...arrive(t, REC_END, 4) }}>
                ▶ <Wave t={t} n={18} /> 0:06
              </span>
            ) : draft ? (
              <span className="font-semibold">{draft}</span>
            ) : (
              <span className="text-text-faint">Leave a note at this frame</span>
            )}
          </div>
          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center gap-1">
            <Tool on={drawMode} label="Draw">{PEN}</Tool>
            <Tool on={rangeMode} label="Range">{RANGE}</Tool>
            <Tool on={recording || voiceDraft} label={recording ? "Stop" : "Voice"}>{MICI}</Tool>
            <Tool label="😊">{null}</Tool>
            <span
              className="ml-auto rounded-[7px] px-3 py-1 text-[11px] font-extrabold text-white"
              style={{ background: "var(--accent)", transform: [C1.post, C2.post, C3.post, C4.post].some((a) => t >= a - 80 && t < a + 100) ? "scale(.93)" : undefined }}
            >
              Post
            </span>
          </div>
        </div>

        {/* Comment rail */}
        <div className="absolute" style={{ left: 432, top: 64, width: 192, height: 362 }}>
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-faint">
            Notes · {notes.filter((no) => t >= no.at).length}
          </p>
          <div className="mt-1.5 space-y-1.5">
            {notes.map((no) =>
              t >= no.at ? (
                <div
                  key={no.n}
                  className="rounded-[10px] border border-border bg-surface px-2 py-1.5"
                  style={{ ...arrive(t, no.at + 40, 8), boxShadow: t < no.at + 1200 ? "0 0 0 2px color-mix(in oklch, var(--accent) 30%, transparent)" : undefined }}
                >
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="font-bold text-text">Maya</span>
                    <span className="rounded-[5px] px-1 font-mono font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{no.when}</span>
                    {no.badge}
                    {no.voice ? <span style={{ color: "var(--h-pink)" }}>{MICI}</span> : null}
                  </div>
                  {no.voice ? (
                    <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-bold" style={{ color: "var(--h-pink)" }}>
                      <span className="grid h-5 w-5 place-items-center rounded-full text-[9px] text-white" style={{ background: "var(--h-pink)" }}>{t >= PLAY_VOICE && t < PLAY_VOICE + VOICE_LEN ? "❚❚" : "▶"}</span>
                      <Wave t={t} n={20} progress={ramp(t, PLAY_VOICE, VOICE_LEN)} h={14} />
                      0:06
                    </div>
                  ) : (
                    <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{no.text}</p>
                  )}
                </div>
              ) : null,
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex gap-1.5">
            <span className="flex-1 rounded-[9px] py-2 text-center text-[11.5px] font-extrabold text-white" style={{ background: "var(--h-green)", transform: t >= APPROVE_AT - 60 && t < APPROVE_AT + 160 ? "scale(.94)" : undefined }}>
              {approved ? "Approved ✓" : "Approve"}
            </span>
            <span className="flex-1 rounded-[9px] border border-border py-2 text-center text-[11px] font-bold text-text-muted">Changes</span>
          </div>
          <Burst t={t} at={APPROVE_AT} x={46} y={344} spread={1.4} />
        </div>
      </Window>

      <ActionLabel t={t} at={C1.at} x={150} y={330} text="Comment on the exact frame" before={800} after={2200} />
      <ActionLabel t={t} at={ARROW[0]} x={24} y={196} text="Draw right on the frame" tone="red" before={800} after={2200} />
      <ActionLabel t={t} at={OUT[0]} x={210} y={262} text="Mark a whole stretch" tone="purple" before={800} after={2200} />
      <ActionLabel t={t} at={MIC} x={250} y={330} text="Or just say it" tone="pink" before={800} after={2200} />
      <ActionLabel t={t} at={APPROVE_AT} x={612} y={350} text="Approve. No login." tone="green" before={800} after={2200} />
      <Cursor
        t={t}
        travel={TRAVEL}
        path={[
          { t: 400, x: 200, y: 200 },
          { t: PAUSE_AT, x: 200, y: 180, click: true },
          { t: C1.post, x: 392, y: 414, click: true },
          { t: DRAW_TOOL, x: 44, y: 412, click: true },
          { t: ARROW[0], x: VX + 330, y: VY + 30 },
          { t: ARROW[1], x: VX + LABEL.x + 15, y: VY + LABEL.y - 3 },
          { t: RING[0], x: VX + LABEL.x + 2, y: VY + LABEL.y - 24 },
          { t: RING[1], x: VX + LABEL.x + 6, y: VY + LABEL.y - 22 },
          { t: C2.post, x: 392, y: 414, click: true },
          { t: SCRUB[0], x: sx(4.5), y: BAR_Y + 3, click: true },
          { t: SCRUB[1], x: sx(7), y: BAR_Y + 3 },
          { t: OUT[0], x: 96, y: 412, click: true },
          { t: C3.post, x: 392, y: 414, click: true },
          { t: MIC, x: 150, y: 412, click: true },
          { t: REC_END, x: 150, y: 412, click: true },
          { t: C4.post, x: 392, y: 414, click: true },
          { t: PLAY_VOICE, x: 450, y: 316, click: true },
          { t: APPROVE_AT, x: 478, y: 410, click: true },
        ]}
      />
    </div>
  );
}
