"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import type { Notification } from "@/lib/database.types";

export type NotificationsResult = {
  items: Notification[];
  unread: number;
};

export async function getNotifications(): Promise<NotificationsResult> {
  await requireStudioContext();
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  const items = (data ?? []) as Notification[];
  return { items, unread: items.filter((n) => !n.read_at).length };
}

export async function markNotificationRead(id: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
}

export async function markAllNotificationsRead(): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
}
