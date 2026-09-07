"use client";

/**
 * A MOCKUP, not the feature. Hardcoded data, no persistence, no add/edit
 * chrome. It exists so the operator can judge the LAYOUT of a schedule and
 * feel the one behaviour that makes it modern (times cascade, anchors hold)
 * before any schema hardens around it. Delete when the real page lands at
 * /projects/[id]/schedule.
 *
 * SECOND PASS, after the operator's reaction to the first: "it needs to be
 * VERY clear about all the information on the page, easy for cast and crew to
 * read. Where is it going to show talent? Also, location?" The first pass put
 * location as small text beside the title and everybody as identical grey
 * chips, and hid the drag handle behind a faint glyph. A schedule that cast
 * and crew read is a TABLE: named columns, talent and location each with a
 * column of their own, a grip you cannot miss.
 *
 * TWO VIEWS, ONE ROW MODEL. The DAY view is that table for one day, with
 * computed times. The BOARD view is every day as a column of the same rows,
 * where an AD moves work between days, and where the stripboard's INT/EXT
 * DAY/NIGHT colours earn their place as the strip's edge.
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
  type Timed,
} from "@/lib/schedule-time";

type Strip = StripInput & {
  title: string;
  /** Where in the world: a stage, an address. The thing crew drive to. */
  location?: string;
  /** Where inside it: the set or setup. */
  set?: string;
  intExt?: IntExt;
  dayNight?: DayNight;
  shots?: { code: string; description: string }[];
  /** On camera. Their own column, because it is the first thing talent looks for. */
  talent?: string[];
  /** Behind it. */
  crew?: string[];
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

type Job = { title: string; days: Day[] };

// ---------------------------------------------------------------------------
// Data. The Hint job is REAL: shot codes, descriptions and crew positions are
// on the project today. The live-action job is invented and says so.
// ---------------------------------------------------------------------------

let n = 0;
const s = (kind: StripKind, title: string, durationMin: number, extra: Partial<Strip> = {}): Strip =>
  ({ id: `s${++n}`, kind, title, durationMin, anchoredAt: null, ...extra });

const STAGE = "Stage 2, Culver City";

