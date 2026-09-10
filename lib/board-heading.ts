// A board heading's options (size / alignment / italic / underline, the text
// color, and a background fill), encoded into board_items.hue so no migration
// is needed, the same move board-note-style made for note boxes.
//
// Encoding stored in board_items.hue, pipe-separated tokens in any order:
//   "" / null      -> default (theme text color, medium, left, no fill)
//   "red"          -> legacy color-only form (backward compatible, round-trips)
//   "red|lg|center|i|u" -> red, large, centered, italic, underlined
//   "red|bg:blue"  -> red text on a blue fill
//   "red|sz:15"    -> red text at 15px
//
// THE FILL AND THE SIZE CARRY A PREFIX and the text color does not, which is
// not an inconsistency: the bare token is the legacy form and has to stay bare
// for old rows to keep parsing. That also means the `bg:` and `sz:` tests MUST
// run before the catch-all that claims an unrecognised token as the text color,
// or one of them would be read as the color and the heading would change in the
// wrong way.
//
// SIZE IS A NUMBER OF PIXELS, not a t-shirt step. It began as sm/md/lg (19 /
// 26 / 36) and the operator ran out of room at the bottom on the first real
// board: 19px is already a banner, so labelling a small cluster had no size to
// reach for. Adding one step below it would only have moved the wall, and the
// stored value is what decides whether we are ever back here, so the ladder
// below is presentation and the number is the data. Those three legacy tokens
// still parse, and a size that lands exactly on one of them SERIALIZES BACK TO
// IT, so every row written before this is byte-identical unless somebody
// actually picks a new size (and a rollback of this change still reads them).
//
// Defaults are omitted on serialize so a heading that only picked a color keeps
// the legacy plain-hue form, and pre-existing rows parse unchanged.

import type { CSSProperties } from "react";
import { noteColorVars } from "@/lib/board-note-style";

export type HeadingAlign = "left" | "center" | "right";

export type HeadingStyle = {
  // A hue token key ("red", "blue", ...) or null for the theme text color.
  color: string | null;
  /**
   * Background behind the heading: a hue token key, a raw #hex, or null for
   * none, which is the default and what every heading written before this had.
   */
  fill: string | null;
  /** Font size in CSS pixels. See the note above on why this is a number. */
  size: number;
  align: HeadingAlign;
  italic: boolean;
  underline: boolean;
};

/** The token prefix that marks a fill, so it cannot be read as a text color. */
const FILL_PREFIX = "bg:";
/** The token prefix that marks a pixel size, for the same reason. */
const SIZE_PREFIX = "sz:";

/** The three original steps, kept so every heading written before this parses. */
const LEGACY_SIZES: Record<string, number> = { sm: 19, md: 26, lg: 36 };

/** What a heading is when nobody has chosen: the old "md". */
export const DEFAULT_HEADING_SIZE = 26;

/**
 * The sizes the picker offers, smallest first.
 *
 * It reaches 11px at the bottom, which is a caption rather than a heading, and
 * that is the point: a small cluster on a board wants a label, not a banner.
 * The three legacy values (19, 26, 36) are ON the ladder deliberately, so an
 * existing heading is always sitting on a step and the stepper behaves.
 */
export const HEADING_SIZES = [11, 13, 15, 17, 19, 22, 26, 30, 36, 44, 56];

// Bounds for a value arriving from stored data, which is the only way an
// off-ladder size can appear. Wide enough never to fight a real choice, tight
// enough that a corrupt row cannot draw a heading the height of the canvas.
const MIN_SIZE = 8;
const MAX_SIZE = 200;

const ALIGNS: HeadingAlign[] = ["left", "center", "right"];

/**
 * The next size up or down the ladder.
 *
 * Works from an OFF-LADDER value too (a hand-edited row, or a ladder that
 * changes later): it takes the nearest step in the direction of travel rather
 * than snapping first, so a nudge never jumps the size somewhere unasked. At
 * either end it stays put, so holding the button cannot walk off the scale.
 */
export function stepHeadingSize(size: number, dir: 1 | -1): number {
  if (dir < 0) {
    const below = HEADING_SIZES.filter((s) => s < size);
    return below.length ? below[below.length - 1] : HEADING_SIZES[0];
  }
  const above = HEADING_SIZES.find((s) => s > size);
  return above ?? HEADING_SIZES[HEADING_SIZES.length - 1];
}

export function parseHeadingStyle(raw: string | null | undefined): HeadingStyle {
  const style: HeadingStyle = {
    color: null,
    fill: null,
    size: DEFAULT_HEADING_SIZE,
    align: "left",
    italic: false,
    underline: false,
  };
  if (!raw) return style;
  for (const tok of raw.split("|")) {
    if (!tok) continue;
    if (tok in LEGACY_SIZES) style.size = LEGACY_SIZES[tok];
    else if ((ALIGNS as string[]).includes(tok)) style.align = tok as HeadingAlign;
    else if (tok === "i") style.italic = true;
    else if (tok === "u") style.underline = true;
    // Both prefixed tests come BEFORE the catch-all below, or a fill or a size
    // would be claimed as the text color.
    else if (tok.startsWith(FILL_PREFIX)) {
      const fill = tok.slice(FILL_PREFIX.length);
      if (fill) style.fill = fill;
    } else if (tok.startsWith(SIZE_PREFIX)) {
      const px = Number(tok.slice(SIZE_PREFIX.length));
      // Integers only: a stored "sz:" or "sz:abc" is junk, and Number("") is 0,
      // which would otherwise render a heading with no height at all.
      if (Number.isInteger(px) && px > 0) {
        style.size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, px));
      }
    } else style.color = tok;
  }
  return style;
}

export function serializeHeadingStyle(s: HeadingStyle): string {
  const toks: string[] = [];
  if (s.color) toks.push(s.color);
  if (s.fill) toks.push(`${FILL_PREFIX}${s.fill}`);
  // A size that lands exactly on one of the three original steps is written in
  // the OLD form, so a board full of headings nobody has resized stays byte for
  // byte what it was and survives a rollback of this change.
  if (s.size !== DEFAULT_HEADING_SIZE) {
    const legacy = Object.keys(LEGACY_SIZES).find((k) => LEGACY_SIZES[k] === s.size);
    toks.push(legacy ?? `${SIZE_PREFIX}${s.size}`);
  }
  if (s.align !== "left") toks.push(s.align);
  if (s.italic) toks.push("i");
  if (s.underline) toks.push("u");
  return toks.join("|");
}

// Concrete CSS for a heading's text, shared by the canvas card and the compact
// in-column render so the two can never drift.
export function headingCss(s: HeadingStyle): CSSProperties {
  // The fill reuses the NOTE box's resolver rather than a second one: a token
  // becomes its pale `-bg` tint and a custom hex is mixed toward the surface.
  // That is what keeps a filled heading readable whatever colour is picked and
  // in either theme, since the text colour above is not adjusted to match.
  const fill = s.fill ? noteColorVars(s.fill).bg : undefined;
  return {
    // A hue token key resolves to its theme var; a raw #hex is a custom color.
    color: !s.color
      ? "var(--text)"
      : s.color.startsWith("#")
      ? s.color
      : `var(--h-${s.color})`,
    fontSize: s.size,
    textAlign: s.align,
    fontStyle: s.italic ? "italic" : undefined,
    textDecoration: s.underline ? "underline" : undefined,
    backgroundColor: fill,
    // Only when filled. An unfilled heading keeps its exact previous geometry,
    // so nothing on an existing board moves when this ships.
    padding: fill ? "0.35em 0.5em" : undefined,
    borderRadius: fill ? 10 : undefined,
  };
}
