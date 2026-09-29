"use client";

import type { ReactNode } from "react";
import { ActionLabel, Avatar, Burst, Chip, Cursor, Window, arrive, dragAt, typed } from "./scene-kit";

/*
 * The call sheet page's chapter scenes (640x440, a pure function of t, one
 * labelled action about a second apart). What they show is what ships: the
 * block builder, duplicating a sheet (fresh links, no date carried), per-person
 * links with viewed/confirmed tallies, the bounded reminder chase, and the
 * crew meal round with its manual chase.
 */

const CREW = [
  { n: "Dana Reyes", r: "Director", c: "7:00 AM", h: "purple" },
  { n: "Sam Ortiz", r: "1st AD", c: "6:30 AM", h: "green" },
  { n: "Priya Shah", r: "DP", c: "6:45 AM", h: "blue" },
  { n: "Leo Park", r: "Gaffer", c: "6:45 AM", h: "amber" },
  { n: "Nina Cole", r: "Key grip", c: "6:45 AM", h: "cyan" },
  { n: "Ava Brooks", r: "Prop stylist", c: "7:00 AM", h: "pink" },
  { n: "Theo Lin", r: "Food stylist", c: "6:30 AM", h: "orange" },
  { n: "Mia Chen", r: "PA", c: "6:15 AM", h: "indigo" },
];

function Grip() {
  return (
    <span className="grid grid-cols-2 gap-[2px]" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-text-faint" />
      ))}
    </span>
  );
}

