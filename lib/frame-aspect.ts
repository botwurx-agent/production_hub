// The shape a storyboard's frames are drawn in.
//
// Pure, so the snapping and the detection can be tested against made-up
// numbers rather than against a real PDF.
//
// This exists because every frame grid in the app was a hardcoded landscape
// box filled with object-cover, and a board drawn in any other shape had most
// of its picture cropped away on screen. The import was never at fault: it
// crops the artwork out of the page exactly. It was the display that threw the
// rest of the drawing away.

/** A shape a board is actually drawn in, widest to tallest. */
export const FRAME_ASPECTS = [
  { key: "2.39:1", ratio: 2.39, hint: "Anamorphic scope" },
  { key: "1.85:1", ratio: 1.85, hint: "Theatrical flat" },
  { key: "16:9", ratio: 16 / 9, hint: "Widescreen, the usual" },
  { key: "16:10", ratio: 16 / 10, hint: "A little taller than 16:9" },
  { key: "3:2", ratio: 3 / 2, hint: "Stills" },
  { key: "4:3", ratio: 4 / 3, hint: "Academy" },
  { key: "1:1", ratio: 1, hint: "Square" },
  { key: "4:5", ratio: 4 / 5, hint: "Portrait social" },
  { key: "9:16", ratio: 9 / 16, hint: "Vertical" },
] as const;

export type FrameAspectKey = (typeof FRAME_ASPECTS)[number]["key"];

/**
 * What a board with nothing stored is drawn in.
 *
 * 16:9, which is also what the print and export view already used. The editor
 * grid used 16:10 and the export used 16:9, so the two disagreed about the
 * same board; standardising here settles that as a side effect.
 */
export const DEFAULT_FRAME_ASPECT: FrameAspectKey = "16:9";

function known(key: string | null | undefined) {
  return FRAME_ASPECTS.find((a) => a.key === key) ?? null;
}

/**
 * The CSS `aspect-ratio` value for a stored key.
 *
 * Returned as a style value rather than a Tailwind class on purpose: an
 * arbitrary class like `aspect-[4/5]` has to exist in the source at build time
 * for the compiler to emit it, and these come from the database.
 */
export function aspectStyle(stored: string | null | undefined): string {
  const found = known(stored) ?? known(DEFAULT_FRAME_ASPECT);
  // Written as the ratio rather than "16 / 9" so a custom value would work too.
  return String(found ? found.ratio : 16 / 9);
}

/** The stored key, or the default, for showing which one is selected. */
export function aspectKey(stored: string | null | undefined): FrameAspectKey {
  return (known(stored)?.key ?? DEFAULT_FRAME_ASPECT) as FrameAspectKey;
}

/** Only a shape we know about is allowed into the column. */
export function isFrameAspect(value: unknown): value is FrameAspectKey {
  return typeof value === "string" && Boolean(known(value));
}

/**
 * The nearest named shape to a measured ratio.
 *
 * Compared in LOG space, because ratios are multiplicative: 2.39 and 1.85 are
 * 0.54 apart in plain arithmetic and so are 1.0 and 0.46, but only the second
 * pair is a wildly different picture. Linear distance would pull every
 * portrait shape toward 1:1.
 */
export function snapAspect(ratio: number): FrameAspectKey {
  if (!Number.isFinite(ratio) || ratio <= 0) return DEFAULT_FRAME_ASPECT;
  let best: (typeof FRAME_ASPECTS)[number] = FRAME_ASPECTS[0];
  let bestGap = Infinity;
  for (const a of FRAME_ASPECTS) {
    const gap = Math.abs(Math.log(ratio / a.ratio));
    if (gap < bestGap) {
      bestGap = gap;
      best = a;
    }
  }
  return best.key;
}

/** Frames within this much of the median count as the same shape. */
const AGREEMENT = 0.08;
/** And this share of them have to agree before we claim a shape. */
const CONSENSUS = 0.7;

/**
 * The shape of an imported board, read off the panels themselves.
 *
 * Returns null when the panels do not agree, rather than picking the median
 * anyway. A mixed board has no single shape, and claiming one would size the
 * grid to a minority of its frames; leaving it null falls back to the default,
 * and object-contain means nothing is cut either way.
 *
 * The rectangles are in rendered page pixels, and the page is rendered at a
 * single uniform scale, so a rectangle's own width over height IS the
 * artwork's aspect ratio. Nothing needs converting.
 */
export function detectFrameAspect(
  rects: { w: number; h: number }[]
): FrameAspectKey | null {
  const ratios = rects
    .filter((r) => r.w > 0 && r.h > 0)
    .map((r) => r.w / r.h)
    .sort((a, b) => a - b);
  if (!ratios.length) return null;

  // Median, not mean: one panel accidentally cut long should not drag the
  // whole board's shape with it.
  const mid = Math.floor(ratios.length / 2);
  const median =
    ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;

  const agree = ratios.filter(
    (r) => Math.abs(Math.log(r / median)) <= AGREEMENT
  ).length;
  if (agree < ratios.length * CONSENSUS) return null;

  return snapAspect(median);
}
