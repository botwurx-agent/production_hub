"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "@/components/app-shell/nav-icons";
import { shortDate } from "@/lib/format";
import {
  getCalendarEvents,
  addCalendarEvent,
  removeCalendarEvent,
} from "@/app/(app)/dashboard/calendar-actions";
import type { GCalEvent } from "@/lib/googlecalendar";
import type { CalendarEvent } from "@/components/dashboard/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KIND: Record<CalendarEvent["kind"], { label: string; hue: string }> = {
  shoot: { label: "Shoot", hue: "orange" },
  due: { label: "Delivery", hue: "blue" },
};
const GCAL_HUE = "purple";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type TypeFilter = "all" | "shoot" | "due";
type ViewMode = "month" | "agenda";

// A Google event mapped to a local day + label for display.
type GDisplay = GCalEvent & { dateKey: string; timeLabel: string };

function mapGoogle(e: GCalEvent): GDisplay {
  if (e.allDay) {
    return { ...e, dateKey: e.start.slice(0, 10), timeLabel: "All day" };
  }
  const d = new Date(e.start);
  return {
    ...e,
    dateKey: ymd(d),
    timeLabel: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}

export function Calendar({
  events,
  calendarConnected,
  initialYear,
  initialMonth,
  todayStr,
}: {
  events: CalendarEvent[];
  calendarConnected: boolean;
  initialYear: number;
  initialMonth: number;
  todayStr: string;
}) {
  const [view, setView] = useState<ViewMode>("month");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 0-11
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [client, setClient] = useState<string>("all");

  const [gEvents, setGEvents] = useState<GDisplay[]>([]);
  const [gError, setGError] = useState<string | null>(null);
  const [gLoading, startLoad] = useTransition();
  const [createDay, setCreateDay] = useState<string | null>(null);
  const [detail, setDetail] = useState<GDisplay | null>(null);

  const fetchMonth = useCallback(
    (y: number, m: number) => {
      if (!calendarConnected) return;
      const timeMin = new Date(y, m, 1).toISOString();
      const timeMax = new Date(y, m + 1, 1).toISOString();
      startLoad(async () => {
        const res = await getCalendarEvents(timeMin, timeMax);
        if ("error" in res) {
          setGError(res.error);
          setGEvents([]);
        } else {
          setGError(null);
          setGEvents(res.events.map(mapGoogle));
        }
      });
    },
    [calendarConnected]
  );

  useEffect(() => {
    fetchMonth(year, month);
  }, [year, month, fetchMonth]);

  const clients = useMemo(
    () =>
      Array.from(
        new Set(events.map((e) => e.client).filter((c): c is string => Boolean(c)))
      ).sort(),
    [events]
  );

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (typeFilter === "all" || e.kind === typeFilter) &&
          (client === "all" || e.client === client)
      ),
    [events, typeFilter, client]
  );

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const list = m.get(e.date) ?? [];
      list.push(e);
      m.set(e.date, list);
    }
    return m;
  }, [filtered]);

  // Google events only shown when the type filter is "all" (they aren't
  // shoots/deliveries) and no project-client filter is active.
  const showGoogle = typeFilter === "all" && client === "all";
  const gByDate = useMemo(() => {
    const m = new Map<string, GDisplay[]>();
    if (!showGoogle) return m;
    for (const e of gEvents) {
      const list = m.get(e.dateKey) ?? [];
      list.push(e);
      m.set(e.dateKey, list);
    }
    return m;
  }, [gEvents, showGoogle]);

  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function prev() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else setMonth((m) => m - 1);
  }
  function next() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else setMonth((m) => m + 1);
  }

  const navBtn =
    "grid h-7 w-7 place-items-center rounded-[8px] border border-border text-text-muted transition hover:bg-surface-2 hover:text-text";
  const segBtn = (active: boolean) =>
    `rounded-pill px-2.5 py-1 text-xs font-semibold transition ${
      active ? "bg-accent-soft text-accent" : "text-text-muted hover:text-text"
    }`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-text-muted" />
          <h2 className="font-display text-base font-bold">
            {view === "month" ? `${MONTHS[month]} ${year}` : "Agenda"}
          </h2>
          {gLoading && (
            <span className="text-xs text-text-faint">syncing...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {calendarConnected && (
            <Button size="sm" variant="secondary" onClick={() => setCreateDay(todayStr)}>
              + Event
            </Button>
          )}
          <div className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1">
            <button onClick={() => setView("month")} className={segBtn(view === "month")}>
              Month
            </button>
            <button onClick={() => setView("agenda")} className={segBtn(view === "agenda")}>
              Agenda
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1">
          {(["all", "shoot", "due"] as TypeFilter[]).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={segBtn(typeFilter === t)}>
              {t === "all" ? "All" : t === "shoot" ? "Shoots" : "Deliveries"}
            </button>
          ))}
        </div>
        {clients.length > 0 && (
          <select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted"
          >
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {view === "month" && (
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={prev} className={navBtn} aria-label="Previous month">
              &#8249;
            </button>
            <button
              onClick={() => {
                setYear(initialYear);
                setMonth(initialMonth);
              }}
              className="rounded-[8px] border border-border px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text"
            >
              Today
            </button>
            <button onClick={next} className={navBtn} aria-label="Next month">
              &#8250;
            </button>
          </div>
        )}
      </div>

      {!calendarConnected && (
        <p className="mb-3 rounded-[10px] border border-dashed border-border px-3 py-2 text-xs text-text-muted">
          Connect Google in{" "}
          <Link href="/settings" className="font-semibold text-accent hover:underline">
            Settings
          </Link>{" "}
          to see and add your Google Calendar events here.
        </p>
      )}
      {gError && (
        <p className="mb-3 rounded-[10px] bg-red-bg px-3 py-2 text-xs font-medium text-red">
          {gError}
        </p>
      )}

      {view === "month" ? (
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center text-[11px] font-semibold text-text-faint">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d === null)
              return <div key={i} className="min-h-[76px] rounded-[10px]" />;
            const ds = `${year}-${pad(month + 1)}-${pad(d)}`;
            const evs = byDate.get(ds) ?? [];
            const gEvs = gByDate.get(ds) ?? [];
            const isToday = ds === todayStr;
            const total = evs.length + gEvs.length;
            return (
              <div
                key={i}
                className={`group min-h-[76px] rounded-[10px] border p-1.5 ${
                  isToday ? "border-accent bg-accent-soft/50" : "border-border bg-surface"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  {calendarConnected ? (
                    <button
                      onClick={() => setCreateDay(ds)}
                      title="Add event"
                      className="opacity-0 transition group-hover:opacity-100 text-text-faint hover:text-accent"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  ) : (
                    <span />
                  )}
                  <span
                    className={`text-xs font-semibold ${
                      isToday ? "text-accent" : "text-text-faint"
                    }`}
                  >
                    {d}
                  </span>
                </div>
                <div className="space-y-1">
                  {evs.slice(0, 2).map((e, j) => (
                    <Link
                      key={`p${j}`}
                      href={e.href}
                      title={`${KIND[e.kind].label}: ${e.title}`}
                      className="block truncate rounded-[6px] px-1 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: `var(--h-${KIND[e.kind].hue}-bg)`,
                        color: `var(--h-${KIND[e.kind].hue})`,
                      }}
                    >
                      {e.title}
                    </Link>
                  ))}
                  {gEvs.slice(0, Math.max(0, 3 - Math.min(evs.length, 2))).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setDetail(e)}
                      title={`${e.timeLabel}: ${e.title}`}
                      className="flex w-full items-center gap-1 truncate rounded-[6px] px-1 py-0.5 text-left text-[11px] font-medium"
                      style={{
                        backgroundColor: `var(--h-${GCAL_HUE}-bg)`,
                        color: `var(--h-${GCAL_HUE})`,
                      }}
                    >
                      {e.meetLink && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11z" />
                        </svg>
                      )}
                      <span className="truncate">{e.title}</span>
                    </button>
                  ))}
                  {total > 3 && (
                    <div className="px-1 text-[10px] text-text-faint">
                      +{total - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <AgendaView
          events={filtered}
          gEvents={showGoogle ? gEvents : []}
          todayStr={todayStr}
          onGoogle={(e) => setDetail(e)}
        />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--h-orange)" }} />
          Shoot
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--h-blue)" }} />
          Delivery
        </span>
        {calendarConnected && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--h-${GCAL_HUE})` }} />
            Calendar
          </span>
        )}
      </div>

      {createDay && (
        <CreateEventModal
          day={createDay}
          onClose={() => setCreateDay(null)}
          onCreated={() => {
            setCreateDay(null);
            fetchMonth(year, month);
          }}
        />
      )}
      {detail && (
        <EventDetailModal
          event={detail}
          onClose={() => setDetail(null)}
          onDeleted={() => {
            setDetail(null);
            fetchMonth(year, month);
          }}
        />
      )}
    </div>
  );
}

