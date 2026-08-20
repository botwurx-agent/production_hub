/**
 * Where the app lives, for every marketing link that hands off to it.
 *
 * These are ABSOLUTE rather than relative on purpose. The marketing site and
 * the app are served by one deployment, so `/signup` would render perfectly
 * well on studio-flows.com, and that is exactly the problem: the session cookie
 * would be set on the apex while NEXT_PUBLIC_SITE_URL, the Supabase Site URL
 * and every confirmation link point at app.studio-flows.com. Sending people to
 * the app host keeps signup, the cookie and the emails on one origin.
 *
 * Routing between the two hosts is NOT decided here. It lives in
 * lib/supabase/middleware.ts, which redirects `/` to the dashboard or login on
 * the app host and leaves the marketing home alone everywhere else.
 */

export const APP_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.studio-flows.com";

export const SIGNUP_URL = `${APP_ORIGIN}/signup`;
export const LOGIN_URL = `${APP_ORIGIN}/login`;
