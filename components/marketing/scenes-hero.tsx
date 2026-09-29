"use client";

import {
  Avatar,
  Burst,
  Chip,
  Cursor,
  Window,
  arrive,
  easeOut,
  lerp,
  ramp,
  roll,
  spring,
  typed,
  usd,
} from "./scene-kit";

/*
 * The three scenes the home hero cycles through, one per headline promise:
 * "client approvals that do not get lost, call sheets that confirm themselves,
 * and a budget that tells you what the job actually made". Each is a pure
 * function of t (see scene-kit.tsx) on a 640x440 drawing.
 */

/* ------------------------------------------------------------------ REVIEW */

export const REVIEW_MS = 8600;

const PINS = [
  { n: 1, x: 202, y: 250, at: 1000, who: "Maya", role: "Client", hue: "pink", text: "Turn the label toward camera a touch." },
  { n: 2, x: 290, y: 300, at: 2500, who: "Jon", role: "Agency", hue: "cyan", text: "Warmer light on the glass, please." },
  { n: 3, x: 118, y: 170, at: 4000, who: "Maya", role: "Client", hue: "pink", text: "The splash is perfect. Keep it." },
];
const RESOLVE = [5200, 5450, 5700];
const APPROVE_AT = 6600;

export function ReviewScene({ t }: { t: number }) {
  const approved = t >= APPROVE_AT;
  const count = PINS.filter((p) => t >= p.at).length;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="Hero pack shot · v3"
        sub="Shared with Maya at Bright Water · no login"
        right={
          approved ? (
            <Chip tone="green" t={t} since={APPROVE_AT}>Approved</Chip>
          ) : (
            <Chip tone="amber" t={t}>In review</Chip>
          )
        }
      >
        {/* The frame under review: a drawn pack shot, not a photograph. */}
        <div
          className="absolute overflow-hidden rounded-[14px]"
          style={{
            left: 16,
            top: 68,
            width: 372,
            height: 356,
            background: "linear-gradient(160deg, var(--h-cyan-bg) 0%, var(--h-blue-bg) 55%, var(--surface-2) 100%)",
          }}
        >
          <PackShot />
        </div>

        {/* Comment rail */}
        <div className="absolute" style={{ left: 404, top: 68, width: 220, height: 356 }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-faint">
            Comments · {count}
          </p>
          <div className="mt-2 space-y-2">
            {PINS.map((p, i) =>
              t >= p.at ? (
                <div
                  key={p.n}
                  className="rounded-[10px] border border-border bg-surface p-2"
                  style={{
                    ...arrive(t, p.at + 60),
                    boxShadow: t < p.at + 1400 ? "0 0 0 2px color-mix(in oklch, var(--accent) 35%, transparent)" : undefined,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <PinDot n={p.n} done={t >= RESOLVE[i]} size={16} />
                    <span className="text-[11.5px] font-bold">{p.who}</span>
                    <span className="text-[10px] text-text-faint">{p.role}</span>
                    {t >= RESOLVE[i] ? (
                      <span className="ml-auto text-[10px] font-bold" style={{ color: "var(--h-green)", ...arrive(t, RESOLVE[i], 4) }}>
                        Resolved
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 min-h-[30px] text-[11.5px] leading-snug text-text-muted">
                    {typed(p.text, t, p.at + 250, 18)}
                  </p>
                </div>
              ) : null,
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex gap-2">
            <span
              className="flex-1 rounded-[9px] py-2 text-center text-[12px] font-extrabold text-white"
              style={{
                background: "var(--h-green)",
                transform: `scale(${t >= APPROVE_AT - 60 && t < APPROVE_AT + 160 ? 0.94 : 1})`,
                transition: "transform .12s",
              }}
            >
              {approved ? "Approved ✓" : "Approve"}
            </span>
            <span className="flex-1 rounded-[9px] border border-border py-2 text-center text-[12px] font-bold text-text-muted">
              Request changes
            </span>
          </div>
          <Burst t={t} at={APPROVE_AT} x={52} y={338} spread={1.4} />
        </div>

        {/* Pins over the frame */}
        {PINS.map((p, i) => {
          const s = spring(ramp(t, p.at, 480));
          if (s <= 0) return null;
          return (
            <div
              key={p.n}
              className="absolute"
              style={{ left: p.x - 14, top: p.y - 14, transform: `scale(${s})`, transformOrigin: "50% 100%" }}
            >
              <PinDot n={p.n} done={t >= RESOLVE[i]} size={28} ring />
            </div>
          );
        })}
      </Window>
      <Cursor
        t={t}
        path={[
          { t: 500, x: 330, y: 400 },
          { t: 1000, x: 206, y: 254, click: true },
          { t: 2500, x: 294, y: 304, click: true },
          { t: 4000, x: 122, y: 174, click: true },
          { t: 5000, x: 300, y: 380 },
          { t: APPROVE_AT, x: 462, y: 408, click: true },
        ]}
      />
    </div>
  );
}

function PinDot({ n, done, size, ring }: { n: number; done: boolean; size: number; ring?: boolean }) {
  return (
    <span
      className="grid place-items-center rounded-full font-black text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.46,
        background: done ? "var(--h-green)" : "var(--accent)",
        boxShadow: ring ? "0 0 0 3px white, 0 6px 14px -4px rgba(20,15,60,.45)" : undefined,
        transition: "background .3s",
      }}
    >
      {done ? "✓" : n}
    </span>
  );
}

/** A bottle, a glass and a splash, in tokens. */
function PackShot() {
  return (
    <svg viewBox="0 0 372 356" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <ellipse cx="186" cy="318" rx="170" ry="26" fill="var(--surface)" opacity=".7" />
      {/* splash */}
      {[
        [104, 108, 9],
        [128, 88, 6],
        [86, 130, 5],
        [146, 116, 4],
        [112, 70, 4],
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="var(--h-cyan)" opacity={0.55 - i * 0.06} />
      ))}
      {/* bottle */}
      <rect x="160" y="70" width="52" height="24" rx="6" fill="var(--h-indigo)" />
      <path d="M156 94 h60 q14 20 14 44 v164 q0 12 -12 12 h-64 q-12 0 -12 -12 v-164 q0 -24 14 -44z" fill="var(--h-blue)" opacity=".85" />
      <rect x="148" y="176" width="76" height="70" rx="8" fill="var(--surface)" />
      <rect x="160" y="192" width="52" height="8" rx="4" fill="var(--h-indigo)" />
      <rect x="166" y="208" width="40" height="5" rx="2.5" fill="var(--text-faint)" />
      <rect x="170" y="220" width="32" height="5" rx="2.5" fill="var(--text-faint)" />
      {/* glass */}
      <path d="M258 236 h54 l-8 74 q-1 8 -9 8 h-20 q-8 0 -9 -8z" fill="var(--surface)" opacity=".75" stroke="var(--h-cyan)" strokeWidth="2" />
      <path d="M262 262 h46 l-5 46 q-1 6 -7 6 h-22 q-6 0 -7 -6z" fill="var(--h-amber)" opacity=".55" />
    </svg>
  );
}

/* --------------------------------------------------------------- CALL SHEET */

export const CALL_MS = 8600;

const CREW = [
  { name: "Dana Reyes", role: "Director", call: "7:00 AM", hue: "purple", viewed: 500, confirmed: 1300 },
  { name: "Sam Ortiz", role: "1st AD", call: "6:30 AM", hue: "green", viewed: 650, confirmed: 1700 },
  { name: "Priya Shah", role: "DP", call: "6:45 AM", hue: "blue", viewed: 900, confirmed: 2100 },
  { name: "Leo Park", role: "Gaffer", call: "6:45 AM", hue: "amber", viewed: 5000, confirmed: 5900 },
  { name: "Nina Cole", role: "Key grip", call: "6:45 AM", hue: "cyan", viewed: 1200, confirmed: 2600 },
  { name: "Ava Brooks", role: "Prop stylist", call: "7:00 AM", hue: "pink", viewed: 1500, confirmed: 3000 },
  { name: "Theo Lin", role: "Food stylist", call: "6:30 AM", hue: "orange", viewed: 1800, confirmed: 3500 },
  { name: "Mia Chen", role: "PA", call: "6:15 AM", hue: "indigo", viewed: 5300, confirmed: 6400 },
];
const REMIND_AT = 4200;
const ALL_IN = 6900;

export function CallSheetScene({ t }: { t: number }) {
  const confirmed = CREW.filter((c) => t >= c.confirmed).length;
  const done = t >= ALL_IN;
  const ring = confirmed / CREW.length;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="Call sheet · Day 1"
        sub="Thu, Oct 6 · Stage 2, Culver City"
        right={done ? <Chip tone="green" t={t} since={ALL_IN}>All confirmed</Chip> : <Chip tone="blue" t={t}>Sent to 8</Chip>}
      >
        {/* Masthead */}
        <div
          className="absolute flex items-center gap-5 rounded-[14px] px-5"
          style={{ left: 16, top: 66, width: 608, height: 74, background: "linear-gradient(120deg, var(--h-amber-bg), var(--surface-2))" }}
        >
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--h-amber)" }}>
              General call
            </p>
            <p className="font-display text-[28px] font-extrabold leading-none">7:00 AM</p>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="grid flex-1 grid-cols-3 gap-2 text-[11px]">
            {[
              ["Breakfast", "6:30"],
              ["Lunch", "12:30"],
              ["Wrap", "6:00 PM"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-text-faint">{k}</p>
                <p className="font-bold">{v}</p>
              </div>
            ))}
          </div>
          <div className="relative grid h-[56px] w-[56px] place-items-center">
            <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
              <circle cx="28" cy="28" r="23" fill="none" stroke="var(--surface)" strokeWidth="6" />
              <circle
                cx="28"
                cy="28"
                r="23"
                fill="none"
                stroke="var(--h-green)"
                strokeWidth="6"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1 - ring}
                style={{ transition: "stroke-dashoffset .5s cubic-bezier(.34,1.56,.64,1)" }}
              />
            </svg>
            <span className="relative text-[13px] font-extrabold tabular-nums">
              {confirmed}/{CREW.length}
            </span>
          </div>
          <Burst t={t} at={ALL_IN} x={584} y={36} spread={1.2} />
        </div>

        {/* Crew */}
        <div className="absolute" style={{ left: 16, top: 152, width: 608 }}>
          {CREW.map((c) => {
            const state = t >= c.confirmed ? "Confirmed" : t >= c.viewed ? "Viewed" : "Sent";
            const since = t >= c.confirmed ? c.confirmed : t >= c.viewed ? c.viewed : -1e9;
            const tone = state === "Confirmed" ? "green" : state === "Viewed" ? "blue" : "muted";
            const chased = (c.viewed > REMIND_AT) && t >= REMIND_AT && t < c.confirmed;
            return (
              <div
                key={c.name}
                className="flex h-[34px] items-center gap-3 border-b border-border px-1 last:border-b-0"
                style={{ background: t >= c.confirmed && t < c.confirmed + 600 ? "color-mix(in oklch, var(--h-green) 7%, transparent)" : undefined }}
              >
                <Avatar name={c.name} hue={c.hue} size={24} />
                <span className="w-[120px] text-[12.5px] font-bold">{c.name}</span>
                <span className="w-[110px] text-[11.5px] text-text-muted">{c.role}</span>
                <span className="flex-1 text-[11.5px] font-semibold tabular-nums text-text-muted">{c.call}</span>
                {chased ? (
                  <span className="text-[10.5px] font-bold" style={{ color: "var(--h-amber)", ...arrive(t, REMIND_AT, 4) }}>
                    Reminded
                  </span>
                ) : null}
                <Chip tone={tone} t={t} since={since} className="w-[92px] justify-center">
                  {state}
                </Chip>
              </div>
            );
          })}
        </div>

        {/* The chase, done for you */}
        {t >= REMIND_AT && t < 6300 ? (
          <div
            className="absolute flex items-center gap-2.5 rounded-[12px] border border-border bg-surface px-3 py-2.5 shadow-[0_16px_40px_-14px_rgba(40,30,90,.5)]"
            style={{ right: 20, bottom: 18, ...arrive(t, REMIND_AT, 16), opacity: t > 6000 ? 1 - ramp(t, 6000, 300) : arrive(t, REMIND_AT, 16).opacity }}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "var(--h-amber-bg)", color: "var(--h-amber)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </span>
            <div>
              <p className="text-[12px] font-bold">Reminder sent to 2 people</p>
              <p className="text-[10.5px] text-text-faint">Leo and Mia had not opened it</p>
            </div>
          </div>
        ) : null}
      </Window>
    </div>
  );
}

