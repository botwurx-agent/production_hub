"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { entityKind, normalizeHandle, slugify } from "@/lib/cast";
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

export type EntityInput = {
  kind: string;
  name: string;
  slug: string;
  description: string | null;
  notes: string | null;
  /** The reusable prompt that generates this one's sheets. */
  prompt: string | null;
  /** true = studio-wide, for a recurring mascot or spokesperson */
  studioWide: boolean;
};

export async function saveEntity(
  projectId: string,
  entityId: string | null,
  input: EntityInput
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const name = input.name.trim();
  if (!name) return { error: "Give it a name." };

  // Fall back to the name so a blank slug never reaches the unique index.
  const slug = slugify(input.slug || name);
  if (!slug) return { error: "That name has no letters or numbers in it." };

  const row = {
    studio_id: ctx.studio.id,
    project_id: input.studioWide ? null : projectId,
    kind: entityKind(input.kind),
    name,
    slug,
    description: input.description?.trim() || null,
    notes: input.notes?.trim() || null,
    prompt: input.prompt?.trim() || null,
  };

  const { data, error } = entityId
    ? await supabase
        .from("ai_entities")
        .update(row)
        .eq("id", entityId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("ai_entities")
        .insert({ ...row, created_by: ctx.userId })
        .select("id")
        .maybeSingle();

  if (error) {
    reportError("saveEntity", { error: error, projectId });
    // 23505 is the unique index on (studio, project, slug)
    if (error.code === "23505") {
      return { error: `Something here already uses the name "${slug}".` };
    }
    return { error: "Could not save that." };
  }
  rp(projectId);
  return { id: data?.id ?? entityId };
}

export async function archiveEntity(projectId: string, entityId: string) {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("ai_entities")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", entityId);
  if (error) {
    reportError("archiveEntity", { error: error, projectId });
    return { error: "Could not remove that." };
  }
  rp(projectId);
  return {};
}

export type LookInput = {
  name: string;
  slug: string;
  description: string | null;
  prompt: string | null;
  itemEntityIds: string[];
};

export async function saveLook(
  projectId: string,
  entityId: string,
  lookId: string | null,
  input: LookInput
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const name = input.name.trim();
  if (!name) return { error: "Give the look a name." };
  const slug = slugify(input.slug || name);
  if (!slug) return { error: "That name has no letters or numbers in it." };

  const row = {
    studio_id: ctx.studio.id,
    entity_id: entityId,
    name,
    slug,
    description: input.description?.trim() || null,
    prompt: input.prompt?.trim() || null,
  };

  const { data, error } = lookId
    ? await supabase.from("ai_looks").update(row).eq("id", lookId).select("id").maybeSingle()
    : await supabase
        .from("ai_looks")
        .insert({ ...row, created_by: ctx.userId })
        .select("id")
        .maybeSingle();

  if (error) {
    reportError("saveLook", { error: error, projectId });
    if (error.code === "23505") {
      return { error: `This already has a look called "${slug}".` };
    }
    return { error: "Could not save that look." };
  }

  const id = data?.id ?? lookId;
  if (!id) return { error: "Could not save that look." };

  // A look is a composition, so the item set is replaced wholesale rather than
  // diffed: it is a short list and the write is idempotent.
  await supabase.from("ai_look_items").delete().eq("look_id", id);
  if (input.itemEntityIds.length) {
    const { error: itemError } = await supabase.from("ai_look_items").insert(
      input.itemEntityIds.map((itemId, i) => ({
        studio_id: ctx.studio.id,
        look_id: id,
        item_entity_id: itemId,
        position: i,
      }))
    );
    if (itemError) reportError("saveLookItems", { error: itemError, projectId });
  }

  rp(projectId);
  return { id };
}

export async function deleteLook(projectId: string, lookId: string) {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase.from("ai_looks").delete().eq("id", lookId);
  if (error) {
    reportError("deleteLook", { error: error, projectId });
    return { error: "Could not delete that look." };
  }
  rp(projectId);
  return {};
}

/**
 * Handles are recorded external state: the string the platform gave back when
 * you uploaded the element. Normalised on write because the same handle typed
 * by hand three times comes out three different ways, and two near-identical
 * handles are worse than one.
 */
export async function saveHandle(
  projectId: string,
  owner: { entityId: string } | { lookId: string },
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
    entity_id: "entityId" in owner ? owner.entityId : null,
    look_id: "lookId" in owner ? owner.lookId : null,
    platform: platform.trim(),
    handle,
  });

  if (error) {
    reportError("saveHandle", { error: error, projectId });
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
  const { error } = await supabase.from("ai_entity_handles").delete().eq("id", handleId);
  if (error) {
    reportError("deleteHandle", { error: error, projectId });
    return { error: "Could not remove that handle." };
  }
  rp(projectId);
  return {};
}

