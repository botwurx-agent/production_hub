// How far a board's content actually reaches.
//
// The canvas used to be a FIXED 2400x1600 box, which produced two symptoms
// that read as separate bugs and are one: the dot pattern is painted on that
// box, so it stopped dead partway down, and the scroll area was that box, so
// there was nowhere left to drag to. Dragging clamps at 0 but deliberately not
// at the far edge, so a card pushed past 1600 ended up sitting on bare surface
// below the dots with the scrollbar already at its end.
//
// So the canvas is sized from its content instead, and this is the pure half
// of that: the furthest right and bottom edge anything reaches. The caller adds
// the headroom and applies the floor.
//
// STORED GEOMETRY IS NOT THE WHOLE ANSWER and this module does not pretend
// otherwise. A COLUMN's height is not its `h` (it flows from its children), and
// a heading can draw taller than its box. Those are measured from the DOM after
// layout, which is exact; this pass exists because it is instant, so the canvas
// grows WHILE a card is being dragged toward the edge rather than a frame later.

import { parseLineData } from "@/lib/board-line";

/** Anything with a stored box on the canvas. */
export type ExtentItem = {
  kind: string;
  /** Set when the item flows inside a column, in which case x/y mean nothing. */
  parentId: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string | null;
};

export type Extent = { w: number; h: number };

function fin(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/**
 * The furthest edge content reaches, in canvas pixels. No padding, no floor.
 *
 * A PARENTED item is skipped: it flows inside its column, so its stored x and
 * y are whatever they were before it was filed and would drag the extent to a
 * place nothing is drawn. The column itself is measured instead.
 */
export function boardExtent(items: ExtentItem[]): Extent {
  let w = 0;
  let h = 0;
  for (const it of items) {
    if (it.parentId) continue;
    if (it.kind === "line") {
      // A line carries its endpoints in `text`, not in x/y/w/h, so a line
      // dragged low would otherwise leave the canvas short exactly where it is.
      const d = parseLineData(it.text);
      w = Math.max(w, fin(d.ax), fin(d.bx));
      h = Math.max(h, fin(d.ay), fin(d.by));
      continue;
    }
    w = Math.max(w, fin(it.x) + Math.max(0, fin(it.w)));
    h = Math.max(h, fin(it.y) + Math.max(0, fin(it.h)));
  }
  return { w, h };
}
