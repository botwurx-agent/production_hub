// The trust boundary between model output and a database row.
//
// Used twice on purpose: once when a card is built (so a bad proposal is
// refused with a sentence rather than shown as a plausible card), and again in
// confirmCard (because the payload travels through the browser and comes back,
// so nothing about it is trusted the second time). One module rather than two
// copies, because two copies of a money parser drift and only one of them gets
// the fix.
//
// No "server-only": these are pure, and being importable is what makes them
// testable.

export function str(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/**
 * Reads a money figure the way a person writes one: "2,500", "$2500", 2500.
 *
 * Returns NULL rather than 0 when there is nothing numeric in it. That
 * distinction is the whole point: "n/a" strips to "" and Number("") is 0, so a
 * figure nobody could read would otherwise land as a real cost of zero dollars,
 * which looks deliberate and reconciles to nothing.
 */
export function amount(v: unknown): number | null {
  const raw = typeof v === "number" ? String(v) : typeof v === "string" ? v : "";
  const digits = raw.replace(/[^0-9.-]/g, "");
  if (!/\d/.test(digits)) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Validates a real calendar day, not just the shape. "2026-02-31" parses
 * happily in JavaScript and rolls forward into March, which would file a cost
 * under the wrong month without anything looking wrong.
 */
export function date(v: unknown): string | null {
  const raw = str(v, 40);
  if (!raw) return null;

  // An ISO timestamp is accepted and its day taken, because every column these
  // feed is a DATE and a model that answers "2026-08-14T00:00:00Z" is not
  // wrong, just verbose. This is done by MATCHING the time suffix rather than
  // by slicing to ten characters: slicing would also have quietly accepted
  // "2026-08-14garbage", which was a real bug here before the parser was
  // tested.
  const s = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})?$/.test(raw)
    ? raw.slice(0, 10)
    : raw;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return s;
}

/** An id shaped like one. The real check is reading the row back under RLS. */
export function uuid(v: unknown): string | null {
  const s = str(v, 40);
  return s && /^[0-9a-f-]{32,40}$/i.test(s) ? s : null;
}

/** A whole positive count, or null. Used for quantities and day counts. */
export function count(v: unknown): number | null {
  const n = amount(v);
  return n && n > 0 ? Math.round(n) : null;
}
