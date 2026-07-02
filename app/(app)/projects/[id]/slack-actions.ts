"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import {
  searchConversations,
  getConversationHistory,
  getSlackFileBytes,
  postSlackMessage,
  type SlackConversationMatch,
  type SlackMessage,
} from "@/lib/slack";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { OwnerType } from "@/app/(app)/projects/[id]/email-actions";

export type SlackState = { error?: string } | null;

const ownerPath: Record<OwnerType, string> = {
  project: "/projects",
  lead: "/leads",
  client: "/clients",
};

async function getSlackAccount(supabase: SupabaseClient<Database>) {
  const { data } = await supabase
    .from("email_accounts")
    .select("id, access_token, scope")
    .eq("provider", "slack")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function searchSlackConversations(
  query: string
): Promise<{ matches: SlackConversationMatch[] } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const account = await getSlackAccount(supabase);
  if (!account?.access_token)
    return { error: "Connect Slack in Settings first." };
  try {
    const matches = await searchConversations(account.access_token, query.trim());
    return { matches };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Slack search failed." };
  }
}

export async function getSlackChannelMessages(
  channelId: string
): Promise<{ messages: SlackMessage[] } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const account = await getSlackAccount(supabase);
  if (!account?.access_token)
    return { error: "Connect Slack in Settings first." };
  try {
    const messages = await getConversationHistory(
      account.access_token,
      channelId
    );
    return { messages };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not load channel." };
  }
}

export async function sendSlackMessage(
  channelId: string,
  text: string,
  opts: { revalidate?: string } = {}
): Promise<SlackState> {
  await requireStudioContext();
  const body = text.trim();
  if (!body) return { error: "Write a message first." };

  const supabase = createClient();
  const account = await getSlackAccount(supabase);
  if (!account?.access_token)
    return { error: "Connect Slack in Settings first." };
  if (!(account.scope ?? "").includes("chat:write")) {
    return { error: "Reconnect Slack in Settings to enable sending." };
  }
  try {
    await postSlackMessage(account.access_token, channelId, body);
    if (opts.revalidate) revalidatePath(opts.revalidate);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send." };
  }
}

export async function linkSlackChannel(
  ownerType: OwnerType,
  ownerId: string,
  channelId: string,
  channelName: string
): Promise<SlackState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const account = await getSlackAccount(supabase);
  if (!account) return { error: "Connect Slack in Settings first." };

  const { error } = await supabase.from("slack_channels").insert({
    studio_id: ctx.studio.id,
    project_id: ownerType === "project" ? ownerId : null,
    lead_id: ownerType === "lead" ? ownerId : null,
    client_id: ownerType === "client" ? ownerId : null,
    account_id: account.id,
    slack_channel_id: channelId,
    channel_name: channelName,
    created_by: ctx.userId,
  });
  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath(`${ownerPath[ownerType]}/${ownerId}`);
  revalidatePath("/communication");
  return null;
}

export async function unlinkSlackChannel(id: string, revalidate?: string) {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("slack_channels").delete().eq("id", id);
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

export async function importSlackFile(
  projectId: string,
  channelId: string,
  fileUrl: string,
  filename: string,
  mimeType: string
): Promise<SlackState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const account = await getSlackAccount(supabase);
  if (!account?.access_token)
    return { error: "Connect Slack in Settings first." };

  try {
    const bytes = await getSlackFileBytes(account.access_token, fileUrl);
    const path = `${ctx.studio.id}/${projectId}/slack-${crypto.randomUUID()}-${safeName(filename)}`;
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
        source: "slack",
        external_ref: { slack_channel_id: channelId },
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
        notes: "Imported from Slack",
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
      content: `Imported "${filename}" from Slack`,
    });

    revalidatePath(`/projects/${projectId}`);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed." };
  }
}
