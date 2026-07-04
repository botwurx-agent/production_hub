"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { getAccessToken } from "@/lib/gmail";
import {
  listEvents,
  createEvent,
  deleteEvent,
  type GCalEvent,
  type CreateEventInput,
} from "@/lib/googlecalendar";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

async function getGoogleAccount(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry, scope")
    .eq("provider", "google")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

async function calendarToken(): Promise<
  { token: string } | { error: string }
> {
  await requireStudioContext();
  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Google in Settings first." };
  if (!(account.scope ?? "").includes("/auth/calendar")) {
    return { error: "Reconnect Google in Settings to enable Calendar." };
  }
  try {
    return { token: await getAccessToken(supabase, account) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Calendar auth failed." };
  }
}

export async function getCalendarEvents(
  timeMinISO: string,
  timeMaxISO: string
): Promise<{ events: GCalEvent[] } | { error: string }> {
  const t = await calendarToken();
  if ("error" in t) return t;
  try {
    const events = await listEvents(t.token, timeMinISO, timeMaxISO);
    return { events };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not load events." };
  }
}

export async function addCalendarEvent(
  input: CreateEventInput
): Promise<{ event: GCalEvent } | { error: string }> {
  if (!input.title?.trim()) return { error: "Give the event a title." };
  const t = await calendarToken();
  if ("error" in t) return t;
  try {
    const event = await createEvent(t.token, { ...input, title: input.title.trim() });
    return { event };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create event." };
  }
}

export async function removeCalendarEvent(
  eventId: string
): Promise<{ ok: true } | { error: string }> {
  const t = await calendarToken();
  if ("error" in t) return t;
  try {
    await deleteEvent(t.token, eventId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not delete event." };
  }
}
