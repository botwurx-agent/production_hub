import "server-only";
import { cookies } from "next/headers";

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
