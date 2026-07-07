"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { shortDate } from "@/lib/format";
import {
  addProjectEvent,
  updateProjectEvent,
  deleteProjectEvent,
  type EventInput,
} from "@/app/(app)/projects/[id]/calendar-actions";

export type PEvent = {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
  kind: string;
  notes: string | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// kind -> color + label. Milestones (shoot / delivery) reuse shoot/delivery.
const KIND: Record<string, { label: string; hue: string }> = {
  shoot: { label: "Shoot", hue: "orange" },
  prepro: { label: "Pre-pro", hue: "indigo" },
  review: { label: "Review", hue: "pink" },
  delivery: { label: "Delivery", hue: "blue" },
  other: { label: "Other", hue: "cyan" },
};
const KIND_OPTIONS = ["prepro", "shoot", "review", "delivery", "other"];
const hueOf = (k: string) => KIND[k]?.hue ?? "cyan";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// A display occurrence on a single day.
type Occ = {
  key: string;
  title: string;
  kind: string;
  editable: boolean;
  event: PEvent | null;
};

const inputCls =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-border-strong";

export function ProjectCalendar({
  projectId,
  events,
  shootDate,
  dueDate,
  todayStr,
}: {
  projectId: string;
  events: PEvent[];
  shootDate: string | null;
  dueDate: string | null;
  todayStr: string;
}) {
  const [y0, m0] = todayStr.split("-").map(Number);
  const [year, setYear] = useState(y0);
  const [month, setMonth] = useState(m0 - 1); // 0-11
  const [view, setView] = useState<"month" | "agenda">("month");
  const [editing, setEditing] = useState<PEvent | null>(null);
  const [addDay, setAddDay] = useState<string | null>(null);

  // Read-only project milestones shown alongside the editable events.
  const milestones = useMemo(() => {
    const list: { date: string; title: string; kind: string }[] = [];
    if (shootDate) list.push({ date: shootDate, title: "Shoot day", kind: "shoot" });
    if (dueDate) list.push({ date: dueDate, title: "Delivery due", kind: "delivery" });
    return list;
  }, [shootDate, dueDate]);

  // Expand events (incl. multi-day ranges) + milestones into per-day occurrences.
  const byDate = useMemo(() => {
    const m = new Map<string, Occ[]>();
    const push = (day: string, occ: Occ) => {
      const list = m.get(day) ?? [];
      list.push(occ);
      m.set(day, list);
    };
    for (const e of events) {
      const start = new Date(`${e.date}T00:00:00`);
      const end = e.end_date ? new Date(`${e.end_date}T00:00:00`) : start;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        push(ymd(d), {
          key: `${e.id}-${ymd(d)}`,
          title: e.title,
          kind: e.kind,
          editable: true,
          event: e,
        });
      }
    }
    for (const ms of milestones) {
      push(ms.date, {
        key: `ms-${ms.kind}-${ms.date}`,
        title: ms.title,
        kind: ms.kind,
        editable: false,
        event: null,
      });
    }
    return m;
  }, [events, milestones]);

  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function prev() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function next() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const navBtn =
    "grid h-7 w-7 place-items-center rounded-[8px] border border-border text-text-muted transition hover:bg-surface-2 hover:text-text";
  const segBtn = (active: boolean) =>
    `rounded-pill px-2.5 py-1 text-xs font-semibold transition ${
      active ? "bg-accent-soft text-accent" : "text-text-muted hover:text-text"
    }`;

  function openOcc(occ: Occ) {
    if (occ.editable && occ.event) setEditing(occ.event);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-text">
          {view === "month" ? `${MONTHS[month]} ${year}` : "Agenda"}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setAddDay(todayStr)}>
            + Event
          </Button>
          <div className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-1">
            <button onClick={() => setView("month")} className={segBtn(view === "month")}>
              Month
            </button>
            <button onClick={() => setView("agenda")} className={segBtn(view === "agenda")}>
              Agenda
            </button>
          </div>
          {view === "month" && (
            <div className="flex items-center gap-1.5">
              <button onClick={prev} className={navBtn} aria-label="Previous month">
                &#8249;
              </button>
              <button
                onClick={() => { setYear(y0); setMonth(m0 - 1); }}
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
      </div>

      {view === "month" ? (
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center text-[11px] font-semibold text-text-faint">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="min-h-[84px] rounded-[10px]" />;
            const ds = `${year}-${pad(month + 1)}-${pad(d)}`;
            const occs = byDate.get(ds) ?? [];
            const isToday = ds === todayStr;
            return (
              <div
                key={i}
                className={`group min-h-[84px] rounded-[10px] border p-1.5 ${
                  isToday ? "border-accent bg-accent-soft/50" : "border-border bg-surface"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <button
                    onClick={() => setAddDay(ds)}
                    title="Add on this day"
                    className="text-text-faint opacity-0 transition hover:text-accent group-hover:opacity-100"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                  <span className={`text-xs font-semibold ${isToday ? "text-accent" : "text-text-faint"}`}>
                    {d}
                  </span>
                </div>
                <div className="space-y-1">
                  {occs.slice(0, 3).map((o) => (
                    <button
                      key={o.key}
                      onClick={() => openOcc(o)}
                      title={o.title}
                      className={`block w-full truncate rounded-[6px] px-1 py-0.5 text-left text-[11px] font-medium ${
                        o.editable ? "" : "cursor-default"
                      }`}
                      style={{
                        backgroundColor: `var(--h-${hueOf(o.kind)}-bg)`,
                        color: `var(--h-${hueOf(o.kind)})`,
                      }}
                    >
                      {o.title}
                    </button>
                  ))}
                  {occs.length > 3 && (
                    <div className="px-1 text-[10px] text-text-faint">+{occs.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <AgendaView
          events={events}
          milestones={milestones}
          todayStr={todayStr}
          onEdit={(e) => setEditing(e)}
        />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-text-faint">
        {KIND_OPTIONS.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--h-${hueOf(k)})` }} />
            {KIND[k].label}
          </span>
        ))}
      </div>

      {(addDay || editing) && (
        <EventModal
          projectId={projectId}
          day={addDay}
          event={editing}
          onClose={() => { setAddDay(null); setEditing(null); }}
        />
      )}
    </div>
  );
}

