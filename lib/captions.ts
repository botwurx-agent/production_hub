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

/** Which of a frame's fields a given section label feeds. */
type Field = "description" | "sound" | "notes";

/**
 * The labels a board prints above each part of a caption.
 *
 * Order matters inside the alternation: the longer word has to come first or
 * "VOICE OVER" is matched as a bare "VO" with a stray "ICE OVER" after it.
 */
const LABEL_RE =
  /\b(ACTION|VISUALS?|DESCRIPTION|SHOT|CAMERA|MOVEMENT|NOTES?|VOICE\s?OVER|NARRATION|DIALOGUE|AUDIO|MUSIC|SFX|VO)\b(\s*:)?[.\s]+/gi;

function fieldFor(word: string): Field {
  switch (word) {
    case "CAMERA":
    case "MOVEMENT":
    case "NOTE":
    case "NOTES":
      return "notes";
    case "VOICEOVER":
    case "VOICE OVER":
    case "NARRATION":
    case "DIALOGUE":
    case "AUDIO":
    case "MUSIC":
    case "SFX":
    case "VO":
      return "sound";
    default:
      return "description";
  }
}

/**
 * Split a caption into the fields a frame actually has.
 *
 * A board does not caption a frame with one sentence. A real one reads
 *
 *   SHOT 1A  Cloud Reveal / Opening Frame
 *   ACTION   We open closed. A dense wall of pink cloud fills the frame.
 *   CAMERA   Locked, or a very slow creep in.
 *   NOTES    Cloud passes in front of the bottles, never around them.
 *
 * and a frame here holds a scene, a description, a sound field and notes, so
 * dropping all of that into one box would mean the producer separating it
 * again by hand, which is the work this import exists to remove.
 *
 * TWO RULES KEEP THIS OFF PROSE, both learned from a real board:
 *
 * A label must be UPPERCASE, or be followed by a colon. Without that, "running
 * away from camera" splits a sentence in half, and every board writes that
 * sentence. A board that prints "Camera: push in" still works, because of the
 * colon.
 *
 * And SHOT followed by a number is the frame's own code, not a section called
 * SHOT. "SHOT 1A Cloud Reveal" is a heading; "SHOT  Low, mattress height" is a
 * camera note. Without that distinction the most common way in the industry to
 * label a frame swallowed its own title, and every frame came in unnamed.
 *
 * Where a board uses no labels at all, the whole caption stays as the
 * description rather than being guessed at.
 */
export function splitCaption(caption: string | null): {
  scene: string | null;
  description: string | null;
  sound: string | null;
  notes: string | null;
} {
  const empty = { scene: null, description: null, sound: null, notes: null };
  if (!caption) return empty;

  const marks: { at: number; end: number; word: string; field: Field }[] = [];
  LABEL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LABEL_RE.exec(caption)) !== null) {
    const raw = m[1];
    const word = raw.replace(/\s+/g, " ").toUpperCase();
    const hasColon = Boolean(m[2]);
    if (raw !== raw.toUpperCase() && !hasColon) continue;
    // The frame's own number, printed the way most boards print it.
    if (word === "SHOT" && /^\d/.test(caption.slice(m.index + m[0].length))) {
      continue;
    }
    marks.push({ at: m.index, end: m.index + m[0].length, word, field: fieldFor(word) });
  }

  const parts: Record<Field, string[]> = { description: [], sound: [], notes: [] };
  for (let i = 0; i < marks.length; i++) {
    const to = marks[i + 1]?.at ?? caption.length;
    const body = caption.slice(marks[i].end, to).trim();
    if (!body) continue;
    // A note keeps the word it was printed under, since CAMERA and NOTES both
    // land in the same box and a producer needs to know which is which.
    const isPlainNote = marks[i].word === "NOTE" || marks[i].word === "NOTES";
    parts[marks[i].field].push(
      marks[i].field === "notes" && !isPlainNote
        ? `${marks[i].word}: ${body}`
        : body
    );
  }

  // Whatever comes before the first label is the heading.
  let head = caption.slice(0, marks[0]?.at ?? caption.length).trim();

  // The leading number is the frame's own code and belongs at the front of the
  // scene, not buried in it.
  const code = head.match(LEADING_CODE);
  let scene: string | null = null;
  if (code) {
    const rest = head.slice(code[0].length).trim();
    scene = rest ? `${code[1].toUpperCase()} · ${rest}` : code[1].toUpperCase();
    head = rest;
  } else if (head) {
    scene = head;
  }

  const joined = (field: Field, sep: string) =>
    parts[field].length ? parts[field].join(sep) : null;

  return {
    scene: scene ? scene.slice(0, 120) : null,
    // With no labels there is nothing to separate, so the caption stands as
    // the description, minus a heading already captured as the scene.
    description: joined("description", " ") ?? (marks.length ? null : stripCode(caption)),
    sound: joined("sound", " "),
    notes: joined("notes", "\n\n"),
  };
}

