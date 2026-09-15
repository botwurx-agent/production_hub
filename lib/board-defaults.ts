import { serializeShapeData, shapeDef } from "@/lib/board-shape";

/**
 * What a newly created board card is made of, in ONE place.
 *
 * This exists because the canvas now places a card the instant you drop it,
 * before the server has answered, so the browser has to build the same row the
 * database is about to. Two copies of "a note is 220x160 and yellow" would
 * drift on the first change, and the symptom would be nasty rather than
 * obvious: the card would appear at one size and then silently resize itself a
 * few hundred milliseconds later when the real row arrived.
 *
 * So the server actions in app/(app)/boards/actions.ts spread these into their
 * inserts, and the workspace spreads the same values into its optimistic row.
 * Change a default here and both sides move together.
 *
 * NOT included: x, y, z, sort, parent_id and the ownership columns. Those are
 * per-placement or server-derived and belong to the caller.
 */
export type NewItemFields = {
  kind: string;
  name: string | null;
  text: string | null;
  hue: string | null;
  w: number;
  h: number;
};

/** The kinds a rail tool can drop straight onto the canvas. */
export type DroppableKind = "note" | "todo" | "column" | "heading" | "color" | "shape";

export const DEFAULT_COLOR_CARD = "#6366F1";

/**
 * A card holding a file (an image, a video, an imported frame).
 *
 * Here for the same reason as the rest of this file: an uploaded image is now
 * drawn from the browser's own copy of the bytes before the row exists, so both
 * sides have to agree on how big the card is or it would resize itself a moment
 * after appearing.
 */
export const DEFAULT_MEDIA_W = 260;
export const DEFAULT_MEDIA_H = 200;

export function newItemFields(kind: DroppableKind, shape?: string): NewItemFields {
  switch (kind) {
    case "note":
      return { kind: "note", name: null, text: "", hue: "yellow", w: 220, h: 160 };
    case "todo":
      return { kind: "todo", name: null, text: "[]", hue: "blue", w: 240, h: 200 };
    case "column":
      return { kind: "column", name: "Column", text: null, hue: null, w: 260, h: 320 };
    case "heading":
      return { kind: "heading", name: null, text: "", hue: null, w: 360, h: 60 };
    case "color":
      return {
        kind: "color",
        name: null,
        text: DEFAULT_COLOR_CARD,
        hue: null,
        w: 160,
        h: 160,
      };
    case "shape": {
      // An unknown key becomes a rectangle rather than an error or an
      // invisible card, which is what the server has always done.
      const def = shapeDef(shape ?? "rect");
      return {
        kind: "shape",
        name: null,
        text: serializeShapeData({ shape: def.key }),
        hue: "blue",
        w: def.w,
        h: def.h,
      };
    }
  }
}

const DROPPABLE: DroppableKind[] = ["note", "todo", "column", "heading", "color", "shape"];

/** Narrows a rail tool's kind string, so a new tool cannot silently fall through. */
export function isDroppableKind(kind: string): kind is DroppableKind {
  return (DROPPABLE as string[]).includes(kind);
}
