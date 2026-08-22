"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { assetStorage } from "@/lib/asset-storage";
import { generateReviewToken } from "@/lib/review-links";
import { signContactFile } from "@/lib/talent-data";
import { parseWardrobe, type Wardrobe } from "@/lib/talent";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/attachment-limits";
import { reportError } from "@/lib/log";

export type TalentState = { error?: string } | null;

export type ProfileInput = {
  creditedAs?: string | null;
  pronouns?: string | null;
  website?: string | null;
  agentName?: string | null;
  agentEmail?: string | null;
  agentPhone?: string | null;
  unionStatus?: string | null;
  dietaryRestrictions?: string | null;
  allergies?: string | null;
  dietaryNotes?: string | null;
  wardrobe?: Wardrobe | null;
};

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t.slice(0, 500) : null;
}

/**
 * Confirms the contact is reachable before anything is written against it.
 *
 * The read goes through the RLS client, whose contacts policy is exactly
 * `is_studio_member OR can_access_project`, so THE READ IS THE ACCESS CHECK for
 * members and collaborators alike. Same move as createAssetUploadUrl: no second
 * permission layer to drift out of step with the first.
 */
async function reachableContact(
  supabase: ReturnType<typeof createClient>,
  contactId: string
): Promise<{ id: string; project_id: string | null } | null> {
  const { data } = await supabase
    .from("contacts")
    .select("id, project_id")
    .eq("id", contactId)
    .maybeSingle();
  return data ?? null;
}

/** Create or update the profile. One row per contact, so this is an upsert. */
export async function saveContactProfile(
  projectId: string,
  contactId: string,
  input: ProfileInput
): Promise<TalentState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  if (!(await reachableContact(supabase, contactId))) {
    return { error: "Contact not found." };
  }

  // Re-parsed here as well as in the form, because the payload crossed the
  // browser. Same rule as the invoice extractor and the Runner cards: whatever
  // comes back from a client is input again, not a value you already checked.
  const wardrobe = parseWardrobe(input.wardrobe ?? {});

  const { error } = await supabase.from("contact_profiles").upsert(
    {
      studio_id: ctx.studio.id,
      contact_id: contactId,
      credited_as: clean(input.creditedAs),
      pronouns: clean(input.pronouns),
      website: clean(input.website),
      agent_name: clean(input.agentName),
      agent_email: clean(input.agentEmail),
      agent_phone: clean(input.agentPhone),
      union_status: clean(input.unionStatus),
      dietary_restrictions: clean(input.dietaryRestrictions),
      allergies: clean(input.allergies),
      dietary_notes: clean(input.dietaryNotes),
      wardrobe: Object.keys(wardrobe).length ? wardrobe : null,
      created_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/contacts`);
  return null;
}

async function storeFile(
  studioId: string,
  contactId: string,
  file: File,
  folder: string
): Promise<{ path: string } | { error: string }> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `That file is ${formatBytes(file.size)}, over the ${formatBytes(
        MAX_UPLOAD_BYTES
      )} limit for an upload.`,
    };
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
  const path = `${studioId}/contacts/${contactId}/${folder}/${generateReviewToken()}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // assetStorage() rather than the RLS client: the bucket policy is scoped to a
  // studio FOLDER, which a project collaborator does not satisfy, and the
  // access gate is one layer up in reachableContact. Exactly the option A from
  // migration 0056 that the storyboard and moodboard uploads already use.
  const { error } = await assetStorage().upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    reportError("talent.storeFile", error);
    return { error: "Could not upload that file. Try again." };
  }
  return { path };
}

/** The headshot. One per contact, and a new one replaces the last. */
export async function uploadHeadshot(
  projectId: string,
  contactId: string,
  formData: FormData
): Promise<TalentState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  if (!(await reachableContact(supabase, contactId))) {
    return { error: "Contact not found." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file selected." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "A headshot has to be an image." };
  }

  const stored = await storeFile(ctx.studio.id, contactId, file, "headshot");
  if ("error" in stored) return stored;

  // Read the old path before overwriting, so the replaced image can be removed
  // rather than left paying for storage forever with nothing pointing at it.
  const { data: existing } = await supabase
    .from("contact_profiles")
    .select("headshot_path")
    .eq("contact_id", contactId)
    .maybeSingle();

  const { error } = await supabase.from("contact_profiles").upsert(
    {
      studio_id: ctx.studio.id,
      contact_id: contactId,
      headshot_path: stored.path,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "contact_id" }
  );
  if (error) return { error: error.message };

  const old = (existing as { headshot_path: string | null } | null)?.headshot_path;
  if (old && old !== stored.path) {
    // Best effort: a failed cleanup must never fail the upload that succeeded.
    await assetStorage().remove([old]).catch(() => {});
  }

  revalidatePath(`/projects/${projectId}/contacts`);
  return null;
}

/** A document or a piece of media stuck to this person. */
export async function addContactFile(
  projectId: string,
  contactId: string,
  formData: FormData
): Promise<TalentState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  if (!(await reachableContact(supabase, contactId))) {
    return { error: "Contact not found." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No file selected." };
  }

  // The shelf is decided by the file, not by a picker: asking someone to
  // classify a JPEG as "media" is a question with one right answer, which is a
  // question that should not be asked.
  const kind = file.type.startsWith("image/") || file.type.startsWith("video/")
    ? "media"
    : "document";

  const stored = await storeFile(ctx.studio.id, contactId, file, kind);
  if ("error" in stored) return stored;

  const { error } = await supabase.from("contact_files").insert({
    studio_id: ctx.studio.id,
    contact_id: contactId,
    kind,
    name: file.name.slice(0, 200),
    storage_path: stored.path,
    mime_type: file.type || null,
    size_bytes: file.size,
    created_by: ctx.userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/contacts`);
  return null;
}

export async function deleteContactFile(
  projectId: string,
  fileId: string
): Promise<TalentState> {
  await requireStudioContext();
  const supabase = createClient();

  // Read the path through RLS first: that read is the permission check, and it
  // also gives us the blob to remove.
  const { data: row } = await supabase
    .from("contact_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (!row) return { error: "File not found." };

  const { error } = await supabase.from("contact_files").delete().eq("id", fileId);
  if (error) return { error: error.message };

  await assetStorage()
    .remove([(row as { storage_path: string }).storage_path])
    .catch(() => {});

  revalidatePath(`/projects/${projectId}/contacts`);
  return null;
}

/**
 * Signed on CLICK, never on page load.
 *
 * Most of these rows are never opened, and signing forty URLs to render a list
 * of forty filenames is work thrown away. Same call as the cost ledger's
 * invoice documents.
 */
export async function getContactFileUrl(fileId: string): Promise<string | null> {
  await requireStudioContext();
  const supabase = createClient();
  const { data } = await supabase
    .from("contact_files")
    .select("storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (!data) return null;
  return signContactFile((data as { storage_path: string }).storage_path);
}
