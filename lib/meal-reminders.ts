import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import {
  MEAL_REMINDER_CAP,
  MEAL_REMINDER_GAP_MS,
  cutoffLabel,
  dueToSend,
  mealLabel,
  needsChasing,
  withinChaseWindow,
} from "@/lib/meals";

/**
 * The unattended half of a meal round: send the ones scheduled for this morning,
 * then chase whoever has not opened the link as the cutoff approaches.
 *
 * This runs FREQUENTLY rather than daily, unlike the call-sheet and review
 * reminders. A lunch cutoff is a time of day, not a date: a job that fires once
 * at 15:00 UTC would send a 10am order at lunchtime, which is worse than not
 * sending it. Everything it does is idempotent, so running every fifteen
 * minutes costs nothing when there is nothing to do.
 *
 * Both halves are bounded hard, because nagging crew on a shoot morning is the
 * fastest way to make a producer stop using this:
 * - nothing is chased outside the short window before the cutoff, and NOTHING
 *   is ever chased after it, since an email about a closed order is pure noise
 * - two nudges maximum, with a gap, then it is a conversation on set
 * - opening the link stops it instantly, since the query only sees people who
 *   have done neither
 */

type SheetBits = { production_title: string | null; title: string | null };

function sheetTitle(sheet: SheetBits | null | undefined): string {
  return sheet?.production_title || sheet?.title || "the shoot";
}

export async function runMealReminders(
  service: SupabaseClient<Database>,
): Promise<{ sent: number; nudged: number; skipped: number }> {
  if (!emailConfigured()) return { sent: 0, nudged: 0, skipped: 0 };
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!origin) return { sent: 0, nudged: 0, skipped: 0 };

  // Only rounds still in play. A round whose cutoff passed more than a few
  // hours ago is finished business.
  const horizon = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: rounds } = await service
    .from("meal_rounds")
    .select(
      "id, meal, call_sheet_id, order_url, instructions, cutoff_at, budget_per_head, send_at, sent_at",
    )
    .or(`cutoff_at.is.null,cutoff_at.gte.${horizon}`);

  if (!rounds?.length) return { sent: 0, nudged: 0, skipped: 0 };

  const sheetIds = [...new Set(rounds.map((r) => r.call_sheet_id))];
  const { data: sheets } = await service
    .from("call_sheets")
    .select("id, title, production_title")
    .in("id", sheetIds);
  const sheetById = new Map((sheets ?? []).map((s) => [s.id, s as SheetBits]));

  const now = Date.now();
  let sent = 0;
  let nudged = 0;
  let skipped = 0;

  for (const round of rounds) {
    const title = sheetTitle(sheetById.get(round.call_sheet_id));
    const cutoff = cutoffLabel(round.cutoff_at);
    const budget =
      round.budget_per_head === null ? null : Number(round.budget_per_head);
    const meal = mealLabel(round.meal).toLowerCase();

    const scheduled = dueToSend(round, now);
    const chasing = Boolean(round.sent_at) && withinChaseWindow(round.cutoff_at, now);
    if (!scheduled && !chasing) continue;

    const { data: rows } = await service
      .from("meal_responses")
      .select(
        "id, opened_at, ordered_at, last_reminded_at, reminder_count, recipient:call_sheet_recipients(name, email, token)",
      )
      .eq("meal_round_id", round.id);

    for (const row of rows ?? []) {
      const person = row.recipient as unknown as {
        name: string;
        email: string | null;
        token: string;
      } | null;
      if (!person?.email) {
        skipped++;
        continue;
      }

      // On the scheduled send everyone hears once. On a chase, only the people
      // who have done nothing at all.
      if (!scheduled) {
        if (!needsChasing(row)) continue;
        if ((row.reminder_count ?? 0) >= MEAL_REMINDER_CAP) continue;
        if (
          row.last_reminded_at &&
          now - Date.parse(row.last_reminded_at) < MEAL_REMINDER_GAP_MS
        ) {
          skipped++;
          continue;
        }
      }

      const lines: string[] = [
        scheduled
          ? `Hi ${person.name}, here is the ${meal} order for ${title}.`
          : `Hi ${person.name}, we still need your ${meal} order for ${title}.`,
      ];
      if (cutoff) lines.push(`Orders close at ${cutoff}.`);
      if (budget) lines.push(`Budget is $${budget.toFixed(2)} per person.`);
      if (round.instructions) lines.push(round.instructions);
      lines.push("Open the link below to place your order.");

      const { html, text } = renderEmail({
        heading: scheduled
          ? `${mealLabel(round.meal)} order: ${title}`
          : `${mealLabel(round.meal)} order closes soon`,
        lines,
        ctaLabel: `Order ${meal}`,
        ctaUrl: `${origin}/c/${person.token}`,
        footnote: scheduled
          ? "You received this because you are on this call sheet."
          : "You are getting this because you have not opened the ordering link yet.",
      });

      const res = await sendEmail({
        to: person.email,
        subject: scheduled
          ? `${mealLabel(round.meal)} order${cutoff ? ` (closes ${cutoff})` : ""}: ${title}`
          : `${mealLabel(round.meal)} order closes${cutoff ? ` at ${cutoff}` : " soon"}: ${title}`,
        html,
        text,
      });

      if (!res.ok) {
        skipped++;
        continue;
      }
      if (scheduled) {
        sent++;
      } else {
        await service
          .from("meal_responses")
          .update({
            last_reminded_at: new Date().toISOString(),
            reminder_count: (row.reminder_count ?? 0) + 1,
          })
          .eq("id", row.id);
        nudged++;
      }
    }

    // Stamped once the batch is out, so a scheduled round cannot go twice even
    // if a later run overlaps this one.
    if (scheduled) {
      await service
        .from("meal_rounds")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", round.id);
    }
  }

  return { sent, nudged, skipped };
}
