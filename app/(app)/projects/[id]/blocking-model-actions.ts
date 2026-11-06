"use server";

// "Model from a photo" in shot blocking: photos of a real object sent to the
// person's own Higgsfield account (generate_3d over its MCP connection) and
// brought back as a GLB that stands in the scene.
//
// THREE CALLS, the Make it real shape: a quote (balance and price, spends
// nothing), a start (imports the photos and submits ONE job, the only call
// that spends), and a check the browser repeats until the model is finished,
// which copies it into the project's scene folder so it outlives Higgsfield's
// links. Credits are the presser's own plan; writing needs edit rights.
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { openHiggsfield, callTool as call } from "@/lib/higgsfield-session";
import { findId } from "@/lib/higgsfield-result";
import { assetStorage } from "@/lib/asset-storage";
import { sceneFolder } from "@/lib/previz/scene-files";
import { finalizeUpload } from "@/lib/upload-ticket";
import { isFetchableUrl, safeFetch } from "@/lib/unfurl";
import { reportError } from "@/lib/log";
import { MAX_GLB_BYTES, PHOTO_ROLE, isGlb, photoModel, photoParams, readModelJob, type PhotoModelId } from "@/lib/blocking/photo-model";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function editableProject(projectId: string): Promise<{ project: { id: string; studio_id: string }; userId: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id, studio_id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "You do not have access to this project." };
  const { data: canEdit } = await supabase.rpc("can_edit_project", { p_project_id: projectId });
  if (!canEdit) return { error: "You have review access to this project, so you cannot add models to it." };
  return { project, userId: ctx.userId };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The balance and what each model costs for this many photos. Spends nothing. */
export async function quotePhotoModel(
  projectId: string,
  photos: number,
): Promise<{ credits: number | null; plan: string | null; costs: Partial<Record<PhotoModelId, number>> } | { error: string; notConnected?: true }> {
  const access = await editableProject(projectId);
  if ("error" in access) return access;
  const open = await openHiggsfield(access.userId);
  if ("error" in open) return open;
  const { mcp } = open;
  try {
    const bal = await call(mcp, "balance", {});
    const b = "error" in bal ? null : (bal.data as { credits?: unknown; subscription_plan_type?: unknown } | null);
    const costs: Partial<Record<PhotoModelId, number>> = {};
    for (const id of ["tripo", "meshy"] as PhotoModelId[]) {
      const params = photoParams(id, photos);
      if (!params) continue;
      const price = await call(mcp, "generate_3d", { params: { ...params, get_cost: true } });
      const c = "error" in price ? null : num((price.data as { cost?: { credits?: unknown } } | null)?.cost?.credits);
      if (c != null) costs[id] = c;
    }
    return {
      credits: num(b?.credits),
      plan: typeof b?.subscription_plan_type === "string" ? b.subscription_plan_type : null,
      costs,
    };
  } catch (e) {
    reportError("quotePhotoModel", e);
    return { error: "Could not reach Higgsfield. Try again in a moment." };
  } finally {
    await mcp.close();
  }
}

/**
 * Imports the photos into Higgsfield and submits ONE model. This is the call
 * that spends credits. The photo paths came back from the browser, which
 * uploaded them straight to Storage, so each is re-checked as a finished
 * upload in this project's scene folder before anything is sent.
 */
