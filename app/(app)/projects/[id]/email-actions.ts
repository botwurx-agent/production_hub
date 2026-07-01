"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import {
  getAccessToken,
  searchThreads,
  getThread,
  getAttachmentBytes,
  type ThreadSummary,
  type ThreadMessage,
} from "@/lib/gmail";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type EmailState = { error?: string } | null;

async function getGoogleAccount(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry, email")
    .eq("provider", "google")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function searchGmailThreads(
  query: string
): Promise<{ threads: ThreadSummary[] } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Gmail in Settings first." };
  try {
    const token = await getAccessToken(supabase, account);
    const threads = await searchThreads(token, query.trim() || "newer_than:30d");
    return { threads };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gmail search failed." };
  }
}

export async function getThreadMessages(
  gmailThreadId: string
): Promise<{ messages: ThreadMessage[] } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Gmail in Settings first." };
  try {
    const token = await getAccessToken(supabase, account);
    const messages = await getThread(token, gmailThreadId);
    return { messages };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not load thread." };
  }
}

export async function linkThread(
  projectId: string,
  gmailThreadId: string,
  subject: string,
  lastMessageMs: number
): Promise<EmailState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Gmail in Settings first." };

  const { error } = await supabase.from("email_threads").upsert(
    {
      studio_id: ctx.studio.id,
      project_id: projectId,
      account_id: account.id,
      gmail_thread_id: gmailThreadId,
      subject,
      last_message_at: lastMessageMs
        ? new Date(lastMessageMs).toISOString()
        : null,
      created_by: ctx.userId,
    },
    { onConflict: "project_id,gmail_thread_id" }
  );
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return null;
}

export async function unlinkThread(threadRowId: string, projectId: string) {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("email_threads").delete().eq("id", threadRowId);
  revalidatePath(`/projects/${projectId}`);
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

// Downloads a Gmail attachment server-side and files it as a project asset.
export async function importAttachment(
  projectId: string,
  gmailMessageId: string,
  attachmentId: string,
  filename: string,
  mimeType: string
): Promise<EmailState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Gmail in Settings first." };

  try {
    const token = await getAccessToken(supabase, account);
    const bytes = await getAttachmentBytes(token, gmailMessageId, attachmentId);
    const path = `${ctx.studio.id}/${projectId}/gmail-${crypto.randomUUID()}-${safeName(filename)}`;

    const { error: upErr } = await supabase.storage
      .from("assets")
      .upload(path, bytes, { contentType: mimeType || undefined, upsert: false });
    if (upErr) return { error: upErr.message };

    const { data: asset, error: aErr } = await supabase
      .from("assets")
      .insert({
        studio_id: ctx.studio.id,
        project_id: projectId,
        name: filename,
        type: assetTypeFromMime(mimeType),
        status: "draft",
        source: "gmail",
        external_ref: {
          gmail_message_id: gmailMessageId,
          gmail_attachment_id: attachmentId,
        },
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
        mime_type: mimeType || null,
        size_bytes: bytes.length,
        notes: "Imported from Gmail",
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
      content: `Imported "${filename}" from email`,
    });

    revalidatePath(`/projects/${projectId}`);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed." };
  }
}
