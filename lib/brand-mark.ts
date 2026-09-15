/**
 * The Studio Flows mark: three strokes at one weight on a 100-unit grid.
 *
 * The S is implied rather than drawn. The top stroke sits right, the middle
 * spans, the bottom sits left, so the eye completes the switchback and the
 * same shape reads as moving air. What keeps it off a text-align icon is that
 * no two strokes share an edge and the lengths are unequal, so do not
 * "tidy" these numbers into a common margin.
 *
 * THE GEOMETRY LIVES HERE ONCE because it is drawn two different ways. The app
 * and the marketing site draw it as an SVG path (components/brand/studio-mark).
 * The three SATORI routes (app/icon, app/apple-icon, lib/marketing/og) cannot
 * be trusted with inline SVG, so they lay it out as three rounded divs instead.
 * Both read these constants, so a change here moves every surface at once.
 */
export const MARK_BOX = 100;
export const MARK_STROKE = 15;

/** Each stroke as a centre line: y, and the x it runs between. */
export const MARK_STROKES: ReadonlyArray<{ y: number; x1: number; x2: number }> = [
  { y: 26, x1: 44, x2: 88 },
  { y: 50, x1: 16, x2: 84 },
  { y: 74, x1: 12, x2: 56 },
];

/** The path for an SVG render. Pair it with round caps and MARK_STROKE. */
export const MARK_PATH = MARK_STROKES.map(
  (s) => `M${s.x1} ${s.y}H${s.x2}`,
).join("");

/**
 * The same three strokes as rectangles, in PERCENT of the box, for the CSS
 * renderer. A round-capped stroke is a rectangle that overhangs its centre
 * line by half the weight at each end, with a fully rounded radius.
 */
export const MARK_BARS = MARK_STROKES.map((s) => ({
  left: s.x1 - MARK_STROKE / 2,
  top: s.y - MARK_STROKE / 2,
  width: s.x2 - s.x1 + MARK_STROKE,
  height: MARK_STROKE,
}));

/**
 * How much of a tile the mark occupies, and how round the tile is, as fractions
 * of the tile. Shared so the favicon, the nav chip, the sidebar and the OG card
 * all sit the mark identically: the chips used to be 9px, 10px and 7px round at
 * the same 32px, which is invisible one at a time and reads as sloppy when two
 * of them are on screen together.
 */
export const MARK_SCALE = 0.58;
export const MARK_RADIUS = 0.28;