function Btn({ children, on, press, tone = "accent" }: { children: ReactNode; on?: boolean; press?: boolean; tone?: "accent" | "quiet" }) {
  return (
    <span
      className="inline-flex items-center rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold"
      style={{
        background: tone === "accent" ? "var(--accent)" : on ? "var(--accent-soft)" : "var(--surface)",
        color: tone === "accent" ? "white" : on ? "var(--accent)" : "var(--text-muted)",
        border: tone === "accent" ? "none" : "1px solid var(--border)",
        transform: `scale(${press ? 0.93 : 1})`,
        transition: "transform .1s",
      }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ BUILD */

export const CS_BUILD_MS = 12500;

const CALL_AT = 900;
const DRAG = { at: 2600, dur: 1000 };
const HIDE_AT = 4700;
const TEXT_AT = 6200;
const ACCENT_AT = 8200;
const TPL_AT = 9800;

export function CallSheetBuildScene({ t }: { t: number }) {
  const accent = t >= ACCENT_AT ? "indigo" : "amber";
  const crewFirst = t >= DRAG.at + DRAG.dur;
  const dragging = t >= DRAG.at && t < DRAG.at + DRAG.dur;
  const drag = dragAt(t, DRAG.at, DRAG.dur, { x: 0, y: 70 }, { x: 0, y: 0 });
  const castHidden = t >= HIDE_AT;
  const blocks = [
    { k: "loc", label: "Locations", body: "Stage 2 · 1440 Allesandro St, Culver City", h: 48 },
    { k: "crew", label: "Crew", body: "8 people · calls from 6:15 AM", h: 48 },
    { k: "cast", label: "Cast", body: "Talent: Rae Morgan · call 8:30 AM", h: 48 },
  ];
  const order = crewFirst ? ["crew", "loc", "cast"] : ["loc", "crew", "cast"];
  const visible = order.filter((k) => !(k === "cast" && castHidden));
  let y = 176;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Call sheet · Day 1" sub="Edit it on the sheet itself" right={t >= TPL_AT + 300 ? <Chip tone="green" t={t} since={TPL_AT + 300}>Template saved</Chip> : <Chip tone="muted" t={t}>Draft</Chip>}>
        {/* Toolbar */}
        <div className="absolute flex items-center gap-2" style={{ right: 16, top: 60 }}>
          <span className="flex items-center gap-1.5 rounded-[8px] border border-border px-2 py-1 text-[11px] font-bold">
            <span className="h-3 w-3 rounded-full" style={{ background: `var(--h-${accent})`, transition: "background .4s" }} /> Accent
          </span>
          <Btn tone="quiet" on={t >= TPL_AT - 300 && t < TPL_AT + 700} press={t >= TPL_AT - 60 && t < TPL_AT + 80}>Save as template</Btn>
        </div>
        {/* Masthead */}
        <div className="absolute flex items-center gap-4 rounded-[12px] border border-border px-4" style={{ left: 16, top: 92, width: 608, height: 74, borderTop: `4px solid var(--h-${accent})`, transition: "border-color .4s" }}>
          <span className="grid h-10 w-10 place-items-center rounded-[9px] text-[10px] font-black text-white" style={{ background: "var(--text)" }}>
            LOGO
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-extrabold">Bright Water · Hero spot</p>
            <p className="text-[10.5px] text-text-faint">Northline Studio · Producer: Kim Ade · 310 555 0142</p>
          </div>
          <div className="rounded-[10px] px-3 py-1.5 text-center" style={{ background: `var(--h-${accent}-bg)`, transition: "background .4s" }}>
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: `var(--h-${accent})` }}>
              General call
            </p>
            <p className="font-display text-[18px] font-extrabold leading-tight" style={{ outline: t >= CALL_AT - 200 && t < CALL_AT + 900 ? "2px solid var(--accent)" : undefined, borderRadius: 4 }}>
              {t >= CALL_AT ? `${typed("7:00", t, CALL_AT + 100, 90)} AM` : "6:30 AM"}
            </p>
          </div>
          <div className="text-[10.5px] leading-[1.5]">
            <p><span className="text-text-faint">Lunch</span> 12:30</p>
            <p><span className="text-text-faint">Wrap</span> 6:00 PM</p>
            <p><span className="text-text-faint">Sunset</span> 6:52 PM</p>
          </div>
        </div>
        {/* Body blocks */}
        {visible.map((k) => {
          const b = blocks.find((x) => x.k === k)!;
          const top = y;
          y += b.h + 8;
          const isDrag = k === "crew" && dragging;
          return (
            <div
              key={k}
              className="absolute flex items-center gap-3 rounded-[10px] border bg-surface px-3"
              style={{
                left: 16,
                top: isDrag ? 176 + drag.y : top,
                width: 608,
                height: b.h,
                borderColor: isDrag ? "var(--accent)" : "var(--border)",
                boxShadow: isDrag ? "0 20px 40px -16px rgba(40,30,90,.5)" : undefined,
                zIndex: isDrag ? 5 : 1,
                transition: isDrag ? undefined : "top .35s cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              <Grip />
              <div className="flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: `var(--h-${accent})` }}>
                  {b.label}
                </p>
                <p className="text-[12px] font-semibold">{b.body}</p>
              </div>
              <span className="text-[10.5px] font-bold text-text-faint" style={{ opacity: k === "cast" ? 1 : 0.5 }}>
                Hide
              </span>
            </div>
          );
        })}
        {/* A custom text block */}
        {t >= TEXT_AT ? (
          <div className="absolute rounded-[10px] border border-border bg-surface px-3 py-2" style={{ left: 16, top: y, width: 608, ...arrive(t, TEXT_AT, 8) }}>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: `var(--h-${accent})` }}>
              {typed("Parking", t, TEXT_AT + 200, 70)}
            </p>
            <p className="text-[12px] font-semibold">{typed("Use the lot on Hayden Ave. Crew passes at the gate.", t, TEXT_AT + 800, 24)}</p>
          </div>
        ) : null}
        {/* Add block palette */}
        <div className="absolute flex items-center gap-2" style={{ left: 16, bottom: 14 }}>
          <Btn tone="quiet" on={t >= TEXT_AT - 400 && t < TEXT_AT + 300}>+ Text block</Btn>
          {castHidden ? (
            <span style={arrive(t, HIDE_AT, 4)}>
              <Btn tone="quiet">+ Cast (hidden)</Btn>
            </span>
          ) : null}
        </div>
      </Window>
      <ActionLabel t={t} at={CALL_AT} x={470} y={150} text="Edit right on the sheet" />
      <ActionLabel t={t} at={DRAG.at} x={40} y={236} text="Drag blocks into any order" after={1200} />
      <ActionLabel t={t} at={HIDE_AT} x={560} y={270} text="Hide what this day doesn't need" tone="muted" />
      <ActionLabel t={t} at={TEXT_AT} x={120} y={390} text="Add your own blocks" tone="green" />
      <ActionLabel t={t} at={ACCENT_AT} x={470} y={60} text="Your colour" tone="indigo" />
      <ActionLabel t={t} at={TPL_AT} x={560} y={60} text="Reuse the layout on every job" tone="green" after={1200} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 400, x: 320, y: 380 },
          { t: CALL_AT, x: 490, y: 142, click: true },
          { t: DRAG.at, x: 30, y: 176 + 70 + 24, click: true },
          { t: DRAG.at + DRAG.dur, x: 30, y: 176 + 24 },
          { t: HIDE_AT, x: 596, y: 176 + 2 * 56 + 24, click: true },
          { t: TEXT_AT, x: 60, y: 414, click: true },
          { t: ACCENT_AT, x: 460, y: 70, click: true },
          { t: TPL_AT, x: 570, y: 70, click: true },
        ]}
      />
    </div>
  );
}

