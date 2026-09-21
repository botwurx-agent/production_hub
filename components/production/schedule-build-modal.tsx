"use client";

/**
 * "Build from the shot list": the schedule's first draft, in one press.
 *
 * The operator built a real three-day schedule by hand, 56 rows, and said it
 * worked but was "very tedious and time consuming". Roughly half those rows
 * were setup rows in a strict setup / shot alternation and the rest was the day
 * scaffold, so none of it was a judgement call worth typing.
 *
 * THE DIALOG RUNS THE REAL PLANNER. lib/schedule-build.ts is pure, so the
 * preview below is not an estimate: it is the same plan the action writes, laid
 * out through the same cascade, which is why it can state each day's row count
 * and the time it wraps before anything exists. That is the question an AD
 * actually has ("will this fit the day"), and answering it here is what makes
 * the defaults safe to accept.
 */

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  BUILD_DEFAULTS,
  planSchedule,
  planTotals,
  type BuildList,
  type BuildOptions,
  type ExistingDay,
} from "@/lib/schedule-build";
import { cascade, fmtHM, overUnder, parseHM, type StripKind } from "@/lib/schedule-time";
import type { ShotOption } from "@/lib/schedule-data";
import { buildScheduleFromShotList } from "@/app/(app)/projects/[id]/schedule-actions";

/** "Mon, Oct 5". Parsed as LOCAL midnight, matching the editor, so no timezone shifts a day. */
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const inputCls =
  "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-accent";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-text-faint";

type ListRow = { id: string; title: string; total: number; open: number };

/** The project's shot lists, in list order, with how many shots are still unscheduled. */
function listsFrom(shotOptions: ShotOption[]): ListRow[] {
  const out: ListRow[] = [];
  const byId = new Map<string, ListRow>();
  for (const s of shotOptions) {
    let row = byId.get(s.groupId);
    if (!row) {
      row = { id: s.groupId, title: s.list || "Shot list", total: 0, open: 0 };
      byId.set(s.groupId, row);
      out.push(row);
    }
    row.total += 1;
    if (!s.rowId) row.open += 1;
  }
  return out;
}

function Num({
  label,
  value,
  onChange,
  suffix = "min",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          value={String(value)}
          inputMode="numeric"
          onChange={(e) => {
            const n = Math.round(Number(e.target.value.replace(/[^\d]/g, "")));
            onChange(Number.isFinite(n) ? Math.min(n, 24 * 60) : 0);
          }}
          className={inputCls}
        />
        <span className="shrink-0 text-xs font-semibold text-text-faint">{suffix}</span>
      </div>
    </div>
  );
}

function Check({
  on,
  onToggle,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={on}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 text-sm text-text">{children}</span>
    </label>
  );
}

