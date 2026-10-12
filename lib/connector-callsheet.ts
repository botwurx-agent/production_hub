/**
 * The pure half of the connector's create_call_sheet tool: reading the sheet an
 * assistant sent. NOT `server-only` and free of `@/` imports, so it is unit
 * tested; the assistant's arguments are the trust boundary, the same as in
 * lib/connector-tasks.ts.
 *
 * Times stay AS WRITTEN ("7:00 AM", "0700", "TBD"): the call sheet's time
 * columns are free text on purpose, and rewriting a producer's "6:30a" into
 * another format is a change nobody asked for. A date has to be a real day,
 * since a sheet dated 2026-02-31 reaching the unit is worse than an empty date.
 */

/** People rows per call. Text only, so generous. */
export const MAX_ENTRIES = 80;

export type SheetSection = "cast" | "crew" | "client";

/** The sheet's own columns this tool may fill, all free text except the date. */
export const SHEET_TEXT_FIELDS = [
  "production_title",
  "day_of",
  "crew_call",
  "shoot_call",
  "breakfast",
  "lunch",
  "wrap",
  "location",
  "parking",
  "hospital",
  "weather",
  "sunrise",
  "sunset",
  "company_name",
  "company_address",
  "company_phone",
  "company_website",
  "producer",
  "producer_phone",
  "director",
  "director_phone",
  "pm",
  "pm_phone",
] as const;
export type SheetTextField = (typeof SHEET_TEXT_FIELDS)[number];

/**
 * Carried from the project's previous sheet when not given: the facts that are
 * the same every day of a job. Never the date, the times, the weather or the
 * location, which are facts about ONE day (the duplicate action's rule).
 */
export const CARRIED_FIELDS: readonly SheetTextField[] = [
  "production_title",
  "company_name",
  "company_address",
  "company_phone",
  "company_website",
  "producer",
  "producer_phone",
  "director",
  "director_phone",
  "pm",
  "pm_phone",
];

/** Long fields get more room; the rest are a line on a masthead. */
const FIELD_MAX: Partial<Record<SheetTextField, number>> = {
  location: 300,
  parking: 300,
  hospital: 300,
  company_address: 200,
  weather: 120,
};

export type SheetFields = {
  title: string;
  shootDate: string | null;
  notes: string | null;
  text: Partial<Record<SheetTextField, string>>;
};

export type SheetEntry = {
  name: string;
  role: string;
  callTime: string;
  contact: string;
  section: SheetSection | null;
  contactId: string | null;
};

const SECTION_WORDS: Record<string, SheetSection> = {
  cast: "cast",
  talent: "cast",
  actor: "cast",
  actors: "cast",
  model: "cast",
  models: "cast",
  extras: "cast",
  extra: "cast",
  background: "cast",
  crew: "crew",
  vendor: "crew",
  vendors: "crew",
  client: "client",
  clients: "client",
  agency: "client",
};

function str(v: unknown, max: number): string {
  if (typeof v === "number" && Number.isFinite(v)) v = String(v);
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function oneLine(v: unknown, max: number): string {
  return str(v, max * 2).replace(/\s+/g, " ").slice(0, max);
}

/** A real calendar day, so 2026-02-31 is refused rather than rolled into March. */
export function realDate(v: unknown): string | null {
  const m = str(v, 40).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
    ? `${m[1]}-${m[2]}-${m[3]}`
    : null;
}

/** A section word as a producer says it, or null when it is not one. */
export function sectionOf(v: unknown): SheetSection | null {
  const w = str(v, 40).toLowerCase().replace(/[^a-z]/g, "");
  return w ? SECTION_WORDS[w] ?? null : null;
}

export function parseSheetFields(args: Record<string, unknown>): { fields: SheetFields; skipped: string[] } {
  const skipped: string[] = [];
  const rawDate = str(args.shoot_date, 40);
  const shootDate = realDate(rawDate);
  if (rawDate && !shootDate) skipped.push(`The shoot date "${rawDate}" was not a real YYYY-MM-DD date; left blank.`);
  const text: Partial<Record<SheetTextField, string>> = {};
  for (const f of SHEET_TEXT_FIELDS) {
    const v = oneLine(args[f], FIELD_MAX[f] ?? 80);
    if (v) text[f] = v;
  }
  return {
    fields: {
      title: oneLine(args.title, 120) || "Call sheet",
      shootDate,
      notes: str(args.notes, 4000) || null,
      text,
    },
    skipped,
  };
}

/** True when any of the sheet's own fields was given (ignored on an existing sheet). */
export function hasSheetFields(args: Record<string, unknown>): boolean {
  return ["title", "shoot_date", "notes", ...SHEET_TEXT_FIELDS].some((f) => str(args[f], 10) !== "");
}

export function parseEntries(raw: unknown): { entries: SheetEntry[]; skipped: string[] } {
  const entries: SheetEntry[] = [];
  const skipped: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const [i, item] of list.entries()) {
    const n = i + 1;
    if (entries.length >= MAX_ENTRIES) {
      skipped.push(`Person ${n}: over the ${MAX_ENTRIES} per call limit, add them in another call.`);
      continue;
    }
    const o: Record<string, unknown> =
      typeof item === "string" ? { name: item } : item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const contactId = str(o.contact_id, 60);
    const validId = /^[0-9a-f-]{36}$/i.test(contactId) ? contactId : null;
    if (contactId && !validId) skipped.push(`Person ${n}: "${contactId}" is not a contact id; added from the details given.`);
    const name = oneLine(o.name, 120);
    if (!name && !validId) {
      skipped.push(`Person ${n}: no name and no contact id.`);
      continue;
    }
    let section: SheetSection | null = null;
    if (str(o.section, 40)) {
      section = sectionOf(o.section);
      if (!section) skipped.push(`${name || `Person ${n}`}: "${str(o.section, 40)}" is not cast, crew or client; placed by their roster category, else crew.`);
    }
    entries.push({
      name,
      role: oneLine(o.role, 80),
      callTime: oneLine(o.call_time, 40),
      contact: oneLine(o.contact, 120),
      section,
      contactId: validId,
    });
  }
  return { entries, skipped };
}

/** Which roster sections to pull everyone from: "all", one word, or a list. */
export function rosterSections(v: unknown): { sections: SheetSection[]; skipped: string[] } {
  const skipped: string[] = [];
  if (v === true) return { sections: ["cast", "crew", "client"], skipped };
  const words = Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v] : [];
  const out: SheetSection[] = [];
  for (const w of words) {
    if (str(w, 20).toLowerCase() === "all") return { sections: ["cast", "crew", "client"], skipped };
    const s = sectionOf(w);
    if (s) {
      if (!out.includes(s)) out.push(s);
    } else skipped.push(`from_roster: "${str(w, 40)}" is not cast, crew or client; ignored.`);
  }
  return { sections: out, skipped };
}
