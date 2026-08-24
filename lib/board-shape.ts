// Shape cards for boards (Freeform-style). A shape is an ordinary board_items
// row with kind='shape': which shape it is lives as JSON in `text`
// (parse/serialize below), the fill color in `hue` (a hue token key or a raw
// #hex, same vocabulary the note box uses), and an optional centered label in
// `name`. No migration: kind and text were always free-form.
//
// Geometry is computed from the card's REAL width and height (not stretched
// from a fixed viewBox), so corner radii and angles stay true at any size.

export type ShapeDef = {
  key: string;
  label: string;
  // Default card size when the shape is added.
  w: number;
  h: number;
};

export const SHAPES: ShapeDef[] = [
  { key: "rect", label: "Rectangle", w: 200, h: 140 },
  { key: "rounded", label: "Rounded rectangle", w: 200, h: 140 },
  { key: "ellipse", label: "Ellipse", w: 170, h: 140 },
  { key: "pill", label: "Pill", w: 200, h: 90 },
  { key: "triangle", label: "Triangle", w: 170, h: 150 },
  { key: "diamond", label: "Diamond", w: 170, h: 150 },
  { key: "parallelogram", label: "Parallelogram", w: 200, h: 130 },
  { key: "trapezoid", label: "Trapezoid", w: 200, h: 130 },
  { key: "pentagon", label: "Pentagon", w: 160, h: 150 },
  { key: "hexagon", label: "Hexagon", w: 180, h: 150 },
  { key: "octagon", label: "Octagon", w: 160, h: 160 },
  { key: "star", label: "Star", w: 170, h: 160 },
  { key: "arrow", label: "Arrow", w: 200, h: 110 },
  { key: "chevron", label: "Chevron", w: 190, h: 120 },
  { key: "plus", label: "Cross", w: 160, h: 160 },
  { key: "cylinder", label: "Cylinder", w: 150, h: 180 },
  { key: "cloud", label: "Cloud", w: 200, h: 140 },
  { key: "speech", label: "Speech bubble", w: 190, h: 150 },
  { key: "heart", label: "Heart", w: 170, h: 160 },
];

export function shapeDef(key: string): ShapeDef {
  return SHAPES.find((s) => s.key === key) ?? SHAPES[0];
}

export type ShapeData = { shape: string };

export function parseShapeData(text: string | null): ShapeData {
  if (!text) return { shape: "rect" };
  try {
    const o = JSON.parse(text);
    const shape = typeof o?.shape === "string" ? o.shape : "rect";
    // Unknown keys degrade to a rectangle rather than an invisible card.
    return { shape: SHAPES.some((s) => s.key === shape) ? shape : "rect" };
  } catch {
    return { shape: "rect" };
  }
}

export function serializeShapeData(d: ShapeData): string {
  return JSON.stringify({ shape: d.shape });
}

// ---- Fill / label colors ----------------------------------------------------

