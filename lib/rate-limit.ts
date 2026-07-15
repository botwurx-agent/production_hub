import "server-only";
import { headers } from "next/headers";

// Best-effort, in-memory rate limiter for the public (no-login) token routes.
// Serverless instances are ephemeral and may run in parallel, so this throttles
// a single warm instance rather than guaranteeing a global limit: it is a spam
// speed-bump, not a hard security control. Token entropy (192-bit) already makes
// enumeration impractical; this just blunts comment/view flooding. Back it with
// Upstash / Vercel KV if a hard, shared limit is ever needed.

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function clientIp(): string {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

// Returns true if the action is allowed, false if the caller is over the limit.
export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.reset) {
    // Opportunistic cleanup so the map cannot grow without bound.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now >= v.reset) buckets.delete(k);
    }
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

// Convenience for the public token routes: throttle by IP + action name.
export function allowPublic(action: string, max = 20, windowMs = 60_000): boolean {
  return allow(`${action}:${clientIp()}`, max, windowMs);
}
