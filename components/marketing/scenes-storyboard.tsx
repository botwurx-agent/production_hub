"use client";

import type { ReactNode } from "react";
import { Art } from "./scenes-shotlist";
import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, dragAt, easeOut, lerp, ramp, spring, typed } from "./scene-kit";

/*
 * The storyboard page's chapter scenes (640x440, pure functions of t, one
 * labelled action about a second apart). As shipped: a structured frame grid
 * with scene, description, sound and notes per frame; the board's frame shape
 * (16:9, 4:5, 9:16, 1:1) detected on import and changeable; reading a PDF
 * board into frames with its captions split into fields, and a matched shot
 * list; internal then client review; the dark-covered present view and PDF.
 */

function Btn({ children, press, tone = "quiet", on }: { children: ReactNode; press?: boolean; tone?: "accent" | "quiet" | "green"; on?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold"
      style={{
        background: tone === "accent" ? "var(--accent)" : tone === "green" ? "var(--h-green)" : on ? "var(--accent-soft)" : "var(--surface)",
        color: tone === "quiet" ? (on ? "var(--accent)" : "var(--text-muted)") : "white",
        border: tone === "quiet" ? "1px solid var(--border)" : "none",
        transform: `scale(${press ? 0.93 : 1})`,
      }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- GRID */

export const SB_GRID_MS = 13000;

const UP_AT = 900;
const FIELDS = [
  { k: "Scene", v: "1A · The reveal", at: 2100 },
  { k: "Description", v: "Morning light finds the bottle on the counter.", at: 3000 },
  { k: "Sound", v: "VO: Start the day clear.", at: 4600 },
];
const ADD_AT = 6200;
const DRAG = { at: 7400, dur: 1300 };

export function StoryboardGridScene({ t }: { t: number }) {
  const added = t >= ADD_AT;
  const moved = t >= DRAG.at + DRAG.dur;
  // Frame order: the new frame 7 is dragged into slot 2.
  const base = [0, 1, 2, 3, 4, 5];
  const order = moved ? [0, 6, 1, 2, 3, 4, 5] : added ? [...base, 6] : base;
  const slot = (n: number) => ({ x: 240 + (n % 3) * 128, y: 66 + Math.floor(n / 3) * 104 });
  const dragging = t >= DRAG.at && t < DRAG.at + DRAG.dur;
  const d = dragAt(t, DRAG.at, DRAG.dur, slot(6), slot(1));
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Storyboard · Hero spot" sub="Frames in order, every frame with its notes" right={<Chip tone="purple" t={t}>{added ? 7 : 6} frames · 16:9</Chip>}>
        {/* Selected frame's fields */}
        <div className="absolute" style={{ left: 16, top: 66, width: 208 }}>
          <div className="relative h-[117px] overflow-hidden rounded-[8px] border" style={{ borderStyle: t >= UP_AT ? "solid" : "dashed", borderColor: "var(--border)" }}>
            {t >= UP_AT ? <div className="absolute inset-0" style={{ transform: `scale(${0.8 + 0.2 * spring(ramp(t, UP_AT, 420))})` }}><Art i={0} /></div> : <span className="absolute inset-0 grid place-items-center text-[11px] text-text-faint">Upload or pick an image</span>}
            <span className="absolute left-1 top-1 rounded-[4px] bg-surface px-1 text-[9.5px] font-extrabold">1</span>
          </div>
          {FIELDS.map((f) => (
            <div key={f.k} className="mt-2">
              <p className="text-[10px] font-semibold text-text-faint">{f.k}</p>
              <div className="min-h-[26px] rounded-[7px] border px-2 py-1 text-[11.5px] font-semibold" style={{ borderColor: t >= f.at - 200 && t < f.at + 900 ? "var(--accent)" : "var(--border)" }}>
                {typed(f.v, t, f.at, 28)}
              </div>
            </div>
          ))}
          <div className="mt-2">
            <p className="text-[10px] font-semibold text-text-faint">Notes</p>
            <div className="h-[26px] rounded-[7px] border border-border" />
          </div>
        </div>
        {/* The grid */}
        {order.map((f, n) => {
          const isDrag = f === 6 && dragging;
          const p = isDrag ? d : slot(n);
          return (
            <div
              key={f}
              className="absolute"
              style={{
                left: p.x,
                top: p.y,
                width: 118,
                zIndex: isDrag ? 5 : 1,
                transition: isDrag ? undefined : "left .35s cubic-bezier(.34,1.56,.64,1), top .35s cubic-bezier(.34,1.56,.64,1)",
                ...(f === 6 && t < DRAG.at ? arrive(t, ADD_AT, 8) : {}),
              }}
            >
              <div className="relative h-[66px] overflow-hidden rounded-[7px] border border-border" style={{ boxShadow: isDrag ? "0 18px 36px -12px rgba(40,30,90,.55)" : f === 0 ? "0 0 0 2px var(--accent)" : undefined }}>
                {f === 0 && t < UP_AT ? null : <Art i={f === 6 ? 7 : f} />}
                <span className="absolute left-1 top-1 rounded-[4px] bg-surface px-1 text-[9.5px] font-extrabold">{n + 1}</span>
              </div>
              <p className="mt-1 truncate text-[10px] text-text-muted">{f === 0 ? (t >= FIELDS[1].at ? "Morning light finds…" : "") : ["", "The bottle, closer", "The pour", "Splash", "Hand reaches", "End card", "A glance to camera"][f]}</p>
            </div>
          );
        })}
        <div className="absolute" style={{ left: 240, top: 390 }}>
          <Btn on={t >= ADD_AT - 300 && t < ADD_AT + 500} press={t >= ADD_AT - 60 && t < ADD_AT + 80}>+ Add frame</Btn>
        </div>
      </Window>
      <ActionLabel t={t} at={UP_AT} x={120} y={120} text="Drop an image in" />
      <ActionLabel t={t} at={FIELDS[0].at} x={200} y={190} text="Scene, action, sound, notes" tone="purple" after={3300} />
      <ActionLabel t={t} at={DRAG.at} x={500} y={280} text="Drag to reorder, numbers follow" tone="blue" after={1500} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 400, y: 300 },
          { t: UP_AT, x: 120, y: 124, click: true },
          { t: FIELDS[0].at, x: 120, y: 214, click: true },
          { t: FIELDS[1].at, x: 120, y: 256, click: true },
          { t: FIELDS[2].at, x: 120, y: 300, click: true },
          { t: ADD_AT, x: 280, y: 402, click: true },
          { t: DRAG.at, x: slot(6).x + 60, y: slot(6).y + 34, click: true },
          { t: DRAG.at + DRAG.dur, x: slot(1).x + 60, y: slot(1).y + 34 },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- ASPECT */

export const SB_ASPECT_MS = 11500;

const SHAPES = [
  { k: "16:9", r: 16 / 9, at: 0 },
  { k: "4:5", r: 4 / 5, at: 1600 },
  { k: "9:16", r: 9 / 16, at: 3800 },
  { k: "1:1", r: 1, at: 6000 },
  { k: "16:9", r: 16 / 9, at: 8200 },
];

export function StoryboardAspectScene({ t }: { t: number }) {
  const cur = [...SHAPES].reverse().find((s) => t >= s.at)!;
  const prev = SHAPES[Math.max(0, SHAPES.indexOf(cur) - 1)];
  const p = easeOut(ramp(t, cur.at, 500));
  const r = lerp(prev.r, cur.r, p);
  const cellW = 136;
  const cellH = 150;
  const w = r >= cellW / cellH ? cellW : cellH * r;
  const h = r >= cellW / cellH ? cellW / r : cellH;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Storyboard · Hero spot" sub="Frames drawn in the board's own shape" right={<Chip tone="purple" t={t} since={cur.at}>{cur.k}</Chip>}>
        <div className="absolute flex items-center gap-1.5" style={{ left: 16, top: 62 }}>
          <span className="mr-1 text-[11px] font-bold text-text-faint">Frame shape</span>
          {["16:9", "4:5", "9:16", "1:1"].map((k) => (
            <span key={k} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: cur.k === k ? "var(--accent-soft)" : "var(--surface-2)", color: cur.k === k ? "var(--accent)" : "var(--text-muted)" }}>{k}</span>
          ))}
        </div>
        <div className="absolute grid grid-cols-4 gap-3" style={{ left: 16, top: 100, width: 608 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="grid place-items-center" style={{ height: cellH }}>
              <div className="relative overflow-hidden rounded-[7px] border border-border" style={{ width: w, height: h }}>
                <Art i={i} />
                <span className="absolute left-1 top-1 rounded-[4px] bg-surface px-1 text-[9.5px] font-extrabold">{i + 1}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="absolute text-[11px] text-text-faint" style={{ left: 16, bottom: 12 }}>The whole picture is always shown, never cropped to fit the box.</p>
      </Window>
      <ActionLabel t={t} at={SHAPES[1].at} x={150} y={62} text="A 4:5 board for social" tone="pink" after={1400} />
      <ActionLabel t={t} at={SHAPES[2].at} x={190} y={62} text="9:16 for vertical" tone="blue" after={1400} />
      <Cursor
        t={t}
        travel={600}
        path={[
          { t: 800, x: 300, y: 300 },
          { t: SHAPES[1].at, x: 140, y: 74, click: true },
          { t: SHAPES[2].at, x: 180, y: 74, click: true },
          { t: SHAPES[3].at, x: 222, y: 74, click: true },
          { t: SHAPES[4].at, x: 100, y: 74, click: true },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- IMPORT */

export const SB_IMPORT_MS = 13500;

const DROP_AT = 800;
const PANELS_AT = 1800;
const SPLIT_AT = 4200;
const GO_AT = 7400;
const DONE_AT = 8200;
const SHOTS_AT = 9400;

export function StoryboardImportScene({ t }: { t: number }) {
  const done = t >= DONE_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title={done ? "Storyboard · ZELVARA" : "Import a board from PDF"} sub={done ? "16 frames, read off the director's PDF" : "The director's PDF becomes frames"} right={<Chip tone="purple" t={t}>{done ? "Imported" : "Reading"}</Chip>}>
        {!done ? (
          <>
            {/* PDF page with panels */}
            <div className="absolute rounded-[8px] border border-border bg-white p-3 text-[#1a1a2e]" style={{ left: 16, top: 66, width: 288, height: 358, ...arrive(t, 300, 10) }}>
              <p className="text-[8px] font-extrabold tracking-[0.14em] text-[#777]">ZELVARA · BOARD · PAGE 1</p>
              {[0, 1].map((i) => (
                <div key={i} className="mt-3 flex gap-3">
                  <div className="relative h-[92px] w-[140px] shrink-0 overflow-hidden rounded-[3px]" style={{ boxShadow: t >= PANELS_AT + i * 700 ? "0 0 0 3px var(--h-purple)" : undefined, transition: "box-shadow .3s" }}>
                    <Art i={i + 2} />
                    {t >= PANELS_AT + i * 700 ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-white" style={{ background: "var(--h-purple)", transform: `scale(${spring(ramp(t, PANELS_AT + i * 700, 400))})` }}>{i + 1}</span> : null}
                  </div>
                  <div className="text-[7.5px] leading-[1.45]" style={{ background: t >= SPLIT_AT + i * 900 && t < SPLIT_AT + i * 900 + 900 ? "color-mix(in oklch, var(--h-purple) 15%, transparent)" : undefined }}>
                    <p className="font-extrabold">SHOT {i === 0 ? "1A" : "1B"}</p>
                    <p><b>ACTION</b> {i === 0 ? "A glass is set down in morning light." : "The pour begins, slow."}</p>
                    <p><b>CAMERA</b> {i === 0 ? "Slow push in." : "Locked off, side on."}</p>
                    <p><b>VO</b> {i === 0 ? "Start the day clear." : "Nothing added."}</p>
                  </div>
                </div>
              ))}
              <p className="absolute bottom-2 left-3 text-[7.5px] text-[#999]">ZELVARA_board_v2.pdf · 8 pages</p>
            </div>
            {/* What it read */}
            {t >= SPLIT_AT - 300 ? (
              <div className="absolute" style={{ left: 320, top: 66, width: 304, ...arrive(t, SPLIT_AT - 300, 8) }}>
                <p className="text-[12.5px] font-extrabold">16 frames found</p>
                <p className="text-[10.5px] text-text-faint">Each frame's caption split into its own fields.</p>
                {[0, 1].map((i) => (
                  <div key={i} className="mt-2 flex gap-2 rounded-[10px] border border-border p-2" style={arrive(t, SPLIT_AT + i * 900, 6)}>
                    <div className="relative h-[52px] w-[80px] shrink-0 overflow-hidden rounded-[5px]"><Art i={i + 2} /></div>
                    <div className="text-[10.5px] leading-[1.4]">
                      <p><span className="font-bold text-text-faint">Scene</span> {i === 0 ? "1A" : "1B"}</p>
                      <p><span className="font-bold text-text-faint">Action</span> {i === 0 ? "A glass is set down…" : "The pour begins, slow."}</p>
                      <p><span className="font-bold text-text-faint">Sound</span> {i === 0 ? "VO: Start the day clear." : "Nothing added."}</p>
                    </div>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10.5px] text-text-faint">Shape detected: 16:9</span>
                  <Btn tone="accent" press={t >= GO_AT - 60 && t < GO_AT + 80}>Import 16 frames</Btn>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="absolute" style={{ left: 16, top: 66, width: 608, ...arrive(t, DONE_AT, 10) }}>
            <div className="grid grid-cols-4 gap-2.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={arrive(t, DONE_AT + i * 90, 6)}>
                  <div className="relative h-[80px] overflow-hidden rounded-[6px] border border-border"><Art i={i + 2} /><span className="absolute left-1 top-1 rounded-[4px] bg-surface px-1 text-[9.5px] font-extrabold">{i + 1}</span></div>
                  <p className="mt-0.5 truncate text-[10px] text-text-muted">1{String.fromCharCode(65 + (i % 4))} · {["The glass", "The pour", "The splash", "End card"][i % 4]}</p>
                </div>
              ))}
            </div>
            {t >= SHOTS_AT ? (
              <div className="mt-3 flex items-center gap-2 rounded-[10px] px-3 py-2 text-[11.5px] font-semibold" style={{ background: "var(--h-blue-bg)", color: "var(--h-blue)", ...arrive(t, SHOTS_AT, 8) }}>
                Also made the shot list: 16 rows, each with its frame matched by shot number.
              </div>
            ) : null}
          </div>
        )}
        <Burst t={t} at={DONE_AT} x={560} y={26} />
      </Window>
      <ActionLabel t={t} at={DROP_AT} x={140} y={120} text="Drop in the board" after={700} />
      <ActionLabel t={t} at={PANELS_AT + 200} x={160} y={200} text="It finds each frame" tone="purple" after={1200} />
      <ActionLabel t={t} at={SPLIT_AT + 300} x={330} y={200} text="And files each caption in its field" tone="blue" after={1500} />
      <ActionLabel t={t} at={SHOTS_AT} x={300} y={300} text="A shot list comes with it" tone="green" after={2000} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 500, y: 380 },
          { t: DROP_AT, x: 160, y: 200, click: true },
          { t: GO_AT, x: 570, y: 316, click: true },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- REVIEW */

export const SB_REVIEW_MS = 13000;

const SEND_AT = 800;
const TEAM_PIN = 2400;
const GREEN_AT = 4200;
const SHARE_AT = 5600;
const CLIENT_PIN = 7200;
const APPROVE_AT = 9400;

export function StoryboardReviewScene({ t }: { t: number }) {
  const client = t >= SHARE_AT + 700;
  const approved = t >= APPROVE_AT;
  const pins = [
    { n: 1, x: 200, y: 150, at: TEAM_PIN, who: "Sam Ortiz", role: "1st AD", hue: "green", text: "Frame 2 needs a second setup.", internal: true },
    { n: 2, x: 440, y: 150, at: CLIENT_PIN, who: "Maya Torres", role: "Client", hue: "pink", text: "Love frame 3. Keep this light.", internal: false },
  ];
  const visible = pins.filter((p) => t >= p.at && (client ? true : p.internal));
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title={client ? "studio-flows.com/r/… · Storyboard review" : "Storyboard · Hero spot"}
        sub={client ? "Maya at Bright Water · no login" : "Your team first, then the client"}
        right={
          approved ? (
            <Chip tone="green" t={t} since={APPROVE_AT}>Client approved</Chip>
          ) : t >= GREEN_AT ? (
            <Chip tone="green" t={t} since={GREEN_AT}>Greenlit by the team</Chip>
          ) : t >= SEND_AT ? (
            <Chip tone="amber" t={t} since={SEND_AT}>In review</Chip>
          ) : (
            <Btn on press={t >= SEND_AT - 60}>Send to review</Btn>
          )
        }
      >
        <div className="absolute grid grid-cols-3 gap-3" style={{ left: 16, top: 70, width: 400 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="relative h-[70px] overflow-hidden rounded-[6px] border border-border"><Art i={i} /><span className="absolute left-1 top-1 rounded-[4px] bg-surface px-1 text-[9.5px] font-extrabold">{i + 1}</span></div>
          ))}
        </div>
        {visible.map((p) => (
          <span key={p.n} className="absolute grid h-7 w-7 place-items-center rounded-full text-[12px] font-black text-white" style={{ left: (p.n === 1 ? 190 : 330) - 14, top: 100 - 14, transform: `scale(${spring(ramp(t, p.at, 480))})`, background: approved || (p.internal && t >= GREEN_AT) ? "var(--h-green)" : "var(--accent)", boxShadow: "0 0 0 3px white, 0 6px 14px -4px rgba(20,15,60,.45)" }}>
            {p.n}
          </span>
        ))}
        <div className="absolute space-y-2" style={{ left: 432, top: 66, width: 192 }}>
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">{client ? "Comments" : "Team notes"}</p>
          {visible.map((p) => (
            <div key={p.n} className="rounded-[10px] border border-border bg-surface p-2" style={arrive(t, p.at + 60, 6)}>
              <div className="flex items-center gap-1.5">
                <Avatar name={p.who} hue={p.hue} size={18} />
                <span className="text-[11.5px] font-bold">{p.who.split(" ")[0]}</span>
                <span className="text-[10px] text-text-faint">{p.role}</span>
              </div>
              <p className="mt-1 text-[11.5px] text-text-muted">{typed(p.text, t, p.at + 250, 22)}</p>
            </div>
          ))}
          {!client && t >= GREEN_AT - 500 ? (
            <div style={arrive(t, GREEN_AT - 500, 4)}>
              <Btn tone="green" press={t >= GREEN_AT - 60 && t < GREEN_AT + 80}>{t >= GREEN_AT ? "Greenlit ✓" : "Greenlight"}</Btn>
              {t >= GREEN_AT ? <span className="ml-1.5"><Btn on press={t >= SHARE_AT - 60 && t < SHARE_AT + 80}>Share with client</Btn></span> : null}
            </div>
          ) : null}
          {client ? (
            <div className="pt-1" style={arrive(t, SHARE_AT + 700, 4)}>
              <Btn tone="green" press={t >= APPROVE_AT - 60 && t < APPROVE_AT + 120}>{approved ? "Approved ✓" : "Approve"}</Btn>
              <span className="ml-1.5"><Btn>Request changes</Btn></span>
            </div>
          ) : null}
        </div>
        {!client ? <p className="absolute text-[10.5px] text-text-faint" style={{ left: 16, top: 250, width: 400 }}>Team notes stay internal. The client sees the board once it is greenlit and shared.</p> : null}
        <Burst t={t} at={APPROVE_AT} x={480} y={210} spread={1.3} />
      </Window>
      <ActionLabel t={t} at={SEND_AT} x={560} y={20} text="Send it to your team first" />
      <ActionLabel t={t} at={GREEN_AT} x={440} y={190} text="The team greenlights it" tone="green" />
      <ActionLabel t={t} at={SHARE_AT} x={520} y={200} text="Then the client gets a link" tone="blue" />
      <ActionLabel t={t} at={APPROVE_AT} x={440} y={210} text="And signs it off" tone="green" after={1300} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 320, y: 380 },
          { t: SEND_AT, x: 580, y: 26, click: true },
          { t: TEAM_PIN, x: 192, y: 102, click: true },
          { t: GREEN_AT, x: 470, y: 212, click: true },
          { t: SHARE_AT, x: 560, y: 212, click: true },
          { t: CLIENT_PIN, x: 332, y: 102, click: true },
          { t: APPROVE_AT, x: 470, y: 222, click: true },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- EXPORT */

export const SB_EXPORT_MS = 12000;

const PRESENT_AT = 700;
const PAGE_AT = 3200;
const EMAIL_AT = 6400;
const SENT_AT = 8600;

export function StoryboardExportScene({ t }: { t: number }) {
  const page = t >= PAGE_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Present · Storyboard" sub="Looks like it came from a studio, because it did" right={<span className="flex gap-1.5"><Btn>PDF</Btn><Btn on={t >= EMAIL_AT - 300} press={t >= EMAIL_AT - 60 && t < EMAIL_AT + 80}>Email</Btn></span>}>
        <div className="absolute overflow-hidden rounded-[6px] border border-border shadow-[0_24px_60px_-20px_rgba(20,15,50,.5)]" style={{ left: 60, top: 62, width: 520, height: 364, ...arrive(t, PRESENT_AT, 14) }}>
          {!page ? (
            <div className="absolute inset-0 p-8 text-white" style={{ background: "linear-gradient(160deg, #16162a, #23233f)" }}>
              <p className="text-[9px] font-extrabold tracking-[0.2em] text-[#9d9dc0]">STORYBOARD</p>
              <p className="mt-2 text-[30px] font-extrabold leading-tight">Bright Water<br />Hero spot</p>
              <div className="mt-8 grid grid-cols-2 gap-y-2 text-[10px]">
                {[
                  ["Client", "Bright Water"],
                  ["Agency", "Northfield & Co"],
                  ["Director", "Dana Reyes"],
                  ["Job no.", "BW-0412"],
                ].map(([k, v]) => (
                  <p key={k}><span className="text-[#8a8aa8]">{k}</span><br /><b>{v}</b></p>
                ))}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-white p-4 text-[#1a1a2e]" style={arrive(t, PAGE_AT, 10)}>
              <div className="grid grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="relative h-[108px] overflow-hidden rounded-[4px]"><Art i={i} /><span className="absolute left-1.5 top-1.5 rounded-[3px] bg-white px-1 text-[9px] font-extrabold text-[#1a1a2e]">{i + 1}</span></div>
                    <p className="mt-1 text-[8px] font-extrabold tracking-[0.1em] text-[#8a8aa8]">SHOT</p>
                    <p className="text-[9.5px]">{["Morning light finds the bottle.", "The bottle, closer.", "The pour, from the side.", "Splash, high speed."][i]}</p>
                    <p className="mt-0.5 text-[8px] font-extrabold tracking-[0.1em] text-[#8a8aa8]">SOUND</p>
                    <p className="text-[9.5px]">{["VO: Start the day clear.", "Room tone.", "The pour, close mic.", "Music hits."][i]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {t >= EMAIL_AT ? (
          <div className="absolute rounded-[14px] border border-border bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(40,30,90,.55)]" style={{ left: 160, top: 140, width: 320, ...arrive(t, EMAIL_AT, 12) }}>
            <p className="text-[13px] font-extrabold">Email the storyboard</p>
            <div className="mt-2 space-y-1.5 text-[11.5px]">
              <p className="rounded-[7px] border border-border px-2 py-1">maya@brightwater.co</p>
              <p className="rounded-[7px] border border-border px-2 py-1">Respond by <b>Fri, Oct 7</b></p>
            </div>
            <div className="mt-2 flex justify-end"><Btn tone="accent" press={t >= SENT_AT - 60 && t < SENT_AT + 80}>{t >= SENT_AT ? "Sent ✓" : "Send"}</Btn></div>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={PRESENT_AT + 400} x={100} y={140} text="A proper cover, from the job block" tone="indigo" after={1500} />
      <ActionLabel t={t} at={PAGE_AT} x={300} y={250} text="Two frames a page, readable in print" tone="purple" after={1500} />
      <ActionLabel t={t} at={SENT_AT} x={420} y={250} text="Email it with a review link" tone="green" after={1300} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 2600, x: 560, y: 380 },
          { t: EMAIL_AT, x: 585, y: 26, click: true },
          { t: SENT_AT, x: 450, y: 240, click: true },
        ]}
      />
    </div>
  );
}
