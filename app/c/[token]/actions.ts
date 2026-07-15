"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { allowPublic } from "@/lib/rate-limit";
import { getCallSheetRecipient } from "@/lib/callsheet-links";
import { createNotification } from "@/lib/notifications";

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
  await service
    .from("call_sheet_recipients")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", recipient.id);
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
    await service.from("activity").insert({
      studio_id: recipient.studio_id,
      project_id: sheet.project_id,
      type: "activity",
      content: `${recipient.name} confirmed the call sheet`,
    });
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
