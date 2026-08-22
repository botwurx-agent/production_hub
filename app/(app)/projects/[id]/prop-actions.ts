"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { assetStorage } from "@/lib/asset-storage";
import { generateReviewToken } from "@/lib/review-links";
import { isFetchableUrl } from "@/lib/unfurl";
import { propStatus } from "@/lib/props";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/attachment-limits";
import { reportError } from "@/lib/log";

export type PropState = { error?: string; id?: string } | null;

export type PropInput = {
  name: string;
  category?: string | null;
  qty?: number | null;
  notes?: string | null;
  source?: string | null;
  contactId?: string | null;
};

function clean(v: string | null | undefined, max = 300): string | null {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
}

function cleanQty(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(9999, Math.round(v)));
}

const rp = (projectId: string) => revalidatePath(`/projects/${projectId}/props`);

/**
 * Confirms the project is reachable before writing against it.
 *
 * The read goes through the RLS client, whose projects policy is exactly
 * `is_studio_member OR can_access_project`, so the read IS the access check.
 * Same move as createAssetUploadUrl and the talent actions: no second
 * permission layer to drift out of step with the first.
 */
async function reachableProject(
  supabase: ReturnType<typeof createClient>,
  projectId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  return Boolean(data);
}

export async function addProp(
  projectId: string,
  input: PropInput
): Promise<PropState> {
  const ctx = await requireStudioContext();
  const name = input.name.trim();
  if (!name) return { error: "Give the prop a name." };

  const supabase = createClient();
  if (!(await reachableProject(supabase, projectId))) {
    return { error: "Project not found." };
  }

  const { data: last } = await supabase
    .from("props")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("props")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      position: ((last as { position: number } | null)?.position ?? -1) + 1,
      name: name.slice(0, 200),
      category: clean(input.category, 60),
      qty: cleanQty(input.qty),
      notes: clean(input.notes, 2000),
      source: clean(input.source, 200),
      contact_id: input.contactId || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add that prop." };

  rp(projectId);
  return { id: data.id };
}

export async function updateProp(
  projectId: string,
  propId: string,
  input: PropInput
): Promise<PropState> {
  await requireStudioContext();
  const name = input.name.trim();
  if (!name) return { error: "Give the prop a name." };

  const supabase = createClient();
  const { error } = await supabase
    .from("props")
    .update({
      name: name.slice(0, 200),
      category: clean(input.category, 60),
      qty: cleanQty(input.qty),
      notes: clean(input.notes, 2000),
      source: clean(input.source, 200),
      contact_id: input.contactId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", propId);
  if (error) return { error: error.message };

  rp(projectId);
  return null;
}

/** Click-to-advance chip, same interaction as a cost's status. */
export async function setPropStatus(
  projectId: string,
  propId: string,
  status: string
): Promise<PropState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("props")
    .update({ status: propStatus(status), updated_at: new Date().toISOString() })
    .eq("id", propId);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function deleteProp(
  projectId: string,
  propId: string
): Promise<PropState> {
  await requireStudioContext();
  const supabase = createClient();

  // Collect the option images before the cascade removes the rows, or the blobs
  // are orphaned in the bucket with nothing left pointing at them.
  const { data: options } = await supabase
    .from("prop_options")
    .select("storage_path")
    .eq("prop_id", propId);

  const { error } = await supabase.from("props").delete().eq("id", propId);
  if (error) return { error: error.message };

  const paths = (options ?? [])
    .map((o) => (o as { storage_path: string | null }).storage_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length) await assetStorage().remove(paths).catch(() => {});

  rp(projectId);
  return null;
}

/** An option from a file the art department photographed or was sent. */
export async function addPropOptionFile(
  projectId: string,
  propId: string,
  formData: FormData
): Promise<PropState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file selected." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `That image is ${formatBytes(file.size)}, over the ${formatBytes(
        MAX_UPLOAD_BYTES
      )} limit for an upload.`,
    };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "option";
  const path = `${ctx.studio.id}/props/${propId}/${generateReviewToken()}_${safeName}`;

  const { error: upErr } = await assetStorage().upload(
    path,
    Buffer.from(await file.arrayBuffer()),
    { contentType: file.type || "application/octet-stream", upsert: false }
  );
  if (upErr) {
    reportError("addPropOptionFile.upload", upErr);
    return { error: "Could not upload that image. Try again." };
  }

  return insertOption(supabase, ctx.studio.id, ctx.userId, projectId, propId, {
    name: clean(String(formData.get("name") ?? ""), 200),
    storage_path: path,
    mime_type: file.type || null,
    source: clean(String(formData.get("source") ?? ""), 200),
  });
}

/** An option that lives on a supplier's site rather than in a photo. */
export async function addPropOptionLink(
  projectId: string,
  propId: string,
  input: { url: string; name?: string | null; source?: string | null }
): Promise<PropState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const url = input.url.trim();
  // Same guard the board link cards use: this URL is rendered as a link and may
  // later be fetched, so it goes through the SSRF check rather than straight in.
  if (!url || !isFetchableUrl(url)) {
    return { error: "That does not look like a link we can use." };
  }

  return insertOption(supabase, ctx.studio.id, ctx.userId, projectId, propId, {
    name: clean(input.name, 200),
    url: url.slice(0, 2000),
    source: clean(input.source, 200),
  });
}

async function insertOption(
  supabase: ReturnType<typeof createClient>,
  studioId: string,
  userId: string,
  projectId: string,
  propId: string,
  fields: Record<string, unknown>
): Promise<PropState> {
  const { data: last } = await supabase
    .from("prop_options")
    .select("position")
    .eq("prop_id", propId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("prop_options")
    .insert({
      studio_id: studioId,
      prop_id: propId,
      position: ((last as { position: number } | null)?.position ?? -1) + 1,
      created_by: userId,
      ...fields,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add that option." };

  // Gathering the first option is what moves a prop off "needed", so the
  // producer does not have to also remember to click the chip. Only ever
  // forward: a prop already booked is not walked back by adding a reference.
  await supabase
    .from("props")
    .update({ status: "options", updated_at: new Date().toISOString() })
    .eq("id", propId)
    .eq("status", "needed");

  rp(projectId);
  return { id: data.id };
}

/** The option that won. Passing null puts the decision back open. */
export async function pickPropOption(
  projectId: string,
  propId: string,
  optionId: string | null
): Promise<PropState> {
  await requireStudioContext();
  const supabase = createClient();
  const { error } = await supabase
    .from("props")
    .update({ picked_option_id: optionId, updated_at: new Date().toISOString() })
    .eq("id", propId);
  if (error) return { error: error.message };
  rp(projectId);
  return null;
}

export async function deletePropOption(
  projectId: string,
  optionId: string
): Promise<PropState> {
  await requireStudioContext();
  const supabase = createClient();

  const { data: row } = await supabase
    .from("prop_options")
    .select("storage_path")
    .eq("id", optionId)
    .maybeSingle();

  const { error } = await supabase.from("prop_options").delete().eq("id", optionId);
  if (error) return { error: error.message };

  // props.picked_option_id is ON DELETE SET NULL, so a picked option that is
  // removed leaves the prop undecided rather than pointing at nothing. That is
  // why pickedOption() resolves by lookup instead of trusting the id.
  const path = (row as { storage_path: string | null } | null)?.storage_path;
  if (path) await assetStorage().remove([path]).catch(() => {});

  rp(projectId);
  return null;
}
