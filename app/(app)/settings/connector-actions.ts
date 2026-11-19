"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { canUseConnector } from "@/lib/agent/access";
import { siteOrigin } from "@/lib/site-url";
import {
  cleanLinkName,
  connectorUrl,
  hashConnectorToken,
  newConnectorToken,
  tokenLast4,
} from "@/lib/connector-token";
import { reportError } from "@/lib/log";

/** A person rarely needs more than one per device; past this it is clutter. */
const MAX_LIVE_LINKS = 10;

/**
 * Make a private connector link. The plain URL is returned ONCE, here, and
 * never again: only its hash is stored, so a lost link is replaced, not
 * recovered. Written through the caller's own RLS client, whose policy is
 * user_id = auth.uid(), so nobody can make a link in somebody else's name.
 */
export async function createConnectorLink(
  name: string,
  canEdit = false
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await requireStudioContext();
  if (!canUseConnector(ctx)) {
    return { ok: false, error: "Only studio members can connect an AI assistant." };
  }
  const supabase = createClient();
  const { count } = await supabase
    .from("connector_tokens")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", ctx.studio.id)
    .eq("user_id", ctx.userId)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_LIVE_LINKS) {
    return { ok: false, error: `You already have ${MAX_LIVE_LINKS} links. Turn one off first.` };
  }

  const token = newConnectorToken();
  const { error } = await supabase.from("connector_tokens").insert({
    studio_id: ctx.studio.id,
    user_id: ctx.userId,
    name: cleanLinkName(name),
    token_hash: hashConnectorToken(token),
    token_last4: tokenLast4(token),
    can_edit: canEdit === true,
  });
  if (error) {
    reportError("createConnectorLink", error);
    return { ok: false, error: "The link could not be made. Try again." };
  }
  revalidatePath("/settings");
  return { ok: true, url: connectorUrl(siteOrigin(), token) };
}

/** Turn a link off. Immediate: the next call from the assistant is refused. */
export async function revokeConnectorLink(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("connector_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .is("revoked_at", null)
    .select("id");
  if (error || !data?.length) {
    if (error) reportError("revokeConnectorLink", error);
    return { ok: false, error: "That link could not be turned off. Refresh and try again." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Switch a link between "can add" and "can add and edit". Takes effect on the
 * assistant's next request; the host lists a link's tools when a chat starts,
 * so a chat already open keeps the old list until a new one is started (a
 * call to an edit tool on an add-only link is refused server side either way).
 */
export async function setConnectorLinkEdit(
  id: string,
  canEdit: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireStudioContext();
  if (!canUseConnector(ctx)) {
    return { ok: false, error: "Only studio members can connect an AI assistant." };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("connector_tokens")
    .update({ can_edit: canEdit === true })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .is("revoked_at", null)
    .select("id");
  if (error || !data?.length) {
    if (error) reportError("setConnectorLinkEdit", error);
    return { ok: false, error: "That link could not be changed. Refresh and try again." };
  }
  revalidatePath("/settings");
  return { ok: true };
}
