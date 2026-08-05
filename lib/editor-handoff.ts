import "server-only";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";

/**
 * The editor handoff: a project's picked takes, in order, for whoever assembles
 * the cut.
 *
 * Read through the SERVICE client and gated only by the token, the same shape
 * as the review portal and the call-sheet page, because the editor has no
 * account and should not need one to collect four files.
 *
 * LIVE, not a snapshot. The page reflects the current picks every time it is
 * opened, so a regenerated shot reaches the editor without a second link. The
 * cost is that an editor who downloaded yesterday cannot tell something moved,
 * which is why `updatedAt` is surfaced prominently rather than buried.
 */

export type HandoffShot = {
  shotId: string;
  position: number;
  title: string;
  beat: string | null;
  /** Null when this shot has no picked take yet. */
  generationId: string | null;
  /** What the file will be called on the editor's disk. */
  filename: string | null;
  posterUrl: string | null;
  previewUrl: string | null;
  durationSec: number | null;
  resolution: string | null;
  model: string | null;
  isVideo: boolean;
};

export type HandoffData = {
  studioName: string;
  projectTitle: string;
  label: string | null;
  shots: HandoffShot[];
  /** How many shots actually have a file to collect. */
  readyCount: number;
  /** Most recent change to any picked take, ISO. */
  updatedAt: string | null;
};

/** Safe on every filesystem, and sorts correctly in a Finder window. */
function fileNameFor(position: number, title: string, path: string | null) {
  const stem =
    title
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "shot";
  const ext = path?.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() ?? "mp4";
  return `${String(position).padStart(2, "0")}_${stem}.${ext}`;
}

export async function loadHandoffByToken(
  token: string
): Promise<HandoffData | null> {
  if (!serviceConfigured()) return null;
  const service = createServiceClient();

  const { data: handoff } = await service
    .from("editor_handoffs")
    .select("id, studio_id, project_id, label, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!handoff || handoff.revoked_at) return null;

  const [{ data: project }, { data: studio }] = await Promise.all([
    service
      .from("projects")
      .select("title")
      .eq("id", handoff.project_id)
      .maybeSingle(),
    service
      .from("studios")
      .select("name")
      .eq("id", handoff.studio_id)
      .maybeSingle(),
  ]);
  if (!project) return null;

  const { data: shots } = await service
    .from("ai_shots")
    .select("id, position, title, beat")
    .eq("project_id", handoff.project_id)
    .order("position", { ascending: true });
  if (!shots) return null;

  const { data: gens } = await service
    .from("ai_generations")
    .select(
      "id, shot_id, role, kind, stage, file_path, external_url, thumb_url, duration_sec, resolution, model, created_at"
    )
    .in(
      "shot_id",
      shots.map((s) => s.id)
    )
    .in("role", ["take", "final"]);

  const rows = gens ?? [];
  const paths = rows
    .map((g) => g.file_path)
    .filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await service.storage
      .from("assets")
      .createSignedUrls(paths, 60 * 60);
    for (const s of data ?? []) {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
  }

  let updatedAt: string | null = null;
  const out: HandoffShot[] = shots.map((s, i) => {
    const take = rows.find((g) => g.shot_id === s.id) ?? null;
    const position = i + 1;
    if (take?.created_at && (!updatedAt || take.created_at > updatedAt)) {
      updatedAt = take.created_at;
    }
    const isVideo = Boolean(
      take && (take.kind === "video" || take.stage === "video")
    );
    const file = take?.file_path ? signed.get(take.file_path) ?? null : null;
    return {
      shotId: s.id,
      position,
      title: s.title || `Shot ${position}`,
      beat: s.beat,
      // Only a STORED file can be handed over. A share-page URL is not a file,
      // and telling an editor to go and screen-record one is not a handoff.
      generationId: take && take.file_path ? take.id : null,
      filename: take?.file_path
        ? fileNameFor(position, s.title || `shot-${position}`, take.file_path)
        : null,
      posterUrl: isVideo ? take?.thumb_url ?? null : file,
      previewUrl: file,
      durationSec: take?.duration_sec ? Number(take.duration_sec) : null,
      resolution: take?.resolution ?? null,
      model: take?.model ?? null,
      isVideo,
    };
  });

  return {
    studioName: studio?.name ?? "Studio",
    projectTitle: project.title,
    label: handoff.label,
    shots: out,
    readyCount: out.filter((s) => s.generationId).length,
    updatedAt,
  };
}

/**
 * Resolves one downloadable file for a token. Kept here so the route never
 * touches a storage path that has not been proved to belong to this handoff's
 * project.
 */
export async function resolveHandoffFile(
  token: string,
  generationId: string
): Promise<{ path: string; filename: string } | null> {
  if (!serviceConfigured()) return null;
  const service = createServiceClient();

  const { data: handoff } = await service
    .from("editor_handoffs")
    .select("project_id, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!handoff || handoff.revoked_at) return null;

  const { data: gen } = await service
    .from("ai_generations")
    .select("id, shot_id, file_path, role")
    .eq("id", generationId)
    .maybeSingle();
  if (!gen?.file_path) return null;
  if (gen.role !== "take" && gen.role !== "final") return null;
  if (!gen.shot_id) return null;

  // The generation must belong to a shot in THIS handoff's project. Without
  // this, a valid token would serve any take in the database.
  const { data: shot } = await service
    .from("ai_shots")
    .select("id, position, title, project_id")
    .eq("id", gen.shot_id)
    .maybeSingle();
  if (!shot || shot.project_id !== handoff.project_id) return null;

  const { data: siblings } = await service
    .from("ai_shots")
    .select("id")
    .eq("project_id", handoff.project_id)
    .order("position", { ascending: true });
  const index = (siblings ?? []).findIndex((s) => s.id === shot.id);

  return {
    path: gen.file_path,
    filename: fileNameFor(
      index >= 0 ? index + 1 : shot.position + 1,
      shot.title || "shot",
      gen.file_path
    ),
  };
}

export async function recordHandoffView(token: string) {
  if (!serviceConfigured()) return;
  const service = createServiceClient();
  const { data: row } = await service
    .from("editor_handoffs")
    .select("id, view_count")
    .eq("token", token)
    .maybeSingle();
  if (!row) return;
  await service
    .from("editor_handoffs")
    .update({
      last_viewed_at: new Date().toISOString(),
      view_count: (row.view_count ?? 0) + 1,
    })
    .eq("id", row.id);
}
