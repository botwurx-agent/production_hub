// Finding storyboard panels on a rendered page.
//
// Pure: takes a grayscale sample of the page and returns rectangles. No canvas,
// no DOM, so the rules can be unit tested against synthetic pages before any
// real PDF is involved.
//
// The method is deliberately NOT a vision model. Asking a model for pixel
// coordinates gives confident, slightly-wrong boxes, and a slightly-wrong box
// is a badly cropped frame, which is worse than an uncropped page. A storyboard
// page is panels separated by paper, so the paper is the thing to find: scan
// for rows and columns that are almost entirely background, and the gaps
// between them are the panels.

export type Rect = { x: number; y: number; w: number; h: number };

export type Grid = {
  rects: Rect[];
  cols: number;
  rows: number;
  /** False when the page did not look like a grid of panels at all. */
  confident: boolean;
};

/** A page sampled to one byte per pixel, 0 = black, 255 = white. */
export type GrayPage = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
};

/** Anything this light counts as paper. */
const PAPER = 236;
/** A line is a gutter when at least this share of it is paper. */
const GUTTER_SHARE = 0.985;
/** Ignore slivers: a panel narrower than this share of the page is noise. */
const MIN_SIDE = 0.06;

function isPaperRow(page: GrayPage, y: number): boolean {
  let paper = 0;
  for (let x = 0; x < page.width; x++) {
    if (page.data[y * page.width + x] >= PAPER) paper++;
  }
  return paper / page.width >= GUTTER_SHARE;
}

function isPaperCol(page: GrayPage, x: number): boolean {
  let paper = 0;
  for (let y = 0; y < page.height; y++) {
    if (page.data[y * page.width + x] >= PAPER) paper++;
  }
  return paper / page.height >= GUTTER_SHARE;
}

/**
 * Runs of consecutive non-paper lines, which are the bands content sits in.
 * `min` drops slivers, so a caption's underline does not become a panel.
 */
function bands(isPaper: (i: number) => boolean, length: number, min: number) {
  const out: { start: number; end: number }[] = [];
  let start: number | null = null;
  for (let i = 0; i < length; i++) {
    if (!isPaper(i)) {
      if (start === null) start = i;
    } else if (start !== null) {
      if (i - start >= min) out.push({ start, end: i });
      start = null;
    }
  }
  if (start !== null && length - start >= min) out.push({ start, end: length });
  return out;
}

/**
 * The panels on one page.
 *
 * Rows first, then columns WITHIN each row, because a board is often ragged:
 * three panels on the top row and two on the bottom is common, and slicing by
 * a single global grid would invent a third panel out of empty paper.
 */
export function findPanels(page: GrayPage): Grid {
  const minH = Math.floor(page.height * MIN_SIDE);
  const minW = Math.floor(page.width * MIN_SIDE);

  const rowBands = bands((y) => isPaperRow(page, y), page.height, minH);
  const rects: Rect[] = [];
  let widest = 0;

  for (const row of rowBands) {
    const colBands = bands(
      (x) => {
        // Only this band's rows, so one row's gutters cannot be filled in by
        // another row's content sitting in the same column.
        let paper = 0;
        const total = row.end - row.start;
        for (let y = row.start; y < row.end; y++) {
          if (page.data[y * page.width + x] >= PAPER) paper++;
        }
        return paper / total >= GUTTER_SHARE;
      },
      page.width,
      minW
    );
    widest = Math.max(widest, colBands.length);
    for (const col of colBands) {
      rects.push({
        x: col.start,
        y: row.start,
        w: col.end - col.start,
        h: row.end - row.start,
      });
    }
  }

  // One band covering the whole page means we found no gutters at all: a bled
  // illustration, or a scan with a grey cast. Report it rather than returning a
  // "panel" that is just the page.
  const confident =
    rects.length > 1 &&
    !(
      rects.length === 1 &&
      rects[0].w > page.width * 0.95 &&
      rects[0].h > page.height * 0.95
    );

  return { rects, cols: widest, rows: rowBands.length, confident };
}

/**
 * The fallback, and the override.
 *
 * Used when detection is not confident, and when the operator corrects it
 * ("this page is 3 across by 2 down"). Insets slightly so a panel border does
 * not sit exactly on the cut.
 */
export function sliceGrid(
  width: number,
  height: number,
  cols: number,
  rows: number,
  margin = 0
): Rect[] {
  const out: Rect[] = [];
  const usableW = width - margin * 2;
  const usableH = height - margin * 2;
  const cw = usableW / Math.max(1, cols);
  const ch = usableH / Math.max(1, rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: Math.round(margin + c * cw),
        y: Math.round(margin + r * ch),
        w: Math.round(cw),
        h: Math.round(ch),
      });
    }
  }
  return out;
}

/**
 * Reading order: left to right, then down. Detection already walks rows first,
 * but an operator-supplied grid or a re-slice needs it applied explicitly.
 *
 * Rows are grouped by overlap rather than by exact y, because panels in one row
 * are rarely pixel-aligned.
 */
export function readingOrder(rects: Rect[]): Rect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y);
  const rows: Rect[][] = [];
  for (const r of sorted) {
    const row = rows.find((group) => {
      const ref = group[0];
      const overlap =
        Math.min(ref.y + ref.h, r.y + r.h) - Math.max(ref.y, r.y);
      return overlap > Math.min(ref.h, r.h) * 0.5;
    });
    if (row) row.push(r);
    else rows.push([r]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
}
