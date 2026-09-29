"use client";

import type { ReactNode } from "react";
import { ActionLabel, Burst, Chip, Cursor, Window, arrive, ramp, spring, typed } from "./scene-kit";

/*
 * The shot list page's chapter scenes (640x440, pure functions of t, one
 * labelled action about a second apart). Behaviour as shipped: rows with
 * description, size, type and movement (a list to pick from, free text
 * allowed), a frame per row from the asset library or an upload or matched
 * off the storyboard by shot number, the PDF import, several lists with bulk
 * move and undo, the schedule built from the day column, and the cover block
 * the exports share.
 */

export function Art({ i, sketch = false }: { i: number; sketch?: boolean }) {
  const hues = ["amber", "blue", "cyan", "pink", "green", "indigo", "orange", "purple"];
  const h = hues[i % hues.length];
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width="160" height="90" fill={sketch ? "var(--surface)" : `var(--h-${h}-bg)`} />
      <g stroke={sketch ? "var(--text-faint)" : `var(--h-${h})`} strokeWidth="2.5" fill={sketch ? "none" : "var(--surface)"} strokeLinecap="round">
        {i % 4 === 0 ? (
          <>
            <path d="M0 68 H160" fill="none" />
            <rect x="24" y="30" width="34" height="38" rx="3" />
            <circle cx="126" cy="22" r="10" />
          </>
        ) : i % 4 === 1 ? (
          <>
            <rect x="68" y="12" width="24" height="10" rx="3" />
            <path d="M64 22 h32 q8 10 8 22 v38 h-48 v-38 q0 -12 8 -22z" />
          </>
        ) : i % 4 === 2 ? (
          <>
            <path d="M52 10 q18 10 26 30" fill="none" />
            <path d="M70 42 h40 l-6 38 h-28z" />
          </>
        ) : (
          <>
            <circle cx="80" cy="46" r="16" />
            <circle cx="50" cy="30" r="7" />
            <circle cx="114" cy="28" r="8" />
          </>
        )}
      </g>
    </svg>
  );
}

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

function Cell({ w, children, lit, faint }: { w: number | string; children?: ReactNode; lit?: boolean; faint?: boolean }) {
  return (
    <div
      className="flex h-[28px] items-center truncate rounded-[7px] border px-2 text-[11.5px] font-semibold"
      style={{ width: w, borderColor: lit ? "var(--accent)" : "var(--border)", background: lit ? "color-mix(in oklch, var(--accent) 6%, var(--surface))" : "var(--surface)", color: faint ? "var(--text-faint)" : undefined }}
    >
      {children}
    </div>
  );
}

function Menu({ x, y, items, pick, t, at }: { x: number; y: number; items: string[]; pick: number; t: number; at: number }) {
  return (
    <div className="absolute z-20 rounded-[10px] border border-border bg-surface p-1 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ left: x, top: y, width: 150, ...arrive(t, at, 6) }}>
      {items.map((it, i) => (
        <div key={it} className="rounded-[7px] px-2 py-1 text-[11.5px] font-semibold" style={{ background: i === pick && t >= at + 500 ? "var(--accent-soft)" : undefined, color: i === pick && t >= at + 500 ? "var(--accent)" : undefined }}>
          {it}
        </div>
      ))}
    </div>
  );
}

const HEAD = ["", "Frame", "Description", "Size", "Type", "Movement"];
const COLS = [34, 70, 190, 96, 90, 96];
const COLX = COLS.reduce<number[]>((a, w, i) => [...a, i === 0 ? 16 : a[i - 1] + COLS[i - 1] + 4], []);

/* ------------------------------------------------------------------- ROWS */

export const SL_ROWS_MS = 12500;

const ADD_AT = 800;
const DESC_AT = 1500;
const SIZE = { at: 3100, pick: 4000 };
const TYPE = { at: 4900, pick: 5700 };
const MOVE_AT = 6700;
const CODE_AT = 8700;

