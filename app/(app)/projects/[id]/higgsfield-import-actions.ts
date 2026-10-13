"use server";

// The AI pipeline's "From Higgsfield" picker: browse the caller's own
// Higgsfield generation history over their MCP connection and bring the
// picked ones onto a shot as candidates. Reading costs nothing; nothing here
// generates. Each import is a copy into the project's storage, so it outlives
// Higgsfield's own links, carrying the model and prompt it was made with.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { assetStorage } from "@/lib/asset-storage";
import { fetchMediaFromUrl, aspectRatio, resolutionLabel } from "@/lib/media-import";
import { openHiggsfield, callTool } from "@/lib/higgsfield-session";
import { cleanPicked, frameInputs, modelLabel, parseGenerationsPage, type HfGeneration } from "@/lib/higgsfield-history";
import { reportError } from "@/lib/log";
import type { Json } from "@/lib/database.types";

const PAGE = 24;
const MAX_IMPORT = 12;

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "clip";
}

/** One page of the caller's Higgsfield generations of one kind, newest first. */
export async function listHiggsfieldGenerations(
  projectId: string,
  input: { kind: "image" | "video"; cursor?: string | null },
): Promise<{ items: HfGeneration[]; nextCursor: string | null } | { error: string; notConnected?: true }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "You do not have access to this project." };
  const open = await openHiggsfield(ctx.userId);
  if ("error" in open) return open;
  const { mcp } = open;
  try {
    const args: Record<string, unknown> = { type: input.kind, size: PAGE };
    // The cursor is the last item's timestamp; Higgsfield sent it as a number.
    if (input.cursor && /^\d+(\.\d+)?$/.test(input.cursor)) args.cursor = Number(input.cursor);
    const res = await callTool(mcp, "show_generations", args);
    if ("error" in res) return { error: res.error };
    const page = parseGenerationsPage(res.data);
    // A filter Higgsfield ignored should not mix stills into the takes.
    return { items: page.items.filter((g) => g.kind === input.kind), nextCursor: page.nextCursor };
  } catch (e) {
    reportError("listHiggsfieldGenerations", e);
    return { error: "Could not reach Higgsfield. Try again in a moment." };
  } finally {
    await mcp.close();
  }
}

/** The Higgsfield ids already on this shot, so the picker can mark them. */
export async function higgsfieldIdsOnShot(projectId: string, shotId: string): Promise<string[]> {
  await requireStudioContext();
  const supabase = createClient();
  const { data: shot } = await supabase.from("ai_shots").select("id").eq("id", shotId).eq("project_id", projectId).maybeSingle();
  if (!shot) return [];
  const { data } = await supabase.from("ai_generations").select("params").eq("shot_id", shotId);
  return (data ?? []).flatMap((r) => {
    const id = (r.params as { higgsfield_id?: unknown } | null)?.higgsfield_id;
    return typeof id === "string" ? [id] : [];
  });
}

/**
 * Copies the picked generations onto a shot as candidates. Each is downloaded
 * once and stored with the project; one that is already on the shot is
 * skipped. A video made from start and end frames that are ALSO on this shot
 * is linked to them, so its lineage reads the same as one made here.
 */
export async function importHiggsfieldGenerations(
  projectId: string,
  input: { shotId: string; stage: "image" | "video"; picked: unknown[] },
): Promise<{ imported: number; skipped: number; failed: { id: string; reason: string }[] } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: shot } = await supabase
    .from("ai_shots")
    .select("id")
    .eq("id", input.shotId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!shot) return { error: "That shot is not part of this project." };
  const { data: canEdit } = await supabase.rpc("can_edit_project", { p_project_id: projectId });
  if (!canEdit) return { error: "You have review access to this project, so you cannot add takes." };

  const picked = (Array.isArray(input.picked) ? input.picked : [])
    .map(cleanPicked)
    .filter((g): g is HfGeneration => g !== null);
  const unique = Array.from(new Map(picked.map((g) => [g.id, g])).values()).slice(0, MAX_IMPORT);
  if (unique.length === 0) return { error: "Pick at least one." };

  // What this shot already holds from Higgsfield, by Higgsfield id.
  const { data: existing } = await supabase.from("ai_generations").select("id, params").eq("shot_id", input.shotId);
  const onShot = new Map<string, string>();
  for (const r of existing ?? []) {
    const hid = (r.params as { higgsfield_id?: unknown } | null)?.higgsfield_id;
    if (typeof hid === "string") onShot.set(hid, r.id);
  }
  const todo = unique.filter((g) => !onShot.has(g.id));
  const skipped = unique.length - todo.length;

  const failed: { id: string; reason: string }[] = [];
  type Row = {
    id: string;
    studio_id: string;
    shot_id: string;
    stage: string;
    kind: string;
    status: string;
    platform: string;
    model: string | null;
    seed: string | null;
    prompt: string | null;
    aspect: string | null;
    resolution: string | null;
    duration_sec: number | null;
    file_path: string;
    external_url: string;
    params: Json;
    parent_start_id: string | null;
    parent_end_id: string | null;
    generated_by: string;
  };
  const rows: Row[] = [];

  // A few at a time: a video can be large, and the request has a minute.
  for (let i = 0; i < todo.length; i += 3) {
    await Promise.all(
      todo.slice(i, i + 3).map(async (g) => {
        const media = await fetchMediaFromUrl(g.url);
        if ("error" in media) {
          failed.push({ id: g.id, reason: media.error });
          return;
        }
        const path = `${ctx.studio.id}/pipeline/${projectId}/${crypto.randomUUID()}-${safeName(media.filename)}`;
        const { error: upErr } = await assetStorage().upload(path, media.bytes, {
          contentType: media.contentType || undefined,
          upsert: false,
        });
        if (upErr) {
          failed.push({ id: g.id, reason: upErr.message });
          return;
        }
        const width = media.width ?? g.width;
        const height = media.height ?? g.height;
        rows.push({
          id: crypto.randomUUID(),
          studio_id: ctx.studio.id,
          shot_id: input.shotId,
          stage: input.stage,
          kind: media.kind,
          status: "candidate",
          platform: "Higgsfield",
          model: modelLabel(g.model),
          seed: g.seed,
          prompt: g.prompt,
          aspect: g.aspect ?? aspectRatio(width, height),
          resolution: resolutionLabel(width, height, media.kind),
          duration_sec: media.durationSec ?? g.durationSec,
          file_path: path,
          external_url: g.url,
          params: { higgsfield_id: g.id, higgsfield_model: g.model, higgsfield_inputs: g.inputs } as unknown as Json,
          parent_start_id: null,
          parent_end_id: null,
          generated_by: ctx.userId,
        });
      }),
    );
  }

  // Lineage: frames already on this shot, or brought in in this same batch.
  const byHf = new Map(onShot);
  for (const r of rows) byHf.set((r.params as { higgsfield_id: string }).higgsfield_id, r.id);
  for (const r of rows) {
    const g = todo.find((x) => x.id === (r.params as { higgsfield_id: string }).higgsfield_id);
    if (!g || g.kind !== "video") continue;
    const f = frameInputs(g);
    r.parent_start_id = (f.start && byHf.get(f.start)) || null;
    r.parent_end_id = (f.end && byHf.get(f.end)) || null;
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("ai_generations").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath(`/projects/${projectId}/pipeline`);
  revalidatePath(`/projects/${projectId}`);
  return { imported: rows.length, skipped, failed };
}
