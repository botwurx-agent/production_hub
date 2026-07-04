"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import {
  getAccessToken,
  parseFileKey,
  getFileFrames,
  getImageUrls,
  fetchImageBytes,
} from "@/lib/figma";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type FigmaState = { error?: string } | null;

async function getFigmaAccount(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry")
    .eq("provider", "figma")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export type FigmaFrameCard = {
  id: string;
  name: string;
  page: string;
  thumb: string | null;
};

// Loads a Figma file's top-level frames with rendered thumbnails.
export async function loadFigmaFrames(
  fileUrl: string
): Promise<
  { fileKey: string; fileName: string; frames: FigmaFrameCard[] } | { error: string }
> {
  await requireStudioContext();
  const key = parseFileKey(fileUrl);
  if (!key) return { error: "Paste a valid Figma file link." };

  const supabase = createClient();
  const account = await getFigmaAccount(supabase);
  if (!account) return { error: "Connect Figma in Settings first." };

  try {
    const token = await getAccessToken(supabase, account);
    const { fileName, frames } = await getFileFrames(token, key);
    if (frames.length === 0) {
      return { fileKey: key, fileName, frames: [] };
    }
    // Thumbnails at scale 1 (lighter); cap how many we render at once.
    const ids = frames.slice(0, 60).map((f) => f.id);
    const images = await getImageUrls(token, key, ids, 1);
    const cards: FigmaFrameCard[] = frames.slice(0, 60).map((f) => ({
      id: f.id,
      name: f.name,
      page: f.page,
      thumb: images[f.id] ?? null,
    }));
    return { fileKey: key, fileName, frames: cards };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not load file." };
  }
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "frame";
}

// Imports a Figma frame as a PNG asset (rendered at 2x).
export async function importFigmaFrame(
  projectId: string,
  fileKey: string,
  nodeId: string,
  name: string
): Promise<FigmaState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const account = await getFigmaAccount(supabase);
  if (!account) return { error: "Connect Figma in Settings first." };

  try {
    const token = await getAccessToken(supabase, account);
    const images = await getImageUrls(token, fileKey, [nodeId], 2);
    const url = images[nodeId];
    if (!url) return { error: "Figma could not render that frame." };
    const bytes = await fetchImageBytes(url);

    const filename = `${safeName(name)}.png`;
    const path = `${ctx.studio.id}/${projectId}/figma-${crypto.randomUUID()}-${filename}`;
    const { error: upErr } = await supabase.storage
      .from("assets")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) return { error: upErr.message };

    const { data: asset, error: aErr } = await supabase
      .from("assets")
      .insert({
        studio_id: ctx.studio.id,
        project_id: projectId,
        name,
        type: "image",
        status: "draft",
        source: "figma",
        external_ref: { figma_file_key: fileKey, figma_node_id: nodeId },
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (aErr) return { error: aErr.message };

    const { data: version, error: vErr } = await supabase
      .from("versions")
      .insert({
        studio_id: ctx.studio.id,
        asset_id: asset.id,
        version_number: 1,
        storage_path: path,
        mime_type: "image/png",
        size_bytes: bytes.length,
        notes: "Imported from Figma",
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (vErr) return { error: vErr.message };

    await supabase
      .from("assets")
      .update({ current_version_id: version.id })
      .eq("id", asset.id);

    await supabase.from("activity").insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      author_id: ctx.userId,
      type: "upload",
      content: `Imported "${name}" from Figma`,
    });

    revalidatePath(`/projects/${projectId}`);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed." };
  }
}
