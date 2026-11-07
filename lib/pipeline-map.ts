// The pipeline map: everything already on an AI job, drawn as a graph.
//
// Pure on purpose (no "server-only", no React) so the layout and the lineage
// rules can be tested in the scratchpad. The map ORGANIZES what exists; it
// never generates. Every arrow comes from data the pipeline already records:
//   element -> shot        ai_shot_cast (which references a shot uses)
//   shot -> generation     a generation with no recorded input came from the
//                          shot's own prompt, so the shot is its source
//   generation -> generation  parent_start_id / parent_end_id and
//                          ai_generation_refs (start, end, motion, style, ...)
//   take -> master cut     the take picked on a shot feeds the assembled cut
//
// LAYOUT IS AUTOMATIC and positions can be overridden by dragging. Overrides
// are keyed by node id, so a node that disappears takes its override with it
// and a new node lands in its automatic place.

export type MapNodeType = "element" | "shot" | "image" | "video" | "audio" | "cut";

export type MapShot = {
  id: string;
  position: number;
  title: string;
  status: string;
  method: string;
  stage: string;
  input_mode: string | null;
};

export type MapGeneration = {
  id: string;
  shot_id: string;
  stage: string;
  kind: string;
  status: string; // candidate | approved | rejected | reference
  role: string | null; // start | end | take | final | character/style/... on a reference
  starred: boolean | null;
  platform: string | null;
  model: string | null;
  prompt: string | null;
  parent_start_id: string | null;
  parent_end_id: string | null;
  created_at: string;
};

export type MapRef = { generation_id: string; ref_generation_id: string; role: string };
export type MapElement = { id: string; name: string; kind: string };
export type MapUse = { shot_id: string; entity_id: string };
export type MapCutVersion = { id: string; version_number: number; review: "pending" | "changes" | "approved" | null };

export type MapInput = {
  shots: MapShot[];
  generations: MapGeneration[];
  refs: MapRef[];
  elements: MapElement[];
  uses: MapUse[];
  cut: { name: string; versions: MapCutVersion[] } | null;
  reviewingShotIds?: string[];
};

export type MapOptions = {
  /** Rejected candidates fold away by default: forty options on one shot would bury the chain that matters. */
  showRejected?: boolean;
  showElements?: boolean;
  /** Only this shot's lane (plus the elements it uses and the cut). */
  shotId?: string | null;
};

/** What a node is, in words, plus the hue its dot carries. */
export type MapState = { label: string; hue: string };

