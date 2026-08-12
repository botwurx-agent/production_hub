/**
 * A human name guessed from a file name.
 *
 * Used when filing a folder of images as elements, where typing twenty-one
 * names is the work being removed. A file the operator named ("maya-wardrobe
 * scene1.png") should fill itself in; a file the generator named
 * ("hf_20260721_185514_696ebc3e-e945-4302-958f-143bb5b141d6.png") must NOT,
 * because a prefilled field is trusted and the result would be twenty-one
 * elements called hf_20260721.
 *
 * So it returns null when what remains is machine noise, and the caller makes
 * that row ask for a name. Failing to guess is cheap; guessing wrong is not.
 *
 * Pure, and unit tested.
 */

/** Generator prefixes worth stripping before judging what is left. */
const NOISE = [
  /^hf[_-]/i, // Higgsfield
  /^(img|image|screenshot|photo|render|out|output|final)[_-]/i,
  /^(dall[_-]?e|midjourney|mj|sora|runway|kling|luma|pika)[_-]/i,
];

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
/** A long hex run, which is a hash rather than a word. */
const HEX = /\b[0-9a-f]{8,}\b/gi;
/** A date or time stamp: 20260721, 185514, 2026-07-21. */
const STAMP = /\b\d{4}-?\d{2}-?\d{2}\b|\b\d{6,}\b/g;

export function nameFromFilename(filename: string): string | null {
  let s = filename.replace(/\.[a-z0-9]{1,5}$/i, "");

  // Order matters. The generator prefixes are stripped first, while their own
  // separator is still there to anchor them. Then underscores and dots become
  // spaces, WITHOUT touching hyphens, so the stamps and hashes that follow are
  // space-delimited and \b can find them: an underscore is a word character,
  // so `hf_20260721_696ebc3e-...` matched none of these patterns until the
  // underscores were gone, and the whole hash survived as the guessed name.
  //
  // Hyphens are kept because this domain codes with them (LOC-01B, WD-10), and
  // a preserved hyphen in "Maya-Wardrobe" is a smaller cost than shredding a
  // location code.
  for (const re of NOISE) s = s.replace(re, " ");
  s = s.replace(/[_.]+/g, " ");
  s = s.replace(UUID, " ").replace(HEX, " ").replace(STAMP, " ");

  s = s.replace(/\s+/g, " ").trim();

  // A trailing copy marker is noise, not part of the name.
  s = s.replace(/\s*\(\d+\)$/, "").replace(/\s+copy( \d+)?$/i, "").trim();

  // At least one survivor has to read as a word rather than a leftover
  // fragment, two letters being a real name ("AJ") and one a stray initial off
  // a stripped hash. This is a GATE, not a filter: once it passes, the whole
  // cleaned string is the name, because rebuilding it from the qualifying
  // words alone silently ate the number in "Maya Wardrobe Scene 1".
  if (!s.split(" ").some((w) => /[a-z]{2,}/i.test(w))) return null;

  const out = s.slice(0, 80);
  // Capitalise only an all-lowercase guess: "maya wardrobe" becomes "Maya
  // Wardrobe", while "LOC-01B morning" keeps the casing it was given.
  return out === out.toLowerCase()
    ? out.replace(/\b[a-z]/g, (c) => c.toUpperCase())
    : out;
}
