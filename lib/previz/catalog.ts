// The catalog of things that can go on a Scene Setup set, and the pure rules
// for placing them: footprints, stacking (a bottle on a plate on a table on a
// riser) and what a person can stand on. No three.js here, so the server side
// (the scout photo reader) and the tests can use it. Drawing is in
// lib/previz/set-items.ts.
//
// An item's origin is the centre of its footprint on the floor, and its front
// faces local +Z (toward the camera side at rot 0). `rot` turns it about Y in
// degrees, the same convention as a person's facing. Sizes are real metres:
// w across, d front to back, h tall.

export type ItemCategory = "backdrop" | "set" | "rigging" | "furniture" | "practical" | "prop" | "model";

export type ItemLight = { on: boolean; dimmer: number; cct: number; lumens: number };
export type ItemModel = { key: string; fileName: string; upZ: boolean; unit: string };

export type ItemSpec = {
  id: string;
  kind: string;
  name: string;
  x: number;
  z: number;
  rot: number;
  w: number;
  d: number;
  h: number;
  color: string;
  /** Extra height off whatever it stands on (a wall cabinet, a hung light). */
  raise?: number;
  /** A product photo or label, by asset key (lib/previz/asset-store). */
  label?: string | null;
  model?: ItemModel | null;
  light?: ItemLight | null;
  /** A studio grid's pipe centres, metres. */
  spacing?: number;
  /** Resolved at runtime, never saved: its base height, and who holds it. */
  y?: number;
  heldBy?: string | null;
};

export type CatalogEntry = {
  kind: string;
  name: string;
  category: ItemCategory;
  hint: string;
  w: number;
  d: number;
  h: number;
  color: string;
  round?: boolean;
  /** Something else can stand on it: its top, as a fraction of h. */
  surface?: number;
  /** A person can stand on it (risers, apple boxes). */
  standable?: boolean;
  /** Small enough for somebody to hold in the hand. */
  holdable?: boolean;
  /** Takes a product photo or label. */
  labelled?: boolean;
  /** Hangs from above: `raise` is where it hangs, nothing stacks it. */
  hangs?: boolean;
  raise?: number;
  light?: ItemLight;
  /** Fixed sizes worth one tap (apple boxes, paper rolls, flats). */
  presets?: { label: string; w?: number; d?: number; h?: number }[];
  colors?: { name: string; hex: string }[];
};

const IN = 0.0254;
const FT = 0.3048;

export const PAPER_COLORS = [
  { name: "Super white", hex: "#f4f4f1" },
  { name: "Fashion grey", hex: "#9c9a96" },
  { name: "Thunder grey", hex: "#5d5f62" },
  { name: "Black", hex: "#141414" },
  { name: "Warm beige", hex: "#d8c3a0" },
  { name: "Pale blue", hex: "#a9c4dc" },
  { name: "Deep yellow", hex: "#e8b730" },
  { name: "Red", hex: "#b8262d" },
  { name: "Chroma green", hex: "#2f9b4a" },
  { name: "Chroma blue", hex: "#1f53a8" },
];

const ROLLS = [
  { label: "53 in", w: 53 * IN },
  { label: "107 in (9 ft)", w: 107 * IN },
  { label: "140 in (12 ft)", w: 140 * IN },
];