export function ScheduleBuildModal({
  projectId,
  shotOptions,
  existing,
  seed,
  onClose,
  onBuilt,
}: {
  projectId: string;
  shotOptions: ShotOption[];
  /** The days the schedule already has, so a plan can join one instead of doubling it. */
  existing: ExistingDay[];
  seed?: { callTime?: string | null; wrapTarget?: string | null; location?: string | null };
  onClose: () => void;
  onBuilt: () => void;
}) {
  const lists = useMemo(() => listsFrom(shotOptions), [shotOptions]);
  const buildable = useMemo(() => lists.filter((l) => l.open > 0), [lists]);

  const [picked, setPicked] = useState<string[]>(buildable.map((l) => l.id));
  const [startDate, setStartDate] = useState("");
  const [callTime, setCallTime] = useState(seed?.callTime ?? BUILD_DEFAULTS.callTime ?? "7:00");
  const [wrapTarget, setWrapTarget] = useState(seed?.wrapTarget ?? BUILD_DEFAULTS.wrapTarget ?? "6:00 pm");
  const [location, setLocation] = useState(seed?.location ?? "");
  const [openMin, setOpenMin] = useState(BUILD_DEFAULTS.openMin);
  const [setupMin, setSetupMin] = useState(BUILD_DEFAULTS.setupMin);
  const [shotMin, setShotMin] = useState(BUILD_DEFAULTS.shotMin);
  const [lunchOn, setLunchOn] = useState(true);
  const [lunchAt, setLunchAt] = useState(BUILD_DEFAULTS.lunchAt ?? "1:00 pm");
  const [lunchMin, setLunchMin] = useState(BUILD_DEFAULTS.lunchMin);
  const [wrapRow, setWrapRow] = useState(true);
  const [prelight, setPrelight] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: BuildOptions = useMemo(
    () => ({
      openMin,
      setupMin,
      shotMin,
      lunchAt: lunchOn ? lunchAt : null,
      lunchMin,
      wrap: wrapRow,
      callTime,
      wrapTarget,
    }),
    [openMin, setupMin, shotMin, lunchOn, lunchAt, lunchMin, wrapRow, callTime, wrapTarget]
  );

  // The preview is the plan. Built from the same lists, in the same order, with
  // the same options the action re-derives server side.
  const plan = useMemo(() => {
    const chosen: BuildList[] = buildable
      .filter((l) => picked.includes(l.id))
      .map((l) => ({
        id: l.id,
        title: l.title,
        shots: shotOptions
          .filter((s) => s.groupId === l.id && !s.rowId)
          .map((s) => ({ id: s.id, code: s.code, description: s.description, day: s.day })),
      }));
    return planSchedule(chosen, options, {
      prelight: prelight && !existing.length,
      startDate: startDate || null,
      existing,
    });
  }, [buildable, picked, shotOptions, options, prelight, existing, startDate]);

  const totals = planTotals(plan);
  const callM = parseHM(callTime) ?? 7 * 60;
  const wrapM = parseHM(wrapTarget) ?? 18 * 60;

  /** Where a planned day lands against the wrap it was meant to hit. */
  function landing(rows: { kind: string; durationMin: number; anchoredAt: string | null }[]) {
    const timed = cascade(
      rows.map((r, k) => ({ id: String(k), kind: r.kind as StripKind, durationMin: r.durationMin, anchoredAt: r.anchoredAt })),
      callM
    );
    return overUnder(timed, wrapM, callM);
  }
  const over = plan.days.filter((d) => landing(d.rows).deltaMin > 0).length;
  // A prelight added from here is only offered when the schedule is empty AND
  // the shot list does not already name a non-shoot day, since that is the
  // better source and two prelights would be one too many.
  const offerPrelight = existing.length === 0 && !plan.days.some((d) => d.kind !== "shoot" && !d.source);

  async function build() {
    setError(null);
    if (callTime.trim() && parseHM(callTime) === null) return setError(`"${callTime}" is not a time. Try 7:00 or 6:30 am.`);
    if (wrapTarget.trim() && parseHM(wrapTarget) === null) return setError(`"${wrapTarget}" is not a time.`);
    if (lunchOn && parseHM(lunchAt) === null) return setError(`"${lunchAt}" is not a time. Try 1:00 pm.`);
    if (!picked.length) return setError("Pick at least one shot list.");
    setBusy(true);
    const res = await buildScheduleFromShotList(projectId, {
      listIds: picked,
      options,
      startDate: startDate || null,
      location: location || null,
      prelight: prelight && offerPrelight,
    });
    setBusy(false);
    if ("error" in res) return setError(res.error);
    toast(`${res.rows} rows across ${res.days} ${res.days === 1 ? "day" : "days"}, ${res.shots} shots scheduled`);
    onBuilt();
  }

  return (
    <Modal open onClose={onClose} title="Build from the shot list" size="lg">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-text-muted">
          The days come from the shot list&apos;s own day column: a shot marked 1 goes on Day 1, one marked Prelight
          goes on a prelight day, and a list with no days set becomes a single day. Each day gets a setup before every
          shot, lunch where it reaches it, and a wrap at the end. Nothing here is a guess about your job, so treat the
          minutes as a starting point and drag rows afterwards. It only ever{" "}
          <span className="font-semibold text-text">adds</span>: a shot already on the schedule stays where it is, and
          a day that already exists is joined rather than repeated.
        </p>

        {/* Lists */}
        <div>
          <span className={labelCls}>Shot lists</span>
          {lists.length === 0 ? (
            <p className="text-sm text-text-muted">
              There is no shot list on this project yet. Build one first and the schedule can follow it.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-[10px] border border-border">
              {lists.map((l) => {
                const done = l.open === 0;
                const on = picked.includes(l.id);

                return (
                  <label
                    key={l.id}
                    className={`flex items-center gap-2.5 px-3 py-2 ${done ? "opacity-60" : "cursor-pointer hover:bg-surface-2"}`}
                  >
                    <input
                      type="checkbox"
                      checked={on && !done}
                      disabled={done}
                      onChange={() => setPicked((p) => (on ? p.filter((x) => x !== l.id) : [...p, l.id]))}
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{l.title}</span>
                    <span className="shrink-0 text-xs text-text-muted">
                      {done ? `all ${l.total} already scheduled` : `${l.open} of ${l.total} to schedule`}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* The day */}
        <div>
          <span className={labelCls}>The days</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>First day&apos;s date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Call</label>
              <input value={callTime} onChange={(e) => setCallTime(e.target.value)} placeholder="7:00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Target wrap</label>
              <input value={wrapTarget} onChange={(e) => setWrapTarget(e.target.value)} placeholder="6:00 pm" className={inputCls} />
            </div>
          </div>
          <div className="mt-3">
            <label className={labelCls}>Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Stage 2, Culver City"
              className={inputCls}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-text-faint">
            Dates run consecutively from the first. Call, wrap and location go on every day created and can be changed
            per day afterwards.
          </p>
        </div>

        {/* Durations */}
        <div>
          <span className={labelCls}>How long things take</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Num label="First setup of the day" value={openMin} onChange={setOpenMin} />
            <Num label="Setup between shots" value={setupMin} onChange={setSetupMin} />
            <Num label="Each shot" value={shotMin} onChange={setShotMin} />
          </div>
          <p className="mt-1.5 text-[11px] text-text-faint">
            The shot list does not carry a duration, so every shot gets the same one rather than a guess from its size
            or its camera move. Change the ones that are wrong once they are on the page.
          </p>
        </div>

        {/* Lunch, wrap, prelight */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="pb-2">
              <Check on={lunchOn} onToggle={() => setLunchOn((v) => !v)}>
                Break for lunch
              </Check>
            </div>
            {lunchOn && (
              <>
                <div className="w-28">
                  <label className={labelCls}>Fixed at</label>
                  <input value={lunchAt} onChange={(e) => setLunchAt(e.target.value)} className={inputCls} />
                </div>
                <div className="w-28">
                  <Num label="For" value={lunchMin} onChange={setLunchMin} />
                </div>
              </>
            )}
          </div>
          <Check on={wrapRow} onToggle={() => setWrapRow((v) => !v)}>
            End each day with a wrap row
          </Check>
          {offerPrelight && (
            <Check on={prelight} onToggle={() => setPrelight((v) => !v)}>
              Add a prelight day before Day 1{" "}
              <span className="text-text-faint">(no shots on it, and it does not take a shoot day&apos;s number)</span>
            </Check>
          )}
        </div>

        {/* Preview */}
        <div className="rounded-[12px] border border-border bg-surface-2 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">What this writes</p>
          {plan.days.length === 0 ? (
            <p className="text-sm text-text-muted">
              {plan.skipped > 0
                ? `Nothing to add. ${plan.skipped} ${plan.skipped === 1 ? "shot has" : "shots have"} no day set on the shot list, and everything else is already scheduled.`
                : "Nothing yet. Tick a shot list that still has unscheduled shots."}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                {plan.days.map((d, i) => {
                  const ou = landing(d.rows);
                  const shots = d.rows.reduce((n, r) => n + r.shotIds.length, 0);
                  return (
                    <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                      <span className="font-bold text-text">{d.name}</span>
                      {d.existingDayId && (
                        <span className="rounded-pill bg-surface px-1.5 py-[1px] text-[10px] font-bold text-text-muted">
                          joins this day
                        </span>
                      )}
                      <span className="text-text-muted">
                        {shots ? `${shots} ${shots === 1 ? "shot" : "shots"} · ` : ""}
                        {d.existingDayId ? "adds " : ""}
                        {d.rows.length} {d.rows.length === 1 ? "row" : "rows"}
                        {d.date ? ` · ${fmtDate(d.date)}` : ""}
                      </span>
                      {!d.existingDayId && (
                        <span
                          className="font-semibold"
                          style={{ color: ou.deltaMin > 0 ? "var(--h-red)" : "var(--h-green)" }}
                        >
                          wraps {fmtHM(ou.endMin)}
                          {ou.deltaMin > 0 ? ` (${Math.round((ou.deltaMin / 60) * 10) / 10}h over)` : ""}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 border-t border-border pt-2 text-xs text-text-muted">
                {totals.newDays > 0
                  ? `${totals.newDays} new ${totals.newDays === 1 ? "day" : "days"}, `
                  : ""}
                {totals.rows} rows, {totals.shots} shots. Times are derived from the durations, so the wrap above is
                what the day is actually asking for.
              </p>
              {plan.skipped > 0 && (
                <p className="mt-1.5 text-xs font-medium text-amber">
                  {plan.skipped} {plan.skipped === 1 ? "shot is" : "shots are"} left off: the list uses the day column
                  and {plan.skipped === 1 ? "it has" : "they have"} no day set. Set one and build again, or add{" "}
                  {plan.skipped === 1 ? "it" : "them"} to a row by hand.
                </p>
              )}
              {over > 0 && (
                <p className="mt-1.5 text-xs font-medium text-amber">
                  {over === 1 ? "One day runs" : `${over} days run`} past the target wrap. That is the list asking for
                  more than a day: build it anyway and move rows, split the shot list, or give each shot fewer minutes.
                </p>
              )}
            </>
          )}
        </div>

        {error && <p className="rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">{error}</p>}

        <div className="flex items-center gap-2 border-t border-border pt-4">
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={build} disabled={busy || plan.days.length === 0}>
            {busy
              ? "Building..."
              : plan.days.length
                ? `Build ${totals.rows} ${totals.rows === 1 ? "row" : "rows"}`
                : "Build"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
