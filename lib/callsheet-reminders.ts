import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";

/**
 * Chase the people who have not confirmed a call sheet.
 *
 * Viewed and confirmed were already tracked, but acting on the gap was left to
 * the producer, on the days when they have the least attention to spare. This
 * closes that: as the shoot approaches, anyone who has not confirmed gets a
 * short nudge with their own link, and the producer only has to look at the
 * ones still outstanding.
 *
 * Three things bound it, because chasing crew is exactly the thing that turns
 * a helpful product into an annoying one:
 * - it starts only inside a short window before the shoot, so a sheet built
 *   three weeks out sits quiet
 * - one nudge a day at most, capped, so the last day is not a mailing list
 * - a confirmation stops it instantly, since the query only ever sees
 *   unconfirmed rows
 *
 * A person with no email address is never counted as skipped noise: they were
 * always going to be a copy-the-link case, and the producer can see them in
 * the panel.
 */

/** How close the shoot has to be before anyone is nudged. */
const WINDOW_DAYS = 3;

/** Two nudges, then it is a phone call, not an email. */
const REMINDER_CAP = 2;

/**
 * A day, less a few hours. The cron fires at a fixed time each day, so a strict
 * 24h gap would skip every other day on the slightest drift.
 */
const MIN_GAP_MS = 20 * 60 * 60 * 1000;

/** A sheet nobody has been sent has nothing to chase. */
const SENDABLE = new Set(["sent", "confirmed"]);

function utcDay(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

function longDate(iso: string): string {
  try {
    return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(
      undefined,
      { weekday: "long", month: "long", day: "numeric" },
    );
  } catch {
    return iso;
  }
}

export async function runCallSheetReminders(
  service: SupabaseClient<Database>,
): Promise<{ sent: number; skipped: number }> {
  if (!emailConfigured()) return { sent: 0, skipped: 0 };
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!origin) return { sent: 0, skipped: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Sheets shooting between today and the end of the window. A sheet whose
  // date has passed is dropped rather than chased: whatever happened has
  // happened, and an email about yesterday helps nobody.
  const { data: sheets } = await service
    .from("call_sheets")
    .select("id, title, production_title, shoot_date, call_time, status")
    .gte("shoot_date", today)
    .lte("shoot_date", until);

  const live = (sheets ?? []).filter((s) => SENDABLE.has(s.status));
  if (live.length === 0) return { sent: 0, skipped: 0 };

  const { data: recipients } = await service
    .from("call_sheet_recipients")
    .select(
      "id, name, email, token, call_sheet_id, confirmed_at, last_reminded_at, reminder_count",
    )
    .in(
      "call_sheet_id",
      live.map((s) => s.id),
    )
    .is("confirmed_at", null)
    .not("email", "is", null)
    .lt("reminder_count", REMINDER_CAP);

  if (!recipients?.length) return { sent: 0, skipped: 0 };

  const sheetById = new Map(live.map((s) => [s.id, s]));
  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const r of recipients) {
    if (
      r.last_reminded_at &&
      now - Date.parse(r.last_reminded_at) < MIN_GAP_MS
    ) {
      skipped++;
      continue;
    }
    const sheet = sheetById.get(r.call_sheet_id);
    if (!sheet?.shoot_date) {
      skipped++;
      continue;
    }

    const title = sheet.production_title || sheet.title || "the shoot";
    const days = Math.round((utcDay(sheet.shoot_date) - utcDay(today)) / 86_400_000);
    // Said in the words a crew member would use, because "in 0 days" is how a
    // reminder gets ignored.
    const when =
      days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;

    const { html, text } = renderEmail({
      heading: `Please confirm: ${title}`,
      lines: [
        `Hi ${r.name}, we still need your confirmation for ${title}, shooting ${when} on ${longDate(sheet.shoot_date)}${sheet.call_time ? ` at ${sheet.call_time}` : ""}.`,
        "Open your call sheet below and press Confirm so production knows you are set.",
      ],
      ctaLabel: "View and confirm",
      ctaUrl: `${origin}/c/${r.token}`,
      footnote:
        "You received this because you are on this call sheet. Confirming stops these reminders.",
    });

    const res = await sendEmail({
      to: r.email as string,
      subject: `Please confirm your call: ${title} (${when})`,
      html,
      text,
    });

    if (res.ok) {
      await service
        .from("call_sheet_recipients")
        .update({
          last_reminded_at: new Date().toISOString(),
          reminder_count: (r.reminder_count ?? 0) + 1,
        })
        .eq("id", r.id);
      sent++;
    } else {
      skipped++;
    }
  }

  return { sent, skipped };
}