export const CATALOG: CatalogEntry[] = [
  // Backdrops
  { kind: "seamless", name: "Seamless paper", category: "backdrop", hint: "Paper on two stands, swept onto the floor", w: 107 * IN, d: 2.4, h: 2.95, color: "#f4f4f1", presets: ROLLS, colors: PAPER_COLORS },
  { kind: "cyc", name: "Hard cyc", category: "backdrop", hint: "A painted wall that curves into the floor", w: 6, d: 3.5, h: 4, color: "#f2f1ec", colors: PAPER_COLORS },
  { kind: "muslin", name: "Muslin / canvas", category: "backdrop", hint: "Painted cloth hung from a crossbar", w: 10 * FT, d: 0.4, h: 10 * FT, color: "#7d7b78", presets: [{ label: "10 x 10 ft", w: 10 * FT, h: 10 * FT }, { label: "10 x 20 ft", w: 20 * FT, h: 10 * FT }] },
  { kind: "flat", name: "Flat", category: "backdrop", hint: "A painted 4 x 8 or a custom flat", w: 4 * FT, d: 0.08, h: 8 * FT, color: "#e9e4da", presets: [{ label: "4 x 8 ft", w: 4 * FT, h: 8 * FT }, { label: "4 x 10 ft", w: 4 * FT, h: 10 * FT }, { label: "8 x 8 ft", w: 8 * FT, h: 8 * FT }] },
  { kind: "vflat", name: "V-flat", category: "backdrop", hint: "Two 4 x 8 foam core panels, hinged", w: 1.75, d: 0.9, h: 8 * FT, color: "#f4f4f1", colors: [{ name: "White side", hex: "#f4f4f1" }, { name: "Black side", hex: "#151515" }] },
  // Set pieces
  { kind: "wall", name: "Wall", category: "set", hint: "A section of wall, any size", w: 3, d: 0.12, h: 2.7, color: "#e3ddd2" },
  { kind: "window-flat", name: "Window flat", category: "set", hint: "A wall with a window in it", w: 2.4, d: 0.12, h: 2.7, color: "#e3ddd2" },
  { kind: "door-flat", name: "Door flat", category: "set", hint: "A wall with a door in it", w: 2.0, d: 0.12, h: 2.7, color: "#e3ddd2" },
  { kind: "riser", name: "Riser / stage deck", category: "set", hint: "A platform people can stand on", w: 8 * FT, d: 4 * FT, h: 0.3, color: "#2c2d30", surface: 1, standable: true, presets: [{ label: "4 x 8 x 12 in", w: 8 * FT, d: 4 * FT, h: 12 * IN }, { label: "4 x 8 x 24 in", w: 8 * FT, d: 4 * FT, h: 24 * IN }] },
  { kind: "apple", name: "Apple box", category: "set", hint: "Full, half, quarter or pancake", w: 20 * IN, d: 12 * IN, h: 8 * IN, color: "#b88d5a", surface: 1, standable: true, presets: [{ label: "Full", h: 8 * IN }, { label: "Half", h: 4 * IN }, { label: "Quarter", h: 2 * IN }, { label: "Pancake", h: 1 * IN }] },
  { kind: "plinth", name: "Plinth", category: "set", hint: "A product pedestal", w: 0.4, d: 0.4, h: 1.0, color: "#f2f1ec", surface: 1, standable: true },
  { kind: "rug", name: "Rug", category: "set", hint: "On the floor", w: 2.4, d: 1.7, h: 0.012, color: "#8a5a44", surface: 1 },
  // Rigging: overhead pipe that lights hang from instead of standing on stands
  { kind: "grid", name: "Studio grid", category: "rigging", hint: "Pipe grid overhead; hang lights from it", w: 24 * FT, d: 24 * FT, h: 0.05, color: "#8f959c", hangs: true, raise: 16 * FT, presets: [{ label: "16 x 16 ft", w: 16 * FT, d: 16 * FT }, { label: "24 x 24 ft", w: 24 * FT, d: 24 * FT }, { label: "32 x 40 ft", w: 40 * FT, d: 32 * FT }] },
  { kind: "spreader", name: "Wall spreader", category: "rigging", hint: "A 2x4 held wall to wall by spreader ends", w: 12 * FT, d: 0.038, h: 0.089, color: "#c49a64", hangs: true, raise: 2.4 },
  { kind: "polecat", name: "Polecat", category: "rigging", hint: "Spring-loaded pole, wall to wall, up to about 12 ft", w: 8 * FT, d: 0.045, h: 0.045, color: "#b9bec4", hangs: true, raise: 2.3 },
  // Furniture
  { kind: "dining-table", name: "Dining table", category: "furniture", hint: "Seats four to six", w: 1.6, d: 0.9, h: 0.75, color: "#6a4a34", surface: 1 },
  { kind: "round-table", name: "Round table", category: "furniture", hint: "A cafe or kitchen table", w: 1.0, d: 1.0, h: 0.75, color: "#6a4a34", surface: 1, round: true },
  { kind: "coffee-table", name: "Coffee table", category: "furniture", hint: "Low, in front of a sofa", w: 1.2, d: 0.6, h: 0.42, color: "#5b3e2b", surface: 1 },
  { kind: "desk", name: "Desk", category: "furniture", hint: "Office or study", w: 1.4, d: 0.7, h: 0.75, color: "#d9d2c6", surface: 1 },
  { kind: "counter", name: "Kitchen counter", category: "furniture", hint: "Base cabinets and a worktop", w: 2.4, d: 0.62, h: 0.9, color: "#7f9182", surface: 1 },
  { kind: "island", name: "Kitchen island", category: "furniture", hint: "Free-standing, worktop all round", w: 1.8, d: 0.95, h: 0.92, color: "#3e4a55", surface: 1 },
  { kind: "wall-cabinet", name: "Wall cabinets", category: "furniture", hint: "Hung above a counter", w: 2.4, d: 0.36, h: 0.7, color: "#7f9182", raise: 1.6 },
  { kind: "sideboard", name: "Sideboard", category: "furniture", hint: "Low storage on legs", w: 1.6, d: 0.45, h: 0.8, color: "#8a6748", surface: 1 },
  { kind: "bookcase", name: "Bookcase", category: "furniture", hint: "Shelves with books", w: 0.9, d: 0.35, h: 1.9, color: "#e9e4da" },
  { kind: "chair", name: "Chair", category: "furniture", hint: "Dining chair", w: 0.44, d: 0.46, h: 0.9, color: "#6a4a34", surface: 0.5 },
  { kind: "stool", name: "Bar stool", category: "furniture", hint: "Counter height", w: 0.38, d: 0.38, h: 0.65, color: "#2f3033", surface: 1, round: true },
  { kind: "sofa", name: "Sofa", category: "furniture", hint: "Three seater", w: 2.1, d: 0.92, h: 0.84, color: "#8b8f97", surface: 0.52 },
  { kind: "armchair", name: "Armchair", category: "furniture", hint: "Upholstered", w: 0.86, d: 0.86, h: 0.84, color: "#b58c5e", surface: 0.52 },
  { kind: "bed", name: "Bed", category: "furniture", hint: "Queen", w: 1.6, d: 2.1, h: 0.55, color: "#e9e6df", surface: 1 },
  { kind: "nightstand", name: "Nightstand", category: "furniture", hint: "Beside a bed, one drawer", w: 0.48, d: 0.4, h: 0.58, color: "#8a6748", surface: 1 },
  { kind: "dresser", name: "Dresser", category: "furniture", hint: "Chest of drawers", w: 1.2, d: 0.48, h: 0.82, color: "#d9d2c6", surface: 1 },
  // Bathroom
  { kind: "vanity", name: "Vanity and sink", category: "furniture", hint: "Basin set in a counter", w: 1.0, d: 0.55, h: 0.86, color: "#e9e4da", surface: 1, presets: [{ label: "Single", w: 0.75 }, { label: "Wide", w: 1.0 }, { label: "Double", w: 1.5 }] },
  { kind: "bathtub", name: "Bathtub", category: "furniture", hint: "Built in, 5 ft", w: 1.52, d: 0.76, h: 0.56, color: "#f4f3ef", surface: 1, presets: [{ label: "5 ft", w: 1.52 }, { label: "5.5 ft", w: 1.68 }] },
  { kind: "toilet", name: "Toilet", category: "furniture", hint: "Seat at 16 in", w: 0.38, d: 0.7, h: 0.78, color: "#f4f3ef", surface: 0.53 },
  { kind: "shower", name: "Shower", category: "furniture", hint: "Glass enclosure on a tray", w: 0.9, d: 0.9, h: 2.0, color: "#f4f3ef", presets: [{ label: "3 x 3 ft", w: 0.9, d: 0.9 }, { label: "3 x 5 ft", w: 1.5, d: 0.9 }] },
  { kind: "mirror", name: "Wall mirror", category: "furniture", hint: "On the wall, over a sink or a dresser", w: 0.8, d: 0.03, h: 0.9, color: "#c9d3d8", hangs: true, raise: 1.1 },
  { kind: "towel-rail", name: "Towel rail", category: "furniture", hint: "On the wall, with a towel", w: 0.6, d: 0.1, h: 0.5, color: "#f1ece2", hangs: true, raise: 0.9 },
  { kind: "plant", name: "Plant", category: "furniture", hint: "In a pot", w: 0.5, d: 0.5, h: 1.2, color: "#4e6e45", round: true },
  // Practicals: they light the scene
  { kind: "pendant", name: "Pendant lamp", category: "practical", hint: "Hangs over a table", w: 0.4, d: 0.4, h: 0.25, color: "#2b2b2b", round: true, hangs: true, raise: 1.95, light: { on: true, dimmer: 1, cct: 2700, lumens: 800 } },
  { kind: "floor-lamp", name: "Floor lamp", category: "practical", hint: "Shade on a pole", w: 0.42, d: 0.42, h: 1.6, color: "#e8dfcf", round: true, light: { on: true, dimmer: 1, cct: 2700, lumens: 800 } },
  { kind: "table-lamp", name: "Table lamp", category: "practical", hint: "Sits on a surface", w: 0.3, d: 0.3, h: 0.5, color: "#e8dfcf", round: true, light: { on: true, dimmer: 1, cct: 2700, lumens: 450 } },
  // Props and products
  { kind: "bottle", name: "Bottle", category: "prop", hint: "A product: add your label", w: 0.072, d: 0.072, h: 0.26, color: "#dff2ee", round: true, holdable: true, labelled: true },
  { kind: "can", name: "Can", category: "prop", hint: "A product: add your label", w: 0.066, d: 0.066, h: 0.122, color: "#c8ccd2", round: true, holdable: true, labelled: true, presets: [{ label: "12 oz", w: 0.066, d: 0.066, h: 0.122 }, { label: "16 oz", w: 0.066, d: 0.066, h: 0.157 }, { label: "Slim 12 oz", w: 0.058, d: 0.058, h: 0.157 }] },
  { kind: "carton", name: "Box / carton", category: "prop", hint: "A product: add your packaging", w: 0.16, d: 0.06, h: 0.22, color: "#e7e2d8", holdable: true, labelled: true },
  { kind: "pouch", name: "Pouch", category: "prop", hint: "A product: add your packaging", w: 0.15, d: 0.05, h: 0.22, color: "#e7e2d8", holdable: true, labelled: true },
  { kind: "jar", name: "Jar", category: "prop", hint: "A product: add your label", w: 0.085, d: 0.085, h: 0.11, color: "#e9e1cf", round: true, holdable: true, labelled: true },
  { kind: "mug", name: "Mug", category: "prop", hint: "Coffee mug", w: 0.085, d: 0.085, h: 0.095, color: "#f2f0ea", round: true, holdable: true },
  { kind: "wine-glass", name: "Wine glass", category: "prop", hint: "Stemmed glass", w: 0.085, d: 0.085, h: 0.21, color: "#e8f1f2", round: true, holdable: true },
  { kind: "plate", name: "Plate", category: "prop", hint: "Dinner plate", w: 0.27, d: 0.27, h: 0.025, color: "#f4f2ec", round: true, holdable: true, surface: 1 },
  { kind: "bowl", name: "Bowl", category: "prop", hint: "Serving bowl", w: 0.2, d: 0.2, h: 0.08, color: "#f4f2ec", round: true, holdable: true },
  { kind: "laptop", name: "Laptop", category: "prop", hint: "Open, 14 inch", w: 0.32, d: 0.22, h: 0.21, color: "#9aa0a6", holdable: true },
  { kind: "phone", name: "Phone", category: "prop", hint: "In the hand", w: 0.072, d: 0.008, h: 0.15, color: "#1d1d1f", holdable: true },
  { kind: "box", name: "Box (any size)", category: "prop", hint: "A placeholder for anything", w: 0.4, d: 0.4, h: 0.4, color: "#b9b4ab", surface: 1 },
  // Imported
  { kind: "model", name: "3D model", category: "model", hint: "GLB, OBJ or STL", w: 1, d: 1, h: 1, color: "#b9b4ab" },
];

