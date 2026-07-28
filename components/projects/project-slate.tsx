"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  buildLanes,
  dayIndex,
  defaultStart,
  shootCollisions,
  type SlateEvent,
  type SlateInput,
  type SlateKind,
} from "@/lib/slate";
import { PROJECT_STATUS } from "@/lib/status";

// Every project as one lane across a date window. The question it answers is
// "what is the whole studio doing over the next few weeks, and where does it
// collide", which no other surface in the app answers today.

const WEEKS_KEY = "projects.slate.weeks";
const WEEK_OPTIONS = [4, 6, 12] as const;
type Weeks = (typeof WEEK_OPTIONS)[number];

const DAY_W = 30; // px per day column
const RAIL_W = 208; // px for the sticky project column

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

// Segment colors are wayfinding, one step quieter than a status chip, so the
// two color systems never compete (design principle 4.2).
const SEG: Record<SlateKind, { bg: string; fg: string; solid?: boolean; outline?: boolean }> = {
  prepro: { bg: "var(--h-blue-bg)", fg: "var(--h-blue)" },
  shoot: { bg: "var(--h-orange)", fg: "var(--accent-fg)", solid: true },
  post: { bg: "var(--h-purple-bg)", fg: "var(--h-purple)" },
  delivered: { bg: "var(--h-green-bg)", fg: "var(--h-green)" },
  overdue: { bg: "var(--h-red-bg)", fg: "var(--h-red)" },
  undated: { bg: "transparent", fg: "var(--text-faint)", outline: true },
};

function fmtRange(startIso: string, endIso: string): string {
  const [, sm, sd] = startIso.split("-").map(Number);
  const [, em, ed] = endIso.split("-").map(Number);
  return `${sd} ${MONTHS[sm - 1]} to ${ed} ${MONTHS[em - 1]}`;
}

