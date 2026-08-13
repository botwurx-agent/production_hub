// What a binder is made of.
//
// The client project binder came from a producer's own words: bigger clients
// ask to "see it all in one spot", and assembling that by hand costs him four
// to six hours a job. The two things he was emphatic about are the two things
// this file exists to get right.
//
// CUSTOMISABLE, in his sense, means leaving things OUT. His examples were a
// director's notes column and a backup plan for a stunt the client did not
// ask for: both real, both things the studio holds and the client should not
// see. So a binder is a list of choices, and the default for anything new is
// off.
//
// PRINTABLE means the same page a client opens is the page that prints. There
// is no second renderer to drift.
//
// Pure: no database, no client, so the rules are testable.

/** One thing that can go in a binder. */
export type BinderSectionKind =
  | "overview"
  | "call_sheet"
  | "shot_list"
  | "storyboard"
  | "moodboard"
  | "sequence"
  | "elements"
  | "contacts";

export type BinderChoice = {
  /** "shot_list", or "call_sheet:<uuid>" when there can be several. */
  key: string;
  include: boolean;
  /**
   * Drop the internal column from a section that has one.
   *
   * The producer's exact ask: share the shot list without the director's
   * notes. Only meaningful where a section carries notes, and ignored
   * elsewhere rather than hidden, so a stored choice survives a section
   * gaining or losing notes later.
   */
  hideNotes?: boolean;
};

/** A section offered by the builder, derived from what the project holds. */
export type BinderSection = {
  key: string;
  kind: BinderSectionKind;
  /** Null for the kinds a project has exactly one of. */
  targetId: string | null;
  label: string;
  /** What it is, for the builder's list. */
  hint: string;
  /** Whether the "hide notes" toggle applies. */
  hasNotes: boolean;
};

export function sectionKey(kind: BinderSectionKind, targetId?: string | null) {
  return targetId ? `${kind}:${targetId}` : kind;
}

export function parseSectionKey(key: string): {
  kind: string;
  targetId: string | null;
} {
  const i = key.indexOf(":");
  return i < 0
    ? { kind: key, targetId: null }
    : { kind: key.slice(0, i), targetId: key.slice(i + 1) };
}

/**
 * The stored choices, read safely.
 *
 * The column is jsonb written by this app, but it is still parsed rather than
 * trusted: a malformed row should give an empty binder, not a crash on a page
 * a client is looking at.
 */
export function parseChoices(raw: unknown): BinderChoice[] {
  if (!Array.isArray(raw)) return [];
  const out: BinderChoice[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key.slice(0, 120) : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      include: row.include !== false,
      hideNotes: row.hideNotes === true,
    });
  }
  return out.slice(0, 200);
}

/**
 * The sections to render, in order, for a set of choices.
 *
 * Order comes from the STORED list, so a producer who reorders keeps it, and
 * anything the project has gained since is appended for the builder to offer.
 *
 * Only `include` sections come back, and a section whose content has since
 * been deleted simply is not in `available` and so drops out. A binder cannot
 * point at something that no longer exists.
 */
export function resolveSections(
  available: BinderSection[],
  choices: BinderChoice[]
): { section: BinderSection; hideNotes: boolean }[] {
  const byKey = new Map(available.map((s) => [s.key, s]));
  const out: { section: BinderSection; hideNotes: boolean }[] = [];
  for (const choice of choices) {
    if (!choice.include) continue;
    const section = byKey.get(choice.key);
    if (section) out.push({ section, hideNotes: Boolean(choice.hideNotes) });
  }
  return out;
}

/**
 * The builder's list: everything the project offers, each carrying its choice.
 *
 * Anything with no stored choice comes back OFF. That is the safety rule, and
 * it is the reason this is not simply "everything, minus what you unticked": a
 * binder is a link that lives outside the studio, so a call sheet added on
 * Friday must not appear in a binder shared on Monday because nobody said it
 * could.
 */
export function buildChecklist(
  available: BinderSection[],
  choices: BinderChoice[]
): { section: BinderSection; include: boolean; hideNotes: boolean }[] {
  const byKey = new Map(choices.map((c) => [c.key, c]));
  const ordered: BinderSection[] = [];
  const placed = new Set<string>();

  // Stored order first, so a reorder sticks.
  for (const choice of choices) {
    const section = available.find((s) => s.key === choice.key);
    if (section && !placed.has(section.key)) {
      ordered.push(section);
      placed.add(section.key);
    }
  }
  for (const section of available) {
    if (!placed.has(section.key)) ordered.push(section);
  }

  return ordered.map((section) => {
    const choice = byKey.get(section.key);
    return {
      section,
      include: Boolean(choice?.include),
      hideNotes: Boolean(choice?.hideNotes),
    };
  });
}

/** Move one section up or down in the stored order. */
export function reorderChoices(
  checklist: { section: BinderSection; include: boolean; hideNotes: boolean }[],
  key: string,
  direction: -1 | 1
): BinderChoice[] {
  const rows = checklist.map((r) => ({
    key: r.section.key,
    include: r.include,
    hideNotes: r.hideNotes,
  }));
  const i = rows.findIndex((r) => r.key === key);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= rows.length) return rows;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  return rows;
}
