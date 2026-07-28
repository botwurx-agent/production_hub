import "server-only";
import { headers } from "next/headers";

/**
 * Canonical origin for links we put in emails and share with people outside the
 * app. Prefers the configured site URL, because that is the one stable address
 * (a Vercel preview deployment would otherwise bake its own throwaway hostname
 * into a link that has to keep working). Falls back to the current request host
 * so local development and un-configured deployments still produce a usable
 * link rather than a relative one.
 */
export function siteOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}
