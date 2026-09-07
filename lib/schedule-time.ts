/**
 * The arithmetic of a shoot day.
 *
 * A schedule is a list of strips, each with a duration, and the times are
 * DERIVED: the first strip starts at call, every strip after it starts when
 * the one before ends. Change one duration and everything below moves, which
 * is the thing a spreadsheet makes the AD do by hand and the reason this
 * exists.
 *
 * ANCHORS are the exception, and they are how an AD actually thinks. Lunch is
 * at 1:00 because catering is booked; the crew call is 7:00 because the
 * location opens at 7:00. An anchored strip holds its time and the cascade
 * reports the SLACK against it: minutes of buffer before it if the morning
 * runs short, or an overrun INTO it if the morning runs long. The overrun is
 * reported, never hidden, because "we are 20 minutes into lunch" is precisely
 * the fact the AD needs at 12:40.
 *
 * Pure, and NOT "server-only", so it is unit tested and shared by the editor,
 * the print view and the call sheet block.
 */

export type StripKind = "call" | "meal" | "setup" | "shot" | "move" | "note" | "wrap";
export type IntExt = "INT" | "EXT";
export type DayNight = "DAY" | "NIGHT";

export type StripInput = {
  id: string;
  kind: StripKind;
  durationMin: number;
  /** "HH:MM" (24h) or "h:mm am/pm". A fixed start the cascade may not move. */
  anchoredAt?: string | null;
};

export type Timed<T extends StripInput> = T & {
  /** Minutes from midnight. */
  startMin: number;
  endMin: number;
  /**
   * Anchored strips only: minutes between the previous strip's end and this
   * start. Positive is buffer, negative is an overrun into it. Null when the
   * strip simply follows the one before.
   */
  slackMin: number | null;
};

/** "8:00", "08:00", "1:00 pm", "13:00", "1pm" all resolve. Null on junk. */
export function parseHM(raw: string | null | undefined): number | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : 0;
  const ap = m[3];
  if (mm > 59 || h > 24) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap.startsWith("p") && h !== 12) h += 12;
    if (ap.startsWith("a") && h === 12) h = 0;
  }
  return h * 60 + mm;
}

/** 780 -> "1:00 PM" (or "13:00"). Past midnight wraps, since a night shoot does. */
export function fmtHM(min: number, opts: { ampm?: boolean } = {}): string {
  const total = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const mm = String(m).padStart(2, "0");
  if (opts.ampm === false) return `${String(h).padStart(2, "0")}:${mm}`;
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${ap}`;
}

/** "45 min", "1h 30m", "2h". For a duration, never a clock time. */
export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/**
 * Lay the day out. `dayStartMin` is the call time and is where the first
 * strip starts unless that strip is itself anchored.
 */
export function cascade<T extends StripInput>(
  strips: T[],
  dayStartMin: number
): Timed<T>[] {
  const out: Timed<T>[] = [];
  let cursor = dayStartMin;
  for (const s of strips) {
    const parsed = s.anchoredAt ? parseHM(s.anchoredAt) : null;
    const anchor = parsed === null ? null : onShootDay(parsed, dayStartMin);
    const dur = Math.max(0, Number(s.durationMin) || 0);
    if (anchor !== null) {
      const slack = anchor - cursor;
      const startMin = anchor;
      out.push({ ...s, startMin, endMin: startMin + dur, slackMin: slack });
      cursor = startMin + dur;
    } else {
      out.push({ ...s, startMin: cursor, endMin: cursor + dur, slackMin: null });
      cursor += dur;
    }
  }
  return out;
}

/**
 * Where the day lands against the wrap it was meant to hit.
 * Positive delta is OVER (bad), negative is under.
 */
export function overUnder<T extends StripInput>(
  timed: Timed<T>[],
  wrapTargetMin: number,
  dayStartMin?: number
): { endMin: number; deltaMin: number } {
  const target = onShootDay(wrapTargetMin, dayStartMin ?? (timed[0]?.startMin ?? 0));
  const endMin = timed.length ? timed[timed.length - 1].endMin : target;
  return { endMin, deltaMin: endMin - target };
}

/**
 * A clock time read RELATIVE TO THE CALL. On a shoot day "1:00 AM" after a
 * 2:00 PM call means tomorrow morning, not thirteen hours before call. Found on
 * the mockup's night-shoot example, which wrapped at 11:30 PM against a 1:00 AM
 * target and was reported as twenty-two hours over.
 *
 * BUT NOT EVERY EARLIER TIME IS TOMORROW. A strip anchored at 7:00 under an
 * 8:00 call is a pre-call for G&E, the same morning. The line between the two
 * is twelve hours: no shoot day carries twelve hours of pre-call, and no night
 * shoot wraps less than twelve hours before it started. A time more than that
 * before call rolls to the next day; anything closer is today.
 */
export function onShootDay(min: number, dayStartMin: number): number {
  return dayStartMin - min > 720 ? min + 1440 : min;
}

/** Total scheduled minutes, ignoring anchor gaps: what the day is asking for. */
export function totalMinutes(strips: StripInput[]): number {
  return strips.reduce((n, s) => n + Math.max(0, Number(s.durationMin) || 0), 0);
}

/**
 * The position for a row dropped between two others. Midpoint insertion, same
 * as project_tasks.sort: one row is written per move rather than renumbering
 * the day. Floats run out of precision after about fifty drops into the same
 * gap, at which point two rows share a key and creation order decides; an
 * unintended order rather than lost work, so not worth a renumbering pass.
 */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return (after as number) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}
