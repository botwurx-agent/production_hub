"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import {
  getAccessToken,
  searchThreads,
  getThread,
  getAttachmentBytes,
  getReplyContext,
  sendGmailReply,
  type ThreadSummary,
  type ThreadMessage,
} from "@/lib/gmail";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type EmailState = { error?: string } | null;

async function getGoogleAccount(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("email_accounts")
    .select("id, access_token, refresh_token, token_expiry, email, scope")
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

export async function sendReply(
  projectId: string,
  gmailThreadId: string,
  body: string
): Promise<EmailState> {
  const ctx = await requireStudioContext();
  const text = body.trim();
  if (!text) return { error: "Write a message first." };

  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Gmail in Settings first." };
  if (!(account.scope ?? "").includes("gmail.send")) {
    return { error: "Reconnect Gmail in Settings to enable sending." };
  }

  try {
    const token = await getAccessToken(supabase, account);
    const rc = await getReplyContext(token, gmailThreadId);
    await sendGmailReply(token, gmailThreadId, rc, text);
    await supabase.from("activity").insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      author_id: ctx.userId,
      type: "activity",
      content: `Replied via email: "${rc.subject}"`,
    });
    revalidatePath(`/projects/${projectId}`);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send reply." };
  }
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

// Existing project assets, to offer an email attachment as a new version of one.
export async function getProjectAssets(
  projectId: string
): Promise<{ assets: { id: string; name: string }[] } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("id, name")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) return { error: error.message };
  return { assets: data ?? [] };
}

// Shared: download the Gmail attachment and store it once.
async function fetchAndStore(
  supabase: SupabaseClient<Database>,
  studioId: string,
  projectId: string,
  gmailMessageId: string,
  attachmentId: string,
  filename: string,
  mimeType: string
): Promise<{ path: string; size: number } | { error: string }> {
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Gmail in Settings first." };
  const token = await getAccessToken(supabase, account);
  const bytes = await getAttachmentBytes(token, gmailMessageId, attachmentId);
  const path = `${studioId}/${projectId}/gmail-${crypto.randomUUID()}-${safeName(filename)}`;
  const { error } = await supabase.storage
    .from("assets")
    .upload(path, bytes, { contentType: mimeType || undefined, upsert: false });
  if (error) return { error: error.message };
  return { path, size: bytes.length };
}

// Import a Gmail attachment as a brand-new project asset (v1).
export async function importAttachment(
  projectId: string,
  gmailMessageId: string,
  attachmentId: string,
  filename: string,
  mimeType: string
): Promise<EmailState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  try {
    const stored = await fetchAndStore(
      supabase,
      ctx.studio.id,
      projectId,
      gmailMessageId,
      attachmentId,
      filename,
      mimeType
    );
    if ("error" in stored) return stored;

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
        storage_path: stored.path,
        mime_type: mimeType || null,
        size_bytes: stored.size,
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

// Import a Gmail attachment as a new version of an existing asset.
export async function importAttachmentAsVersion(
  projectId: string,
  assetId: string,
  gmailMessageId: string,
  attachmentId: string,
  filename: string,
  mimeType: string
): Promise<EmailState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select("name")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) return { error: "Asset not found." };

  try {
    const stored = await fetchAndStore(
      supabase,
      ctx.studio.id,
      projectId,
      gmailMessageId,
      attachmentId,
      filename,
      mimeType
    );
    if ("error" in stored) return stored;

    const { data: last } = await supabase
      .from("versions")
      .select("version_number")
      .eq("asset_id", assetId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const versionNumber = (last?.version_number ?? 0) + 1;

    const { data: version, error: vErr } = await supabase
      .from("versions")
      .insert({
        studio_id: ctx.studio.id,
        asset_id: assetId,
        version_number: versionNumber,
        storage_path: stored.path,
        mime_type: mimeType || null,
        size_bytes: stored.size,
        notes: "Imported from Gmail",
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (vErr) return { error: vErr.message };

    await supabase
      .from("assets")
      .update({ current_version_id: version.id })
      .eq("id", assetId);

    await supabase.from("activity").insert({
      studio_id: ctx.studio.id,
      project_id: projectId,
      author_id: ctx.userId,
      type: "upload",
      content: `Added v${versionNumber} to "${asset.name}" from email`,
    });

    revalidatePath(`/projects/${projectId}`);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed." };
  }
}
