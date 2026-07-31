/**
 * The marketing site and the app ship from ONE deployment and are told apart by
 * HOST: studio-flows.com serves marketing, app.studio-flows.com serves the app.
 * This module is the single place that decides which a request belongs to, so
 * the rule cannot drift between middleware and components.
 *
 * Marketing pages live at /site internally and are rewritten onto the apex, so
 * the visitor never sees that prefix. The prefix exists because app/page.tsx
 * already owns "/" for the app (it redirects to /dashboard) and two routes
 * cannot claim the same path.
 */

export const MARKETING_ROOT = "/site";

/** Where the app lives, for every marketing link that hands off to it. */
export const APP_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.studio-flows.com";

export const SIGNUP_URL = `${APP_ORIGIN}/signup`;
export const LOGIN_URL = `${APP_ORIGIN}/login`;

/**
 * Public paths the marketing host serves, WITHOUT the /site prefix.
 *
 * An allowlist rather than "rewrite everything", deliberately: the app owns a
 * pile of public routes on shared paths (/r, /rb, /c, /p, /invite, /auth,
 * /api/cron). Blanket-rewriting the apex would turn any of those into a 404 if
 * a link ever reached the wrong host, and Vercel cron hitting the apex would
 * silently stop working. Adding a marketing page means adding it here.
 */
const MARKETING_PATHS = new Set(["/", "/pricing", "/about"]);

/** Prefixes served by marketing, for future section pages (/product/review). */
const MARKETING_PREFIXES = ["/product/", "/for/"];

export function isMarketingHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = host.split(":")[0].toLowerCase();
  // The app owns the app. subdomain. Local and Vercel preview hosts stay on the
  // app so development and preview deploys behave exactly as they do today;
  // marketing is reachable there directly at /site.
  if (name.startsWith("app.")) return false;
  return name === "studio-flows.com" || name.endsWith(".studio-flows.com");
}

export function isMarketingPath(pathname: string): boolean {
  if (MARKETING_PATHS.has(pathname)) return true;
  return MARKETING_PREFIXES.some((p) => pathname.startsWith(p));
}