/* ---------------------------------------------------- DUPLICATE AND EXPORT */

export const CS_DUP_MS = 12000;

const DUP_AT = 1000;
const RENAME_AT = 1900;
const TOAST_AT = 2900;
const DATE_AT = 5000;
const PDF_AT = 7000;

export function CallSheetDuplicateScene({ t }: { t: number }) {
  const copied = t >= DUP_AT;
  const name = t >= RENAME_AT ? typed("Day 1", t, RENAME_AT, 110) || "Prelight (copy)" : "Prelight (copy)";
  const pdf = t >= PDF_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Call sheets · Bright Water" sub="One sheet per day, as many as the job needs" right={<Btn tone="quiet" on={t >= PDF_AT - 300} press={t >= PDF_AT - 60 && t < PDF_AT + 80}>Download PDF</Btn>}>
        {/* Sheet list */}
        <div className="absolute border-r border-border" style={{ left: 0, top: 52, width: 190, height: 388 }}>
          <div className="p-2">
            <div className="flex items-center justify-between rounded-[9px] px-2 py-2" style={{ background: !copied ? "var(--accent-soft)" : undefined }}>
              <div>
                <p className="text-[12px] font-bold">Prelight</p>
                <p className="text-[10.5px] text-text-faint">Wed, Oct 5</p>
              </div>
              <Chip tone="blue" t={t}>Sent</Chip>
            </div>
            {copied ? (
              <div className="mt-1 flex items-center justify-between rounded-[9px] px-2 py-2" style={{ background: "var(--accent-soft)", ...arrive(t, DUP_AT, -6) }}>
                <div>
                  <p className="text-[12px] font-bold">{name}</p>
                  <p className="text-[10.5px]" style={{ color: t >= DATE_AT ? "var(--text-faint)" : "var(--h-amber)" }}>{t >= DATE_AT ? "Thu, Oct 6" : "No date yet"}</p>
                </div>
                <Chip tone="muted" t={t}>Draft</Chip>
              </div>
            ) : null}
            <p className="mt-2 px-2 text-[11px] font-bold" style={{ color: "var(--accent)" }}>+ New call sheet</p>
          </div>
        </div>
        {/* Active sheet */}
        <div className="absolute" style={{ left: 206, top: 64, width: 418 }}>
          <div className="flex items-center gap-2">
            <p className="flex-1 rounded-[7px] px-1 font-display text-[16px] font-extrabold" style={{ background: t >= RENAME_AT - 300 && t < RENAME_AT + 700 ? "color-mix(in oklch, var(--accent) 15%, transparent)" : undefined }}>
              {copied ? name : "Prelight"}
            </p>
            <Btn tone="quiet" on={t >= DUP_AT - 300 && t < DUP_AT + 400} press={t >= DUP_AT - 60 && t < DUP_AT + 80}>Duplicate</Btn>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              ["Date", t >= DATE_AT ? "Thu, Oct 6" : copied ? "" : "Wed, Oct 5", copied && t < DATE_AT],
              ["General call", "7:00 AM", false],
              ["Weather", copied && t < DATE_AT ? "" : "72°, clear", copied && t < DATE_AT],
            ].map(([k, v, warn]) => (
              <div key={k as string}>
                <p className="text-[10px] font-semibold text-text-faint">{k}</p>
                <div className="mt-0.5 h-[28px] rounded-[7px] border px-2 text-[11.5px] font-semibold leading-[26px]" style={{ borderColor: warn ? "var(--h-amber)" : "var(--border)", background: warn ? "var(--h-amber-bg)" : undefined }}>
                  {v as string}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Crew · copied with their call times</p>
          <div className="mt-1">
            {CREW.slice(0, 5).map((c) => (
              <div key={c.n} className="flex h-[30px] items-center gap-2 border-b border-border text-[11.5px]">
                <Avatar name={c.n} hue={c.h} size={20} />
                <span className="w-[100px] font-bold">{c.n}</span>
                <span className="flex-1 text-text-muted">{c.r}</span>
                <span className="font-semibold tabular-nums text-text-muted">{c.c}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-text-faint">7 recipients carried over, each with a fresh link and no history.</p>
        </div>
        {/* Toast */}
        {t >= TOAST_AT && t < DATE_AT + 400 ? (
          <div className="absolute rounded-[10px] px-3 py-2 text-[11.5px] font-bold text-white" style={{ left: 206, bottom: 14, background: "var(--text)", ...arrive(t, TOAST_AT, 8) }}>
            Copied 9 rows and 7 recipients. Add the date and check the times.
          </div>
        ) : null}
        {/* The PDF */}
        {pdf ? (
          <div className="absolute rounded-[6px] border border-border bg-white p-4 text-[#1a1a2e] shadow-[0_30px_70px_-20px_rgba(20,15,50,.6)]" style={{ left: 230, top: 60, width: 330, height: 368, ...arrive(t, PDF_AT + 100, 20) }}>
            <div className="flex items-center justify-between border-b-4 pb-2" style={{ borderColor: "#e8a33d" }}>
              <span className="text-[10px] font-black">LOGO</span>
              <div className="text-center">
                <p className="text-[8px] font-extrabold tracking-[0.14em] text-[#b07214]">GENERAL CALL</p>
                <p className="text-[18px] font-extrabold leading-none">7:00 AM</p>
              </div>
              <p className="text-right text-[8px] leading-[1.4]">Thu, Oct 6<br />Day 1 of 2</p>
            </div>
            {["LOCATIONS", "CREW", "PARKING"].map((h, i) => (
              <div key={h} className="mt-3">
                <p className="text-[8px] font-extrabold tracking-[0.14em] text-[#b07214]">{h}</p>
                {Array.from({ length: i === 1 ? 6 : 2 }).map((_, k) => (
                  <span key={k} className="mt-1 block h-1.5 rounded-full bg-[#e5e5ee]" style={{ width: `${90 - k * 7}%` }} />
                ))}
              </div>
            ))}
            <p className="absolute bottom-3 left-4 text-[8px] text-[#8a8aa0]">Printed from Studio Flows · colours kept</p>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={DUP_AT} x={560} y={60} text="Duplicate yesterday's sheet" />
      <ActionLabel t={t} at={TOAST_AT + 300} x={230} y={120} text="The date is left blank on purpose" tone="amber" after={1300} />
      <ActionLabel t={t} at={PDF_AT} x={560} y={20} text="One-click PDF" tone="indigo" after={1500} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 400, x: 420, y: 380 },
          { t: DUP_AT, x: 590, y: 80, click: true },
          { t: RENAME_AT, x: 300, y: 80, click: true },
          { t: DATE_AT, x: 260, y: 116, click: true },
          { t: PDF_AT, x: 590, y: 26, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- SEND */

export const CS_SEND_MS = 12500;

const CHECK = (i: number) => 900 + i * 220;
const ADD_AT = 2900;
const EMAIL_AT = 3900;
const SEEN = [4600, 4900, 5300, 5700, 6100, 6400];
const CONF = [5200, 5700, 6300, 6900, 7400];
const FILTER_AT = 9000;

export function CallSheetSendScene({ t }: { t: number }) {
  const added = t >= ADD_AT;
  const sent = t >= EMAIL_AT;
  const people = CREW.slice(0, 8);
  const state = (i: number) => (i < CONF.length && t >= CONF[i] ? "Confirmed" : i < SEEN.length && t >= SEEN[i] ? "Viewed" : "Not opened");
  const counts = { c: people.filter((_, i) => state(i) === "Confirmed").length, v: people.filter((_, i) => state(i) === "Viewed").length, n: people.filter((_, i) => state(i) === "Not opened").length };
  const filtered = t >= FILTER_AT;
  const rows = filtered ? people.filter((_, i) => state(i) === "Not opened") : people;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Send · Call sheet Day 1" sub="Everyone gets their own link" right={sent ? <Chip tone="blue" t={t} since={EMAIL_AT}>Sent</Chip> : <Chip tone="muted" t={t}>Draft</Chip>}>
        {!added ? (
          <div className="absolute" style={{ left: 16, top: 66, width: 608 }}>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-faint">Add from the project's contacts</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4">
              {people.map((c, i) => (
                <div key={c.n} className="flex h-[34px] items-center gap-2 border-b border-border text-[12px]">
                  <span className="grid h-4 w-4 place-items-center rounded-[4px] border text-[10px] font-black text-white" style={{ background: t >= CHECK(i) ? "var(--accent)" : "transparent", borderColor: t >= CHECK(i) ? "var(--accent)" : "var(--border-strong)" }}>
                    {t >= CHECK(i) ? "✓" : ""}
                  </span>
                  <Avatar name={c.n} hue={c.h} size={20} />
                  <span className="font-bold">{c.n}</span>
                  <span className="text-text-faint">{c.r}</span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Btn press={t >= ADD_AT - 60}>Add {people.filter((_, i) => t >= CHECK(i)).length} people</Btn>
            </div>
          </div>
        ) : (
          <div className="absolute" style={{ left: 16, top: 62, width: 608, ...arrive(t, ADD_AT, 8) }}>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Confirmed", `${counts.c}/8`, "green"],
                ["Viewed, not confirmed", `${counts.v}`, "blue"],
                ["Not opened", `${counts.n}`, "amber"],
              ].map(([k, v, h]) => (
                <div
                  key={k}
                  className="rounded-[10px] border px-3 py-1.5"
                  style={{ borderColor: filtered && k === "Not opened" ? `var(--h-${h})` : "var(--border)", background: filtered && k === "Not opened" ? `var(--h-${h}-bg)` : undefined }}
                >
                  <p className="text-[10px] font-semibold text-text-faint">{k}</p>
                  <p className="font-display text-[18px] font-extrabold tabular-nums" style={{ color: `var(--h-${h})` }}>{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-text-faint">{filtered ? "Showing: not opened" : "Everyone on this sheet"}</p>
              <Btn tone={sent ? "quiet" : "accent"} press={t >= EMAIL_AT - 60 && t < EMAIL_AT + 80}>{sent ? "Emailed ✓" : "Email everyone"}</Btn>
            </div>
            <div className="mt-1.5">
              {rows.map((c) => {
                const i = people.indexOf(c);
                const s = sent ? state(i) : "Not sent";
                const tone = s === "Confirmed" ? "green" : s === "Viewed" ? "blue" : s === "Not opened" ? "amber" : "muted";
                const since = s === "Confirmed" ? CONF[i] : s === "Viewed" ? SEEN[i] : EMAIL_AT;
                return (
                  <div key={c.n} className="flex h-[31px] items-center gap-2 border-b border-border text-[11.5px]">
                    <Avatar name={c.n} hue={c.h} size={20} />
                    <span className="w-[100px] font-bold">{c.n}</span>
                    <span className="flex-1 truncate text-[10.5px] text-text-faint">studio-flows.com/c/{["k2f9", "a81x", "q7m2", "z0p4", "w3n8", "e5r1", "t6y7", "u9i0"][i]}…</span>
                    <span className="text-[10.5px] font-bold" style={{ color: "var(--accent)" }}>Copy link</span>
                    <Chip tone={tone} t={t} since={since} className="w-[88px] justify-center">{s}</Chip>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Window>
      <ActionLabel t={t} at={CHECK(0)} x={60} y={100} text="Tick people off the roster" after={1500} />
      <ActionLabel t={t} at={EMAIL_AT} x={560} y={144} text="Email everyone their link" />
      <ActionLabel t={t} at={5600} x={300} y={60} text="Watch it come in" tone="green" after={1600} />
      <ActionLabel t={t} at={FILTER_AT} x={480} y={96} text="Who hasn't opened it?" tone="amber" after={1800} />
      <Cursor
        t={t}
        travel={600}
        path={[
          { t: 500, x: 300, y: 380 },
          ...people.map((_, i) => ({ t: CHECK(i), x: i % 2 === 0 ? 30 : 334, y: 104 + Math.floor(i / 2) * 34, click: true })),
          { t: ADD_AT, x: 60, y: 256, click: true },
          { t: EMAIL_AT, x: 580, y: 136, click: true },
          { t: FILTER_AT, x: 520, y: 86, click: true },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ CHASE */

export const CS_CHASE_MS = 12500;

const DAYS = [
  { d: "Sun", note: "Too early, stays quiet", at: 600 },
  { d: "Mon", note: "3 days out: first reminder to 3 people", at: 2000, sent: 3 },
  { d: "Tue", note: "Second reminder to the 2 left", at: 4600, sent: 2 },
  { d: "Wed", note: "Mia has had two. That one is a phone call.", at: 6800 },
  { d: "Thu", note: "Shoot day", at: 9200 },
];
const CALL_AT2 = 7600;
const ALL_AT = 8600;

export function CallSheetChaseScene({ t }: { t: number }) {
  const cur = [...DAYS].reverse().find((d) => t >= d.at) ?? DAYS[0];
  const confirmed = t >= ALL_AT ? 8 : t >= 5600 ? 7 : t >= 3000 ? 6 : 5;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Call sheet · Day 1 · Thu, Oct 6" sub="Unconfirmed crew get chased, within limits" right={t >= ALL_AT ? <Chip tone="green" t={t} since={ALL_AT}>8/8 confirmed</Chip> : <Chip tone="amber" t={t}>{confirmed}/8 confirmed</Chip>}>
        {/* Week strip */}
        <div className="absolute flex gap-2" style={{ left: 16, top: 66, width: 608 }}>
          {DAYS.map((d) => {
            const on = d === cur;
            const past = t >= d.at;
            return (
              <div key={d.d} className="flex-1 rounded-[10px] border px-2 py-2 text-center" style={{ borderColor: on ? "var(--accent)" : "var(--border)", background: on ? "var(--accent-soft)" : past ? "var(--surface-2)" : "var(--surface)", transition: "all .3s" }}>
                <p className="text-[11px] font-extrabold">{d.d}</p>
                <p className="text-[10px] text-text-faint">{d.d === "Thu" ? "Shoot" : `${["4", "3", "2", "1"][DAYS.indexOf(d)]} ${d.d === "Wed" ? "day" : "days"} out`}</p>
              </div>
            );
          })}
        </div>
        <p className="absolute text-[13px] font-bold" style={{ left: 16, top: 128, ...arrive(t, cur.at, 6) }} key={cur.d}>
          {cur.note}
        </p>
        {/* Rules card */}
        <div className="absolute rounded-[12px] border border-border bg-surface-2 p-3" style={{ left: 16, top: 160, width: 250 }}>
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">The limits</p>
          {["Starts three days before the shoot", "One reminder a day at most", "Two reminders per person, then it stops", "Confirming stops it instantly", "Drafts are never chased"].map((r, i) => (
            <p key={r} className="mt-1.5 flex items-start gap-1.5 text-[11.5px] font-semibold" style={arrive(t, 400 + i * 180, 4)}>
              <span style={{ color: "var(--h-green)" }}>✓</span> {r}
            </p>
          ))}
        </div>
        {/* Outbox */}
        <div className="absolute" style={{ left: 282, top: 160, width: 342 }}>
          {DAYS.filter((d) => d.sent && t >= d.at).map((d) =>
            Array.from({ length: d.sent! }).map((_, i) => {
              const who = d.d === "Mon" ? ["Leo Park", "Mia Chen", "Theo Lin"][i] : ["Mia Chen", "Theo Lin"][i];
              const at = d.at + 200 + i * 220;
              return t >= at ? (
                <div key={`${d.d}${i}`} className="mb-1.5 flex items-center gap-2 rounded-[10px] border border-border bg-surface px-2.5 py-1.5" style={arrive(t, at, 8)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--h-amber)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  <span className="flex-1 text-[11.5px]">
                    <b>{who}</b> <span className="text-text-faint">· "Your call is in {d.d === "Mon" ? "3 days" : "2 days"}"</span>
                  </span>
                  {(who === "Leo Park" && t >= 3000) || (who === "Theo Lin" && t >= 5600 && d.d === "Tue") ? (
                    <Chip tone="green" t={t}>Confirmed</Chip>
                  ) : null}
                </div>
              ) : null;
            }),
          )}
          {t >= CALL_AT2 ? (
            <div className="mt-2 flex items-center gap-2 rounded-[10px] border border-dashed border-border px-2.5 py-1.5" style={arrive(t, CALL_AT2, 6)}>
              <Avatar name="Mia Chen" hue="indigo" size={20} />
              <span className="flex-1 text-[11.5px]"><b>Mia Chen</b> <span className="text-text-faint">· no more emails, call 310 555 0199</span></span>
              {t >= ALL_AT ? <Chip tone="green" t={t} since={ALL_AT}>Confirmed</Chip> : null}
            </div>
          ) : null}
        </div>
        {/* Hub card */}
        <div className="absolute flex items-center gap-3 rounded-[12px] border border-border px-3 py-2" style={{ left: 16, bottom: 14, width: 250, borderTop: `3px solid var(--h-${t >= ALL_AT ? "green" : "amber"})` }}>
          <div className="flex-1">
            <p className="text-[12px] font-bold">Call sheet</p>
            <p className="text-[10.5px] text-text-faint">On the project's front page</p>
          </div>
          <Chip tone={t >= ALL_AT ? "green" : "amber"} t={t} since={t >= ALL_AT ? ALL_AT : undefined}>{confirmed}/8</Chip>
        </div>
        <Burst t={t} at={ALL_AT} x={560} y={26} />
      </Window>
      <ActionLabel t={t} at={DAYS[1].at + 300} x={300} y={150} text="It sends the reminders for you" tone="amber" after={1400} />
      <ActionLabel t={t} at={CALL_AT2} x={300} y={300} text="It stops at two, so nobody gets spammed" tone="indigo" after={1400} />
    </div>
  );
}

/* ------------------------------------------------------------------ MEALS */

export const CS_MEALS_MS = 12500;

const LINK_AT = 900;
const DROP = [2300, 2700];
const SEND_AT = 3900;
const OPEN = [4600, 5000, 5500, 6000];
const ORDER_AT = 6400;
const CHASE_AT = 8200;
const NOTE_AT = 9600;

export function CallSheetMealsScene({ t }: { t: number }) {
  const list = [
    ...CREW.slice(0, 6).map((c) => ({ ...c, client: false })),
    { n: "Maya Torres", r: "Client", c: "", h: "pink", client: true },
    { n: "Jon Kim", r: "Agency", c: "", h: "cyan", client: true },
  ];
  const sent = t >= SEND_AT;
  const openedIdx = (i: number) => i < OPEN.length && t >= OPEN[i];
  const ordered = t >= ORDER_AT;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window title="Lunch · Day 1" sub="The separate lunch email, handled" right={sent ? <Chip tone="blue" t={t} since={SEND_AT}>Sent · cutoff 10:00 AM</Chip> : <Chip tone="muted" t={t}>Not sent</Chip>}>
        <div className="absolute" style={{ left: 16, top: 64, width: 608 }}>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div>
              <p className="text-[10.5px] font-semibold text-text-faint">Group order link</p>
              <div className="mt-0.5 h-[30px] rounded-[8px] border px-2 text-[11.5px] font-semibold leading-[28px]" style={{ borderColor: t >= LINK_AT - 200 && t < LINK_AT + 1200 ? "var(--accent)" : "var(--border)" }}>
                {typed("doordash.com/group/8f2kd", t, LINK_AT, 40)}
              </div>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold text-text-faint">Cutoff</p>
              <div className="mt-0.5 h-[30px] rounded-[8px] border border-border px-2 text-[11.5px] font-semibold leading-[28px]">10:00 AM</div>
            </div>
          </div>
          <p className="mt-3 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-faint">Who is on this order</p>
          <div className="mt-1 grid grid-cols-2 gap-x-4">
            {list.map((c, i) => {
              const out = c.client && t >= DROP[c.n === "Maya Torres" ? 0 : 1];
              const opened = sent && !c.client && openedIdx(i);
              const isOrdered = ordered && i === 0;
              return (
                <div key={c.n} className="flex h-[32px] items-center gap-2 border-b border-border text-[11.5px]" style={{ opacity: out ? 0.45 : 1, transition: "opacity .3s" }}>
                  <span className="grid h-4 w-4 place-items-center rounded-[4px] border text-[10px] font-black text-white" style={{ background: out ? "transparent" : "var(--accent)", borderColor: out ? "var(--border-strong)" : "var(--accent)" }}>
                    {out ? "" : "✓"}
                  </span>
                  <span className="flex-1 font-bold">{c.n}</span>
                  {sent && !c.client ? (
                    <Chip tone={isOrdered ? "green" : opened ? "blue" : "amber"} t={t} since={isOrdered ? ORDER_AT : opened ? OPEN[i] : SEND_AT}>
                      {isOrdered ? "Ordered" : opened ? "Opened" : t >= CHASE_AT ? "Reminded" : "Not yet"}
                    </Chip>
                  ) : c.client ? (
                    <span className="text-[10.5px] text-text-faint">{c.r}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            {!sent ? <Btn press={t >= SEND_AT - 60}>Save and send</Btn> : <Btn tone="quiet" on={t >= CHASE_AT - 300} press={t >= CHASE_AT - 60 && t < CHASE_AT + 80}>Chase outstanding</Btn>}
            {sent ? <span className="text-[11px] text-text-faint">Nothing goes out after the cutoff.</span> : null}
          </div>
        </div>
        {/* The notation on the printed sheet */}
        {t >= NOTE_AT ? (
          <div className="absolute rounded-[10px] border border-border bg-surface-2 px-3 py-2" style={{ left: 16, bottom: 14, width: 608, ...arrive(t, NOTE_AT, 10) }}>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--h-amber)" }}>Meals · on the printed call sheet</p>
            <p className="text-[12px] font-semibold">Lunch 12:30 · group order, order by 10:00 AM (link sent separately)</p>
          </div>
        ) : null}
      </Window>
      <ActionLabel t={t} at={LINK_AT} x={330} y={80} text="Paste the group-order link" after={1100} />
      <ActionLabel t={t} at={DROP[0]} x={350} y={240} text="Leave the client off the crew lunch" tone="muted" after={900} />
      <ActionLabel t={t} at={5000} x={300} y={160} text="See who opened it" tone="blue" after={1300} />
      <ActionLabel t={t} at={CHASE_AT} x={150} y={300} text="Chase the rest in one click" tone="amber" after={1200} />
      <ActionLabel t={t} at={NOTE_AT} x={280} y={360} text="The sheet carries the note, never the link" tone="indigo" after={1800} />
      <Cursor
        t={t}
        travel={650}
        path={[
          { t: 400, x: 320, y: 380 },
          { t: LINK_AT, x: 200, y: 96, click: true },
          { t: DROP[0], x: 30, y: 242, click: true },
          { t: DROP[1], x: 334, y: 242, click: true },
          { t: SEND_AT, x: 70, y: 285, click: true },
          { t: CHASE_AT, x: 80, y: 285, click: true },
        ]}
      />
    </div>
  );
}

