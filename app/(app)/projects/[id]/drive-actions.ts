"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { getAccessToken } from "@/lib/gmail";
import {
  listDrive,
  getDriveFileBytes,
  type DriveFile,
} from "@/lib/googledrive";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type DriveState = { error?: string } | null;

async function getGoogleAccount(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry, scope")
    .eq("provider", "google")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

// Browse a Drive folder (default My Drive root) or, when a query is given,
// search by name across the user's Drive.
export async function browseDrive(
  opts: { folderId?: string; query?: string } = {}
): Promise<{ files: DriveFile[] } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Google in Settings first." };
  if (!(account.scope ?? "").includes("/auth/drive")) {
    return { error: "Reconnect Google in Settings to enable Drive." };
  }
  try {
    const token = await getAccessToken(supabase, account);
    const files = await listDrive(token, {
      folderId: opts.folderId,
      query: opts.query,
    });
    return { files };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Drive request failed." };
  }
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
}
function assetTypeFromMime(
  mime: string
): Database["public"]["Enums"]["asset_type"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "other";
}

// Imports a Drive file into a project as a new asset (v1). Google-native docs
// are exported to a downloadable format by the Drive helper.
export async function importDriveFile(
  projectId: string,
  fileId: string,
  name: string,
  mimeType: string
): Promise<DriveState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Google in Settings first." };

  try {
    const token = await getAccessToken(supabase, account);
    const dl = await getDriveFileBytes(token, fileId, name, mimeType);
    if (dl.bytes.length > 50_000_000) {
      return { error: "That file is over the 50MB import limit." };
    }
    const path = `${ctx.studio.id}/${projectId}/drive-${crypto.randomUUID()}-${safeName(dl.filename)}`;
    const { error: upErr } = await supabase.storage
      .from("assets")
      .upload(path, dl.bytes, {
        contentType: dl.mimeType || undefined,
        upsert: false,
      });
    if (upErr) return { error: upErr.message };

    const { data: asset, error: aErr } = await supabase
      .from("assets")
      .insert({
        studio_id: ctx.studio.id,
        project_id: projectId,
        name: dl.filename,
        type: assetTypeFromMime(dl.mimeType),
        status: "draft",
        source: "drive",
        external_ref: { drive_file_id: fileId },
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (aErr) return { error: aErr.message };

    const { data: version, error: vErr } = await supabase
      .from("versions")
      .insert({
        studio_id: ctx.studio.id,
        asset_id: asset.id,
        version_number: 1,
        storage_path: path,
        mime_type: dl.mimeType || null,
        size_bytes: dl.bytes.length,
        notes: "Imported from Google Drive",
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (vErr) return { error: vErr.message };

    await supabase
      .from("assets")
      .update({ current_version_id: version.id })
      .eq("id", asset.id);

    await supabase.from("activity").insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      author_id: ctx.userId,
      type: "upload",
      content: `Imported "${dl.filename}" from Google Drive`,
    });

    revalidatePath(`/projects/${projectId}`);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed." };
  }
}
