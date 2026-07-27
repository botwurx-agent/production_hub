// Drawn annotations on a paused video frame (or a still), the Frame.io
// signature move: point at the thing instead of describing it.
//
// Strokes are stored NORMALIZED (0..1 of the media box) so a drawing made on a
// laptop replays correctly on a phone, in fullscreen, or on a different cut of
// the same frame. w/h are the aspect the drawing was made at, kept so a replay
// can letterbox identically if it ever needs to.

export type Stroke = {
  color: string;
  size: number;
  points: [number, number][];
};

export type Drawing = {
  w: number;
  h: number;
  strokes: Stroke[];
};

export const DRAW_COLORS = [
  "#ff3b30",
  "#ffcc00",
  "#34c759",
  "#0a84ff",
  "#ffffff",
];

export function isDrawing(value: unknown): value is Drawing {
  if (!value || typeof value !== "object") return false;
  const d = value as Drawing;
  return (
    Array.isArray(d.strokes) &&
    d.strokes.length > 0 &&
    d.strokes.every(
      (s) =>
        typeof s.color === "string" &&
        typeof s.size === "number" &&
        Array.isArray(s.points)
    )
  );
}

// Trims a drawing to something safe to store: caps stroke and point counts and
// clamps every coordinate, so a runaway pointer stream can't bloat a row.
const MAX_STROKES = 60;
const MAX_POINTS = 400;

export function normalizeDrawing(value: unknown): Drawing | null {
  if (!isDrawing(value)) return null;
  const d = value as Drawing;
  const strokes = d.strokes.slice(0, MAX_STROKES).map((s) => ({
    color: DRAW_COLORS.includes(s.color) ? s.color : DRAW_COLORS[0],
    size: Math.max(1, Math.min(24, Math.round(s.size))),
    points: s.points
      .slice(0, MAX_POINTS)
      .filter((p) => Array.isArray(p) && p.length === 2)
      .map(
        (p) =>
          [
            Math.max(0, Math.min(1, Number(p[0]) || 0)),
            Math.max(0, Math.min(1, Number(p[1]) || 0)),
          ] as [number, number]
      ),
  }));
  const kept = strokes.filter((s) => s.points.length > 0);
  if (kept.length === 0) return null;
  return {
    w: Math.max(1, Math.round(Number(d.w) || 16)),
    h: Math.max(1, Math.round(Number(d.h) || 9)),
    strokes: kept,
  };
}
