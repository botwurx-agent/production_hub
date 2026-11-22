"use server";

// What a guest can do through a scene builder share link, with no account.
// Every action starts from the token: the link must be live, and the service
// client it then uses never reaches past that link's one setup (or the guest's
// own copy of it).
import { cookies } from "next/headers";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { liveSceneLink } from "@/lib/scene-share";
import { MAX_TAKES_PER_LINK, cleanGuest, cleanGuestKey, takeName } from "@/lib/scene-share-rules";
import { cleanSetup, nameOf } from "@/lib/previz/clean-setup";
import { asSetup } from "@/components/previz/setup";
import { assetStorage } from "@/lib/asset-storage";
import { createNotification } from "@/lib/notifications";
import { allowPublic } from "@/lib/rate-limit";
import { reportError } from "@/lib/log";
import type { Json } from "@/lib/database.types";

const GONE = "This link is no longer available. Ask the studio for a new one.";

/** The browser's own key, from the same cookie the review portal uses. */
function guestKey(): string | null {
  return cleanGuestKey(cookies().get("sf_rk")?.value);
}

/**
 * Saves a guest's scene. On a copy link the first save makes their own setup
 * on the project ("Kitchen (Sam Lee)") and every later save from the same
 * browser goes to that copy; on an edit link it writes the shared setup. A
 * view link saves nothing.
 */
export async function saveSharedScene(
  token: string,
  who: unknown,
  raw: unknown
): Promise<{ ok: true; name: string; first: boolean } | { error: string }> {
  if (!serviceConfigured()) return { error: GONE };
  if (!allowPublic("scene-share-save", 90, 60_000)) return { error: "Too many saves at once. Wait a moment and it will save again." };
  const key = guestKey();
  if (!key) return { error: "This browser is blocking cookies, so your work cannot be saved under your name. Allow cookies for this site and try again." };
  const guest = cleanGuest(who);
  if ("error" in guest) return guest;

  const service = createServiceClient();
  const link = await liveSceneLink(service, token);
  if (!link) return { error: GONE };
  if (link.mode === "view") return { error: "This link is view only, so changes are not saved." };

  const clean = cleanSetup(raw, link.studioId, link.projectId);
  if ("error" in clean) return clean;

  const { data: take } = await service
    .from("scene_share_takes")
    .select("id, scene_setup_id")
    .eq("link_id", link.id)
    .eq("guest_key", key)
    .maybeSingle();
  const now = new Date().toISOString();

  // ----- An edit link: the shared setup itself.
  if (link.mode === "edit") {
    const { data, error } = await service
      .from("scene_setups")
      .update({ name: nameOf(clean.setup), data: clean.setup as unknown as Json, updated_at: now })
      .eq("id", link.setupId)
      .eq("project_id", link.projectId)
      .select("id");
    if (error || !data?.length) {
      if (error) reportError("saveSharedScene/edit", error);
      return { error: "Could not save. The setup may have been deleted." };
    }
    if (take) {
      await service.from("scene_share_takes").update({ guest_name: guest.name, guest_email: guest.email, updated_at: now }).eq("id", take.id);
    } else {
      await service.from("scene_share_takes").insert({
        studio_id: link.studioId, link_id: link.id, scene_setup_id: link.setupId,
        guest_key: key, guest_name: guest.name, guest_email: guest.email,
      });
      await notify(service, link, `${guest.name} edited ${nameOf(clean.setup)}`, guest.email, link.setupId);
    }
    return { ok: true, name: nameOf(clean.setup), first: !take };
  }

  // ----- A copy link: the guest's own setup beside the original.
  const name = takeName(nameOf(clean.setup), guest.name);
  const data = { ...clean.setup, name } as unknown as Json;

  if (take) {
    const { data: rows, error } = await service
      .from("scene_setups")
      .update({ name, data, updated_at: now })
      .eq("id", take.scene_setup_id)
      .eq("project_id", link.projectId)
      .select("id");
    if (error) {
      reportError("saveSharedScene/copy", error);
      return { error: "Could not save your copy." };
    }
    if (rows?.length) {
      await service.from("scene_share_takes").update({ guest_name: guest.name, guest_email: guest.email, updated_at: now }).eq("id", take.id);
      return { ok: true, name, first: false };
    }
    // The studio deleted the copy: its take row went with it (cascade), so
    // fall through and make a fresh one rather than saving into nothing.
  }

  const { count } = await service
    .from("scene_share_takes")
    .select("id", { count: "exact", head: true })
    .eq("link_id", link.id);
  if ((count ?? 0) >= MAX_TAKES_PER_LINK) return { error: "This link has reached the number of copies it can hold. Ask the studio for a new link." };

  const { data: last } = await service
    .from("scene_setups")
    .select("position")
    .eq("project_id", link.projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: made, error: madeErr } = await service
    .from("scene_setups")
    .insert({ studio_id: link.studioId, project_id: link.projectId, name, data, position: (last?.position ?? 0) + 1 })
    .select("id")
    .single();
  if (madeErr || !made) {
    reportError("saveSharedScene/create", madeErr);
    return { error: "Could not save your copy." };
  }
  const { error: takeErr } = await service.from("scene_share_takes").insert({
    studio_id: link.studioId, link_id: link.id, scene_setup_id: made.id,
    guest_key: key, guest_name: guest.name, guest_email: guest.email,
  });
  if (takeErr) {
    // Without its take row the copy could never be saved to again, and the
    // next save would make a second one. Take it back and say so.
    await service.from("scene_setups").delete().eq("id", made.id);
    reportError("saveSharedScene/take", takeErr);
    return { error: "Could not save your copy. Try again." };
  }
  await notify(service, link, `${guest.name} sent back a take on ${nameOf(clean.setup)}`, guest.email, made.id);
  return { ok: true, name, first: true };
}

