"use client";

/**
 * The shooting schedule editor.
 *
 * A SCHEDULE THAT CAST AND CREW READ IS A TABLE, so the Day view is a grid
 * with named columns (Time / What / Location & set / Talent / Crew /
 * Duration), talent with an avatar in a column of its own, location as the
 * place you drive to with the set beneath it, a grip on every row. The Board
 * view is every day as a column of the same rows, for moving work between
 * days, where the stripboard's INT/EXT DAY/NIGHT colours are the strip's edge
 * on a live-action job and the kind colour is the edge on a studio day.
 *
 * TIMES ARE NEVER TYPED. lib/schedule-time cascades them from durations; an
 * anchored row holds its time and the slack against it is reported above the
 * row, as a buffer or an overrun in red.
 *
 * A ROW EDITS IN A MODAL, same as a task card, because a row that expands in
 * place reflows the table under the cursor you just dropped with. Delete lives
 * in that modal behind a confirm, since there is no undo here yet.
 *
 * Optimistic: every change lands in local state first, the action runs, and
 * router.refresh() re-syncs (or a failed action toasts and re-syncs).
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { confirmAction } from "@/components/ui/confirm";
import {
  cascade,
  fmtDuration,
  fmtHM,
  overUnder,
  parseHM,
  positionBetween,
  type DayNight,
  type IntExt,
  type StripKind,
  type Timed,
} from "@/lib/schedule-time";
import type { RosterOption, ScheduleDayView, ScheduleRowView, ShotOption } from "@/lib/schedule-data";
import {
  addScheduleRow,
  createScheduleDay,
  deleteScheduleDay,
  deleteScheduleRow,
  moveScheduleRow,
  setRowPeople,
  setRowShots,
  updateScheduleDay,
  updateScheduleRow,
  type RowInput,
} from "@/app/(app)/projects/[id]/schedule-actions";

type Row = ScheduleRowView;
type Day = ScheduleDayView;

export const KIND: Record<StripKind, { label: string; hue: string; defaultTitle: string; defaultMin: number }> = {
  call: { label: "Call", hue: "indigo", defaultTitle: "Crew call", defaultMin: 30 },
  meal: { label: "Meal", hue: "amber", defaultTitle: "Lunch", defaultMin: 60 },
  setup: { label: "Setup", hue: "blue", defaultTitle: "Setup", defaultMin: 60 },
  shot: { label: "Shoot", hue: "green", defaultTitle: "", defaultMin: 60 },
  move: { label: "Move", hue: "orange", defaultTitle: "Company move", defaultMin: 30 },
  note: { label: "Note", hue: "purple", defaultTitle: "", defaultMin: 0 },
  wrap: { label: "Wrap", hue: "indigo", defaultTitle: "Wrap", defaultMin: 0 },
};
const KIND_ORDER: StripKind[] = ["shot", "setup", "meal", "move", "note", "call", "wrap"];

/** The industry's own four: INT DAY white, EXT DAY yellow, INT NIGHT blue, EXT NIGHT green. */
function boardHue(r: Row): string | null {
  if (!r.intExt || !r.dayNight) return null;
  if (r.intExt === "INT" && r.dayNight === "DAY") return "border-strong";
  if (r.intExt === "EXT" && r.dayNight === "DAY") return "h-yellow";
  if (r.intExt === "INT" && r.dayNight === "NIGHT") return "h-blue";
  return "h-green";
}
const h = (hue: string) => `var(--${hue.startsWith("h-") || hue.startsWith("border") ? hue : `h-${hue}`})`;
const hbg = (hue: string) => `var(--h-${hue}-bg)`;