export function isLightHex(hex: string): boolean {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

export function shapeFill(hue: string | null): string {
  if (!hue) return "var(--h-blue)";
  if (hue.startsWith("#")) return hue;
  return `var(--h-${hue})`;
}

// Hue tokens light enough to need dark label text on a solid fill.
const LIGHT_TOKENS = new Set(["yellow", "amber", "cyan"]);

export function shapeLabelColor(hue: string | null): string {
  const dark = "rgba(0,0,0,0.72)";
  const light = "rgba(255,255,255,0.95)";
  if (!hue) return light;
  if (hue.startsWith("#")) return isLightHex(hue) ? dark : light;
  return LIGHT_TOKENS.has(hue) ? dark : light;
}

// ---- Geometry ----------------------------------------------------------------

export type ShapePath = {
  d: string;
  // A lighter accent drawn over the fill (the cylinder's top face).
  overlay?: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function poly(pts: [number, number][]): string {
  return (
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${r2(x)} ${r2(y)}`).join(" ") +
    " Z"
  );
}

// n points around the ellipse inscribed in the box, starting from the top.
function radial(w: number, h: number, n: number, inner?: number): [number, number][] {
  const cx = w / 2;
  const cy = h / 2;
  const pts: [number, number][] = [];
  const steps = inner ? n * 2 : n;
  for (let i = 0; i < steps; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / steps;
    const k = inner && i % 2 === 1 ? inner : 1;
    pts.push([cx + (w / 2) * k * Math.cos(a), cy + (h / 2) * k * Math.sin(a)]);
  }
  return pts;
}

// Drawn CLOCKWISE (sweep=1) on purpose: the cloud unions ellipse subpaths with
// a clockwise rectangle in one path, and opposite windings cancel where they
// overlap, which renders as holes instead of a union.
function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${r2(cx - rx)} ${r2(cy)} a ${r2(rx)} ${r2(ry)} 0 1 1 ${r2(rx * 2)} 0 a ${r2(rx)} ${r2(ry)} 0 1 1 ${r2(-rx * 2)} 0 Z`;
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M ${r2(x + rr)} ${r2(y)}`,
    `H ${r2(x + w - rr)}`,
    `Q ${r2(x + w)} ${r2(y)} ${r2(x + w)} ${r2(y + rr)}`,
    `V ${r2(y + h - rr)}`,
    `Q ${r2(x + w)} ${r2(y + h)} ${r2(x + w - rr)} ${r2(y + h)}`,
    `H ${r2(x + rr)}`,
    `Q ${r2(x)} ${r2(y + h)} ${r2(x)} ${r2(y + h - rr)}`,
    `V ${r2(y + rr)}`,
    `Q ${r2(x)} ${r2(y)} ${r2(x + rr)} ${r2(y)}`,
    "Z",
  ].join(" ");
}

// Heart template (classic 32 x 29.6 path), scaled to the box.
const HEART: [number, number][][] = [
  // [cp1, cp2, end] triples of cubic segments from M(23.6, 0)
  [[20.2, 0], [17.3, 2.7], [16, 5.6]],
  [[14.7, 2.7], [11.8, 0], [8.4, 0]],
  [[3.8, 0], [0, 3.8], [0, 8.4]],
  [[0, 17.8], [9.5, 20.3], [16, 29.6]],
  [[22.1, 20.3], [32, 17.5], [32, 8.4]],
  [[32, 3.8], [28.2, 0], [23.6, 0]],
];

export function shapePaths(key: string, w: number, h: number): ShapePath[] {
  switch (key) {
    case "rounded":
      return [{ d: roundedRectPath(0, 0, w, h, Math.min(w, h) * 0.16) }];
    case "ellipse":
      return [{ d: ellipsePath(w / 2, h / 2, w / 2, h / 2) }];
    case "pill": {
      const r = Math.min(h / 2, w / 2);
      return [
        {
          d: `M ${r2(r)} 0 H ${r2(w - r)} A ${r2(r)} ${r2(h / 2)} 0 0 1 ${r2(w - r)} ${r2(h)} H ${r2(r)} A ${r2(r)} ${r2(h / 2)} 0 0 1 ${r2(r)} 0 Z`,
        },
      ];
    }
    case "triangle":
      return [{ d: poly([[w / 2, 0], [w, h], [0, h]]) }];
    case "diamond":
      return [{ d: poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]) }];
    case "parallelogram": {
      const o = w * 0.22;
      return [{ d: poly([[o, 0], [w, 0], [w - o, h], [0, h]]) }];
    }
    case "trapezoid": {
      const o = w * 0.2;
      return [{ d: poly([[o, 0], [w - o, 0], [w, h], [0, h]]) }];
    }
    case "pentagon":
      return [{ d: poly(radial(w, h, 5)) }];
    case "hexagon":
      return [
        {
          d: poly([
            [w * 0.25, 0],
            [w * 0.75, 0],
            [w, h / 2],
            [w * 0.75, h],
            [w * 0.25, h],
            [0, h / 2],
          ]),
        },
      ];
    case "octagon": {
      const c = 0.29;
      return [
        {
          d: poly([
            [w * c, 0],
            [w * (1 - c), 0],
            [w, h * c],
            [w, h * (1 - c)],
            [w * (1 - c), h],
            [w * c, h],
            [0, h * (1 - c)],
            [0, h * c],
          ]),
        },
      ];
    }
    case "star":
      return [{ d: poly(radial(w, h, 5, 0.42)) }];
    case "arrow": {
      const s = 0.62;
      return [
        {
          d: poly([
            [0, h * 0.25],
            [w * s, h * 0.25],
            [w * s, 0],
            [w, h / 2],
            [w * s, h],
            [w * s, h * 0.75],
            [0, h * 0.75],
          ]),
        },
      ];
    }
    case "chevron":
      return [
        {
          d: poly([
            [0, 0],
            [w * 0.75, 0],
            [w, h / 2],
            [w * 0.75, h],
            [0, h],
            [w * 0.25, h / 2],
          ]),
        },
      ];
    case "plus": {
      const a = 0.35;
      return [
        {
          d: poly([
            [w * a, 0],
            [w * (1 - a), 0],
            [w * (1 - a), h * a],
            [w, h * a],
            [w, h * (1 - a)],
            [w * (1 - a), h * (1 - a)],
            [w * (1 - a), h],
            [w * a, h],
            [w * a, h * (1 - a)],
            [0, h * (1 - a)],
            [0, h * a],
            [w * a, h * a],
          ]),
        },
      ];
    }
    case "cylinder": {
      const ry = Math.min(h * 0.16, w * 0.3);
      return [
        {
          d: `M 0 ${r2(ry)} A ${r2(w / 2)} ${r2(ry)} 0 0 1 ${r2(w)} ${r2(ry)} V ${r2(h - ry)} A ${r2(w / 2)} ${r2(ry)} 0 0 1 0 ${r2(h - ry)} Z`,
        },
        { d: ellipsePath(w / 2, ry, w / 2, ry), overlay: true },
      ];
    }
    case "cloud":
      return [
        {
          d: [
            ellipsePath(w * 0.28, h * 0.62, w * 0.2, h * 0.3),
            ellipsePath(w * 0.52, h * 0.45, w * 0.24, h * 0.38),
            ellipsePath(w * 0.74, h * 0.62, w * 0.18, h * 0.28),
            roundedRectPath(w * 0.1, h * 0.62, w * 0.8, h * 0.3, Math.min(w, h) * 0.09),
          ].join(" "),
        },
      ];
    case "speech": {
      const body = roundedRectPath(0, 0, w, h * 0.72, Math.min(w, h) * 0.12);
      const tail = poly([
        [w * 0.22, h * 0.7],
        [w * 0.42, h * 0.7],
        [w * 0.26, h * 0.97],
      ]);
      return [{ d: `${body} ${tail}` }];
    }
    case "heart": {
      const sx = w / 32;
      const sy = h / 29.6;
      let d = `M ${r2(23.6 * sx)} 0`;
      for (const [c1, c2, e] of HEART) {
        d += ` C ${r2(c1[0] * sx)} ${r2(c1[1] * sy)} ${r2(c2[0] * sx)} ${r2(c2[1] * sy)} ${r2(e[0] * sx)} ${r2(e[1] * sy)}`;
      }
      return [{ d: `${d} Z` }];
    }
    case "rect":
    default:
      return [{ d: `M 0 0 H ${r2(w)} V ${r2(h)} H 0 Z` }];
  }
}
