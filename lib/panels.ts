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

/** A page's placed images, as rectangles on the rendered page. */
export type ImagePage = {
  width: number;
  height: number;
  images: Rect[];
};

/** Smaller than this on either side and it is a logo or an icon, not a frame. */
const MIN_IMAGE_SIDE = 0.12;
/** Covering this much of the page makes it the background, not a panel. */
const FULL_BLEED = 0.92;
/** A picture this far buried under later ones is not on the page any more. */
const BURIED = 0.8;
/** A covering picture within this much of a full side counts as spanning it. */
const SPANS = 0.02;
/** A rect repeating on this share of the pages is page furniture. */
const FURNITURE_SHARE = 0.6;

function area(r: Rect) {
  return Math.max(0, r.w) * Math.max(0, r.h);
}

function overlaps(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

/**
 * How much of `r` the given rects bury, 0 to 1.
 *
 * Sampled on a coarse grid rather than solved as a union of rectangles: the
 * answer is only ever compared against a threshold, and three overlapping
 * covers is a genuinely awkward bit of geometry to get right for no gain.
 */
function coveredShare(r: Rect, covers: Rect[]) {
  if (!covers.length) return 0;
  const N = 32;
  let hit = 0;
  for (let iy = 0; iy < N; iy++) {
    const y = r.y + ((iy + 0.5) * r.h) / N;
    for (let ix = 0; ix < N; ix++) {
      const x = r.x + ((ix + 0.5) * r.w) / N;
      if (
        covers.some((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h)
      ) {
        hit++;
      }
    }
  }
  return hit / (N * N);
}

/**
 * Pull a rect back from any edge a later picture sits across.
 *
 * A layout routinely places a photo larger than the hole it shows through and
 * lets the next picture cover the overhang. Cropping the whole placed rect
 * would then carry a slice of its neighbour, so the overhang comes off.
 */
function trimAgainst(r: Rect, covers: Rect[]): Rect {
  let out = { ...r };
  for (const c of covers) {
    if (!overlaps(out, c)) continue;
    const spansWidth =
      c.x <= out.x + out.w * SPANS && c.x + c.w >= out.x + out.w * (1 - SPANS);
    const spansHeight =
      c.y <= out.y + out.h * SPANS && c.y + c.h >= out.y + out.h * (1 - SPANS);
    if (spansWidth) {
      if (c.y <= out.y) {
        const bottom = out.y + out.h;
        out = { ...out, y: c.y + c.h, h: bottom - (c.y + c.h) };
      } else if (c.y + c.h >= out.y + out.h) {
        out = { ...out, h: c.y - out.y };
      }
    } else if (spansHeight) {
      if (c.x <= out.x) {
        const right = out.x + out.w;
        out = { ...out, x: c.x + c.w, w: right - (c.x + c.w) };
      } else if (c.x + c.w >= out.x + out.w) {
        out = { ...out, w: c.x - out.x };
      }
    }
  }
  return out;
}

/**
 * Panels from the pictures the document ALREADY places.
 *
 * The better first guess, and it came from a real client deck. A modern
 * treatment or board is a designed layout: frames are placed image tiles on a
 * coloured background, often butted edge to edge with no gutter at all, often
 * over black. Gutter detection cannot see any of that, and correctly says so,
 * which leaves the operator slicing by hand. But the PDF knows exactly where
 * every picture sits, so the rectangles can simply be read out instead of
 * inferred, which is exact rather than approximate and cares nothing for the
 * background colour.
 *
 * Gutter detection still earns its place for the other family of document: a
 * drawn or printed board, where the panels are ink on paper and the file holds
 * one scanned image per page.
 *
 * Takes every page at once because the giveaway for page furniture (a logo, a
 * footer rule) is that it lands in the same place on most pages.
 *
 * `images` must be in DRAW ORDER, since that is what decides which of two
 * overlapping pictures is the one you can actually see.
 */
export function panelsFromImages(pages: ImagePage[]): Rect[][] {
  const seen = new Map<string, number>();
  const key = (r: Rect) =>
    `${Math.round(r.x / 8)}:${Math.round(r.y / 8)}:${Math.round(r.w / 8)}:${Math.round(r.h / 8)}`;
  for (const page of pages) {
    // Once per page, so a picture repeated within one page does not look like
    // it repeats across the document.
    for (const k of new Set(page.images.map(key))) {
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
  }
  const furniture = (r: Rect) =>
    pages.length >= 3 && (seen.get(key(r)) ?? 0) >= pages.length * FURNITURE_SHARE;

  return pages.map((page) => {
    const big = (r: Rect) =>
      r.w >= page.width * MIN_IMAGE_SIDE && r.h >= page.height * MIN_IMAGE_SIDE;

    // Draw order preserved throughout: everything below depends on it.
    const candidates = page.images
      .map((r) => ({
        // A picture can hang off the page edge; only the visible part is a panel.
        x: Math.max(0, r.x),
        y: Math.max(0, r.y),
        w: Math.min(r.x + r.w, page.width) - Math.max(0, r.x),
        h: Math.min(r.y + r.h, page.height) - Math.max(0, r.y),
      }))
      .filter(
        (r) =>
          big(r) &&
          !(r.w >= page.width * FULL_BLEED && r.h >= page.height * FULL_BLEED) &&
          !furniture(r)
      );

    const kept: Rect[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const later = candidates.slice(i + 1);
      if (coveredShare(candidates[i], later) >= BURIED) continue;
      const trimmed = trimAgainst(candidates[i], later);
      if (big(trimmed) && area(trimmed) > 0) kept.push(trimmed);
    }
    return readingOrder(kept);
  });
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