export async function startPhotoModel(
  projectId: string,
  input: { paths: string[]; modelId: string },
): Promise<{ jobId: string } | { error: string; notConnected?: true }> {
  const access = await editableProject(projectId);
  if ("error" in access) return access;
  const model = photoModel(input.modelId);
  if (!model) return { error: "Pick a model." };
  const paths = Array.isArray(input.paths) ? input.paths.filter((p) => typeof p === "string").slice(0, 4) : [];
  if (!paths.length) return { error: "Add a photo of the object first." };
  const params = photoParams(model.id, paths.length);
  if (!params) return { error: `${model.name} takes up to ${model.maxPhotos} photo${model.maxPhotos === 1 ? "" : "s"}.` };
  for (const p of paths) {
    const ok = await finalizeUpload({ kind: "scene_file", projectId }, p);
    if ("error" in ok) return { error: "One of the photos is not one of this project's files." };
  }

  const store = assetStorage();
  const signed: string[] = [];
  for (const p of paths) {
    const { data } = await store.createSignedUrl(p, 3600);
    if (!data?.signedUrl) return { error: "A photo could not be read back from storage. Try again." };
    signed.push(data.signedUrl);
  }

  const open = await openHiggsfield(access.userId);
  if ("error" in open) return open;
  const { mcp } = open;
  try {
    const medias: { value: string; role: string }[] = [];
    for (const url of signed) {
      const imported = await call(mcp, "media_import_url", { url, type: "image" });
      if ("error" in imported) return { error: `Higgsfield could not take a photo: ${imported.error}` };
      const mediaId = findId(imported.data, ["media_id", "id"]);
      if (!mediaId) {
        reportError("startPhotoModel import", new Error(imported.text.slice(0, 500)));
        return { error: "Higgsfield took a photo but did not say where it put it. Nothing was generated." };
      }
      medias.push({ value: mediaId, role: PHOTO_ROLE });
    }
    let submitted: Awaited<ReturnType<typeof call>>;
    try {
      submitted = await call(mcp, "generate_3d", {
        params: { ...params, medias, use_unlim: false },
        context: "A prop for a 3D shot blocking scene on a commercial production, made from a photo of the real object.",
      });
    } catch {
      // The request may have reached them. Never resubmit blind.
      return { error: "The connection dropped while sending. It may still be generating: check your Higgsfield history before trying again." };
    }
    if ("error" in submitted) return { error: submitted.error };
    const jobId = findId(submitted.data, ["job_id", "jobId", "id"]);
    if (!jobId) {
      reportError("startPhotoModel generate", new Error(submitted.text.slice(0, 500)));
      return { error: "Higgsfield accepted the request but did not name the job. Check your Higgsfield history before trying again." };
    }
    return { jobId };
  } catch (e) {
    reportError("startPhotoModel", e);
    return { error: "Could not reach Higgsfield. Nothing was generated." };
  } finally {
    await mcp.close();
  }
}

/**
 * Where a model stands. When it is finished the GLB is copied into this
 * project's scene folder, keyed on the job so a repeat check overwrites the
 * same file, and its path is handed back for the scene to keep.
 */
export async function checkPhotoModel(
  projectId: string,
  jobId: string,
): Promise<{ state: "pending" } | { state: "done"; path: string } | { state: "failed"; error: string } | { error: string }> {
  if (!UUID.test(jobId)) return { error: "That is not a Higgsfield job." };
  const access = await editableProject(projectId);
  if ("error" in access) return access;
  const { project } = access;
  const path = `${project.studio_id}/${sceneFolder(project.id)}/model_${jobId}.glb`;
  const store = assetStorage();

  // Already copied by an earlier check (another browser, or a reload).
  const { data: existing } = await store.list(`${project.studio_id}/${sceneFolder(project.id)}`, { search: `model_${jobId}.glb` });
  if (existing?.some((f) => f.name === `model_${jobId}.glb`)) return { state: "done", path };

  const open = await openHiggsfield(access.userId);
  if ("error" in open) return open;
  const { mcp } = open;
  let url: string;
  try {
    const waited = await call(mcp, "jobs_wait", { jobs: [{ index: 0, job_id: jobId }], timeout_seconds: 10 });
    if ("error" in waited) return { error: waited.error };
    const job = readModelJob(waited.data);
    if (job.state === "pending") return { state: "pending" };
    if (job.state === "failed") return { state: "failed", error: `Higgsfield could not make this one: ${job.reason}` };
    url = job.url;
    if (!/\.glb/i.test(url)) reportError("checkPhotoModel url", new Error(waited.text.slice(0, 800)));
  } catch (e) {
    reportError("checkPhotoModel", e);
    return { error: "Could not reach Higgsfield to check on the model." };
  } finally {
    await mcp.close();
  }

  const target = isFetchableUrl(url);
  const res = target ? await safeFetch(target) : null;
  if (!res || !res.ok) return { error: "The model is ready on Higgsfield but could not be fetched. Find it in your Higgsfield history." };
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_GLB_BYTES) return { error: "The model is ready but too big to bring in (over 150MB)." };
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_GLB_BYTES) return { error: "The model is ready but too big to bring in (over 150MB)." };
  if (!isGlb(bytes)) {
    reportError("checkPhotoModel not glb", new Error(`${url.slice(0, 200)} ${res.headers.get("content-type")}`));
    return { error: "Higgsfield finished, but what came back is not a 3D model file. Find it in your Higgsfield history." };
  }
  const { error } = await store.upload(path, bytes, { contentType: "model/gltf-binary", upsert: true });
  if (error) {
    reportError("checkPhotoModel store", error);
    return { error: "The model is ready on Higgsfield but could not be stored here. Find it in your Higgsfield history." };
  }
  return { state: "done", path };
}
