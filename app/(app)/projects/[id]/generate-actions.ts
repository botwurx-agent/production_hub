"use server";

// Generating a candidate on a shot, on the person's OWN Higgsfield plan over
// its MCP connection. The pipeline map (and later the stage panels) open the
// window; these are its four calls.
//
// THE ORDER IS THE DESIGN. A generation takes minutes, longer than a Server
// Action should hold a request, and the window promises that closing it loses
// nothing. So:
//   1. quote: the balance and each model's price. Spends nothing.
//   2. start: the row is written FIRST (status "generating"), then the inputs
//      are handed to Higgsfield and ONE job is submitted, which is the only
//      call that spends credits, and the job id is written onto the row. The
//      row is what makes the take findable after the window is gone.
//   3. check: asks Higgsfield once (up to ten seconds) and, when the job is
//      done, copies the result into the project and turns the row into an
//      ordinary candidate. Called by the window while it is open, and by the
//      pipeline page for any row still generating, so it finishes either way.
//   4. dismiss: clears a failed row off the shot.
//
// Credits are the presser's own: the connection is looked up by user, so a
// colleague's press spends the colleague's plan. Writing needs edit rights.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { openHiggsfield, callTool } from "@/lib/higgsfield-session";
import { findId, findSeed, readCost, readJob } from "@/lib/higgsfield-result";
import {
  cleanChoice,
  genModel,
  genParams,
  inputWord,
  mediaRole,
  type GenChoice,
  type GenInputSource,
  type GenModel,
} from "@/lib/higgsfield-generate";
import { assetStorage } from "@/lib/asset-storage";
import { aspectRatio, fetchMediaFromUrl, resolutionLabel } from "@/lib/media-import";
import { reportError } from "@/lib/log";
import type { Json } from "@/lib/database.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Higgsfield refuses an import over this (media_import_url's own limit). */
const IMPORT_LIMIT = 50 * 1024 * 1024;

type Access = { userId: string; studioId: string };

async function editable(projectId: string, shotId?: string): Promise<Access | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id, studio_id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "You do not have access to this project." };
  if (shotId) {
    const { data: shot } = await supabase.from("ai_shots").select("id").eq("id", shotId).eq("project_id", projectId).maybeSingle();
    if (!shot) return { error: "That shot is not part of this project." };
  }
  const { data: canEdit } = await supabase.rpc("can_edit_project", { p_project_id: projectId });
  if (!canEdit) return { error: "You have review access to this project, so you cannot generate for it." };
  return { userId: ctx.userId, studioId: project.studio_id };
}

function toolFor(model: GenModel) {
  return model.kind === "video" ? "generate_video" : "generate_image";
}

/**
 * The balance and the price of each choice, in one Higgsfield session.
 * Spends nothing. A price is for the settings, without the inputs, since the
 * inputs have not been handed over yet; the start re-checks the price WITH
 * them before anything is spent.
 */
