import "server-only";
import { CAMERA_RIGS } from "@/lib/blocking/rigs";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { reportError } from "@/lib/log";
import type { Json as DbJson } from "@/lib/database.types";
import { TEMPLATES } from "@/lib/blocking/templates";
import { BLOCK_ASPECTS, BODY_BUILDS, HAIR_STYLES, MAX_DURATION } from "@/lib/blocking/scene";
import {
  BODY_IDS,
  buildBlockingScene,
  catalogueText,
  describeScene,
  GESTURE_IDS,
  MAX_OBJECTS_PER_CALL,
  PRESET_IDS,
} from "@/lib/connector-blocking";
import type { ConnectorOwner } from "@/lib/connector";
import type { McpTool } from "@/lib/mcp";

/**
 * create_blocking_scene over the connector: a NEW shot blocking scene on a
 * project, laid out from a description. It inserts the same row
 * createBlockingScene writes (which needs a cookie session, so cannot be
 * called), through the owner's borrowed RLS client, so writing still needs
 * edit access to the project.
 *
 * ADD ONLY, like every connector tool: it never changes a scene that exists.
 * A scene with the same name already on the project is returned rather than
 * made twice, so a retry of the same request does not leave a duplicate.
 */

type Json = Record<string, unknown>;
const s = (description: string) => ({ type: "string", description });
const n = (description: string) => ({ type: ["number", "string"], description });

const MAX_CHARS = 2_000_000;

