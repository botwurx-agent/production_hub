import "server-only";
import { createClient } from "@/lib/supabase/server";
import { assetStorage } from "@/lib/asset-storage";
import {
  entityKind,
  type CastAssignment,
  type CastEntity,
  type CastHandle,
  type CastLook,
  type CastShot,
} from "@/lib/cast";

/**
 * Everything the cast page and the continuity grid need, in one round of
 * queries. Studio-wide entities (project_id null) are included alongside the
 * project's own, because a recurring mascot belongs to the studio but appears
 * in this job's shots.
 */
export async function loadCast(projectId: string, studioId: string) {
  const supabase = createClient();

  const { data: entityRows } = await supabase
    .from("ai_entities")
    .select("*")
    .eq("studio_id", studioId)
    .or(`project_id.eq.${projectId},project_id.is.null`)
    .is("archived_at", null)
    .order("kind", { ascending: true })
    .order("name", { ascending: true });

  const entities = entityRows ?? [];
  const entityIds = entities.map((e) => e.id);

  if (entityIds.length === 0) {
    const { data: shotRows } = await supabase
      .from("ai_shots")
      .select("id, position, title")
      .eq("project_id", projectId)
      .order("position", { ascending: true });
    return {
      entities: [] as CastEntity[],
      shots: (shotRows ?? []) as CastShot[],
      assignments: [] as CastAssignment[],
    };
  }

  const [{ data: lookRows }, { data: handleRows }, { data: shotRows }] =
    await Promise.all([
      supabase
        .from("ai_looks")
        .select("*")
        .in("entity_id", entityIds)
        .order("position", { ascending: true }),
      supabase
        .from("ai_entity_handles")
        .select("id, platform, handle, entity_id, look_id")
        .eq("studio_id", studioId),
      supabase
        .from("ai_shots")
        .select("id, position, title")
        .eq("project_id", projectId)
        .order("position", { ascending: true }),
    ]);

  const looks = lookRows ?? [];
  const lookIds = looks.map((l) => l.id);

  const [{ data: itemRows }, { data: castRows }, { data: sheetRows }] =
    await Promise.all([
      lookIds.length
        ? supabase
            .from("ai_look_items")
            .select("look_id, item_entity_id, position")
            .in("look_id", lookIds)
            .order("position", { ascending: true })
        : Promise.resolve({ data: [] as { look_id: string; item_entity_id: string; position: number }[] }),
      (shotRows ?? []).length
        ? supabase
            .from("ai_shot_cast")
            .select("id, shot_id, entity_id, look_id, count, notes")
            .in("shot_id", (shotRows ?? []).map((s) => s.id))
        : Promise.resolve({ data: [] as CastAssignment[] }),
      // sheets: generations owned by an entity or one of its looks
      supabase
        .from("ai_generations")
        .select("id, entity_id, look_id, file_path, external_url, created_at")
        .eq("studio_id", studioId)
        .or(
          `entity_id.in.(${entityIds.join(",")})` +
            (lookIds.length ? `,look_id.in.(${lookIds.join(",")})` : "")
        )
        .order("created_at", { ascending: false }),
    ]);

  // Sign in one pass. A sheet with only an external_url is shown as-is; a share
  // page that cannot render is simply skipped, same rule the pipeline uses.
  const signed = new Map<string, string>();
  for (const row of sheetRows ?? []) {
    if (row.file_path) {
      const { data } = await assetStorage().createSignedUrl(row.file_path, 60 * 60);
      if (data?.signedUrl) signed.set(row.id, data.signedUrl);
    } else if (
      row.external_url &&
      /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(row.external_url)
    ) {
      signed.set(row.id, row.external_url);
    }
  }

  // Lineage for look sheets: which identity and garment sheets each combined
  // render was made from. Resolved to names here so the UI never has to know
  // about ai_generation_refs.
  const lookSheetIds = (sheetRows ?? [])
    .filter((r) => r.look_id)
    .map((r) => r.id);
  const lineage = new Map<string, string[]>();
  if (lookSheetIds.length) {
    const { data: refRows } = await supabase
      .from("ai_generation_refs")
      .select("generation_id, ref_generation_id, position")
      .in("generation_id", lookSheetIds)
      .order("position", { ascending: true });

    const entityOfGeneration = new Map<string, string>();
    for (const r of sheetRows ?? []) {
      if (r.entity_id) entityOfGeneration.set(r.id, r.entity_id);
    }
    const nameOfEntity = new Map(entities.map((e) => [e.id, e.name]));

    for (const r of refRows ?? []) {
      const entityId = entityOfGeneration.get(r.ref_generation_id);
      const name = entityId ? nameOfEntity.get(entityId) : undefined;
      if (!name) continue;
      const list = lineage.get(r.generation_id) ?? [];
      list.push(name);
      lineage.set(r.generation_id, list);
    }
  }

  const handlesFor = (
    predicate: (h: { entity_id: string | null; look_id: string | null }) => boolean
  ): CastHandle[] => (handleRows ?? []).filter(predicate) as CastHandle[];

  const itemsByLook = new Map<string, string[]>();
  for (const it of itemRows ?? []) {
    const list = itemsByLook.get(it.look_id) ?? [];
    list.push(it.item_entity_id);
    itemsByLook.set(it.look_id, list);
  }

  const shaped: CastEntity[] = entities.map((e) => {
    const myLooks: CastLook[] = looks
      .filter((l) => l.entity_id === e.id)
      .map((l) => ({
        id: l.id,
        entity_id: l.entity_id,
        name: l.name,
        slug: l.slug,
        description: l.description,
        position: l.position,
        itemIds: itemsByLook.get(l.id) ?? [],
        handles: handlesFor((h) => h.look_id === l.id),
        sheets: (sheetRows ?? [])
          .filter((r) => r.look_id === l.id && signed.has(r.id))
          .map((r) => ({
            id: r.id,
            url: signed.get(r.id) as string,
            from: lineage.get(r.id) ?? [],
          })),
      }));

    const sheets = (sheetRows ?? [])
      .filter((r) => r.entity_id === e.id && signed.has(r.id))
      .map((r) => ({ id: r.id, url: signed.get(r.id) as string }));

    return {
      id: e.id,
      project_id: e.project_id,
      kind: entityKind(e.kind),
      name: e.name,
      slug: e.slug,
      description: e.description,
      notes: e.notes,
      looks: myLooks,
      handles: handlesFor((h) => h.entity_id === e.id),
      sheets,
    };
  });

  return {
    entities: shaped,
    shots: (shotRows ?? []) as CastShot[],
    assignments: (castRows ?? []) as CastAssignment[],
  };
}
