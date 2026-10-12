// Where a scene's product photos and 3D models live once they are shared.
//
// A setup's items name their files by a KEY (lib/previz/asset-store.ts), and
// that key is what the browser keeps them under in IndexedDB. On a project the
// same file is ALSO uploaded to the project's storage, and the setup carries a
// map from key to storage path, so anyone opening the setup elsewhere gets the
// file without the browser that added it. Pure, so it can be tested.
import { pathWithinScope } from "@/lib/upload-limits";

export type SceneFiles = Record<string, string>;

const KEY = /^[A-Za-z0-9_-]{1,64}$/;

/** The folder a project's scene files live in, under the studio. */
export function sceneFolder(projectId: string): string {
  return `scenes/${projectId}`;
}

/**
 * The trust boundary on the way into the database: the map came from the
 * browser, so only entries with a sensible key and a path directly in THIS
 * project's scene folder survive. A path from another project or studio would
 * otherwise let a setup point at (and the reader sign) somebody else's file.
 */
export function cleanSceneFiles(raw: unknown, studioId: string, projectId: string): SceneFiles {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SceneFiles = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= 500) break;
    if (!KEY.test(k) || typeof v !== "string") continue;
    if (!pathWithinScope(v, studioId, sceneFolder(projectId))) continue;
    out[k] = v;
    n++;
  }
  return out;
}

/** The keys a setup uses that have no stored copy yet. */
export function unstoredKeys(keys: string[], files: SceneFiles | undefined): string[] {
  const have = files ?? {};
  return Array.from(new Set(keys)).filter((k) => !have[k]);
}
