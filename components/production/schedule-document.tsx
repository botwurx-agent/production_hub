/**
 * The schedule as a DOCUMENT: read-only, printable, and the thing a unit reads.
 *
 * ONE RENDERER, like CallSheetDocument and for the same reason: the PDF a crew
 * gets and any surface a client is shown have to be the same page, or the
 * studio is answering questions about a document it cannot see. The editor is
 * where a schedule is built; this is what leaves the building.
 *
 * TIMES ARE DERIVED HERE TOO, through the same cascade() the editor runs, so a
 * printed clock cannot disagree with the screen. Nothing about a time is
 * stored, so there is nothing to keep in step.
 *
 * Presentational and hook-free on purpose: it renders inside a server print
 * route and inside the client review canvas without a second implementation.
 */

import { cascade, fmtDuration, fmtHM, overUnder, parseHM } from "@/lib/schedule-time";
import type { ScheduleDayView, ScheduleRowView } from "@/lib/schedule-data";

/** Force the dark day header to actually print rather than save the ink. */
const printExact = {
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as React.CSSProperties;

const KIND_HUE: Record<string, string> = {
  call: "indigo",
  meal: "amber",
  setup: "blue",
  shot: "green",
  move: "orange",
  note: "purple",
  wrap: "indigo",
};

// The same defaults the editor uses, so the printed clock and the screen
// cannot start the day at different times.
const callMin = (d: ScheduleDayView) => parseHM(d.callTime) ?? 7 * 60;
const wrapMin = (d: ScheduleDayView) => parseHM(d.wrapTarget) ?? 18 * 60;

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  // Parsed as UTC midnight so no timezone can shift the day, the same rule
  // lib/slate.ts follows.
  const [y, m, dd] = iso.split("-").map(Number);
  if (!y || !m || !dd) return "";
  return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function names(people: ScheduleRowView["talent"]): string {
  return people.map((p) => p.name).join(", ");
}

/**
 * The dark panel that opens a day, in the same vocabulary as the shot list's
 * DayDivider (gradient hairline, mono eyebrow, display headline) so the two
 * documents read as one studio's paperwork.
 *
 * What it states is what a schedule day actually has and a shot list does not:
 * the call, the target wrap, where you are driving to, and who is on it.
 */
function DayHead({ day, label }: { day: ScheduleDayView; label: string }) {
  const timed = cascade(day.rows, callMin(day));
  const ou = overUnder(timed, wrapMin(day), callMin(day));
  const talent = Array.from(
    new Map(day.rows.flatMap((r) => r.talent).map((p) => [p.contactId, p])).values()
  );

  return (
    <div
      data-theme="dark"
      style={printExact}
      className="overflow-hidden rounded-[16px] bg-bg text-text print:rounded-none"
    >
      <div
        style={{
          ...printExact,
          background:
            "linear-gradient(90deg, var(--h-yellow), var(--h-orange), var(--h-red), var(--h-pink), var(--h-purple), var(--h-indigo), var(--h-cyan), var(--h-green))",
        }}
        className="h-[5px] w-full"
      />
      <div className="px-8 py-10 print:px-6 print:py-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-orange">
          {fmtDate(day.date) || "Date TBD"}
        </div>
        <h2 className="mt-3 font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-text print:mt-2 print:text-3xl">
          {label}
        </h2>
        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-3 print:mt-3 print:gap-x-6">
          <Fact label="Crew call" value={fmtHM(callMin(day))} />
          <Fact label="Target wrap" value={day.wrapTarget ? fmtHM(wrapMin(day)) : "TBD"} />
          <Fact
            label="Scheduled wrap"
            value={`${fmtHM(ou.endMin)}${
              ou.deltaMin === 0
                ? ""
                : ou.deltaMin > 0
                  ? ` (${fmtDuration(ou.deltaMin)} over)`
                  : ` (${fmtDuration(-ou.deltaMin)} under)`
            }`}
          />
          {day.location?.trim() && <Fact label="Location" value={day.location} />}
        </div>
        {talent.length > 0 && (
          <div className="mt-6 print:mt-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-faint">
              Talent today
            </div>
            <div className="mt-2 flex flex-wrap gap-2 print:mt-1.5 print:gap-1.5">
              {talent.map((p) => (
                <span
                  key={p.contactId}
                  style={printExact}
                  className="rounded-pill border border-border-strong px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-text-muted print:px-2.5 print:py-0.5 print:text-[9px]"
                >
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {day.notes?.trim() && (
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-text-muted print:mt-3 print:text-xs">
            {day.notes}
          </p>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-text-faint">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-text print:text-sm">{value}</div>
    </div>
  );
}

const same = (a: string | null, b: string | null) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

/** One day's rows as the table cast and crew actually read down. */
function DayRows({ day }: { day: ScheduleDayView }) {
  const timed = cascade(day.rows, callMin(day));
  if (!timed.length) {
    return (
      <p className="px-1 py-6 text-sm text-text-muted">Nothing scheduled on this day yet.</p>
    );
  }
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border-strong">
          {["Time", "What", "Location / set", "Talent", "Crew"].map((h) => (
            <th
              key={h}
              className="py-2 pr-3 text-[10px] font-bold uppercase tracking-widest text-text-faint"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {timed.map((r) => {
          const hue = KIND_HUE[r.kind] ?? "indigo";
          return (
            // A row is kept whole across a page break: a call time on one sheet
            // and its description on the next is worse than a short page.
            <tr key={r.id} className="break-inside-avoid border-b border-border align-top">
              <td className="w-[104px] py-2.5 pr-3">
                <div className="flex items-start gap-2">
                  <span
                    style={{ ...printExact, background: `var(--h-${hue})` }}
                    className="mt-1 h-3.5 w-[3px] shrink-0 rounded-full"
                  />
                  <span>
                    <span className="block text-sm font-bold tabular-nums text-text">
                      {fmtHM(r.startMin)}
                    </span>
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-text-faint">
                      {fmtDuration(r.durationMin)}
                      {r.anchoredAt ? " · fixed" : ""}
                    </span>
                  </span>
                </div>
              </td>
              <td className="py-2.5 pr-3">
                <div className="text-sm font-semibold text-text">{r.title || "Untitled"}</div>
                {r.shots.length > 0 && (
                  <div className="mt-0.5 text-[11px] text-text-muted">
                    {r.shots
                      .map((s) => s.code?.trim() || s.description?.slice(0, 40) || "shot")
                      .join(" · ")}
                  </div>
                )}
                {r.notes?.trim() && (
                  <div className="mt-0.5 text-[11px] italic text-text-muted">{r.notes}</div>
                )}
              </td>
              <td className="py-2.5 pr-3 text-[12px] text-text-muted">
                {/*
                  A row that is at the day's own location says nothing by
                  repeating it: the header already stated it once, and printing
                  it against twenty rows buries the company move that is the
                  only line where the address genuinely changes. The SET still
                  prints, since that is what differs row to row.
                */}
                {same(r.location, day.location) ? "" : r.location?.trim() || ""}
                {r.set?.trim() ? (
                  <span className="block text-text-faint">{r.set}</span>
                ) : null}
                {r.intExt || r.dayNight ? (
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-text-faint">
                    {[r.intExt, r.dayNight].filter(Boolean).join(" ")}
                  </span>
                ) : null}
              </td>
              <td className="py-2.5 pr-3 text-[12px] text-text-muted">{names(r.talent)}</td>
              <td className="py-2.5 text-[12px] text-text-muted">{names(r.crew)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * The whole schedule, or one day of it.
 *
 * EVERY DAY STARTS A PAGE, the same rule the shot list follows for its shoot
 * days: a unit reading Tuesday should not have to work out where Monday ended.
 */
export function ScheduleDocument({ days }: { days: ScheduleDayView[] }) {
  if (!days.length) {
    return <p className="py-10 text-center text-sm text-text-muted">No days on this schedule yet.</p>;
  }
  return (
    <div className="space-y-10">
      {days.map((d, i) => (
        <section key={d.id} className={i > 0 ? "break-before-page pt-6" : ""}>
          <DayHead day={d} label={d.name} />
          <div className="mt-5">
            <DayRows day={d} />
          </div>
        </section>
      ))}
    </div>
  );
}
