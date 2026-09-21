/**
 * Build a first draft of the schedule out of the shot list.
 *
 * WHY THIS EXISTS. The operator put a real three-day schedule together by hand
 * and it came to 56 rows. Roughly HALF of those were setup rows, following a
 * strict setup / shot / setup / shot alternation, and the rest of the
 * repetition was the day scaffold: an opening setup, one anchored lunch, a
 * closing wrap. None of that is a judgement call, so none of it should be
 * typed. The judgement calls (how long a shot actually takes, which shot moves
 * to which day) stay with the producer, who drags rows afterwards, which the
 * cascade already makes cheap.
 *
 * THE DAY SPLIT COMES FROM THE SHOT LIST'S OWN `day` COLUMN, and that was
 * settled by looking at the real job rather than by reasoning. That schedule is
 * ONE shot list of 33 shots whose day column reads Prelight (6), 1 (13) and
 * 2 (14), which is exactly the three days they built. A rule of one list per
 * day would have made them a single 33-shot day. A list with no day values at
 * all still becomes one day, which is the right answer for a one-day job and
 * for two lists named "Day 1, product" and "Day 2, liquid".
 *
 * A NON-NUMERIC DAY VALUE NAMES A NON-SHOOT DAY ("Prelight"), which closes a
 * loop rather than inventing one: shotDayValue in lib/schedule-days writes a
 * non-shoot day's NAME into that column, so this reads back what the schedule
 * itself put there.
 *
 * WHAT IT DELIBERATELY DOES NOT GUESS. `shot_cards` has no duration column, so
 * there is nothing in the shot list to read: a shot's length is a flat default
 * the producer sets once in the dialog and then adjusts. Inferring it from the
 * shot size or the camera movement would look clever and be wrong often, and
 * every wrong guess is a row to fix, which is worse than a uniform number you
 * can see is provisional.
 *
 * Pure, and NOT "server-only", so it is unit tested and so the dialog can run
 * the SAME planner the action runs and show the real row count and the real
 * wrap time before anything is written.
 */

import { cascade, parseHM, type StripKind } from "@/lib/schedule-time";
import { DAY_KINDS, dayKindName, type DayKind } from "@/lib/schedule-days";

export type BuildShot = {
  id: string;
  code: string | null;
  description: string | null;
  /** The shot list's own day column. Free text: "1", "2", "Prelight", or blank. */
  day: string | null;
};

export type BuildList = {
  id: string;
  title: string;
  /** Only the shots that are not already on the schedule, in list order. */
  shots: BuildShot[];
};

/** A day the schedule already has, so new rows join it rather than duplicating it. */
export type ExistingDay = {
  id: string;
  kind: DayKind;
  /** As the crew says it: "Day 2", "Prelight". Derived by nameDays. */
  name: string;
  /** Its place among shoot days, null on every other kind. */
  shootNo: number | null;
  /** Whether it already ends with a wrap row, so another one is not planned. */
  hasRows: boolean;
};

export type BuildOptions = {
  /** The first setup of the day: the crew arriving, rigging and lighting. */
  openMin: number;
  /** A setup between one shot and the next. */
  setupMin: number;
  /** Every shot, since the shot list does not carry a duration. */
  shotMin: number;
  /** Where lunch is fixed, or null for no meal row. */
  lunchAt: string | null;
  lunchMin: number;
  /** Close each day with a wrap row. */
  wrap: boolean;
  /** The call time. Used here only to work out where lunch falls. */
  callTime: string | null;
  /** The target wrap. Used here only to length a prelight day. */
  wrapTarget: string | null;
};

export const BUILD_DEFAULTS: BuildOptions = {
  openMin: 60,
  setupMin: 15,
  shotMin: 60,
  lunchAt: "1:00 pm",
  lunchMin: 60,
  wrap: true,
  callTime: "7:00",
  wrapTarget: "6:00 pm",
};

/** Not product limits; they stop a runaway from writing hundreds of rows. */
export const MAX_BUILD_DAYS = 30;
export const MAX_BUILD_ROWS = 500;