export async function quoteGenerations(
  projectId: string,
  choices: unknown[],
): Promise<{ credits: number | null; costs: (number | null)[] } | { error: string; notConnected?: true }> {
  const access = await editable(projectId);
  if ("error" in access) return access;
  const clean = (Array.isArray(choices) ? choices.slice(0, 6) : []).map(cleanChoice);
  const open = await openHiggsfield(access.userId);
  if ("error" in open) return open;
  const { mcp } = open;
  try {
    const bal = await callTool(mcp, "balance", {});
    const credits = "error" in bal ? null : num((bal.data as { credits?: unknown } | null)?.credits);
    const costs = await Promise.all(
      clean.map(async (c) => {
        const model = c && genModel(c.modelId);
        if (!c || !model) return null;
        const r = await callTool(mcp, toolFor(model), { params: { ...genParams(c), prompt: c.prompt || "price check", get_cost: true } });
        return "error" in r ? null : readCost(r.data);
      }),
    );
    return { credits, costs };
  } catch (e) {
    reportError("quoteGenerations", e);
    return { error: "Could not reach Higgsfield for a price." };
  } finally {
    await mcp.close();
  }
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

type InputRow = {
  id: string;
  shot_id: string | null;
  entity_id: string | null;
  kind: string;
  status: string;
  file_path: string | null;
  external_url: string | null;
  params: Json | null;
};

/** The Higgsfield job id an input was made as, when it came from Higgsfield. */
function hfJobId(row: InputRow): string | null {
  const id = (row.params as { higgsfield_id?: unknown } | null)?.higgsfield_id;
  return typeof id === "string" && UUID.test(id) ? id : null;
}

/**
 * Submits ONE generation. This is the call that spends credits. Returns the
 * new row's id, which the window and the page both check on.
 *
 * `expectedCost` is the price the window showed. The price is checked again
 * here with the inputs attached, and a generation that would cost MORE than
 * the person agreed to is not submitted: they are shown the new price instead.
 */
export async function startGeneration(
  projectId: string,
  input: { shotId: string; choice: unknown; expectedCost: number | null },
): Promise<{ genId: string } | { error: string; newCost?: number; notConnected?: true }> {
  const access = await editable(projectId, input.shotId);
  if ("error" in access) return access;
  const choice = cleanChoice(input.choice);
  const model = choice && genModel(choice.modelId);
  if (!choice || !model) return { error: "Pick a model." };
  if (!choice.prompt) return { error: "Write a prompt first." };

  const supabase = createClient();

  // The inputs, read under RLS. Each must be a picture or clip on THIS shot,
  // or an element's sheet image, and its stated source must match what it
  // really is: the browser's word for it is not taken.
  const ids = choice.inputs.map((i) => i.genId);
  const { data: inputRows } = ids.length
    ? await supabase
        .from("ai_generations")
        .select("id, shot_id, entity_id, kind, status, file_path, external_url, params")
        .in("id", ids)
    : { data: [] as InputRow[] };
  const byId = new Map((inputRows ?? []).map((r) => [r.id, r as InputRow]));
  const used: { row: InputRow; role: string; word: string; source: GenInputSource; refRole: "start" | "end" | "ref" }[] = [];
  for (const i of choice.inputs) {
    const row = byId.get(i.genId);
    if (!row) return { error: "One of the inputs is no longer on this shot. Close the window and open it again." };
    const onShot = row.shot_id === input.shotId;
    if (!onShot && !row.entity_id) return { error: "One of the inputs belongs to another shot." };
    if (row.status === "generating" || row.status === "failed") return { error: "One of the inputs has not finished generating yet." };
    const source: GenInputSource = row.kind === "video" ? "video" : row.entity_id && !onShot ? "element" : "frame";
    if (row.kind !== "image" && row.kind !== "video") return { error: "Only pictures and video clips can be fed in." };
    const role = mediaRole(model, { role: i.role, source });
    if (!role) continue; // a model that does not take it simply does not get it
    used.push({ row, role, word: inputWord({ role: i.role, source }), source, refRole: i.role });
  }

  const open = await openHiggsfield(access.userId);
  if ("error" in open) return open;
  const { mcp } = open;

  // The row comes first, so a take that is paid for always has a home.
  const genId = crypto.randomUUID();
  const startIn = used.find((u) => u.refRole === "start");
  const endIn = used.find((u) => u.refRole === "end");
  const record = {
    higgsfield_model: model.id,
    options: choice.options,
    requested: { aspect: choice.aspect, duration: choice.duration },
    started_at: new Date().toISOString(),
  };

  try {
    // Hand each input over. Anything that came from Higgsfield already has a
    // job id there and goes by that, with nothing uploaded; the rest are read
    // from storage on a one-hour link and imported.
    const medias: { value: string; role: string }[] = [];
    const store = assetStorage();
    for (const u of used) {
      const job = hfJobId(u.row);
      if (job) {
        medias.push({ value: job, role: u.role });
        continue;
      }
      let url = u.row.external_url && /^https:\/\//i.test(u.row.external_url) && !u.row.file_path ? u.row.external_url : null;
      if (u.row.file_path) {
        const size = await storedSize(u.row.file_path);
        if (size != null && size > IMPORT_LIMIT) {
          return { error: `The ${u.word.toLowerCase()} is ${Math.round(size / 1048576)}MB, and Higgsfield takes 50MB at most. Use a smaller version of it.` };
        }
        const { data: signed } = await store.createSignedUrl(u.row.file_path, 3600);
        url = signed?.signedUrl ?? null;
      }
      if (!url) return { error: `The ${u.word.toLowerCase()} could not be read back from storage.` };
      const imported = await callTool(mcp, "media_import_url", { url, type: u.source === "video" ? "video" : "image" });
      if ("error" in imported) return { error: `Higgsfield could not take the ${u.word.toLowerCase()}: ${imported.error}` };
      const mediaId = findId(imported.data, ["media_id", "id"]);
      if (!mediaId) {
        reportError("startGeneration import", new Error(imported.text.slice(0, 500)));
        return { error: `Higgsfield took the ${u.word.toLowerCase()} but did not say where it put it. Nothing was generated.` };
      }
      medias.push({ value: mediaId, role: u.role });
    }

    const params: Record<string, unknown> = { ...genParams(choice), prompt: choice.prompt, use_unlim: false };
    if (medias.length) params.medias = medias;

    // The price again, now with the inputs attached. Spends nothing.
    const priced = await callTool(mcp, toolFor(model), { params: { ...params, get_cost: true } });
    const cost = "error" in priced ? null : readCost(priced.data);
    if (cost != null && input.expectedCost != null && cost > input.expectedCost + 0.001) {
      return { error: `With these inputs the price is ${cost} credits, not ${input.expectedCost}. Nothing was spent.`, newCost: cost };
    }

    const { error: insErr } = await supabase.from("ai_generations").insert({
      id: genId,
      studio_id: access.studioId,
      shot_id: input.shotId,
      stage: model.kind,
      kind: model.kind,
      status: "generating",
      platform: "Higgsfield",
      model: model.name,
      prompt: choice.prompt,
      aspect: choice.aspect,
      duration_sec: choice.duration,
      parent_start_id: startIn?.row.id ?? null,
      parent_end_id: endIn?.row.id ?? null,
      params: record as unknown as Json,
      generated_by: access.userId,
    });
    if (insErr) return { error: `Could not make room for the take: ${insErr.message}. Nothing was spent.` };
    const refRows = used
      .filter((u) => u.refRole === "ref")
      .map((u, position) => ({
        studio_id: access.studioId,
        generation_id: genId,
        ref_generation_id: u.row.id,
        role: u.source === "video" ? "motion" : u.source === "element" ? "character" : "ref",
        position,
      }));
    if (refRows.length) await supabase.from("ai_generation_refs").insert(refRows);

    let submitted: Awaited<ReturnType<typeof callTool>>;
    try {
      submitted = await callTool(mcp, toolFor(model), {
        params,
        context: "Generating a candidate for a shot in a commercial production's AI pipeline.",
      });
    } catch {
      // The request may have reached them. Never resubmit blind: a second
      // press could pay twice for one take.
      await markFailed(genId, record, "The connection dropped while sending. It may still be generating: check your Higgsfield history before trying again.");
      return { error: "The connection dropped while sending. It may still be generating: check your Higgsfield history before trying again." };
    }
    if ("error" in submitted) {
      await supabase.from("ai_generations").delete().eq("id", genId);
      return { error: submitted.error };
    }
    const jobId = findId(submitted.data, ["job_id", "jobId", "id"]);
    if (!jobId) {
      reportError("startGeneration generate", new Error(submitted.text.slice(0, 500)));
      await markFailed(genId, record, "Higgsfield accepted the request but did not name the job. Check your Higgsfield history.");
      return { error: "Higgsfield accepted the request but did not name the job. Check your Higgsfield history before trying again." };
    }
    await supabase
      .from("ai_generations")
      .update({ params: { ...record, higgsfield_id: jobId } as unknown as Json })
      .eq("id", genId);
    if (cost != null) await supabase.from("generation_costs").upsert({ studio_id: access.studioId, generation_id: genId, cost }, { onConflict: "generation_id" });
    revalidatePath(`/projects/${projectId}/pipeline`);
    return { genId };
  } catch (e) {
    reportError("startGeneration", e);
    return { error: "Could not reach Higgsfield. Nothing was generated." };
  } finally {
    await mcp.close();
  }
}

async function markFailed(genId: string, record: Record<string, unknown>, reason: string) {
  const supabase = createClient();
  await supabase
    .from("ai_generations")
    .update({ status: "failed", params: { ...record, error: reason } as unknown as Json })
    .eq("id", genId);
}

/** A stored object's real size, or null when Storage will not say. */
async function storedSize(path: string): Promise<number | null> {
  const slash = path.lastIndexOf("/");
  const { data } = await assetStorage().list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 5 });
  const hit = (data ?? []).find((o) => o.name === path.slice(slash + 1));
  const n = Number((hit?.metadata as { size?: unknown } | undefined)?.size);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Where a generating row stands. When Higgsfield has finished, the result is
 * copied into the project and the row becomes an ordinary candidate, with
 * its resolution and length measured from the file. Safe to call again and
 * from two places at once: a row that is no longer generating is answered
 * from the row, and the copy is keyed on the job.
 */
