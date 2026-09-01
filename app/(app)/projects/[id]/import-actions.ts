"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { aiConfigured, extractShotDoc, type AiDocument } from "@/lib/ai";
import type { ShotDocDraft, ShotDocRow } from "@/lib/shot-doc";
import { isFrameAspect } from "@/lib/frame-aspect";

/**
 * A shot row, plus the panel it was matched to.
 *
 * The picture rides on the CARD (shot_cards carries storage_path directly), not
 * as an asset row: the crop already lives in storage from the storyboard half
 * of the same import, so this points at the bytes that are there rather than
 * uploading them twice or filling the project's asset library with sixteen
 * crops nobody asked for.
 */
export type ImportShotRow = ShotDocRow & {
  image?: {
    storagePath: string;
    mimeType: string | null;
    name: string | null;
  } | null;
};

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/shot-list`);
  revalidatePath(`/projects/${projectId}/storyboards`);
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Read a director's document and PROPOSE what is in it.
 *
 * Writes nothing, by design, and the same contract as the invoice extractor and
 * the SOW reader: the model reads, the producer confirms, an ordinary action
 * saves. A shot list written by a model unattended is worse than no import,
 * because every wrong row is a row somebody has to find and delete.
 *
 * The caller sends TEXT when the PDF has a text layer, which is most of them and
 * is both cheaper and exact. Page images are the fallback for a scan.
 */
export async function readProductionDoc(input: {
  text?: string;
  pages?: AiDocument[];
}): Promise<{ draft: ShotDocDraft } | { error: string }> {
  await requireStudioContext();
  if (!aiConfigured()) {
    return { error: "Reading a document needs an AI key, which is not set up here." };
  }

  const text = input.text?.trim();
  try {
    const draft = text
      ? await extractShotDoc({ text })
      : input.pages?.length
        ? await extractShotDoc({ docs: input.pages })
        : null;
    if (!draft) return { error: "There was nothing readable in that file." };
    return { draft };
  } catch (e) {
    reportError("readProductionDoc", { error: e });
    return {
      error:
        e instanceof Error && /too long/i.test(e.message)
          ? "That document is too long to read in one go. Try splitting it."
          : "That document could not be read.",
    };
  }
}

/**
 * Create a shot list from confirmed rows.
 *
 * A NEW list every time, named after the file, rather than appending to
 * whatever happened to be open: a director's package is its own document, and
 * merging it into an existing list makes it impossible to tell later which
 * rows came from where.
 */
export async function importShotList(
  projectId: string,
  title: string,
  rows: ImportShotRow[]
): Promise<{ groupId: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  if (!rows.length) return { error: "Nothing selected to import." };

  const { data: last } = await supabase
    .from("shot_groups")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: group, error } = await supabase
    .from("shot_groups")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      position: (last?.position ?? -1) + 1,
      title: title.trim().slice(0, 120) || "Imported shot list",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !group) {
    reportError("importShotList:group", { error, projectId });
    return { error: "Could not create that shot list." };
  }

  const { error: cardError } = await supabase.from("shot_cards").insert(
    rows.slice(0, 300).map((r, position) => ({
      studio_id: ctx.studio.id,
      group_id: group.id,
      position,
      code: r.code,
      description: r.description,
      shot_size: r.size,
      shot_type: r.type,
      movement: r.movement,
      day: r.day,
      // NOTES, not VO. This wrote the deck's NOTES section into `vo`, the
      // voiceover / supers field, because shot_cards had no notes column: an
      // imported shot list came back with camera, staging and build notes
      // filed under "VO / OST" on the export, and there was no input anywhere
      // in the app to correct it. Migration 0101 gave notes their own home.
      // `vo` is left empty on import: a treatment's notes were never
      // voiceover, and guessing which lines are spoken is the producer's call.
      notes: r.notes,
      storage_path: r.image?.storagePath ?? null,
      mime_type: r.image?.mimeType ?? null,
      image_name: r.image?.name ?? null,
      tags: [],
      created_by: ctx.userId,
    }))
  );
  if (cardError) {
    reportError("importShotList:cards", { error: cardError, projectId });
    return { error: "The list was created but its shots could not be saved." };
  }

  rp(projectId);
  return { groupId: group.id };
}

/**
 * Create a storyboard from panels the browser has ALREADY cropped and uploaded.
 *
 * No bytes here: the crops went straight to storage through a server-minted
 * signed URL, same as every other image in the app, so a 24-panel board is not
 * bounded by the Server Action request body.
 */
export async function importStoryboard(
  projectId: string,
  name: string,
  frames: {
    storagePath: string;
    mimeType: string | null;
    /** A shot code printed with the caption, when the board prints one. */
    scene?: string | null;
    caption: string | null;
    /** The line spoken over the frame, where the board labels one. */
    sound?: string | null;
    /** What the camera does, and anything the board filed under notes. */
    notes?: string | null;
  }[],
  /**
   * The shape the panels were drawn in, measured at import.
   *
   * Stored on the board so the grid can be sized to the artwork instead of
   * cropping it into a landscape box. Null when the panels did not agree on a
   * shape, which leaves the board on the app default.
   */
  frameAspect?: string | null
): Promise<{ boardId: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  if (!frames.length) return { error: "No panels to import." };

  const { data: last } = await supabase
    .from("boards")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: board, error } = await supabase
    .from("boards")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      kind: "storyboard",
      name: name.trim().slice(0, 120) || "Imported storyboard",
      // Validated rather than trusted: this arrives from the browser and goes
      // straight into a CSS aspect-ratio.
      frame_aspect: isFrameAspect(frameAspect) ? frameAspect : null,
      position: (last?.position ?? -1) + 1,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !board) {
    reportError("importStoryboard:board", { error, projectId });
    return { error: "Could not create that storyboard." };
  }

  const { error: frameError } = await supabase.from("storyboard_frames").insert(
    frames.slice(0, 300).map((f, position) => ({
      studio_id: ctx.studio.id,
      board_id: board.id,
      position,
      storage_path: f.storagePath,
      mime_type: f.mimeType,
      scene: f.scene?.slice(0, 120) || null,
      description: f.caption,
      sound: f.sound?.slice(0, 2000) || null,
      notes: f.notes?.slice(0, 2000) || null,
      created_by: ctx.userId,
    }))
  );
  if (frameError) {
    reportError("importStoryboard:frames", { error: frameError, projectId });
    return { error: "The storyboard was created but its frames could not be saved." };
  }

  rp(projectId);
  return { boardId: board.id };
}

/**
 * File the source PDF alongside what came out of it.
 *
 * Not optional. Six weeks on, "where is the director's original board" has to
 * have an answer, and an import that consumes a document and discards it is how
 * that answer gets lost.
 */
export async function fileSourceDocument(
  projectId: string,
  input: { storagePath: string; mimeType: string | null; name: string }
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: asset, error } = await supabase
    .from("assets")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      name: input.name.slice(0, 200),
      type: "document",
      status: "draft",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !asset) {
    reportError("fileSourceDocument:asset", { error, projectId });
    return { error: "Could not file the source document." };
  }

  const { data: version, error: vError } = await supabase
    .from("versions")
    .insert({
      studio_id: ctx.studio.id,
      asset_id: asset.id,
      version_number: 1,
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (vError || !version) {
    reportError("fileSourceDocument:version", { error: vError, projectId });
    return { error: "Could not file the source document." };
  }

  await supabase
    .from("assets")
    .update({ current_version_id: version.id })
    .eq("id", asset.id);

  revalidatePath(`/projects/${projectId}/documents`);
  return { ok: true };
}
