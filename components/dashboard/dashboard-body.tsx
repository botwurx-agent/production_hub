"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatTiles, type Stat } from "@/components/dashboard/stat-tiles";
import { Calendar } from "@/components/dashboard/calendar";
import { Upcoming } from "@/components/dashboard/upcoming";
import { PipelineSnapshot } from "@/components/dashboard/pipeline-snapshot";
import { MyDay } from "@/components/dashboard/my-day";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UnreadWidget } from "@/components/dashboard/unread-widget";
import { NeedsYou } from "@/components/projects/needs-you";
import type { OutstandingItem } from "@/lib/outstanding";
import type { CalendarEvent, ActivityFeedItem } from "@/components/dashboard/types";

const STORAGE_KEY = "dashboard.hidden.v1";

const TOGGLEABLE: { id: string; label: string }[] = [
  { id: "myday", label: "My day" },
  { id: "needsyou", label: "Needs you" },
  { id: "upcoming", label: "Upcoming" },
  { id: "pipeline", label: "Pipeline" },
  { id: "activity", label: "Recent activity" },
  { id: "messages", label: "Messages" },
];

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function TitledCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-display text-base font-bold">{title}</h2>
      {children}
    </Card>
  );
}

export function DashboardBody({
  stats,
  outstanding,
  events,
  upcoming,
  todayEvents,
  counts,
  followUpCount,
  activity,
  initialYear,
  initialMonth,
  todayStr,
}: {
  stats: Stat[];
  outstanding: OutstandingItem[];
  events: CalendarEvent[];
  upcoming: CalendarEvent[];
  todayEvents: CalendarEvent[];
  counts: Record<string, number>;
  followUpCount: number;
  activity: ActivityFeedItem[];
  initialYear: number;
  initialMonth: number;
  todayStr: string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggle(id: string) {
    setHidden((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...nextSet]));
      } catch {
        // ignore
      }
      return nextSet;
    });
  }

  const show = (id: string) => !hidden.has(id);

  // Right column widgets, in order, that are currently visible.
  const rightColumn = [
    show("upcoming") && (
      <TitledCard key="upcoming" title="Upcoming">
        <Upcoming events={upcoming} />
      </TitledCard>
    ),
    show("messages") && (
      <TitledCard key="messages" title="Messages">
        <UnreadWidget />
      </TitledCard>
    ),
    show("pipeline") && (
      <TitledCard key="pipeline" title="Pipeline">
        <PipelineSnapshot counts={counts} followUps={followUpCount} />
      </TitledCard>
    ),
    show("activity") && (
      <TitledCard key="activity" title="Recent activity">
        <RecentActivity items={activity} />
      </TitledCard>
    ),
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted shadow-sm transition hover:text-text"
          >
            <GearIcon />
            Customize
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-[12px] border border-border bg-surface p-1 shadow-lg">
              <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
                Show widgets
              </div>
              {TOGGLEABLE.map((w) => (
                <button
                  key={w.id}
                  onClick={() => toggle(w.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-[9px] px-2 py-1.5 text-left text-sm transition hover:bg-surface-2"
                >
                  <span className="text-text">{w.label}</span>
                  <span
                    className="grid h-4 w-4 place-items-center rounded-[5px] border"
                    style={
                      show(w.id)
                        ? {
                            backgroundColor: "var(--accent)",
                            borderColor: "var(--accent)",
                            color: "var(--accent-fg)",
                          }
                        : { borderColor: "var(--border-strong)" }
                    }
                  >
                    {show(w.id) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <StatTiles stats={stats} />

      {show("myday") && (
        <TitledCard title="My day">
          <MyDay events={todayEvents} outstandingCount={outstanding.length} />
        </TitledCard>
      )}

      {show("needsyou") && <NeedsYou items={outstanding} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <Calendar
            events={events}
            initialYear={initialYear}
            initialMonth={initialMonth}
            todayStr={todayStr}
          />
        </Card>
        {rightColumn.length > 0 && (
          <div className="space-y-6">{rightColumn}</div>
        )}
      </div>
    </div>
  );
}