/**
 * The grid cell. Assigning with no look, or changing the look, is the same
 * write; clearing removes the row entirely so an empty cell means "not in this
 * shot" rather than "in it, wearing nothing".
 */
export async function setShotCast(
  projectId: string,
  shotId: string,
  entityId: string,
  lookId: string | null,
  present: boolean,
  count?: number | null
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  if (!present) {
    const { error } = await supabase
      .from("ai_shot_cast")
      .delete()
      .eq("shot_id", shotId)
      .eq("entity_id", entityId);
    if (error) {
      reportError("setShotCast:remove", { error: error, projectId });
      return { error: "Could not update that shot." };
    }
    rp(projectId);
    return {};
  }

  const { error } = await supabase.from("ai_shot_cast").upsert(
    {
      studio_id: ctx.studio.id,
      shot_id: shotId,
      entity_id: entityId,
      look_id: lookId,
      count: count ?? null,
    },
    { onConflict: "shot_id,entity_id" }
  );

  if (error) {
    reportError("setShotCast", { error: error, projectId });
    return { error: "Could not update that shot." };
  }
  rp(projectId);
  return {};
}

/**
 * Reference sheets. A sheet is an ai_generations row owned by the entity or the
 * look rather than by a shot (migration 0080), so it inherits storage,
 * provenance, signing and the review machinery instead of needing a table of
 * its own.
 *
 * The bytes are already in storage by the time this runs: the browser uploads
 * directly through a server-minted signed URL, because routing a multi-megabyte
 * sheet through a server action would hit the ~4.5MB request cap.
 */
export async function addSheet(
  projectId: string,
  owner: { entityId: string } | { lookId: string },
  filePath: string,
  platform?: string | null
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: created, error } = await supabase
    .from("ai_generations")
    .insert({
      studio_id: ctx.studio.id,
      shot_id: null,
      entity_id: "entityId" in owner ? owner.entityId : null,
      look_id: "lookId" in owner ? owner.lookId : null,
      stage: "image",
      kind: "image",
      // 'reference' keeps sheets out of the candidate pool in triage, the same
      // way v2v driving clips are kept out.
      status: "reference",
      file_path: filePath,
      platform: platform || null,
      generated_by: ctx.userId,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    reportError("addSheet", { error, projectId });
    return { error: "Could not save that sheet." };
  }

  // A look's sheet is the COMBINED render: the character wearing this
  // wardrobe. It is derived from the identity sheet and the garment sheets, so
  // record that lineage through ai_generation_refs, the same table the pipeline
  // already uses for "this take came from those inputs". Six months later that
  // is the difference between a sheet you can rebuild and one you cannot.
  if ("lookId" in owner) {
    await recordLookLineage(supabase, ctx.studio.id, owner.lookId, created.id);
  }

  rp(projectId);
  return {};
}

