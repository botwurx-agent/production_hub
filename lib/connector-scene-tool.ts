import "server-only";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { reportError } from "@/lib/log";
import type { Json as DbJson } from "@/lib/database.types";
import { sceneFolder } from "@/lib/previz/scene-files";
import { storeImage } from "@/lib/connector-write";
import {
  ASPECT_TEXT,
  BODY_IDS,
  buildSceneSetup,
  describeSetup,
  DIFFUSION_IDS,
  FIXTURE_TEXT,
  GRIP_IDS,
  MAX_SCENE_CAMERAS,
  MAX_SCENE_ITEMS,
  MAX_SCENE_LIGHTS,
  MAX_SCENE_PEOPLE,
  MAX_SCENE_PHOTOS,
  POSE_IDS,
  sceneCatalogText,
  SUPPORT_IDS,
} from "@/lib/connector-scene";
import type { ConnectorOwner } from "@/lib/connector";
import type { McpTool } from "@/lib/mcp";

/**
 * create_scene_setup over the connector: a NEW scene builder setup (the 3D
 * lighting and camera previz) on a project, laid out from a description. It
 * inserts the row createSceneSetup writes, through the owner's borrowed RLS
 * client, so writing still needs edit access to the project.
 *
 * ADD ONLY, like every connector tool: an existing setup is never changed, and
 * one with the same name already on the project is returned rather than made
 * twice. Product photos are fetched by link (SSRF-guarded) into the project's
 * scene folder, the same place the builder's own uploads go, so the setup
 * opens with its labels in any browser.
 */

type Json = Record<string, unknown>;
const s = (description: string) => ({ type: "string", description });
const n = (description: string) => ({ type: ["number", "string"], description });

const MAX_CHARS = 3_000_000;

