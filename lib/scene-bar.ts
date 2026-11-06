import "server-only";
import { BLOCKING_TOOL } from "@/lib/connector-blocking-tool";
import { buildBlockingScene, jsonFromText, sceneForPrompt } from "@/lib/connector-blocking";
import { draftBlockingScene } from "@/lib/ai";
import type { BlockScene } from "@/lib/blocking/scene";

/**
 * The shot blocking scene bar: a producer types what they want and the scene
 * is laid out (no scene open) or changed (a scene open). The model writes the
 * SAME input the connector's create_blocking_scene takes, and the same pure
 * builder turns it into a scene, so a scene from the bar and one from a
 * connected Claude come out of one piece of code. Billed on OUR AI key, which
 * is why the action that calls this is rate limited.
 */

export const MAX_PROMPT = 1500;

const SHAPE = (() => {
  const props = { ...(BLOCKING_TOOL.inputSchema as { properties: Record<string, unknown> }).properties };
  delete props.project_id;
  delete props.shot_id;
  return JSON.stringify(props);
})();

const RULES = [
  "You lay out shot blocking scenes for a commercial production studio: low-poly 3D sets whose camera move is recorded as a motion reference for an AI video model. The producer describes a shot in plain words; you answer with ONE JSON object and nothing else (no prose, no code fences).",
  "Be generous with set dressing that the description implies (a city street has a road, sidewalks, buildings both sides, street lights, a few parked cars; a kitchen has counters, cabinets and an island), and keep everything at real sizes in metres. Put the action near the middle of the set, and give the camera a move that serves the shot when one is implied. People and vehicles that travel have moves with times inside the duration.",
  "Also put a field \"summary\" in the object: one short plain sentence saying what you made or changed, for the producer. No em dashes anywhere.",
].join("\n\n");

const EDIT_RULES = [
  "EDITING: the scene as it stands is given below. Return ONLY what changes, never the whole scene again:",
  "- \"objects\": new things to add, same shape as a new scene's objects. They may point at existing things by their name (face_toward, rides_with, gestures toward, camera look_at).",
  "- \"change\": [{name (exactly as listed), rename?, x?, y?, z?, facing?, face_toward?, moves?, gestures?, pose?, color?, size?, height?, rides_with?}] for things already there. Giving a position, facing or moves restarts that thing's route from there; giving gestures replaces its gestures; anything left out stays as it is.",
  "- \"remove\": [names] to take out.",
  "- \"camera\": only when the camera should change. Keys given replace the camera's keys; a move given alone is added to the camera as it is.",
  "- \"duration\", \"look\", \"environment\" only when they change. Leave out \"name\" and \"template\".",
].join("\n");

export type SceneBarResult = { scene: BlockScene; summary: string; skipped: string[] };

export async function runSceneBar(prompt: string, current: BlockScene | null): Promise<SceneBarResult | { error: string }> {
  const system = [
    RULES,
    BLOCKING_TOOL.description,
    `The fields of the JSON object (a JSON schema of each): ${SHAPE}`,
    current ? EDIT_RULES : "NEW SCENE: give it a short \"name\". You may start from a template when one fits.",
  ].join("\n\n");
  const user = current
    ? `The scene now:\n${JSON.stringify(sceneForPrompt(current))}\n\nThe producer asks: ${prompt}`
    : `The producer asks for this shot: ${prompt}`;

  let raw: string;
  try {
    raw = await draftBlockingScene(system, user);
  } catch (e) {
    return { error: e instanceof Error && /too long/i.test(e.message) ? e.message : "The assistant did not answer. Try again in a moment." };
  }
  const input = jsonFromText(raw);
  if (!input) return { error: "That came back in a shape the scene could not be built from. Try saying it another way." };
  const built = buildBlockingScene(input, current ?? undefined);
  if ("error" in built) return built;
  const summary = typeof input.summary === "string" ? input.summary.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  return { scene: built.scene, summary: summary || (current ? "Scene changed." : "Scene laid out."), skipped: built.skipped.slice(0, 12) };
}