const HINT: Job = {
  title: "Hint Treat Yourself",
  days: [
    {
      id: "h1", n: 1, date: "2026-09-03", callTime: "8:00", wrapTarget: "6:00 pm",
      strips: [
        s("call", "Crew call, load in", 30, { location: STAGE, crew: ["Gaffer", "Key Grip", "Motion Control Operator"] }),
        s("meal", "Breakfast", 30, { anchoredAt: "9:00", location: STAGE, notes: "Craft services on the dock" }),
        s("setup", "Light Set A, motion control rig check", 60, { location: STAGE, set: "Set A · Cloud wall", crew: ["Director of Photography", "Gaffer", "Motion Control Operator"] }),
        s("shot", "Bottle reveal", 120, {
          location: STAGE, set: "Set A · Cloud wall",
          shots: [
            { code: "1A", description: "We open closed. A dense wall of pink cloud fills the frame." },
            { code: "1B", description: "The clouds clear away completely and the setup is revealed." },
            { code: "1C", description: "The bottles rotate and lock into perfect alignment." },
          ],
          crew: ["Motion Control Operator", "Food Stylist", "Prop Stylist"],
        }),
        s("shot", "Cupcake macro", 90, {
          location: STAGE, set: "Set A",
          shots: [{ code: "2", description: "We continue into the strawberry cupcake until it fills the frame." }],
          crew: ["Food Stylist", "Food Stylist Assistant"],
          notes: "Fresh cupcakes from 11:30, do not plate early",
        }),
        s("meal", "Lunch", 60, { anchoredAt: "1:00 pm", location: STAGE }),
        s("move", "Reset to Set B", 30, { location: STAGE, set: "Set B · Cobbler world", crew: ["Prop Stylist", "Prop Stylist Assistant", "Key Grip"] }),
        s("shot", "Cobbler world", 150, {
          location: STAGE, set: "Set B · Cobbler world",
          shots: [
            { code: "3", description: "We crest the cupcake and the first fantasy world opens up." },
            { code: "4", description: "The transition lands in the cobbler world. Dolly right." },
          ],
          crew: ["Motion Control Operator", "Prop Stylist", "Food Stylist"],
        }),
        s("wrap", "Wrap", 0),
      ],
    },
    {
      id: "h2", n: 2, date: "2026-09-04", callTime: "8:00", wrapTarget: "6:00 pm",
      strips: [
        s("call", "Crew call", 30, { location: STAGE }),
        s("meal", "Breakfast", 30, { anchoredAt: "9:00", location: STAGE }),
        s("setup", "Build pineapple world", 90, { location: STAGE, set: "Set C · Pineapple", crew: ["Prop Stylist", "Prop Stylist Assistant"] }),
        s("shot", "Pineapple world", 120, {
          location: STAGE, set: "Set C · Pineapple",
          shots: [{ code: "5", description: "The transition lands in the pineapple world. A sweeping arch." }],
          crew: ["Motion Control Operator", "Food Stylist"],
        }),
        s("meal", "Lunch", 60, { anchoredAt: "1:00 pm", location: STAGE }),
        s("move", "Reset to key lime, rig the descent", 45, { location: STAGE, set: "Set D · Key lime" }),
        s("shot", "Key lime descent", 120, {
          location: STAGE, set: "Set D · Key lime",
          shots: [
            { code: "6", description: "The transition lands in the key lime world. Then DESCEND." },
            { code: "7", description: "Fully submerged. Open, clear, quiet water. Godray shafts." },
          ],
        }),
        s("shot", "Product beauty", 60, {
          location: STAGE, set: "Set E · Beauty",
          shots: [{ code: "8", description: "Final product beauty. The Treat Yourself variety pack." }],
          crew: ["Photographer", "Food Stylist"],
        }),
        s("wrap", "Wrap", 0),
      ],
    },
  ],
};

const HOUSE = "412 Elm St, Pasadena";
const CAFE = "Roasters Cafe, 88 Colorado Blvd";

