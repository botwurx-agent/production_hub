"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assetStorage } from "@/lib/asset-storage";
import { fetchMediaFromUrl } from "@/lib/media-import";
import { requireStudioContext } from "@/lib/studio";
import { ASSET_STATUS } from "@/lib/status";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssetStatus, AssetType, Database } from "@/lib/database.types";

export type ActionState = { error?: string } | null;

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------
export async function saveBrief(projectId: string, content: string) {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("briefs")
    .upsert(
      { studio_id: ctx.studio.id, project_id: projectId, content },
      { onConflict: "project_id" }
    );
  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------------
// Activity / internal notes
// ---------------------------------------------------------------------------
export async function addActivity(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireStudioContext();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Write something first." };
  const supabase = createClient();
  await supabase.from("activity").insert({
    studio_id: ctx.studio.id,
    project_id: projectId,
    author_id: ctx.userId,
    type: "note",
    content,
  });
  revalidatePath(`/projects/${projectId}`);
  return null;
}

async function logActivity(
  supabase: SupabaseClient<Database>,
  studioId: string,
  userId: string,
  projectId: string,
  type: Database["public"]["Enums"]["activity_type"],
  content: string
) {
  await supabase.from("activity").insert({
    studio_id: studioId,
    project_id: projectId,
    author_id: userId,
    type,
    content,
  });
}

// ---------------------------------------------------------------------------
// Assets + versions (manual versioning)
//
// Files are uploaded to Storage from the browser (see upload-file.ts); these
// actions receive only the resulting storage_path plus metadata, so the
// request body stays tiny and large media is never routed through the server.
// ---------------------------------------------------------------------------

function readVersionMeta(formData: FormData) {
  const storagePath = String(formData.get("storage_path") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim() || null;
  const mimeType = String(formData.get("mime_type") ?? "").trim() || null;
  const sizeRaw = String(formData.get("size_bytes") ?? "").trim();
  const sizeBytes = sizeRaw ? Number(sizeRaw) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  return { storagePath, url, mimeType, sizeBytes, notes };
}

async function insertVersion(
  supabase: SupabaseClient<Database>,
  opts: {
    studioId: string;
    userId: string;
    assetId: string;
    storagePath: string | null;
    url: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    notes: string | null;
  }
): Promise<{ versionNumber: number } | { error: string }> {
  const { data: last } = await supabase
    .from("versions")
    .select("version_number")
    .eq("asset_id", opts.assetId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const versionNumber = (last?.version_number ?? 0) + 1;

  const { data: version, error } = await supabase
    .from("versions")
    .insert({
      studio_id: opts.studioId,
      asset_id: opts.assetId,
      version_number: versionNumber,
      storage_path: opts.storagePath,
      url: opts.url,
      mime_type: opts.mimeType,
      size_bytes: opts.sizeBytes,
      notes: opts.notes,
      created_by: opts.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase
    .from("assets")
    .update({ current_version_id: version.id })
    .eq("id", opts.assetId);

  return { versionNumber };
}

export async function createAsset(
  projectId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name the asset." };
  const type = (String(formData.get("type") ?? "other") as AssetType) || "other";
  const meta = readVersionMeta(formData);

  const { data: asset, error } = await supabase
    .from("assets")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      name,
      type,
      status: "draft",
      source: "manual",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (meta.storagePath || meta.url) {
    const res = await insertVersion(supabase, {
      studioId: ctx.studio.id,
      userId: ctx.userId,
      assetId: asset.id,
      ...meta,
    });
    if ("error" in res) return { error: res.error };
  }

  await logActivity(
    supabase,
    ctx.studio.id,
    ctx.userId,
    projectId,
    "upload",
    `Added asset "${name}"`
  );
  revalidatePath(`/projects/${projectId}`);
  return null;
}

export async function addVersion(
  assetId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select("id, name, project_id")
    .eq("id", assetId)
    .single();
  if (!asset) return { error: "Asset not found." };

  const meta = readVersionMeta(formData);
  if (!meta.storagePath && !meta.url) {
    return { error: "Add a file or a link for this version." };
  }

  const res = await insertVersion(supabase, {
    studioId: ctx.studio.id,
    userId: ctx.userId,
    assetId,
    ...meta,
  });
  if ("error" in res) return { error: res.error };

  await logActivity(
    supabase,
    ctx.studio.id,
    ctx.userId,
    asset.project_id,
    "upload",
    `Added v${res.versionNumber} to "${asset.name}"`
  );
  revalidatePath(`/projects/${asset.project_id}`);
  return null;
}

// ---------------------------------------------------------------------------
// Master cut (the assembled deliverable + its revision rounds)
//
// The final cut lives in the SAME Assets -> Versions spine as everything else
// (that's the "nothing gets lost" machinery: version history, timecode review,
// client share, approvals, delivery). It's just the project's asset of type
// 'cut'. The AI pipeline page surfaces it, but a live/hybrid project's final
// cut works identically. We organize the versions + comments; the editing
// happens off-app (export -> upload here -> collect timecoded feedback -> edit
// externally -> upload the next version).
// ---------------------------------------------------------------------------

function safeCutName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "cut";
}

async function ensureMasterCut(
  supabase: SupabaseClient<Database>,
  studioId: string,
  userId: string,
  projectId: string
): Promise<{ id: string } | { error: string }> {
  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("project_id", projectId)
    .eq("type", "cut")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return { id: existing.id };
  const { data, error } = await supabase
    .from("assets")
    .insert({
      studio_id: studioId,
      project_id: projectId,
      name: "Master cut",
      type: "cut",
      status: "draft",
      source: "manual",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create the master cut." };
  return { id: data.id };
}

// Add a new version of the master cut. Accepts a client-uploaded file
// (storagePath) OR a link (share page / direct URL) we fetch + store, OR a bare
// external url stored as a reference. Creates the cut asset lazily on first use.
export async function addMasterCutVersion(
  projectId: string,
  input: {
    storagePath?: string | null;
    mimeType?: string | null;
    url?: string | null;
    link?: string | null;
    notes?: string | null;
  }
): Promise<ActionState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const cut = await ensureMasterCut(supabase, ctx.studio.id, ctx.userId, projectId);
  if ("error" in cut) return { error: cut.error };

  let storagePath = input.storagePath ?? null;
  let mimeType = input.mimeType ?? null;
  let url = input.url ?? null;

  if (input.link && input.link.trim()) {
    const media = await fetchMediaFromUrl(input.link.trim());
    if ("error" in media) return { error: media.error };
    const path = `${ctx.studio.id}/${projectId}/${crypto.randomUUID()}-${safeCutName(media.filename)}`;
    const { error: upErr } = await assetStorage().upload(path, media.bytes, {
      contentType: media.contentType || undefined,
      upsert: false,
    });
    if (upErr) return { error: upErr.message };
    storagePath = path;
    mimeType = media.contentType || null;
    url = null;
  }

  if (!storagePath && !url) return { error: "Add a file or a link for this version." };

  const res = await insertVersion(supabase, {
    studioId: ctx.studio.id,
    userId: ctx.userId,
    assetId: cut.id,
    storagePath,
    url,
    mimeType,
    sizeBytes: null,
    notes: input.notes?.trim() || null,
  });
  if ("error" in res) return { error: res.error };

  // First version moves the cut into the review cycle so it also surfaces on the
  // project Review page. Later versions leave the status alone (a re-review of an
  // approved cut should be a deliberate act, not automatic).
  await supabase
    .from("assets")
    .update({ status: "in_review" })
    .eq("id", cut.id)
    .eq("status", "draft");

  await logActivity(
    supabase,
    ctx.studio.id,
    ctx.userId,
    projectId,
    "upload",
    `Added master cut v${res.versionNumber}`
  );
  revalidatePath(`/projects/${projectId}/pipeline`);
  revalidatePath(`/projects/${projectId}`);
  return null;
}

export async function updateAssetStatus(assetId: string, status: AssetStatus) {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: asset } = await supabase
    .from("assets")
    .select("name, project_id")
    .eq("id", assetId)
    .single();
  await supabase.from("assets").update({ status }).eq("id", assetId);
  if (asset) {
    await logActivity(
      supabase,
      ctx.studio.id,
      ctx.userId,
      asset.project_id,
      "status_change",
      `Set "${asset.name}" to ${ASSET_STATUS[status].label}`
    );
    revalidatePath(`/projects/${asset.project_id}`);
  }
}
