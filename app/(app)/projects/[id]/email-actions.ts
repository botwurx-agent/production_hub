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
  type OutgoingAttachment,
} from "@/lib/gmail";
import { getDriveFileBytes } from "@/lib/googledrive";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type EmailState = { error?: string } | null;
export type OwnerType = "project" | "lead" | "client";

const ownerPath: Record<OwnerType, string> = {
  project: "/projects",
  lead: "/leads",
  client: "/clients",
};

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
  ownerType: OwnerType,
  ownerId: string,
  gmailThreadId: string,
  subject: string,
  lastMessageMs: number
): Promise<EmailState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Gmail in Settings first." };

  const { error } = await supabase.from("email_threads").insert({
    studio_id: ctx.studio.id,
    project_id: ownerType === "project" ? ownerId : null,
    lead_id: ownerType === "lead" ? ownerId : null,
    client_id: ownerType === "client" ? ownerId : null,
    account_id: account.id,
    gmail_thread_id: gmailThreadId,
    subject,
    last_message_at: lastMessageMs
      ? new Date(lastMessageMs).toISOString()
      : null,
    created_by: ctx.userId,
  });
  // 23505 = already linked to this owner; treat as success.
  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath(`${ownerPath[ownerType]}/${ownerId}`);
  revalidatePath("/communication");
  return null;
}

// Reads the chosen project assets' current stored files as email attachments.
async function collectAssetAttachments(
  supabase: SupabaseClient<Database>,
  assetIds: string[]
): Promise<OutgoingAttachment[]> {
  if (assetIds.length === 0) return [];
  const { data: assets } = await supabase
    .from("assets")
    .select(
      "id, name, current:versions!assets_current_version_fk(storage_path, mime_type)"
    )
    .in("id", assetIds);
  const out: OutgoingAttachment[] = [];
  for (const a of assets ?? []) {
    const cur = a.current as {
      storage_path: string | null;
      mime_type: string | null;
    } | null;
    if (!cur?.storage_path) continue;
    const { data: blob, error } = await supabase.storage
      .from("assets")
      .download(cur.storage_path);
    if (error || !blob) continue;
    out.push({
      filename: a.name,
      mimeType: cur.mime_type || "application/octet-stream",
      bytes: Buffer.from(await blob.arrayBuffer()),
    });
  }
  return out;
}

async function requireSendAccount(supabase: SupabaseClient<Database>) {
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Gmail in Settings first." as const };
  if (!(account.scope ?? "").includes("gmail.send")) {
    return { error: "Reconnect Gmail in Settings to enable sending." as const };
  }
  return { account };
}

// Sends the reply and logs it to the project timeline. Shared by the plain and
// FormData (with device files) entry points.
async function deliverReply(
  supabase: SupabaseClient<Database>,
  ctx: Awaited<ReturnType<typeof requireStudioContext>>,
  account: NonNullable<Awaited<ReturnType<typeof getGoogleAccount>>>,
  gmailThreadId: string,
  text: string,
  attachments: OutgoingAttachment[],
  opts: { projectId?: string; revalidate?: string }
): Promise<EmailState> {
  const total = attachments.reduce((n, a) => n + a.bytes.length, 0);
  if (total > 5_000_000) {
    return {
      error:
        "Those attachments are over the 5MB email limit. Send fewer or smaller files.",
    };
  }
  try {
    const token = await getAccessToken(supabase, account);
    const rc = await getReplyContext(token, gmailThreadId);
    await sendGmailReply(token, gmailThreadId, rc, text, attachments);
    // Log to the project timeline only when the thread belongs to a project.
    if (opts.projectId) {
      const suffix =
        attachments.length > 0
          ? ` with ${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`
          : "";
      await supabase.from("activity").insert({
        studio_id: ctx.studio.id,
        project_id: opts.projectId,
        author_id: ctx.userId,
        type: "activity",
        content: `Replied via email: "${rc.subject}"${suffix}`,
      });
    }
    if (opts.revalidate) revalidatePath(opts.revalidate);
    revalidatePath("/communication");
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send reply." };
  }
}

export async function sendReply(
  gmailThreadId: string,
  body: string,
  opts: { projectId?: string; revalidate?: string; assetIds?: string[] } = {}
): Promise<EmailState> {
  const ctx = await requireStudioContext();
  const text = body.trim();
  if (!text) return { error: "Write a message first." };

  const supabase = createClient();
  const acct = await requireSendAccount(supabase);
  if ("error" in acct) return { error: acct.error };

  const attachments = await collectAssetAttachments(supabase, opts.assetIds ?? []);
  return deliverReply(
    supabase,
    ctx,
    acct.account,
    gmailThreadId,
    text,
    attachments,
    opts
  );
}

// Reply entry point that accepts device-file uploads (and optionally project
// assets) via FormData. Used by the thread reply box.
export async function sendReplyWithFiles(
  formData: FormData
): Promise<EmailState> {
  const ctx = await requireStudioContext();
  const gmailThreadId = String(formData.get("threadId") ?? "");
  const text = String(formData.get("body") ?? "").trim();
  const projectId = (formData.get("projectId") as string) || undefined;
  const revalidate = (formData.get("revalidate") as string) || undefined;
  if (!gmailThreadId) return { error: "Missing thread." };
  if (!text) return { error: "Write a message first." };

  let assetIds: string[] = [];
  try {
    const raw = formData.get("assetIds");
    if (raw) assetIds = JSON.parse(String(raw)) as string[];
  } catch {
    assetIds = [];
  }

  let driveFiles: { id: string; name: string; mimeType: string }[] = [];
  try {
    const raw = formData.get("driveFiles");
    if (raw) driveFiles = JSON.parse(String(raw));
  } catch {
    driveFiles = [];
  }

  const supabase = createClient();
  const acct = await requireSendAccount(supabase);
  if ("error" in acct) return { error: acct.error };

  const attachments = await collectAssetAttachments(supabase, assetIds);

  // Device files chosen in the reply box.
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of files) {
    attachments.push({
      filename: f.name,
      mimeType: f.type || "application/octet-stream",
      bytes: Buffer.from(await f.arrayBuffer()),
    });
  }

  // Google Drive files chosen in the reply box (downloaded server-side).
  if (driveFiles.length > 0) {
    try {
      const token = await getAccessToken(supabase, acct.account);
      for (const d of driveFiles) {
        const dl = await getDriveFileBytes(token, d.id, d.name, d.mimeType);
        attachments.push({
          filename: dl.filename,
          mimeType: dl.mimeType,
          bytes: dl.bytes,
        });
      }
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Could not fetch a Drive file.",
      };
    }
  }

  return deliverReply(supabase, ctx, acct.account, gmailThreadId, text, attachments, {
    projectId,
    revalidate,
  });
}

// Marks a thread read (opened in the Hub) so it stops counting toward the
// Communication badge. Fire-and-forget from the thread reader.
export async function markThreadRead(threadRowId: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("email_threads")
    .update({ last_read_at: new Date().toISOString() })
    .eq("id", threadRowId);
}

export async function unlinkThread(threadRowId: string, revalidate?: string) {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("email_threads").delete().eq("id", threadRowId);
  if (revalidate) revalidatePath(revalidate);
  revalidatePath("/communication");
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

// Studio projects, to choose an import target when importing from a lead or
// client conversation (which has no project of its own).
export async function getImportProjects(): Promise<
  { projects: { id: string; title: string }[] } | { error: string }
> {
  await requireStudioContext();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, title")
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return { projects: data ?? [] };
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
