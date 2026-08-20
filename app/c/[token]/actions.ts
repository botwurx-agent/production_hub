"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { allowPublic } from "@/lib/rate-limit";
import { getCallSheetRecipient } from "@/lib/callsheet-links";
import { createNotification } from "@/lib/notifications";
import { logWrite } from "@/lib/log";

export type ConfirmState = { error?: string } | null;

// Record that a recipient opened their call sheet (fire-and-forget from the
// public page). Only sets viewed_at the first time.
export async function recordCallSheetView(token: string): Promise<void> {
  // A generous view cap: blunts refresh-driven view-count inflation without
  // affecting a normal recipient (viewed_at is only set once anyway).
  if (!allowPublic("c-view", 30)) return;
  if (!serviceConfigured()) return;
  const service = createServiceClient();
  const recipient = await getCallSheetRecipient(service, token);
  if (!recipient || recipient.viewed_at) return;
  await logWrite(
    "recordCallSheetView/call_sheet_recipients",
    service
      .from("call_sheet_recipients")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", recipient.id)
  );
}

/**
 * Record that this recipient clicked through to the ordering platform.
 *
 * This is the honest signal the whole feature rests on: the platform will never
 * tell us whether an order was completed, but a click-through needs nothing
 * from the crew member and is enough to stop chasing them.
 *
 * The round id is validated against a meal_responses row for THIS token, so a
 * guessed id cannot mark someone else's order as handled.
 */
export async function recordMealOpen(
  token: string,
  roundId: string
): Promise<void> {
  if (!allowPublic("c-meal-open", 30)) return;
  if (!serviceConfigured()) return;
  const service = createServiceClient();
  const recipient = await getCallSheetRecipient(service, token);
  if (!recipient) return;

  const { data: row } = await service
    .from("meal_responses")
    .select("id, opened_at")
    .eq("meal_round_id", roundId)
    .eq("recipient_id", recipient.id)
    .maybeSingle();
  if (!row || row.opened_at) return;

  await logWrite(
    "recordMealOpen/meal_responses",
    service
      .from("meal_responses")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", row.id)
  );
}

/** The crew member says they have ordered, for anyone ordering off a forward. */
export async function markMealOrdered(
  token: string,
  roundId: string
): Promise<ConfirmState> {
  if (!allowPublic("c-meal-ordered"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "This link is not available." };
  const service = createServiceClient();
  const recipient = await getCallSheetRecipient(service, token);
  if (!recipient) return { error: "This link is no longer active." };

  const { data: row } = await service
    .from("meal_responses")
    .select("id, opened_at")
    .eq("meal_round_id", roundId)
    .eq("recipient_id", recipient.id)
    .maybeSingle();
  if (!row) return { error: "You are not on this order." };

  const now = new Date().toISOString();
  const { error } = await service
    .from("meal_responses")
    .update({ ordered_at: now, opened_at: row.opened_at ?? now })
    .eq("id", row.id);
  if (error) return { error: error.message };

  revalidatePath(`/c/${token}`);
  return null;
}

// Recipient confirms they'll be there.
export async function confirmCallSheet(token: string): Promise<ConfirmState> {
  if (!allowPublic("c-confirm"))
    return { error: "Too many requests. Please wait a moment and try again." };
  if (!serviceConfigured()) return { error: "This link is not available." };
  const service = createServiceClient();
  const recipient = await getCallSheetRecipient(service, token);
  if (!recipient) return { error: "This link is no longer active." };

  const now = new Date().toISOString();
  const { error } = await service
    .from("call_sheet_recipients")
    .update({ confirmed_at: now, viewed_at: recipient.viewed_at ?? now })
    .eq("id", recipient.id);
  if (error) return { error: error.message };

  // Notify the studio.
  const { data: sheet } = await service
    .from("call_sheets")
    .select("project_id, title")
    .eq("id", recipient.call_sheet_id)
    .maybeSingle();
  if (sheet) {
    await logWrite(
      "confirmCallSheet/activity",
      service.from("activity").insert({
        studio_id: recipient.studio_id,
        project_id: sheet.project_id,
        type: "activity",
        content: `${recipient.name} confirmed the call sheet`,
      })
    );
    await createNotification(service, {
      studio_id: recipient.studio_id,
      project_id: sheet.project_id,
      type: "callsheet_confirmed",
      title: `${recipient.name} confirmed the call sheet`,
      href: `/projects/${sheet.project_id}/callsheet`,
    });
    revalidatePath(`/projects/${sheet.project_id}/callsheet`);
  }

  revalidatePath(`/c/${token}`);
  return null;
}