/** A run has to sit this far into a page's top or bottom to be furniture. */
const MARGIN_SHARE = 0.1;
/** And repeat on this share of the pages. */
const REPEAT_SHARE = 0.6;
/** Positions are bucketed this coarsely, so a pixel of drift is still a match. */
const BUCKET = 6;

/**
 * Strip the running header, the footer rule and the page number.
 *
 * They were landing at the end of every caption ("... cloud backdrop behind.
 * HINT / Treat Yourself / Botwurx 3"), because a panel with no neighbour above
 * or below reaches a little past itself looking for its text, and on a page
 * with one big frame that reach gets all the way to the footer.
 *
 * THREE CONDITIONS TOGETHER, and each one is load-bearing:
 *
 * In the page MARGIN, because that is what makes furniture furniture. Position
 * alone is not enough: this deck is templated, so the word "ACTION" sits at
 * exactly the same y on all ten pages, and a repeat-by-position rule would
 * have deleted the label that makes the whole caption parseable.
 *
 * REPEATING across pages, so a caption that happens to be printed low on one
 * page is safe.
 *
 * And carrying the SAME TEXT, so a per-frame caption typeset in the same place
 * on every page survives. A page NUMBER is the one exception, since its whole
 * job is to differ; a short run of digits in a repeating margin slot is one.
 */
export function stripFurniture(
  pages: { width: number; height: number; runs: TextRun[] }[]
): TextRun[][] {
  if (pages.length < 3) return pages.map((p) => p.runs);

  const slot = (r: TextRun) =>
    `${Math.round(r.x / BUCKET)}:${Math.round(r.y / BUCKET)}`;
  const isNumber = (t: string) => /^\d{1,4}$/.test(t.trim());
  const inMargin = (r: TextRun, height: number) => {
    const cy = r.y + r.h / 2;
    return cy <= height * MARGIN_SHARE || cy >= height * (1 - MARGIN_SHARE);
  };

  // Counted once per page, so a word used twice on one page does not look like
  // it repeats across the document.
  const bySlot = new Map<string, { pages: Set<number>; texts: Set<string> }>();
  pages.forEach((page, i) => {
    for (const run of page.runs) {
      if (!inMargin(run, page.height)) continue;
      const key = slot(run);
      const entry = bySlot.get(key) ?? { pages: new Set(), texts: new Set() };
      entry.pages.add(i);
      entry.texts.add(run.text.trim());
      bySlot.set(key, entry);
    }
  });

  const need = pages.length * REPEAT_SHARE;
  return pages.map((page) =>
    page.runs.filter((run) => {
      if (!inMargin(run, page.height)) return true;
      const entry = bySlot.get(slot(run));
      if (!entry || entry.pages.size < need) return true;
      // One text repeating in one slot is a footer. Several different texts in
      // one slot are only furniture when they are page numbers.
      const repeats = entry.texts.size === 1;
      const numbered = [...entry.texts].every(isNumber);
      return !(repeats || numbered);
    })
  );
}

function stripCode(caption: string): string {
  const m = caption.match(LEADING_CODE);
  const rest = m ? caption.slice(m[0].length).trim() : caption;
  return rest || caption;
}
