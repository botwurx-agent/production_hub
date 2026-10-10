import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { assetStorage } from "@/lib/asset-storage";
import { fetchMediaFromUrl } from "@/lib/media-import";
import { FRAME_ASPECTS, isFrameAspect } from "@/lib/frame-aspect";
import { siteOrigin } from "@/lib/site-url";
import {
  boardName,
  layoutEntries,
  mediaHeight,
  noteHtml,
  parseBoardEntries,
  parseFrames,
  MEDIA_W,
} from "@/lib/connector-board";
import type { ConnectorOwner } from "@/lib/connector";
import type { McpTool } from "@/lib/mcp";

/**
 * The connector's WRITE tools. Decided by the operator (2026-10-10): pictures
 * for boards come from the customer's own Claude or ChatGPT, with their own
 * image tools, and arrive here as LINKS. Studio Flows generates nothing.
 *
 * Three rules hold for every tool in this file:
 *  - ADD ONLY. Nothing here deletes, overwrites or reorders existing work, so
 *    a wrong result costs a delete rather than lost work. That is what makes
 *    the host's generic "allow this tool?" an acceptable check.
 *  - Runs inside runAsUser, so every read and insert goes through the owner's
 *    own RLS client, exactly like a button in the app. Bytes are stored with
 *    the service role (the same move the Drive and Figma imports make) only
 *    AFTER the board has been read through RLS, and only under that board's
 *    own studio folder.
 *  - Says exactly what it created and what it skipped, with a link to look,
 *    because an assistant that reports "done" when it was not is the failure
 *    this layer has to make impossible to hide.
 */

const s = (description: string) => ({ type: "string", description });

const ENTRY_NOTE =
  "Adds only: never changes or removes anything already there. At most 12 per call; send more in further calls. Images must be public http(s) links (a generated image's link, a reference photo, a share page). Tell the producer exactly what was added and what was skipped.";

export const CONNECTOR_WRITE_TOOLS: McpTool[] = [
  {
    name: "create_board",
    description:
      "Create a new, empty moodboard or storyboard on a project. Returns its id, which add_to_moodboard or add_storyboard_frames then fill. Use search to get the project id first. Never use this to replace a board; it always makes a new one.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: s("The project's id, from search."),
        kind: { type: "string", enum: ["moodboard", "storyboard"] },
        name: s("What to call it, e.g. 'Kitchen look' or 'Hint 30s board'."),
        frame_aspect: {
          type: "string",
          enum: FRAME_ASPECTS.map((a) => a.key),
          description: "Storyboards only: the shape frames are drawn in. Defaults to 16:9.",
        },
      },
      required: ["project_id", "kind", "name"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "add_to_moodboard",
    description:
      "Add images, notes and headings to a moodboard. They are laid out below what is already on the board, four across; a heading starts a new group. " +
      ENTRY_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        board_id: s("The moodboard's id, from create_board or the query tool (table boards)."),
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["image", "note", "heading"] },
              url: s("For an image: a public link to it."),
              caption: s("For an image: an optional caption under it."),
              text: s("For a note or heading: the words."),
            },
            required: ["type"],
            additionalProperties: false,
          },
        },
      },
      required: ["board_id", "items"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "add_storyboard_frames",
    description:
      "Add frames to the end of a storyboard, in order. A frame can carry a picture, or be text only (a description to draw from later). " +
      ENTRY_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        board_id: s("The storyboard's id, from create_board or the query tool (table boards, kind storyboard)."),
        frames: {
          type: "array",
          items: {
            type: "object",
            properties: {
              image_url: s("Optional public link to the frame's picture."),
              scene: s("The shot's number and title, e.g. '1A · The reveal'."),
              description: s("What we see."),
              sound: s("Dialogue, voiceover, music or effects."),
              notes: s("Camera move, shot size or motion, e.g. 'Wide, slow push in'. Shown as Video / motion on the frame."),
            },
            additionalProperties: false,
          },
        },
      },
      required: ["board_id", "frames"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
];

type Json = Record<string, unknown>;

/** Runs `fn` over items a few at a time: downloads, not a stampede. */
async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

type Stored =
  | { ok: true; path: string; mime: string; name: string; width: number | null; height: number | null }
  | { ok: false; reason: string };