export const CATEGORIES: { id: ItemCategory; name: string }[] = [
  { id: "backdrop", name: "Backdrops" },
  { id: "set", name: "Set pieces" },
  { id: "rigging", name: "Rigging" },
  { id: "furniture", name: "Furniture" },
  { id: "practical", name: "Practicals" },
  { id: "prop", name: "Props and product" },
  { id: "model", name: "Imported models" },
];

export function catalogOf(kind: string): CatalogEntry {
  return CATALOG.find((c) => c.kind === kind) ?? CATALOG[CATALOG.length - 1];
}

/** A new item of a kind, with the catalog's sizes and colour. */
export function newItem(kind: string, x: number, z: number, id = `i${Date.now()}${Math.floor(Math.random() * 1000)}`): ItemSpec {
  const c = catalogOf(kind);
  return {
    id, kind, name: c.name, x, z, rot: 0, w: c.w, d: c.d, h: c.h, color: c.color,
    raise: c.raise, label: null, model: null, light: c.light ? { ...c.light } : null,
  };
}


/** True when a point sits on an item's footprint. */
export function containsPoint(s: ItemSpec, x: number, z: number, pad = 0): boolean {
  const r = (s.rot * Math.PI) / 180;
  const dx = x - s.x;
  const dz = z - s.z;
  const lx = dx * Math.cos(r) - dz * Math.sin(r);
  const lz = dx * Math.sin(r) + dz * Math.cos(r);
  if (catalogOf(s.kind).round) return Math.hypot(lx / (s.w / 2 + pad), lz / (s.d / 2 + pad)) <= 1;
  return Math.abs(lx) <= s.w / 2 + pad && Math.abs(lz) <= s.d / 2 + pad;
}

