// A board heading's text options (size / alignment / italic / underline plus
// the existing color), encoded into board_items.hue so no migration is needed,
// the same move board-note-style made for note boxes.
//
// Encoding stored in board_items.hue, pipe-separated tokens in any order:
//   "" / null      -> default (theme text color, medium, left)
//   "red"          -> legacy color-only form (backward compatible, round-trips)
//   "red|lg|center|i|u" -> red, large, centered, italic, underlined
//
// Defaults are omitted on serialize so a heading that only picked a color keeps
// the legacy plain-hue form, and pre-existing rows parse unchanged.

import type { CSSProperties } from "react";

export type HeadingSize = "sm" | "md" | "lg";
export type HeadingAlign = "left" | "center" | "right";

export type HeadingStyle = {
  // A hue token key ("red", "blue", ...) or null for the theme text color.
  color: string | null;
  size: HeadingSize;
  align: HeadingAlign;
  italic: boolean;
  underline: boolean;
};

const SIZES: HeadingSize[] = ["sm", "md", "lg"];
const ALIGNS: HeadingAlign[] = ["left", "center", "right"];

export function parseHeadingStyle(raw: string | null | undefined): HeadingStyle {
  const style: HeadingStyle = {
    color: null,
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
    else style.color = tok;
  }
  return style;
}

export function serializeHeadingStyle(s: HeadingStyle): string {
  const toks: string[] = [];
  if (s.color) toks.push(s.color);
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
  };
}