export type MapNode = {
  id: string;
  type: MapNodeType;
  title: string;
  sub: string | null;
  state: MapState | null;
  starred: boolean;
  shotId: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MapEdge = {
  id: string;
  from: string;
  to: string;
  /** uses | prompt | start | end | motion | style | character | ref | take */
  role: string;
};

export type MapGraph = {
  nodes: MapNode[];
  edges: MapEdge[];
  width: number;
  height: number;
  /** How many rejected candidates are folded away, so the toggle can say so. */
  hiddenRejected: number;
};

// Geometry, in canvas pixels at 100%.
export const NODE_W = 168;
export const MEDIA_H = 132; // thumbnail tile with a caption
export const SHOT_H = 92;
export const ELEMENT_H = 82;
const COL_GAP = 96;
const ROW_GAP = 22;
const LANE_GAP = 56;
const PAD = 40;

const COLS: MapNodeType[] = ["element", "shot", "image", "video", "cut"];

function colX(type: MapNodeType, showElements: boolean): number {
  const cols = showElements ? COLS : COLS.filter((c) => c !== "element");
  const key = type === "audio" ? "video" : type;
  const i = cols.indexOf(key);
  return PAD + Math.max(0, i) * (NODE_W + COL_GAP);
}

export function generationType(g: Pick<MapGeneration, "kind" | "stage">): MapNodeType {
  if (g.kind === "audio" || g.stage === "audio") return "audio";
  if (g.kind === "video") return "video";
  return "image";
}

/** The state chip, in production words. Order matters: the strongest fact wins. */
export function generationState(g: MapGeneration): MapState {
  if (g.status === "reference") return { label: refRoleLabel(g.role) ?? "Reference", hue: "cyan" };
  if (g.status === "rejected") return { label: "Rejected", hue: "red" };
  if (g.role === "take" || g.role === "final") return { label: "Picked take", hue: "green" };
  if (g.role === "start") return { label: "Start frame", hue: "green" };
  if (g.role === "end") return { label: "End frame", hue: "blue" };
  if (g.status === "approved") return { label: "Approved", hue: "green" };
  if (g.starred) return { label: "Shortlisted", hue: "amber" };
  return { label: "Candidate", hue: "indigo" };
}

function refRoleLabel(role: string | null): string | null {
  switch (role) {
    case "motion": return "Motion ref";
    case "style": return "Style ref";
    case "character": return "Character ref";
    case "element": return "Element ref";
    case "ref": return "Reference";
    default: return null;
  }
}

export function shotState(s: MapShot, reviewing: boolean): MapState {
  if (s.status === "approved") return { label: "Approved", hue: "green" };
  if (reviewing) return { label: "In review", hue: "amber" };
  if (s.method === "live") return { label: "Live action", hue: "orange" };
  return { label: stageWord(s.stage), hue: "purple" };
}

function stageWord(stage: string): string {
  switch (stage) {
    case "image": return "Images";
    case "video": return "Video";
    case "audio": return "Voiceover";
    case "done": return "Done";
    default: return stage ? stage[0].toUpperCase() + stage.slice(1) : "In progress";
  }
}

function cutState(v: MapCutVersion | undefined): MapState | null {
  if (!v) return { label: "No version yet", hue: "indigo" };
  if (v.review === "approved") return { label: `v${v.version_number} approved`, hue: "green" };
  if (v.review === "changes") return { label: `v${v.version_number} changes`, hue: "amber" };
  if (v.review === "pending") return { label: `v${v.version_number} in review`, hue: "amber" };
  return { label: `v${v.version_number}`, hue: "indigo" };
}

function shortModel(g: MapGeneration): string | null {
  const bits = [g.platform, g.model].filter(Boolean) as string[];
  if (!bits.length) return null;
  // "Higgsfield · seedance_2_5" reads better as "Higgsfield · Seedance 2 5".
  return bits
    .map((b) => b.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" · ");
}

/** Every recorded input of a generation, de-duplicated, with its role. */
export function inputsOf(g: MapGeneration, refs: MapRef[]): { id: string; role: string }[] {
  const out = new Map<string, string>();
  for (const r of refs) if (r.generation_id === g.id && !out.has(r.ref_generation_id)) out.set(r.ref_generation_id, r.role || "ref");
  if (g.parent_start_id && !out.has(g.parent_start_id)) out.set(g.parent_start_id, "start");
  if (g.parent_end_id && !out.has(g.parent_end_id)) out.set(g.parent_end_id, "end");
  return [...out].map(([id, role]) => ({ id, role }));
}

export function buildMap(input: MapInput, opts: MapOptions = {}): MapGraph {
  const showElements = opts.showElements ?? true;
  const showRejected = opts.showRejected ?? false;
  const reviewing = new Set(input.reviewingShotIds ?? []);

  const shots = [...input.shots]
    .sort((a, b) => a.position - b.position)
    .filter((s) => !opts.shotId || s.id === opts.shotId);
  const shotIds = new Set(shots.map((s) => s.id));

  const allGens = input.generations.filter((g) => shotIds.has(g.shot_id));
  // A rejected candidate that something else was built FROM stays visible:
  // hiding it would leave an arrow pointing at nothing.
  const usedAsInput = new Set<string>();
  for (const g of allGens) for (const i of inputsOf(g, input.refs)) usedAsInput.add(i.id);
  const gens = allGens.filter((g) => showRejected || g.status !== "rejected" || usedAsInput.has(g.id));
  const hiddenRejected = allGens.length - gens.length;
  const genIds = new Set(gens.map((g) => g.id));

  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];

  // Lanes: one per shot, as tall as its tallest column.
  let y = PAD;
  const laneMid = new Map<string, number>();
  for (const s of shots) {
    const mine = gens
      .filter((g) => g.shot_id === s.id)
      .sort((a, b) => rank(a) - rank(b) || a.created_at.localeCompare(b.created_at));
    const images = mine.filter((g) => generationType(g) === "image");
    const videos = mine.filter((g) => generationType(g) !== "image");
    const rows = Math.max(1, images.length, videos.length);
    const laneH = rows * MEDIA_H + (rows - 1) * ROW_GAP;
    const mid = y + laneH / 2;
    laneMid.set(s.id, mid);

    nodes.push({
      id: `shot:${s.id}`,
      type: "shot",
      title: `${s.position + 1}. ${s.title || "Untitled shot"}`,
      sub: null,
      state: shotState(s, reviewing.has(s.id)),
      starred: false,
      shotId: s.id,
      x: colX("shot", showElements),
      y: mid - SHOT_H / 2,
      w: NODE_W,
      h: SHOT_H,
    });

    const place = (list: MapGeneration[], type: MapNodeType) => {
      const h = list.length * MEDIA_H + Math.max(0, list.length - 1) * ROW_GAP;
      let gy = mid - h / 2;
      for (const g of list) {
        nodes.push({
          id: `gen:${g.id}`,
          type: generationType(g),
          title: shortModel(g) ?? (g.kind === "video" ? "Video" : g.kind === "audio" ? "Voiceover" : "Image"),
          sub: g.prompt ? g.prompt.slice(0, 80) : null,
          state: generationState(g),
          starred: !!g.starred,
          shotId: s.id,
          x: colX(type, showElements),
          y: gy,
          w: NODE_W,
          h: MEDIA_H,
        });
        gy += MEDIA_H + ROW_GAP;
      }
    };
    place(images, "image");
    place(videos, "video");

    for (const g of mine) {
      const ins = inputsOf(g, input.refs).filter((i) => genIds.has(i.id));
      // A reference is an input itself; it hangs off the shot it was added to.
      if (!ins.length) {
        edges.push({ id: `p:${g.id}`, from: `shot:${s.id}`, to: `gen:${g.id}`, role: g.status === "reference" ? "ref" : "prompt" });
      }
      for (const i of ins) edges.push({ id: `i:${i.id}>${g.id}`, from: `gen:${i.id}`, to: `gen:${g.id}`, role: i.role });
    }

    y += laneH + LANE_GAP;
  }

  // Elements sit beside the shots that use them (the average of those lanes),
  // then are pushed apart so none overlap.
  if (showElements) {
    const usedBy = new Map<string, string[]>();
    for (const u of input.uses) {
      if (!shotIds.has(u.shot_id)) continue;
      usedBy.set(u.entity_id, [...(usedBy.get(u.entity_id) ?? []), u.shot_id]);
    }
    const placed = input.elements
      .filter((e) => usedBy.has(e.id) || !opts.shotId)
      .map((e) => {
        const lanes = (usedBy.get(e.id) ?? []).map((id) => laneMid.get(id) ?? PAD);
        const target = lanes.length ? lanes.reduce((a, b) => a + b, 0) / lanes.length : Number.POSITIVE_INFINITY;
        return { e, target, count: lanes.length };
      })
      .sort((a, b) => a.target - b.target || a.e.name.localeCompare(b.e.name));
    let floor = PAD;
    for (const { e, target, count } of placed) {
      const want = Number.isFinite(target) ? target - ELEMENT_H / 2 : floor;
      const ey = Math.max(floor, want);
      nodes.push({
        id: `el:${e.id}`,
        type: "element",
        title: e.name,
        sub: count ? `Used in ${count} shot${count === 1 ? "" : "s"}` : "Not used yet",
        state: { label: elementWord(e.kind), hue: "cyan" },
        starred: false,
        shotId: null,
        x: colX("element", true),
        y: ey,
        w: NODE_W,
        h: ELEMENT_H,
      });
      floor = ey + ELEMENT_H + 14;
      for (const sid of usedBy.get(e.id) ?? []) {
        edges.push({ id: `u:${e.id}>${sid}`, from: `el:${e.id}`, to: `shot:${sid}`, role: "uses" });
      }
    }
    y = Math.max(y, floor + LANE_GAP);
  }

  // The master cut, in the middle of everything that feeds it.
  if (input.cut) {
    const latest = [...input.cut.versions].sort((a, b) => b.version_number - a.version_number)[0];
    const takes = gens.filter((g) => g.role === "take" || g.role === "final");
    const fed = takes.map((t) => nodes.find((n) => n.id === `gen:${t.id}`)).filter(Boolean) as MapNode[];
    const mid = fed.length
      ? fed.reduce((a, n) => a + n.y + n.h / 2, 0) / fed.length
      : (PAD + y - LANE_GAP) / 2;
    nodes.push({
      id: "cut",
      type: "cut",
      title: input.cut.name || "Master cut",
      sub: input.cut.versions.length ? `${input.cut.versions.length} version${input.cut.versions.length === 1 ? "" : "s"}` : null,
      state: cutState(latest),
      starred: false,
      shotId: null,
      x: colX("cut", showElements),
      y: Math.max(PAD, mid - MEDIA_H / 2),
      w: NODE_W,
      h: MEDIA_H,
    });
    for (const t of takes) edges.push({ id: `c:${t.id}`, from: `gen:${t.id}`, to: "cut", role: "take" });
  }

  const width = Math.max(...nodes.map((n) => n.x + n.w), 600) + PAD;
  const height = Math.max(...nodes.map((n) => n.y + n.h), 400) + PAD;
  return { nodes, edges, width, height, hiddenRejected };
}

