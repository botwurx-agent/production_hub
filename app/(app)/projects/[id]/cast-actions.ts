"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { normalizeHandle, refKind, slugify } from "@/lib/cast";
import { assetStorage } from "@/lib/asset-storage";
import {
  aspectRatio,
  fetchMediaFromUrl,
  resolutionLabel,
} from "@/lib/media-import";

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "sheet";
}

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/cast`);
  revalidatePath(`/projects/${projectId}/pipeline`);
}

export type ReferenceInput = {
  kind: string;
  name: string;
  description: string | null;
  notes: string | null;
  /** The reusable prompt that generates this one. The recipe, not a log. */
  prompt: string | null;
  /** true = studio-wide, for a recurring mascot or spokesperson */
  studioWide: boolean;
};

/**
 * References live in `ai_entities`. The table keeps its name from when the
 * model had three levels (migration 0080), flattened by 0082; renaming it would
 * be churn across every RLS policy and the agent schema map for no behaviour.
 */
export async function saveReference(
  projectId: string,
  refId: string | null,
  input: ReferenceInput
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const name = input.name.trim();
  if (!name) return { error: "Give it a name." };

  // Derived, never asked for. The operator already names the thing twice (here
  // and on the platform); a third identifier was pure ceremony.
  const base = slugify(name);
  if (!base) return { error: "That name has no letters or numbers in it." };

  const row = {
    studio_id: ctx.studio.id,
    project_id: input.studioWide ? null : projectId,
    kind: refKind(input.kind),
    name,
    description: input.description?.trim() || null,
    notes: input.notes?.trim() || null,
    prompt: input.prompt?.trim() || null,
  };

  // A duplicate name is not an error worth stopping on, so the slug gets a
  // suffix rather than the save getting refused.
  let slug = base;
  for (let n = 2; n < 40; n++) {
    const { data: clash } = await supabase
      .from("ai_entities")
      .select("id")
      .eq("studio_id", ctx.studio.id)
      .eq("slug", slug)
      .maybeSingle();
    if (!clash || clash.id === refId) break;
    slug = `${base}_${n}`;
  }

  const { data, error } = refId
    ? await supabase
        .from("ai_entities")
        .update({ ...row, slug })
        .eq("id", refId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("ai_entities")
        .insert({ ...row, slug, created_by: ctx.userId })
        .select("id")
        .maybeSingle();

  if (error) {
    reportError("saveReference", { error, projectId });
    return { error: "Could not save that." };
  }
  rp(projectId);
  return { id: data?.id ?? refId };
}

export async function archiveReference(projectId: string, refId: string) {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("ai_entities")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", refId);
  if (error) {
    reportError("archiveReference", { error, projectId });
    return { error: "Could not remove that." };
  }
  rp(projectId);
  return {};
}

/**
 * A handle is RECORDED EXTERNAL STATE: the name the platform gave this
 * reference when you uploaded it. Stored as typed, with no charset of our own
 * imposed, because a rule invented here is how the true handle becomes
 * unrecordable.
 */
export async function saveHandle(
  projectId: string,
  refId: string,
  platform: string,
  rawHandle: string
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const handle = normalizeHandle(rawHandle);
  if (!handle) return { error: "Enter the handle the platform gave you." };
  if (!platform.trim()) return { error: "Say which platform it is on." };

  const { error } = await supabase.from("ai_entity_handles").insert({
    studio_id: ctx.studio.id,
    entity_id: refId,
    look_id: null,
    platform: platform.trim(),
    handle,
  });

  if (error) {
    reportError("saveHandle", { error, projectId });
    if (error.code === "23505") {
      return {
        error: `@${handle} is already used by something else on ${platform}.`,
      };
    }
    return { error: "Could not save that handle." };
  }
  rp(projectId);
  return { handle };
}

export async function deleteHandle(projectId: string, handleId: string) {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("ai_entity_handles")
    .delete()
    .eq("id", handleId);
  if (error) {
    reportError("deleteHandle", { error, projectId });
    return { error: "Could not remove that handle." };
  }
  rp(projectId);
  return {};
}

/** Which references a shot uses. Set from the shot, in the pipeline. */
export async function setShotReference(
  projectId: string,
  shotId: string,
  refId: string,
  used: boolean
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  if (!used) {
    const { error } = await supabase
      .from("ai_shot_cast")
      .delete()
      .eq("shot_id", shotId)
      .eq("entity_id", refId);
    if (error) {
      reportError("setShotReference:remove", { error, projectId });
      return { error: "Could not update that shot." };
    }
    rp(projectId);
    return {};
  }

  const { error } = await supabase.from("ai_shot_cast").upsert(
    { studio_id: ctx.studio.id, shot_id: shotId, entity_id: refId },
    { onConflict: "shot_id,entity_id" }
  );
  if (error) {
    reportError("setShotReference", { error, projectId });
    return { error: "Could not update that shot." };
  }
  rp(projectId);
  return {};
}

/**
 * A reference image. Stored as an ai_generations row owned by the reference
 * (migration 0080), so it inherits storage, signing and provenance rather than
 * needing a table of its own.
 *
 * The bytes are already in storage: the browser uploads directly through a
 * server-minted signed URL, because routing a multi-megabyte sheet through a
 * server action would hit the ~4.5MB request cap.
 */
export async function addSheet(
  projectId: string,
  refId: string,
  filePath: string,
  platform?: string | null
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { error } = await supabase.from("ai_generations").insert({
    studio_id: ctx.studio.id,
    shot_id: null,
    entity_id: refId,
    look_id: null,
    stage: "image",
    kind: "image",
    // 'reference' keeps these out of the candidate pool in triage.
    status: "reference",
    file_path: filePath,
    platform: platform || null,
    generated_by: ctx.userId,
  });

  if (error) {
    reportError("addSheet", { error, projectId });
    return { error: "Could not save that image." };
  }
  rp(projectId);
  return {};
}

/**
 * The same image arriving as a link. A reference usually lives behind a share
 * page on the platform that made it, so downloading it in order to upload it
 * again is a round trip for nothing. Bytes are fetched SERVER side, which is
 * what keeps the SSRF guard and the size cap in play.
 */
export async function addSheetFromLink(
  projectId: string,
  refId: string,
  rawUrl: string
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const url = rawUrl.trim();
  if (!url) return { error: "Paste a link first." };

  const media = await fetchMediaFromUrl(url);
  if ("error" in media) return { error: media.error };
  if (media.kind !== "image") {
    return { error: "That link is not an image." };
  }

  const path = `${ctx.studio.id}/cast/${projectId}/${crypto.randomUUID()}-${safeName(media.filename)}`;
  const { error: upErr } = await assetStorage().upload(path, media.bytes, {
    contentType: media.contentType || undefined,
    upsert: false,
  });
  if (upErr) {
    reportError("addSheetFromLink:upload", { error: upErr, projectId });
    return { error: "Could not save that image." };
  }

  const { error } = await supabase.from("ai_generations").insert({
    studio_id: ctx.studio.id,
    shot_id: null,
    entity_id: refId,
    look_id: null,
    stage: "image",
    kind: "image",
    status: "reference",
    file_path: path,
    platform: media.platform,
    aspect: aspectRatio(media.width, media.height),
    resolution: resolutionLabel(media.width, media.height, media.kind),
    external_url: media.sourceUrl,
    generated_by: ctx.userId,
  });

  if (error) {
    reportError("addSheetFromLink", { error, projectId });
    return { error: "Could not save that image." };
  }
  rp(projectId);
  return {};
}

export async function deleteSheet(projectId: string, generationId: string) {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("ai_generations")
    .delete()
    .eq("id", generationId);
  if (error) {
    reportError("deleteSheet", { error, projectId });
    return { error: "Could not remove that image." };
  }
  rp(projectId);
  return {};
}

/**
 * Turn a loose image reference into a named element.
 *
 * This is the move Higgsfield itself supports and the reason the two things
 * were never really separate: you feed an image into a shot, it works, and then
 * you save it so every later prompt can call it by name. Before this, doing that
 * here meant re-uploading the same file on another page.
 *
 * The generation is NOT moved. A new reference row points at the same stored
 * file, so the shot keeps the input it was built from and the library gets its
 * own copy of the record. Storage holds one blob either way.
 */
export async function promoteToReference(
  projectId: string,
  generationId: string,
  input: { name: string; kind: string; platform: string; handle: string }
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const name = input.name.trim();
  if (!name) return { error: "Give it a name." };

  const { data: gen } = await supabase
    .from("ai_generations")
    .select("id, file_path, external_url, platform, shot_id")
    .eq("id", generationId)
    .maybeSingle();
  if (!gen) return { error: "That image was not found." };

  const created = await saveReference(projectId, null, {
    kind: input.kind,
    name,
    description: null,
    notes: null,
    prompt: null,
    studioWide: false,
  });
  if ("error" in created && created.error) return { error: created.error };
  const refId = "id" in created ? created.id : null;
  if (!refId) return { error: "Could not save that." };

  const { error: sheetError } = await supabase.from("ai_generations").insert({
    studio_id: ctx.studio.id,
    shot_id: null,
    entity_id: refId,
    look_id: null,
    stage: "image",
    kind: "image",
    status: "reference",
    file_path: gen.file_path,
    external_url: gen.external_url,
    platform: gen.platform,
    generated_by: ctx.userId,
  });
  if (sheetError) reportError("promoteToReference:sheet", { error: sheetError, projectId });

  const handle = input.handle.trim();
  if (handle) {
    const h = await saveHandle(projectId, refId, input.platform, handle);
    if ("error" in h && h.error) return { id: refId, warning: h.error };
  }

  // It is already in this shot: that is where it was being used.
  if (gen.shot_id) {
    await supabase
      .from("ai_shot_cast")
      .upsert(
        { studio_id: ctx.studio.id, shot_id: gen.shot_id, entity_id: refId },
        { onConflict: "shot_id,entity_id" }
      );
  }

  rp(projectId);
  return { id: refId };
}