/** The footprint's corners in world x/z (a round thing gets its bounding box). */
export function footprint(s: { x: number; z: number; w: number; d: number; rot: number }): { x: number; z: number }[] {
  const r = (s.rot * Math.PI) / 180;
  const pt = (lx: number, lz: number) => ({ x: s.x + lx * Math.cos(r) + lz * Math.sin(r), z: s.z - lx * Math.sin(r) + lz * Math.cos(r) });
  return [pt(-s.w / 2, -s.d / 2), pt(s.w / 2, -s.d / 2), pt(s.w / 2, s.d / 2), pt(-s.w / 2, s.d / 2)];
}

/** Where the top of a surface item is, above its own base. */
export function surfaceTop(s: ItemSpec): number | null {
  const c = catalogOf(s.kind);
  return c.surface === undefined ? null : c.surface * s.h;
}

/**
 * Every item's base height: on the floor, or on top of whatever surface is
 * under its centre (a bottle on a plate on a table on a riser), plus its own
 * raise. Only something bigger can carry a thing, which stops two items from
 * each standing on the other. A hanging item hangs where it is told.
 */
export function stackHeights(items: ItemSpec[]): Map<string, number> {
  const out = new Map<string, number>();
  const area = (s: ItemSpec) => s.w * s.d;
  const base = (s: ItemSpec, depth: number): number => {
    const known = out.get(s.id);
    if (known !== undefined) return known;
    const c = catalogOf(s.kind);
    if (c.hangs) {
      // Stored like everything else. It used to be returned without being
      // recorded, so every hanging thing (the pendant included) was placed
      // with no height at all and drawn on the floor.
      const v = s.raise ?? c.raise ?? 2;
      out.set(s.id, v);
      return v;
    }
    let y = 0;
    if (depth < 6) {
      for (const o of items) {
        if (o.id === s.id || area(o) <= area(s)) continue;
        const top = surfaceTop(o);
        if (top === null || !containsPoint(o, s.x, s.z)) continue;
        y = Math.max(y, base(o, depth + 1) + top);
      }
    }
    const v = y + (s.raise ?? 0);
    out.set(s.id, v);
    return v;
  };
  for (const s of items) base(s, 0);
  return out;
}