/** Fetch an image by link (SSRF-guarded) and store it in the board's folder. */
async function storeImage(studioId: string, boardId: string, url: string): Promise<Stored> {
  const got = await fetchMediaFromUrl(url);
  if ("error" in got) return { ok: false, reason: got.error };
  if (got.kind !== "image") return { ok: false, reason: "that link is a video, not an image" };
  const name = (got.filename || "image").replace(/[^\w.\-]+/g, "_").slice(-100) || "image";
  const path = `${studioId}/boards/${boardId}/${randomUUID()}-${name}`;
  const { error } = await assetStorage().upload(path, got.bytes, {
    contentType: got.contentType || undefined,
  });
  if (error) return { ok: false, reason: "could not be stored" };
  return { ok: true, path, mime: got.contentType, name, width: got.width, height: got.height };
}

async function readBoard(owner: ConnectorOwner, boardId: string) {
  if (!boardId) return null;
  const { data } = await createClient()
    .from("boards")
    .select("id, studio_id, project_id, kind, name")
    .eq("id", boardId)
    .maybeSingle();
  // Pinned to the link's studio, like the query tool, for a person in two.
  return data && data.studio_id === owner.studioId ? data : null;
}

function boardLink(projectId: string | null, kind: string): string | null {
  if (!projectId) return `${siteOrigin()}/boards`;
  return `${siteOrigin()}/projects/${projectId}/${kind === "storyboard" ? "storyboards" : "moodboard"}`;
}

export async function createBoardTool(owner: ConnectorOwner, args: Json) {
  const projectId = String(args.project_id ?? "").trim();
  const kind = args.kind === "storyboard" ? "storyboard" : args.kind === "moodboard" ? "moodboard" : null;
  if (!kind) return { error: 'kind must be "moodboard" or "storyboard".' };
  const supabase = createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, studio_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.studio_id !== owner.studioId) {
    return { error: "No project with that id is visible here. Use search first." };
  }
  const { data: last } = await supabase
    .from("boards")
    .select("position")
    .eq("studio_id", owner.studioId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const aspect = kind === "storyboard" && isFrameAspect(args.frame_aspect) ? args.frame_aspect : null;
  const { data: board, error } = await supabase
    .from("boards")
    .insert({
      studio_id: owner.studioId,
      project_id: project.id,
      kind,
      name: boardName(args.name, kind === "storyboard" ? "Storyboard" : "Moodboard"),
      position: (last?.position ?? -1) + 1,
      frame_aspect: aspect,
      created_by: owner.userId,
    })
    .select("id, name")
    .single();
  if (error || !board) return { error: "The board could not be created." };
  return {
    created: kind,
    board_id: board.id,
    name: board.name,
    project: project.title,
    open: boardLink(project.id, kind),
    next: kind === "storyboard" ? "Fill it with add_storyboard_frames." : "Fill it with add_to_moodboard.",
  };
}