export function ShotRowsScene({ t }: { t: number }) {
  const rows = [
    { code: "1A", desc: "The kitchen, morning light", size: "Wide", type: "Establishing", move: "Dolly in" },
    { code: "1B", desc: "Bottle hero on the counter", size: "Close-up", type: "Insert", move: "Static" },
  ];
  const Y = (i: number) => 104 + i * 44;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Shot list · Day 1, kitchen" sub="Every shot, as a row" right={<Chip tone="blue" t={t}>{t >= ADD_AT ? 3 : 2} shots</Chip>}>
        <div className="absolute flex text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-faint" style={{ left: 0, top: 70 }}>
          {HEAD.map((h, i) => (
            <span key={i} className="absolute" style={{ left: COLX[i] + 2, width: COLS[i] }}>{h}</span>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={r.code}>
            <span className="absolute text-[11px] font-extrabold" style={{ left: COLX[0] + 4, top: Y(i) + 7, color: "var(--accent)" }}>{r.code}</span>
            <div className="absolute overflow-hidden rounded-[6px]" style={{ left: COLX[1], top: Y(i), width: COLS[1], height: 38 }}><Art i={i} /></div>
            {[r.desc, r.size, r.type, r.move].map((v, k) => (
              <div key={k} className="absolute" style={{ left: COLX[k + 2], top: Y(i) + 5 }}><Cell w={COLS[k + 2]}>{v}</Cell></div>
            ))}
          </div>
        ))}
        {t >= ADD_AT ? (
          <div style={arrive(t, ADD_AT, 8)}>
            <span className="absolute text-[11px] font-extrabold" style={{ left: COLX[0] + 4, top: Y(2) + 7, color: "var(--accent)" }}>{t >= CODE_AT ? "2A" : ""}</span>
            <div className="absolute rounded-[6px] border border-dashed border-border" style={{ left: COLX[1], top: Y(2), width: COLS[1], height: 38 }} />
            <div className="absolute" style={{ left: COLX[2], top: Y(2) + 5 }}>
              <Cell w={COLS[2]} lit={t >= DESC_AT - 200 && t < SIZE.at - 300}>{typed("The pour, from the side", t, DESC_AT, 45)}</Cell>
            </div>
            <div className="absolute" style={{ left: COLX[3], top: Y(2) + 5 }}><Cell w={COLS[3]} lit={t >= SIZE.at && t < SIZE.pick + 300} faint={t < SIZE.pick}>{t >= SIZE.pick ? "Close-up" : "Size"}</Cell></div>
            <div className="absolute" style={{ left: COLX[4], top: Y(2) + 5 }}><Cell w={COLS[4]} lit={t >= TYPE.at && t < TYPE.pick + 300} faint={t < TYPE.pick}>{t >= TYPE.pick ? "Insert" : "Type"}</Cell></div>
            <div className="absolute" style={{ left: COLX[5], top: Y(2) + 5 }}><Cell w={COLS[5]} lit={t >= MOVE_AT - 200 && t < CODE_AT - 300} faint={t < MOVE_AT}>{t >= MOVE_AT ? typed("Slow push in", t, MOVE_AT, 60) : "Move"}</Cell></div>
          </div>
        ) : null}
        {t >= CODE_AT ? (
          <div className="absolute flex gap-2" style={{ left: COLX[2], top: Y(2) + 38, ...arrive(t, CODE_AT, 4) }}>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold">Code 2A</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold">Day 1</span>
          </div>
        ) : null}
        {t >= SIZE.at && t < SIZE.pick + 250 ? <Menu x={COLX[3]} y={Y(2) + 36} t={t} at={SIZE.at} pick={2} items={["Extreme wide", "Wide", "Close-up", "Extreme close-up", "Insert"]} /> : null}
        {t >= TYPE.at && t < TYPE.pick + 250 ? <Menu x={COLX[4]} y={Y(2) + 36} t={t} at={TYPE.at} pick={3} items={["Single", "Two shot", "Over the shoulder", "Insert", "POV"]} /> : null}
        <div className="absolute" style={{ left: 16, top: Y(3) + 20 }}>
          <Btn on={t >= ADD_AT - 300 && t < ADD_AT + 400} press={t >= ADD_AT - 60 && t < ADD_AT + 80}>+ Add shot</Btn>
        </div>
      </Window>
      <ActionLabel t={t} at={ADD_AT} x={60} y={Y(3) + 20} text="Add a shot" />
      <ActionLabel t={t} at={SIZE.at} x={COLX[3] + 60} y={Y(2)} text="Pick from the list" tone="blue" after={900} />
      <ActionLabel t={t} at={MOVE_AT} x={COLX[5] + 30} y={Y(2) + 10} text="Or type your own" tone="green" after={1300} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 320, y: 380 },
          { t: ADD_AT, x: 50, y: Y(3) + 32, click: true },
          { t: DESC_AT, x: COLX[2] + 60, y: Y(2) + 19, click: true },
          { t: SIZE.at, x: COLX[3] + 50, y: Y(2) + 19, click: true },
          { t: SIZE.pick, x: COLX[3] + 50, y: Y(2) + 36 + 2 * 26 + 12, click: true },
          { t: TYPE.at, x: COLX[4] + 45, y: Y(2) + 19, click: true },
          { t: TYPE.pick, x: COLX[4] + 45, y: Y(2) + 36 + 3 * 26 + 12, click: true },
          { t: MOVE_AT, x: COLX[5] + 48, y: Y(2) + 19, click: true },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- FRAMES */

