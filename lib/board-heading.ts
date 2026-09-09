// A board heading's options (size / alignment / italic / underline, the text
// color, and a background fill), encoded into board_items.hue so no migration
// is needed, the same move board-note-style made for note boxes.
//
// Encoding stored in board_items.hue, pipe-separated tokens in any order:
//   "" / null      -> default (theme text color, medium, left, no fill)
//   "red"          -> legacy color-only form (backward compatible, round-trips)
//   "red|lg|center|i|u" -> red, large, centered, italic, underlined
//   "red|bg:blue"  -> red text on a blue fill
//
// THE FILL CARRIES A PREFIX and the text color does not, which is not an
// inconsistency: the bare token is the legacy form and has to stay bare for old
// rows to keep parsing. That also means the `bg:` test MUST run before the
// catch-all that claims an unrecognised token as the text color, or a fill
// would be read as the color and the heading would change in the wrong way.
//
// Defaults are omitted on serialize so a heading that only picked a color keeps
// the legacy plain-hue form, and pre-existing rows parse unchanged.

import type { CSSProperties } from "react";
import { noteColorVars } from "@/lib/board-note-style";

export type HeadingSize = "sm" | "md" | "lg";
export type HeadingAlign = "left" | "center" | "right";

export type HeadingStyle = {
  // A hue token key ("red", "blue", ...) or null for the theme text color.
  color: string | null;
  /**
   * Background behind the heading: a hue token key, a raw #hex, or null for
   * none, which is the default and what every heading written before this had.
   */
  fill: string | null;
  size: HeadingSize;
  align: HeadingAlign;
  italic: boolean;
  underline: boolean;
};

/** The token prefix that marks a fill, so it cannot be read as a text color. */
const FILL_PREFIX = "bg:";

const SIZES: HeadingSize[] = ["sm", "md", "lg"];
const ALIGNS: HeadingAlign[] = ["left", "center", "right"];

export function parseHeadingStyle(raw: string | null | undefined): HeadingStyle {
  const style: HeadingStyle = {
    color: null,
    fill: null,
    size: "md",
    align: "left",
    italic: false,
    underline: false,
  };
  if (!raw) return style;
  for (const tok of raw.split("|")) {
    if (!tok) continue;
    if ((SIZES as string[]).includes(tok)) style.size = tok as HeadingSize;
    else if ((ALIGNS as string[]).includes(tok)) style.align = tok as HeadingAlign;
    else if (tok === "i") style.italic = true;
    else if (tok === "u") style.underline = true;
    // Before the catch-all below, or a fill becomes the text color.
    else if (tok.startsWith(FILL_PREFIX)) {
      const fill = tok.slice(FILL_PREFIX.length);
      if (fill) style.fill = fill;
    } else style.color = tok;
  }
  return style;
}

export function serializeHeadingStyle(s: HeadingStyle): string {
  const toks: string[] = [];
  if (s.color) toks.push(s.color);
  if (s.fill) toks.push(`${FILL_PREFIX}${s.fill}`);
  if (s.size !== "md") toks.push(s.size);
  if (s.align !== "left") toks.push(s.align);
  if (s.italic) toks.push("i");
  if (s.underline) toks.push("u");
  return toks.join("|");
}

// Font sizes per step. Medium is the pre-existing 26px so old headings do not
// change size when this ships.
export const HEADING_FONT_SIZE: Record<HeadingSize, number> = {
  sm: 19,
  md: 26,
  lg: 36,
};

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
    fontSize: HEADING_FONT_SIZE[s.size],
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
