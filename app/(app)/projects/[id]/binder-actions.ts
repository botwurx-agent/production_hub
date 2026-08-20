"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { reportError } from "@/lib/log";
import { parseChoices, type BinderChoice } from "@/lib/binder";

function rp(projectId: string) {
  revalidatePath(`/projects/${projectId}/binder`);
  revalidatePath(`/projects/${projectId}`);
}

/** 192 bits, the same as every other share token in the app. */
function mintToken() {
  return randomBytes(24).toString("base64url");
}

export async function createBinder(
  projectId: string,
  title?: string
): Promise<{ id: string } | { error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("project_binders")
    .insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      title: title?.trim().slice(0, 160) || null,
      token: mintToken(),
      sections: [],
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    reportError("createBinder", { error, projectId });
    return { error: "Could not create that binder." };
  }
  rp(projectId);
  return { id: data.id };
}

export async function renameBinder(
  projectId: string,
  binderId: string,
  title: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("project_binders")
    .update({ title: title.trim().slice(0, 160) || null, updated_at: new Date().toISOString() })
    .eq("id", binderId);
  rp(projectId);
}

/**
 * Save which sections are in, in what order, and which hide their notes.
 *
 * Parsed on the way in as well as on the way out. The payload crosses the
 * browser, and this one decides what a client can see, so it is not a place to
 * trust a shape.
 */
export async function saveBinderSections(
  projectId: string,
  binderId: string,
  sections: BinderChoice[]
): Promise<{ ok: true } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const clean = parseChoices(sections);
  const { error } = await supabase
    .from("project_binders")
    .update({ sections: clean, updated_at: new Date().toISOString() })
    .eq("id", binderId);
  if (error) {
    reportError("saveBinderSections", { error, projectId });
    return { error: "Could not save the binder." };
  }
  rp(projectId);
  return { ok: true };
}

/**
 * Turn a binder into a link.
 *
 * Separate from creating one, deliberately. A binder is assembled over a few
 * minutes and shared once it says what the studio means it to say, so it
 * cannot be opened until somebody presses this, even by whoever has the URL.
 */
export async function shareBinder(
  projectId: string,
  binderId: string
): Promise<{ token: string } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_binders")
    .update({ shared_at: new Date().toISOString(), revoked_at: null })
    .eq("id", binderId)
    .select("token")
    .single();
  if (error || !data) {
    reportError("shareBinder", { error, projectId });
    return { error: "Could not share that binder." };
  }
  rp(projectId);
  return { token: data.token };
}

export async function revokeBinder(
  projectId: string,
  binderId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("project_binders")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", binderId);
  rp(projectId);
}

export async function deleteBinder(
  projectId: string,
  binderId: string
): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("project_binders").delete().eq("id", binderId);
  rp(projectId);
}