export const SCENE_TOOL: McpTool = {
  name: "create_scene_setup",
  description: [
    "Lay out a NEW scene builder setup on a project: a 3D previz of a live-action or tabletop setup with the room or stage, set pieces, people, lights with modifiers and diffusion, grip, and one or more cameras with real bodies and lenses (and a camera move if wanted). The producer opens it in Studio Flows (Scene builder), where the lens, stop and lighting read true. Put the whole setup in one call; it cannot be changed from here afterwards.",
    "COORDINATES: metres on a floor plan. x is to the right, z is toward the front of the set (where the camera usually is), y is up; the middle of the room is about 0, 0. A room's back wall is at about z = -0.55 x depth and the open front at +0.45 x depth. Use face_toward and look_at / aim_at with a ref instead of working out angles; facing 0 faces the camera side (+z), 90 faces +x.",
    "LIGHTS: give a fixture and a role (key, fill, back, rim, background). With no x/y/z a light is placed by its role around the subject it aims at (key three-quarter camera right, fill opposite, back behind), which is a sound start. Dimmer is 0 to 1 (or a percent). Diffusion is a frame in front: {material, size_ft, distance}.",
    "CAMERAS: code (1A, 1B), body, lens in mm, stop, position, look_at. A move is an end position (x/y/z, any left out stay put), an optional end lens and look_at, and seconds; the support (sticks, dana, fisher, robot) is picked to suit the move when not given.",
    `Set pieces (kind ids): ${sceneCatalogText()}. A product (bottle, can, carton, pouch, jar) can take photo_url, a public link to a front-on photo of the product, wrapped onto it.`,
    `Fixtures: ${FIXTURE_TEXT}. Diffusion: ${DIFFUSION_IDS.join(", ")}. Grip: ${GRIP_IDS.join(", ")}. Poses: ${POSE_IDS.join(", ")}. Camera bodies: ${BODY_IDS.join(", ")}. Supports: ${SUPPORT_IDS.join(", ")}. Aspects: ${ASPECT_TEXT}.`,
    "It cannot see the result, so tell the producer it is a starting setup to check in Studio Flows. Anything that could not be read is listed in skipped.",
  ].join("\n\n"),
  inputSchema: {
    type: "object",
    properties: {
      project_id: s("The project's id, from search."),
      name: s("The setup's name, e.g. 'Kitchen pour' or 'Hero table'. Required."),
      aspect: s("The delivery aspect, e.g. 16:9, 2.39:1, 4:5, 9:16. Default 16:9."),
      units: s("ft (default) or m, how the builder shows distances. Inputs are always metres."),
      room: {
        type: "object",
        description: "The space. Leave out, or kind 'stage', for an open black stage.",
        properties: {
          kind: s("room or stage."),
          width: n("Metres, left to right."),
          depth: n("Metres, back to front."),
          height: n("Ceiling, metres."),
          floor: s("wood, concrete, tile, carpet or stage."),
          wall_color: s("#hex."),
          walls: { type: "array", items: { type: "string" }, description: "Which walls stand: back, left, right, front. Default back, left, right." },
          openings: {
            type: "array",
            description: "Windows and doors: [{wall, kind: window|door, at (metres from the wall's start corner: back and front start at the left, left and right at the back), width, sill, top}].",
            items: { type: "object" },
          },
        },
        additionalProperties: false,
      },
      items: {
        type: "array",
        description: `Up to ${MAX_SCENE_ITEMS} set pieces, props and practicals: [{ref, kind, name, x, z, facing or face_toward, width, depth, height, raise, color, photo_url, on, dimmer, cct}]. Up to ${MAX_SCENE_PHOTOS} photos.`,
        items: { type: "object" },
      },
      people: {
        type: "array",
        description: `Up to ${MAX_SCENE_PEOPLE} people: [{ref, name, x, z, facing or face_toward, pose, height (m), holding (a prop's ref), walk_to {x, z, facing}, top_color, bottom_color}]. A seated person sits on whatever is under them.`,
        items: { type: "object" },
      },
      lights: {
        type: "array",
        description: `Up to ${MAX_SCENE_LIGHTS}: [{role, fixture, modifier, aim_at (a ref), x, y, z, dimmer, cct, on, diffusion {material, size_ft, distance}}].`,
        items: { type: "object" },
      },
      grip: {
        type: "array",
        description: "Bounces, flags and patterns: [{kind, size_ft, aim_at, x, y, z}].",
        items: { type: "object" },
      },
      cameras: {
        type: "array",
        description: `Up to ${MAX_SCENE_CAMERAS}: [{code, title, body, lens, stop, iso, nd, white_balance, support, x, y, z, look_at, focus_on, move {x, y, z, lens, look_at, seconds, ease}}]. y is lens height. Leave out for one camera in front of the subject.`,
        items: { type: "object" },
      },
      daylight: {
        type: "object",
        description: "Through the room's windows: {sky: overcast|bright|sun, nd, on}.",
        properties: { sky: s("overcast, bright or sun."), nd: n("ND on the window, 0 to 2.4."), on: { type: "boolean" } },
        additionalProperties: false,
      },
    },
    required: ["project_id", "name"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
};

export async function createSceneSetupTool(owner: ConnectorOwner, args: Json) {
  const supabase = createClient();
  const projectId = String(args.project_id ?? "").trim();
  const { data: project } = projectId
    ? await supabase.from("projects").select("id, title, studio_id").eq("id", projectId).maybeSingle()
    : { data: null };
  if (!project || project.studio_id !== owner.studioId) {
    return { error: "No project with that id is visible here. Use search first." };
  }
  const name = String(args.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!name) return { error: "Give the setup a name." };

  const url = (id: string) => `${siteOrigin()}/projects/${project.id}/scene-builder?setup=${id}`;

  // A retry of the same request returns the setup it already made.
  const { data: existing } = await supabase.from("scene_setups").select("id, name").eq("project_id", project.id);
  const same = (existing ?? []).find((r) => r.name.trim().toLowerCase() === name.toLowerCase());
  if (same) {
    return {
      already_existed: true,
      setup_id: same.id,
      url: url(same.id),
      note: `A setup called "${same.name}" is already on ${project.title}; nothing was changed. Give a different name to make another.`,
    };
  }

  const built = buildSceneSetup({ ...args, name });
  if ("error" in built) return built;
  const setup = built.setup;
  const skipped = [...built.skipped];

  // Product photos into the project's scene folder; a failed one leaves the
  // product plain rather than failing the setup.
  const files: Record<string, string> = {};
  await Promise.all(built.photos.map(async (p) => {
    const got = await storeImage(project.studio_id, sceneFolder(project.id), p.url);
    if (got.ok) files[p.key] = got.path;
    else {
      skipped.push(`${p.item}: the photo ${got.reason}, so it is plain`);
      for (const it of setup.items) if (it.label === p.key) it.label = null;
    }
  }));
  if (Object.keys(files).length) setup.files = files;

  if (JSON.stringify(setup).length > MAX_CHARS) return { error: "That setup is too large. Use fewer pieces." };

  const { data: last } = await supabase
    .from("scene_setups").select("position").eq("project_id", project.id)
    .order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("scene_setups")
    .insert({
      studio_id: project.studio_id,
      project_id: project.id,
      name: setup.name,
      data: setup as unknown as DbJson,
      position: (last?.position ?? 0) + 1,
      created_by: owner.userId,
      updated_by: owner.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error) reportError("connector create_scene_setup", error);
    return { error: "The setup could not be saved. The link's owner may only have review access to this project." };
  }

  return {
    created: true,
    setup_id: data.id,
    url: url(data.id),
    project: project.title,
    setup: describeSetup(setup),
    skipped,
    next: "Open the link to check the frame through each camera, the meter readings and the lighting, and adjust by hand.",
  };
}
