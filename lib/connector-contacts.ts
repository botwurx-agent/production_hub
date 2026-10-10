/**
 * The pure half of the connector's add_contacts tool: reading the people an
 * assistant sent. NOT `server-only` and free of `@/` imports, so it is unit
 * tested; the assistant's arguments are the trust boundary, the same as in
 * lib/connector-tasks.ts.
 *
 * Anything unreadable is NAMED in `skipped` rather than silently dropped or
 * silently guessed. A person with an unreadable rate is still added, without
 * the rate, since a missing rate is one field to fill and a missing person is
 * somebody nobody calls.
 */

/** People per call, new and copied together. */
export const MAX_CONTACTS = 40;
/** A day rate above this is a misread (a job total, a typo), never a rate. */
const MAX_DAY_RATE = 100_000;

export type ContactCategoryKey = "crew" | "talent" | "extras" | "vendor" | "client";

export type NewContact = {
  name: string;
  category: ContactCategoryKey;
  position: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  dayRate: number | null;
};

export type CopyRequest = {
  contactId: string;
  /** Overrides; null means "keep what the source has". */
  category: ContactCategoryKey | null;
  position: string | null;
  dayRate: number | null;
};

const CATEGORY_WORDS: Record<string, ContactCategoryKey> = {
  crew: "crew",
  talent: "talent",
  cast: "talent",
  actor: "talent",
  actors: "talent",
  model: "talent",
  models: "talent",
  extra: "extras",
  extras: "extras",
  background: "extras",
  vendor: "vendor",
  vendors: "vendor",
  supplier: "vendor",
  rental: "vendor",
  rentals: "vendor",
  client: "client",
  clients: "client",
  agency: "client",
};

function str(v: unknown, max: number): string {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function oneLine(v: unknown, max: number): string | null {
  return str(v, max * 2).replace(/\s+/g, " ").slice(0, max) || null;
}

/** A category word as a producer says it, or null when it is not one. */
export function categoryOf(v: unknown): ContactCategoryKey | null {
  const w = str(v, 40).toLowerCase().replace(/[^a-z]/g, "");
  return w ? CATEGORY_WORDS[w] ?? null : null;
}

/**
 * A day rate from "$1,200", "1200/day", "1.2k per day" or a plain number.
 * `ok: false` is a rate that was given and could not be read, which the
 * caller reports; "n/a" is that case, never $0.
 */
export function dayRateOf(v: unknown): { ok: true; value: number | null } | { ok: false } {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v === "number") {
    return Number.isFinite(v) && v > 0 && v <= MAX_DAY_RATE
      ? { ok: true, value: Math.round(v * 100) / 100 }
      : { ok: false };
  }
  const s = str(v, 60)
    .toLowerCase()
    .replace(/[$,\s]/g, "")
    .replace(/(usd)?(\/day|perday|aday|\/d|daily)?\.?$/, "");
  if (!s) return { ok: true, value: null };
  const m = /^(\d+(?:\.\d+)?)(k)?$/.exec(s);
  if (!m) return { ok: false };
  let n = Number(m[1]);
  if (m[2] === "k") n *= 1_000;
  if (!Number.isFinite(n) || n <= 0 || n > MAX_DAY_RATE) return { ok: false };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

/** Lower-cased and trimmed, or null when it does not look like an address. */
export function emailOf(v: unknown): string | null {
  const s = str(v, 200).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

/** How a person is recognised as already on a project: email, else name. */
export function personKey(p: { name: string; email: string | null }): string {
  return p.email ? `e:${p.email.toLowerCase()}` : `n:${p.name.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export function parseNewContacts(raw: unknown): { contacts: NewContact[]; skipped: string[] } {
  const contacts: NewContact[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const [i, item] of list.entries()) {
    const n = i + 1;
    if (contacts.length >= MAX_CONTACTS) {
      skipped.push(`Person ${n}: over the ${MAX_CONTACTS} per call limit, send them in another call.`);
      continue;
    }
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const name = oneLine(o.name, 120);
    if (!name) {
      skipped.push(`Person ${n}: no name.`);
      continue;
    }

    let category: ContactCategoryKey = "crew";
    if (str(o.category, 40)) {
      const c = categoryOf(o.category);
      if (c) category = c;
      else skipped.push(`${name}: "${str(o.category, 40)}" is not crew, talent, extras, vendor or client; added as crew.`);
    }

    const rawEmail = str(o.email, 200);
    const email = emailOf(rawEmail);
    if (rawEmail && !email) skipped.push(`${name}: "${rawEmail}" is not an email address; added without one.`);

    const rate = dayRateOf(o.day_rate);
    if (!rate.ok) skipped.push(`${name}: the day rate "${str(o.day_rate, 60)}" could not be read; added without a rate.`);

    contacts.push({
      name,
      category,
      position: oneLine(o.position, 80),
      company: oneLine(o.company, 120),
      email,
      phone: oneLine(o.phone, 40),
      notes: str(o.notes, 2000) || null,
      dayRate: rate.ok ? rate.value : null,
    });
  }
  return { contacts, skipped };
}

export function parseCopies(raw: unknown): { copies: CopyRequest[]; skipped: string[] } {
  const copies: CopyRequest[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  const list = Array.isArray(raw) ? raw : [];
  for (const [i, item] of list.entries()) {
    const n = i + 1;
    // A bare id is the commonest way to name somebody to copy.
    const o: Record<string, unknown> =
      typeof item === "string" ? { contact_id: item } : item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const contactId = str(o.contact_id, 60);
    if (!/^[0-9a-f-]{36}$/i.test(contactId)) {
      skipped.push(`Copy ${n}: no contact id; find people with query on contacts first.`);
      continue;
    }
    if (seen.has(contactId)) continue;
    seen.add(contactId);
    if (copies.length >= MAX_CONTACTS) {
      skipped.push(`Copy ${n}: over the ${MAX_CONTACTS} per call limit, send them in another call.`);
      continue;
    }
    let category: ContactCategoryKey | null = null;
    if (str(o.category, 40)) {
      category = categoryOf(o.category);
      if (!category) skipped.push(`Copy ${n}: "${str(o.category, 40)}" is not a category; kept the one they had.`);
    }
    const rate = dayRateOf(o.day_rate);
    if (!rate.ok) skipped.push(`Copy ${n}: the day rate "${str(o.day_rate, 60)}" could not be read; kept the rate they had.`);
    copies.push({
      contactId,
      category,
      position: oneLine(o.position, 80),
      dayRate: rate.ok ? rate.value : null,
    });
  }
  return { copies, skipped };
}
