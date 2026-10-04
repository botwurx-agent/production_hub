/**
 * WHEN BILL MAY PROCESS A PAYMENT, which is not "today".
 *
 * The first real payment press was refused with
 * `Invalid Process Date : 2026-10-04`, and 2026-10-04 was a SUNDAY. ACH does
 * not settle at weekends or on Federal Reserve holidays, so a process date has
 * to be a BANKING DAY, and the old code sent `new Date().toISOString()`, which
 * is neither bounded to banking days nor to a US date at all.
 *
 * TWO INDEPENDENT BUGS IN THAT ONE LINE, and only the first was observed:
 *  1. It could name a weekend or a holiday, which BILL refuses outright.
 *  2. It was UTC. At 20:00 in Los Angeles the UTC date is already TOMORROW,
 *     so a Friday evening press sent Saturday. The reverse is worse: a date
 *     BILL already considers past is also invalid.
 *
 * SO THE DAY IS RESOLVED IN NEW YORK, deliberately the LATEST US date. Reading
 * the day in Pacific would risk naming a date the rest of the country has
 * already finished, and a date in the past is refused the same way a Sunday
 * is. One day early is never wrong here; one day late is.
 *
 * ERRING FORWARD IS SAFE IN ONE DIRECTION ONLY, which is why the holiday list
 * is worth carrying: skipping a day BILL would have accepted delays a payment
 * by a day, while naming a day it will not accept fails the press in front of
 * somebody mid-flow. If this list and BILL's calendar ever disagree, prefer
 * adding a day here.
 */

/** The date in New York, as YYYY-MM-DD, for any instant. */
export function usToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is the shape BILL wants, so there is no
  // reassembly to get wrong.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** A YYYY-MM-DD string as UTC midnight, so adding days cannot meet DST. */
function atUtcMidnight(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The nth given weekday of a month, as a day of the month. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/** The last given weekday of a month. */
function lastWeekday(year: number, month: number, weekday: number): number {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month - 1, days)).getUTCDay();
  return days - ((last - weekday + 7) % 7);
}

/**
 * Federal Reserve bank holidays for a year, as YYYY-MM-DD.
 *
 * THE OBSERVANCE RULE IS THE FED'S OWN and is asymmetric, which is the part
 * most calendars get wrong: a fixed-date holiday falling on SUNDAY is observed
 * the following Monday, and one falling on SATURDAY is NOT observed at all,
 * since Federal Reserve Banks are open the preceding Friday.
 */
export function fedHolidays(year: number): Set<string> {
  const out = new Set<string>();
  const fixed = (month: number, day: number) => {
    const d = new Date(Date.UTC(year, month - 1, day));
    const w = d.getUTCDay();
    if (w === 6) return; // Saturday: banks are open on the Friday before.
    if (w === 0) d.setUTCDate(d.getUTCDate() + 1); // Sunday: observed Monday.
    out.add(isoOf(d));
  };
  const floating = (month: number, day: number) =>
    out.add(isoOf(new Date(Date.UTC(year, month - 1, day))));

  fixed(1, 1); // New Year's Day
  floating(1, nthWeekday(year, 1, 1, 3)); // Martin Luther King Jr Day
  floating(2, nthWeekday(year, 2, 1, 3)); // Washington's Birthday
  floating(5, lastWeekday(year, 5, 1)); // Memorial Day
  fixed(6, 19); // Juneteenth
  fixed(7, 4); // Independence Day
  floating(9, nthWeekday(year, 9, 1, 1)); // Labor Day
  floating(10, nthWeekday(year, 10, 1, 2)); // Columbus Day
  fixed(11, 11); // Veterans Day
  floating(11, nthWeekday(year, 11, 4, 4)); // Thanksgiving
  fixed(12, 25); // Christmas Day
  return out;
}

export function isBankingDay(iso: string): boolean {
  const d = atUtcMidnight(iso);
  const w = d.getUTCDay();
  if (w === 0 || w === 6) return false;
  return !fedHolidays(d.getUTCFullYear()).has(iso);
}

/**
 * The first banking day on or after the US date right now. Capped at a short
 * walk: the longest run of closed days is four, so ten is far past any real
 * calendar and exists only so a wrong holiday list cannot loop.
 */
export function nextBankingDay(now: Date = new Date()): string {
  let iso = usToday(now);
  for (let i = 0; i < 10 && !isBankingDay(iso); i++) {
    const d = atUtcMidnight(iso);
    d.setUTCDate(d.getUTCDate() + 1);
    iso = isoOf(d);
  }
  return iso;
}

/**
 * How far ahead a process date may be set. A year is far past any real net
 * term and exists only so a typo in the year cannot queue a payment for 2126.
 */
const MAX_DAYS_AHEAD = 365;

function plusDays(iso: string, days: number): string {
  const d = atUtcMidnight(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoOf(d);
}

/** The latest date the window will accept, so the picker can bound itself. */
export function latestProcessDate(now: Date = new Date()): string {
  return plusDays(usToday(now), MAX_DAYS_AHEAD);
}

/**
 * THE DATE TO ACTUALLY SEND, from whatever the window offered.
 *
 * The process date is a field somebody can set, because BILL refused
 * `2026-10-05` (a Monday, and a banking day by this module's own reading), so
 * there is a second constraint on it that is not ours to guess. Rather than
 * guess a fourth time, the window states the date and lets the producer move
 * it, and this is the trust boundary on the way back in: the browser sends a
 * string, and a string is not a date.
 *
 * ANYTHING UNUSABLE FALLS BACK rather than refusing, because the fallback is
 * the value the field was defaulted to anyway. Refused: a wrong shape, a day
 * that does not exist (2026-02-31 must not roll into March), a date already
 * past in the US, a closed day, and anything absurdly far out.
 */
export function processDateFor(input: unknown, now: Date = new Date()): string {
  const fallback = nextBankingDay(now);
  if (typeof input !== "string") return fallback;
  const iso = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fallback;
  // atUtcMidnight rolls an impossible day forward, so the round trip is the
  // check: 2026-02-31 comes back as 2026-03-03 and does not match.
  const d = atUtcMidnight(iso);
  if (!Number.isFinite(d.getTime()) || isoOf(d) !== iso) return fallback;
  // ISO dates compare correctly as strings, so no parsing is needed here.
  if (iso < usToday(now)) return fallback;
  if (iso > latestProcessDate(now)) return fallback;
  if (!isBankingDay(iso)) return fallback;
  return iso;
}