function fmtDate(iso: string | null): string {
  if (!iso) return "Date not set";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function nameHue(name: string): string {
  const hues = ["indigo", "purple", "pink", "cyan", "orange", "green"];
  let k = 0;
  for (const c of name) k = (k * 31 + c.charCodeAt(0)) >>> 0;
  return hues[k % hues.length];
}
const callMin = (d: Day) => parseHM(d.callTime) ?? 7 * 60;
const wrapMin = (d: Day) => parseHM(d.wrapTarget) ?? 18 * 60;
const isTalentCategory = (c: string | null) => c === "talent" || c === "extras";

type Drag = { dayId: string; rowId: string };

// ---------------------------------------------------------------------------

export function ScheduleEditor({
  projectId,
  days: serverDays,
  shotOptions,
  roster,
  canEdit,
}: {
  projectId: string;
  days: Day[];
  shotOptions: ShotOption[];
  roster: RosterOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [days, setDays] = useState<Day[]>(serverDays);
  useEffect(() => setDays(serverDays), [serverDays]);
  const [view, setView] = useState<"day" | "board">("day");
  const [dayIdx, setDayIdx] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [editing, setEditing] = useState<{ row: Row; day: Day } | null>(null);
  const [editingDay, setEditingDay] = useState<Day | null>(null);
  const [, start] = useTransition();

  const day = days[Math.min(dayIdx, Math.max(0, days.length - 1))];

  // Persist the view choice like the task board persists its grouping.
  useEffect(() => {
    try { const v = localStorage.getItem("schedule.view"); if (v === "board" || v === "day") setView(v); } catch {}
  }, []);
  function pickView(v: "day" | "board") {
    setView(v);
    try { localStorage.setItem("schedule.view", v); } catch {}
  }

  function fail(msg: string) {
    toast(msg, "error");
    router.refresh();
  }

  // ---- optimistic helpers -------------------------------------------------
  function patchRowLocal(rowId: string, patch: Partial<Row>) {
    setDays((ds) => ds.map((d) => ({ ...d, rows: d.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) })));
  }

  function patchRow(rowId: string, input: RowInput, local: Partial<Row>) {
    patchRowLocal(rowId, local);
    start(async () => {
      const res = await updateScheduleRow(projectId, rowId, input);
      if (res?.error) fail(res.error);
    });
  }

  /** Drop `rowId` into `toDayId` at `index` (measured on the target day's rows, wrap excluded). */
  function moveRow(from: Drag, toDayId: string, index: number) {
    const src = days.find((d) => d.id === from.dayId);
    const row = src?.rows.find((r) => r.id === from.rowId);
    const dst = days.find((d) => d.id === toDayId);
    if (!src || !row || !dst) return;
    if (row.kind === "wrap") return;

    const body = dst.rows.filter((r) => r.id !== from.rowId && r.kind !== "wrap");
    const idx = Math.max(0, Math.min(index, body.length));
    // Same day, moving down: the hole the drag leaves shifts the index by one.
    const fromIdx = dst.id === src.id ? dst.rows.filter((r) => r.kind !== "wrap").findIndex((r) => r.id === row.id) : -1;
    const at = fromIdx !== -1 && index > fromIdx ? idx : idx;
    const before = body[at - 1]?.position;
    const after = body[at]?.position;
    const position = positionBetween(before, after);

    setDays((ds) => {
      const without = ds.map((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== row.id) }));
      return without.map((d) => {
        if (d.id !== toDayId) return d;
        const rows = [...d.rows, { ...row, dayId: toDayId, position }].sort((a, b) => a.position - b.position || (a.kind === "wrap" ? 1 : 0) - (b.kind === "wrap" ? 1 : 0));
        return { ...d, rows };
      });
    });
    start(async () => {
      const res = await moveScheduleRow(projectId, row.id, toDayId, position);
      if (res?.error) fail(res.error);
      else router.refresh();
    });
  }

  function addRow(d: Day, kind: StripKind) {
    const k = KIND[kind];
    start(async () => {
      const res = await addScheduleRow(projectId, d.id, {
        kind,
        title: k.defaultTitle,
        durationMin: k.defaultMin,
        location: d.location,
        anchoredAt: kind === "meal" && k.defaultTitle === "Lunch" ? "1:00 pm" : null,
      });
      if ("error" in res) return fail(res.error);
      router.refresh();
      // Open it straight away: a row with no title or shots is not done.
      const fresh: Row = {
        id: res.id, dayId: d.id, position: Number.MAX_SAFE_INTEGER, kind, title: k.defaultTitle,
        location: d.location, set: null, intExt: null, dayNight: null, durationMin: k.defaultMin,
        anchoredAt: kind === "meal" ? "1:00 pm" : null, notes: null, shots: [], talent: [], crew: [],
      };
      setEditing({ row: fresh, day: d });
    });
  }

  function addDay() {
    start(async () => {
      const res = await createScheduleDay(projectId);
      if ("error" in res) return fail(res.error);
      router.refresh();
      setDayIdx(days.length);
    });
  }

  async function removeDay(d: Day) {
    const shots = d.rows.reduce((n, r) => n + r.shots.length, 0);
    const ok = await confirmAction({
      title: `Delete Day ${d.dayNumber}?`,
      body: `${d.rows.length} ${d.rows.length === 1 ? "row" : "rows"} go with it${shots ? `, and ${shots} ${shots === 1 ? "shot goes" : "shots go"} back to unscheduled` : ""}. Later days renumber. There is no undo.`,
      confirmLabel: "Delete day",
    });
    if (!ok) return;
    setDays((ds) => ds.filter((x) => x.id !== d.id));
    setDayIdx(0);
    start(async () => {
      const res = await deleteScheduleDay(projectId, d.id);
      if (res?.error) fail(res.error);
      else router.refresh();
    });
  }

  // ---- empty ---------------------------------------------------------------
  if (days.length === 0) {
    return (
      <EmptyState
        hue="green"
        title="No shoot days yet"
        description="Add the first day, then build it from the shot list. Times fall out of the durations; the day re-flows when anything changes."
        action={canEdit ? <Button onClick={addDay}>Add Day 1</Button> : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Seg value={view} onChange={(v) => pickView(v as "day" | "board")} options={[["day", "Day"], ["board", "Board"]]} />
        <span className="flex-1" />
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={addDay}>+ Add a day</Button>
        )}
      </div>

      {view === "day" ? (
        <>
          <div className="flex flex-nowrap items-end gap-1 overflow-x-auto border-b border-border">
            {days.map((d, i) => {
              const t = cascade(d.rows, callMin(d));
              const ou = overUnder(t, wrapMin(d), callMin(d));
              const active = i === dayIdx;
              return (
                <button key={d.id} onClick={() => setDayIdx(i)}
                  className={`-mb-px flex shrink-0 flex-col items-start gap-0.5 rounded-t-[10px] border border-b-0 px-4 py-2.5 text-left transition ${
                    active ? "border-border bg-surface" : "border-transparent hover:bg-surface-2"}`}>
                  <span className={`text-sm font-bold ${active ? "text-text" : "text-text-muted"}`}>Day {d.dayNumber}</span>
                  <span className="text-[11px] text-text-faint">
                    {fmtDate(d.date)} · {d.rows.reduce((k, x) => k + x.shots.length, 0)} shots ·{" "}
                    <span style={{ color: ou.deltaMin > 0 ? "var(--h-red)" : undefined }}>wraps {fmtHM(ou.endMin)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {day && (
            <DayView
              day={day}
              canEdit={canEdit}
              drag={drag}
              setDrag={setDrag}
              onPatch={patchRow}
              onMove={(from, idx) => moveRow(from, day.id, idx)}
              onOpen={(r) => setEditing({ row: r, day })}
              onAdd={(k) => addRow(day, k)}
              onEditDay={() => setEditingDay(day)}
            />
          )}
        </>
      ) : (
        <BoardView days={days} canEdit={canEdit} drag={drag} setDrag={setDrag} onMove={moveRow} onOpen={(r, d) => setEditing({ row: r, day: d })} onAdd={addRow} />
      )}

      {editing && (
        <RowModal
          projectId={projectId}
          row={editing.row}
          day={editing.day}
          days={days}
          shotOptions={shotOptions}
          roster={roster}
          onClose={() => setEditing(null)}
          onSaved={(patch) => { patchRowLocal(editing.row.id, patch); setEditing(null); router.refresh(); }}
          onDeleted={() => { setDays((ds) => ds.map((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== editing.row.id) }))); setEditing(null); router.refresh(); }}
        />
      )}
      {editingDay && (
        <DayModal
          projectId={projectId}
          day={editingDay}
          onClose={() => setEditingDay(null)}
          onSaved={(patch) => { setDays((ds) => ds.map((d) => (d.id === editingDay.id ? { ...d, ...patch } : d))); setEditingDay(null); router.refresh(); }}
          onDelete={() => { setEditingDay(null); void removeDay(editingDay); }}
        />
      )}
    </div>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="inline-flex rounded-[10px] border border-border bg-surface p-0.5">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition ${value === k ? "bg-accent text-accent-fg shadow-sm" : "text-text-muted hover:text-text"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cells shared by the table and the phone cards, so they say the same thing.
// ---------------------------------------------------------------------------

function TalentCell({ people, compact }: { people: { name: string }[]; compact?: boolean }) {
  if (!people.length) return <span className="text-text-faint">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {people.map((p) => (
        <span key={p.name} className="inline-flex items-center gap-1.5">
          <span className={`grid shrink-0 place-items-center rounded-full font-bold ${compact ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]"}`}
            style={{ backgroundColor: hbg(nameHue(p.name)), color: h(nameHue(p.name)) }}>{initials(p.name)}</span>
          <span className={`font-semibold text-text ${compact ? "text-xs" : "text-[13px]"}`}>{p.name}</span>
        </span>
      ))}
    </div>
  );
}

function LocationCell({ r, compact }: { r: Row; compact?: boolean }) {
  if (!r.location && !r.set) return <span className="text-text-faint">—</span>;
  return (
    <div className="min-w-0">
      {r.set && (
        <div className={`flex flex-wrap items-center gap-1.5 font-semibold text-text ${compact ? "text-xs" : "text-[13px]"}`}>
          <span className="truncate">{r.set}</span>
          {r.intExt && r.dayNight && (
            <span className="rounded-pill border border-border px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-text-muted">{r.intExt} · {r.dayNight}</span>
          )}
        </div>
      )}
      {r.location && (
        <div className={`flex items-center gap-1 text-text-muted ${compact ? "text-[11px]" : "text-xs"} ${r.set ? "mt-0.5" : "font-semibold text-text"}`}>
          <PinGlyph small /> <span className="truncate">{r.location}</span>
        </div>
      )}
    </div>
  );
}

function WhatCell({ r, isWrap }: { r: Row; isWrap: boolean }) {
  const k = KIND[r.kind];
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center rounded-pill px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: hbg(k.hue), color: h(k.hue) }}>{k.label}</span>
        <span className={`text-[15px] font-bold ${isWrap ? "text-text-muted" : "text-text"}`}>{r.title || <span className="italic text-text-faint">Untitled</span>}</span>
        {r.anchoredAt && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-accent"><AnchorGlyph /> Fixed</span>}
      </div>
      {r.shots.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1">
          {r.shots.map((sh) => (
            <div key={sh.id} className="flex items-start gap-2 text-[13px] leading-snug">
              {sh.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sh.thumbUrl} alt="" className="mt-[1px] h-8 w-12 shrink-0 rounded-[4px] object-cover" loading="lazy" />
              ) : null}
              <span className="mt-[1px] shrink-0 rounded-[5px] bg-surface-2 px-1.5 py-[1px] text-[11px] font-bold tabular-nums text-text">{sh.code?.trim() || "—"}</span>
              <span className="text-text-muted">{sh.description}</span>
            </div>
          ))}
        </div>
      )}
      {r.notes && <div className="mt-1.5 text-xs italic text-text-muted">{r.notes}</div>}
    </div>
  );
}

