"use server";

// "Make it real": a Scene builder frame sent to the person's own Higgsfield
// account over its MCP connection and brought back as a photoreal still.
//
// THREE CALLS, NOT ONE, because a generation takes longer than a Server Action
// should hold a request open: a quote (balance and price, spends nothing), a
// start (imports the frame and submits ONE job, which is the only call that
// spends credits), and a check the browser repeats until the job is finished,
// which stores the result in the project's scene folder.
//
// Credits are the person's own: the connection is theirs (email_accounts by
// user_id), so a colleague's press spends the colleague's plan, never the
// studio owner's. Writing the result needs edit rights on the project, the same
// rule as any other scene file.
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { getHiggsfieldToken, HiggsfieldMcp } from "@/lib/higgsfield-mcp";
import {
  findId, hfAspect, readJob, realModel, resultData, resultText, type ToolResult,
} from "@/lib/higgsfield-result";
import { assetStorage } from "@/lib/asset-storage";
import { pathWithinScope } from "@/lib/upload-limits";
import { sceneFolder } from "@/lib/previz/scene-files";
import { fetchMediaFromUrl } from "@/lib/media-import";
import { reportError } from "@/lib/log";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROMPT = 3000;

type Project = { id: string; studio_id: string };

async function editableProject(projectId: string): Promise<{ project: Project; userId: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id, studio_id").eq("id", projectId).maybeSingle();
  if (!project) return { error: "You do not have access to this project." };
  const { data: canEdit } = await supabase.rpc("can_edit_project", { p_project_id: projectId });
  if (!canEdit) return { error: "You have review access to this project, so you cannot make stills for it." };
  return { project, userId: ctx.userId };
}

/** An open MCP session on the caller's own Higgsfield account. */
async function openHiggsfield(userId: string): Promise<{ mcp: HiggsfieldMcp } | { error: string; notConnected?: true }> {
  const supabase = createClient();
  const { data: account } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry, external_ref")
    .eq("provider", "higgsfield")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!account) return { error: "Connect Higgsfield in Settings, Connections first.", notConnected: true };
  let token: string;
  try {
    token = await getHiggsfieldToken(supabase, account);
  } catch {
    return { error: "Higgsfield needs reconnecting in Settings, Connections.", notConnected: true };
  }
  const mcp = new HiggsfieldMcp(token);
  const init = await mcp.open();
  if (!init.message?.result) {
    return init.status === 401
      ? { error: "Higgsfield needs reconnecting in Settings, Connections.", notConnected: true }
      : { error: `Higgsfield did not answer (HTTP ${init.status}). Try again in a moment.` };
  }
  return { mcp };
}

/** One tool call. A tool that reports a failure comes back as its own sentence. */
async function call(mcp: HiggsfieldMcp, name: string, args: unknown): Promise<{ data: unknown; text: string } | { error: string }> {
  const r = await mcp.request("tools/call", { name, arguments: args });
  if (!r.message) return { error: `Higgsfield sent back something unreadable (HTTP ${r.status}).` };
  if (r.message.error) return { error: r.message.error.message || `Higgsfield refused ${name}.` };
  const result = r.message.result as ToolResult | undefined;
  const text = resultText(result);
  if (result?.isError) return { error: text.slice(0, 400) || `Higgsfield refused ${name}.` };
  return { data: resultData(result), text };
}

function genParams(model: NonNullable<ReturnType<typeof realModel>>, aspectId: string) {
  return { model: model.id, aspect_ratio: hfAspect(aspectId), count: 1, ...model.params };
}

/** The balance and what one still costs. Spends nothing. */
export async function realStillQuote(
  projectId: string,
  modelId: string,
  aspectId: string,
): Promise<{ credits: number | null; cost: number | null; plan: string | null } | { error: string; notConnected?: true }> {
  const access = await editableProject(projectId);
  if ("error" in access) return access;
  const model = realModel(modelId);
  if (!model) return { error: "Pick a model." };
  const open = await openHiggsfield(access.userId);
  if ("error" in open) return open;
  const { mcp } = open;
  try {
    const bal = await call(mcp, "balance", {});
    const price = await call(mcp, "generate_image", { params: { ...genParams(model, aspectId), get_cost: true } });
    const b = "error" in bal ? null : (bal.data as { credits?: unknown; subscription_plan_type?: unknown } | null);
    const p = "error" in price ? null : (price.data as { cost?: { credits?: unknown } } | null);
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      credits: num(b?.credits),
      plan: typeof b?.subscription_plan_type === "string" ? b.subscription_plan_type : null,
      cost: num(p?.cost?.credits),
    };
  } catch (e) {
    reportError("realStillQuote", e);
    return { error: "Could not reach Higgsfield. Try again in a moment." };
  } finally {
    await mcp.close();
  }
}

/**
 * Imports a stored frame into Higgsfield and submits ONE generation. This is
 * the call that spends credits. The frame path came back from the browser, so
 * it is accepted only as a file directly in this project's scene folder.
 */
