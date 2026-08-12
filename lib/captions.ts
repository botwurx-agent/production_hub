// The words that belong to a panel.
//
// A storyboard panel is a picture with its caption printed underneath: a shot
// number, a line of action, sometimes a camera note. The PDF gives a position
// for every word, so which words belong to which panel is a geometry question
// and can be answered exactly. Asking a model to caption the panels instead
// means asking it to count them the same way we cut them, which it will not
// reliably do, and a caption attached to the wrong frame is worse than none.
//
// Pure, so the rules can be tested against made-up pages.

import type { Rect } from "@/lib/panels";

/** One run of text, positioned in rendered page pixels. y is its TOP. */
export type TextRun = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** How far below a panel a caption can sit, as a share of the panel height. */
const ZONE_SHARE = 0.3;
/** A short panel still gets a readable strip beneath it. */
const MIN_ZONE = 34;
/** A run must sit this much within the panel's columns to be its caption. */
const IN_COLUMN = 0.5;
/** Runs within this much of a line height of each other are one line. */
const SAME_LINE = 0.6;
const MAX_CAPTION = 400;

function centerY(r: TextRun) {
  return r.y + r.h / 2;
}

function inside(r: TextRun, box: Rect) {
  const cx = r.x + r.w / 2;
  const cy = centerY(r);
  return cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h;
}

/**
 * The caption printed under one panel.
 *
 * `others` is every other panel on the page, so a word sitting inside a
 * neighbouring picture is never stolen as this one's caption. That matters on
 * a tight board where the gap under one panel is the top of the next.
 */
export function captionFor(
  panel: Rect,
  runs: TextRun[],
  others: Rect[] = []
): string | null {
  const zoneTop = panel.y + panel.h;
  const zoneBottom = zoneTop + Math.max(MIN_ZONE, panel.h * ZONE_SHARE);

  const mine = runs.filter((r) => {
    if (!r.text.trim()) return false;
    const cy = centerY(r);
    if (cy < zoneTop || cy > zoneBottom) return false;
    // Horizontally within the panel's own columns, so a caption belonging to
    // the panel beside this one is not picked up.
    const overlap =
      Math.min(r.x + r.w, panel.x + panel.w) - Math.max(r.x, panel.x);
    if (overlap < r.w * IN_COLUMN) return false;
    return !others.some((o) => inside(r, o));
  });

  if (!mine.length) return null;

  // Group into lines, since a caption of two lines arrives as two sets of runs
  // and joining them by x alone would interleave the lines.
  const lineHeight =
    mine.reduce((sum, r) => sum + r.h, 0) / mine.length || MIN_ZONE;
  const sorted = [...mine].sort((a, b) => centerY(a) - centerY(b));
  const lines: TextRun[][] = [];
  for (const run of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(centerY(run) - centerY(line[0])) <= lineHeight * SAME_LINE) {
      line.push(run);
    } else {
      lines.push([run]);
    }
  }

  const text = lines
    .map((line) =>
      line
        .sort((a, b) => a.x - b.x)
        .map((r) => r.text)
        .join(" ")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return text ? text.slice(0, MAX_CAPTION) : null;
}

/** A leading shot number, the way a board prints it above its caption. */
const LEADING_CODE = /^(?:SHOT\s+|SH\.?\s+)?(\d{1,3}[A-Za-z]?)\s*[.):-]?\s+(?=\S)/i;

/**
 * Split a caption into the shot code and the rest.
 *
 * A board captions a panel "4A. She turns to the window", and those are two
 * different fields on a frame. Only a number, or a number with a letter, is
 * taken as a code, so a caption that simply opens with a word is left whole.
 */
export function splitCaption(caption: string | null): {
  scene: string | null;
  description: string | null;
} {
  if (!caption) return { scene: null, description: null };
  const m = caption.match(LEADING_CODE);
  if (!m) return { scene: null, description: caption };
  const rest = caption.slice(m[0].length).trim();
  // A code with nothing after it is just a caption that starts with a number.
  if (!rest) return { scene: null, description: caption };
  return { scene: m[1].toUpperCase(), description: rest };
}
