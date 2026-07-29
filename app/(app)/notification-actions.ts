"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import type { Notification } from "@/lib/database.types";

export type NotificationsResult = {
  items: Notification[];
  unread: number;
};

const LIMIT = 30;

/**
 * A notification is a studio-wide broadcast, but "have I seen this" is personal
 * (migration 0073). So the rows come from `notifications` and the read state
 * comes from THIS user's rows in `notification_reads`.
 *
 * The per-user value is written into each item's `read_at`, which is the field
 * the bell already renders, so the component needs no knowledge of any of this.
 * The `notifications.read_at` COLUMN is retired and deliberately ignored.
 */
export async function getNotifications(): Promise<NotificationsResult> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  const rows = (data ?? []) as Notification[];
  if (rows.length === 0) return { items: [], unread: 0 };

  // Two queries and a join in code rather than one clever query: PostgREST
  // cannot express "left join my reads and keep the unmatched rows", and at
  // thirty notifications the difference is not worth the contortion.
  const { data: reads } = await supabase
    .from("notification_reads")
    .select("notification_id, read_at")
    .eq("user_id", ctx.userId)
    .in(
      "notification_id",
      rows.map((n) => n.id)
    );

  const readAt = new Map<string, string>();
  for (const r of reads ?? []) readAt.set(r.notification_id, r.read_at);

  const items = rows.map((n) => ({ ...n, read_at: readAt.get(n.id) ?? null }));
  return { items, unread: items.filter((n) => !n.read_at).length };
}

export async function markNotificationRead(id: string): Promise<void> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  // Upsert on the (notification_id, user_id) unique constraint, so opening the
  // same notification twice is a no-op rather than a duplicate-key error.
  const { error } = await supabase.from("notification_reads").upsert(
    {
      studio_id: ctx.studio.id,
      notification_id: id,
      user_id: ctx.userId,
      read_at: new Date().toISOString(),
    },
    { onConflict: "notification_id,user_id", ignoreDuplicates: true }
  );
  if (error) reportError("markNotificationRead", error);
}

export async function markAllNotificationsRead(): Promise<void> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  // Only the notifications actually on screen are marked, matching what the
  // button appears to do. Marking the studio's whole history read because
  // someone cleared a badge would silently bury things they never saw.
  const { data } = await supabase
    .from("notifications")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  const rows = data ?? [];
  if (rows.length === 0) return;

  const now = new Date().toISOString();
  const { error } = await supabase.from("notification_reads").upsert(
    rows.map((n) => ({
      studio_id: ctx.studio.id,
      notification_id: n.id,
      user_id: ctx.userId,
      read_at: now,
    })),
    { onConflict: "notification_id,user_id", ignoreDuplicates: true }
  );
  if (error) reportError("markAllNotificationsRead", error);
}