export const SL_FRAMES_MS = 12500;

const PICK_OPEN = 900;
const PICK_AT = 2000;
const UP_AT = 3400;
const MATCH_BTN = 5400;
const MATCH_AT = 6400;

export function ShotFramesScene({ t }: { t: number }) {
  const rows = [
    { code: "1A", desc: "The kitchen, morning light", frame: t >= PICK_AT ? 0 : null },
    { code: "1B", desc: "Bottle hero on the counter", frame: t >= UP_AT + 700 ? 1 : null },
    { code: "2A", desc: "The pour, from the side", frame: t >= MATCH_AT ? 2 : null, matched: true },
    { code: "2B", desc: "Splash, high speed", frame: t >= MATCH_AT + 300 ? 3 : null, matched: true },
  ];
  const Y = (i: number) => 76 + i * 64;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Shot list · Day 1, kitchen" sub="A picture on every shot" right={<Btn on={t >= MATCH_BTN - 300} press={t >= MATCH_BTN - 60 && t < MATCH_BTN + 80}>{t >= MATCH_AT ? "Frames added ✓" : "Add frames to 2 rows"}</Btn>}>
        {rows.map((r, i) => (
          <div key={r.code} className="absolute flex items-center gap-3" style={{ left: 16, top: Y(i), width: 608, height: 56 }}>
            <span className="w-[26px] text-[11px] font-extrabold" style={{ color: "var(--accent)" }}>{r.code}</span>
            <div className="relative h-[54px] w-[96px] overflow-hidden rounded-[7px] border" style={{ borderStyle: r.frame === null ? "dashed" : "solid", borderColor: "var(--border)" }}>
              {r.frame !== null ? (
                <div className="absolute inset-0" style={{ transform: `scale(${0.7 + 0.3 * spring(ramp(t, r.matched ? MATCH_AT + (i - 2) * 300 : i === 0 ? PICK_AT : UP_AT + 700, 420))})` }}>
                  <Art i={r.frame} />
                </div>
              ) : i === 1 && t >= UP_AT ? (
                <span className="absolute inset-0 grid place-items-center text-[10px] font-bold" style={{ color: "var(--accent)" }}>Uploading…</span>
              ) : (
                <span className="absolute inset-0 grid place-items-center text-[10px] text-text-faint">Add frame</span>
              )}
            </div>
            <span className="flex-1 text-[12.5px] font-semibold">{r.desc}</span>
            {r.matched && t >= MATCH_AT + (i - 2) * 300 ? <span style={arrive(t, MATCH_AT + (i - 2) * 300, 4)}><Chip tone="purple" t={t}>Matched to board frame {r.code}</Chip></span> : null}
          </div>
        ))}
        {/* Asset picker */}
        {t >= PICK_OPEN && t < PICK_AT + 200 ? (
          <div className="absolute z-20 rounded-[12px] border border-border bg-surface p-2 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ left: 60, top: Y(0) + 58, width: 264, ...arrive(t, PICK_OPEN, 6) }}>
            <p className="px-1 pb-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">From this project's assets</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 4, 5, 6, 7, 1, 2, 3].map((k, n) => (
                <div key={n} className="relative h-[34px] overflow-hidden rounded-[5px]" style={{ boxShadow: n === 0 && t >= PICK_AT - 400 ? "0 0 0 2px var(--accent)" : undefined }}>
                  <Art i={k} />
                </div>
              ))}
            </div>
            <p className="mt-1.5 px-1 text-[10.5px] font-bold" style={{ color: "var(--accent)" }}>or upload a file</p>
          </div>
        ) : null}
        {/* Storyboard picker for matching */}
        {t >= MATCH_BTN && t < MATCH_AT + 200 ? (
          <div className="absolute z-20 rounded-[12px] border border-border bg-surface p-2 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ right: 16, top: 56, width: 230, ...arrive(t, MATCH_BTN, 6) }}>
            <p className="px-1 pb-1 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">From which storyboard?</p>
            <div className="rounded-[7px] px-2 py-1.5 text-[11.5px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Hero spot board · 12 frames</div>
            <p className="px-1 pt-1 text-[10.5px] text-text-faint">Rows are matched by shot number. Only empty slots are filled.</p>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={PICK_OPEN} x={130} y={Y(0) + 20} text="Pick from the project's assets" />
      <ActionLabel t={t} at={UP_AT} x={130} y={Y(1) + 20} text="Or upload one" tone="green" />
      <ActionLabel t={t} at={MATCH_AT} x={320} y={Y(2) - 4} text="Or pull them off the storyboard" tone="purple" after={1500} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 320, y: 400 },
          { t: PICK_OPEN, x: 120, y: Y(0) + 28, click: true },
          { t: PICK_AT, x: 90, y: Y(0) + 104, click: true },
          { t: UP_AT, x: 120, y: Y(1) + 28, click: true },
          { t: MATCH_BTN, x: 560, y: 26, click: true },
          { t: MATCH_AT - 200, x: 500, y: 96, click: true },
        ]}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- IMPORT */