export const BLOCKING_TOOL: McpTool = {
  name: "create_blocking_scene",
  description: [
    "Lay out a NEW shot blocking scene on a project: a low-poly 3D set with people, vehicles and objects, how they move, and one camera with its move, which the producer opens in Studio Flows (Shot blocking) and records as a motion reference clip for an AI video model. Put the whole scene in one call; it cannot be changed from here afterwards, only in Studio Flows.",
    "COORDINATES: metres on a floor plan. x is to the right, z is toward the front of the set (where the camera usually is), y is up. Things sit on the ground at y 0. Use face_toward (another object's ref) instead of working out a facing angle; facing in degrees is the alternative, where 0 faces +z (toward the front) and 90 faces +x.",
    "OBJECTS: each has a kind from the catalogue, a ref (your own short name, used to point at it from other objects and the camera), and x/z. A passenger or anything inside a vehicle sets rides_with to the vehicle's ref, and then its x/y/z are in the vehicle's own frame (the vehicle points along +z; a seat is about y 0.5 for a seated adult, front row about z 0.9, rear row about z -0.1, left seat x -0.45, right x 0.45). Moves are points at times: [{t: 8, x: 2, z: 0}] means it gets there by 8 s, at an even pace, facing the way it goes. People can do gestures: [{gesture, at (when it is done), until (when it lets go, optional), toward (an object's ref), hand, lean}]. 'reach' needs toward.",
    "CAMERA: keys are positions at times with look_at (an object's ref or [x, y, z]) and lens in mm; or give a named move from where the first key is. A key whose look_at names an OBJECT keeps the camera on that object from that key on, and when the next key looks at a different object the camera pans across to it between the two keys: that is how a shot watches someone and then settles on what they are looking at. aim_at keeps the camera on one object for every key that does not name its own (best for a moving subject). rides_with makes the camera travel with a vehicle (its keys then in the vehicle's frame). Leave the camera out for a locked-off shot in front of the subject.",
    "ROOMS: a room object is a whole room: walls on its back (-z), left and right, and a front wall (+z) with a gap in the middle as the way in, plus a floor. Do NOT add wall objects along a room's sides; it already has them. A room of size [w, h, d] at x, z spans x - w/2 to x + w/2 and z - d/2 to z + d/2: put everything that belongs in it, the camera included, inside that span. Something that faces a person (a TV they watch) goes on the side they face, inside the room.",
    "DIRECTIONS: a person or object faces +z at facing 0. To see someone's FACE the camera must be on the side they face; to see the BACK of their head it is on the other side. To go round someone, the camera's keys must change x as well as z (a curve round them, or the orbit, half orbit or arc move); keys that only change z travel in a straight line and pass through anyone in the way. Never put a camera key inside a person.",
    `Catalogue (kind ids by group): ${catalogueText()}.`,
    `Gestures: ${GESTURE_IDS.join(", ")}. Camera moves: ${PRESET_IDS.join(", ")}. Camera bodies: ${BODY_IDS.join(", ")}. Templates to start from instead of an empty stage: ${TEMPLATES.map((t) => `${t.id} (${t.hint})`).join("; ")}.`,
    "It cannot see the result, so tell the producer it is a starting layout to check in Studio Flows. Anything that could not be read is listed in skipped.",
  ].join("\n\n"),
  inputSchema: {
    type: "object",
    properties: {
      project_id: s("The project's id, from search."),
      name: s("The scene's name, e.g. 'Coast road chase'. Required."),
      shot_id: s("Optional: the AI pipeline shot (table ai_shots on this project) this scene blocks."),
      template: s(`Optional: start from a template (${TEMPLATES.map((t) => t.id).join(", ")}) and add to it.`),
      duration: n(`Seconds, 1 to ${MAX_DURATION}. Default 8.`),
      aspect: s(`Frame shape: ${BLOCK_ASPECTS.map((a) => a.id).join(", ")}. Default 16:9.`),
      fps: n("24 (default), 25 or 30."),
      look: s("blockout (default, flat colours, what video models read best), clay or lit."),
      environment: {
        type: "object",
        properties: {
          ground: s("grass, asphalt, sand, dirt, snow, studio (a plain floor), water or none."),
          sky: s("day, morning, golden, dusk, overcast, night, studio, black, or a #hex colour."),
          haze: n("0 to 1, how much distance fades."),
          sun_azimuth: n("Degrees round, where the sun comes from."),
          sun_elevation: n("Degrees up, 2 to 90."),
        },
        additionalProperties: false,
      },
      objects: {
        type: "array",
        description: `Up to ${MAX_OBJECTS_PER_CALL} things on the set.`,
        items: {
          type: "object",
          properties: {
            ref: s("Your short name for it, unique in this scene."),
            kind: s("A kind id from the catalogue."),
            name: s("What it is called in the studio's list, e.g. 'Maya' or 'Hero SUV'."),
            x: n("Metres right."),
            y: n("Metres up (0 is the ground; only for things on something else, or inside a vehicle)."),
            z: n("Metres toward the front."),
            facing: n("Degrees: 0 faces the front (+z), 90 faces right (+x), 180 faces the back."),
            face_toward: s("Or the ref of an object it faces."),
            size: { type: "array", items: { type: "number" }, description: "[width, height, depth] in metres, to override the catalogue size." },
            scale: n("Or a multiple of the catalogue size."),
            height: n("People: their height in metres (proportions kept)."),
            color: s("#hex. People get distinct colours automatically."),
            pose: s("People and dogs: a pose the catalogue lists for that kind."),
            build: s(`People: ${BODY_BUILDS.map((b) => b.id).join(", ")}.`),
            hair: s(`People: ${HAIR_STYLES.map((h) => h.id).join(", ")}.`),
            seats: s("SUV: two or three rows."),
            rides_with: s("The ref of the vehicle it is in or on; its position is then in that vehicle's frame."),
            ease: s("How it moves between points: linear (default, an even pace), smooth, in, out."),
            moves: {
              type: "array",
              description: "Where it goes, in time order: [{t, x, z, y?, facing?, face_toward?}]. Its starting point is x/z above at 0 s.",
              items: { type: "object" },
            },
            gestures: {
              type: "array",
              description: "People only: [{gesture, at, until?, toward?, hand: 'right'|'left', lean (degrees back, -25 to 45), stroke (reach: keeps stroking)}].",
              items: { type: "object" },
            },
          },
          required: ["kind"],
          additionalProperties: false,
        },
      },
      camera: {
        type: "object",
        properties: {
          body: s("A camera body id. Default alexamini."),
          lens: n("Focal length in mm for keys that do not give one. Default 35."),
          keys: {
            type: "array",
            description: "Camera positions at times: [{t, x, y, z, look_at (ref or [x, y, z]), lens?, roll?}]. y is lens height, about 1.6 for eye level. look_at naming an object keeps the camera on it from that key, and pans to the next key's object when it differs.",
            items: { type: "object" },
          },
          move: {
            type: "object",
            description: `A named move: {preset (${PRESET_IDS.join(", ")}), target (ref or [x, y, z]), start (s), duration (s)}. It starts from the camera key at or before start.`,
          },
          aim_at: s("Keep the camera pointed at this object's ref, except at keys whose look_at names another object."),
          rides_with: s("Travel with a vehicle; keys are then in its frame."),
          rig: s(`What the camera is on: ${CAMERA_RIGS.map((r) => `${r.id} (${r.hint.split(".")[0].toLowerCase()})`).join("; ")}. Default free. Picking one sets its usual shake.`),
          handheld: n("0 to 1, shake on top of the rig. Leave out to keep the rig's own."),
          flow: s("continuous (default, flows through the keys), even (one steady speed), keys (settles at each key)."),
        },
        additionalProperties: false,
      },
    },
    required: ["project_id", "name"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
};

export async function createBlockingSceneTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const projectId = String(args.project_id ?? "").trim();
  const { data: project } = projectId
    ? await supabase.from("projects").select("id, title, studio_id").eq("id", projectId).maybeSingle()
    : { data: null };
  if (!project || project.studio_id !== owner.studioId) {
    return { error: "No project with that id is visible here. Use search first." };
  }
  const name = String(args.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!name) return { error: "Give the scene a name." };

  const built = buildBlockingScene({ ...args, name });
  if ("error" in built) return built;
  const json = JSON.stringify(built.scene);
  if (json.length > MAX_CHARS) return { error: "That scene is too large. Use fewer objects or moves." };

  const url = (id: string) => `${siteOrigin()}/projects/${project.id}/blocking?scene=${id}`;

  // A retry of the same request returns the scene it already made.
  const { data: existing } = await supabase
    .from("blocking_scenes")
    .select("id, name")
    .eq("project_id", project.id);
  const same = (existing ?? []).find((r) => r.name.trim().toLowerCase() === name.toLowerCase());
  if (same) {
    return {
      already_existed: true,
      scene_id: same.id,
      url: url(same.id),
      note: `A blocking scene called "${same.name}" is already on ${project.title}; nothing was changed. Give a different name to make another.`,
    };
  }

  // A shot is kept only if it is on this project.
  let shotId: string | null = null;
  const skipped = [...built.skipped];
  const askedShot = String(args.shot_id ?? "").trim();
  if (askedShot) {
    const { data } = await supabase.from("ai_shots").select("id").eq("id", askedShot).eq("project_id", project.id).maybeSingle();
    if (data) shotId = data.id;
    else skipped.push(`shot_id ${askedShot} is not a shot on this project, so the scene is not tied to one`);
  }

  const { data: last } = await supabase
    .from("blocking_scenes").select("position").eq("project_id", project.id)
    .order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("blocking_scenes")
    .insert({
      studio_id: project.studio_id,
      project_id: project.id,
      shot_id: shotId,
      name: built.scene.name,
      data: built.scene as unknown as DbJson,
      position: (last?.position ?? 0) + 1,
      created_by: owner.userId,
      updated_by: owner.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error) reportError("connector create_blocking_scene", error);
    return { error: "The scene could not be saved. The link's owner may only have review access to this project." };
  }

  const sc = built.scene;
  return {
    created: true,
    scene_id: data.id,
    url: url(data.id),
    project: project.title,
    scene: {
      name: sc.name,
      seconds: sc.duration,
      aspect: sc.aspect,
      objects: describeScene(sc),
      camera: `${sc.camera.keys.length} key${sc.camera.keys.length === 1 ? "" : "s"}, ${Math.round(sc.camera.keys[0].lens)}mm${sc.camera.aim.target ? `, kept aimed at ${sc.objects.find((o) => o.id === sc.camera.aim.target)?.name}` : ""}${sc.camera.parent ? `, riding with ${sc.objects.find((o) => o.id === sc.camera.parent)?.name}` : ""}`,
    },
    skipped,
    next: "Open the link to check the layout, adjust anything by hand, then record the blocking clip or send it to the pipeline.",
  };
}