function AgendaView({
  events,
  milestones,
  todayStr,
  onEdit,
}: {
  events: PEvent[];
  milestones: { date: string; title: string; kind: string }[];
  todayStr: string;
  onEdit: (e: PEvent) => void;
}) {
  type Row =
    | { date: string; title: string; kind: string; event: PEvent }
    | { date: string; title: string; kind: string; event: null };
  const rows: Row[] = [
    ...events.map((e) => ({ date: e.date, title: e.title, kind: e.kind, event: e })),
    ...milestones.map((m) => ({ date: m.date, title: m.title, kind: m.kind, event: null })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-faint">
        No dates yet. Add the shoot, review calls, and delivery.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => {
        const isPast = r.date < todayStr;
        const hue = hueOf(r.kind);
        const inner = (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: `var(--h-${hue})` }} />
            <span className="truncate text-sm font-semibold text-text">{r.title}</span>
            <span className="shrink-0 text-xs text-text-faint">{KIND[r.kind]?.label ?? "Date"}</span>
          </span>
        );
        const meta = (
          <span className="shrink-0 text-xs font-medium text-text-muted">{shortDate(r.date)}</span>
        );
        const cls = `flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2 ${
          isPast ? "opacity-60" : ""
        }`;
        return (
          <li key={i}>
            {r.event ? (
              <button onClick={() => onEdit(r.event as PEvent)} className={`${cls} w-full text-left transition hover:bg-surface-2/60`}>
                {inner}
                {meta}
              </button>
            ) : (
              <div className={cls}>
                {inner}
                {meta}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function EventModal({
  projectId,
  day,
  event,
  onClose,
}: {
  projectId: string;
  day: string | null;
  event: PEvent | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<EventInput>({
    title: event?.title ?? "",
    date: event?.date ?? day ?? "",
    endDate: event?.end_date ?? "",
    kind: event?.kind ?? "prepro",
    notes: event?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function set<K extends keyof EventInput>(k: K, v: EventInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = event
        ? await updateProjectEvent(projectId, event.id, form)
        : await addProjectEvent(projectId, form);
      if (res?.error) setError(res.error);
      else { router.refresh(); onClose(); }
    });
  }

  function remove() {
    if (!event) return;
    start(async () => {
      await deleteProjectEvent(projectId, event.id);
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} title={event ? "Edit date" : "Add date"}>
      <div className="space-y-3">
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Title (e.g. Casting, Location scout, Client review)"
          autoFocus
          className={inputCls}
        />
        <div className="flex flex-wrap gap-2">
          {KIND_OPTIONS.map((k) => (
            <button
              key={k}
              onClick={() => set("kind", k)}
              className="rounded-pill px-2.5 py-1 text-xs font-semibold transition"
              style={
                form.kind === k
                  ? { backgroundColor: `var(--h-${hueOf(k)}-bg)`, color: `var(--h-${hueOf(k)})` }
                  : { backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }
              }
            >
              {KIND[k].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex-1 text-xs font-semibold text-text-faint">
            Date
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="flex-1 text-xs font-semibold text-text-faint">
            End (optional)
            <input
              type="date"
              value={form.endDate ?? ""}
              onChange={(e) => set("endDate", e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
        </div>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Notes (optional)"
          className={`${inputCls} min-h-[60px]`}
        />
        {error && (
          <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          {event ? (
            <button
              onClick={remove}
              disabled={busy}
              className="text-sm font-semibold text-red hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
