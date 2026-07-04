import Link from "next/link";
import { StatusTag, type Hue } from "@/components/status-tag";
import type { CalendarEvent } from "@/components/dashboard/types";

const KIND: Record<CalendarEvent["kind"], { label: string; hue: Hue }> = {
  shoot: { label: "Shoot today", hue: "orange" },
  due: { label: "Delivery today", hue: "blue" },
};

// A tight "what's on today" surface: today's shoots/deliveries and the count
// of things waiting on you.
export function MyDay({
  events,
  outstandingCount,
}: {
  events: CalendarEvent[];
  outstandingCount: number;
}) {
  if (events.length === 0 && outstandingCount === 0) {
    return (
      <p className="py-4 text-sm text-text-muted">
        Nothing due today. Clear runway.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <Link
          key={i}
          href={e.href}
          className="flex items-center justify-between gap-3 rounded-[10px] px-2 py-1.5 transition hover:bg-surface-2/70"
        >
          <span className="min-w-0 truncate text-sm font-semibold text-text">
            {e.title}
          </span>
          <StatusTag hue={KIND[e.kind].hue} dot={false}>
            {KIND[e.kind].label}
          </StatusTag>
        </Link>
      ))}
      {outstandingCount > 0 && (
        <Link
          href="/projects"
          className="flex items-center justify-between gap-3 rounded-[10px] px-2 py-1.5 text-sm transition hover:bg-surface-2/70"
        >
          <span className="text-text-muted">Items waiting on you</span>
          <span
            className="rounded-pill px-2 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: "var(--h-yellow-bg)",
              color: "var(--h-yellow)",
            }}
          >
            {outstandingCount}
          </span>
        </Link>
      )}
    </div>
  );
}