function AgendaView({
  events,
  gEvents,
  todayStr,
  onGoogle,
}: {
  events: CalendarEvent[];
  gEvents: GDisplay[];
  todayStr: string;
  onGoogle: (e: GDisplay) => void;
}) {
  type Row =
    | { kind: "project"; date: string; ev: CalendarEvent }
    | { kind: "google"; date: string; ev: GDisplay };
  const rows: Row[] = [
    ...events.map((ev) => ({ kind: "project" as const, date: ev.date, ev })),
    ...gEvents.map((ev) => ({ kind: "google" as const, date: ev.dateKey, ev })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-faint">
        No dates match these filters.
      </p>
    );
  }
  return (
    <ul className="max-h-[440px] space-y-1.5 overflow-y-auto pr-1">
      {rows.map((r, i) => {
        const isPast = r.date < todayStr;
        if (r.kind === "project") {
          const meta = KIND[r.ev.kind];
          return (
            <li key={`p${i}`}>
              <Link
                href={r.ev.href}
                className={`flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2 transition hover:bg-surface-2/60 ${
                  isPast ? "opacity-60" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: `var(--h-${meta.hue})` }} />
                  <span className="truncate text-sm font-semibold text-text">{r.ev.title}</span>
                  <span className="shrink-0 text-xs text-text-faint">{meta.label}</span>
                </span>
                <span className="shrink-0 text-xs font-medium text-text-muted">
                  {shortDate(r.date)}
                </span>
              </Link>
            </li>
          );
        }
        return (
          <li key={`g${i}`}>
            <button
              onClick={() => onGoogle(r.ev)}
              className={`flex w-full items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2 text-left transition hover:bg-surface-2/60 ${
                isPast ? "opacity-60" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: `var(--h-${GCAL_HUE})` }} />
                <span className="truncate text-sm font-semibold text-text">{r.ev.title}</span>
                {r.ev.meetLink && (
                  <span className="shrink-0 text-xs font-semibold" style={{ color: `var(--h-${GCAL_HUE})` }}>
                    Meet
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs font-medium text-text-muted">
                {shortDate(r.date)} · {r.ev.timeLabel}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EventDetailModal({
  event,
  onClose,
  onDeleted,
}: {
  event: GDisplay;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function del() {
    setErr(null);
    start(async () => {
      const res = await removeCalendarEvent(event.id);
      if ("error" in res) setErr(res.error);
      else onDeleted();
    });
  }

  return (
    <Modal open onClose={onClose} title={event.title}>
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          {shortDate(event.dateKey)} · {event.timeLabel}
        </p>
        {event.meetLink && (
          <a
            href={event.meetLink}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:bg-accent-strong"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11z" />
            </svg>
            Join Google Meet
          </a>
        )}
        {err && (
          <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {err}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {event.htmlLink ? (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-accent hover:underline"
            >
              Open in Google Calendar
            </a>
          ) : (
            <span />
          )}
          <Button variant="danger" size="sm" onClick={del} disabled={busy}>
            {busy ? "Deleting..." : "Delete event"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateEventModal({
  day,
  onClose,
  onCreated,
}: {
  day: string; // YYYY-MM-DD
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(day);
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [addMeet, setAddMeet] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const inputCls =
    "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";

  function submit() {
    if (!title.trim()) return setErr("Give the event a title.");
    setErr(null);
    let input;
    if (allDay) {
      const [y, m, d] = date.split("-").map(Number);
      const endExclusive = new Date(y, m - 1, d + 1);
      input = {
        title,
        allDay: true,
        start: date,
        end: ymd(endExclusive),
        timeZone: tz,
        addMeet,
      };
    } else {
      const startISO = new Date(`${date}T${startTime}`).toISOString();
      const endISO = new Date(`${date}T${endTime}`).toISOString();
      if (endISO <= startISO) return setErr("End time must be after start.");
      input = {
        title,
        allDay: false,
        start: startISO,
        end: endISO,
        timeZone: tz,
        addMeet,
      };
    }
    start(async () => {
      const res = await addCalendarEvent(input);
      if ("error" in res) setErr(res.error);
      else onCreated();
    });
  }

  return (
    <Modal open onClose={onClose} title="New event">
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          autoFocus
          className={inputCls}
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </div>
        {!allDay && (
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputCls}
            />
            <span className="text-text-faint">to</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputCls}
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          All day
        </label>
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={addMeet}
            onChange={(e) => setAddMeet(e.target.checked)}
          />
          Add a Google Meet link
        </label>
        {err && (
          <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Creating..." : "Create event"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
