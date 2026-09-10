import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Which studio the user is currently working in, for people who belong to more
 * than one (an agency freelancer on two studios' teams, say).
 *
 * A cookie rather than a column, because this is a per-browser view preference,
 * not an attribute of the account: the same person can reasonably have one
 * studio open on their laptop and another on their phone. It is also only ever
 * a hint. Every read still goes through RLS, so a stale or hand-edited cookie
 * naming a studio the user was removed from grants nothing; getStudioContext
 * simply falls back to a studio they do belong to.
 */
export const ACTIVE_STUDIO_COOKIE = "sf_studio";

export function readActiveStudioId(): string | null {
  return cookies().get(ACTIVE_STUDIO_COOKIE)?.value ?? null;
}

/**
 * Which studio a CONNECTOR should attach an account to (Gmail, Slack, Figma,
 * FreshBooks). Same rule getStudioContext uses, and it has to be: the app
 * decides which studio you are looking at from the cookie, so a callback that
 * picked the oldest membership instead would file the connection against a
 * studio you are not in, on a page that never shows it. You would connect
 * Gmail, land back on Settings, and see no connection at all.
 *
 * The cookie stays a preference rather than a permission: it is honoured only
 * when it names a studio present in the caller's own membership rows, so a
 * stale or hand-edited value falls back instead of granting anything.
 *
 * Returns null when the user belongs to no studio at all.
 */
export async function connectingStudioId(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("memberships")
    .select("studio_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const rows = data ?? [];
  if (rows.length === 0) return null;

  const preferredId = readActiveStudioId();
  const active = rows.find((r) => r.studio_id === preferredId) ?? rows[0];
  return active.studio_id;
}
