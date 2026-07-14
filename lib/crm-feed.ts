import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CrmActivityKind } from "@/lib/database.types";

// A single entry in an account's relationship timeline. Manual activities and
// auto-logged communication (linked email threads) are merged into one stream
// so "what's happened with this company" is one read. Derived entries are
// read-time only (not persisted as activities), so nothing gets duplicated and
// the feed is always fresh.
export type FeedEntry = {
  id: string;
  source: "activity" | "email";
  kind: CrmActivityKind | null;
  title: string;
  body: string | null;
  at: string;
  deletable: boolean;
};

// Kinds that count as real contact (for the "last contact" indicator). System
// stage events (created/won/lost/stage_change) are not contact.
const CONTACT_KINDS: CrmActivityKind[] = ["call", "meeting", "email"];

export async function loadAccountFeed(
  supabase: SupabaseClient<Database>,
  accountId: string
): Promise<{ entries: FeedEntry[]; lastContactAt: string | null }> {
  const [{ data: activities }, { data: threads }] = await Promise.all([
    supabase
      .from("crm_activities")
      .select("id, kind, body, occurred_at")
      .eq("account_id", accountId)
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase
      .from("email_threads")
      .select("id, subject, last_message_at")
      .eq("client_id", accountId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(30),
  ]);

  const entries: FeedEntry[] = [];

  for (const a of activities ?? []) {
    entries.push({
      id: a.id,
      source: "activity",
      kind: a.kind,
      title: "",
      body: a.body,
      at: a.occurred_at,
      deletable: true,
    });
  }

  for (const t of threads ?? []) {
    if (!t.last_message_at) continue; // can't place it in time
    entries.push({
      id: `email:${t.id}`,
      source: "email",
      kind: "email",
      title: t.subject || "(no subject)",
      body: null,
      at: t.last_message_at,
      deletable: false,
    });
  }

  entries.sort((a, b) => b.at.localeCompare(a.at));

  // Last contact = most recent real communication (linked email, or a logged
  // call/meeting/email), ignoring system pipeline events.
  let lastContactAt: string | null = null;
  for (const e of entries) {
    const isContact =
      e.source === "email" ||
      (e.source === "activity" && e.kind != null && CONTACT_KINDS.includes(e.kind));
    if (isContact) {
      lastContactAt = e.at;
      break; // entries are already sorted newest-first
    }
  }

  return { entries: entries.slice(0, 60), lastContactAt };
}
