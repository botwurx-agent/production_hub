"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { entityKind, normalizeHandle, slugify } from "@/lib/cast";

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
