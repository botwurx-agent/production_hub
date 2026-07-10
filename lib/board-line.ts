// Standalone line/arrow objects on a board. Unlike a connection (which ties two
// cards), a line is its own board_items row (kind='line') whose endpoints and
// style live as JSON in the item's `text`.

export type LineData = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  // Bend: the on-curve midpoint's offset from the straight midpoint. 0,0 = a
  // straight line; dragging the mid handle sets this and curves the line.
  bendX: number;
  bendY: number;
  color: string; // a LINE_COLORS key
  weight: number; // stroke width
  dashed: boolean;
  startArrow: boolean;
  endArrow: boolean;
  label: string;
};

// SVG path for a line, quadratic through the bent midpoint. The curve passes
// through P = mid(A,B) + bend at t=0.5, so the control point is mid + 2*bend.
export function lineSvgPath(d: LineData): string {
  const mx = (d.ax + d.bx) / 2;
  const my = (d.ay + d.by) / 2;
  if (d.bendX === 0 && d.bendY === 0) {
    return `M ${d.ax} ${d.ay} L ${d.bx} ${d.by}`;
  }
  const cx = mx + 2 * d.bendX;
  const cy = my + 2 * d.bendY;
  return `M ${d.ax} ${d.ay} Q ${cx} ${cy} ${d.bx} ${d.by}`;
}

// The on-curve midpoint (where the bend handle sits / the label rides).
export function lineMidPoint(d: LineData): { x: number; y: number } {
  return {
    x: (d.ax + d.bx) / 2 + d.bendX,
    y: (d.ay + d.by) / 2 + d.bendY,
  };
}

function num(v: unknown, d: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

export function parseLineData(text: string | null): LineData {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(text || "{}") as Record<string, unknown>;
  } catch {
    raw = {};
  }
  return {
    ax: num(raw.ax, 0),
    ay: num(raw.ay, 0),
    bx: num(raw.bx, 160),
    by: num(raw.by, 0),
    bendX: num(raw.bendX, 0),
    bendY: num(raw.bendY, 0),
    color: typeof raw.color === "string" ? raw.color : "slate",
    weight: num(raw.weight, 2),
    dashed: Boolean(raw.dashed),
    startArrow: Boolean(raw.startArrow),
    endArrow: raw.endArrow !== false,
    label: typeof raw.label === "string" ? raw.label : "",
  };
}

export const LINE_COLORS: { key: string; var: string }[] = [
  { key: "slate", var: "var(--text-muted)" },
  { key: "blue", var: "var(--h-blue)" },
  { key: "green", var: "var(--h-green)" },
  { key: "amber", var: "var(--h-amber)" },
  { key: "red", var: "var(--h-red)" },
  { key: "purple", var: "var(--h-purple)" },
  { key: "pink", var: "var(--h-pink)" },
];

export function lineColorVar(key: string): string {
  return LINE_COLORS.find((c) => c.key === key)?.var ?? "var(--text-muted)";
}

export const LINE_WEIGHTS = [2, 3.5, 6];