export async function checkGeneration(
  projectId: string,
  genId: string,
): Promise<{ state: "pending" } | { state: "done" } | { state: "failed"; error: string } | { error: string }> {
  if (!UUID.test(genId)) return { error: "That is not a generation." };
  const access = await editable(projectId);
  if ("error" in access) return access;
  const supabase = createClient();
  const { data: row } = await supabase
    .from("ai_generations")
    .select("id, shot_id, status, params, kind, generated_by")
    .eq("id", genId)
    .maybeSingle();
  if (!row) return { error: "That generation is no longer on the shot." };
  const params = (row.params ?? {}) as Record<string, unknown>;
  if (row.status === "failed") return { state: "failed", error: String(params.error ?? "Higgsfield could not make this one.") };
  if (row.status !== "generating") return { state: "done" };
  const jobId = typeof params.higgsfield_id === "string" ? params.higgsfield_id : null;
  if (!jobId) return { state: "pending" };

  // The job lives on the account of whoever pressed Generate, so that is whose
  // connection asks about it. A colleague opening the page cannot check it.
  if (row.generated_by && row.generated_by !== access.userId) return { state: "pending" };

  const open = await openHiggsfield(access.userId);
  if ("error" in open) return open;
  const { mcp } = open;
  let url: string;
  let seed: string | null = null;
  try {
    const waited = await callTool(mcp, "jobs_wait", { jobs: [{ index: 0, job_id: jobId }], timeout_seconds: 10 });
    if ("error" in waited) return { error: waited.error };
    const job = readJob(waited.data);
    if (job.state === "pending") return { state: "pending" };
    if (job.state === "failed") {
      const reason = `Higgsfield could not make this one: ${job.reason}`;
      await markFailed(genId, params, reason);
      revalidatePath(`/projects/${projectId}/pipeline`);
      return { state: "failed", error: reason };
    }
    url = job.url;
    seed = findSeed(waited.data);
  } catch (e) {
    reportError("checkGeneration", e);
    return { error: "Could not reach Higgsfield to check on it." };
  } finally {
    await mcp.close();
  }

  const got = await fetchMediaFromUrl(url);
  if ("error" in got) {
    return { error: "It is ready on Higgsfield but could not be copied here yet. It will be tried again." };
  }
  const ext = got.filename.match(/\.(\w{2,5})$/)?.[1]?.toLowerCase() ?? (got.kind === "video" ? "mp4" : "png");
  const path = `${access.studioId}/pipeline/${projectId}/hf_${jobId}.${ext}`;
  const { error: upErr } = await assetStorage().upload(path, got.bytes, { contentType: got.contentType || undefined, upsert: true });
  if (upErr) {
    reportError("checkGeneration store", upErr);
    return { error: "It is ready on Higgsfield but could not be stored here yet. It will be tried again." };
  }
  const { error } = await supabase
    .from("ai_generations")
    .update({
      status: "candidate",
      kind: got.kind,
      file_path: path,
      external_url: url,
      seed,
      resolution: resolutionLabel(got.width, got.height, got.kind),
      aspect: aspectRatio(got.width, got.height) ?? undefined,
      duration_sec: got.durationSec ?? undefined,
      params: { ...params, finished_at: new Date().toISOString() } as unknown as Json,
    })
    .eq("id", genId)
    .eq("status", "generating");
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}/pipeline`);
  revalidatePath(`/projects/${projectId}`);
  return { state: "done" };
}

/** Clears a failed generation off the shot. Nothing was made, so nothing is lost. */
export async function dismissGeneration(projectId: string, genId: string): Promise<{ ok: true } | { error: string }> {
  if (!UUID.test(genId)) return { error: "That is not a generation." };
  const access = await editable(projectId);
  if ("error" in access) return access;
  const supabase = createClient();
  const { error } = await supabase.from("ai_generations").delete().eq("id", genId).eq("status", "failed");
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}/pipeline`);
  return { ok: true };
}

