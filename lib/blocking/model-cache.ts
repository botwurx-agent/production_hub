// Models made from a photo, loaded once per browser session and shared by
// every scene that uses them. buildObject reads this cache synchronously; the
// editor fills it (sign the stored path, fetch, parse) and the object rebuilds
// on the next frame because its cache key includes whether the model is ready.
import * as THREE from "three";
import { loadModel, rawSize } from "@/lib/previz/model-import";

type Entry =
  | { state: "loading" }
  | { state: "ready"; model: THREE.Object3D; size: [number, number, number] }
  | { state: "failed"; error: string };

const cache = new Map<string, Entry>();

export function modelEntry(path: string | undefined): Entry | undefined {
  return path ? cache.get(path) : undefined;
}

export function modelReady(path: string | undefined): boolean {
  return modelEntry(path)?.state === "ready";
}

/**
 * Loads a stored model from a signed link. Safe to call repeatedly: a model
 * already loading or loaded is left alone. Resolves to its natural size in
 * metres (what the scene sizes a fresh arrival to), or null on failure.
 */
export async function ensureModel(path: string, sign: () => Promise<string | null>): Promise<[number, number, number] | null> {
  const have = cache.get(path);
  if (have?.state === "ready") return have.size;
  if (have) return null;
  cache.set(path, { state: "loading" });
  try {
    const url = await sign();
    if (!url) throw new Error("Could not open the stored model.");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`The stored model could not be fetched (HTTP ${res.status}).`);
    const model = await loadModel(await res.arrayBuffer(), "model.glb", false);
    const s = rawSize(model);
    const size: [number, number, number] = [s.x, s.y, s.z];
    cache.set(path, { state: "ready", model, size });
    return size;
  } catch (e) {
    cache.set(path, { state: "failed", error: e instanceof Error ? e.message : "Could not load the model." });
    return null;
  }
}

/** Forget a failed load so it can be tried again. */
export function retryModel(path: string) {
  if (cache.get(path)?.state === "failed") cache.delete(path);
}
