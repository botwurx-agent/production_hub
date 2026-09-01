/**
 * Which shoot day a shot belongs to.
 *
 * A two-day shoot is one continuous shot list with the days marked in it, not
 * two documents. The `day` column has existed on shot_cards since the shot list
 * shipped and producers have been filling it in, but nothing ever rendered it
 * as structure: it was an 80px box beside Code in the editor and a small pill
 * on the tile in the export, so the document held the information and never
 * said it.
 *
 * FREE TEXT IS THE TRAP, and it is why this normalizes rather than grouping on
 * the raw string. "1", "Day 1", "day 1" and " 1 " are one day to a producer and
 * four sections to a `groupBy`. So a value is reduced to its digits when it
 * contains any, and otherwise to its trimmed lowercase self, and the FIRST
 * spelling seen wins as the label. Nobody has to go back and tidy what they
 * already typed.
 */

export type WithDay = { day: string | null };

export type ShotDay<T> = {
  /** Stable key: the normalized value. */
  key: string;
  /** What to show: "Day 1", or whatever they typed if it is not a number. */
  label: string;
  /** Sorts numerically where it can, so Day 10 follows Day 9, not Day 1. */
  order: number;
  shots: T[];
};

/** The bucket for shots with no day set. Always last, never renumbered. */
export const UNASSIGNED = "__unassigned__";

function normalize(day: string | null): string {
  const t = (day ?? "").trim();
  if (!t) return UNASSIGNED;
  const digits = t.match(/\d+/);
  return digits ? digits[0] : t.toLowerCase();
}

/** "1" -> "Day 1"; "pickups" -> "Pickups"; blank -> "No day set". */
function labelFor(key: string, first: string): string {
  if (key === UNASSIGNED) return "No day set";
  if (/^\d+$/.test(key)) return `Day ${Number(key)}`;
  return first.trim().charAt(0).toUpperCase() + first.trim().slice(1);
}

/**
 * Group shots into days, PRESERVING THE LIST'S OWN ORDER inside each day.
 *
 * Order within a day is the producer's, not ours: a shot list is a running
 * order and re-sorting it would throw away the one thing it encodes.
 */
export function groupByDay<T extends WithDay>(shots: T[]): ShotDay<T>[] {
  const days = new Map<string, ShotDay<T>>();
  for (const s of shots) {
    const key = normalize(s.day);
    let d = days.get(key);
    if (!d) {
      d = {
        key,
        label: labelFor(key, s.day ?? ""),
        // Unassigned sorts last whatever it is called; a numbered day sorts by
        // its number; anything else sorts after the numbers but before the
        // unassigned, alphabetically by label.
        order:
          key === UNASSIGNED
            ? Number.MAX_SAFE_INTEGER
            : /^\d+$/.test(key)
              ? Number(key)
              : Number.MAX_SAFE_INTEGER - 1,
        shots: [],
      };
      days.set(key, d);
    }
    d.shots.push(s);
  }
  return [...days.values()].sort(
    (a, b) => a.order - b.order || a.label.localeCompare(b.label),
  );
}

/**
 * True when the list is worth breaking into sections at all.
 *
 * A one-day shoot should look exactly as it did before: a header saying "Day 1"
 * over the only day there is, is noise. So the sections appear when a real
 * second day does.
 */
export function hasDays(groups: ShotDay<unknown>[]): boolean {
  return groups.filter((g) => g.key !== UNASSIGNED).length > 1;
}

/** The days already used in a list, for the editor's picker. */
export function dayOptions<T extends WithDay>(shots: T[]): string[] {
  const seen = new Set<string>();
  for (const s of shots) {
    const t = (s.day ?? "").trim();
    if (t) seen.add(t);
  }
  return [...seen].sort((a, b) => {
    const na = Number(a.match(/\d+/)?.[0] ?? NaN);
    const nb = Number(b.match(/\d+/)?.[0] ?? NaN);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}
