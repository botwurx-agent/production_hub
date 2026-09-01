import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { reportError } from "@/lib/log";

/**
 * Tie a signed-in account to the roster entry that already describes them.
 *
 * THE MOMENT THIS MATTERS is when someone accepts a project invite. The
 * producer has usually already put them on the crew list ("Amy Taylor, Prop
 * Stylist, amy@..."), and the invite goes to the same address, so the two rows
 * describe one person and nothing joined them. Linking here means a mention
 * reaches their bell as well as their inbox, and that their real name appears
 * as the author of their own comments instead of an email prefix.
 *
 * MATCHED ON EMAIL, CASE-INSENSITIVELY, and only ever within the one project
 * being joined. That is a deliberately narrow claim: the address is the same
 * one the invite was sent to and accepted from, so it is already established
 * that this account controls it.
 *
 * NEVER OVERWRITES an existing link. If a roster entry already points at
 * somebody, a second person accepting with a similar address must not silently
 * take it over, which would misattribute their comments.
 *
 * Best effort throughout: failing to link is a missed convenience, and it must
 * never be the reason an invite acceptance fails.
 */
export async function linkContactToUser(
  supabase: SupabaseClient<Database>,
  projectId: string,
  userId: string,
  email: string | null | undefined
): Promise<void> {
  const addr = email?.trim().toLowerCase();
  if (!addr) return;
  try {
    const { data } = await supabase
      .from("contacts")
      .select("id, email, user_id")
      .eq("project_id", projectId);
    const match = (data ?? []).find(
      (c) => c.email?.trim().toLowerCase() === addr && !c.user_id
    );
    if (!match) return;
    await supabase.from("contacts").update({ user_id: userId }).eq("id", match.id);
  } catch (e) {
    reportError("linkContactToUser", e);
  }
}
