// Files a Scene Setup leans on (product photos, imported 3D models) kept in
// this browser's IndexedDB, by key. A setup saved to localStorage carries only
// the keys, since a model is megabytes and localStorage holds about five in
// all; a downloaded setup file carries the files themselves, so it opens on
// another computer. Nothing here reaches a server.

const DB = "previz";
const STORE = "assets";

export type StoredAsset = { key: string; name: string; type: string; blob: Blob };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function newAssetKey(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function putAsset(blob: Blob, name: string, key = newAssetKey()): Promise<string> {
  await tx("readwrite", (s) => s.put({ key, name, type: blob.type, blob } satisfies StoredAsset));
  return key;
}

export async function getAsset(key: string): Promise<StoredAsset | null> {
  try {
    const r = await tx<StoredAsset | undefined>("readonly", (s) => s.get(key));
    return r ?? null;
  } catch {
    return null;
  }
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

export type EmbeddedAsset = { name: string; type: string; data: string };

/** The files a setup uses, ready to go inside a downloaded setup file. */
export async function embedAssets(keys: string[]): Promise<Record<string, EmbeddedAsset>> {
  const out: Record<string, EmbeddedAsset> = {};
  for (const k of Array.from(new Set(keys))) {
    const a = await getAsset(k);
    if (a) out[k] = { name: a.name, type: a.type, data: await blobToBase64(a.blob) };
  }
  return out;
}

/** Puts the files from an opened setup file back into this browser. */
export async function restoreAssets(assets: Record<string, EmbeddedAsset> | undefined): Promise<number> {
  if (!assets) return 0;
  let n = 0;
  for (const [key, a] of Object.entries(assets)) {
    if (!a || typeof a.data !== "string") continue;
    const bin = atob(a.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    await putAsset(new Blob([bytes], { type: a.type || "application/octet-stream" }), a.name || key, key);
    n++;
  }
  return n;
}

/**
 * A product photo, made small enough to keep: the longest side at most 1400px,
 * as a JPEG. Also returns its average colour, which paints the back of the
 * product where the photo cannot see.
 */
export async function prepareLabel(file: File): Promise<{ blob: Blob; avg: string; aspect: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file is not an image this browser can read."));
      i.src = url;
    });
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0, c.width, c.height);
    const one = document.createElement("canvas");
    one.width = one.height = 1;
    one.getContext("2d")!.drawImage(c, 0, 0, 1, 1);
    const [r, gg, b] = one.getContext("2d")!.getImageData(0, 0, 1, 1).data;
    const avg = `#${[r, gg, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    const blob = await new Promise<Blob>((resolve, reject) =>
      c.toBlob((x) => (x ? resolve(x) : reject(new Error("Could not encode the photo."))), "image/jpeg", 0.88),
    );
    return { blob, avg, aspect: img.width / img.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
