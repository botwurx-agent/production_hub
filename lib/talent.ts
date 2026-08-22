// Talent profile: the model behind contact_profiles (migration 0091).
//
// Pure and dependency-free on purpose, so the parsing can be unit tested
// without a database. No "server-only" here for the same reason.

import type { ContactCategory } from "@/lib/crew-positions";

export type Wardrobe = Record<string, string>;

export type TalentProfile = {
  creditedAs: string | null;
  pronouns: string | null;
  website: string | null;
  agentName: string | null;
  agentEmail: string | null;
  agentPhone: string | null;
  unionStatus: string | null;
  dietaryRestrictions: string | null;
  allergies: string | null;
  dietaryNotes: string | null;
  wardrobe: Wardrobe;
  headshotPath: string | null;
};

export const EMPTY_PROFILE: TalentProfile = {
  creditedAs: null,
  pronouns: null,
  website: null,
  agentName: null,
  agentEmail: null,
  agentPhone: null,
  unionStatus: null,
  dietaryRestrictions: null,
  allergies: null,
  dietaryNotes: null,
  wardrobe: {},
  headshotPath: null,
};

/**
 * The measurements a wardrobe department actually asks for.
 *
 * VALUES ARE STRINGS, always. A hat is 7 3/4, a shoe is 10.5 or 44 depending on
 * which side of the Atlantic you are on, a shirt is 15/34 and a dress is an 8.
 * Storing any of that as a number either loses it or invents a precision that
 * was never measured, and nothing here is ever summed or sorted.
 *
 * Grouped because a fitting is read in this order, and because seventeen
 * ungrouped boxes is a form nobody finishes.
 */
export const WARDROBE_GROUPS = [
  { key: "body", label: "Body" },
  { key: "garments", label: "Garments" },
] as const;

export type WardrobeGroup = (typeof WARDROBE_GROUPS)[number]["key"];

export const WARDROBE_FIELDS: {
  key: string;
  label: string;
  group: WardrobeGroup;
  hint?: string;
}[] = [
  { key: "height", label: "Height", group: "body", hint: "6'1\"" },
  { key: "weight", label: "Weight", group: "body", hint: "180 lb" },
  { key: "head", label: "Head", group: "body", hint: "7 3/4" },
  { key: "neck", label: "Neck", group: "body", hint: '15"' },
  { key: "chest", label: "Chest / bust", group: "body", hint: '44"' },
  { key: "waist", label: "Waist", group: "body", hint: '36"' },
  { key: "hips", label: "Hips", group: "body", hint: '38"' },
  { key: "inseam", label: "Inseam", group: "body", hint: '32"' },
  { key: "sleeve", label: "Sleeve", group: "body", hint: '34"' },
  { key: "shirt", label: "Shirt", group: "garments", hint: "15 / 34" },
  { key: "jacket", label: "Jacket / suit", group: "garments", hint: "42R" },
  { key: "pants", label: "Pants", group: "garments", hint: "36 x 32" },
  { key: "dress", label: "Dress", group: "garments", hint: "8" },
  { key: "shoe", label: "Shoe", group: "garments", hint: "10.5" },
  { key: "glove", label: "Glove", group: "garments", hint: "M" },
  { key: "hat", label: "Hat", group: "garments", hint: "L" },
];

const WARDROBE_KEYS = new Set(WARDROBE_FIELDS.map((f) => f.key));
const MAX_VALUE = 40;

/**
 * jsonb comes back as `unknown`, and this is the boundary between it and the
 * page. Whitelists the key against WARDROBE_FIELDS so a column that was renamed
 * in code cannot resurrect stale data under a label that no longer means the
 * same thing, coerces numbers to strings (a 36 typed into "waist" arrives as a
 * number through some clients), trims, drops empties, and caps the length so a
 * paste accident cannot stretch a table cell to the horizon.
 */
export function parseWardrobe(raw: unknown): Wardrobe {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Wardrobe = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!WARDROBE_KEYS.has(k)) continue;
    const s = typeof v === "number" && Number.isFinite(v) ? String(v) : typeof v === "string" ? v : "";
    const t = s.trim().slice(0, MAX_VALUE);
    if (t) out[k] = t;
  }
  return out;
}

/** Filled measurements, in the order a fitting reads them. */
export function wardrobeEntries(w: Wardrobe): { key: string; label: string; value: string }[] {
  return WARDROBE_FIELDS.filter((f) => w[f.key]).map((f) => ({
    key: f.key,
    label: f.label,
    value: w[f.key],
  }));
}

export function hasWardrobe(w: Wardrobe): boolean {
  return Object.keys(w).length > 0;
}

/**
 * Wardrobe is asked for on the people who get dressed by the production.
 *
 * Crew are not on this list on purpose. A gaffer's inseam is not the studio's
 * business, and a form that asks for it reads as a company that collects
 * whatever it can rather than what it needs.
 */
export function wantsWardrobe(category: ContactCategory | string | null): boolean {
  return category === "talent" || category === "extras";
}

/** Representation and billing name only make sense for people being booked. */
export function wantsRepresentation(category: ContactCategory | string | null): boolean {
  return category === "talent" || category === "extras";
}

export function hasDietary(p: {
  dietaryRestrictions: string | null;
  allergies: string | null;
  dietaryNotes: string | null;
}): boolean {
  return Boolean(p.dietaryRestrictions || p.allergies || p.dietaryNotes);
}

/**
 * One line for catering, allergies FIRST.
 *
 * The ordering is the whole point of this function rather than the caller
 * joining three fields: a restriction is a preference and an allergy is a
 * hospital visit, so on a line that might get truncated in a table cell or an
 * email, the allergy has to be the part that survives.
 */
export function dietarySummary(p: {
  dietaryRestrictions: string | null;
  allergies: string | null;
  dietaryNotes: string | null;
}): string | null {
  const parts: string[] = [];
  if (p.allergies?.trim()) parts.push(`Allergic to ${p.allergies.trim()}`);
  if (p.dietaryRestrictions?.trim()) parts.push(p.dietaryRestrictions.trim());
  if (p.dietaryNotes?.trim()) parts.push(p.dietaryNotes.trim());
  return parts.length ? parts.join(". ") : null;
}

/** True when a profile holds nothing worth showing, so the UI can stay quiet. */
export function isProfileEmpty(p: TalentProfile): boolean {
  return (
    !p.creditedAs &&
    !p.pronouns &&
    !p.website &&
    !p.agentName &&
    !p.agentEmail &&
    !p.agentPhone &&
    !p.unionStatus &&
    !hasDietary(p) &&
    !hasWardrobe(p.wardrobe) &&
    !p.headshotPath
  );
}

/** DB row (snake_case, jsonb) to the shape the app uses. */
export function toProfile(row: Record<string, unknown> | null | undefined): TalentProfile {
  if (!row) return { ...EMPTY_PROFILE, wardrobe: {} };
  const s = (k: string): string | null => {
    const v = row[k];
    return typeof v === "string" && v.trim() ? v : null;
  };
  return {
    creditedAs: s("credited_as"),
    pronouns: s("pronouns"),
    website: s("website"),
    agentName: s("agent_name"),
    agentEmail: s("agent_email"),
    agentPhone: s("agent_phone"),
    unionStatus: s("union_status"),
    dietaryRestrictions: s("dietary_restrictions"),
    allergies: s("allergies"),
    dietaryNotes: s("dietary_notes"),
    wardrobe: parseWardrobe(row["wardrobe"]),
    headshotPath: s("headshot_path"),
  };
}
