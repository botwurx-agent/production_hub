"use client";

import type { ReactNode } from "react";
import { Art } from "./scenes-shotlist";
import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, dragAt, ramp, spring, typed } from "./scene-kit";

/*
 * The shooting schedule page's chapter scenes (640x440, pure functions of t).
 * As shipped (CLAUDE.md, "Schedule builder"): rows by kind with durations that
 * cascade into times, shots attached as thumbnails, talent and crew off the
 * roster, a board of every day with the stripboard's INT/EXT colours and day
 * kinds (a prelight is named, not numbered), the build-from-shot-lists dialog
 * that previews each day's wrap, and the PDF / review with frames on the rows.
 */

const KIND_HUE: Record<string, string> = { call: "indigo", setup: "blue", shot: "green", meal: "amber", move: "orange", note: "purple", wrap: "indigo" };

function Btn({ children, press, tone = "quiet", on }: { children: ReactNode; press?: boolean; tone?: "accent" | "quiet"; on?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold"
      style={{
        background: tone === "accent" ? "var(--accent)" : on ? "var(--accent-soft)" : "var(--surface)",
        color: tone === "accent" ? "white" : on ? "var(--accent)" : "var(--text-muted)",
        border: tone === "accent" ? "none" : "1px solid var(--border)",
        transform: `scale(${press ? 0.93 : 1})`,
      }}
    >
      {children}
    </span>
  );
}

const clock = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/* ---------------------------------------------------------------- BUILD A DAY */

export const SC_DAY_MS = 13000;

const ADD = { at: 900, kind: "shot" };
const TITLE_AT = 1700;
const SHOTS_AT = 3000;
const TALENT_AT = 4600;
const CREW_AT = 5600;
const DUR_AT = 7000;
const SAVE_AT = 8400;