function Grip() {
  return (
    <span className="grid h-8 w-6 shrink-0 cursor-grab place-items-center rounded-[6px] text-text-faint transition hover:bg-surface-2 hover:text-text active:cursor-grabbing"
      title="Drag to move this row. In Board view, drop it on another day." aria-label="Drag to reorder">
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="2.5" cy="2.5" r="1.6" /><circle cx="7.5" cy="2.5" r="1.6" /><circle cx="2.5" cy="8" r="1.6" /><circle cx="7.5" cy="8" r="1.6" /><circle cx="2.5" cy="13.5" r="1.6" /><circle cx="7.5" cy="13.5" r="1.6" />
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

function Controls({ r, canEdit, onPatch, className = "" }: { r: Timed<Row>; canEdit: boolean; onPatch: (id: string, input: RowInput, local: Partial<Row>) => void; className?: string }) {
  if (!canEdit) return <div className={`text-xs font-bold tabular-nums text-text-muted ${className}`}>{r.durationMin > 0 ? fmtDuration(r.durationMin) : ""}</div>;
  const step = (delta: number) => {
    const durationMin = Math.max(0, r.durationMin + delta);
    onPatch(r.id, { durationMin }, { durationMin });
  };
  return (
    <div className={`flex items-center gap-1.5 ${className}`} draggable onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      {(r.kind === "meal" || r.kind === "call") && (
        <button
          onClick={(e) => { e.stopPropagation(); const anchoredAt = r.anchoredAt ? null : fmtHM(r.startMin, { ampm: false }); onPatch(r.id, { anchoredAt }, { anchoredAt }); }}
          title={r.anchoredAt ? "Fixed: holds this time. Click to let it flow." : "Flows from the row above. Click to fix it at this time."}
          className={`grid h-7 w-7 place-items-center rounded-[7px] border text-xs transition ${r.anchoredAt ? "border-accent bg-accent-soft text-accent" : "border-border text-text-faint hover:text-text"}`}>
          <AnchorGlyph />
        </button>
      )}
      <div className="inline-flex items-center rounded-[8px] border border-border bg-surface" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => step(-15)} className="px-2 py-1 text-sm font-bold text-text-muted hover:text-text" aria-label="15 minutes shorter">−</button>
        <span className="min-w-[56px] text-center text-xs font-bold tabular-nums text-text">{fmtDuration(r.durationMin)}</span>
        <button onClick={() => step(15)} className="px-2 py-1 text-sm font-bold text-text-muted hover:text-text" aria-label="15 minutes longer">+</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DAY VIEW
// ---------------------------------------------------------------------------

// THE PREFIX LIVES IN THE STRING. Tailwind only generates a class it finds
// verbatim in the source; `lg:${COLS}` produced a token that existed nowhere.
const LG_COLS = "lg:grid-cols-[28px_4px_92px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_172px]";

function DayView({ day, canEdit, drag, setDrag, onPatch, onMove, onOpen, onAdd, onEditDay }: {
  day: Day;
  canEdit: boolean;
  drag: Drag | null;
  setDrag: (d: Drag | null) => void;
  onPatch: (id: string, input: RowInput, local: Partial<Row>) => void;
  onMove: (from: Drag, index: number) => void;
  onOpen: (r: Row) => void;
  onAdd: (k: StripKind) => void;
  onEditDay: () => void;
}) {
  const timed = useMemo(() => cascade(day.rows, callMin(day)), [day]);
  const ou = overUnder(timed, wrapMin(day), callMin(day));
  const [over, setOver] = useState<number | null>(null);
  const talent = Array.from(new Map(day.rows.flatMap((r) => r.talent).map((p) => [p.contactId, p])).values());
  // Body index (wrap excluded) for drop targets.
  const bodyIndex = (i: number) => timed.slice(0, i).filter((r) => r.kind !== "wrap").length;

  const zone = (i: number) => (
    <div
      onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(i); } }}
      onDragLeave={() => setOver((o) => (o === i ? null : o))}
      onDrop={(e) => { e.preventDefault(); if (drag) onMove(drag, bodyIndex(i)); setDrag(null); setOver(null); }}
      className={`transition-all ${drag ? "h-3" : "h-0"} ${over === i && drag ? "my-0.5 rounded-full bg-accent" : ""}`}
    />
  );

  return (
    <div className="rounded-[14px] border border-border bg-surface">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3 border-b border-border px-5 py-4">
        <button onClick={canEdit ? onEditDay : undefined} className={`flex flex-wrap items-start gap-x-8 gap-y-3 rounded-[10px] text-left ${canEdit ? "-m-1.5 p-1.5 transition hover:bg-surface-2" : ""}`} title={canEdit ? "Edit the day's call, wrap, date and location" : undefined}>
          <Fact label="Date" value={fmtDate(day.date)} />
          <Fact label="Call" value={day.callTime ? fmtHM(callMin(day)) : "Set call"} muted={!day.callTime} />
          <Fact label="Target wrap" value={day.wrapTarget ? fmtHM(wrapMin(day)) : "Set wrap"} muted={!day.wrapTarget} />
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Location</div>
            <div className={`mt-0.5 flex items-center gap-1.5 text-[15px] font-bold ${day.location ? "text-text" : "text-text-faint"}`}><PinGlyph /> {day.location || "Set location"}</div>
          </div>
        </button>
        {talent.length > 0 && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Talent today</div>
            <div className="mt-1"><TalentCell people={talent} compact /></div>
          </div>
        )}
        <div className="ml-auto text-right">
          <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Scheduled wrap</div>
          <div className="text-xl font-extrabold" style={{ color: ou.deltaMin > 0 ? "var(--h-red)" : "var(--h-green)" }}>
            {fmtHM(ou.endMin)}
            <span className="ml-2 text-xs font-bold">{ou.deltaMin === 0 ? "on target" : ou.deltaMin > 0 ? `${fmtDuration(ou.deltaMin)} over` : `${fmtDuration(-ou.deltaMin)} under`}</span>
          </div>
        </div>
      </div>

      <div className={`hidden ${LG_COLS} items-center gap-x-3 border-b border-border bg-surface-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-text-faint lg:grid`}>
        <span /><span /><span>Time</span><span>What</span><span>Location / set</span><span>Talent</span><span>Crew</span><span className="text-right">Duration</span>
      </div>

      <div className="px-3 py-1">
        {timed.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-text-muted">Nothing on this day yet. Add shots from the shot list, or a call, a meal, a setup.</p>
        )}
        {timed.map((r, i) => {
          const k = KIND[r.kind];
          const isWrap = r.kind === "wrap";
          const dragging = drag?.rowId === r.id;
          return (
            <div key={r.id}>
              {r.slackMin !== null && r.slackMin !== 0 && (
                <div className="my-1 flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-xs font-bold lg:ml-[124px]"
                  style={{ backgroundColor: r.slackMin < 0 ? "var(--h-red-bg)" : "var(--h-green-bg)", color: r.slackMin < 0 ? "var(--h-red)" : "var(--h-green)" }}>
                  {r.slackMin < 0 ? `Runs ${fmtDuration(-r.slackMin)} into ${r.title.toLowerCase() || "this row"}` : `${fmtDuration(r.slackMin)} buffer before ${r.title.toLowerCase() || "this row"}`}
                </div>
              )}
              {zone(i)}
              <div
                draggable={canEdit && !isWrap}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDrag({ dayId: day.id, rowId: r.id }); }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                onDragOver={(e) => { if (!drag || dragging) return; e.preventDefault(); const b = e.currentTarget.getBoundingClientRect(); setOver(e.clientY < b.top + b.height / 2 ? i : i + 1); }}
                onDrop={(e) => { if (!drag) return; e.preventDefault(); const b = e.currentTarget.getBoundingClientRect(); onMove(drag, bodyIndex(e.clientY < b.top + b.height / 2 ? i : i + 1)); setDrag(null); setOver(null); }}
                onClick={() => canEdit && onOpen(r)}
                className={`group rounded-[10px] border-b border-border py-3 transition last:border-0 ${dragging ? "opacity-40" : "hover:bg-surface-2"} ${canEdit ? "cursor-pointer" : ""} grid grid-cols-[28px_4px_1fr] gap-x-3 ${LG_COLS}`}
                title={canEdit ? "Open to edit" : undefined}
              >
                <div className="flex items-start justify-center pt-0.5" onClick={(e) => e.stopPropagation()}>{canEdit && !isWrap && <Grip />}</div>
                <div className="rounded-full" style={{ backgroundColor: h(k.hue) }} />

                <div className="min-w-0 lg:hidden">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-extrabold tabular-nums text-text">{fmtHM(r.startMin)}</span>
                    {!isWrap && r.durationMin > 0 && <span className="text-xs tabular-nums text-text-faint">to {fmtHM(r.endMin)} · {fmtDuration(r.durationMin)}</span>}
                  </div>
                  <WhatCell r={r} isWrap={isWrap} />
                  {!isWrap && (
                    <dl className="mt-2 grid grid-cols-[76px_1fr] gap-y-1.5 text-xs">
                      <dt className="font-bold uppercase tracking-wide text-text-faint">Location</dt><dd><LocationCell r={r} compact /></dd>
                      <dt className="font-bold uppercase tracking-wide text-text-faint">Talent</dt><dd><TalentCell people={r.talent} compact /></dd>
                      <dt className="font-bold uppercase tracking-wide text-text-faint">Crew</dt><dd className="text-text-muted">{r.crew.length ? r.crew.map((p) => p.name).join(", ") : <span className="text-text-faint">—</span>}</dd>
                    </dl>
                  )}
                  {!isWrap && <Controls r={r} canEdit={canEdit} onPatch={onPatch} className="mt-2" />}
                </div>

                <div className="hidden pt-0.5 lg:block">
                  <div className="text-[15px] font-extrabold tabular-nums leading-tight text-text">{fmtHM(r.startMin)}</div>
                  {!isWrap && r.durationMin > 0 && <div className="mt-0.5 text-xs tabular-nums text-text-faint">to {fmtHM(r.endMin)}</div>}
                </div>
                <div className="hidden min-w-0 lg:block"><WhatCell r={r} isWrap={isWrap} /></div>
                <div className="hidden min-w-0 pt-0.5 lg:block">{!isWrap && <LocationCell r={r} />}</div>
                <div className="hidden min-w-0 pt-0.5 lg:block">{!isWrap && <TalentCell people={r.talent} />}</div>
                <div className="hidden min-w-0 pt-0.5 text-[13px] leading-snug text-text-muted lg:block">{!isWrap && (r.crew.length ? r.crew.map((p) => p.name).join(", ") : <span className="text-text-faint">—</span>)}</div>
                <div className="hidden lg:block">{!isWrap && <Controls r={r} canEdit={canEdit} onPatch={onPatch} className="justify-end" />}</div>
              </div>
            </div>
          );
        })}
        {zone(timed.length)}
      </div>

      {canEdit && <AddRowBar onAdd={onAdd} />}
    </div>
  );
}

