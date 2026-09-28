"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The home hero's animated product scene. A PROTOTYPE, not placed on any page:
 * it lives at /dev/hero-motion until the operator decides where it goes.
 *
 * WHAT IT IS, and why it is not a screen recording. The reference the operator
 * pointed at (monday.com's hero, 2026-09-27) is a hand-built, SIMPLIFIED version
 * of their board, animated in code: a floating chip lands on a row, types what
 * just happened, and the status cell shimmers over to done with a small burst.
 * A recording of the real app cannot do that, because the real app is dense
 * (13px type at hero size is a grey mosaic) and its changes are instant, which
 * is right for a tool and flat for a pitch. So this is an illustration built
 * from the product's own vocabulary and tokens, clearly drawn rather than
 * photographed, which is the line section 4.6 draws for motifs.
 *
 * THE STORY IS THE HEADLINE: one place for the whole job. Four beats, one per
 * end of the job, each a second or two, on one persistent board so the eye
 * never has to find its place again:
 *   1. the client approves the storyboard
 *   2. the schedule re-flows around a fixed lunch and lands on its wrap
 *   3. the crew confirm the call sheet, 0 to 12
 *   4. a vendor invoice lands on the budget and the margin updates
 *
 * Motion rules copied from the reference because they are what makes it read
 * as "snappy" rather than "animated": springy overshoot on anything that
 * arrives, a short shimmer before a status changes (so the change is noticed),
 * text that types rather than appears, and a beat length of about 2.2s.
 *
 * Reduced motion gets the finished board, still. No timers run at all.
 */

type Tone = "muted" | "amber" | "blue" | "green" | "indigo";

type RowState = { status: string; tone: Tone; flash: number };

const ROWS = [
  { key: "board", label: "Storyboard", sub: "12 frames", hue: "purple" },
  { key: "shots", label: "Shot list", sub: "16 shots", hue: "blue" },
  { key: "sched", label: "Schedule", sub: "Day 1", hue: "green" },
  { key: "call", label: "Call sheet", sub: "Thu, Oct 6", hue: "amber" },
  { key: "budget", label: "Budget", sub: "Bid $42,000", hue: "indigo" },
] as const;

type RowKey = (typeof ROWS)[number]["key"];

const START: Record<RowKey, RowState> = {
  board: { status: "In review", tone: "amber", flash: 0 },
  shots: { status: "Locked", tone: "green", flash: 0 },
  sched: { status: "Draft", tone: "muted", flash: 0 },
  call: { status: "Sent", tone: "blue", flash: 0 },
  budget: { status: "On track", tone: "blue", flash: 0 },
};

const DONE: Record<RowKey, RowState> = {
  board: { status: "Approved", tone: "green", flash: 0 },
  shots: { status: "Locked", tone: "green", flash: 0 },
  sched: { status: "On target", tone: "green", flash: 0 },
  call: { status: "Confirmed", tone: "green", flash: 0 },
  budget: { status: "31% margin", tone: "green", flash: 0 },
};

/** Who says what, and where. The chip carries the beat. */
const BEATS: { row: RowKey; who: string; initials: string; hue: string; line: string; tag: string; next: RowState }[] = [
  { row: "board", who: "Maya, client", initials: "MC", hue: "pink", line: "Approved the storyboard", tag: "Approved", next: DONE.board },
  { row: "sched", who: "Sam, 1st AD", initials: "SA", hue: "green", line: "Lunch fixed at 1:00, day re-flowed", tag: "Wrap 5:00", next: DONE.sched },
  { row: "call", who: "Crew", initials: "12", hue: "amber", line: "12 of 12 confirmed", tag: "Confirmed", next: DONE.call },
  { row: "budget", who: "Northline Grip", initials: "NG", hue: "blue", line: "Invoice logged, $2,400", tag: "Paid", next: DONE.budget },
];

const BEAT_MS = 2300;
const HEAD = 64; // board header height
const ROW = 64; // row pitch

const TONE: Record<Tone, { fg: string; bg: string }> = {
  muted: { fg: "var(--text-muted)", bg: "var(--surface-2)" },
  amber: { fg: "var(--h-amber)", bg: "var(--h-amber-bg)" },
  blue: { fg: "var(--h-blue)", bg: "var(--h-blue-bg)" },
  green: { fg: "var(--h-green)", bg: "var(--h-green-bg)" },
  indigo: { fg: "var(--h-indigo)", bg: "var(--h-indigo-bg)" },
};

const SPRING = "cubic-bezier(.34,1.56,.64,1)";

export function HeroMotion() {
  const [reduced, setReduced] = useState(false);
  const [rows, setRows] = useState<Record<RowKey, RowState>>(START);
  const [beat, setBeat] = useState(-1); // -1 = chip offstage
  const [typed, setTyped] = useState("");
  const [tagOn, setTagOn] = useState(false);
  const [confirmed, setConfirmed] = useState(4);
  const [wrap, setWrap] = useState(270); // minutes after noon: 4:30 pm
  const [spend, setSpend] = useState(0.58);
  const [cycle, setCycle] = useState(0);
  const timers = useRef<number[]>([]);

  // The clip recorder restarts the loop once the page has painted, so a
  // recording opens on the first beat rather than halfway through it.
  useEffect(() => {
    const restart = () => setCycle((c) => c + 1);
    window.addEventListener("hero-motion:restart", restart);
    return () => window.removeEventListener("hero-motion:restart", restart);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (reduced) {
      setRows(DONE);
      setConfirmed(12);
      setWrap(300);
      setSpend(0.69);
      setBeat(-1);
      return;
    }
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const every = (ms: number, n: number, fn: (i: number) => void, start: number) => {
      for (let i = 1; i <= n; i++) at(start + i * ms, () => fn(i));
    };

    // Reset for this cycle.
    setRows(START);
    setConfirmed(4);
    setWrap(270);
    setSpend(0.58);
    setBeat(-1);
    setTyped("");
    setTagOn(false);

    BEATS.forEach((b, i) => {
      const t0 = 500 + i * BEAT_MS;
      at(t0, () => {
        setBeat(i);
        setTyped("");
        setTagOn(false);
      });
      // Type the line: fast, like the reference, about 22ms a character.
      every(22, b.line.length, (n) => setTyped(b.line.slice(0, n)), t0 + 260);
      const typedAt = t0 + 260 + b.line.length * 22;

      // The row's own evidence moves while the line types.
      if (b.row === "sched") every(60, 6, (n) => setWrap(270 + n * 5), t0 + 300);
      if (b.row === "call") every(70, 8, (n) => setConfirmed(4 + n), t0 + 250);
      if (b.row === "budget") at(t0 + 300, () => setSpend(0.69));

      // Shimmer, then the status flips with a burst.
      at(typedAt + 80, () =>
        setRows((r) => ({ ...r, [b.row]: { ...r[b.row], flash: r[b.row].flash + 1 } })),
      );
      at(typedAt + 380, () => {
        setTagOn(true);
        setRows((r) => ({ ...r, [b.row]: { ...b.next, flash: r[b.row].flash } }));
      });
    });

    const end = 500 + BEATS.length * BEAT_MS;
    at(end, () => setBeat(-1));
    at(end + 1600, () => setCycle((c) => c + 1));

    const list = timers.current;
    return () => {
      list.forEach(clearTimeout);
      timers.current = [];
    };
  }, [reduced, cycle]);

  const active = beat >= 0 ? BEATS[beat] : null;
  const rowIdx = active ? ROWS.findIndex((r) => r.key === active.row) : 0;
  const allDone = beat === -1 && rows.budget.status === DONE.budget.status;

  return (
    <div
      className="relative mx-auto w-full max-w-[700px] select-none"
      aria-label="Illustration: a project board where the storyboard is approved, the schedule re-flows, the crew confirm the call sheet and an invoice lands on the budget."
      role="img"
    >
      <style>{CSS}</style>

      {/* The board */}
      <div className="overflow-hidden rounded-[22px] border border-border bg-surface shadow-[0_30px_80px_-30px_rgba(40,30,90,.35)]">
        <div className="flex items-center gap-3 border-b border-border px-5" style={{ height: HEAD }}>
          <span className="h-3 w-3 rounded-full" style={{ background: "var(--h-indigo)" }} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-extrabold text-text">Bright Water · Hero spot</p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors duration-500"
            style={{
              color: allDone ? TONE.green.fg : TONE.indigo.fg,
              background: allDone ? TONE.green.bg : TONE.indigo.bg,
            }}
          >
            {allDone ? "Ready to shoot" : "Pre-production"}
          </span>
        </div>

        {ROWS.map((r, i) => {
          const s = rows[r.key];
          const t = TONE[s.tone];
          const lit = active?.row === r.key;
          return (
            <div
              key={r.key}
              className="relative flex items-center gap-3 border-b border-border px-5 last:border-b-0"
              style={{
                height: ROW,
                background: lit ? "color-mix(in oklch, var(--accent) 6%, var(--surface))" : undefined,
                transition: "background .4s ease",
              }}
            >
              <span className="h-8 w-1 rounded-full" style={{ background: `var(--h-${r.hue})` }} />
              <div className="w-[118px] shrink-0">
                <p className="text-[14px] font-bold leading-tight text-text">{r.label}</p>
                <p className="text-[11.5px] leading-tight text-text-faint">{r.sub}</p>
              </div>

              {/* The row's own evidence */}
              <div className="min-w-0 flex-1">
                <Evidence k={r.key} confirmed={confirmed} wrap={wrap} spend={spend} />
              </div>

              {/* Status cell */}
              <div
                key={`${r.key}-${s.flash}`}
                className="hm-cell relative w-[104px] shrink-0 overflow-hidden rounded-[8px] px-2 py-1.5 text-center text-[12px] font-bold"
                style={{
                  color: t.fg,
                  background: t.bg,
                  transition: `background .35s ease, color .35s ease`,
                }}
              >
                {s.flash > 0 ? <span className="hm-shimmer" /> : null}
                <span key={s.status} className="hm-pop relative inline-block">
                  {s.status}
                </span>
                {s.flash > 0 && s.tone === "green" ? <Burst /> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* The floating chip that carries each beat */}
      <div
        className="pointer-events-none absolute right-[-18px] z-10 sm:right-[-34px]"
        style={{
          top: HEAD + rowIdx * ROW + ROW / 2 - 24,
          opacity: active ? 1 : 0,
          transform: active ? "scale(1)" : "scale(.85)",
          transition: `top .55s ${SPRING}, opacity .25s ease, transform .45s ${SPRING}`,
        }}
      >
        <div className="flex h-12 items-center gap-2.5 rounded-full border border-border bg-surface pl-1.5 pr-2 shadow-[0_14px_36px_-12px_rgba(40,30,90,.45)] ring-2 ring-[color-mix(in_oklch,var(--accent)_30%,transparent)]">
          {active ? (
            <span
              key={active.initials + beat}
              className="hm-pop grid h-9 w-9 place-items-center rounded-full text-[11px] font-extrabold"
              style={{ background: `var(--h-${active.hue}-bg)`, color: `var(--h-${active.hue})` }}
            >
              {active.initials}
            </span>
          ) : null}
          <div className="w-[196px] sm:w-[232px]">
            <p className="truncate text-[10.5px] font-semibold leading-tight text-text-faint">{active?.who}</p>
            <p className="truncate text-[13px] font-bold leading-tight text-text">
              {typed}
              <span className="hm-caret" />
            </p>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-extrabold"
            style={{
              color: "white",
              background: "var(--h-green)",
              opacity: tagOn ? 1 : 0,
              transform: tagOn ? "scale(1)" : "scale(.6)",
              transition: `opacity .2s ease, transform .4s ${SPRING}`,
            }}
          >
            {active?.tag}
          </span>
        </div>
      </div>
    </div>
  );
}

/** A small picture of each document, so a row says what it is at a glance. */
function Evidence({ k, confirmed, wrap, spend }: { k: RowKey; confirmed: number; wrap: number; spend: number }) {
  if (k === "board")
    return (
      <div className="flex gap-1.5">
        {["purple", "blue", "pink", "amber", "green"].map((h, i) => (
          <span
            key={h}
            className="relative h-7 w-11 overflow-hidden rounded-[5px]"
            style={{ background: `linear-gradient(135deg, var(--h-${h}-bg), var(--surface-2))` }}
          >
            <span className="absolute bottom-1 left-1 h-1 w-5 rounded-full" style={{ background: `var(--h-${h})`, opacity: 0.5 }} />
            {i === 1 ? (
              <span className="absolute right-0.5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-black text-white" style={{ background: "var(--accent)" }}>
                1
              </span>
            ) : null}
          </span>
        ))}
      </div>
    );
  if (k === "shots")
    return (
      <div className="flex flex-col gap-1">
        {[88, 70, 80].map((w, i) => (
          <span key={i} className="h-1.5 rounded-full bg-surface-2" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  if (k === "sched") {
    const h = 12 + Math.floor(wrap / 60) - 12;
    const m = wrap % 60;
    const label = `${h === 0 ? 12 : h}:${String(m).padStart(2, "0")} PM`;
    const on = wrap >= 300;
    return (
      <div className="flex items-center gap-2">
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: "34%", background: "var(--h-blue)" }} />
          <span className="absolute inset-y-0 rounded-full" style={{ left: "36%", width: "10%", background: "var(--h-amber)" }} />
          <span
            className="absolute inset-y-0 rounded-full"
            style={{ left: "48%", width: `${36 + (wrap - 270) / 3}%`, background: "var(--h-green)", transition: `width .3s ${SPRING}` }}
          />
        </div>
        <span className="w-[62px] text-right text-[11.5px] font-bold tabular-nums" style={{ color: on ? "var(--h-green)" : "var(--text-muted)" }}>
          {label}
        </span>
      </div>
    );
  }
  if (k === "call")
    return (
      <div className="flex items-center gap-2">
        <div className="flex -space-x-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="h-4 w-4 rounded-full border-2 border-surface"
              style={{
                background: i < confirmed ? "var(--h-green)" : "var(--surface-2)",
                transform: i < confirmed ? "scale(1)" : "scale(.8)",
                transition: `background .2s ease, transform .35s ${SPRING}`,
              }}
            />
          ))}
        </div>
        <span className="text-[11.5px] font-bold tabular-nums text-text-muted">{confirmed}/12</span>
      </div>
    );
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${spend * 100}%`, background: "var(--h-indigo)", transition: `width .7s ${SPRING}` }}
        />
      </div>
      <span className="w-[62px] text-right text-[11.5px] font-bold tabular-nums text-text-muted">
        ${Math.round(42 * spend)}k
      </span>
    </div>
  );
}

/** Eight dots thrown out of the status cell when it lands on green. */
function Burst() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const hues = ["green", "amber", "blue", "pink"];
        return (
          <span
            key={i}
            className="hm-dot absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
            style={
              {
                background: `var(--h-${hues[i % 4]})`,
                "--dx": `${Math.cos(a) * 46}px`,
                "--dy": `${Math.sin(a) * 26}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

const CSS = `
.hm-cell { overflow: visible; }
.hm-shimmer {
  position: absolute; inset: 0; border-radius: 8px; overflow: hidden;
  background: linear-gradient(100deg, transparent 20%, color-mix(in oklch, var(--h-pink) 35%, transparent) 40%, color-mix(in oklch, var(--h-blue) 35%, transparent) 55%, transparent 75%);
  background-size: 250% 100%;
  animation: hm-sweep .5s ease-out 1 both;
}
@keyframes hm-sweep { from { background-position: 120% 0 } to { background-position: -40% 0; opacity: 0 } }
.hm-pop { animation: hm-pop .45s cubic-bezier(.34,1.56,.64,1) both; }
@keyframes hm-pop { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
.hm-dot { animation: hm-dot .6s cubic-bezier(.2,.8,.3,1) both; }
@keyframes hm-dot {
  from { transform: translate(-50%,-50%) scale(1); opacity: 1 }
  to { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.3); opacity: 0 }
}
.hm-caret { display: inline-block; width: 1.5px; height: 1em; margin-left: 1px; vertical-align: -2px; background: var(--accent); animation: hm-blink 1s steps(1) infinite; }
@keyframes hm-blink { 50% { opacity: 0 } }
@media (prefers-reduced-motion: reduce) {
  .hm-shimmer, .hm-dot { display: none }
  .hm-pop, .hm-caret { animation: none }
}
`;
