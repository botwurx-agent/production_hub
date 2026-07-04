"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { getAccessToken } from "@/lib/gmail";
import {
  listSpaces,
  listSpaceMessages,
  createSpaceMessage,
  type ChatSpaceMatch,
  type ChatMessage,
} from "@/lib/googlechat";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { OwnerType } from "@/app/(app)/projects/[id]/email-actions";

export type ChatState = { error?: string } | null;

const ownerPath: Record<OwnerType, string> = {
  project: "/projects",
  lead: "/leads",
  client: "/clients",
};

// Google Chat rides on the connected Google account (provider='google').
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

function chatEnabled(scope: string | null | undefined): boolean {
  const s = scope ?? "";
  return s.includes("chat.spaces") || s.includes("chat.messages");
}

export async function searchChatSpaces(
  query: string
): Promise<{ matches: ChatSpaceMatch[] } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Google in Settings first." };
  if (!chatEnabled(account.scope)) {
    return { error: "Reconnect Google in Settings to enable Chat." };
  }
  try {
    const token = await getAccessToken(supabase, account);
    const matches = await listSpaces(token, query.trim());
    return { matches };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Chat search failed." };
  }
}

export async function getChatSpaceMessages(
  spaceName: string
): Promise<{ messages: ChatMessage[] } | { error: string }> {
  await requireStudioContext();
  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Google in Settings first." };
  try {
    const token = await getAccessToken(supabase, account);
    const messages = await listSpaceMessages(token, spaceName);
    return { messages };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not load space." };
  }
}

export async function sendChatMessage(
  spaceName: string,
  text: string,
  opts: { revalidate?: string } = {}
): Promise<ChatState> {
  await requireStudioContext();
  const body = text.trim();
  if (!body) return { error: "Write a message first." };

  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Google in Settings first." };
  if (!(account.scope ?? "").includes("chat.messages")) {
    return { error: "Reconnect Google in Settings to enable sending." };
  }
  try {
    const token = await getAccessToken(supabase, account);
    await createSpaceMessage(token, spaceName, body);
    if (opts.revalidate) revalidatePath(opts.revalidate);
    return null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send." };
  }
}

export async function linkChatSpace(
  ownerType: OwnerType,
  ownerId: string,
  spaceName: string,
  spaceDisplayName: string
): Promise<ChatState> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const account = await getGoogleAccount(supabase);
  if (!account) return { error: "Connect Google in Settings first." };

  const { error } = await supabase.from("chat_spaces").insert({
    studio_id: ctx.studio.id,
    project_id: ownerType === "project" ? ownerId : null,
    lead_id: ownerType === "lead" ? ownerId : null,
    client_id: ownerType === "client" ? ownerId : null,
    account_id: account.id,
    space_name: spaceName,
    space_display_name: spaceDisplayName,
    created_by: ctx.userId,
  });
  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath(`${ownerPath[ownerType]}/${ownerId}`);
  revalidatePath("/communication");
  return null;
}

export async function unlinkChatSpace(id: string, revalidate?: string) {
  await requireStudioContext();
  const supabase = createClient();
  await supabase.from("chat_spaces").delete().eq("id", id);
  if (revalidate) revalidatePath(revalidate);
  revalidatePath("/communication");
}

// Marks a space read (opened in the Hub) so it stops counting toward the
// Communication badge.
export async function markSpaceRead(rowId: string): Promise<void> {
  await requireStudioContext();
  const supabase = createClient();
  await supabase
    .from("chat_spaces")
    .update({ last_read_at: new Date().toISOString() })
    .eq("id", rowId);
}
