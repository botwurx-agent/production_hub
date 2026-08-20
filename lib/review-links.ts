import "server-only";
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReviewLink } from "@/lib/database.types";
import type { ApprovalStatus } from "@/lib/database.types";
import { assetStorage } from "@/lib/asset-storage";
import { normalizeDrawing, type Drawing } from "@/lib/review-drawing";
import type { CommentReaction } from "@/lib/review-reactions";
import { loadReactions } from "@/lib/review-reactions-load";

export function generateReviewToken(): string {
  return randomBytes(24).toString("base64url");
}

// A valid link exists, is not revoked, and is not past its expiry.
export async function getValidLink(
  service: SupabaseClient<Database>,
  token: string
): Promise<ReviewLink | null> {
  const { data } = await service
    .from("review_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!data || data.revoked) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }
  return data as ReviewLink;
}

export type PortalComment = {
  id: string;
  version_id: string | null;
  body: string;
  created_at: string;
  author: string; // display name (studio name for team, reviewer_name for client)
  isClient: boolean;
  // Frame.io-style pin: numbered marker at (x, y) percent on the asset.
  pinNumber: number | null;
  x: number | null;
  y: number | null;
  /**
   * For a multi-page surface (a PDF), which page the pin sits on.
   *
   * Null on everything with one surface, which is every image, storyboard and
   * moodboard review, so an existing pin needs no backfill.
   */
  pinPage: number | null;
  // Video review: seconds into the timeline this comment is tied to. When
  // timecodeEnd is set the comment covers the range timecode -> timecodeEnd.
  timecode: number | null;
  timecodeEnd: number | null;
  resolved: boolean;
  // Threading: a reply hangs off its parent and inherits the parent's moment.
  parentId: string | null;
  // Set when the comment has been edited since posting.
  editedAt: string | null;
  // The browser key that posted it (public portal only), so a reviewer can
  // edit or delete their own without a login.
  authorKey: string | null;
  reactions: CommentReaction[];
  // Freehand annotation drawn over the frame this comment is pinned to.
  drawing: Drawing | null;
};

export type PortalVersion = {
  id: string;
  version_number: number;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  created_at: string;
};

export type PortalData = {
  studioName: string;
  projectTitle: string;
  asset: { id: string; name: string; currentVersionId: string | null };
  versions: PortalVersion[];
  comments: PortalComment[];
  // The client's own current decision on the current version, via this link.
  myDecision: ApprovalStatus | null;
  dueDate: string | null;
};

// Assembles everything the client portal shows, strictly scoped to the link's
// asset. Runs with the service client (RLS bypassed), so it must only ever read
// rows tied to link.asset_id / link.studio_id.
export async function gatherReview(
  service: SupabaseClient<Database>,
  link: ReviewLink,
  // The visitor's browser key, so their own reactions come back marked.
  viewerKey?: string | null
): Promise<PortalData | null> {
  if (!link.asset_id) return null;
  const [{ data: asset }, { data: studio }, { data: project }] =
    await Promise.all([
      service
        .from("assets")
        .select("id, name, current_version_id")
        .eq("id", link.asset_id)
        .maybeSingle(),
      service
        .from("studios")
        .select("name")
        .eq("id", link.studio_id)
        .maybeSingle(),
      service
        .from("projects")
        .select("title")
        .eq("id", link.project_id)
        .maybeSingle(),
    ]);

  if (!asset) return null;

  const { data: versionsRaw } = await service
    .from("versions")
    .select("id, version_number, mime_type, size_bytes, notes, created_at")
    .eq("asset_id", asset.id)
    .order("version_number", { ascending: false });

  const versions = (versionsRaw ?? []) as PortalVersion[];
  const versionIds = versions.map((v) => v.id);

  const studioName = studio?.name ?? "The studio";

  let comments: PortalComment[] = [];
  let myDecision: ApprovalStatus | null = null;

  if (versionIds.length > 0) {
    const [{ data: commentsRaw }, { data: myApproval }] = await Promise.all([
      service
        .from("review_comments")
        .select(
          "id, version_id, body, created_at, author_id, reviewer_name, pin_number, pin_page, pos_x, pos_y, timecode, resolved_at, parent_id, drawing, timecode_end, author_key, edited_at"
        )
        .in("version_id", versionIds)
        .order("created_at", { ascending: true }),
      // The client's decision on the current version, made through this link.
      asset.current_version_id
        ? service
            .from("approvals")
            .select("status")
            .eq("target_type", "version")
            .eq("target_id", asset.current_version_id)
            .eq("review_link_id", link.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    comments = (commentsRaw ?? []).map((c) => {
      const isClient = Boolean(c.reviewer_name) && !c.author_id;
      return {
        id: c.id,
        version_id: c.version_id,
        body: c.body,
        created_at: c.created_at,
        author: isClient ? (c.reviewer_name as string) : studioName,
        isClient,
        pinNumber: c.pin_number ?? null,
        pinPage: c.pin_page ?? null,
        x: c.pos_x ?? null,
        y: c.pos_y ?? null,
        timecode: c.timecode ?? null,
        timecodeEnd: c.timecode_end ?? null,
        resolved: Boolean(c.resolved_at),
        parentId: c.parent_id ?? null,
        editedAt: c.edited_at ?? null,
        authorKey: c.author_key ?? null,
        reactions: [],
        drawing: normalizeDrawing(c.drawing),
      };
    });

    const reactions = await loadReactions(
      service,
      comments.map((c) => c.id),
      viewerKey ?? null
    );
    comments = comments.map((c) => ({
      ...c,
      reactions: reactions.get(c.id) ?? [],
    }));

    myDecision =
      (myApproval as { status?: ApprovalStatus } | null)?.status ?? null;
  }

  return {
    studioName,
    projectTitle: project?.title ?? "Project",
    asset: {
      id: asset.id,
      name: asset.name,
      currentVersionId: asset.current_version_id,
    },
    versions,
    comments,
    myDecision,
    dueDate: link.due_date ?? null,
  };
}

// ---- Doc review (shot list / storyboard / moodboard) ------------------------
// A link can target a whole doc surface instead of an asset version. The client
// sees a read-only render of the live doc and drops the same numbered pins.

export type DocKind =
  | "shot_list"
  | "storyboard"
  | "moodboard"
  | "ai_shot"
  | "sequence";

export function isDocKind(v: string | null | undefined): v is DocKind {
  return (
    v === "shot_list" ||
    v === "storyboard" ||
    v === "moodboard" ||
    v === "ai_shot" ||
    v === "sequence"
  );
}

export type DocShotCard = {
  id: string;
  code: string | null;
  day: string | null;
  description: string | null;
  shotSize: string | null;
  shotType: string | null;
  movement: string | null;
  signedUrl: string | null;
};
export type DocShotGroup = {
  id: string;
  title: string;
  subtitle: string | null;
  cards: DocShotCard[];
};
export type DocFrame = {
  id: string;
  scene: string | null;
  description: string | null;
  sound: string | null;
  notes: string | null;
  signedUrl: string | null;
};
export type DocMoodItem = {
  id: string;
  kind: string;
  name: string | null;
  text: string | null;
  hue: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  signedUrl: string | null;
};

// One picked piece of media on an AI shot: a start frame, end frame, or take.
export type DocShotMedia = {
  id: string;
  role: string; // start | end | take | final
  label: string; // "Start frame" | "End frame" | "Take"
  isVideo: boolean;
  signedUrl: string | null; // for display (image poster)
  openUrl: string | null; // full-size / video, opened in a new tab
  model: string | null;
};

export type DocSurface =
  | {
      kind: "shot_list";
      cover: { title: string | null; subtitle: string | null } | null;
      groups: DocShotGroup[];
    }
  | { kind: "storyboard"; frames: DocFrame[] }
  | { kind: "moodboard"; items: DocMoodItem[] }
  | {
      kind: "ai_shot";
      title: string;
      beat: string | null;
      frames: DocShotMedia[]; // start + end (images): reference + pin fallback
      take: DocShotMedia | null; // the picked take (usually video)
      takeVideoUrl: string | null; // playable take video -> timecode review
    }
  | {
      /**
       * The whole cut order. What a client is actually reviewing when they ask
       * for shots to be rearranged: each shot in position, showing its picked
       * take where one exists, so the order can be read at a glance.
       */
      kind: "sequence";
      shots: DocSequenceShot[];
    };

export type DocSequenceShot = {
  id: string;
  position: number;
  title: string;
  beat: string | null;
  /** Still to show: the take's poster, else the start frame. */
  posterUrl: string | null;
  /** Playable take, when there is one. */
  videoUrl: string | null;
  isVideo: boolean;
};

export type DocReviewData = {
  studioName: string;
  projectTitle: string;
  docTitle: string;
  kind: DocKind;
  surface: DocSurface;
  comments: PortalComment[];
  myDecision: ApprovalStatus | null;
  dueDate: string | null;
};

const DOC_SIGNED_TTL = 60 * 60;

async function signPaths(
  _client: SupabaseClient<Database>,
  paths: string[]
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const clean = paths.filter(Boolean);
  if (clean.length === 0) return signed;
  // Signed via assetStorage(), not the passed client. loadDocSurface serves
  // both the public portal (service client) and the internal RLS path, and on
  // the latter a project collaborator has no studio membership, so the
  // member-gated bucket policy would refuse to sign and every image would come
  // back blank. The rows themselves were already authorized by whichever client
  // read them, so this only bypasses the storage folder policy.
  const { data } = await assetStorage()
    .createSignedUrls(clean, DOC_SIGNED_TTL);
  for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  return signed;
}

// Assembles the read-only doc surface + its comments + this link's decision.
// Runs with the service client, so it only reads rows tied to the link's
// target_id / studio_id.
// Loads a read-only render of a doc surface + its display title. Works with any
// SupabaseClient (the service client for the public portal, or the RLS client
// for internal in-app review), so both review paths share one renderer.
export async function loadDocSurface(
  client: SupabaseClient<Database>,
  kind: DocKind,
  targetId: string
): Promise<{ surface: DocSurface; docTitle: string } | null> {
  if (kind === "shot_list") {
    // target_id = project id; the whole shot board (all lists).
    const [{ data: board }, { data: groups }] = await Promise.all([
      client
        .from("shot_boards")
        .select("title, subtitle")
        .eq("project_id", targetId)
        .maybeSingle(),
      client
        .from("shot_groups")
        .select("id, title, subtitle")
        .eq("project_id", targetId)
        .order("position", { ascending: true }),
    ]);
    const groupIds = (groups ?? []).map((g) => g.id);
    let cardRows: Array<Record<string, unknown>> = [];
    if (groupIds.length > 0) {
      const { data } = await client
        .from("shot_cards")
        .select(
          "id, group_id, position, code, day, description, shot_size, shot_type, movement, storage_path"
        )
        .in("group_id", groupIds)
        .order("position", { ascending: true });
      cardRows = (data ?? []) as Array<Record<string, unknown>>;
    }
    const signed = await signPaths(
      client,
      cardRows.map((c) => c.storage_path as string).filter(Boolean)
    );
    return {
      surface: {
        kind: "shot_list",
        cover: board ?? null,
        groups: (groups ?? []).map((g) => ({
          id: g.id,
          title: g.title || "Untitled list",
          subtitle: g.subtitle ?? null,
          cards: cardRows
            .filter((c) => c.group_id === g.id)
            .map((c) => ({
              id: c.id as string,
              code: (c.code as string) ?? null,
              day: (c.day as string) ?? null,
              description: (c.description as string) ?? null,
              shotSize: (c.shot_size as string) ?? null,
              shotType: (c.shot_type as string) ?? null,
              movement: (c.movement as string) ?? null,
              signedUrl: c.storage_path
                ? signed.get(c.storage_path as string) ?? null
                : null,
            })),
        })),
      },
      docTitle: board?.title || "Shot list",
    };
  }

  if (kind === "sequence") {
    // target_id = the project. A project has exactly one sequence, the same way
    // it has exactly one shot list.
    const { data: shots } = await client
      .from("ai_shots")
      .select("id, position, title, beat")
      .eq("project_id", targetId)
      .order("position", { ascending: true });
    if (!shots || shots.length === 0) return null;

    const { data: gens } = await client
      .from("ai_generations")
      .select("id, shot_id, role, kind, stage, file_path, external_url, thumb_url")
      .in(
        "shot_id",
        shots.map((s) => s.id)
      )
      .not("role", "is", null);

    const rows = gens ?? [];
    const signed = await signPaths(
      client,
      rows.map((g) => g.file_path as string).filter(Boolean)
    );

    const seqShots: DocSequenceShot[] = shots.map((s, i) => {
      const mine = rows.filter((g) => g.shot_id === s.id);
      const take =
        mine.find((g) => g.role === "take" || g.role === "final") ?? null;
      const start = mine.find((g) => g.role === "start") ?? null;
      const pick = take ?? start;
      const isVideo =
        Boolean(take) && (take!.kind === "video" || take!.stage === "video");
      const file = pick?.file_path ? signed.get(pick.file_path) ?? null : null;
      // A video's poster is its thumb; a still is the image itself. Falling
      // back to the start frame means a shot with no take still READS in the
      // order, which is the whole point of sending this.
      const posterUrl = isVideo
        ? pick?.thumb_url ?? null
        : file ?? pick?.external_url ?? null;
      const takeFile = take?.file_path ? signed.get(take.file_path) ?? null : null;
      return {
        id: s.id,
        position: i + 1,
        title: s.title || `Shot ${i + 1}`,
        beat: s.beat,
        posterUrl,
        // Only a stored file plays in a <video>; a share-page URL will not.
        videoUrl: isVideo ? takeFile : null,
        isVideo,
      };
    });

    return {
      surface: { kind: "sequence", shots: seqShots },
      docTitle: "Sequence",
    };
  }

  if (kind === "ai_shot") {
    // target_id = ai_shots.id; the reviewed surface is the shot's picked media
    // (start frame, end frame, take). Those are the ai_generations that carry a
    // role. Ordered start -> end -> take so it reads like the shot itself.
    const { data: shot } = await client
      .from("ai_shots")
      .select("title, beat")
      .eq("id", targetId)
      .maybeSingle();
    if (!shot) return null;
    const { data: gens } = await client
      .from("ai_generations")
      .select("id, role, kind, stage, file_path, external_url, thumb_url, model")
      .eq("shot_id", targetId)
      .not("role", "is", null);
    const rows = gens ?? [];
    const signed = await signPaths(
      client,
      rows.map((g) => g.file_path as string).filter(Boolean)
    );
    const LABEL: Record<string, string> = {
      start: "Start frame",
      end: "End frame",
      take: "Take",
      final: "Take",
    };
    const toMedia = (g: (typeof rows)[number]): DocShotMedia => {
      const isVideo = g.kind === "video" || g.stage === "video";
      const disp = g.file_path ? signed.get(g.file_path) ?? null : null;
      return {
        id: g.id,
        role: g.role as string,
        label: LABEL[g.role as string] ?? "Selected",
        isVideo,
        signedUrl: isVideo ? g.thumb_url ?? null : disp ?? g.external_url ?? null,
        openUrl: g.external_url ?? disp ?? null,
        model: g.model ?? null,
      };
    };
    const frames: DocShotMedia[] = rows
      .filter((g) => g.role === "start" || g.role === "end")
      .map(toMedia)
      .sort((a, b) => (a.role === "start" ? 0 : 1) - (b.role === "start" ? 0 : 1));
    const takeRow = rows.find((g) => g.role === "take" || g.role === "final") ?? null;
    const take = takeRow ? toMedia(takeRow) : null;
    // Prefer the stored (signed) file so the <video> element can actually play
    // it; a share-page external_url won't. Only offer video review for a take
    // that is a video and has a playable source.
    const takeSigned = takeRow?.file_path ? signed.get(takeRow.file_path) ?? null : null;
    const takeVideoUrl =
      take && take.isVideo ? takeSigned ?? takeRow?.external_url ?? null : null;
    return {
      surface: {
        kind: "ai_shot",
        title: shot.title || "Shot",
        beat: shot.beat,
        frames,
        take,
        takeVideoUrl,
      },
      docTitle: shot.title || "Shot",
    };
  }

  // storyboard | moodboard: target_id = boards.id
  const { data: boardRow } = await client
    .from("boards")
    .select("id, name")
    .eq("id", targetId)
    .maybeSingle();
  if (!boardRow) return null;
  const docTitle =
    boardRow.name || (kind === "storyboard" ? "Storyboard" : "Moodboard");

  if (kind === "storyboard") {
    const { data: frameRows } = await client
      .from("storyboard_frames")
      .select("id, scene, description, sound, notes, storage_path")
      .eq("board_id", targetId)
      .order("position", { ascending: true });
    const signed = await signPaths(
      client,
      (frameRows ?? []).map((f) => f.storage_path as string).filter(Boolean)
    );
    return {
      surface: {
        kind: "storyboard",
        frames: (frameRows ?? []).map((f) => ({
          id: f.id,
          scene: f.scene,
          description: f.description,
          sound: f.sound,
          notes: f.notes,
          signedUrl: f.storage_path ? signed.get(f.storage_path) ?? null : null,
        })),
      },
      docTitle,
    };
  }

  const { data: itemRows } = await client
    .from("board_items")
    .select("id, kind, name, mime_type, text, hue, x, y, w, h, z, storage_path, url")
    .eq("board_id", targetId)
    .order("z", { ascending: true });
  const signed = await signPaths(
    client,
    (itemRows ?? []).map((i) => i.storage_path as string).filter(Boolean)
  );
  return {
    surface: {
      kind: "moodboard",
      items: (itemRows ?? []).map((i) => ({
        id: i.id,
        kind: i.kind,
        name: i.name,
        text: i.text,
        hue: i.hue,
        x: i.x,
        y: i.y,
        w: i.w,
        h: i.h,
        z: i.z,
        signedUrl: i.storage_path ? signed.get(i.storage_path) ?? null : i.url,
      })),
    },
    docTitle,
  };
}

export async function gatherDocReview(
  service: SupabaseClient<Database>,
  link: ReviewLink,
  viewerKey?: string | null
): Promise<DocReviewData | null> {
  const kind = link.target_type;
  const targetId = link.target_id;
  if (!isDocKind(kind) || !targetId) return null;

  const [{ data: studio }, { data: project }] = await Promise.all([
    service.from("studios").select("name").eq("id", link.studio_id).maybeSingle(),
    service.from("projects").select("title").eq("id", link.project_id).maybeSingle(),
  ]);
  const studioName = studio?.name ?? "The studio";
  const projectTitle = project?.title ?? "Project";

  const loaded = await loadDocSurface(service, kind, targetId);
  if (!loaded) return null;
  const { surface, docTitle } = loaded;

  const [{ data: commentsRaw }, { data: myApproval }] = await Promise.all([
    service
      .from("review_comments")
      .select(
        "id, body, created_at, author_id, reviewer_name, pin_number, pin_page, pos_x, pos_y, timecode, resolved_at, parent_id, drawing, timecode_end, author_key, edited_at"
      )
      .eq("target_type", kind)
      .eq("target_id", targetId)
      .order("created_at", { ascending: true }),
    service
      .from("approvals")
      .select("status")
      .eq("target_type", kind)
      .eq("target_id", targetId)
      .eq("review_link_id", link.id)
      .maybeSingle(),
  ]);

  const comments: PortalComment[] = (commentsRaw ?? []).map((c) => {
    const isClient = Boolean(c.reviewer_name) && !c.author_id;
    return {
      id: c.id,
      version_id: null,
      body: c.body,
      created_at: c.created_at,
      author: isClient ? (c.reviewer_name as string) : studioName,
      isClient,
      pinNumber: c.pin_number ?? null,
      pinPage: c.pin_page ?? null,
      x: c.pos_x ?? null,
      y: c.pos_y ?? null,
      timecode: c.timecode ?? null,
      timecodeEnd: c.timecode_end ?? null,
      resolved: Boolean(c.resolved_at),
      parentId: c.parent_id ?? null,
      editedAt: c.edited_at ?? null,
      authorKey: c.author_key ?? null,
      reactions: [],
      drawing: normalizeDrawing(c.drawing),
    };
  });

  const reactionMap = await loadReactions(
    service,
    comments.map((c) => c.id),
    viewerKey ?? null
  );
  for (const c of comments) c.reactions = reactionMap.get(c.id) ?? [];

  const myDecision =
    (myApproval as { status?: ApprovalStatus } | null)?.status ?? null;

  return {
    studioName,
    projectTitle,
    docTitle,
    kind,
    surface,
    comments,
    myDecision,
    dueDate: link.due_date ?? null,
  };
}