async function notify(
  service: ReturnType<typeof createServiceClient>,
  link: { studioId: string; projectId: string },
  title: string,
  email: string,
  setupId: string
) {
  // Best effort: the scene is already saved, and a missed bell must not undo it.
  await createNotification(service, {
    studio_id: link.studioId,
    project_id: link.projectId,
    type: "scene_take",
    title,
    body: email,
    href: `/projects/${link.projectId}/scene-builder?setup=${setupId}`,
  }).catch((e) => reportError("saveSharedScene/notify", e));
}

/**
 * Short-lived links for the scene's product photos and models. Only paths the
 * shared setup (or this guest's own copy) actually lists are signed, so a
 * link cannot be used to fetch another file from the project.
 */
export async function signSharedSceneFiles(token: string, paths: string[]): Promise<Record<string, string>> {
  if (!serviceConfigured() || !Array.isArray(paths)) return {};
  if (!allowPublic("scene-share-files", 30, 60_000)) return {};
  const service = createServiceClient();
  const link = await liveSceneLink(service, token);
  if (!link) return {};

  const ids = [link.setupId];
  const key = guestKey();
  if (key && link.mode === "copy") {
    const { data: take } = await service
      .from("scene_share_takes")
      .select("scene_setup_id")
      .eq("link_id", link.id)
      .eq("guest_key", key)
      .maybeSingle();
    if (take) ids.push(take.scene_setup_id);
  }
  const { data: rows } = await service.from("scene_setups").select("data, project_id").in("id", ids);
  const allowed = new Set<string>();
  for (const r of rows ?? []) {
    if (r.project_id !== link.projectId) continue;
    const s = asSetup(r.data);
    for (const p of Object.values(s?.files ?? {})) allowed.add(p);
  }
  const ok = Array.from(new Set(paths)).filter((p) => typeof p === "string" && allowed.has(p)).slice(0, 200);
  if (!ok.length) return {};
  const { data, error } = await assetStorage().createSignedUrls(ok, 3600);
  if (error) {
    reportError("signSharedSceneFiles", error);
    return {};
  }
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** Stamps when the link was last opened. Best effort. */
export async function recordSceneView(token: string): Promise<void> {
  if (!serviceConfigured()) return;
  const service = createServiceClient();
  await service
    .from("scene_share_links")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("token", token)
    .is("revoked_at", null);
}
