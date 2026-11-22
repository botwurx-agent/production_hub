// What a scene builder setup is allowed to be on its way into the database,
// shared by the app's own save and the guest save behind a share link, so the
// two cannot disagree about what is accepted.
import { asSetup, type Setup } from "@/components/previz/setup";
import { cleanSceneFiles } from "@/lib/previz/scene-files";

/**
 * A saved setup crosses a Server Action, so the ~4.5MB serverless request body
 * is the real ceiling. Storyboard frames uploaded into a shot are the only
 * thing in a setup that can get near it; the builder drops the large ones
 * before saving and says so (setupForStore in components/previz/setup.ts).
 */
export const MAX_SETUP_CHARS = 3_500_000;

export function cleanSetup(raw: unknown, studioId: string, projectId: string): { setup: Setup; json: string } | { error: string } {
  const setup = asSetup(raw);
  if (!setup) return { error: "That is not a scene setup this page can save." };
  // Embedded photos and models never go to the database as bytes: they are
  // uploaded to the project's storage on their own, and the setup carries only
  // where they went, checked to be this project's own folder.
  const { assets: _a, files, ...rest } = setup;
  const clean = cleanSceneFiles(files, studioId, projectId);
  const plain: Setup = Object.keys(clean).length ? { ...rest, files: clean } : rest;
  const json = JSON.stringify(plain);
  if (json.length > MAX_SETUP_CHARS) return { error: "This setup is too large to save. Remove some uploaded storyboard frames and try again." };
  return { setup: plain as Setup, json };
}

export const nameOf = (s: Setup) => (s.name || "").replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled setup";

