// Standalone line/arrow objects on a board. Unlike a connection (which ties two
// cards), a line is its own board_items row (kind='line') whose endpoints and
// style live as JSON in the item's `text`.

export type LineData = {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  color: string; // a LINE_COLORS key
  weight: number; // stroke width
  dashed: boolean;
  startArrow: boolean;
  endArrow: boolean;
  label: string;
};

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
