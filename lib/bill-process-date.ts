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