export const SL_IMPORT_MS = 13000;

const DROP_AT = 900;
const READ_END = 3100;
const FOUND_AT = 3300;
const BEATS = [
  "Morning light fills a quiet kitchen",
  "A hand sets the bottle on the counter",
  "Close on the label as it turns to camera",
  "The pour, slow, from the side",
  "Splash, high speed",
  "End card: the bottle, the line, the logo",
];
const IMPORT_AT = 7200;

export function ShotImportScene({ t }: { t: number }) {
  const reading = t >= DROP_AT && t < READ_END;
  const imported = t >= IMPORT_AT;
  const scan = (t - DROP_AT) / 400;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Import from a PDF" sub="A treatment or a board becomes rows" right={<Chip tone="purple" t={t}>AI reads, you choose</Chip>}>
        {/* The PDF */}
        <div className="absolute rounded-[10px] border border-border bg-white p-3 text-[#1a1a2e]" style={{ left: 16, top: 66, width: 200, height: 250, ...arrive(t, 300, 10) }}>
          <p className="text-[8px] font-extrabold tracking-[0.14em] text-[#666]">HINT · :30 SCRIPT</p>
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="mt-2 block rounded-full"
              style={{ height: i % 4 === 0 ? 7 : 5, width: `${i % 4 === 0 ? 70 : 90 - (i % 3) * 12}%`, background: reading && Math.floor(scan) % 12 === i ? "var(--h-purple)" : i % 4 === 0 ? "#bbb" : "#e3e3ea", transition: "background .2s" }}
            />
          ))}
          <p className="absolute bottom-2 left-3 text-[8px] text-[#999]">Treatment_v3.pdf · 9 pages</p>
        </div>
        {reading ? (
          <p className="absolute text-[12px] font-bold" style={{ left: 16, top: 326, color: "var(--accent)" }}>Reading the document{".".repeat(1 + (Math.floor(t / 300) % 3))}</p>
        ) : null}
        {/* What it found */}
        {t >= FOUND_AT ? (
          <div className="absolute" style={{ left: 232, top: 66, width: 392, ...arrive(t, FOUND_AT, 8) }}>
            <p className="text-[12.5px] font-extrabold">Found the :30 cut · {BEATS.length} shots</p>
            <p className="text-[10.5px] text-text-faint">The :15 cutdown was left out, so shots are not listed twice.</p>
            <div className="mt-2 space-y-1">
              {BEATS.map((b, i) => (
                <div key={b} className="flex items-center gap-2 rounded-[8px] border border-border px-2 py-1.5 text-[11.5px]" style={arrive(t, FOUND_AT + 200 + i * 220, 4)}>
                  <span className="grid h-4 w-4 place-items-center rounded-[4px] text-[10px] font-black text-white" style={{ background: "var(--accent)" }}>✓</span>
                  <span className="flex-1 font-semibold">{b}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-[8px] border border-dashed border-border px-2 py-1.5 text-[11px] text-text-faint" style={arrive(t, FOUND_AT + 1700, 4)}>
                SUPER: HYDRATION, REIMAGINED · on-screen text, not a shot
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <Btn tone="accent" press={t >= IMPORT_AT - 60 && t < IMPORT_AT + 80}>{imported ? "Added 6 shots ✓" : "Add 6 shots"}</Btn>
            </div>
          </div>
        ) : null}
        {imported ? (
          <div className="absolute rounded-[10px] px-3 py-2 text-[11.5px] font-bold text-white" style={{ left: 16, bottom: 14, background: "var(--text)", ...arrive(t, IMPORT_AT + 200, 8) }}>
            6 shots added to “Day 1, kitchen”. Nothing was retyped.
          </div>
        ) : null}
        <Burst t={t} at={IMPORT_AT} x={560} y={380} />
      </Window>
      <ActionLabel t={t} at={DROP_AT} x={120} y={160} text="Drop in the treatment" after={900} />
      <ActionLabel t={t} at={FOUND_AT + 1700} x={300} y={330} text="On-screen text is kept apart" tone="muted" after={1600} />
      <ActionLabel t={t} at={IMPORT_AT} x={520} y={380} text="You choose what goes in" tone="green" />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 520, y: 380 },
          { t: DROP_AT, x: 116, y: 190, click: true },
          { t: IMPORT_AT, x: 580, y: 398, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------- ORGANIZE */

export const SL_ORG_MS = 13500;

const SEL = [900, 1700, 2500];
const MOVE_OPEN = 3500;
const MOVE_TO_AT = 4400;
const UNDO_AT = 6000;
const SCHED_AT = 8000;

export function ShotOrganizeScene({ t }: { t: number }) {
  const moved = t >= MOVE_TO_AT && t < UNDO_AT;
  const rows = ["1A · Kitchen wide", "1B · Bottle hero", "2A · The pour", "2B · Splash", "2C · Drip macro", "3A · Hand reach"];
  const inDay1 = moved ? rows.filter((_, i) => i < 2 || i > 4) : rows;
  const selected = (i: number) => SEL[i - 2] !== undefined && t >= SEL[i - 2] && !moved && t < UNDO_AT + 300;
  const sched = t >= SCHED_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Shot lists · Bright Water" sub="As many lists as the job needs" right={<Chip tone="muted" t={t}>Undo · Cmd Z</Chip>}>
        <div className="absolute border-r border-border p-2" style={{ left: 0, top: 52, width: 180, height: 388 }}>
          {[
            ["Day 1, kitchen", moved ? 3 : 6, true],
            ["Day 2, liquid", moved ? 7 : 4, false],
          ].map(([n, c, on]) => (
            <div key={n as string} className="mb-1 flex items-center justify-between rounded-[8px] px-2 py-2 text-[12px] font-bold" style={{ background: on ? "var(--accent-soft)" : undefined }}>
              {n as string}
              <span className="text-[11px] tabular-nums text-text-faint">{c as number}</span>
            </div>
          ))}
          <p className="px-2 pt-1 text-[11px] font-bold" style={{ color: "var(--accent)" }}>+ New shot list</p>
        </div>
        {!sched ? (
          <div className="absolute" style={{ left: 196, top: 64, width: 428 }}>
            {t >= SEL[0] && !moved && t < UNDO_AT + 300 ? (
              <div className="mb-2 flex items-center gap-2 rounded-[9px] bg-surface-2 px-2 py-1.5 text-[11.5px] font-bold" style={arrive(t, SEL[0], 4)}>
                {SEL.filter((s) => t >= s).length} selected
                <span className="ml-auto flex gap-1.5">
                  <Btn>Duplicate</Btn>
                  <Btn on={t >= MOVE_OPEN - 300} press={t >= MOVE_OPEN - 60 && t < MOVE_OPEN + 80}>Move to</Btn>
                  <Btn>Delete</Btn>
                </span>
              </div>
            ) : (
              <div className="mb-2 h-[33px]" />
            )}
            {inDay1.map((r) => {
              const i = rows.indexOf(r);
              return (
                <div key={r} className="flex h-[38px] items-center gap-2 border-b border-border px-1 text-[12px]" style={{ background: selected(i) ? "var(--accent-soft)" : undefined, ...(t >= UNDO_AT && i >= 2 && i <= 4 ? arrive(t, UNDO_AT, -6) : {}) }}>
                  <span className="grid h-4 w-4 place-items-center rounded-[4px] border text-[10px] font-black text-white" style={{ background: selected(i) ? "var(--accent)" : "transparent", borderColor: selected(i) ? "var(--accent)" : "var(--border-strong)" }}>{selected(i) ? "✓" : ""}</span>
                  <div className="relative h-[28px] w-[48px] overflow-hidden rounded-[5px]"><Art i={i} /></div>
                  <span className="font-semibold">{r}</span>
                </div>
              );
            })}
            {t >= MOVE_OPEN && t < MOVE_TO_AT + 200 ? (
              <div className="absolute rounded-[10px] border border-border bg-surface p-1 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ right: 60, top: 34, width: 150, ...arrive(t, MOVE_OPEN, 6) }}>
                <div className="rounded-[7px] px-2 py-1 text-[11.5px] font-semibold" style={{ background: t >= MOVE_TO_AT - 400 ? "var(--accent-soft)" : undefined, color: t >= MOVE_TO_AT - 400 ? "var(--accent)" : undefined }}>Day 2, liquid</div>
              </div>
            ) : null}
            {t >= UNDO_AT && t < UNDO_AT + 1500 ? (
              <div className="absolute rounded-full px-3 py-1 text-[11.5px] font-extrabold text-white" style={{ left: 120, top: 300, background: "var(--text)", ...arrive(t, UNDO_AT, 8) }}>Undone · Cmd Z</div>
            ) : null}
            <div className="absolute" style={{ left: 0, top: 300 }}>
              <Btn on={t >= SCHED_AT - 400} press={t >= SCHED_AT - 60}>Schedule page: build from shot lists</Btn>
            </div>
          </div>
        ) : (
          <div className="absolute" style={{ left: 196, top: 64, width: 428, ...arrive(t, SCHED_AT, 10) }}>
            <p className="text-[13px] font-extrabold">Schedule · Day 1 · wraps 11:30 AM</p>
            <p className="text-[10.5px] text-text-faint">Days come from the list's day column. A setup between shots, lunch placed when the day runs past it.</p>
            <div className="mt-2">
              {[
                ["7:00 AM", "Setup", "blue"],
                ["8:00 AM", "1A · Kitchen wide", "green"],
                ["9:00 AM", "Setup", "blue"],
                ["9:15 AM", "1B · Bottle hero", "green"],
                ["10:15 AM", "Setup", "blue"],
                ["10:30 AM", "3A · Hand reach", "green"],
                ["11:30 AM", "Wrap", "indigo"],
              ].map(([tm, n, h], i) => (
                <div key={i} className="flex h-[32px] items-center gap-3 border-b border-border text-[11.5px]" style={arrive(t, SCHED_AT + 300 + i * 180, 4)}>
                  <span className="w-[64px] font-bold tabular-nums text-text-muted">{tm}</span>
                  <span className="h-5 w-1 rounded-full" style={{ background: `var(--h-${h})` }} />
                  <span className="font-semibold">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Window>
      <ActionLabel t={t} at={SEL[0]} x={200} y={120} text="Select a few shots" after={1600} />
      <ActionLabel t={t} at={MOVE_TO_AT} x={420} y={70} text="Move them to another day" tone="blue" />
      <ActionLabel t={t} at={UNDO_AT} x={320} y={290} text="Changed your mind? Undo" tone="muted" after={900} />
      <ActionLabel t={t} at={SCHED_AT} x={200} y={350} text="The schedule builds from your lists" tone="green" after={1600} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 400, y: 400 },
          ...SEL.map((s, k) => ({ t: s, x: 205, y: 64 + 41 + (k + 2) * 38 + 19, click: true })),
          { t: MOVE_OPEN, x: 548, y: 82, click: true },
          { t: MOVE_TO_AT, x: 520, y: 110, click: true },
          { t: SCHED_AT, x: 300, y: 377, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ SHARE */

export const SL_SHARE_MS = 12500;

const COVER_AT = 800;
const COVER = [
  ["Client", "Bright Water"],
  ["Agency", "Northfield & Co"],
  ["Director", "Dana Reyes"],
  ["Job no.", "BW-0412"],
];
const PDF_AT = 4600;
const REVIEW_AT = 7400;
const PIN_AT = 8800;

export function ShotShareScene({ t }: { t: number }) {
  const pdf = t >= PDF_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="Shot list · Day 1, kitchen"
        sub="Present it, print it, get it signed off"
        right={
          <span className="flex gap-1.5">
            <Btn on={t >= PDF_AT - 300 && t < REVIEW_AT - 300} press={t >= PDF_AT - 60 && t < PDF_AT + 80}>PDF</Btn>
            <Btn on={t >= REVIEW_AT - 300} press={t >= REVIEW_AT - 60 && t < REVIEW_AT + 80}>{t >= REVIEW_AT ? "Link copied ✓" : "Share for review"}</Btn>
          </span>
        }
      >
        {!pdf ? (
          <div className="absolute rounded-[12px] border border-border p-3" style={{ left: 16, top: 66, width: 608, ...arrive(t, COVER_AT, 6) }}>
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-extrabold">Cover · client, director, job number</p>
              <Chip tone={t >= COVER_AT + 3000 ? "green" : "amber"} t={t} since={t >= COVER_AT + 3000 ? COVER_AT + 3000 : undefined}>{t >= COVER_AT + 3000 ? "4 of 4" : "Not filled in"}</Chip>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {COVER.map(([k, v], i) => (
                <div key={k}>
                  <p className="text-[10.5px] font-semibold text-text-faint">{k}</p>
                  <Cell w="100%" lit={t >= COVER_AT + 300 + i * 700 && t < COVER_AT + 900 + i * 700}>{typed(v, t, COVER_AT + 300 + i * 700, 40)}</Cell>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10.5px] text-text-faint">Filled in once, printed on the shot list, the storyboard and the binder.</p>
          </div>
        ) : (
          <div className="absolute overflow-hidden rounded-[6px] border border-border bg-white text-[#1a1a2e] shadow-[0_24px_60px_-20px_rgba(20,15,50,.5)]" style={{ left: 40, top: 62, width: 560, height: 364, ...arrive(t, PDF_AT + 100, 16) }}>
            <div className="flex items-end justify-between px-4 py-3 text-white" style={{ background: "#16162a" }}>
              <div>
                <p className="text-[8px] font-extrabold tracking-[0.16em] text-[#9d9dc0]">SHOT LIST</p>
                <p className="text-[16px] font-extrabold">Bright Water · Hero spot</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 text-[8.5px] leading-[1.5] text-[#c9c9e0]">
                {COVER.map(([k, v]) => (
                  <p key={k}><span className="text-[#8a8aa8]">{k}</span> {v}</p>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3">
              {["1A · Kitchen wide", "1B · Bottle hero", "2A · The pour", "2B · Splash"].map((r, i) => (
                <div key={r} className="relative">
                  <div className="relative h-[92px] overflow-hidden rounded-[4px]"><Art i={i} /></div>
                  <p className="mt-1 text-[9.5px] font-bold">{r}</p>
                  <p className="text-[8.5px] text-[#666]">{["Wide · Dolly in", "Close-up · Static", "Close-up · Slow push in", "Extreme close-up · Locked off"][i]}</p>
                  {i === 2 && t >= PIN_AT ? (
                    <span className="absolute grid h-6 w-6 place-items-center rounded-full text-[11px] font-black text-white" style={{ left: 120, top: 30, background: "var(--accent)", boxShadow: "0 0 0 3px white", transform: `scale(${spring(ramp(t, PIN_AT, 420))})` }}>1</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
        {t >= PIN_AT ? (
          <div className="absolute rounded-[10px] border border-border bg-surface px-3 py-2 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]" style={{ right: 24, bottom: 20, width: 220, ...arrive(t, PIN_AT + 150, 8) }}>
            <p className="text-[11px] font-bold">Maya · Client</p>
            <p className="text-[11.5px] text-text-muted">{typed("Can 2A be a touch wider?", t, PIN_AT + 350, 26)}</p>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={COVER_AT} x={120} y={80} text="Fill the job block once" after={2500} />
      <ActionLabel t={t} at={PDF_AT} x={540} y={20} text="A PDF with a proper cover" tone="indigo" after={1400} />
      <ActionLabel t={t} at={REVIEW_AT} x={560} y={20} text="Send it for sign-off" tone="green" />
      <ActionLabel t={t} at={PIN_AT} x={230} y={260} text="The client pins the shot" tone="pink" after={1200} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 300, x: 320, y: 380 },
          { t: COVER_AT + 300, x: 160, y: 124, click: true },
          { t: COVER_AT + 1700, x: 160, y: 170, click: true },
          { t: PDF_AT, x: 496, y: 26, click: true },
          { t: REVIEW_AT, x: 570, y: 26, click: true },
          { t: PIN_AT, x: 382, y: 290, click: true },
        ]}
      />
    </div>
  );
}

