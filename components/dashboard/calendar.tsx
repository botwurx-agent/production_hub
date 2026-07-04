"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarIcon } from "@/components/app-shell/nav-icons";
import { shortDate } from "@/lib/format";
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

const pad = (n: number) => String(n).padStart(2, "0");

type TypeFilter = "all" | "shoot" | "due";
type ViewMode = "month" | "agenda";

export function Calendar({
  events,
  initialYear,
  initialMonth,
  todayStr,
}: {
  events: CalendarEvent[];
  initialYear: number;
  initialMonth: number;
  todayStr: string;
}) {
  const [view, setView] = useState<ViewMode>("month");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 0-11
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [client, setClient] = useState<string>("all");

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
        </div>
        <div className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1">
          <button onClick={() => setView("month")} className={segBtn(view === "month")}>
            Month
          </button>
          <button onClick={() => setView("agenda")} className={segBtn(view === "agenda")}>
            Agenda
          </button>
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
            const isToday = ds === todayStr;
            return (
              <div
                key={i}
                className={`min-h-[76px] rounded-[10px] border p-1.5 ${
                  isToday ? "border-accent bg-accent-soft/50" : "border-border bg-surface"
                }`}
              >
                <div
                  className={`mb-1 text-right text-xs font-semibold ${
                    isToday ? "text-accent" : "text-text-faint"
                  }`}
                >
                  {d}
                </div>
                <div className="space-y-1">
                  {evs.slice(0, 3).map((e, j) => (
                    <Link
                      key={j}
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
                  {evs.length > 3 && (
                    <div className="px-1 text-[10px] text-text-faint">
                      +{evs.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <AgendaView events={filtered} todayStr={todayStr} />
      )}

      <div className="mt-3 flex items-center gap-4 text-xs text-text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--h-orange)" }} />
          Shoot
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--h-blue)" }} />
          Delivery
        </span>
      </div>
    </div>
  );
}

function AgendaView({
  events,
  todayStr,
}: {
  events: CalendarEvent[];
  todayStr: string;
}) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-faint">
        No dates match these filters.
      </p>
    );
  }
  return (
    <ul className="max-h-[440px] space-y-1.5 overflow-y-auto pr-1">
      {sorted.map((e, i) => {
        const meta = KIND[e.kind];
        const isPast = e.date < todayStr;
        return (
          <li key={i}>
            <Link
              href={e.href}
              className={`flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2 transition hover:bg-surface-2/60 ${
                isPast ? "opacity-60" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--h-${meta.hue})` }}
                />
                <span className="truncate text-sm font-semibold text-text">
                  {e.title}
                </span>
                <span className="shrink-0 text-xs text-text-faint">
                  {meta.label}
                </span>
              </span>
              <span className="shrink-0 text-xs font-medium text-text-muted">
                {shortDate(e.date)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
