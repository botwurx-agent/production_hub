import "server-only";
import { createClient } from "@/lib/supabase/server";
import { assetStorage, signThumb } from "@/lib/asset-storage";
import {
  refKind,
  type CastHandle,
  type CastReference,
  type CastSheet,
  type CastShot,
  type CastUse,
} from "@/lib/cast";

/**
 * Everything the references page and the pipeline need, in one round of
 * queries. Studio-wide references (project_id null) come along with the
 * project's own, because a recurring mascot belongs to the studio but appears
 * in this job's shots.
 */
export async function loadCast(projectId: string, studioId: string) {
  const supabase = createClient();

  const [{ data: refRows }, { data: shotRows }] = await Promise.all([
    supabase
      .from("ai_entities")
      .select("*")
      .eq("studio_id", studioId)
      .or(`project_id.eq.${projectId},project_id.is.null`)
      .is("archived_at", null)
      .order("kind", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("ai_shots")
      .select("id, position, title")
      .eq("project_id", projectId)
      .order("position", { ascending: true }),
  ]);

  const rows = refRows ?? [];
  const shots: CastShot[] = (shotRows ?? []).map((s) => ({
    id: s.id,
    position: s.position,
    title: s.title ?? "",
  }));

  if (rows.length === 0) {
    return { references: [] as CastReference[], shots, uses: [] as CastUse[] };
  }

  const ids = rows.map((r) => r.id);
  const shotIds = shots.map((s) => s.id);

  const [{ data: handleRows }, { data: sheetRows }, { data: useRows }] =
    await Promise.all([
      supabase
        .from("ai_entity_handles")
        .select("id, platform, handle, entity_id")
        .in("entity_id", ids),
      supabase
        .from("ai_generations")
        .select("id, entity_id, file_path, external_url, created_at")
        .in("entity_id", ids)
        .order("created_at", { ascending: false }),
      shotIds.length
        ? supabase
            .from("ai_shot_cast")
            .select("shot_id, entity_id")
            .in("shot_id", shotIds)
        : Promise.resolve({ data: [] as { shot_id: string; entity_id: string }[] }),
    ]);

  // Signed in one call. assetStorage() goes through the service client, so a
  // project collaborator sees them too: the access gate is the RLS-authorised
  // row this path came from, one layer up.
  const paths = (sheetRows ?? [])
    .map((r) => r.file_path)
    .filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await assetStorage().createSignedUrls(paths, 60 * 60);
    for (const s of data ?? []) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }

  const handlesBy = new Map<string, CastHandle[]>();
  for (const h of handleRows ?? []) {
    if (!h.entity_id) continue;
    const list = handlesBy.get(h.entity_id) ?? [];
    list.push({ id: h.id, platform: h.platform, handle: h.handle });
    handlesBy.set(h.entity_id, list);
  }

  // A resized copy per sheet, for the grid. These are generator output, so a
  // reference sheet is routinely a 20 to 30MB PNG, and the elements page draws
  // every one of them at card size. The full file is still what opens.
  const thumbed = new Map<string, string>();
  await Promise.all(
    (sheetRows ?? [])
      .filter((r) => r.file_path)
      .map(async (r) => {
        const url = await signThumb(r.file_path as string);
        if (url) thumbed.set(r.id, url);
      })
  );

  const sheetsBy = new Map<string, CastSheet[]>();
  for (const r of sheetRows ?? []) {
    if (!r.entity_id) continue;
    const url = r.file_path ? signed.get(r.file_path) : r.external_url;
    if (!url) continue;
    const list = sheetsBy.get(r.entity_id) ?? [];
    list.push({ id: r.id, url, thumbUrl: thumbed.get(r.id) ?? null });
    sheetsBy.set(r.entity_id, list);
  }

  const references: CastReference[] = rows.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    kind: refKind(r.kind),
    name: r.name,
    slug: r.slug,
    description: r.description,
    notes: r.notes,
    prompt: r.prompt,
    handles: handlesBy.get(r.id) ?? [],
    sheets: sheetsBy.get(r.id) ?? [],
  }));

  const uses: CastUse[] = (useRows ?? []).map((u) => ({
    shot_id: u.shot_id,
    entity_id: u.entity_id,
  }));

  return { references, shots, uses };
}