// Picked things at the top of a column, then shortlisted, then the rest.
function rank(g: MapGeneration): number {
  if (g.status === "reference") return 0;
  if (g.role === "start") return 1;
  if (g.role === "end") return 2;
  if (g.role === "take" || g.role === "final") return 1;
  if (g.status === "approved") return 3;
  if (g.starred) return 4;
  if (g.status === "rejected") return 9;
  return 5;
}

function elementWord(kind: string): string {
  switch (kind) {
    case "character": return "Character";
    case "wardrobe": return "Wardrobe";
    case "location": return "Location";
    case "element": return "Prop";
    default: return "Element";
  }
}

/**
 * Everything a node came from and everything it fed, including itself.
 * Walks both directions separately: a sibling (another take built from the
 * same frame) is NOT in a node's lineage, which is the whole point of lighting
 * one chain up.
 */
export function lineage(nodeId: string, edges: MapEdge[]): { nodes: Set<string>; edges: Set<string> } {
  const outN = new Set<string>([nodeId]);
  const outE = new Set<string>();
  const walk = (start: string, dir: "up" | "down") => {
    const stack = [start];
    const seen = new Set<string>([start]);
    while (stack.length) {
      const cur = stack.pop() as string;
      for (const e of edges) {
        const next = dir === "up" ? (e.to === cur ? e.from : null) : e.from === cur ? e.to : null;
        if (!next) continue;
        outE.add(e.id);
        if (seen.has(next)) continue;
        seen.add(next);
        outN.add(next);
        stack.push(next);
      }
    }
  };
  walk(nodeId, "up");
  walk(nodeId, "down");
  return { nodes: outN, edges: outE };
}