export async function startRealStill(
  projectId: string,
  input: { path: string; prompt: string; modelId: string; aspectId: string },
): Promise<{ jobId: string } | { error: string; notConnected?: true }> {
  const access = await editableProject(projectId);
  if ("error" in access) return access;
  const { project } = access;
  if (typeof input.path !== "string" || !pathWithinScope(input.path, project.studio_id, sceneFolder(project.id))) {
    return { error: "That frame is not one of this project's scene files." };
  }
  const model = realModel(input.modelId);
  if (!model) return { error: "Pick a model." };
  const prompt = (typeof input.prompt === "string" ? input.prompt : "").replace(/\s+/g, " ").trim().slice(0, MAX_PROMPT);
  if (!prompt) return { error: "Describe the look first." };

  const { data: signed } = await assetStorage().createSignedUrl(input.path, 3600);
  if (!signed?.signedUrl) return { error: "The frame could not be read back from storage. Try again." };

  const open = await openHiggsfield(access.userId);
  if ("error" in open) return open;
  const { mcp } = open;
  try {
    const imported = await call(mcp, "media_import_url", { url: signed.signedUrl, type: "image" });
    if ("error" in imported) return { error: `Higgsfield could not take the frame: ${imported.error}` };
    const mediaId = findId(imported.data, ["media_id", "id"]);
    if (!mediaId) {
      reportError("startRealStill import", new Error(imported.text.slice(0, 500)));
      return { error: "Higgsfield took the frame but did not say where it put it. Nothing was generated." };
    }

    let submitted: Awaited<ReturnType<typeof call>>;
    try {
      submitted = await call(mcp, "generate_image", {
        params: {
          ...genParams(model, input.aspectId),
          prompt,
          medias: [{ value: mediaId, role: "image_references" }],
          use_unlim: false,
        },
        context: "Turning a 3D previz frame from a commercial shoot into a photoreal still for its shot list.",
      });
    } catch {
      // The request may have reached them. Never resubmit blind: a second
      // press could pay twice for one still.
      return { error: "The connection dropped while sending. It may still be generating: check your Higgsfield history before trying again." };
    }
    if ("error" in submitted) return { error: submitted.error };
    const jobId = findId(submitted.data, ["job_id", "jobId", "id"]);
    if (!jobId) {
      reportError("startRealStill generate", new Error(submitted.text.slice(0, 500)));
      return { error: "Higgsfield accepted the request but did not name the job. Check your Higgsfield history before trying again." };
    }
    return { jobId };
  } catch (e) {
    reportError("startRealStill", e);
    return { error: "Could not reach Higgsfield. Nothing was generated." };
  } finally {
    await mcp.close();
  }
}

/**
 * Where a submitted still stands. When it is finished, the image is copied
 * into this project's scene folder (so it outlives Higgsfield's own links) and
 * handed back with a link to show it. Safe to call again: the copy is keyed on
 * the job, so a repeat overwrites the same file.
 */
export async function checkRealStill(
  projectId: string,
  jobId: string,
): Promise<{ state: "pending" } | { state: "done"; path: string; url: string } | { state: "failed"; error: string } | { error: string }> {
  if (!UUID.test(jobId)) return { error: "That is not a Higgsfield job." };
  const access = await editableProject(projectId);
  if ("error" in access) return access;
  const { project } = access;
  const open = await openHiggsfield(access.userId);
  if ("error" in open) return open;
  const { mcp } = open;
  let url: string;
  try {
    const waited = await call(mcp, "jobs_wait", { jobs: [{ index: 0, job_id: jobId }], timeout_seconds: 10 });
    if ("error" in waited) return { error: waited.error };
    const job = readJob(waited.data);
    if (job.state === "pending") return { state: "pending" };
    if (job.state === "failed") return { state: "failed", error: `Higgsfield could not make this one: ${job.reason}` };
    url = job.url;
  } catch (e) {
    reportError("checkRealStill", e);
    return { error: "Could not reach Higgsfield to check on the still." };
  } finally {
    await mcp.close();
  }

  const got = await fetchMediaFromUrl(url);
  if ("error" in got || got.kind !== "image") {
    return { error: "The still is ready on Higgsfield but could not be copied here. Find it in your Higgsfield history." };
  }
  const ext = /png/i.test(got.contentType) ? "png" : /webp/i.test(got.contentType) ? "webp" : "jpg";
  const path = `${project.studio_id}/${sceneFolder(project.id)}/real_${jobId}.${ext}`;
  const store = assetStorage();
  const { error } = await store.upload(path, got.bytes, { contentType: got.contentType, upsert: true });
  if (error) {
    reportError("checkRealStill store", error);
    return { error: "The still is ready on Higgsfield but could not be stored here. Find it in your Higgsfield history." };
  }
  const { data: signed } = await store.createSignedUrl(path, 3600);
  return { state: "done", path, url: signed?.signedUrl ?? url };
}
