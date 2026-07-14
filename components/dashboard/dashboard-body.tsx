"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { StatTiles, type Stat } from "@/components/dashboard/stat-tiles";
import { Calendar } from "@/components/dashboard/calendar";
import { Upcoming } from "@/components/dashboard/upcoming";
import { PipelineSnapshot } from "@/components/dashboard/pipeline-snapshot";
import { TaskWidget, type DashboardTask } from "@/components/dashboard/task-widget";
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
  { id: "tasks", label: "Tasks" },
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

const S = (path: ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const SECTION_ICONS = {
  myday: S(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  upcoming: S(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  messages: S(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />),
  pipeline: S(<><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>),
  activity: S(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />),
  tasks: S(<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
} as const;

function TitledCard({
  title,
  icon,
  hue = "indigo",
  children,
}: {
  title: string;
  icon?: ReactNode;
  hue?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2.5">
        {icon && (
          <IconTile hue={hue} size="sm">
            {icon}
          </IconTile>
        )}
        <h2 className="font-display text-base font-bold">{title}</h2>
      </div>
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
  openValue,
  tasks,
  activity,
  calendarConnected,
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
  openValue: number;
  tasks: DashboardTask[];
  activity: ActivityFeedItem[];
  calendarConnected: boolean;
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
    show("tasks") && (
      <TitledCard key="tasks" title="Tasks" icon={SECTION_ICONS.tasks} hue="cyan">
        <TaskWidget tasks={tasks} />
      </TitledCard>
    ),
    show("upcoming") && (
      <TitledCard key="upcoming" title="Upcoming" icon={SECTION_ICONS.upcoming} hue="green">
        <Upcoming events={upcoming} />
      </TitledCard>
    ),
    show("messages") && (
      <TitledCard key="messages" title="Messages" icon={SECTION_ICONS.messages} hue="blue">
        <UnreadWidget />
      </TitledCard>
    ),
    show("pipeline") && (
      <TitledCard key="pipeline" title="Pipeline" icon={SECTION_ICONS.pipeline} hue="pink">
        <PipelineSnapshot counts={counts} openValue={openValue} />
      </TitledCard>
    ),
    show("activity") && (
      <TitledCard key="activity" title="Recent activity" icon={SECTION_ICONS.activity} hue="purple">
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
        <TitledCard title="My day" icon={SECTION_ICONS.myday} hue="orange">
          <MyDay events={todayEvents} outstandingCount={outstanding.length} />
        </TitledCard>
      )}

      {show("needsyou") && <NeedsYou items={outstanding} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <Calendar
            events={events}
            calendarConnected={calendarConnected}
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
