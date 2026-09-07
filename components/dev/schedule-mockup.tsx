"use client";

/**
 * A MOCKUP, not the feature. Hardcoded data, no persistence, no add/edit
 * chrome. It exists so the operator can judge the LAYOUT of a schedule and
 * feel the one behaviour that makes it modern (times cascade, anchors hold)
 * before any schema hardens around it. Same pattern as the shot cluster:
 * build the piece, show it, let them place it. Delete when the real page
 * lands at /projects/[id]/schedule.
 *
 * TWO VIEWS, ONE ROW MODEL, and that is the answer to "would a stripboard
 * make sense on a live-action job". A strip is a row. The DAY view lays one
 * day's rows out on a time rail with computed times, which is the document a
 * commercial unit reads. The BOARD view lays every day out as columns of the
 * same rows, which is where an AD moves shots between days, and where the
 * stripboard's INT/EXT and DAY/NIGHT colours earn their place because on a
 * multi-day live-action job those are real scheduling constraints. On a
 * studio product shoot those fields stay blank, so no colour appears, so
 * they are not noise. Both views read the same strips.
 */

import { useMemo, useState } from "react";
import {
  cascade,
  fmtDuration,
  fmtHM,
  overUnder,
  parseHM,
  type DayNight,
  type IntExt,
  type StripInput,
  type StripKind,
} from "@/lib/schedule-time";

type Strip = StripInput & {
  title: string;
  set?: string;
  intExt?: IntExt;
  dayNight?: DayNight;
  shots?: { code: string; description: string }[];
  people?: string[];
  notes?: string;
};

type Day = {
  id: string;
  n: number;
  date: string;
  callTime: string;
  wrapTarget: string;
  strips: Strip[];
};

type Job = { title: string; client: string; days: Day[] };

// ---------------------------------------------------------------------------
// Data. The Hint job is REAL: these are the shot codes, descriptions and crew
// positions on the project today. The second job is an invented three-day
// live-action example, and says so, to show what the board view is for.
// ---------------------------------------------------------------------------

let n = 0;
const s = (
  kind: StripKind,
  title: string,
  durationMin: number,
  extra: Partial<Strip> = {}
): Strip => ({ id: `s${++n}`, kind, title, durationMin, anchoredAt: null, ...extra });

const HINT: Job = {
  title: "Hint Treat Yourself",
  client: "Hint",
  days: [
    {
      id: "h1", n: 1, date: "2026-09-03", callTime: "8:00", wrapTarget: "6:00 pm",
      strips: [
        s("call", "Crew call, load in", 30, { people: ["Gaffer", "Key Grip", "Motion Control Operator"] }),
        s("meal", "Breakfast", 30, { anchoredAt: "9:00" }),
        s("setup", "Light Set A, motion control rig check", 60, { set: "Set A · Cloud wall", people: ["Director of Photography", "Gaffer", "Motion Control Operator"] }),
        s("shot", "Bottle reveal", 120, {
          set: "Set A · Cloud wall",
          shots: [
            { code: "1A", description: "We open closed. A dense wall of pink cloud fills the frame." },
            { code: "1B", description: "The clouds clear away completely and the setup is revealed." },
            { code: "1C", description: "The bottles rotate and lock into perfect alignment." },
          ],
          people: ["Motion Control Operator", "Food Stylist", "Prop Stylist"],
        }),
        s("shot", "Cupcake macro", 90, {
          set: "Set A",
          shots: [{ code: "2", description: "We continue into the strawberry cupcake until it fills the frame." }],
          people: ["Food Stylist", "Food Stylist Assistant"],
        }),
        s("meal", "Lunch", 60, { anchoredAt: "1:00 pm" }),
        s("move", "Reset to Set B", 30, { set: "Set B · Cobbler world", people: ["Prop Stylist", "Prop Stylist Assistant", "Key Grip"] }),
        s("shot", "Cobbler world", 150, {
          set: "Set B · Cobbler world",
          shots: [
            { code: "3", description: "We crest the cupcake and the first fantasy world opens up." },
            { code: "4", description: "The transition lands in the cobbler world. Dolly right." },
          ],
          people: ["Motion Control Operator", "Prop Stylist", "Food Stylist"],
        }),
        s("wrap", "Wrap", 0),
      ],
    },
    {
      id: "h2", n: 2, date: "2026-09-04", callTime: "8:00", wrapTarget: "6:00 pm",
      strips: [
        s("call", "Crew call", 30),
        s("meal", "Breakfast", 30, { anchoredAt: "9:00" }),
        s("setup", "Build pineapple world", 90, { set: "Set C · Pineapple", people: ["Prop Stylist", "Prop Stylist Assistant"] }),
        s("shot", "Pineapple world", 120, {
          set: "Set C · Pineapple",
          shots: [{ code: "5", description: "The transition lands in the pineapple world. A sweeping arch." }],
          people: ["Motion Control Operator", "Food Stylist"],
        }),
        s("meal", "Lunch", 60, { anchoredAt: "1:00 pm" }),
        s("move", "Reset to key lime, rig the descent", 45, { set: "Set D · Key lime" }),
        s("shot", "Key lime descent", 120, {
          set: "Set D · Key lime",
          shots: [
            { code: "6", description: "The transition lands in the key lime world. Then DESCEND." },
            { code: "7", description: "Fully submerged. Open, clear, quiet water. Godray shafts." },
          ],
        }),
        s("shot", "Product beauty", 60, {
          set: "Set E · Beauty",
          shots: [{ code: "8", description: "Final product beauty. The Treat Yourself variety pack." }],
          people: ["Photographer", "Food Stylist"],
        }),
        s("wrap", "Wrap", 0),
      ],
    },
  ],
};