function Fact({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">{label}</div>
      <div className={`mt-0.5 text-xl font-extrabold tabular-nums ${muted ? "text-text-faint" : "text-text"}`}>{value}</div>
    </div>
  );
}

/** One button per kind, so adding a lunch is one click and adding shots is one click. */
function AddRowBar({ onAdd }: { onAdd: (k: StripKind) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2.5">
      <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">Add</span>
      {KIND_ORDER.map((k) => (
        <button key={k} onClick={() => onAdd(k)}
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-border px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: h(KIND[k].hue) }} />
          {k === "shot" ? "Shots" : KIND[k].label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BOARD VIEW
// ---------------------------------------------------------------------------

function BoardView({ days, canEdit, drag, setDrag, onMove, onOpen, onAdd }: {
  days: Day[];
  canEdit: boolean;
  drag: Drag | null;
  setDrag: (d: Drag | null) => void;
  onMove: (from: Drag, toDayId: string, index: number) => void;
  onOpen: (r: Row, d: Day) => void;
  onAdd: (d: Day, k: StripKind) => void;
}) {
  const [over, setOver] = useState<{ dayId: string; idx: number } | null>(null);
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[820px] gap-3" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(260px, 1fr))` }}>
        {days.map((d) => {
          const timed = cascade(d.rows, callMin(d));
          const ou = overUnder(timed, wrapMin(d), callMin(d));
          const shots = d.rows.reduce((k, x) => k + x.shots.length, 0);
          const bodyIndex = (i: number) => timed.slice(0, i).filter((r) => r.kind !== "wrap").length;
          const zone = (i: number, grow?: boolean) => (
            <div
              onDragOver={(e) => { if (drag) { e.preventDefault(); setOver({ dayId: d.id, idx: i }); } }}
              onDrop={(e) => { e.preventDefault(); if (drag) onMove(drag, d.id, bodyIndex(i)); setDrag(null); setOver(null); }}
              className={`transition-all ${grow ? "min-h-[16px] flex-1" : drag ? "h-3" : "h-0"} ${over?.dayId === d.id && over.idx === i && drag ? "my-0.5 rounded-full bg-accent" : ""}`}
            />
          );
          return (
            <div key={d.id} className="flex flex-col rounded-[14px] border border-border bg-surface">
              <div className="border-b border-border px-3.5 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-extrabold text-text">Day {d.dayNumber}</span>
                  <span className="text-xs text-text-faint">{fmtDate(d.date)}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-text-muted">
                  Call {fmtHM(callMin(d))} · {shots} shots · <span style={{ color: ou.deltaMin > 0 ? "var(--h-red)" : "var(--h-green)" }} className="font-semibold">wraps {fmtHM(ou.endMin)}</span>
                </div>
                {d.location && <div className="mt-1 flex items-center gap-1 truncate text-[11px] font-semibold text-text"><PinGlyph small /> {d.location}</div>}
              </div>
              <div className="flex flex-1 flex-col px-2 py-2">
                {timed.map((r, i) => {
                  const k = KIND[r.kind];
                  const bh = r.kind === "shot" ? boardHue(r) : null;
                  const edge = bh ? h(bh) : h(k.hue);
                  const isWrap = r.kind === "wrap";
                  const dragging = drag?.rowId === r.id;
                  return (
                    <div key={r.id}>
                      {zone(i)}
                      <div
                        draggable={canEdit && !isWrap}
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDrag({ dayId: d.id, rowId: r.id }); }}
                        onDragEnd={() => { setDrag(null); setOver(null); }}
                        onDragOver={(e) => { if (!drag || dragging) return; e.preventDefault(); const b = e.currentTarget.getBoundingClientRect(); setOver({ dayId: d.id, idx: e.clientY < b.top + b.height / 2 ? i : i + 1 }); }}
                        onDrop={(e) => { if (!drag) return; e.preventDefault(); const b = e.currentTarget.getBoundingClientRect(); onMove(drag, d.id, bodyIndex(e.clientY < b.top + b.height / 2 ? i : i + 1)); setDrag(null); setOver(null); }}
                        onClick={() => canEdit && onOpen(r, d)}
                        className={`grid grid-cols-[20px_4px_1fr] gap-x-2 rounded-[9px] py-2 pr-2 transition ${dragging ? "opacity-40" : "hover:bg-surface-2"} ${canEdit && !isWrap ? "cursor-pointer" : ""}`}
                      >
                        <div className="flex items-start justify-center" onClick={(e) => e.stopPropagation()}>{canEdit && !isWrap && <Grip />}</div>
                        <div className="rounded-full" style={{ backgroundColor: edge }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-text-faint">
                            <span className="font-bold text-text-muted">{fmtHM(r.startMin)}</span>
                            {!isWrap && r.durationMin > 0 && <span>· {fmtDuration(r.durationMin)}</span>}
                            {r.intExt && r.dayNight && <span className="ml-auto rounded-pill border border-border px-1.5 text-[9px] font-bold uppercase tracking-wide text-text-muted">{r.intExt}·{r.dayNight}</span>}
                          </div>
                          <div className={`text-[13px] font-semibold ${isWrap ? "text-text-muted" : "text-text"}`}>
                            {r.shots.length ? <span className="mr-1.5 inline-flex gap-1">{r.shots.map((sh) => <span key={sh.id} className="rounded-[5px] bg-surface-2 px-1.5 text-[11px] font-bold tabular-nums">{sh.code?.trim() || "—"}</span>)}</span> : null}
                            {r.title || <span className="italic text-text-faint">Untitled</span>}
                          </div>
                          {r.set && <div className="truncate text-[11px] text-text-muted">{r.set}</div>}
                          {r.talent.length ? <div className="mt-1"><TalentCell people={r.talent} compact /></div> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {zone(timed.length, true)}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-1 border-t border-border px-2 py-2">
                  {(["shot", "setup", "meal", "move"] as StripKind[]).map((k) => (
                    <button key={k} onClick={() => onAdd(d, k)} className="rounded-[7px] border border-border px-2 py-0.5 text-[11px] font-semibold text-text-muted transition hover:bg-surface-2 hover:text-text">+ {k === "shot" ? "Shots" : KIND[k].label}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROW MODAL: every field, the shots picker, the people picker, delete.
// ---------------------------------------------------------------------------

const inputCls = "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-text-faint";

function RowModal({ projectId, row, day, days, shotOptions, roster, onClose, onSaved, onDeleted }: {
  projectId: string;
  row: Row;
  day: Day;
  days: Day[];
  shotOptions: ShotOption[];
  roster: RosterOption[];
  onClose: () => void;
  onSaved: (patch: Partial<Row>) => void;
  onDeleted: () => void;
}) {
  const [kind, setKind] = useState<StripKind>(row.kind);
  const [title, setTitle] = useState(row.title);
  const [location, setLocation] = useState(row.location ?? "");
  const [set, setSet] = useState(row.set ?? "");
  const [intExt, setIntExt] = useState<IntExt | null>(row.intExt);
  const [dayNight, setDayNight] = useState<DayNight | null>(row.dayNight);
  const [duration, setDuration] = useState(String(row.durationMin));
  const [anchoredAt, setAnchoredAt] = useState(row.anchoredAt ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [shotIds, setShotIds] = useState<string[]>(row.shots.map((s) => s.id));
  const [people, setPeople] = useState<{ contactId: string; role: "talent" | "crew" }[]>([
    ...row.talent.map((p) => ({ contactId: p.contactId, role: "talent" as const })),
    ...row.crew.map((p) => ({ contactId: p.contactId, role: "crew" as const })),
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  const rowIdOfShot = new Map(days.flatMap((d) => d.rows.flatMap((r) => r.shots.map((s) => [s.id, { rowId: r.id, dayNumber: d.dayNumber }] as const))));
  const shotLists = Array.from(new Set(shotOptions.map((s) => s.list)));
  const talentOptions = roster.filter((c) => isTalentCategory(c.category));
  const crewOptions = roster.filter((c) => !isTalentCategory(c.category) && c.category !== "client");
  const isTalent = (id: string) => people.some((p) => p.contactId === id && p.role === "talent");
  const isCrew = (id: string) => people.some((p) => p.contactId === id && p.role === "crew");
  function togglePerson(contactId: string, role: "talent" | "crew") {
    setPeople((ps) => (ps.some((p) => p.contactId === contactId) ? ps.filter((p) => p.contactId !== contactId) : [...ps, { contactId, role }]));
  }

  async function save() {
    setError(null);
    const durationMin = Math.round(Number(duration));
    if (!Number.isFinite(durationMin) || durationMin < 0) return setError("Duration must be a number of minutes.");
    if (anchoredAt.trim() && parseHM(anchoredAt) === null) return setError(`"${anchoredAt}" is not a time. Try 1:00 pm or 13:00.`);
    setSaving(true);
    const input: RowInput = {
      kind, title, location: location || null, set: set || null, intExt, dayNight, durationMin,
      anchoredAt: anchoredAt.trim() || null, notes: notes || null,
    };
    const r1 = await updateScheduleRow(projectId, row.id, input);
    if (r1?.error) { setSaving(false); return setError(r1.error); }
    const shotsChanged = shotIds.join() !== row.shots.map((s) => s.id).join();
    if (shotsChanged) {
      const r2 = await setRowShots(projectId, row.id, shotIds);
      if (r2?.error) { setSaving(false); return setError(r2.error); }
    }
    const peopleBefore = [...row.talent.map((p) => `${p.contactId}:talent`), ...row.crew.map((p) => `${p.contactId}:crew`)].sort().join();
    const peopleAfter = people.map((p) => `${p.contactId}:${p.role}`).sort().join();
    if (peopleBefore !== peopleAfter) {
      const r3 = await setRowPeople(projectId, row.id, people);
      if (r3?.error) { setSaving(false); return setError(r3.error); }
    }
    setSaving(false);
    // Local echo for the optimistic state; the refresh brings thumbnails.
    const shots = shotIds.map((id) => { const o = shotOptions.find((s) => s.id === id); return { id, code: o?.code ?? null, description: o?.description ?? null, thumbUrl: o?.thumbUrl ?? null }; });
    const person = (id: string, role: "talent" | "crew") => { const c = roster.find((x) => x.contactId === id); return { contactId: id, name: c?.name ?? "", position: c?.position ?? null, role }; };
    onSaved({
      kind, title, location: location || null, set: set || null, intExt, dayNight, durationMin,
      anchoredAt: anchoredAt.trim() || null, notes: notes || null, shots,
      talent: people.filter((p) => p.role === "talent").map((p) => person(p.contactId, "talent")),
      crew: people.filter((p) => p.role === "crew").map((p) => person(p.contactId, "crew")),
    });
  }

  async function remove() {
    const ok = await confirmAction({
      title: `Delete "${row.title || KIND[row.kind].label}"?`,
      body: row.shots.length ? `${row.shots.length} ${row.shots.length === 1 ? "shot goes" : "shots go"} back to unscheduled. The rows below move up. There is no undo.` : "The rows below move up. There is no undo.",
      confirmLabel: "Delete row",
    });
    if (!ok) return;
    setSaving(true);
    const res = await deleteScheduleRow(projectId, row.id);
    setSaving(false);
    if (res?.error) return setError(res.error);
    onDeleted();
  }

  return (
    <Modal open onClose={onClose} title={row.title ? `Edit: ${row.title}` : `New ${KIND[row.kind].label.toLowerCase()} row`} size="lg">
      <div className="flex flex-col gap-4">
        {/* Kind */}
        <div>
          <span className={labelCls}>Kind</span>
          <div className="flex flex-wrap gap-1.5">
            {KIND_ORDER.map((k) => (
              <button key={k} onClick={() => setKind(k)}
                className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold transition ${kind === k ? "border-transparent" : "border-border text-text-muted hover:text-text"}`}
                style={kind === k ? { backgroundColor: hbg(KIND[k].hue), color: h(KIND[k].hue) } : undefined}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: h(KIND[k].hue) }} />{KIND[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_140px]">
          <div>
            <label className={labelCls}>What</label>
            <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "shot" ? "Bottle reveal" : KIND[kind].defaultTitle || "Title"} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Duration (min)</label>
            <input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="numeric" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} title="A fixed start the day flows around. Leave empty to follow the row above.">Fixed start</label>
            <input value={anchoredAt} onChange={(e) => setAnchoredAt(e.target.value)} placeholder="flows" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={day.location ?? "Stage 2, Culver City"} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Set</label>
            <input value={set} onChange={(e) => setSet(e.target.value)} placeholder="Set A · Cloud wall" className={inputCls} />
          </div>
        </div>

        {kind === "shot" && (
          <div className="flex flex-wrap items-center gap-4">
            <Pair label="Int / ext" value={intExt} options={["INT", "EXT"]} onChange={(v) => setIntExt(v as IntExt | null)} />
            <Pair label="Day / night" value={dayNight} options={["DAY", "NIGHT"]} onChange={(v) => setDayNight(v as DayNight | null)} />
            <span className="text-[11px] text-text-faint">Leave blank on a studio shoot.</span>
          </div>
        )}

        {/* Shots */}
        {(kind === "shot" || shotIds.length > 0) && (
          <div>
            <span className={labelCls}>Shots on this row</span>
            {shotOptions.length === 0 ? (
              <p className="text-sm text-text-muted">No shots on the shot list yet.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-[10px] border border-border">
                {shotLists.map((list) => (
                  <div key={list}>
                    {shotLists.length > 1 && <div className="bg-surface-2 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-text-faint">{list}</div>}
                    {shotOptions.filter((s) => s.list === list).map((s) => {
                      const on = shotIds.includes(s.id);
                      const elsewhere = rowIdOfShot.get(s.id);
                      const otherRow = elsewhere && elsewhere.rowId !== row.id ? elsewhere : null;
                      return (
                        <label key={s.id} className="flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-1.5 last:border-0 hover:bg-surface-2">
                          <input type="checkbox" checked={on} onChange={() => setShotIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))} className="h-4 w-4 accent-[var(--accent)]" />
                          {s.thumbUrl ? <img src={s.thumbUrl} alt="" className="h-7 w-10 shrink-0 rounded-[4px] object-cover" /> : <span className="h-7 w-10 shrink-0 rounded-[4px] bg-surface-2" />}
                          <span className="shrink-0 rounded-[5px] bg-surface-2 px-1.5 text-[11px] font-bold tabular-nums text-text">{s.code?.trim() || "—"}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{s.description}</span>
                          {otherRow && (
                            <span className="shrink-0 rounded-pill bg-amber-bg px-2 py-[1px] text-[10px] font-bold text-amber">
                              {otherRow.dayNumber === day.dayNumber ? "on another row" : `on Day ${otherRow.dayNumber}`}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11px] text-text-faint">A shot lives on one row. Ticking one that is on another day moves it here.</p>
          </div>
        )}

        {/* People */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PeoplePicker label="Talent" options={talentOptions} isOn={isTalent} onToggle={(id) => togglePerson(id, "talent")} empty="No talent on the roster. Add them on Project contacts." />
          <PeoplePicker label="Crew" options={crewOptions} isOn={isCrew} onToggle={(id) => togglePerson(id, "crew")} empty="No crew on the roster yet." />
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Fresh cupcakes from 11:30, do not plate early" className={inputCls} />
        </div>

        {error && <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">{error}</p>}

        <div className="flex items-center gap-2 border-t border-border pt-4">
          <button onClick={remove} disabled={saving} className="text-sm font-semibold text-red transition hover:underline disabled:opacity-50">Delete row</button>
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function Pair({ label, value, options, onChange }: { label: string; value: string | null; options: [string, string]; onChange: (v: string | null) => void }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="inline-flex rounded-[9px] border border-border p-0.5">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(value === o ? null : o)}
            className={`rounded-[7px] px-2.5 py-1 text-xs font-bold transition ${value === o ? "bg-accent text-accent-fg" : "text-text-muted hover:text-text"}`}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function PeoplePicker({ label, options, isOn, onToggle, empty }: { label: string; options: RosterOption[]; isOn: (id: string) => boolean; onToggle: (id: string) => void; empty: string }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {options.length === 0 ? (
        <p className="text-xs text-text-muted">{empty}</p>
      ) : (
        <div className="max-h-40 overflow-y-auto rounded-[10px] border border-border">
          {options.map((c) => (
            <label key={c.contactId} className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 last:border-0 hover:bg-surface-2">
              <input type="checkbox" checked={isOn(c.contactId)} onChange={() => onToggle(c.contactId)} className="h-4 w-4 accent-[var(--accent)]" />
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold" style={{ backgroundColor: hbg(nameHue(c.name)), color: h(nameHue(c.name)) }}>{initials(c.name)}</span>
              <span className="text-sm font-semibold text-text">{c.name}</span>
              {c.position && <span className="truncate text-xs text-text-faint">{c.position}</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DAY MODAL: date, call, wrap, location, notes, delete.
// ---------------------------------------------------------------------------

function DayModal({ projectId, day, onClose, onSaved, onDelete }: {
  projectId: string;
  day: Day;
  onClose: () => void;
  onSaved: (patch: Partial<Day>) => void;
  onDelete: () => void;
}) {
  const [date, setDate] = useState(day.date ?? "");
  const [callTime, setCallTime] = useState(day.callTime ?? "");
  const [wrapTarget, setWrapTarget] = useState(day.wrapTarget ?? "");
  const [location, setLocation] = useState(day.location ?? "");
  const [notes, setNotes] = useState(day.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (callTime.trim() && parseHM(callTime) === null) return setError(`"${callTime}" is not a time.`);
    if (wrapTarget.trim() && parseHM(wrapTarget) === null) return setError(`"${wrapTarget}" is not a time.`);
    setSaving(true);
    const res = await updateScheduleDay(projectId, day.id, { date: date || null, callTime: callTime || null, wrapTarget: wrapTarget || null, location: location || null, notes: notes || null });
    setSaving(false);
    if (res?.error) return setError(res.error);
    onSaved({ date: date || null, callTime: callTime || null, wrapTarget: wrapTarget || null, location: location || null, notes: notes || null });
  }

  return (
    <Modal open onClose={onClose} title={`Day ${day.dayNumber}`} size="md">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div><label className={labelCls}>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Call</label><input value={callTime} onChange={(e) => setCallTime(e.target.value)} placeholder="7:00" className={inputCls} /></div>
          <div><label className={labelCls}>Target wrap</label><input value={wrapTarget} onChange={(e) => setWrapTarget(e.target.value)} placeholder="6:00 pm" className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Location</label><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Stage 2, Culver City" className={inputCls} /></div>
        <div><label className={labelCls}>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} /></div>
        {error && <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">{error}</p>}
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <button onClick={onDelete} disabled={saving} className="text-sm font-semibold text-red transition hover:underline disabled:opacity-50">Delete day</button>
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}
