// Milanote-style note "box" options (Background vs Top strip, a color, or none),
// encoded into the existing board_items.hue string so no migration is needed.
//
// Encoding stored in board_items.hue:
//   null / "yellow"   -> legacy full-fill note with that hue key (backward compatible)
//   "none"            -> transparent (no fill)
//   "strip:blue"      -> neutral body with a colored top strip
//   "fill:#aabbcc"    -> custom fill color
//   "strip:#aabbcc"   -> custom top strip color

export type NoteFillMode = "fill" | "strip" | "none";
export type NoteStyle = { mode: NoteFillMode; color: string | null };

export function parseNoteStyle(raw: string | null | undefined): NoteStyle {
  if (!raw) return { mode: "fill", color: "yellow" };
  if (raw === "none") return { mode: "none", color: null };
  const i = raw.indexOf(":");
  if (i === -1) return { mode: "fill", color: raw };
  const mode = raw.slice(0, i);
  const color = raw.slice(i + 1) || "yellow";
  if (mode === "strip") return { mode: "strip", color };
  if (mode === "fill") return { mode: "fill", color };
  return { mode: "fill", color: raw };
}

export function serializeNoteStyle(s: NoteStyle): string {
  if (s.mode === "none") return "none";
  const color = s.color || "yellow";
  // Keep the legacy plain-hue form for a default fill so old data round-trips cleanly.
  if (s.mode === "fill") return color;
  return `strip:${color}`;
}

// Resolve a note color (a hue token key or a raw #hex) to concrete CSS values:
// an accent (strip / handle / body text) and a tinted background.
export function noteColorVars(color: string | null): { accent: string; bg: string } {
  if (!color) return { accent: "var(--text-muted)", bg: "transparent" };
  if (color.startsWith("#")) {
    return { accent: color, bg: `color-mix(in srgb, ${color} 20%, var(--surface))` };
  }
  return { accent: `var(--h-${color})`, bg: `var(--h-${color}-bg)` };
}

// The full palette offered in the note Box tab (all 10 hue tokens).
export const NOTE_COLORS = [
  "yellow",
  "amber",
  "orange",
  "red",
  "pink",
  "purple",
  "indigo",
  "blue",
  "cyan",
  "green",
];