export type MapPositions = Record<string, { x: number; y: number }>;

/** Apply dragged positions over the automatic layout, and grow the canvas to hold them. */
export function withPositions(graph: MapGraph, positions: MapPositions): MapGraph {
  const nodes = graph.nodes.map((n) => {
    const p = positions[n.id];
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { ...n, x: p.x, y: p.y } : n;
  });
  return {
    ...graph,
    nodes,
    width: Math.max(graph.width, ...nodes.map((n) => n.x + n.w + PAD)),
    height: Math.max(graph.height, ...nodes.map((n) => n.y + n.h + PAD)),
  };
}

/** Out of storage: drop anything that is not a finite {x, y}. */
export function parsePositions(raw: unknown): MapPositions {
  const out: MapPositions = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= 2000) break;
    if (!v || typeof v !== "object") continue;
    const { x, y } = v as { x?: unknown; y?: unknown };
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    out[k] = { x: Math.max(-5000, Math.min(50000, x)), y: Math.max(-5000, Math.min(50000, y)) };
    n++;
  }
  return out;
}

/** The edge's hue. A role is what the input is FOR, which is the useful thing to see. */
export function edgeHue(role: string): string {
  switch (role) {
    case "start": return "green";
    case "end": return "blue";
    case "motion": return "orange";
    case "style": return "purple";
    case "character": return "pink";
    case "uses": return "cyan";
    case "take": return "indigo";
    default: return "";
  }
}

export function edgeLabel(role: string): string | null {
  switch (role) {
    case "start": return "Start";
    case "end": return "End";
    case "motion": return "Motion";
    case "style": return "Style";
    case "character": return "Character";
    case "take": return "Take";
    default: return null;
  }
}
