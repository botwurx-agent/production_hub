import "server-only";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { assetStorage } from "@/lib/asset-storage";

export type RequestLink = {
  linkId: string;
  studioId: string;
  clientId: string;
};

export type RequestPageView = {
  studioName: string;
  logoUrl: string | null;
  clientName: string;
};

/** A live request link by token, or null when unknown or turned off. */
export async function requestLinkByToken(token: string): Promise<RequestLink | null> {
  if (!serviceConfigured() || !token) return null;
  const { data } = await createServiceClient()
    .from("request_links")
    .select("id, studio_id, client_id, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  return { linkId: data.id, studioId: data.studio_id, clientId: data.client_id };
}

/** What the public request page shows: who the client is asking, and as whom. */
export async function loadRequestPage(
  link: RequestLink
): Promise<RequestPageView | null> {
  const service = createServiceClient();
  const [{ data: studio }, { data: client }] = await Promise.all([
    service.from("studios").select("name, logo_path").eq("id", link.studioId).maybeSingle(),
    service.from("clients").select("name").eq("id", link.clientId).maybeSingle(),
  ]);
  if (!studio || !client) return null;
  let logoUrl: string | null = null;
  if (studio.logo_path) {
    const { data } = await assetStorage().createSignedUrl(studio.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }
  return { studioName: studio.name, logoUrl, clientName: client.name };
}

/**
 * The live request link for a client, so the project's client portal can offer
 * "Request new work". Only ever handed to somebody already holding that
 * client's portal token, which is the rule the portal's way-back bar follows:
 * a page hands a visitor only what belongs to the client they came as.
 */
export async function liveRequestTokenForClient(clientId: string | null): Promise<string | null> {
  if (!clientId || !serviceConfigured()) return null;
  const { data } = await createServiceClient()
    .from("request_links")
    .select("token, revoked_at")
    .eq("client_id", clientId)
    .maybeSingle();
  return data && !data.revoked_at ? data.token : null;
}