const LIVE: Job = {
  title: "Morning Ritual (example, 3-day live action)",
  client: "Example brand",
  days: [
    {
      id: "l1", n: 1, date: "2026-10-06", callTime: "6:00", wrapTarget: "5:00 pm",
      strips: [
        s("call", "Crew call, talent to HMU", 60, { people: ["1st AD", "HMU", "Wardrobe"] }),
        s("shot", "Kitchen, wake-up sequence", 180, { set: "Kitchen", intExt: "INT", dayNight: "DAY",
          shots: [{ code: "3", description: "She pours the coffee, light through the blinds." }, { code: "4", description: "CU hands, mug." }],
          people: ["Talent A", "DP", "Gaffer"] }),
        s("meal", "Lunch", 60, { anchoredAt: "12:00 pm" }),
        s("move", "Company move to street", 60, { set: "Elm St exterior" }),
        s("shot", "Street, leaving the house", 150, { set: "Elm St", intExt: "EXT", dayNight: "DAY",
          shots: [{ code: "6", description: "Wide, she steps out. Steadicam follow." }],
          people: ["Talent A", "Steadicam"] }),
        s("wrap", "Wrap", 0),
      ],
    },
    {
      id: "l2", n: 2, date: "2026-10-07", callTime: "2:00 pm", wrapTarget: "1:00 am",
      strips: [
        s("call", "Crew call (night)", 60),
        s("shot", "Bedroom, evening wind-down", 180, { set: "Bedroom", intExt: "INT", dayNight: "NIGHT",
          shots: [{ code: "9", description: "Lamp light, she sets the alarm." }],
          people: ["Talent A", "DP"] }),
        s("meal", "Dinner", 60, { anchoredAt: "8:00 pm" }),
        s("shot", "Porch, night", 150, { set: "Porch", intExt: "EXT", dayNight: "NIGHT",
          shots: [{ code: "10", description: "Porch light on, city hum. Locked off." }],
          people: ["Talent A", "Gaffer"] }),
        s("wrap", "Wrap", 0),
      ],
    },
    {
      id: "l3", n: 3, date: "2026-10-08", callTime: "7:00", wrapTarget: "4:00 pm",
      strips: [
        s("call", "Crew call", 30),
        s("shot", "Cafe, the meet", 210, { set: "Roasters Cafe", intExt: "INT", dayNight: "DAY",
          shots: [{ code: "12", description: "Two-shot at the counter." }, { code: "13", description: "Product insert, cup." }],
          people: ["Talent A", "Talent B", "DP"] }),
        s("meal", "Lunch", 60, { anchoredAt: "12:30 pm" }),
        s("shot", "Cafe patio", 120, { set: "Roasters Cafe", intExt: "EXT", dayNight: "DAY",
          shots: [{ code: "14", description: "Wide, they leave together." }] }),
        s("wrap", "Wrap", 0),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Colour as signal. Kind is what a row IS; the stripboard pair is a scheduling
// constraint. They are never shown as the same edge in the same view.
// ---------------------------------------------------------------------------

const KIND: Record<StripKind, { label: string; hue: string }> = {
  call: { label: "Call", hue: "indigo" },
  meal: { label: "Meal", hue: "amber" },
  setup: { label: "Setup", hue: "blue" },
  shot: { label: "Shoot", hue: "green" },
  move: { label: "Move", hue: "orange" },
  note: { label: "Note", hue: "purple" },
  wrap: { label: "Wrap", hue: "indigo" },
};

/** The industry's own four: INT DAY white, EXT DAY yellow, INT NIGHT blue, EXT NIGHT green. */
function boardHue(st: Strip): string | null {
  if (!st.intExt || !st.dayNight) return null;
  if (st.intExt === "INT" && st.dayNight === "DAY") return "border";
  if (st.intExt === "EXT" && st.dayNight === "DAY") return "h-yellow";
  if (st.intExt === "INT" && st.dayNight === "NIGHT") return "h-blue";
  return "h-green";
}

const h = (hue: string) => `var(--${hue.startsWith("h-") || hue === "border" ? hue : `h-${hue}`})`;
const hbg = (hue: string) => `var(--h-${hue}-bg)`;

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------

export function ScheduleMockup() {
  const [jobKey, setJobKey] = useState<"hint" | "live">("hint");
  const [jobs, setJobs] = useState<{ hint: Job; live: Job }>({ hint: HINT, live: LIVE });
  const [view, setView] = useState<"day" | "board">("day");
  const [dayIdx, setDayIdx] = useState(0);
  const [drag, setDrag] = useState<{ dayId: string; stripId: string } | null>(null);

  const job = jobs[jobKey];
  const day = job.days[Math.min(dayIdx, job.days.length - 1)];

  function update(fn: (j: Job) => Job) {
    setJobs((prev) => ({ ...prev, [jobKey]: fn(prev[jobKey]) }));
  }
  function patchStrip(dayId: string, stripId: string, patch: Partial<Strip>) {
    update((j) => ({
      ...j,
      days: j.days.map((d) =>
        d.id !== dayId ? d : { ...d, strips: d.strips.map((x) => (x.id === stripId ? { ...x, ...patch } : x)) }
      ),
    }));
  }
  /** Move a strip to a position in a day (same day = reorder, other day = reschedule). */
  function moveStrip(from: { dayId: string; stripId: string }, toDayId: string, toIndex: number) {
    update((j) => {
      const src = j.days.find((d) => d.id === from.dayId);
      const strip = src?.strips.find((x) => x.id === from.stripId);
      if (!src || !strip) return j;
      const days = j.days.map((d) => ({ ...d, strips: d.strips.filter((x) => x.id !== from.stripId) }));
      const dst = days.find((d) => d.id === toDayId);
      if (!dst) return j;
      // Wrap stays last on its day, whatever gets dropped where.
      const body = dst.strips.filter((x) => x.kind !== "wrap");
      const tail = dst.strips.filter((x) => x.kind === "wrap");
      const idx = Math.max(0, Math.min(toIndex, body.length));
      body.splice(idx, 0, strip);
      dst.strips = [...body, ...tail];
      return { ...j, days };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: which job (mockup only), which view, which day. */}
      <div className="flex flex-wrap items-center gap-2">
        <Seg
          value={jobKey}
          onChange={(v) => { setJobKey(v as "hint" | "live"); setDayIdx(0); }}
          options={[["hint", "Hint (real shots)"], ["live", "3-day live action (example)"]]}
        />
        <span className="flex-1" />
        <Seg value={view} onChange={(v) => setView(v as "day" | "board")} options={[["day", "Day"], ["board", "Board"]]} />
      </div>

      {view === "day" ? (
        <>
          <div className="flex flex-nowrap items-end gap-1 overflow-x-auto border-b border-border">
            {job.days.map((d, i) => {
              const t = cascade(d.strips, parseHM(d.callTime) ?? 0);
              const ou = overUnder(t, parseHM(d.wrapTarget) ?? 0, parseHM(d.callTime) ?? 0);
              const active = i === dayIdx;
              return (
                <button
                  key={d.id}
                  onClick={() => setDayIdx(i)}
                  className={`-mb-px flex shrink-0 flex-col items-start gap-0.5 rounded-t-[10px] border border-b-0 px-4 py-2.5 text-left transition ${
                    active ? "border-border bg-surface" : "border-transparent hover:bg-surface-2"
                  }`}
                >
                  <span className={`text-sm font-bold ${active ? "text-text" : "text-text-muted"}`}>Day {d.n}</span>
                  <span className="text-[11px] text-text-faint">
                    {fmtDate(d.date)} · {d.strips.filter((x) => x.kind === "shot").reduce((k, x) => k + (x.shots?.length ?? 0), 0)} shots ·{" "}
                    <span style={{ color: ou.deltaMin > 0 ? "var(--h-red)" : undefined }}>
                      wraps {fmtHM(ou.endMin)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <DayView
            day={day}
            drag={drag}
            setDrag={setDrag}
            onPatch={(id, p) => patchStrip(day.id, id, p)}
            onMove={(from, idx) => moveStrip(from, day.id, idx)}
          />
        </>
      ) : (
        <BoardView job={job} drag={drag} setDrag={setDrag} onMove={moveStrip} />
      )}
    </div>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="inline-flex rounded-[10px] border border-border bg-surface p-0.5">
      {options.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${
            value === k ? "bg-accent text-accent-fg shadow-sm" : "text-text-muted hover:text-text"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DAY VIEW: one day on a time rail. The times are never typed, they fall out
// of the durations; the AD edits durations and the day re-flows.
// ---------------------------------------------------------------------------

function DayView({
  day, drag, setDrag, onPatch, onMove,
}: {
  day: Day;
  drag: { dayId: string; stripId: string } | null;
  setDrag: (d: { dayId: string; stripId: string } | null) => void;
  onPatch: (stripId: string, patch: Partial<Strip>) => void;
  onMove: (from: { dayId: string; stripId: string }, toIndex: number) => void;
}) {
  const timed = useMemo(() => cascade(day.strips, parseHM(day.callTime) ?? 0), [day]);
  const ou = overUnder(timed, parseHM(day.wrapTarget) ?? 0, parseHM(day.callTime) ?? 0);
  const [over, setOver] = useState<number | null>(null);

  return (
    <div className="rounded-[14px] border border-border bg-surface">
      {/* Day header: the two numbers that bracket everything. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-5 py-3.5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Call</div>
          <div className="text-lg font-extrabold text-text">{fmtHM(parseHM(day.callTime) ?? 0)}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Target wrap</div>
          <div className="text-lg font-extrabold text-text">{fmtHM(parseHM(day.wrapTarget) ?? 0)}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Scheduled wrap</div>
          <div className="text-lg font-extrabold" style={{ color: ou.deltaMin > 0 ? "var(--h-red)" : "var(--h-green)" }}>
            {fmtHM(ou.endMin)}
            <span className="ml-2 text-xs font-bold">
              {ou.deltaMin === 0 ? "on target" : ou.deltaMin > 0 ? `${fmtDuration(ou.deltaMin)} over` : `${fmtDuration(-ou.deltaMin)} under`}
            </span>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 sm:px-4">
        {timed.map((st, i) => {
          const k = KIND[st.kind];
          const isWrap = st.kind === "wrap";
          const dragging = drag?.stripId === st.id;
          return (
            <div key={st.id}>
              {/* Slack against an anchor, shown ABOVE the anchored row where the
                  gap or the overrun actually sits. */}
              {st.slackMin !== null && st.slackMin !== 0 && (
                <div
                  className="ml-[76px] my-1 flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-xs font-semibold"
                  style={{
                    backgroundColor: st.slackMin < 0 ? "var(--h-red-bg)" : "var(--h-green-bg)",
                    color: st.slackMin < 0 ? "var(--h-red)" : "var(--h-green)",
                  }}
                >
                  {st.slackMin < 0
                    ? `Runs ${fmtDuration(-st.slackMin)} into ${st.title.toLowerCase()}`
                    : `${fmtDuration(st.slackMin)} buffer before ${st.title.toLowerCase()}`}
                </div>
              )}
              {/* Drop target line. */}
              <div
                onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(i); } }}
                onDragLeave={() => setOver((o) => (o === i ? null : o))}
                onDrop={(e) => { e.preventDefault(); if (drag) onMove(drag, i); setDrag(null); setOver(null); }}
                className={`h-1.5 rounded-full transition ${over === i && drag ? "my-1 bg-accent" : ""}`}
              />
              <div
                draggable={!isWrap}
                onDragStart={() => setDrag({ dayId: day.id, stripId: st.id })}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                className={`grid grid-cols-[64px_4px_1fr] gap-x-3 rounded-[10px] py-2.5 pr-2 transition sm:grid-cols-[64px_4px_1fr_auto] ${
                  dragging ? "opacity-40" : "hover:bg-surface-2"
                }`}
              >
                {/* Time rail: start bold, end faint. Wrap has only a start. */}
                <div className="pt-0.5 text-right">
                  <div className="text-sm font-extrabold tabular-nums text-text">{fmtHM(st.startMin)}</div>
                  {!isWrap && st.durationMin > 0 && (
                    <div className="text-[11px] tabular-nums text-text-faint">{fmtHM(st.endMin)}</div>
                  )}
                </div>
                {/* Kind bar. */}
                <div className="rounded-full" style={{ backgroundColor: h(k.hue) }} />
                {/* Content. */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className="inline-flex items-center gap-1 rounded-pill px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wide"
                      style={{ backgroundColor: hbg(k.hue), color: h(k.hue) }}
                    >
                      {k.label}
                    </span>
                    {st.intExt && st.dayNight && (
                      <span className="rounded-pill border border-border px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wide text-text-muted">
                        {st.intExt} · {st.dayNight}
                      </span>
                    )}
                    <span className={`text-[15px] font-bold ${isWrap ? "text-text-muted" : "text-text"}`}>{st.title}</span>
                    {st.set && <span className="text-xs text-text-muted">{st.set}</span>}
                    {st.anchoredAt && <Pin />}
                  </div>
                  {st.shots && st.shots.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {st.shots.map((sh) => (
                        <span key={sh.code} className="inline-flex max-w-full items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2 py-1 text-xs">
                          <span className="rounded-[5px] bg-surface-2 px-1.5 font-bold tabular-nums text-text">{sh.code}</span>
                          <span className="truncate text-text-muted">{sh.description}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {st.people && st.people.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {st.people.map((p) => (
                        <span key={p} className="rounded-pill bg-surface-2 px-2 py-[2px] text-[11px] font-medium text-text-muted">{p}</span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Controls: the duration is the only thing the AD types. */}
                {!isWrap && (
                  <div className="col-span-3 mt-2 flex items-center gap-1.5 pl-[76px] sm:col-span-1 sm:mt-0 sm:pl-0">
                    {(st.kind === "meal" || st.kind === "call") && (
                      <button
                        onClick={() => onPatch(st.id, { anchoredAt: st.anchoredAt ? null : fmtHM(st.startMin, { ampm: false }) })}
                        title={st.anchoredAt ? "Anchored: holds this time. Click to let it flow." : "Flows from the row above. Click to pin it."}
                        className={`grid h-7 w-7 place-items-center rounded-[7px] border text-xs transition ${
                          st.anchoredAt ? "border-accent bg-accent-soft text-accent" : "border-border text-text-faint hover:text-text"
                        }`}
                      >
                        <PinGlyph />
                      </button>
                    )}
                    <div className="inline-flex items-center rounded-[8px] border border-border">
                      <button onClick={() => onPatch(st.id, { durationMin: Math.max(0, st.durationMin - 15) })} className="px-2 py-1 text-sm font-bold text-text-muted hover:text-text">−</button>
                      <span className="min-w-[58px] text-center text-xs font-bold tabular-nums text-text">{fmtDuration(st.durationMin)}</span>
                      <button onClick={() => onPatch(st.id, { durationMin: st.durationMin + 15 })} className="px-2 py-1 text-sm font-bold text-text-muted hover:text-text">+</button>
                    </div>
                    <span className="ml-1 cursor-grab select-none text-text-faint" title="Drag to reorder">⋮⋮</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div
          onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(timed.length); } }}
          onDrop={(e) => { e.preventDefault(); if (drag) onMove(drag, timed.length); setDrag(null); setOver(null); }}
          className={`h-1.5 rounded-full ${over === timed.length && drag ? "my-1 bg-accent" : ""}`}
        />
      </div>
    </div>
  );
}

function Pin() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-accent">
      <PinGlyph /> Fixed
    </span>
  );
}
function PinGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5M9 3h6l-1 7 3 3H7l3-3z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// BOARD VIEW: every day as a column of strips. The stripboard's job: see the
// whole shoot at once and move work between days. On a live-action job the
// INT/EXT DAY/NIGHT colour is the edge, because that is the constraint the AD
// is scheduling around; on a studio job those fields are blank and the kind
// colour is the edge instead.
// ---------------------------------------------------------------------------

function BoardView({
  job, drag, setDrag, onMove,
}: {
  job: Job;
  drag: { dayId: string; stripId: string } | null;
  setDrag: (d: { dayId: string; stripId: string } | null) => void;
  onMove: (from: { dayId: string; stripId: string }, toDayId: string, toIndex: number) => void;
}) {
  const [over, setOver] = useState<{ dayId: string; idx: number } | null>(null);
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[760px] gap-3" style={{ gridTemplateColumns: `repeat(${job.days.length}, minmax(240px, 1fr))` }}>
        {job.days.map((d) => {
          const timed = cascade(d.strips, parseHM(d.callTime) ?? 0);
          const ou = overUnder(timed, parseHM(d.wrapTarget) ?? 0, parseHM(d.callTime) ?? 0);
          const shots = d.strips.reduce((k, x) => k + (x.shots?.length ?? 0), 0);
          return (
            <div key={d.id} className="flex flex-col rounded-[14px] border border-border bg-surface">
              <div className="border-b border-border px-3.5 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-extrabold text-text">Day {d.n}</span>
                  <span className="text-xs text-text-faint">{fmtDate(d.date)}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-text-muted">
                  Call {fmtHM(parseHM(d.callTime) ?? 0)} · {shots} shots ·{" "}
                  <span style={{ color: ou.deltaMin > 0 ? "var(--h-red)" : "var(--h-green)" }} className="font-semibold">
                    wraps {fmtHM(ou.endMin)}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col px-2 py-2">
                {timed.map((st, i) => {
                  const k = KIND[st.kind];
                  const bh = st.kind === "shot" ? boardHue(st) : null;
                  const edge = bh ? h(bh) : h(k.hue);
                  const isWrap = st.kind === "wrap";
                  const dragging = drag?.stripId === st.id;
                  const hot = over?.dayId === d.id && over.idx === i;
                  return (
                    <div key={st.id}>
                      <div
                        onDragOver={(e) => { if (drag) { e.preventDefault(); setOver({ dayId: d.id, idx: i }); } }}
                        onDrop={(e) => { e.preventDefault(); if (drag) onMove(drag, d.id, i); setDrag(null); setOver(null); }}
                        className={`h-1.5 rounded-full ${hot && drag ? "my-1 bg-accent" : ""}`}
                      />
                      <div
                        draggable={!isWrap}
                        onDragStart={() => setDrag({ dayId: d.id, stripId: st.id })}
                        onDragEnd={() => { setDrag(null); setOver(null); }}
                        className={`grid grid-cols-[4px_1fr] gap-x-2.5 rounded-[9px] py-1.5 pr-1.5 ${dragging ? "opacity-40" : "hover:bg-surface-2"} ${isWrap ? "" : "cursor-grab"}`}
                      >
                        <div className="rounded-full" style={{ backgroundColor: edge }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-text-faint">
                            <span className="font-bold text-text-muted">{fmtHM(st.startMin)}</span>
                            {!isWrap && st.durationMin > 0 && <span>· {fmtDuration(st.durationMin)}</span>}
                            {st.intExt && st.dayNight && (
                              <span className="ml-auto rounded-pill border border-border px-1.5 text-[9px] font-bold uppercase tracking-wide text-text-muted">
                                {st.intExt}·{st.dayNight}
                              </span>
                            )}
                          </div>
                          <div className={`truncate text-[13px] font-semibold ${isWrap ? "text-text-muted" : "text-text"}`}>
                            {st.shots?.length ? (
                              <span className="mr-1.5 inline-flex gap-1">
                                {st.shots.map((sh) => (
                                  <span key={sh.code} className="rounded-[5px] bg-surface-2 px-1.5 text-[11px] font-bold tabular-nums">{sh.code}</span>
                                ))}
                              </span>
                            ) : null}
                            {st.title}
                          </div>
                          {st.set && <div className="truncate text-[11px] text-text-muted">{st.set}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div
                  onDragOver={(e) => { if (drag) { e.preventDefault(); setOver({ dayId: d.id, idx: timed.length }); } }}
                  onDrop={(e) => { e.preventDefault(); if (drag) onMove(drag, d.id, timed.length); setDrag(null); setOver(null); }}
                  className={`min-h-[12px] flex-1 rounded-full ${over?.dayId === d.id && over.idx === timed.length && drag ? "my-1 bg-accent" : ""}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