export function ScheduleDayScene({ t }: { t: number }) {
  const saved = t >= SAVE_AT;
  const dur = t >= DUR_AT ? 90 : 60;
  const rows = [
    { k: "call", title: "Crew call", d: 30 },
    { k: "setup", title: "Set up the kitchen", d: 60 },
    { k: "shot", title: "Kitchen hero", d: 90, shots: [0, 1], talent: "Rae Morgan" },
    ...(saved ? [{ k: "shot", title: "The pour", d: dur, shots: [2, 3], talent: "Rae Morgan", fresh: true }] : []),
  ];
  let m = 7 * 60;
  const times = rows.map((r) => {
    const s = m;
    m += r.d;
    return s;
  });
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Schedule · Day 1 · Thu, Oct 6" sub="Stage 2, Culver City · call 7:00 AM" right={<Chip tone="green" t={t}>Wrap target 6:00 PM</Chip>}>
        <div className="absolute flex text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-faint" style={{ left: 24, top: 64, width: 592 }}>
          <span className="w-[68px]">Time</span>
          <span className="flex-1">What</span>
          <span className="w-[110px]">Talent</span>
          <span className="w-[56px] text-right">Length</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.title}
            className="absolute flex items-center gap-2 border-b border-border px-2"
            style={{ left: 16, top: 82 + i * 50, width: 608, height: 50, ...(r.fresh ? arrive(t, SAVE_AT, 8) : {}), background: r.fresh && t < SAVE_AT + 1200 ? "color-mix(in oklch, var(--accent) 7%, transparent)" : undefined }}
          >
            <span className="w-[68px] text-[12px] font-bold tabular-nums text-text-muted">{clock(times[i])}</span>
            <span className="h-8 w-1 rounded-full" style={{ background: `var(--h-${KIND_HUE[r.k]})` }} />
            <div className="flex-1">
              <p className="text-[12.5px] font-bold">{r.title}</p>
              {r.shots ? (
                <div className="mt-0.5 flex gap-1">
                  {r.shots.map((s) => (
                    <span key={s} className="relative h-[18px] w-[30px] overflow-hidden rounded-[3px]"><Art i={s} /></span>
                  ))}
                </div>
              ) : null}
            </div>
            <span className="flex w-[110px] items-center gap-1.5 text-[11px] font-semibold">{r.talent ? <><Avatar name={r.talent} hue="pink" size={18} />{r.talent}</> : null}</span>
            <span className="w-[56px] text-right text-[11.5px] font-bold tabular-nums">{r.d >= 60 ? `${Math.floor(r.d / 60)}h${r.d % 60 ? ` ${r.d % 60}m` : ""}` : `${r.d}m`}</span>
          </div>
        ))}
        {/* Add bar */}
        <div className="absolute flex items-center gap-1.5" style={{ left: 16, top: 82 + rows.length * 50 + 10 }}>
          <span className="text-[10.5px] font-bold text-text-faint">Add</span>
          {Object.keys(KIND_HUE).map((k) => (
            <span key={k} className="flex items-center gap-1 rounded-[7px] border border-border px-1.5 py-0.5 text-[10.5px] font-bold capitalize" style={{ background: k === ADD.kind && t >= ADD.at - 300 && t < ADD.at + 400 ? "var(--accent-soft)" : undefined }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--h-${KIND_HUE[k]})` }} />
              {k}
            </span>
          ))}
        </div>
        {/* Row modal */}
        {t >= ADD.at && !saved ? (
          <div className="absolute rounded-[16px] border border-border bg-surface p-4 shadow-[0_28px_70px_-24px_rgba(40,30,90,.6)]" style={{ left: 60, top: 70, width: 520, ...arrive(t, ADD.at, 12) }}>
            <p className="flex items-center gap-2 font-display text-[14px] font-extrabold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--h-green)" }} />New shot row</p>
            <div className="mt-2 grid grid-cols-[1fr_90px] gap-3">
              <div>
                <p className="text-[10.5px] font-semibold text-text-faint">What</p>
                <div className="mt-0.5 h-[28px] rounded-[7px] border px-2 text-[12px] font-semibold leading-[26px]" style={{ borderColor: t >= TITLE_AT - 200 && t < SHOTS_AT ? "var(--accent)" : "var(--border)" }}>{typed("The pour", t, TITLE_AT, 70)}</div>
              </div>
              <div>
                <p className="text-[10.5px] font-semibold text-text-faint">Length</p>
                <div className="mt-0.5 flex h-[28px] items-center justify-between rounded-[7px] border px-2 text-[12px] font-bold" style={{ borderColor: t >= DUR_AT - 200 && t < SAVE_AT ? "var(--accent)" : "var(--border)" }}>
                  <span>−</span>{dur}m<span>+</span>
                </div>
              </div>
            </div>
            <p className="mt-2.5 text-[10.5px] font-semibold text-text-faint">Shots from the shot list</p>
            <div className="mt-1 flex gap-2">
              {[2, 3, 4].map((s, i) => {
                const on = i < 2 && t >= SHOTS_AT + i * 500;
                return (
                  <div key={s} className="flex items-center gap-1.5 rounded-[8px] border px-1.5 py-1 text-[11px] font-bold" style={{ borderColor: on ? "var(--accent)" : "var(--border)", background: on ? "var(--accent-soft)" : undefined }}>
                    <span className="relative h-[20px] w-[34px] overflow-hidden rounded-[3px]"><Art i={s} /></span>
                    {["2A", "2B", "2C"][i]}
                  </div>
                );
              })}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10.5px] font-semibold text-text-faint">Talent (from the roster)</p>
                <div className="mt-0.5 flex h-[28px] items-center gap-1.5 rounded-[7px] border border-border px-2 text-[11.5px] font-semibold">{t >= TALENT_AT ? <span className="flex items-center gap-1.5" style={arrive(t, TALENT_AT, 3)}><Avatar name="Rae Morgan" hue="pink" size={18} />Rae Morgan</span> : null}</div>
              </div>
              <div>
                <p className="text-[10.5px] font-semibold text-text-faint">Crew</p>
                <div className="mt-0.5 flex h-[28px] items-center gap-1 rounded-[7px] border border-border px-2">
                  {t >= CREW_AT ? ["Priya Shah", "Leo Park"].map((n, i) => <span key={n} style={arrive(t, CREW_AT + i * 300, 3)}><Avatar name={n} hue={["blue", "amber"][i]} size={18} /></span>) : null}
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end"><Btn tone="accent" press={t >= SAVE_AT - 60}>Save row</Btn></div>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={ADD.at} x={200} y={82 + 3 * 50 + 10} text="Add a row by what it is" />
      <ActionLabel t={t} at={SHOTS_AT} x={220} y={200} text="Attach the shots it covers" tone="green" after={1200} />
      <ActionLabel t={t} at={TALENT_AT} x={200} y={250} text="Talent and crew off the roster" tone="pink" after={1600} />
      <ActionLabel t={t} at={DUR_AT} x={470} y={110} text="Set how long it takes" tone="blue" />
      <ActionLabel t={t} at={SAVE_AT + 300} x={440} y={82 + 3 * 50} text="Every time after it follows" tone="green" after={1600} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 320, y: 400 },
          { t: ADD.at, x: 212, y: 82 + 3 * 50 + 20, click: true },
          { t: TITLE_AT, x: 200, y: 124, click: true },
          { t: SHOTS_AT, x: 100, y: 176, click: true },
          { t: SHOTS_AT + 500, x: 190, y: 176, click: true },
          { t: TALENT_AT, x: 180, y: 232, click: true },
          { t: CREW_AT, x: 440, y: 232, click: true },
          { t: DUR_AT, x: 556, y: 124, click: true },
          { t: SAVE_AT, x: 540, y: 276, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ BOARD */

export const SC_BOARD_MS = 12500;

const IE: Record<string, { label: string; edge: string }> = {
  "INT DAY": { label: "INT · DAY", edge: "var(--border-strong)" },
  "EXT DAY": { label: "EXT · DAY", edge: "var(--h-yellow)" },
  "INT NIGHT": { label: "INT · NIGHT", edge: "var(--h-blue)" },
  "EXT NIGHT": { label: "EXT · NIGHT", edge: "var(--h-green)" },
};
const MOVE = { at: 3200, dur: 1400 };
const PRELIGHT_AT = 6400;

export function ScheduleBoardScene({ t }: { t: number }) {
  const prelight = t >= PRELIGHT_AT;
  const moved = t >= MOVE.at + MOVE.dur;
  const days = [
    ...(prelight ? [{ name: "Prelight", date: "Wed, Oct 5", strips: [{ n: "Rig the kitchen", ie: "INT DAY" }, { n: "Light tests", ie: "INT DAY" }], pre: true }] : []),
    { name: "Day 1", date: "Thu, Oct 6", strips: [{ n: "Kitchen hero · 1A 1B", ie: "INT DAY" }, { n: "The pour · 2A 2B", ie: "INT DAY" }, ...(moved ? [] : [{ n: "Porch, golden hour · 4A", ie: "EXT DAY" }])] },
    { name: "Day 2", date: "Fri, Oct 7", strips: [...(moved ? [{ n: "Porch, golden hour · 4A", ie: "EXT DAY" }] : []), { n: "Night street · 5A", ie: "EXT NIGHT" }, { n: "Bar interior · 6A", ie: "INT NIGHT" }] },
  ];
  const colW = prelight ? 190 : 290;
  const dragging = t >= MOVE.at && t < MOVE.at + MOVE.dur;
  const d = dragAt(t, MOVE.at, MOVE.dur, { x: 16 + 10, y: 110 + 2 * 54 }, { x: 16 + 290 + 12 + 10, y: 110 });
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Schedule · board" sub="Every day of the shoot, side by side" right={<Chip tone="green" t={t}>{prelight ? "3 days" : "2 days"}</Chip>}>
        {days.map((day, c) => (
          <div key={day.name} className="absolute rounded-[12px] border border-border bg-surface-2 p-2" style={{ left: 16 + c * (colW + 12), top: 64, width: colW, height: 360, transition: "left .45s cubic-bezier(.34,1.56,.64,1), width .45s cubic-bezier(.34,1.56,.64,1)", ...(day.pre ? arrive(t, PRELIGHT_AT, -10) : {}) }}>
            <div className="flex items-baseline justify-between px-1">
              <p className="text-[13px] font-extrabold">{day.name}</p>
              <p className="text-[10.5px] text-text-faint">{day.date}</p>
            </div>
            <div className="mt-2 space-y-1.5">
              {day.strips.map((s) => (
                <div key={s.n} className="rounded-[8px] border border-border bg-surface px-2 py-1.5" style={{ borderLeft: `5px solid ${IE[s.ie].edge}`, height: 46, ...(moved && s.n.startsWith("Porch") ? arrive(t, MOVE.at + MOVE.dur, 4) : {}) }}>
                  <p className="truncate text-[11.5px] font-bold">{s.n}</p>
                  <p className="text-[9.5px] font-extrabold tracking-[0.08em] text-text-faint">{IE[s.ie].label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {dragging ? (
          <div className="absolute rounded-[8px] border bg-surface px-2 py-1.5 shadow-[0_20px_40px_-14px_rgba(40,30,90,.55)]" style={{ left: d.x, top: d.y, width: colW - 20, height: 46, borderColor: "var(--accent)", borderLeft: `5px solid ${IE["EXT DAY"].edge}`, transform: "rotate(-1.5deg)", zIndex: 5 }}>
            <p className="truncate text-[11.5px] font-bold">Porch, golden hour · 4A</p>
            <p className="text-[9.5px] font-extrabold tracking-[0.08em] text-text-faint">EXT · DAY</p>
          </div>
        ) : null}
        {/* The add-a-day menu */}
        {t >= PRELIGHT_AT - 900 && t < PRELIGHT_AT + 200 ? (
          <div className="absolute rounded-[12px] border border-border bg-surface p-1.5 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ right: 16, top: 56, width: 210, zIndex: 6, ...arrive(t, PRELIGHT_AT - 900, 6) }}>
            {[
              ["Shoot day", "Numbered Day 1, Day 2"],
              ["Prelight", "Before the shoot"],
              ["Travel", "Getting there"],
              ["Company move", "Changing location"],
            ].map(([k, s]) => (
              <div key={k} className="rounded-[8px] px-2 py-1" style={{ background: k === "Prelight" && t >= PRELIGHT_AT - 400 ? "var(--accent-soft)" : undefined }}>
                <p className="text-[11.5px] font-bold">{k}</p>
                <p className="text-[10px] text-text-faint">{s}</p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="absolute flex gap-2 text-[9.5px] font-bold text-text-faint" style={{ left: 16, bottom: 6 }}>
          {Object.values(IE).map((v) => (
            <span key={v.label} className="flex items-center gap-1"><span className="h-2.5 w-1.5 rounded-sm" style={{ background: v.edge }} />{v.label}</span>
          ))}
        </div>
      </Window>
      <ActionLabel t={t} at={MOVE.at} x={120} y={220} text="Drag a strip to another day" after={1500} />
      <ActionLabel t={t} at={PRELIGHT_AT} x={400} y={130} text="Add a prelight. Days renumber." tone="amber" after={1800} />
      <ActionLabel t={t} at={9400} x={320} y={380} text="The stripboard's colours" tone="muted" after={1500} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 500, x: 320, y: 400 },
          { t: MOVE.at, x: 120, y: 110 + 2 * 54 + 22, click: true },
          { t: MOVE.at + MOVE.dur, x: 16 + 290 + 12 + 110, y: 132 },
          { t: PRELIGHT_AT - 900, x: 590, y: 36, click: true },
          { t: PRELIGHT_AT, x: 560, y: 104, click: true },
        ]}
      />
    </div>
  );
}

/* ---------------------------------------------------- BUILD FROM SHOT LIST */

export const SC_BUILD_MS = 12000;

const OPEN_AT = 800;
const DAYS = [
  { n: "Prelight", rows: 8, wrap: "3:15 PM", ok: true, at: 1800 },
  { n: "Day 1", rows: 29, wrap: "6:00 PM", ok: true, at: 2300 },
  { n: "Day 2", rows: 31, wrap: "6:45 PM", ok: false, at: 2800 },
];
const SHOT_LEN_AT = 4400;
const GO_AT = 6600;

export function ScheduleBuildScene({ t }: { t: number }) {
  const shorter = t >= SHOT_LEN_AT;
  const done = t >= GO_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Schedule · Hint water" sub="Built from the shot list in one step" right={done ? <Chip tone="green" t={t} since={GO_AT}>3 days created</Chip> : <Btn on press={t >= OPEN_AT - 60 && t < OPEN_AT + 80}>Build from shot lists</Btn>}>
        {!done ? (
          t >= OPEN_AT ? (
            <div className="absolute rounded-[16px] border border-border bg-surface p-4 shadow-[0_28px_70px_-24px_rgba(40,30,90,.6)]" style={{ left: 40, top: 66, width: 560, ...arrive(t, OPEN_AT, 12) }}>
              <p className="font-display text-[14px] font-extrabold">Build the schedule from your shot lists</p>
              <p className="text-[11px] text-text-faint">Days come from the list's day column: Prelight, 1 and 2. Nothing is written until you create it.</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  ["Each shot", shorter ? "45m" : "60m"],
                  ["Setup between", "15m"],
                  ["Opening setup", "60m"],
                  ["Lunch", "1:00 PM"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] font-semibold text-text-faint">{k}</p>
                    <div className="mt-0.5 h-[28px] rounded-[7px] border px-2 text-[12px] font-bold leading-[26px]" style={{ borderColor: k === "Each shot" && t >= SHOT_LEN_AT - 300 && t < SHOT_LEN_AT + 700 ? "var(--accent)" : "var(--border)" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {DAYS.map((d) => {
                  const wrap = shorter ? { Prelight: "2:45 PM", "Day 1": "4:15 PM", "Day 2": "4:45 PM" }[d.n] : d.wrap;
                  const ok = shorter ? true : d.ok;
                  return (
                    <div key={d.n} className="flex items-center gap-3 rounded-[10px] border border-border px-3 py-2" style={arrive(t, d.at, 6)}>
                      <span className="w-[70px] text-[12.5px] font-extrabold">{d.n}</span>
                      <span className="flex-1 text-[11.5px] text-text-muted">{d.rows} rows · setups, shots, lunch, wrap</span>
                      <span className="text-[12px] font-bold tabular-nums" style={{ color: ok ? "var(--h-green)" : "var(--h-amber)" }}>wraps {wrap}</span>
                      {!ok ? <Chip tone="amber" t={t}>45m past target</Chip> : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end"><Btn tone="accent" press={t >= GO_AT - 60}>Create 3 days</Btn></div>
            </div>
          ) : null
        ) : (
          <div className="absolute grid grid-cols-3 gap-3" style={{ left: 16, top: 66, width: 608, ...arrive(t, GO_AT, 10) }}>
            {DAYS.map((d, c) => (
              <div key={d.n} className="rounded-[12px] border border-border bg-surface-2 p-2">
                <p className="px-1 text-[13px] font-extrabold">{d.n}</p>
                {["Setup", "Shot", "Setup", "Shot", c === 0 ? "Wrap" : "Lunch", "Shot"].map((k, i) => (
                  <div key={i} className="mt-1.5 flex items-center gap-1.5 rounded-[7px] border border-border bg-surface px-2 py-1 text-[11px] font-semibold" style={{ ...arrive(t, GO_AT + 200 + i * 120 + c * 150, 4), borderLeft: `4px solid var(--h-${KIND_HUE[k.toLowerCase()] ?? "green"})` }}>
                    {k === "Shot" ? <span className="relative h-[14px] w-[24px] overflow-hidden rounded-[2px]"><Art i={i + c} /></span> : null}
                    {k}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <Burst t={t} at={GO_AT} x={560} y={26} />
      </Window>
      <ActionLabel t={t} at={OPEN_AT} x={420} y={20} text="Build it from the shot list" />
      <ActionLabel t={t} at={2800} x={330} y={250} text="See each day's wrap before anything is made" tone="amber" after={1300} />
      <ActionLabel t={t} at={SHOT_LEN_AT} x={120} y={170} text="Tighten the defaults" tone="blue" after={1200} />
      <ActionLabel t={t} at={GO_AT} x={440} y={320} text="Three days, laid out" tone="green" after={1600} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 300, y: 380 },
          { t: OPEN_AT, x: 560, y: 26, click: true },
          { t: SHOT_LEN_AT, x: 110, y: 152, click: true },
          { t: GO_AT, x: 555, y: 330, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------ SHARE / PDF */

export const SC_SHARE_MS = 12000;

const PDF_AT2 = 800;
const REVIEW_AT = 5200;
const PIN_AT = 6800;

export function ScheduleShareScene({ t }: { t: number }) {
  const rows = [
    { tm: "7:00 AM", k: "setup", n: "Set up the kitchen" },
    { tm: "8:00 AM", k: "shot", n: "Kitchen hero", shots: [0, 1] },
    { tm: "9:30 AM", k: "setup", n: "Reset for the pour" },
    { tm: "9:45 AM", k: "shot", n: "The pour", shots: [2, 3] },
    { tm: "1:00 PM", k: "meal", n: "Lunch" },
  ];
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Schedule · Day 1" sub="Print it, or send it for sign-off" right={<span className="flex gap-1.5"><Btn on={t >= PDF_AT2 - 300 && t < REVIEW_AT - 300} press={t >= PDF_AT2 - 60 && t < PDF_AT2 + 80}>PDF · this day</Btn><Btn on={t >= REVIEW_AT - 300} press={t >= REVIEW_AT - 60 && t < REVIEW_AT + 80}>{t >= REVIEW_AT ? "Link copied ✓" : "Share for review"}</Btn></span>}>
        <div className="absolute overflow-hidden rounded-[6px] border border-border bg-white text-[#1a1a2e] shadow-[0_24px_60px_-20px_rgba(20,15,50,.5)]" style={{ left: 40, top: 62, width: 560, height: 364, ...arrive(t, PDF_AT2 + 100, 14) }}>
          <div className="flex items-end justify-between px-4 py-3 text-white" style={{ background: "#16162a" }}>
            <div>
              <p className="text-[8px] font-extrabold tracking-[0.16em] text-[#9d9dc0]">SHOOTING SCHEDULE · DAY 1</p>
              <p className="text-[15px] font-extrabold">Bright Water · Thu, Oct 6</p>
            </div>
            <p className="text-right text-[9px] leading-[1.5] text-[#c9c9e0]">Call 7:00 AM · Wrap target 6:00 PM<br />Stage 2, Culver City</p>
          </div>
          <div className="px-4 py-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-[#eee] py-1.5" style={arrive(t, PDF_AT2 + 400 + i * 150, 4)}>
                <span className="w-[56px] text-[10px] font-bold tabular-nums text-[#555]">{r.tm}</span>
                <span className="h-7 w-1 rounded-full" style={{ background: `var(--h-${KIND_HUE[r.k]})` }} />
                <span className="flex-1 text-[10.5px] font-bold">{r.n}</span>
                {r.shots ? (
                  <span className="flex gap-1.5">
                    {r.shots.map((s) => (
                      <span key={s} className="text-center">
                        <span className="relative block h-[30px] w-[52px] overflow-hidden rounded-[3px]"><Art i={s} /></span>
                        <span className="text-[8px] font-bold">{["1A", "1B", "2A", "2B"][s]}</span>
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          {t >= PIN_AT ? (
            <span className="absolute grid h-6 w-6 place-items-center rounded-full text-[11px] font-black text-white" style={{ left: 330, top: 162, background: "var(--accent)", boxShadow: "0 0 0 3px white", transform: `scale(${spring(ramp(t, PIN_AT, 420))})` }}>1</span>
          ) : null}
        </div>
        {t >= PIN_AT ? (
          <div className="absolute rounded-[10px] border border-border bg-surface px-3 py-2 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ right: 24, bottom: 24, width: 230, ...arrive(t, PIN_AT + 150, 8) }}>
            <p className="text-[11px] font-bold">Jon · Agency</p>
            <p className="text-[11.5px] text-text-muted">{typed("Can the pour move before 9? Talent leaves at 3.", t, PIN_AT + 350, 24)}</p>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={PDF_AT2 + 800} x={420} y={150} text="Frames print on each row" tone="green" after={2200} />
      <ActionLabel t={t} at={REVIEW_AT} x={560} y={20} text="Send it to the agency" tone="indigo" />
      <ActionLabel t={t} at={PIN_AT} x={340} y={170} text="They pin notes on the row" tone="pink" after={1500} />
      <Cursor t={t} travel={650} path={[{ t: 300, x: 300, y: 400 }, { t: PDF_AT2, x: 470, y: 26, click: true }, { t: REVIEW_AT, x: 580, y: 26, click: true }, { t: PIN_AT, x: 372, y: 224, click: true }]} />
    </div>
  );
}