export async function addToMoodboardTool(owner: ConnectorOwner, args: Json) {
  const board = await readBoard(owner, String(args.board_id ?? "").trim());
  if (!board) return { error: "No board with that id is visible here." };
  if (board.kind === "storyboard") {
    return { error: "That is a storyboard. Use add_storyboard_frames for it." };
  }
  const { entries, skipped } = parseBoardEntries(args.items);
  if (!entries.length) return { error: "Nothing usable to add.", skipped };

  const supabase = createClient();
  const [{ data: existing }, { data: top }] = await Promise.all([
    supabase.from("board_items").select("y, h").eq("board_id", board.id).is("parent_id", null),
    supabase.from("board_items").select("z").eq("board_id", board.id).order("z", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const bottom = (existing ?? []).reduce((m, r) => Math.max(m, Number(r.y) + Number(r.h)), 0);

  // Download first, so a failed image is reported and simply not placed.
  const stored = await inBatches(entries, 4, (e) =>
    e.type === "image" ? storeImage(owner.studioId, board.id, e.url) : Promise.resolve(null)
  );
  const placing: { entry: (typeof entries)[number]; store: Stored | null }[] = [];
  entries.forEach((entry, i) => {
    const st = stored[i];
    if (entry.type === "image" && st && !st.ok) {
      skipped.push(`Image ${entry.url}: ${st.reason}.`);
      return;
    }
    placing.push({ entry, store: st });
  });
  if (!placing.length) return { error: "None of the images could be fetched.", skipped };

  const sizes = placing.map(({ entry, store }) =>
    entry.type === "heading"
      ? { kind: "heading" as const, h: 60 }
      : entry.type === "note"
        ? { kind: "note" as const, h: 160 }
        : { kind: "media" as const, h: store?.ok ? mediaHeight(store.width, store.height) : 200 }
  );
  const spots = layoutEntries(bottom, sizes);
  let z = (top?.z ?? 0) + 1;
  const rows = placing.map(({ entry, store }, i) => {
    const base = {
      studio_id: owner.studioId,
      board_id: board.id,
      x: spots[i].x,
      y: spots[i].y,
      w: spots[i].w,
      h: spots[i].h,
      z: z++,
      created_by: owner.userId,
    };
    if (entry.type === "heading") return { ...base, kind: "heading", name: null, text: entry.text, hue: null };
    if (entry.type === "note") return { ...base, kind: "note", name: null, text: noteHtml(entry.text), hue: "yellow" };
    const st = store as Extract<Stored, { ok: true }>;
    return {
      ...base,
      kind: "image",
      name: st.name,
      mime_type: st.mime,
      storage_path: st.path,
      text: entry.caption ? JSON.stringify({ fit: "cover", caption: noteHtml(entry.caption) }) : null,
      w: MEDIA_W,
    };
  });
  const { error } = await supabase.from("board_items").insert(rows);
  if (error) return { error: "The items could not be saved to the board.", skipped };

  const count = (t: string) => placing.filter((p) => p.entry.type === t).length;
  return {
    added: { images: count("image"), notes: count("note"), headings: count("heading") },
    board: board.name,
    skipped,
    open: boardLink(board.project_id, board.kind),
  };
}

export async function addStoryboardFramesTool(owner: ConnectorOwner, args: Json) {
  const board = await readBoard(owner, String(args.board_id ?? "").trim());
  if (!board) return { error: "No board with that id is visible here." };
  if (board.kind !== "storyboard") {
    return { error: "That is a moodboard. Use add_to_moodboard for it." };
  }
  const { frames, skipped } = parseFrames(args.frames);
  if (!frames.length) return { error: "No usable frames to add.", skipped };

  const supabase = createClient();
  const { data: last } = await supabase
    .from("storyboard_frames")
    .select("position")
    .eq("board_id", board.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const stored = await inBatches(frames, 4, (f) =>
    f.imageUrl ? storeImage(owner.studioId, board.id, f.imageUrl) : Promise.resolve(null)
  );
  let position = (last?.position ?? -1) + 1;
  let pictured = 0;
  const rows = frames.map((f, i) => {
    const st = stored[i];
    // A frame whose picture failed still lands, text only, and is named: a
    // missing frame would renumber the board, which is worse than a blank.
    if (f.imageUrl && st && !st.ok) skipped.push(`Frame ${i + 1}: picture not added (${st.reason}); added as text only.`);
    const ok = st && st.ok ? st : null;
    if (ok) pictured++;
    return {
      studio_id: owner.studioId,
      board_id: board.id,
      position: position++,
      scene: f.scene,
      description: f.description,
      sound: f.sound,
      notes: f.notes,
      storage_path: ok?.path ?? null,
      mime_type: ok?.mime ?? null,
      image_name: ok?.name ?? null,
      created_by: owner.userId,
    };
  });
  const { error } = await supabase.from("storyboard_frames").insert(rows);
  if (error) return { error: "The frames could not be saved.", skipped };
  return {
    added: { frames: rows.length, with_pictures: pictured, text_only: rows.length - pictured },
    board: board.name,
    skipped,
    open: boardLink(board.project_id, board.kind),
  };
}

export const WRITERS: Record<string, (owner: ConnectorOwner, args: Json) => Promise<unknown>> = {
  create_board: createBoardTool,
  add_to_moodboard: addToMoodboardTool,
  add_storyboard_frames: addStoryboardFramesTool,
};