const LIVE: Job = {
  title: "Morning Ritual (example, 3-day live action)",
  days: [
    {
      id: "l1", n: 1, date: "2026-10-06", callTime: "6:00", wrapTarget: "5:00 pm",
      strips: [
        s("call", "Crew call. Talent to HMU", 60, { location: HOUSE, talent: ["Maya Chen"], crew: ["1st AD", "HMU", "Wardrobe"] }),
        s("shot", "Kitchen, wake-up sequence", 180, { location: HOUSE, set: "Kitchen", intExt: "INT", dayNight: "DAY",
          shots: [{ code: "3", description: "She pours the coffee, light through the blinds." }, { code: "4", description: "CU hands, mug." }],
          talent: ["Maya Chen"], crew: ["DP", "Gaffer", "Sound"] }),
        s("meal", "Lunch", 60, { anchoredAt: "12:00 pm", location: HOUSE }),
        s("move", "Company move to street", 60, { location: HOUSE, notes: "Trucks stay on Elm. Basecamp in the driveway." }),
        s("shot", "Street, leaving the house", 150, { location: HOUSE, set: "Front steps, Elm St", intExt: "EXT", dayNight: "DAY",
          shots: [{ code: "6", description: "Wide, she steps out. Steadicam follow." }],
          talent: ["Maya Chen"], crew: ["Steadicam", "DP"] }),
        s("wrap", "Wrap", 0),
      ],
    },
    {
      id: "l2", n: 2, date: "2026-10-07", callTime: "2:00 pm", wrapTarget: "1:00 am",
      strips: [
        s("call", "Crew call (night)", 60, { location: HOUSE, talent: ["Maya Chen"], crew: ["1st AD", "HMU"] }),
        s("shot", "Bedroom, evening wind-down", 180, { location: HOUSE, set: "Bedroom", intExt: "INT", dayNight: "NIGHT",
          shots: [{ code: "9", description: "Lamp light, she sets the alarm." }],
          talent: ["Maya Chen"], crew: ["DP", "Gaffer"] }),
        s("meal", "Dinner", 60, { anchoredAt: "8:00 pm", location: HOUSE }),
        s("shot", "Porch, night", 150, { location: HOUSE, set: "Porch", intExt: "EXT", dayNight: "NIGHT",
          shots: [{ code: "10", description: "Porch light on, city hum. Locked off." }],
          talent: ["Maya Chen"], crew: ["Gaffer", "Sound"] }),
        s("wrap", "Wrap", 0),
      ],
    },
    {
      id: "l3", n: 3, date: "2026-10-08", callTime: "7:00", wrapTarget: "4:00 pm",
      strips: [
        s("call", "Crew call", 30, { location: CAFE, talent: ["Maya Chen", "Theo Okafor"], crew: ["1st AD", "HMU", "Wardrobe"] }),
        s("shot", "Cafe, the meet", 210, { location: CAFE, set: "Counter", intExt: "INT", dayNight: "DAY",
          shots: [{ code: "12", description: "Two-shot at the counter." }, { code: "13", description: "Product insert, cup." }],
          talent: ["Maya Chen", "Theo Okafor"], crew: ["DP", "Sound"] }),
        s("meal", "Lunch", 60, { anchoredAt: "12:30 pm", location: CAFE }),
        s("shot", "Cafe patio", 120, { location: CAFE, set: "Patio", intExt: "EXT", dayNight: "DAY",
          shots: [{ code: "14", description: "Wide, they leave together." }],
          talent: ["Maya Chen", "Theo Okafor"] }),
        s("wrap", "Wrap", 0),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Colour as signal. Kind is what a row IS; INT/EXT D/N is a constraint.
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
  if (st.intExt === "INT" && st.dayNight === "DAY") return "border-strong";
  if (st.intExt === "EXT" && st.dayNight === "DAY") return "h-yellow";
  if (st.intExt === "INT" && st.dayNight === "NIGHT") return "h-blue";
  return "h-green";
}
const h = (hue: string) => `var(--${hue.startsWith("h-") || hue.startsWith("border") ? hue : `h-${hue}`})`;
const hbg = (hue: string) => `var(--h-${hue}-bg)`;

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
/** A deterministic hue per name, same idea as comms-ui senderHue. */
function nameHue(name: string): string {
  const hues = ["indigo", "purple", "pink", "cyan", "orange", "green"];
  let k = 0;
  for (const c of name) k = (k * 31 + c.charCodeAt(0)) >>> 0;
  return hues[k % hues.length];
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
  function moveStrip(from: { dayId: string; stripId: string }, toDayId: string, toIndex: number) {
    update((j) => {
      const src = j.days.find((d) => d.id === from.dayId);
      const strip = src?.strips.find((x) => x.id === from.stripId);
      if (!src || !strip) return j;
      // Index is measured on the source day BEFORE removal, so moving down
      // within the same day has to account for the hole it leaves behind.
      const fromIdx = src.strips.findIndex((x) => x.id === from.stripId);
      const adjusted = toDayId === from.dayId && toIndex > fromIdx ? toIndex - 1 : toIndex;
      const days = j.days.map((d) => ({ ...d, strips: d.strips.filter((x) => x.id !== from.stripId) }));
      const dst = days.find((d) => d.id === toDayId);
      if (!dst) return j;
      const body = dst.strips.filter((x) => x.kind !== "wrap");
      const tail = dst.strips.filter((x) => x.kind === "wrap");
      body.splice(Math.max(0, Math.min(adjusted, body.length)), 0, strip);
      dst.strips = [...body, ...tail];
      return { ...j, days };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Seg value={jobKey} onChange={(v) => { setJobKey(v as "hint" | "live"); setDayIdx(0); }}
          options={[["hint", "Hint (real shots)"], ["live", "3-day live action (example)"]]} />
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
                <button key={d.id} onClick={() => setDayIdx(i)}
                  className={`-mb-px flex shrink-0 flex-col items-start gap-0.5 rounded-t-[10px] border border-b-0 px-4 py-2.5 text-left transition ${
                    active ? "border-border bg-surface" : "border-transparent hover:bg-surface-2"}`}>
                  <span className={`text-sm font-bold ${active ? "text-text" : "text-text-muted"}`}>Day {d.n}</span>
                  <span className="text-[11px] text-text-faint">
                    {fmtDate(d.date)} · {d.strips.reduce((k, x) => k + (x.shots?.length ?? 0), 0)} shots ·{" "}
                    <span style={{ color: ou.deltaMin > 0 ? "var(--h-red)" : undefined }}>wraps {fmtHM(ou.endMin)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <DayView day={day} drag={drag} setDrag={setDrag}
            onPatch={(id, p) => patchStrip(day.id, id, p)}
            onMove={(from, idx) => moveStrip(from, day.id, idx)} />
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
        <button key={k} onClick={() => onChange(k)}
          className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${
            value === k ? "bg-accent text-accent-fg shadow-sm" : "text-text-muted hover:text-text"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared cell renderers, so the table and the phone cards say the same thing.
// ---------------------------------------------------------------------------

function TalentCell({ names, compact }: { names?: string[]; compact?: boolean }) {
  if (!names?.length) return <span className="text-text-faint">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {names.map((nm) => (
        <span key={nm} className="inline-flex items-center gap-1.5">
          <span
            className={`grid shrink-0 place-items-center rounded-full font-bold ${compact ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]"}`}
            style={{ backgroundColor: hbg(nameHue(nm)), color: h(nameHue(nm)) }}
          >
            {initials(nm)}
          </span>
          <span className={`font-semibold text-text ${compact ? "text-xs" : "text-[13px]"}`}>{nm}</span>
        </span>
      ))}
    </div>
  );
}

function LocationCell({ location, set, intExt, dayNight, compact }: { location?: string; set?: string; intExt?: IntExt; dayNight?: DayNight; compact?: boolean }) {
  if (!location && !set) return <span className="text-text-faint">—</span>;
  return (
    <div className="min-w-0">
      {set && (
        <div className={`flex flex-wrap items-center gap-1.5 font-semibold text-text ${compact ? "text-xs" : "text-[13px]"}`}>
          <span className="truncate">{set}</span>
          {intExt && dayNight && (
            <span className="rounded-pill border border-border px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-text-muted">
              {intExt} · {dayNight}
            </span>
          )}
        </div>
      )}
      {location && (
        <div className={`flex items-center gap-1 text-text-muted ${compact ? "text-[11px]" : "text-xs"} ${set ? "mt-0.5" : "font-semibold text-text"}`}>
          <PinGlyph small /> <span className="truncate">{location}</span>
        </div>
      )}
    </div>
  );
}

function Grip() {
  return (
    <span
      className="grid h-8 w-6 shrink-0 cursor-grab place-items-center rounded-[6px] text-text-faint transition hover:bg-surface-2 hover:text-text active:cursor-grabbing"
      title="Drag to move this row. In Board view, drop it on another day."
      aria-label="Drag to reorder"
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="2.5" cy="2.5" r="1.6" /><circle cx="7.5" cy="2.5" r="1.6" />
        <circle cx="2.5" cy="8" r="1.6" /><circle cx="7.5" cy="8" r="1.6" />
        <circle cx="2.5" cy="13.5" r="1.6" /><circle cx="7.5" cy="13.5" r="1.6" />
      </svg>
    </span>
  );
}

function PinGlyph({ small }: { small?: boolean }) {
  const sz = small ? 11 : 12;
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function AnchorGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5M9 3h6l-1 7 3 3H7l3-3z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// DAY VIEW: a table. Named columns, because this is the document cast and
// crew read, and a reader finds a column faster than a chip. Time, what,
// location, talent, crew, and the one thing the AD types: the duration.
// ---------------------------------------------------------------------------

// THE PREFIX LIVES IN THE STRING. Tailwind only generates a class it finds
// verbatim in the source, so `${LG_COLS}` produced a token that existed
// nowhere and the desktop rows collapsed to one column while the header
// (which used the bare constant) laid out fine. Same trap as the opacity
// modifiers.
const LG_COLS = "lg:grid-cols-[28px_4px_92px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_172px]";

function DayView({ day, drag, setDrag, onPatch, onMove }: {
  day: Day;
  drag: { dayId: string; stripId: string } | null;
  setDrag: (d: { dayId: string; stripId: string } | null) => void;
  onPatch: (stripId: string, patch: Partial<Strip>) => void;
  onMove: (from: { dayId: string; stripId: string }, toIndex: number) => void;
}) {
  const timed = useMemo(() => cascade(day.strips, parseHM(day.callTime) ?? 0), [day]);
  const ou = overUnder(timed, parseHM(day.wrapTarget) ?? 0, parseHM(day.callTime) ?? 0);
  const [over, setOver] = useState<number | null>(null);
  const location = day.strips.find((x) => x.location)?.location;
  const talent = Array.from(new Set(day.strips.flatMap((x) => x.talent ?? [])));

  const dropZone = (i: number) => (
    <div
      onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(i); } }}
      onDragLeave={() => setOver((o) => (o === i ? null : o))}
      onDrop={(e) => { e.preventDefault(); if (drag) onMove(drag, i); setDrag(null); setOver(null); }}
      className={`transition-all ${drag ? "h-3" : "h-0"} ${over === i && drag ? "my-0.5 rounded-full bg-accent" : ""}`}
    />
  );

  return (
    <div className="rounded-[14px] border border-border bg-surface">
      {/* Day header. The facts that bracket everything, then the two things a
          reader wants before the rows: where, and who is on camera. */}
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3 border-b border-border px-5 py-4">
        <Fact label="Call" value={fmtHM(parseHM(day.callTime) ?? 0)} />
        <Fact label="Target wrap" value={fmtHM(parseHM(day.wrapTarget) ?? 0)} />
        {location && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Location</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[15px] font-bold text-text"><PinGlyph /> {location}</div>
          </div>
        )}
        {talent.length > 0 && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Talent today</div>
            <div className="mt-1"><TalentCell names={talent} compact /></div>
          </div>
        )}
        <div className="ml-auto text-right">
          <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Scheduled wrap</div>
          <div className="text-xl font-extrabold" style={{ color: ou.deltaMin > 0 ? "var(--h-red)" : "var(--h-green)" }}>
            {fmtHM(ou.endMin)}
            <span className="ml-2 text-xs font-bold">
              {ou.deltaMin === 0 ? "on target" : ou.deltaMin > 0 ? `${fmtDuration(ou.deltaMin)} over` : `${fmtDuration(-ou.deltaMin)} under`}
            </span>
          </div>
        </div>
      </div>

      {/* Column headers, desktop only. On a phone each card labels its own fields. */}
      <div className={`hidden ${LG_COLS} items-center gap-x-3 border-b border-border bg-surface-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-text-faint lg:grid`}>
        <span /><span /><span>Time</span><span>What</span><span>Location / set</span><span>Talent</span><span>Crew</span><span className="text-right">Duration</span>
      </div>

      <div className="px-3 py-1 lg:px-3">
        {timed.map((st, i) => {
          const k = KIND[st.kind];
          const isWrap = st.kind === "wrap";
          const dragging = drag?.stripId === st.id;
          return (
            <div key={st.id}>
              {st.slackMin !== null && st.slackMin !== 0 && (
                <div className="my-1 ml-0 flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-xs font-bold lg:ml-[124px]"
                  style={{ backgroundColor: st.slackMin < 0 ? "var(--h-red-bg)" : "var(--h-green-bg)", color: st.slackMin < 0 ? "var(--h-red)" : "var(--h-green)" }}>
                  {st.slackMin < 0 ? `Runs ${fmtDuration(-st.slackMin)} into ${st.title.toLowerCase()}` : `${fmtDuration(st.slackMin)} buffer before ${st.title.toLowerCase()}`}
                </div>
              )}
              {dropZone(i)}
              <div
                draggable={!isWrap}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDrag({ dayId: day.id, stripId: st.id }); }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                // THE ROW IS A DROP TARGET, not only the seam between rows. A
                // 12px seam is the invisible-hotspot mistake the board resize
                // handles made; somebody dragging onto a row expects it to land
                // there. Upper half inserts before it, lower half after.
                onDragOver={(e) => { if (!drag || dragging) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setOver(e.clientY < r.top + r.height / 2 ? i : i + 1); }}
                onDrop={(e) => { if (!drag) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); onMove(drag, e.clientY < r.top + r.height / 2 ? i : i + 1); setDrag(null); setOver(null); }}
                className={`group rounded-[10px] border-b border-border py-3 transition last:border-0 ${dragging ? "opacity-40" : "hover:bg-surface-2"} ${isWrap ? "" : "cursor-grab active:cursor-grabbing"}
                  grid grid-cols-[28px_4px_1fr] gap-x-3 ${LG_COLS}`}
              >
                <div className="flex items-start justify-center pt-0.5">{!isWrap && <Grip />}</div>
                <div className="rounded-full" style={{ backgroundColor: h(k.hue) }} />

                {/* Phone: one card with labelled fields. Desktop: the cells below. */}
                <div className="min-w-0 lg:hidden">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-extrabold tabular-nums text-text">{fmtHM(st.startMin)}</span>
                    {!isWrap && st.durationMin > 0 && <span className="text-xs tabular-nums text-text-faint">to {fmtHM(st.endMin)} · {fmtDuration(st.durationMin)}</span>}
                  </div>
                  <WhatCell st={st} k={k} isWrap={isWrap} />
                  {!isWrap && (
                    <dl className="mt-2 grid grid-cols-[76px_1fr] gap-y-1.5 text-xs">
                      <dt className="font-bold uppercase tracking-wide text-text-faint">Location</dt><dd><LocationCell {...st} compact /></dd>
                      <dt className="font-bold uppercase tracking-wide text-text-faint">Talent</dt><dd><TalentCell names={st.talent} compact /></dd>
                      <dt className="font-bold uppercase tracking-wide text-text-faint">Crew</dt><dd className="text-text-muted">{st.crew?.join(", ") ?? <span className="text-text-faint">—</span>}</dd>
                    </dl>
                  )}
                  {!isWrap && <Controls st={st} onPatch={onPatch} className="mt-2" />}
                </div>

                <div className="hidden pt-0.5 lg:block">
                  <div className="text-[15px] font-extrabold tabular-nums leading-tight text-text">{fmtHM(st.startMin)}</div>
                  {!isWrap && st.durationMin > 0 && <div className="mt-0.5 text-xs tabular-nums text-text-faint">to {fmtHM(st.endMin)}</div>}
                </div>
                <div className="hidden min-w-0 lg:block"><WhatCell st={st} k={k} isWrap={isWrap} /></div>
                <div className="hidden min-w-0 pt-0.5 lg:block">{!isWrap && <LocationCell {...st} />}</div>
                <div className="hidden min-w-0 pt-0.5 lg:block">{!isWrap && <TalentCell names={st.talent} />}</div>
                <div className="hidden min-w-0 pt-0.5 text-[13px] leading-snug text-text-muted lg:block">
                  {!isWrap && (st.crew?.length ? st.crew.join(", ") : <span className="text-text-faint">—</span>)}
                </div>
                <div className="hidden lg:block">{!isWrap && <Controls st={st} onPatch={onPatch} className="justify-end" />}</div>
              </div>
            </div>
          );
        })}
        {dropZone(timed.length)}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">{label}</div>
      <div className="mt-0.5 text-xl font-extrabold tabular-nums text-text">{value}</div>
    </div>
  );
}

function WhatCell({ st, k, isWrap }: { st: Strip; k: { label: string; hue: string }; isWrap: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center rounded-pill px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: hbg(k.hue), color: h(k.hue) }}>{k.label}</span>
        <span className={`text-[15px] font-bold ${isWrap ? "text-text-muted" : "text-text"}`}>{st.title}</span>
        {st.anchoredAt && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-accent"><AnchorGlyph /> Fixed</span>
        )}
      </div>
      {st.shots && st.shots.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1">
          {st.shots.map((sh) => (
            <div key={sh.code} className="flex items-start gap-2 text-[13px] leading-snug">
              <span className="mt-[1px] shrink-0 rounded-[5px] bg-surface-2 px-1.5 py-[1px] text-[11px] font-bold tabular-nums text-text">{sh.code}</span>
              <span className="text-text-muted">{sh.description}</span>
            </div>
          ))}
        </div>
      )}
      {st.notes && <div className="mt-1.5 text-xs italic text-text-muted">{st.notes}</div>}
    </div>
  );
}