export type PlannedRow = {
  kind: StripKind;
  title: string;
  durationMin: number;
  anchoredAt: string | null;
  /** The shot this row covers. One per row: see dayRows. */
  shotIds: string[];
};

export type PlannedDay = {
  /** Set when these rows JOIN a day that already exists rather than making one. */
  existingDayId: string | null;
  kind: DayKind;
  /** Free-text name for a non-shoot day the kind does not name. */
  label: string | null;
  /** What to show in the preview: "Day 2", "Prelight". */
  name: string;
  /** Its place among shoot days once written, null on every other kind. */
  shootNo: number | null;
  /** The day column value this came from, or null when a whole list became the day. */
  source: string | null;
  rows: PlannedRow[];
  /** Consecutive from the start date. Null on an existing day, which keeps its own. */
  date: string | null;
};

export type Plan = {
  days: PlannedDay[];
  /**
   * Shots left off because their list uses the day column and theirs was blank.
   * Never guessed onto a day: the dialog names the number instead.
   */
  skipped: number;
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const clampMin = (v: unknown, fallback: number): number => {
  // An EMPTY string must not become zero. Number("") is 0, so a cleared
  // duration field would silently plan a nil-length row, the same trap the
  // invoice extractor hit with "n/a". A deliberate 0 still passes.
  if (v === undefined || v === null) return fallback;
  if (typeof v === "string" && !v.trim()) return fallback;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 24 * 60 ? n : fallback;
};

/**
 * A clock field: ABSENT means "use the default", present but unreadable or
 * cleared means "there is no such time". The difference matters for lunch,
 * where null turns the meal row off, so an options object that simply forgot to
 * mention lunch should still get one.
 */
const clock = (v: unknown, fallback: string | null): string | null => {
  if (v === undefined) return fallback;
  return typeof v === "string" && parseHM(v) !== null ? v : null;
};

/** Trust boundary: the options come off a form and then off the wire. */
export function cleanBuildOptions(raw: Partial<BuildOptions> | undefined): BuildOptions {
  const o = raw ?? {};
  return {
    openMin: clampMin(o.openMin, BUILD_DEFAULTS.openMin),
    setupMin: clampMin(o.setupMin, BUILD_DEFAULTS.setupMin),
    shotMin: clampMin(o.shotMin, BUILD_DEFAULTS.shotMin),
    lunchAt: clock(o.lunchAt, BUILD_DEFAULTS.lunchAt),
    lunchMin: clampMin(o.lunchMin, BUILD_DEFAULTS.lunchMin),
    wrap: o.wrap !== false,
    callTime: clock(o.callTime, BUILD_DEFAULTS.callTime),
    wrapTarget: clock(o.wrapTarget, BUILD_DEFAULTS.wrapTarget),
  };
}

// ---------------------------------------------------------------------------
// The day split
// ---------------------------------------------------------------------------

/** "1", " 2 " -> a shoot day's number. Anything else -> null. */
export function dayNumberOf(value: string | null): number | null {
  const s = (value ?? "").trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/**
 * A non-numeric day value becomes a day KIND, matched against the kinds the
 * schedule already offers so a value the schedule itself wrote ("Prelight")
 * round-trips. Anything unrecognised is an "other" day wearing its own name.
 */
export function kindFromDayValue(value: string): { kind: DayKind; label: string | null } {
  const s = value.trim().toLowerCase();
  const hit = DAY_KINDS.find((k) => k.key === s || k.name.toLowerCase() === s);
  if (hit && hit.key !== "shoot") return { kind: hit.key, label: null };
  if (s === "strike" || s === "load out" || s === "loadout") return { kind: "wrap", label: null };
  return { kind: "other", label: value.trim().slice(0, 60) };
}

type Group = {
  key: string;
  kind: DayKind;
  label: string | null;
  source: string | null;
  /** For ordering: the numeric day, or null. */
  num: number | null;
  shots: BuildShot[];
};

/**
 * Sort the day groups the way a shoot runs.
 *
 * Numeric days go in numeric order. A prelight or a travel day comes BEFORE
 * them and a wrap day after, which cannot be read off the shot list: in the
 * operator's own list the six Prelight shots sit LAST by position, because they
 * were added after the plan, so ordering by where a shot appears would have put
 * the prelight day at the end of the shoot.
 */
const KIND_RANK: Record<DayKind, number> = {
  prelight: -2,
  travel: -1,
  shoot: 0,
  move: 0,
  other: 1,
  wrap: 2,
};

function orderGroups(groups: Group[]): Group[] {
  return groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => {
      const ra = KIND_RANK[a.g.kind];
      const rb = KIND_RANK[b.g.kind];
      if (ra !== rb) return ra - rb;
      if (a.g.num !== null && b.g.num !== null) return a.g.num - b.g.num;
      if (a.g.num !== null) return -1;
      if (b.g.num !== null) return 1;
      return a.i - b.i;
    })
    .map((x) => x.g);
}

/**
 * Split the chosen lists into days.
 *
 * PER LIST, because a project can hold one list that uses the day column and
 * another that does not: a list with day values is split by them, a list
 * without becomes one day of its own. Groups with the same day value MERGE
 * across lists, which is what makes two lists called "Day 1, product" and
 * "Day 2, liquid" come out as two days rather than four.
 */
export function groupIntoDays(lists: BuildList[]): { groups: Group[]; skipped: number } {
  const byKey = new Map<string, Group>();
  const order: Group[] = [];
  let skipped = 0;

  const put = (key: string, make: () => Omit<Group, "shots">, shot: BuildShot) => {
    let g = byKey.get(key);
    if (!g) {
      g = { ...make(), shots: [] };
      byKey.set(key, g);
      order.push(g);
    }
    g.shots.push(shot);
  };

  for (const list of lists) {
    const dayed = list.shots.some((s) => (s.day ?? "").trim());
    for (const shot of list.shots) {
      const raw = (shot.day ?? "").trim();
      if (!dayed) {
        // No day column on this list at all: the whole list is one day.
        put(`list:${list.id}`, () => ({ key: `list:${list.id}`, kind: "shoot", label: null, source: null, num: null }), shot);
        continue;
      }
      if (!raw) {
        // The list uses the day column and this shot has no day. Guessing one
        // would file work on the wrong day, so it is left unscheduled and the
        // dialog says how many.
        skipped += 1;
        continue;
      }
      const num = dayNumberOf(raw);
      const key = `day:${raw.toLowerCase()}`;
      put(key, () => {
        if (num !== null) return { key, kind: "shoot" as DayKind, label: null, source: raw, num };
        const { kind, label } = kindFromDayValue(raw);
        return { key, kind, label, source: raw, num: null };
      }, shot);
    }
  }

  return { groups: orderGroups(order), skipped };
}

// ---------------------------------------------------------------------------
// The rows of a day
// ---------------------------------------------------------------------------

/** A shot row says what is being shot. The code and the frame come from the shot itself. */
function shotTitle(s: BuildShot): string {
  const desc = (s.description ?? "").trim().split(/\r?\n/)[0]?.trim() ?? "";
  if (desc) return desc.slice(0, 160);
  const code = (s.code ?? "").trim();
  return code ? `Shot ${code}` : "Shot";
}

/**
 * Where lunch goes in the running order.
 *
 * Laid out with the real cascade and inserted before the first row that would
 * START at or after the lunch time, then walked BACK over a setup, because you
 * break and then set up rather than setting up and then breaking. Returns null
 * when the day ends before lunch, or when lunch would land before anything has
 * happened, in which case a meal row would say nothing.
 */
function lunchIndex(rows: PlannedRow[], opts: BuildOptions): number | null {
  const at = opts.lunchAt ? parseHM(opts.lunchAt) : null;
  if (at === null || !rows.length) return null;
  const timed = cascade(
    rows.map((r, i) => ({ id: String(i), kind: r.kind, durationMin: r.durationMin, anchoredAt: r.anchoredAt })),
    parseHM(opts.callTime) ?? 7 * 60
  );
  const hit = timed.findIndex((t) => t.startMin >= at);
  if (hit === -1) return null;
  const idx = hit > 0 && rows[hit - 1].kind === "setup" ? hit - 1 : hit;
  return idx > 0 ? idx : null;
}

/**
 * The rows for one day's worth of shots.
 *
 * `joining` is a day that already exists, and then only the work is planned: no
 * second opening setup, no second lunch and no second wrap, since that day
 * already has them. That is what lets the build be run again after shots are
 * added to the list without duplicating the day around them.
 */
export function dayRows(shots: BuildShot[], opts: BuildOptions, joining = false): PlannedRow[] {
  if (!shots.length) return [];
  const rows: PlannedRow[] = [];

  // The opener and the between-shots setups are both plain "Setup" rows, which
  // is what the app calls them and what the operator built by hand. The only
  // difference is the duration, and the duration column states it.
  if (!joining) {
    rows.push({ kind: "setup", title: "Setup", durationMin: opts.openMin, anchoredAt: null, shotIds: [] });
  }

  shots.forEach((s, i) => {
    if (i > 0 || joining) {
      rows.push({ kind: "setup", title: "Setup", durationMin: opts.setupMin, anchoredAt: null, shotIds: [] });
    }
    // ONE SHOT PER ROW. Their real schedule sometimes put two on a row, almost
    // certainly because the two shared a set, and the shot list carries no set
    // or location, so we cannot know that. A row already holds several shots,
    // so merging two is a tick in the row modal rather than a rebuild.
    rows.push({ kind: "shot", title: shotTitle(s), durationMin: opts.shotMin, anchoredAt: null, shotIds: [s.id] });
  });

  if (joining) return rows;

  const at = lunchIndex(rows, opts);
  if (at !== null) {
    rows.splice(at, 0, { kind: "meal", title: "Lunch", durationMin: opts.lunchMin, anchoredAt: opts.lunchAt, shotIds: [] });
  }
  if (opts.wrap) rows.push({ kind: "wrap", title: "Wrap", durationMin: 0, anchoredAt: null, shotIds: [] });
  return rows;
}

/**
 * A prelight day added from the dialog carries NO SHOTS (the operator:
 * "prelight days should typically get no shots"), so it gets one setup row
 * spanning call to target wrap. A blank day would be honest and useless; one
 * row reads correctly and splits into as many as the rig needs. A prelight day
 * that came from the SHOT LIST is a different thing and keeps its shots.
 */
export function prelightRows(opts: BuildOptions): PlannedRow[] {
  const call = parseHM(opts.callTime);
  const wrap = parseHM(opts.wrapTarget);
  const span = call !== null && wrap !== null && wrap > call ? wrap - call : 8 * 60;
  return [
    { kind: "setup", title: "Prelight", durationMin: Math.max(60, Math.min(span, 14 * 60)), anchoredAt: null, shotIds: [] },
  ];
}

/** Add whole days to a YYYY-MM-DD date. Parsed as UTC midnight so no timezone shifts a day. */
export function datePlus(iso: string | null, days: number): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// The whole plan
// ---------------------------------------------------------------------------

/** Which day already on the schedule these shots belong to, if any. */
function matchExisting(g: Group, existing: ExistingDay[]): ExistingDay | undefined {
  if (g.num !== null) return existing.find((d) => d.kind === "shoot" && d.shootNo === g.num);
  if (g.source) {
    const want = g.source.trim().toLowerCase();
    return existing.find((d) => d.name.trim().toLowerCase() === want);
  }
  // A whole-list day has nothing to match on: a list is not a day the schedule
  // knows about, so it always makes a new one.
  return undefined;
}

export function planSchedule(
  lists: BuildList[],
  opts: BuildOptions,
  extras: { prelight?: boolean; startDate?: string | null; existing?: ExistingDay[] } = {}
): Plan {
  const existing = extras.existing ?? [];
  const { groups, skipped } = groupIntoDays(lists);

  const days: PlannedDay[] = [];

  // A prelight asked for in the dialog, only when nothing already covers it:
  // the shot list naming a prelight day is the better source, and two would be
  // one too many.
  const listHasNonShoot = groups.some((g) => g.kind !== "shoot");
  if (extras.prelight && !listHasNonShoot && !existing.length) {
    days.push({
      existingDayId: null,
      kind: "prelight",
      label: null,
      name: dayKindName("prelight"),
      shootNo: null,
      source: null,
      rows: prelightRows(opts),
      date: null,
    });
  }

  let nextShootNo = existing.filter((d) => d.kind === "shoot").length + 1;
  nextShootNo += days.filter((d) => d.kind === "shoot").length;

  for (const g of groups) {
    const join = matchExisting(g, existing);
    // Joining a day that is EMPTY plans the whole day into it, scaffold and
    // all. Only a day that already has rows has an opener, a lunch and a wrap
    // worth not repeating.
    const rows = dayRows(g.shots, opts, Boolean(join?.hasRows));
    if (!rows.length) continue;
    const kind = join?.kind ?? g.kind;
    const shootNo = join ? join.shootNo : kind === "shoot" ? nextShootNo++ : null;
    const name = join ? join.name : shootNo !== null ? `Day ${shootNo}` : g.label ?? dayKindName(kind);
    days.push({
      existingDayId: join?.id ?? null,
      kind,
      label: join ? null : g.label,
      name,
      shootNo,
      source: g.source,
      rows,
      date: null,
    });
  }

  const capped = days.slice(0, MAX_BUILD_DAYS);
  // Dates run consecutively and are only given to days being CREATED; a day
  // that already exists keeps the date it has.
  let n = 0;
  for (const d of capped) {
    if (d.existingDayId) continue;
    d.date = datePlus(extras.startDate ?? null, n);
    n += 1;
  }
  return { days: capped, skipped };
}

/**
 * Where each new day belongs among the ones the schedule already has.
 *
 * A new day cannot simply be appended: a prelight added on a second run would
 * be given the next day_number and would sit AFTER Day 2, which is the exact
 * confusion migration 0109 exists to prevent, and the editor has no way to
 * reorder days. So the whole sequence is worked out here and the action
 * renumbers. EXISTING DAYS KEEP THEIR RELATIVE ORDER, always: this only decides
 * where the new ones slot in, never second-guesses an arrangement somebody made
 * on purpose.
 *
 * Returns one slot per day in final order, each naming either a day that
 * already exists or an index into `fresh`.
 */
export function mergeDayOrder(
  existing: { id: string; kind: DayKind; shootNo: number | null }[],
  fresh: { kind: DayKind; shootNo: number | null }[]
): { existingId: string | null; freshIndex: number | null }[] {
  const rank = (d: { kind: DayKind; shootNo: number | null }) => [KIND_RANK[d.kind], d.shootNo ?? Number.MAX_SAFE_INTEGER];
  const before = (a: { kind: DayKind; shootNo: number | null }, b: { kind: DayKind; shootNo: number | null }) => {
    const [ra, na] = rank(a);
    const [rb, nb] = rank(b);
    return ra !== rb ? ra < rb : na < nb;
  };

  const out: { existingId: string | null; freshIndex: number | null }[] = [];
  let i = 0;
  let j = 0;
  while (i < existing.length || j < fresh.length) {
    if (j >= fresh.length) { out.push({ existingId: existing[i].id, freshIndex: null }); i += 1; continue; }
    if (i >= existing.length) { out.push({ existingId: null, freshIndex: j }); j += 1; continue; }
    // Ties go to the day that already exists, so nothing established moves.
    if (before(fresh[j], existing[i])) { out.push({ existingId: null, freshIndex: j }); j += 1; }
    else { out.push({ existingId: existing[i].id, freshIndex: null }); i += 1; }
  }
  return out;
}

/** What the dialog states before anything is written. */
export function planTotals(plan: Plan): { days: number; newDays: number; rows: number; shots: number } {
  return {
    days: plan.days.length,
    newDays: plan.days.filter((d) => !d.existingDayId).length,
    rows: plan.days.reduce((n, d) => n + d.rows.length, 0),
    shots: plan.days.reduce((n, d) => n + d.rows.reduce((k, r) => k + r.shotIds.length, 0), 0),
  };
}
