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
/**
 * A storyboard caption is routinely a paragraph, not a line: a shot
 * description on a real board ran three lines plus a voiceover.
 */
const MAX_CAPTION = 1200;
/** How far a panel's band reaches past it when there is no neighbour to stop it. */
const BAND_SLACK = 0.15;

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
  const usable = runs.filter(
    (r) => r.text.trim() && !others.some((o) => inside(r, o))
  );

  const below = belowRuns(panel, usable);
  // Underneath first, since that is the classic caption. Beside is the other
  // common storyboard layout and was the one that failed on a real board:
  // frames down the left, the shot description in a column to the right, so
  // nothing sat under a panel at all and every caption came back empty.
  const mine = below.length ? below : besideRuns(panel, usable, others);

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

/** Text in the strip directly under a panel. */
function belowRuns(panel: Rect, runs: TextRun[]): TextRun[] {
  const top = panel.y + panel.h;
  const bottom = top + Math.max(MIN_ZONE, panel.h * ZONE_SHARE);
  return runs.filter((r) => {
    const cy = centerY(r);
    if (cy < top || cy > bottom) return false;
    // Horizontally within the panel's own columns, so a caption belonging to
    // the panel beside this one is not picked up.
    const overlap =
      Math.min(r.x + r.w, panel.x + panel.w) - Math.max(r.x, panel.x);
    return overlap >= r.w * IN_COLUMN;
  });
}

/**
 * Text in a column beside a panel, on either side.
 *
 * The vertical band is bounded by the panels above and below rather than by
 * the panel's own edges, and it stops HALFWAY to each of them. That is what
 * keeps the second frame's description out of the first frame's caption on a
 * board where the text starts a few pixels ABOVE the picture it describes,
 * which is exactly how a real one is typeset.
 *
 * Where there is no neighbour the band reaches only a little past the panel,
 * so the running header and the page footer stay out.
 */
function besideRuns(panel: Rect, runs: TextRun[], others: Rect[]): TextRun[] {
  // Only panels sharing this one's rows can bound it: a panel in the next
  // column along says nothing about where this one's text ends.
  const column = others.filter(
    (o) => o.x < panel.x + panel.w && panel.x < o.x + o.w
  );
  const above = column.filter((o) => o.y + o.h <= panel.y);
  const below = column.filter((o) => o.y >= panel.y + panel.h);

  const prevBottom = above.length
    ? Math.max(...above.map((o) => o.y + o.h))
    : null;
  const nextTop = below.length ? Math.min(...below.map((o) => o.y)) : null;

  const top =
    prevBottom !== null
      ? (prevBottom + panel.y) / 2
      : panel.y - panel.h * BAND_SLACK;
  const bottom =
    nextTop !== null
      ? (panel.y + panel.h + nextTop) / 2
      : panel.y + panel.h + panel.h * BAND_SLACK;

  return runs.filter((r) => {
    const cy = centerY(r);
    if (cy < top || cy > bottom) return false;
    // Outside the panel's own columns: this is the text NEXT to the picture.
    const overlap =
      Math.min(r.x + r.w, panel.x + panel.w) - Math.max(r.x, panel.x);
    return overlap < r.w * IN_COLUMN;
  });
}

/** A leading shot number, the way a board prints it above its caption. */
const LEADING_CODE = /^(?:SHOT\s+|SH\.?\s+)?(\d{1,3}[A-Za-z]?)\s*[.):-]?\s+(?=\S)/i;

/** How a board labels the line that is spoken over a frame. */
const VOICE_MARKER = /\b(?:VOICE\s?OVER|VOICEOVER|NARRATION|VO)\b[:.\s]*/i;
/** How it labels what the camera does. */
const SHOT_MARKER = /\b(?:SHOT|ACTION|CAMERA|VISUAL)\b[:.\s]*/i;

/**
 * Split a caption into the fields a frame actually has.
 *
 * A board does not caption a frame with one sentence. A real one reads
 *
 *   1  0:00-0:04  Bedroom - night
 *   VOICEOVER  You know the itch.
 *   SHOT  Low, mattress height, looking lengthwise across the bed.
 *
 * and a frame here holds a scene, a description and a sound field, so dropping
 * all of that into one box would mean the producer separating it again by
 * hand, which is the work this import exists to remove.
 *
 * The labels themselves are the split. Where a board uses none, the whole
 * caption stays as the description rather than being guessed at.
 */
export function splitCaption(caption: string | null): {
  scene: string | null;
  description: string | null;
  sound: string | null;
} {
  if (!caption) return { scene: null, description: null, sound: null };

  const voice = caption.match(VOICE_MARKER);
  const shot = caption.match(SHOT_MARKER);
  const voiceAt = voice?.index ?? -1;
  const shotAt = shot?.index ?? -1;

  // Where the labelled part starts is where the heading ends.
  const marks = [voiceAt, shotAt].filter((i) => i >= 0);
  const headEnd = marks.length ? Math.min(...marks) : caption.length;
  let head = caption.slice(0, headEnd).trim();

  const section = (start: number, match: RegExpMatchArray | null) => {
    if (start < 0 || !match) return null;
    const from = start + match[0].length;
    // Runs until the OTHER label, whichever order the board printed them in.
    const others = [voiceAt, shotAt].filter((i) => i > start);
    const to = others.length ? Math.min(...others) : caption.length;
    return caption.slice(from, to).trim() || null;
  };

  const sound = section(voiceAt, voice);
  const shotText = section(shotAt, shot);

  // The leading number is the frame's own code and belongs at the front of the
  // scene, not buried in it.
  const m = head.match(LEADING_CODE);
  let scene: string | null = null;
  if (m) {
    const rest = head.slice(m[0].length).trim();
    scene = rest ? `${m[1].toUpperCase()} · ${rest}` : m[1].toUpperCase();
    head = rest;
  } else if (head) {
    scene = head;
  }

  return {
    scene: scene ? scene.slice(0, 120) : null,
    // With no SHOT label there is nothing to separate, so the caption stands
    // as the description, minus a heading already captured as the scene.
    description: shotText ?? (marks.length ? null : stripCode(caption)),
    sound,
  };
}

function stripCode(caption: string): string {
  const m = caption.match(LEADING_CODE);
  const rest = m ? caption.slice(m[0].length).trim() : caption;
  return rest || caption;
}