/**
 * Links a freshly uploaded look sheet to the sheets it was made from: the
 * character's identity sheet, and one per garment in the look's composition.
 *
 * Best effort by design. A missing source sheet means less recorded lineage,
 * never a failed upload, because losing the file the operator just waited on
 * would be a far worse outcome than losing a provenance row.
 */
async function recordLookLineage(
  supabase: ReturnType<typeof createClient>,
  studioId: string,
  lookId: string,
  generationId: string
) {
  const { data: look } = await supabase
    .from("ai_looks")
    .select("entity_id")
    .eq("id", lookId)
    .maybeSingle();
  if (!look) return;

  const { data: items } = await supabase
    .from("ai_look_items")
    .select("item_entity_id, position")
    .eq("look_id", lookId)
    .order("position", { ascending: true });

  const sourceEntityIds = [
    look.entity_id,
    ...(items ?? []).map((i) => i.item_entity_id),
  ];

  // Newest sheet per source entity: the current reference, not the first one
  // ever uploaded.
  const { data: sheets } = await supabase
    .from("ai_generations")
    .select("id, entity_id, created_at")
    .eq("studio_id", studioId)
    .in("entity_id", sourceEntityIds)
    .order("created_at", { ascending: false });

  const newest = new Map<string, string>();
  for (const s of sheets ?? []) {
    if (s.entity_id && !newest.has(s.entity_id)) newest.set(s.entity_id, s.id);
  }
  if (newest.size === 0) return;

  const rows = sourceEntityIds
    .map((entityId, i) => {
      const refId = newest.get(entityId);
      if (!refId) return null;
      return {
        studio_id: studioId,
        generation_id: generationId,
        ref_generation_id: refId,
        // 'character' for the identity sheet, 'element' for each garment, the
        // same vocabulary REF_ROLES already uses in the pipeline.
        role: entityId === look.entity_id ? "character" : "element",
        position: i,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const { error } = await supabase.from("ai_generation_refs").insert(rows);
  if (error) reportError("recordLookLineage", { error, lookId });
}

/**
 * The same sheet, arriving as a link instead of a file.
 *
 * A sheet is usually generated on another platform and sits behind a share
 * page, so downloading it just to upload it again is a round trip through the
 * filesystem for no reason. This is the pipeline's paste-a-link import applied
 * to the cast: the bytes are fetched SERVER-side (fetchMediaFromUrl is
 * SSRF-guarded and caps the size), stored in the studio folder, and the source
 * link is kept on the row so the original is one click away.
 *
 * A direct image URL and a share page both work: the fetcher parses og:image
 * when the URL is a page rather than a file.
 */
export async function addSheetFromLink(
  projectId: string,
  owner: { entityId: string } | { lookId: string },
  rawUrl: string
) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const url = rawUrl.trim();
  if (!url) return { error: "Paste a link first." };

  const media = await fetchMediaFromUrl(url);
  if ("error" in media) return { error: media.error };
  if (media.kind !== "image") {
    return { error: "That link is not an image. A reference sheet is a still." };
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

  const { data: created, error } = await supabase
    .from("ai_generations")
    .insert({
      studio_id: ctx.studio.id,
      shot_id: null,
      entity_id: "entityId" in owner ? owner.entityId : null,
      look_id: "lookId" in owner ? owner.lookId : null,
      stage: "image",
      kind: "image",
      status: "reference",
      file_path: path,
      // Auto-derived, same as the pipeline import: the platform from the link's
      // host, the shape from the real bytes.
      platform: media.platform,
      aspect: aspectRatio(media.width, media.height),
      resolution: resolutionLabel(media.width, media.height, media.kind),
      external_url: media.sourceUrl,
      generated_by: ctx.userId,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    reportError("addSheetFromLink", { error, projectId });
    return { error: "Could not save that sheet." };
  }

  if ("lookId" in owner) {
    await recordLookLineage(supabase, ctx.studio.id, owner.lookId, created.id);
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
    return { error: "Could not remove that sheet." };
  }
  rp(projectId);
  return {};
}
