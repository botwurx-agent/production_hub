// Spotting "this is really a new version of an existing file" from the name.
// A new cut uploaded as its own file ("Spot v2") breaks the version spine: the
// history splits, the client gets a second link, and the feedback on v1 sits
// next to nothing. Catching it at naming time is far cheaper than merging later.
//
// The match is deliberately STRICT (exact base-name equality after stripping a
// trailing version token). A wrong suggestion is worse than no suggestion: it
// trains people to dismiss the banner, and an accepted wrong one buries a file
// under an unrelated parent. Names that miss are handled by the merge tool.

const EXTENSION = /\.[a-z0-9]{2,4}$/i;
const VERSION_SUFFIX = /\s*\(?\s*(?:v|ver|version|rev|r)\s*\.?\s*\d{1,3}\s*\)?$/i;
const COUNTER_SUFFIX = /\s*\(\s*\d{1,3}\s*\)$/;
const WORD_SUFFIX = /\s*(?:copy|final)$/i;

// The name with any trailing version token removed, normalized for comparison.
export function baseAssetName(name: string): string {
  return name
    .replace(EXTENSION, "")
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(VERSION_SUFFIX, "")
    .replace(COUNTER_SUFFIX, "")
    .replace(WORD_SUFFIX, "")
    .trim();
}

// True when the name actually carried a version-ish suffix, so an identical
// name (no suffix) never reads as "a new version of itself".
export function hasVersionSuffix(name: string): boolean {
  const cleaned = name
    .replace(EXTENSION, "")
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return baseAssetName(name) !== cleaned;
}

export type NameCandidate = { id: string; name: string };

// The existing file this name looks like a new version of, or null.
export function findVersionParent<T extends NameCandidate>(
  typed: string,
  existing: T[]
): T | null {
  const name = typed.trim();
  if (!name || !hasVersionSuffix(name)) return null;
  const base = baseAssetName(name);
  if (base.length < 3) return null;
  return (
    existing.find(
      (e) =>
        baseAssetName(e.name) === base &&
        e.name.trim().toLowerCase() !== name.toLowerCase()
    ) ?? null
  );
}
