import "server-only";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { assetStorage } from "@/lib/asset-storage";

export type DeliveryViewFile = {
  id: string;
  name: string;
  sizeBytes: number | null;
  mimeType: string | null;
};

export type DeliveryViewGroup = {
  /** Null for files not filed against a deliverable. */
  name: string | null;
  spec: string | null;
  files: DeliveryViewFile[];
};

export type DeliveryView = {
  studioName: string;
  logoUrl: string | null;
  projectTitle: string;
  clientName: string | null;
  groups: DeliveryViewGroup[];
  fileCount: number;
};

/** The live link row for a token, or null. Service role, gated by token. */
export async function liveDeliveryLink(token: string) {
  if (!serviceConfigured() || !token || token.length < 16) return null;
  const { data } = await createServiceClient()
    .from("delivery_links")
    .select("id, studio_id, project_id, revoked_at")
    .eq("token", token)
    .maybeSingle();
  return data && !data.revoked_at ? data : null;
}

/**
 * What the client sees on /dl/<token>: the project's final files, grouped by
 * the deliverable each was filed against, in the deliverables' own order.
 * Storage paths never leave the server; each file downloads through the
 * token-guarded route.
 */
export async function loadDeliveryByToken(token: string): Promise<DeliveryView | null> {
  const link = await liveDeliveryLink(token);
  if (!link) return null;
  const service = createServiceClient();
  const [{ data: project }, { data: studio }, { data: deliverables }, { data: files }] =
    await Promise.all([
      service
        .from("projects")
        .select("title, client:clients(name)")
        .eq("id", link.project_id)
        .maybeSingle(),
      service.from("studios").select("name, logo_path").eq("id", link.studio_id).maybeSingle(),
      service
        .from("deliverables")
        .select("id, name, spec, position")
        .eq("project_id", link.project_id)
        .order("position", { ascending: true }),
      service
        .from("delivery_files")
        .select("id, deliverable_id, file_name, size_bytes, mime_type, created_at")
        .eq("project_id", link.project_id)
        .order("created_at", { ascending: true }),
    ]);
  if (!project) return null;

  const byDeliverable = new Map<string | null, DeliveryViewFile[]>();
  for (const f of files ?? []) {
    const key = f.deliverable_id ?? null;
    const list = byDeliverable.get(key) ?? [];
    list.push({ id: f.id, name: f.file_name, sizeBytes: f.size_bytes, mimeType: f.mime_type });
    byDeliverable.set(key, list);
  }
  const groups: DeliveryViewGroup[] = [];
  for (const d of deliverables ?? []) {
    const list = byDeliverable.get(d.id);
    if (list?.length) groups.push({ name: d.name || "Deliverable", spec: d.spec, files: list });
  }
  const loose = byDeliverable.get(null);
  if (loose?.length) groups.push({ name: null, spec: null, files: loose });

  let logoUrl: string | null = null;
  if (studio?.logo_path) {
    const { data } = await assetStorage().createSignedUrl(studio.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }
  const client = project.client as { name: string } | { name: string }[] | null;
  const clientName = Array.isArray(client) ? client[0]?.name ?? null : client?.name ?? null;

  return {
    studioName: studio?.name ?? "Your studio",
    logoUrl,
    projectTitle: project.title,
    clientName,
    groups,
    fileCount: (files ?? []).length,
  };
}

export async function recordDeliveryView(token: string): Promise<void> {
  if (!serviceConfigured()) return;
  await createServiceClient()
    .from("delivery_links")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("token", token)
    .is("revoked_at", null);
}
