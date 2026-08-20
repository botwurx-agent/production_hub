"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { logWrite } from "@/lib/log";
import { siteOrigin } from "@/lib/site-url";
import { isFetchableUrl } from "@/lib/unfurl";
import {
  MEAL_REMINDER_CAP,
  cutoffLabel,
  isMealKey,
  mealLabel,
  needsChasing,
} from "@/lib/meals";
import type { MealRound } from "@/lib/database.types";

export type MealState = { error?: string } | null;

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/callsheet`);
  revalidatePath(`/projects/${projectId}`);
}

export type MealRoundInput = {
  meal: string;
  orderUrl: string;
  instructions?: string | null;
  cutoffAt?: string | null;
  budgetPerHead?: number | null;
  sendAt?: string | null;
  /** Recipients to include. A recipient not listed is not on this order. */
  recipientIds: string[];
};

/**
 * Create or update the round for one meal on one call sheet.
 *
 * Upsert rather than create-then-edit, because the unique index already says
 * there is at most one lunch per sheet and the producer thinks of it as "the
 * lunch order", not as a document they are versioning.
 */
export async function saveMealRound(
  projectId: string,
  callSheetId: string,
  input: MealRoundInput,
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const meal = isMealKey(input.meal) ? input.meal : "lunch";

  const url = input.orderUrl.trim();
  // The link is pasted by a producer and then emailed to crew, so it is worth
  // being strict: this rejects javascript: and data: as well as private and
  // reserved hosts, reusing the guard written for board link unfurling.
  if (!url || !isFetchableUrl(url)) {
    return { error: "Paste the ordering link as a full web address." };
  }
  if (input.recipientIds.length === 0) {
    return { error: "Pick at least one person for the order." };
  }

  const supabase = createClient();

  // The sheet must belong to this project, so a call sheet id cannot be used to
  // hang an order off someone else's shoot.
  const { data: sheet } = await supabase
    .from("call_sheets")
    .select("id, project_id")
    .eq("id", callSheetId)
    .maybeSingle();
  if (!sheet || sheet.project_id !== projectId) {
    return { error: "That call sheet is not on this project." };
  }

  const row = {
    studio_id: ctx.studio.id,
    call_sheet_id: callSheetId,
    meal,
    order_url: url,
    instructions: input.instructions?.trim() || null,
    cutoff_at: input.cutoffAt || null,
    budget_per_head:
      typeof input.budgetPerHead === "number" && input.budgetPerHead > 0
        ? input.budgetPerHead
        : null,
    send_at: input.sendAt || null,
  };

  const { data: saved, error } = await supabase
    .from("meal_rounds")
    .upsert(row, { onConflict: "call_sheet_id,meal" })
    .select("id")
    .single();
  if (error || !saved) {
    return { error: error?.message ?? "The meal round could not be saved." };
  }

  const sync = await syncRecipients(
    supabase,
    ctx.studio.id,
    saved.id,
    callSheetId,
    input.recipientIds,
  );
  if (sync) return { error: sync };

  rp(projectId);
  return { id: saved.id };
}

/**
 * Reconcile who is on the round.
 *
 * Adds rows for the newly included and removes rows for the dropped, rather
 * than clearing and re-inserting, so somebody who has already ordered does not
 * lose that when the producer adds one more person to the list.
 */
async function syncRecipients(
  supabase: ReturnType<typeof createClient>,
  studioId: string,
  roundId: string,
  callSheetId: string,
  wanted: string[],
): Promise<string | null> {
  // Only people actually on this sheet, so an id from elsewhere is ignored
  // rather than trusted.
  const { data: valid } = await supabase
    .from("call_sheet_recipients")
    .select("id")
    .eq("call_sheet_id", callSheetId)
    .in("id", wanted);
  const allowed = new Set((valid ?? []).map((r) => r.id));

  const { data: existing } = await supabase
    .from("meal_responses")
    .select("id, recipient_id")
    .eq("meal_round_id", roundId);
  const have = new Map((existing ?? []).map((r) => [r.recipient_id, r.id]));

  const toAdd = [...allowed].filter((id) => !have.has(id));
  const toRemove = [...have.entries()]
    .filter(([recipientId]) => !allowed.has(recipientId))
    .map(([, rowId]) => rowId);

  if (toAdd.length) {
    const { error } = await supabase.from("meal_responses").insert(
      toAdd.map((recipient_id) => ({
        studio_id: studioId,
        meal_round_id: roundId,
        recipient_id,
      })),
    );
    if (error) return error.message;
  }
  if (toRemove.length) {
    await logWrite(
      "syncRecipients/meal_responses",
      supabase.from("meal_responses").delete().in("id", toRemove),
    );
  }
  return null;
}

export async function deleteMealRound(
  projectId: string,
  roundId: string,
): Promise<MealState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase.from("meal_rounds").delete().eq("id", roundId);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

/** Body shared by the first send and every nudge, so they cannot drift apart. */
function mealEmail(opts: {
  name: string;
  meal: string;
  title: string;
  token: string;
  cutoff: string | null;
  budget: number | null;
  instructions: string | null;
  nudge: boolean;
}) {
  const meal = mealLabel(opts.meal).toLowerCase();
  const lines: string[] = [];
  lines.push(
    opts.nudge
      ? `Hi ${opts.name}, we still need your ${meal} order for ${opts.title}.`
      : `Hi ${opts.name}, here is the ${meal} order for ${opts.title}.`,
  );
  if (opts.cutoff) lines.push(`Orders close at ${opts.cutoff}.`);
  if (opts.budget) lines.push(`Budget is $${opts.budget.toFixed(2)} per person.`);
  if (opts.instructions) lines.push(opts.instructions);
  lines.push("Open the link below to place your order.");

  return renderEmail({
    heading: opts.nudge
      ? `${mealLabel(opts.meal)} order closes soon`
      : `${mealLabel(opts.meal)} order: ${opts.title}`,
    lines,
    ctaLabel: `Order ${meal}`,
    // Deliberately OUR page rather than the ordering platform directly: it is
    // what lets us record the click-through, and it carries the cutoff and the
    // instructions where a forwarded link would carry neither.
    ctaUrl: `${siteOrigin()}/c/${opts.token}`,
    footnote: opts.nudge
      ? "You are getting this because you have not opened the ordering link yet."
      : "You received this because you are on this call sheet.",
  });
}

type SheetBits = { production_title: string | null; title: string | null };

function sheetTitle(sheet: SheetBits | null): string {
  return sheet?.production_title || sheet?.title || "the shoot";
}

/**
 * Send the round to everyone on it who has not already been sent to.
 *
 * Returns counts rather than throwing on a partial failure: with a dozen crew
 * on a shoot morning, one bad address must not stop the other eleven going out.
 */
export async function sendMealRound(
  projectId: string,
  roundId: string,
): Promise<{ sent: number; noEmail: number } | { error: string }> {
  await requireStudioContext();
  if (!emailConfigured()) return { error: "Email is not set up yet." };

  const supabase = createClient();
  const { data: round } = await supabase
    .from("meal_rounds")
    .select("*")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return { error: "That meal round no longer exists." };
  const r = round as MealRound;

  const { data: sheet } = await supabase
    .from("call_sheets")
    .select("title, production_title")
    .eq("id", r.call_sheet_id)
    .maybeSingle();

  const { data: rows } = await supabase
    .from("meal_responses")
    .select("id, recipient:call_sheet_recipients(id, name, email, token)")
    .eq("meal_round_id", roundId);

  const title = sheetTitle(sheet as SheetBits | null);
  const cutoff = cutoffLabel(r.cutoff_at);
  let sent = 0;
  let noEmail = 0;

  for (const row of rows ?? []) {
    const person = row.recipient as unknown as {
      name: string;
      email: string | null;
      token: string;
    } | null;
    if (!person?.email) {
      noEmail++;
      continue;
    }
    const { html, text } = mealEmail({
      name: person.name,
      meal: r.meal,
      title,
      token: person.token,
      cutoff,
      budget: r.budget_per_head === null ? null : Number(r.budget_per_head),
      instructions: r.instructions,
      nudge: false,
    });
    const res = await sendEmail({
      to: person.email,
      subject: `${mealLabel(r.meal)} order${cutoff ? ` (closes ${cutoff})` : ""}: ${title}`,
      html,
      text,
    });
    if (res.ok) sent++;
    else noEmail++;
  }

  await logWrite(
    "sendMealRound/meal_rounds",
    supabase
      .from("meal_rounds")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", roundId),
  );

  rp(projectId);
  return { sent, noEmail };
}

/**
 * Chase everyone on the round who has not opened the link, now.
 *
 * The cron does this on its own inside the window before the cutoff; this is
 * the same nudge on demand. It only ever writes to people who have done
 * nothing, so pressing it twice cannot reach someone who has already ordered.
 */
export async function remindMealRound(
  projectId: string,
  roundId: string,
): Promise<{ sent: number } | { error: string }> {
  await requireStudioContext();
  if (!emailConfigured()) return { error: "Email is not set up yet." };

  const supabase = createClient();
  const { data: round } = await supabase
    .from("meal_rounds")
    .select("*")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return { error: "That meal round no longer exists." };
  const r = round as MealRound;

  const { data: sheet } = await supabase
    .from("call_sheets")
    .select("title, production_title")
    .eq("id", r.call_sheet_id)
    .maybeSingle();

  const { data: rows } = await supabase
    .from("meal_responses")
    .select(
      "id, opened_at, ordered_at, reminder_count, recipient:call_sheet_recipients(name, email, token)",
    )
    .eq("meal_round_id", roundId)
    .lt("reminder_count", MEAL_REMINDER_CAP);

  const title = sheetTitle(sheet as SheetBits | null);
  const cutoff = cutoffLabel(r.cutoff_at);
  let sent = 0;

  for (const row of rows ?? []) {
    if (!needsChasing(row)) continue;
    const person = row.recipient as unknown as {
      name: string;
      email: string | null;
      token: string;
    } | null;
    if (!person?.email) continue;

    const { html, text } = mealEmail({
      name: person.name,
      meal: r.meal,
      title,
      token: person.token,
      cutoff,
      budget: r.budget_per_head === null ? null : Number(r.budget_per_head),
      instructions: r.instructions,
      nudge: true,
    });
    const res = await sendEmail({
      to: person.email,
      subject: `${mealLabel(r.meal)} order closes${cutoff ? ` at ${cutoff}` : " soon"}: ${title}`,
      html,
      text,
    });
    if (res.ok) {
      await supabase
        .from("meal_responses")
        .update({
          last_reminded_at: new Date().toISOString(),
          reminder_count: (row.reminder_count ?? 0) + 1,
        })
        .eq("id", row.id);
      sent++;
    }
  }

  rp(projectId);
  return { sent };
}
