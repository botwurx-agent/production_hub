import Link from "next/link";
import { StatusTag, type Hue } from "@/components/status-tag";
import { shortDate } from "@/lib/format";
import type { CalendarEvent } from "@/components/dashboard/types";

const KIND: Record<CalendarEvent["kind"], { label: string; hue: Hue }> = {
  shoot: { label: "Shoot", hue: "orange" },
  due: { label: "Delivery", hue: "blue" },
};

// The next shoots and deliveries, soonest first.
export function Upcoming({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-faint">
        Nothing scheduled ahead.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {events.map((e, i) => (
        <li key={i}>
          <Link
            href={e.href}
            className="flex items-center justify-between gap-3 rounded-[10px] px-2 py-1.5 transition hover:bg-surface-2/70"
          >
            <span className="min-w-0 truncate text-sm font-semibold text-text">
              {e.title}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <StatusTag hue={KIND[e.kind].hue} dot={false}>
                {KIND[e.kind].label}
              </StatusTag>
              <span className="text-xs text-text-faint">{shortDate(e.date)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
