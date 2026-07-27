"use client";

// A random per-browser id for an anonymous review visitor. It is what lets a
// reviewer edit or delete their own comment, and see which reactions are
// theirs, without a login. Stored as a cookie rather than localStorage so the
// server render can read it too and mark reactions as "mine" on first paint.
const COOKIE = "sf_rk";
const YEAR = 60 * 60 * 24 * 365;

export function reviewerKey(): string {
  if (typeof document === "undefined") return "";
  const hit = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (hit) return decodeURIComponent(hit.slice(COOKIE.length + 1));

  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  document.cookie = `${COOKIE}=${encodeURIComponent(key)}; path=/; max-age=${YEAR}; SameSite=Lax`;
  return key;
}