/** Lowest top that reads as a seat (a pancake or a plate is not one). */
const MIN_SEAT = 0.2;

/**
 * What a seated person at (x, z) sits on: the highest surface under them (a
 * bed, a sofa, a chair, an apple box), as a world height. Null when nothing
 * is there, and the caller falls back to an implied chair.
 */
export function seatUnder(items: ItemSpec[], heights: Map<string, number>, x: number, z: number): { y: number; id: string; name: string } | null {
  let best: { y: number; id: string; name: string } | null = null;
  for (const s of items) {
    const c = catalogOf(s.kind);
    if (c.category === "backdrop" || c.hangs || s.kind === "rug") continue;
    const top = surfaceTop(s);
    if (top === null || top < MIN_SEAT || !containsPoint(s, x, z, 0.03)) continue;
    const y = (heights.get(s.id) ?? 0) + top;
    if (!best || y > best.y) best = { y, id: s.id, name: c.name };
  }
  return best;
}

/** Where a seated person's feet land at (x, z): the floor, or whatever is there. */
export function groundUnder(items: ItemSpec[], heights: Map<string, number>, x: number, z: number): number {
  let y = 0;
  for (const s of items) {
    const c = catalogOf(s.kind);
    if (c.category === "backdrop" || c.hangs) continue;
    const top = surfaceTop(s);
    if (top === null || !containsPoint(s, x, z, 0.02)) continue;
    y = Math.max(y, (heights.get(s.id) ?? 0) + top);
  }
  return y;
}

/** The height a person standing at (x, z) is lifted by: a riser or an apple box. */
export function standHeight(items: ItemSpec[], heights: Map<string, number>, x: number, z: number): number {
  let y = 0;
  for (const s of items) {
    if (!catalogOf(s.kind).standable || !containsPoint(s, x, z, 0.05)) continue;
    y = Math.max(y, (heights.get(s.id) ?? 0) + s.h);
  }
  return y;
}