export function ProjectSlate({
  projects,
  events,
  todayIso,
}: {
  projects: SlateInput[];
  events: SlateEvent[];
  todayIso: string;
}) {
  const [weeks, setWeeks] = useState<Weeks>(6);
  // Whole weeks moved from the default window, so paging always lands on a
  // Monday and the column grid never shifts under you.
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(WEEKS_KEY));
      if (WEEK_OPTIONS.includes(saved as Weeks)) setWeeks(saved as Weeks);
    } catch {}
  }, []);

  function pickWeeks(w: Weeks) {
    setWeeks(w);
    try {
      localStorage.setItem(WEEKS_KEY, String(w));
    } catch {}
  }

  const days = weeks * 7;
  const startIso = useMemo(
    () => addDays(defaultStart(todayIso), offset * 7),
    [todayIso, offset]
  );
  const endIso = useMemo(() => addDays(startIso, days - 1), [startIso, days]);

  const lanes = useMemo(
    () => buildLanes(projects, events, { startIso, days, todayIso }),
    [projects, events, startIso, days, todayIso]
  );

  // A project whose dates all sit outside this window is not drawn. Saying so
  // is better than silently showing fewer rows than the page promised.
  const visible = lanes.filter((l) => l.segments.length > 0);
  const hidden = lanes.length - visible.length;

  const collisions = useMemo(() => shootCollisions(visible), [visible]);
  const today = dayIndex(todayIso, startIso);
  const todayInView = today >= 0 && today < days;

  const gridTemplate = `${RAIL_W}px repeat(${days}, ${DAY_W}px)`;
  const dayAt = (i: number) => addDays(startIso, i);

  return (
    <div className="rounded-[16px] border border-border bg-surface shadow-sm">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-[10px] border border-border p-0.5">
            <button
              onClick={() => setOffset((o) => o - 1)}
              aria-label="Previous week"
              className="grid h-7 w-7 place-items-center rounded-[8px] text-text-muted transition hover:bg-surface-2 hover:text-text"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button
              onClick={() => setOffset(0)}
              disabled={offset === 0}
              className="rounded-[8px] px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40"
            >
              Today
            </button>
            <button
              onClick={() => setOffset((o) => o + 1)}
              aria-label="Next week"
              className="grid h-7 w-7 place-items-center rounded-[8px] text-text-muted transition hover:bg-surface-2 hover:text-text"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
          <span className="text-xs font-semibold tabular-nums text-text-muted">
            {fmtRange(startIso, endIso)}
          </span>
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-[10px] bg-surface-2 p-0.5">
          {WEEK_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => pickWeeks(w)}
              aria-pressed={weeks === w}
              className={`rounded-[8px] px-2.5 py-1 text-xs font-semibold transition ${
                weeks === w
                  ? "bg-surface text-text shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {w} wks
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-14 text-center text-sm text-text-muted">
          Nothing scheduled in this range. Use the arrows to look further out, or
          add shoot and delivery dates to a project.
        </p>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain">
          <div
            className="relative grid"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {/* Month ruler */}
            <div
              className="sticky left-0 z-30 bg-surface"
              style={{ gridRow: 1, gridColumn: 1 }}
            />
            {Array.from({ length: days }).map((_, i) => {
              const iso = dayAt(i);
              const [, m, d] = iso.split("-").map(Number);
              const first = i === 0 || d === 1;
              if (!first) return null;
              let span = 1;
              while (
                i + span < days &&
                Number(dayAt(i + span).split("-")[1]) === m
              )
                span++;
              return (
                <div
                  key={`m${i}`}
                  className="border-l border-border pb-0.5 pl-1.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-text-muted"
                  style={{ gridRow: 1, gridColumn: `${i + 2} / span ${span}` }}
                >
                  {MONTHS[m - 1]}
                </div>
              );
            })}

            {/* Day ruler */}
            <div
              className="sticky left-0 z-30 flex items-end border-r border-border bg-surface px-3 pb-2"
              style={{ gridRow: 2, gridColumn: 1 }}
            >
              <span className="text-[11px] font-semibold text-text-faint">
                {visible.length} {visible.length === 1 ? "project" : "projects"}
              </span>
            </div>
            {Array.from({ length: days }).map((_, i) => {
              const iso = dayAt(i);
              const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
              const weekend = dow === 0 || dow === 6;
              return (
                <div
                  key={`d${i}`}
                  className={`pb-2 text-center text-[10px] font-semibold tabular-nums ${
                    dow === 1 ? "border-l border-border" : ""
                  } text-text-faint ${weekend ? "opacity-60" : ""}`}
                  style={{ gridRow: 2, gridColumn: i + 2 }}
                >
                  <span className="block text-[8.5px] opacity-70">{DOW[dow]}</span>
                  {Number(iso.split("-")[2])}
                </div>
              );
            })}

            {/* Lanes */}
            {visible.map((lane, r) => {
              const row = r + 3;
              const st = PROJECT_STATUS[lane.status];
              return (
                <div key={lane.id} className="contents">
                  <Link
                    href={`/projects/${lane.id}`}
                    className={`sticky left-0 z-20 flex min-h-[46px] flex-col justify-center border-r border-t border-border bg-surface px-3 py-1.5 transition hover:bg-surface-2 ${
                      lane.archived ? "opacity-55" : ""
                    }`}
                    style={{ gridRow: row, gridColumn: 1 }}
                  >
                    <span className="truncate text-[13px] font-bold leading-tight text-text">
                      {lane.title}
                    </span>
                    <span className="truncate text-[11px] leading-tight text-text-faint">
                      {lane.client ? `${lane.client} · ` : ""}
                      {st.label}
                      {lane.archived ? " · Archived" : ""}
                    </span>
                  </Link>

                  {/* Week rules + weekend tint behind the bars */}
                  {Array.from({ length: days }).map((_, i) => {
                    const dow = new Date(`${dayAt(i)}T00:00:00Z`).getUTCDay();
                    const weekend = dow === 0 || dow === 6;
                    return (
                      <div
                        key={`z${lane.id}${i}`}
                        className={`min-h-[46px] border-t border-border ${
                          dow === 1 ? "border-l border-l-border" : ""
                        }`}
                        style={{
                          gridRow: row,
                          gridColumn: i + 2,
                          // Tailwind's /opacity modifier compiles to nothing on
                          // a var()-valued color in this setup, so tint here.
                          backgroundColor: weekend
                            ? "color-mix(in oklab, var(--surface-2) 45%, transparent)"
                            : undefined,
                        }}
                      />
                    );
                  })}

                  {lane.segments.map((s, i) => {
                    const style = SEG[s.kind];
                    const span = s.to - s.from + 1;
                    return (
                      <Link
                        key={`${lane.id}s${i}`}
                        href={`/projects/${lane.id}`}
                        title={`${lane.title} — ${s.label}`}
                        className="z-10 mx-px flex h-[26px] items-center gap-1.5 self-center overflow-hidden whitespace-nowrap rounded-[7px] px-2 text-[11px] font-bold"
                        style={{
                          gridRow: row,
                          gridColumn: `${s.from + 2} / span ${span}`,
                          backgroundColor: style.bg,
                          color: style.fg,
                          boxShadow: style.outline
                            ? "inset 0 0 0 1px var(--border-strong)"
                            : s.kind === "overdue"
                              ? "inset 0 0 0 1px color-mix(in oklab, var(--h-red) 35%, transparent)"
                              : undefined,
                          opacity: lane.archived ? 0.6 : 1,
                        }}
                      >
                        {span > 2 && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: "currentColor", opacity: 0.85 }}
                            aria-hidden
                          />
                        )}
                        {span > 1 ? s.label : ""}
                      </Link>
                    );
                  })}

                  {/* Delivery date marker */}
                  {lane.deliveryAt !== null && (
                    <span
                      title="Delivery date"
                      className="z-10 h-[26px] w-[3px] self-center justify-self-start rounded-sm"
                      style={{
                        gridRow: row,
                        gridColumn: lane.deliveryAt + 2,
                        backgroundColor: lane.overdue
                          ? "var(--h-red)"
                          : "var(--h-green)",
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* Days carrying more than one shoot */}
            {collisions.map((d) => (
              <div
                key={`c${d}`}
                aria-hidden
                className="pointer-events-none"
                style={{
                  gridRow: "3 / -1",
                  gridColumn: d + 2,
                  backgroundColor: "color-mix(in oklab, var(--h-red) 9%, transparent)",
                  borderLeft: "1px dashed color-mix(in oklab, var(--h-red) 45%, transparent)",
                  borderRight: "1px dashed color-mix(in oklab, var(--h-red) 45%, transparent)",
                }}
              />
            ))}

            {todayInView && (
              <div
                aria-hidden
                className="pointer-events-none border-l-2 border-accent"
                style={{ gridRow: "1 / -1", gridColumn: today + 2 }}
              >
                <span className="inline-block -translate-x-1/2 rounded-b-[6px] bg-accent px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-accent-fg">
                  Today
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-[11px] text-text-muted">
        <Key bg="var(--h-blue-bg)" ring="var(--h-blue)" label="Pre-pro" />
        <Key bg="var(--h-orange)" label="Shoot" />
        <Key bg="var(--h-purple-bg)" ring="var(--h-purple)" label="Post and review" />
        <Key bg="var(--h-red-bg)" ring="var(--h-red)" label="Past due" />
        <Key bg="var(--h-green-bg)" ring="var(--h-green)" label="Delivered" />
        <Key bg="transparent" ring="var(--border-strong)" label="No dates set" />
        {collisions.length > 0 && (
          <span className="font-semibold text-red">
            {collisions.length === 1
              ? "1 day with two shoots booked"
              : `${collisions.length} days with more than one shoot booked`}
          </span>
        )}
        {hidden > 0 && (
          <span className="ml-auto text-text-faint">
            {hidden} {hidden === 1 ? "project" : "projects"} outside this range
          </span>
        )}
      </div>
    </div>
  );
}

function Key({ bg, ring, label }: { bg: string; ring?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-3 w-3 shrink-0 rounded-[4px]"
        style={{
          backgroundColor: bg,
          boxShadow: ring ? `inset 0 0 0 1px ${ring}` : undefined,
        }}
      />
      {label}
    </span>
  );
}
