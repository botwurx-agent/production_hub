"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { aiConfigured, extractShotDoc, type AiDocument } from "@/lib/ai";
import type { ShotDocDraft, ShotDocRow } from "@/lib/shot-doc";

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
  rows: ShotDocRow[]
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
      vo: r.notes,
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
  frames: { storagePath: string; mimeType: string | null; caption: string | null }[]
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
      description: f.caption,
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
