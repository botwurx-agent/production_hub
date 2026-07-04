"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarIcon } from "@/components/app-shell/nav-icons";
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

// Month calendar of production dates (shoots + deliveries). The initial month
// and "today" come from the server so SSR and the client agree.
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
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 0-11

  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-text-muted" />
          <h2 className="font-display text-base font-bold">
            {MONTHS[month]} {year}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
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
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 text-center text-[11px] font-semibold text-text-faint"
          >
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
                isToday
                  ? "border-accent bg-accent-soft/50"
                  : "border-border bg-surface"
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

      <div className="mt-3 flex items-center gap-4 text-xs text-text-faint">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--h-orange)" }}
          />
          Shoot
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--h-blue)" }}
          />
          Delivery
        </span>
      </div>
    </div>
  );
}