/* ------------------------------------------------------------------ BUDGET */

export const BUDGET_MS = 8800;

const LINES = [
  { name: "Crew", bid: 12000, actual: 9800 },
  { name: "Camera & grip", bid: 8500, actual: 6100, gets: 2400 },
  { name: "Art department", bid: 6000, actual: 5200 },
  { name: "Catering", bid: 2400, actual: 1900 },
  { name: "Post", bid: 7000, actual: 3600 },
];
const BILLED = 42000;
const LAND_AT = 3600; // the invoice files onto its line
const MARGIN_AT = 5600;
const DONE_AT = 6800;

export function BudgetScene({ t }: { t: number }) {
  const extra = roll(0, 2400, t, LAND_AT, 800);
  const cost = 26600 + extra;
  const margin = ((BILLED - cost) / BILLED) * 100;
  // The invoice: slides in, is read, then flies to its line.
  const inP = spring(ramp(t, 700, 600));
  const fly = easeOut(ramp(t, LAND_AT - 500, 520));
  const cardX = lerp(lerp(700, 372, inP), 250, fly);
  const cardY = lerp(292, 170 + 44, fly);
  const cardS = lerp(1, 0.35, fly);
  const cardO = t < LAND_AT - 500 ? 1 : 1 - fly;
  return (
    <div className="relative" style={{ width: 640, height: 440 }}>
      <Window
        title="Budget · Bright Water"
        sub="Bid against actual, by line"
        right={t >= DONE_AT ? <Chip tone="green" t={t} since={DONE_AT}>31% margin</Chip> : <Chip tone="blue" t={t}>On track</Chip>}
      >
        {/* Tiles */}
        <div className="absolute grid grid-cols-3 gap-3" style={{ left: 16, top: 66, width: 608 }}>
          {[
            { k: "Billed", v: usd(BILLED), hue: "indigo" },
            { k: "Job cost", v: usd(cost), hue: "amber", live: t >= LAND_AT && t < LAND_AT + 900 },
            { k: "Margin", v: `${margin.toFixed(1)}%`, hue: "green", live: t >= LAND_AT && t < LAND_AT + 900 },
          ].map((x) => (
            <div
              key={x.k}
              className="rounded-[12px] border border-border px-3 py-2"
              style={{
                borderTop: `3px solid var(--h-${x.hue})`,
                background: x.live ? `color-mix(in oklch, var(--h-${x.hue}) 8%, var(--surface))` : "var(--surface)",
              }}
            >
              <p className="text-[10.5px] font-semibold text-text-faint">{x.k}</p>
              <p className="font-display text-[20px] font-extrabold tabular-nums leading-tight">{x.v}</p>
            </div>
          ))}
        </div>

        {/* Lines */}
        <div className="absolute" style={{ left: 16, top: 150, width: 608 }}>
          {LINES.map((l) => {
            const actual = l.actual + (l.gets ? extra : 0);
            const lit = l.gets && t >= LAND_AT - 100 && t < LAND_AT + 1200;
            return (
              <div
                key={l.name}
                className="flex h-[40px] items-center gap-3 rounded-[8px] px-2"
                style={{ background: lit ? "color-mix(in oklch, var(--accent) 8%, transparent)" : undefined }}
              >
                <span className="w-[118px] text-[12.5px] font-bold">{l.name}</span>
                <span className="w-[64px] text-right text-[11px] tabular-nums text-text-faint">{usd(l.bid)}</span>
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(actual / l.bid) * 100}%`, background: l.gets ? "var(--h-amber)" : "var(--h-indigo)" }}
                  />
                </div>
                <span className="w-[64px] text-right text-[12px] font-bold tabular-nums">{usd(actual)}</span>
                <span className="w-[52px]">
                  {l.gets && t >= 5000 ? (
                    <Chip tone="green" t={t} since={5000}>Paid</Chip>
                  ) : l.gets && t >= LAND_AT ? (
                    <Chip tone="amber" t={t} since={LAND_AT}>Owed</Chip>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>

        {/* Margin band */}
        {t >= MARGIN_AT ? (
          <div
            className="absolute rounded-[12px] px-4 py-2.5"
            style={{ left: 16, top: 364, width: 608, background: "linear-gradient(120deg, var(--h-green-bg), var(--surface-2))", ...arrive(t, MARGIN_AT, 12) }}
          >
            <div className="flex items-baseline justify-between">
              <p className="text-[12px] font-bold">What the job made</p>
              <p className="font-display text-[18px] font-extrabold tabular-nums" style={{ color: "var(--h-green)" }}>
                {usd(BILLED - cost)} · {margin.toFixed(0)}%
              </p>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
              <span
                className="block h-full rounded-full"
                style={{ width: `${margin * easeOut(ramp(t, MARGIN_AT + 150, 800))}%`, background: "var(--h-green)" }}
              />
            </div>
            <Burst t={t} at={DONE_AT} x={540} y={10} />
          </div>
        ) : null}

        {/* The invoice arriving, read, and filed */}
        {t >= 700 && cardO > 0 ? (
          <div
            className="absolute w-[240px] rounded-[14px] border border-border bg-surface p-3 shadow-[0_18px_44px_-14px_rgba(40,30,90,.5)]"
            style={{ left: cardX, top: cardY, opacity: cardO, transform: `scale(${cardS})`, transformOrigin: "0 0" }}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-[7px] text-[9px] font-black" style={{ background: "var(--h-red-bg)", color: "var(--h-red)" }}>
                PDF
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold">Northline Grip</p>
                <p className="text-[10.5px] text-text-faint">INV-2231 · from email</p>
              </div>
            </div>
            <div className="mt-2 space-y-1 text-[11px]">
              {[
                ["Amount", "$2,400", 1700],
                ["Due", "Oct 20", 2000],
                ["Line", "Camera & grip", 2300],
              ].map(([k, v, at]) => (
                <div key={k as string} className="flex justify-between">
                  <span className="text-text-faint">{k}</span>
                  <span className="font-bold" style={arrive(t, at as number, 3)}>
                    {t >= (at as number) ? `${v} ✓` : ""}
                  </span>
                </div>
              ))}
            </div>
            {t < 1700 ? (
              <p className="mt-1.5 text-[10.5px] font-semibold" style={{ color: "var(--accent)" }}>
                Reading the invoice…
              </p>
            ) : null}
          </div>
        ) : null}
      </Window>
    </div>
  );
}
