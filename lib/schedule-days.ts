/**
 * What a schedule day IS, and what it is called.
 *
 * A day used to be a number alone, so a job with a prelight day read Day 1 /
 * Day 2 / Day 3 when the crew calls it Prelight / Day 1 / Day 2. `kind` names
 * the day; the NUMBER IS DERIVED from it, counted among shoot days only, so
 * adding or removing a prelight cannot strand a stale figure the way a stored
 * display number would. `day_number` stays the order key and is not touched.
 *
 * Pure, and NOT "server-only", so it is unit tested and shared by the editor,
 * the actions that stamp shot_cards.day, the print view and the call sheet.
 */

export type DayKind = "shoot" | "prelight" | "travel" | "move" | "wrap" | "other";

/** Every kind, in the order the picker offers them. */
export const DAY_KINDS: { key: DayKind; name: string; hint: string; hue: string }[] = [
  { key: "shoot", name: "Shoot", hint: "Counts as a shoot day and takes the next number", hue: "green" },
  { key: "prelight", name: "Prelight", hint: "Rig and light the day before", hue: "amber" },
  { key: "travel", name: "Travel", hint: "Getting the unit there", hue: "blue" },
  { key: "move", name: "Company move", hint: "A whole day lost to relocating", hue: "orange" },
  { key: "wrap", name: "Wrap", hint: "Strike, load out, return", hue: "purple" },
  { key: "other", name: "Other", hint: "A fitting, a scout, a tech recce: name it below", hue: "indigo" },
];

const BY_KEY = new Map(DAY_KINDS.map((k) => [k.key, k]));

/** Trust boundary out of the database and off the wire. Anything unknown is a shoot day. */
export function dayKind(value: unknown): DayKind {
  const s = typeof value === "string" ? value.trim() : "";
  return BY_KEY.has(s as DayKind) ? (s as DayKind) : "shoot";
}

export function dayKindName(kind: DayKind): string {
  return (BY_KEY.get(kind) ?? DAY_KINDS[0]).name;
}

export function dayKindHue(kind: DayKind): string {
  return (BY_KEY.get(kind) ?? DAY_KINDS[0]).hue;
}

/** A day's own label, cleaned. Empty becomes null so the kind's name is used. */
export function cleanDayLabel(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim().slice(0, 60) : "";
  return s || null;
}

export type NamedDay = { id: string; kind?: string | null; label?: string | null };

export type DayName = {
  id: string;
  kind: DayKind;
  /** What to show: "Day 2", "Prelight", "Prelight 2", "Fitting". */
  name: string;
  /** Its place among shoot days, 1-based. Null on every other kind. */
  shootNo: number | null;
};

/**
 * Names a whole project's days at once, because a name depends on the others:
 * a shoot day's number counts only shoot days, and two prelights have to be
 * told apart.
 *
 * Pass the days in schedule order (day_number ascending). A custom label wins
 * over the kind's name. Duplicate names among NON-SHOOT days are numbered in
 * order, so two prelights read "Prelight 1" and "Prelight 2" while a single
 * one stays plain "Prelight". Shoot days are never in that pass: their name
 * already carries a number, and numbering it twice would read as a mistake.
 */
export function nameDays(days: NamedDay[]): DayName[] {
  const kinds = days.map((d) => dayKind(d.kind));

  let shoot = 0;
  const base = days.map((d, i) => {
    if (kinds[i] === "shoot") {
      shoot += 1;
      return { shootNo: shoot, name: `Day ${shoot}` };
    }
    return { shootNo: null, name: cleanDayLabel(d.label) ?? dayKindName(kinds[i]) };
  });

  // Count the non-shoot names so only a genuine clash gets a suffix.
  const seen = new Map<string, number>();
  base.forEach((b, i) => {
    if (kinds[i] === "shoot") return;
    seen.set(b.name, (seen.get(b.name) ?? 0) + 1);
  });

  const used = new Map<string, number>();
  return days.map((d, i) => {
    const b = base[i];
    let name = b.name;
    if (kinds[i] !== "shoot" && (seen.get(b.name) ?? 0) > 1) {
      const n = (used.get(b.name) ?? 0) + 1;
      used.set(b.name, n);
      name = `${b.name} ${n}`;
    }
    return { id: d.id, kind: kinds[i], name, shootNo: b.shootNo };
  });
}

/** One day's name, when the caller already holds the whole ordered list. */
export function dayNameOf(days: NamedDay[], dayId: string): string | null {
  return nameDays(days).find((d) => d.id === dayId)?.name ?? null;
}

/**
 * What belongs in `shot_cards.day` for a shot scheduled on this day.
 *
 * A shoot day writes its SHOOT NUMBER, not its position, which is the bug this
 * fixes: with a prelight first, the old code wrote "2" for the first shoot day
 * and the shot list disagreed with every call sheet and every conversation. A
 * non-shoot day writes its name, since "Prelight" is the honest answer and the
 * column is free text.
 */
export function shotDayValue(days: NamedDay[], dayId: string): string | null {
  const d = nameDays(days).find((x) => x.id === dayId);
  if (!d) return null;
  return d.shootNo === null ? d.name : String(d.shootNo);
}
