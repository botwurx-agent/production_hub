/**
 * Filling a call sheet from the project roster.
 *
 * The producer already typed everyone in once, organized into folders, with
 * positions and phone numbers. Typing them again into the call sheet is the
 * work this removes.
 *
 * THE ROSTER'S FOLDERS ARE ALREADY THE CALL SHEET'S SECTIONS, which is the
 * whole reason this maps cleanly: talent and extras are the cast table, crew
 * and vendors are the crew table, and the client and agency are their own
 * section. A brand manager listed under "Crew" on a document that goes to the
 * whole unit is simply wrong, so they get their own block rather than being
 * filed somewhere convenient.
 */

export const ENTRY_KINDS = ["cast", "crew", "client"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export type RosterContact = {
  id: string;
  name: string;
  role: string | null;
  type: string | null;
  email: string | null;
  phone: string | null;
};

export type ExistingEntry = {
  id: string;
  name: string;
  kind: string;
  contact_id: string | null;
};

/** Which call sheet section a roster folder belongs in. */
export function blockForCategory(type: string | null | undefined): EntryKind {
  switch ((type ?? "crew").toLowerCase()) {
    case "talent":
    case "extras":
      return "cast";
    case "client":
      return "client";
    default:
      // crew, vendor, and anything unrecognised. A vendor on a shoot day (the
      // rental driver, the color house runner) is on the unit, so the crew
      // table is where they belong, and an unknown category is safer there
      // than in front of the client.
      return "crew";
  }
}

/**
 * THE PHONE, NOT THE EMAIL, when both exist.
 *
 * A call sheet's contact column is what somebody reads at 5am when a driver is
 * lost. Email is the fallback for a vendor who only gave one.
 */
export function contactLine(c: RosterContact): string {
  return c.phone?.trim() || c.email?.trim() || "";
}

/** The row this contact would become. `call_time` is deliberately left blank. */
export function entryFromContact(c: RosterContact): {
  name: string;
  role: string;
  contact: string;
  kind: EntryKind;
  contact_id: string;
} {
  return {
    name: c.name.trim(),
    role: c.role?.trim() ?? "",
    contact: contactLine(c),
    kind: blockForCategory(c.type),
    contact_id: c.id,
  };
}

function squash(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Is this person already on the sheet?
 *
 * BY LINK FIRST, THEN BY NAME. The link is exact and survives a rename. The
 * name check exists for everyone added before this feature or typed by hand,
 * and it is what stops the first import from duplicating a whole sheet
 * somebody already filled in. A name match is deliberately allowed to be
 * slightly wrong in the safe direction: skipping a real duplicate is a row the
 * producer adds back, while adding one is a second Amy Taylor on a document
 * that goes to the unit.
 */
export function alreadyOn(entries: ExistingEntry[], c: RosterContact): boolean {
  if (entries.some((e) => e.contact_id && e.contact_id === c.id)) return true;
  const n = squash(c.name);
  return n.length > 0 && entries.some((e) => squash(e.name) === n);
}

export type ImportChoice = {
  contact: RosterContact;
  kind: EntryKind;
  /** Already on the sheet, so it is shown but not offered again. */
  onSheet: boolean;
};

/**
 * What to offer for one section of the sheet, in roster order.
 *
 * Scoped to a single block rather than importing everyone at once, because the
 * button lives on the section you are looking at, and "add my crew" is a
 * different decision from "add the client".
 */
export function importChoices(
  roster: RosterContact[],
  entries: ExistingEntry[],
  kind: EntryKind
): ImportChoice[] {
  return roster
    .filter((c) => c.name.trim() && blockForCategory(c.type) === kind)
    .map((c) => ({ contact: c, kind, onSheet: alreadyOn(entries, c) }));
}

/** Ids to pre-tick: everyone not already on the sheet. */
export function defaultPicks(choices: ImportChoice[]): string[] {
  return choices.filter((c) => !c.onSheet).map((c) => c.contact.id);
}

/** The trust boundary: only ids the server itself loaded for this project. */
export function validContactIds(requested: unknown, roster: RosterContact[]): string[] {
  if (!Array.isArray(requested)) return [];
  const ok = new Set(roster.map((c) => c.id));
  const out: string[] = [];
  for (const r of requested) {
    if (typeof r === "string" && ok.has(r) && !out.includes(r)) out.push(r);
  }
  return out;
}
