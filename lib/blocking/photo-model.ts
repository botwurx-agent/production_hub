// Turning a photo into a 3D model for shot blocking, on the person's own
// Higgsfield plan (generate_3d over their MCP connection). Pure, so it can be
// tested: which Higgsfield model to call, what to send it, and how to read the
// finished job and the file that comes back.
//
// Read off models_explore(type:'3d') and priced with get_cost on 2026-11-06:
// Tripo H3.1 is 9 credits for one photo or two to four views, Meshy 7 is 38
// for one photo. Both take the photos under the role "image_references".

export type PhotoModelId = "tripo" | "meshy";

export const PHOTO_MODELS: {
  id: PhotoModelId;
  name: string;
  hint: string;
  maxPhotos: number;
}[] = [
  { id: "tripo", name: "Tripo H3.1", hint: "Quick and cheap, sized to the real object. Takes one to four photos.", maxPhotos: 4 },
  { id: "meshy", name: "Meshy 7", hint: "Finer shape and surface. One photo, costs about four times as much.", maxPhotos: 1 },
];

export const DEFAULT_PHOTO_MODEL: PhotoModelId = "tripo";

export function photoModel(id: unknown) {
  return PHOTO_MODELS.find((m) => m.id === id) ?? null;
}

/**
 * The generate_3d arguments for a model and a number of photos, without the
 * photos themselves. Tripo switches to its multiview model for two or more
 * photos; Meshy takes one. auto_size asks Tripo for real-world metres, which
 * is what lets the object arrive at its true size in the scene.
 */
export function photoParams(id: PhotoModelId, photos: number): Record<string, unknown> | null {
  const n = Math.max(1, Math.floor(photos));
  if (id === "tripo") {
    if (n > 4) return null;
    return {
      model: n > 1 ? "tripo_h3_1_multiview_to_3d" : "tripo_h3_1_image_to_3d",
      texture: true,
      pbr: true,
      auto_size: true,
    };
  }
  if (id === "meshy") {
    if (n > 1) return null;
    return { model: "meshy_v7_image_to_3d", should_texture: true };
  }
  return null;
}

export const PHOTO_ROLE = "image_references";

/** The biggest model file kept; a blocking prop has no need for more. */
export const MAX_GLB_BYTES = 150 * 1024 * 1024;

type Hit = { key: string; value: string };

function walk(v: unknown, key: string, depth: number, out: Hit[]) {
  if (depth > 8 || out.length > 400) return;
  if (typeof v === "string") { out.push({ key, value: v }); return; }
  if (Array.isArray(v)) { for (const x of v) walk(x, key, depth + 1, out); return; }
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, k, depth + 1, out);
}

const DONE = new Set(["completed", "complete", "succeeded", "success", "done", "finished"]);
const FAILED = new Set(["failed", "error", "errored", "canceled", "cancelled", "rejected", "nsfw", "ip_detected", "expired"]);

export type ModelJob = { state: "done"; url: string } | { state: "failed"; reason: string } | { state: "pending" };

/**
 * Where a 3D job stands. A finished 3D job can carry a preview image as well
 * as the model, so the link chosen is the GLB: one whose path ends in .glb,
 * else one under a key that names the model, else the raw result link. The
 * file is checked for the GLB signature after download anyway, so a wrong
 * pick is refused rather than stored.
 */
export function readModelJob(data: unknown): ModelJob {
  const all: Hit[] = [];
  walk(data, "", 0, all);
  const status = all.find((h) => /^(status|state)$/i.test(h.key))?.value.toLowerCase().trim() ?? "";
  if (FAILED.has(status)) {
    const reason = all.find((h) => /^(error|reason|fail_reason|message|detail)$/i.test(h.key))?.value ?? status;
    return { state: "failed", reason: reason.slice(0, 300) };
  }
  const links = all.filter((h) => /^https:\/\//i.test(h.value));
  const glbPath = (u: string) => { try { return /\.glb$/i.test(new URL(u).pathname); } catch { return false; } };
  const url =
    links.find((h) => glbPath(h.value))?.value ??
    links.find((h) => /glb|model|mesh/i.test(h.key))?.value ??
    links.find((h) => /^raw_?url$/i.test(h.key))?.value ??
    null;
  if (url && (DONE.has(status) || !status)) return { state: "done", url };
  return { state: "pending" };
}

/** A binary glTF starts with the ASCII "glTF" and version 2. */
export function isGlb(bytes: Uint8Array): boolean {
  return bytes.length > 20 && bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46 && bytes[4] === 2;
}

/**
 * The size an arriving model is given in the scene, from its own bounding box
 * in metres. Tripo sizes to the real object; a box under 2 cm or over 60 m is
 * not a real size (a model in arbitrary units), so it is scaled to keep its
 * proportions at the height of the stand-in it replaces.
 */
export function arrivalSize(natural: [number, number, number], standIn: [number, number, number]): [number, number, number] {
  const [w, h, d] = natural.map((v) => (Number.isFinite(v) && v > 0 ? v : 0)) as [number, number, number];
  if (!w || !h || !d) return standIn;
  const big = Math.max(w, h, d);
  if (big >= 0.02 && big <= 60) return [round(w), round(h), round(d)];
  const k = standIn[1] / h;
  return [round(w * k), round(standIn[1]), round(d * k)];
}

const round = (v: number) => Math.round(v * 1000) / 1000;