function Controls({ st, onPatch, className = "" }: { st: Timed<Strip>; onPatch: (id: string, p: Partial<Strip>) => void; className?: string }) {
  const stopDrag = (e: React.DragEvent) => e.stopPropagation();
  return (
    <div className={`flex items-center gap-1.5 ${className}`} draggable onDragStart={(e) => { e.preventDefault(); stopDrag(e); }}>
      {(st.kind === "meal" || st.kind === "call") && (
        <button
          onClick={() => onPatch(st.id, { anchoredAt: st.anchoredAt ? null : fmtHM(st.startMin, { ampm: false }) })}
          title={st.anchoredAt ? "Fixed: holds this time. Click to let it flow." : "Flows from the row above. Click to fix it."}
          className={`grid h-7 w-7 place-items-center rounded-[7px] border text-xs transition ${
            st.anchoredAt ? "border-accent bg-accent-soft text-accent" : "border-border text-text-faint hover:text-text"}`}>
          <AnchorGlyph />
        </button>
      )}
      <div className="inline-flex items-center rounded-[8px] border border-border bg-surface">
        <button onClick={() => onPatch(st.id, { durationMin: Math.max(0, st.durationMin - 15) })} className="px-2 py-1 text-sm font-bold text-text-muted hover:text-text">−</button>
        <span className="min-w-[56px] text-center text-xs font-bold tabular-nums text-text">{fmtDuration(st.durationMin)}</span>
        <button onClick={() => onPatch(st.id, { durationMin: st.durationMin + 15 })} className="px-2 py-1 text-sm font-bold text-text-muted hover:text-text">+</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BOARD VIEW: every day as a column of strips. Each strip carries the same
// facts as the table row, compressed: time, what, location, talent.
// ---------------------------------------------------------------------------

function BoardView({ job, drag, setDrag, onMove }: {
  job: Job;
  drag: { dayId: string; stripId: string } | null;
  setDrag: (d: { dayId: string; stripId: string } | null) => void;
  onMove: (from: { dayId: string; stripId: string }, toDayId: string, toIndex: number) => void;
}) {
  const [over, setOver] = useState<{ dayId: string; idx: number } | null>(null);
  const zone = (dayId: string, idx: number, grow?: boolean) => (
    <div
      onDragOver={(e) => { if (drag) { e.preventDefault(); setOver({ dayId, idx }); } }}
      onDrop={(e) => { e.preventDefault(); if (drag) onMove(drag, dayId, idx); setDrag(null); setOver(null); }}
      className={`transition-all ${grow ? "min-h-[16px] flex-1" : drag ? "h-3" : "h-0"} ${over?.dayId === dayId && over.idx === idx && drag ? "my-0.5 rounded-full bg-accent" : ""}`}
    />
  );
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[820px] gap-3" style={{ gridTemplateColumns: `repeat(${job.days.length}, minmax(260px, 1fr))` }}>
        {job.days.map((d) => {
          const timed = cascade(d.strips, parseHM(d.callTime) ?? 0);
          const ou = overUnder(timed, parseHM(d.wrapTarget) ?? 0, parseHM(d.callTime) ?? 0);
          const shots = d.strips.reduce((k, x) => k + (x.shots?.length ?? 0), 0);
          const loc = d.strips.find((x) => x.location)?.location;
          return (
            <div key={d.id} className="flex flex-col rounded-[14px] border border-border bg-surface">
              <div className="border-b border-border px-3.5 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-extrabold text-text">Day {d.n}</span>
                  <span className="text-xs text-text-faint">{fmtDate(d.date)}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-text-muted">
                  Call {fmtHM(parseHM(d.callTime) ?? 0)} · {shots} shots ·{" "}
                  <span style={{ color: ou.deltaMin > 0 ? "var(--h-red)" : "var(--h-green)" }} className="font-semibold">wraps {fmtHM(ou.endMin)}</span>
                </div>
                {loc && <div className="mt-1 flex items-center gap-1 truncate text-[11px] font-semibold text-text"><PinGlyph small /> {loc}</div>}
              </div>
              <div className="flex flex-1 flex-col px-2 py-2">
                {timed.map((st, i) => {
                  const k = KIND[st.kind];
                  const bh = st.kind === "shot" ? boardHue(st) : null;
                  const edge = bh ? h(bh) : h(k.hue);
                  const isWrap = st.kind === "wrap";
                  const dragging = drag?.stripId === st.id;
                  return (
                    <div key={st.id}>
                      {zone(d.id, i)}
                      <div
                        draggable={!isWrap}
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDrag({ dayId: d.id, stripId: st.id }); }}
                        onDragEnd={() => { setDrag(null); setOver(null); }}
                        onDragOver={(e) => { if (!drag || dragging) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setOver({ dayId: d.id, idx: e.clientY < r.top + r.height / 2 ? i : i + 1 }); }}
                        onDrop={(e) => { if (!drag) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); onMove(drag, d.id, e.clientY < r.top + r.height / 2 ? i : i + 1); setDrag(null); setOver(null); }}
                        className={`grid grid-cols-[20px_4px_1fr] gap-x-2 rounded-[9px] py-2 pr-2 transition ${dragging ? "opacity-40" : "hover:bg-surface-2"} ${isWrap ? "" : "cursor-grab active:cursor-grabbing"}`}
                      >
                        <div className="flex items-start justify-center">{!isWrap && <Grip />}</div>
                        <div className="rounded-full" style={{ backgroundColor: edge }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-text-faint">
                            <span className="font-bold text-text-muted">{fmtHM(st.startMin)}</span>
                            {!isWrap && st.durationMin > 0 && <span>· {fmtDuration(st.durationMin)}</span>}
                            {st.intExt && st.dayNight && (
                              <span className="ml-auto rounded-pill border border-border px-1.5 text-[9px] font-bold uppercase tracking-wide text-text-muted">{st.intExt}·{st.dayNight}</span>
                            )}
                          </div>
                          <div className={`text-[13px] font-semibold ${isWrap ? "text-text-muted" : "text-text"}`}>
                            {st.shots?.length ? (
                              <span className="mr-1.5 inline-flex gap-1">
                                {st.shots.map((sh) => <span key={sh.code} className="rounded-[5px] bg-surface-2 px-1.5 text-[11px] font-bold tabular-nums">{sh.code}</span>)}
                              </span>
                            ) : null}
                            {st.title}
                          </div>
                          {st.set && <div className="truncate text-[11px] text-text-muted">{st.set}</div>}
                          {st.talent?.length ? <div className="mt-1"><TalentCell names={st.talent} compact /></div> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {zone(d.id, timed.length, true)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
