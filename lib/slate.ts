import type { ProjectStatus } from "@/lib/database.types";

// The studio slate: every project as one horizontal lane across a date window,
// so a producer can see the whole slate at once instead of one job at a time.
//
// Deliberately NOT a Gantt. There are no dependencies and nothing to maintain:
// every segment is derived from dates the producer was already entering, so the
// view cannot drift out of date the way a task-level chart does.

export type SlateKind =
  | "prepro"
  | "shoot"
  | "post"
  | "delivered"
  | "overdue"
  | "undated";

export type SlateSegment = {
  kind: SlateKind;
  /** Inclusive day offsets from the window start. */
  from: number;
  to: number;
  label: string;
};

export type SlateInput = {
  id: string;
  title: string;
  status: ProjectStatus;
  client: { name: string } | null;
  shoot_date: string | null;
  due_date: string | null;
  created_at: string | null;
  archived: boolean;
  color: string | null;
};

export type SlateEvent = {
  project_id: string;
  title: string;
  date: string;
  end_date: string | null;
  kind: string;
};

export type SlateLane = {
  id: string;
  title: string;
  client: string | null;
  status: ProjectStatus;
  archived: boolean;
  segments: SlateSegment[];
  /** Delivery date as a day offset, when it falls inside the window. */
  deliveryAt: number | null;
  overdue: boolean;
  /** No shoot date, no due date, no events: invisible in every other view. */
  undated: boolean;
};

const DAY_MS = 86_400_000;

/** Parses a YYYY-MM-DD date as UTC midnight, so no timezone can shift the day. */
function parseDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, n: number): string {
  return toIso(parseDay(iso) + n * DAY_MS);
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from `startIso` to `iso`; negative when before the window. */
export function dayIndex(iso: string, startIso: string): number {
  return Math.round((parseDay(iso) - parseDay(startIso)) / DAY_MS);
}

/** The Monday on or before the given date. */
export function mondayOf(iso: string): string {
  const ms = parseDay(iso);
  const dow = new Date(ms).getUTCDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  return toIso(ms - back * DAY_MS);
}

/**
 * The default window: one week of context behind today, then forward. Starting
 * exactly at today would hide the shoot that happened on Monday, which is
 * usually the thing you are still chasing deliverables from.
 */
export function defaultStart(todayIso: string): string {
  return addDays(mondayOf(todayIso), -7);
}

const KIND_LABEL: Record<string, string> = {
  prepro: "Pre-pro",
  shoot: "Shoot",
  review: "Review",
  delivery: "Delivery",
  other: "Scheduled",
};

// A segment is only useful if some part of it lands inside the window.
function clip(
  from: number,
  to: number,
  days: number
): { from: number; to: number } | null {
  const a = Math.max(0, from);
  const b = Math.min(days - 1, to);
  if (b < a) return null;
  return { from: a, to: b };
}

function push(
  out: SlateSegment[],
  kind: SlateKind,
  from: number,
  to: number,
  label: string,
  days: number
) {
  const c = clip(from, to, days);
  if (c) out.push({ kind, from: c.from, to: c.to, label });
}

/**
 * Builds one lane per project.
 *
 * Producer-entered `project_events` win when a project has them, because those
 * are explicit intent. Otherwise the lane is derived from the project's own
 * dates, which every project has the chance to carry.
 */
export function buildLanes(
  projects: SlateInput[],
  events: SlateEvent[],
  opts: { startIso: string; days: number; todayIso: string }
): SlateLane[] {
  const { startIso, days, todayIso } = opts;
  const today = dayIndex(todayIso, startIso);

  const eventsByProject = new Map<string, SlateEvent[]>();
  for (const e of events) {
    const list = eventsByProject.get(e.project_id);
    if (list) list.push(e);
    else eventsByProject.set(e.project_id, [e]);
  }

  return projects.map((p) => {
    const segments: SlateSegment[] = [];
    const own = eventsByProject.get(p.id) ?? [];

    for (const e of own) {
      const from = dayIndex(e.date, startIso);
      const to = e.end_date ? dayIndex(e.end_date, startIso) : from;
      const kind: SlateKind =
        e.kind === "shoot"
          ? "shoot"
          : e.kind === "prepro"
            ? "prepro"
            : e.kind === "delivery"
              ? "delivered"
              : "post";
      push(
        segments,
        kind,
        from,
        Math.max(from, to),
        e.title || KIND_LABEL[e.kind] || "Scheduled",
        days
      );
    }

    const shoot = p.shoot_date ? dayIndex(p.shoot_date, startIso) : null;
    const due = p.due_date ? dayIndex(p.due_date, startIso) : null;
    const created = p.created_at
      ? dayIndex(p.created_at.slice(0, 10), startIso)
      : null;
    const delivered = p.status === "delivered";
    // Past its delivery date and not actually delivered. The single most
    // useful thing this view surfaces, so it gets its own segment kind.
    const overdue = due !== null && due < today && !delivered;

    if (own.length === 0) {
      // Pre-pro runs from when the job was created up to the shoot. Skipped
      // when the project was created after its own shoot date (backfilled
      // jobs), where a pre-pro band would be a fiction.
      if (shoot !== null && created !== null && created < shoot) {
        push(segments, "prepro", created, shoot - 1, "Pre-pro", days);
      }
      if (shoot !== null) {
        push(segments, "shoot", shoot, shoot, "Shoot", days);
      }

      const postFrom = shoot !== null ? shoot + 1 : created;
      if (due !== null && postFrom !== null && due >= postFrom) {
        if (overdue) {
          // Run the bar to today so the overrun is the visible thing, not a
          // bar that stops politely at a date everyone already missed.
          push(segments, "overdue", postFrom, today, "Past due", days);
        } else {
          push(
            segments,
            delivered ? "delivered" : "post",
            postFrom,
            due,
            delivered ? "Delivered" : "Post and review",
            days
          );
        }
      } else if (shoot !== null && due === null && !delivered) {
        push(segments, "post", shoot + 1, today, "Post, no delivery date", days);
      } else if (delivered && due !== null) {
        // Shipped the same day it shot: no run to draw, but the lane should
        // still say so rather than trailing off after the shoot marker.
        push(segments, "delivered", due, due, "Delivered", days);
      }
    }

    // Carrying no dates at all is a real finding worth surfacing. Carrying
    // dates that happen to sit outside the window being viewed is not, so this
    // is judged on the project's data, never on whether anything drew.
    const undated = own.length === 0 && shoot === null && due === null;
    if (undated) {
      // Anchor the ghost lane at creation when we know it, so an old dateless
      // job does not present itself as something starting today.
      const from = created !== null ? Math.max(0, created) : 0;
      push(segments, "undated", from, today, "No dates set", days);
    }

    return {
      id: p.id,
      title: p.title,
      client: p.client?.name ?? null,
      status: p.status,
      archived: p.archived,
      segments,
      deliveryAt: due !== null && due >= 0 && due < days ? due : null,
      overdue,
      undated,
    };
  });
}

/** Day offsets carrying more than one shoot: two jobs shooting the same day. */
export function shootCollisions(lanes: SlateLane[]): number[] {
  const count = new Map<number, number>();
  for (const lane of lanes) {
    if (lane.archived) continue;
    // A multi-day shoot collides on every day it covers.
    for (const s of lane.segments) {
      if (s.kind !== "shoot") continue;
      for (let d = s.from; d <= s.to; d++) {
        count.set(d, (count.get(d) ?? 0) + 1);
      }
    }
  }
  return [...count.entries()]
    .filter(([, n]) => n > 1)
    .map(([d]) => d)
    .sort((a, b) => a - b);
}
