/**
 * Crew meal rounds: the shared vocabulary and the roll-up.
 *
 * Deliberately free of "server-only" and of any Supabase import, so the
 * counting rules can be unit-tested and so the producer panel can render the
 * same numbers the cron reasons about. Nothing here talks to an ordering
 * platform: we hold the link, never the order.
 */

export const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
] as const;

export type MealKey = (typeof MEALS)[number]["key"];

export function isMealKey(v: string): v is MealKey {
  return MEALS.some((m) => m.key === v);
}

export function mealLabel(key: string): string {
  return MEALS.find((m) => m.key === key)?.label ?? "Meal";
}

/** What we know about one person on a round. */
export type MealResponseLike = {
  opened_at: string | null;
  ordered_at: string | null;
};

export type MealTally = {
  total: number;
  /** Said so themselves. */
  ordered: number;
  /** Clicked through but has not said they ordered. */
  opened: number;
  /** Has done neither. These are the only people worth chasing. */
  outstanding: number;
};

/**
 * Roll up a round.
 *
 * `ordered` and `opened` are deliberately EXCLUSIVE, so the three counts always
 * add back to the total and a producer can read them as a breakdown rather than
 * as overlapping sets. Someone who tapped "I've ordered" without ever clicking
 * our link still counts as ordered: their own word beats our telemetry.
 */
export function tallyMeal(responses: MealResponseLike[]): MealTally {
  let ordered = 0;
  let opened = 0;
  for (const r of responses) {
    if (r.ordered_at) ordered++;
    else if (r.opened_at) opened++;
  }
  return {
    total: responses.length,
    ordered,
    opened,
    outstanding: responses.length - ordered - opened,
  };
}

/**
 * Whether this person still needs chasing.
 *
 * A click-through counts as done for chasing purposes. We cannot see whether
 * they finished the order, and emailing someone who already opened the link is
 * how a helpful nudge becomes nagging.
 */
export function needsChasing(r: MealResponseLike): boolean {
  return !r.ordered_at && !r.opened_at;
}

/** Two nudges, then it is a conversation on set, not another email. */
export const MEAL_REMINDER_CAP = 2;

/** How long before the cutoff the first nudge may go out. */
export const MEAL_REMINDER_LEAD_MS = 90 * 60 * 1000;

/** A gap between nudges, so a late cutoff cannot produce a burst. */
export const MEAL_REMINDER_GAP_MS = 45 * 60 * 1000;

/**
 * Is this round inside the window where chasing is appropriate?
 *
 * Bounded on BOTH sides. Nothing fires before the lead window, so a round set
 * up the night before sits quiet; and nothing fires after the cutoff, because
 * an email about a closed order helps nobody and is the single most annoying
 * thing this feature could do.
 */
export function withinChaseWindow(
  cutoffAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!cutoffAt) return false;
  const cutoff = Date.parse(cutoffAt);
  if (Number.isNaN(cutoff)) return false;
  return now >= cutoff - MEAL_REMINDER_LEAD_MS && now < cutoff;
}

/** Human "orders close at 10:30am" for an email or a chip. */
export function cutoffLabel(cutoffAt: string | null): string | null {
  if (!cutoffAt) return null;
  const t = Date.parse(cutoffAt);
  if (Number.isNaN(t)) return null;
  try {
    return new Date(t).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

/**
 * Is a scheduled round due to go out?
 *
 * A round with no send_at is an immediate send and is never picked up here; a
 * round already sent is never sent twice.
 */
export function dueToSend(
  round: { send_at: string | null; sent_at: string | null },
  now: number = Date.now(),
): boolean {
  if (round.sent_at) return false;
  if (!round.send_at) return false;
  const at = Date.parse(round.send_at);
  return !Number.isNaN(at) && at <= now;
}
