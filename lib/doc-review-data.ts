import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ApprovalStatus } from "@/lib/database.types";
import {
  loadDocSurface,
  isDocKind,
  type DocKind,
  type DocSurface,
  type PortalComment,
} from "@/lib/review-links";

// A doc currently in the internal review cycle, summarized for the Review page.
export type DocReviewSummary = {
  id: string;
  kind: DocKind;
  targetId: string;
  title: string;
  status: string; // in_review | needs_changes | approved
  commentCount: number;
  openCount: number;
  approvedBy: number; // internal team sign-offs
  changesBy: number;
  clientDecision: ApprovalStatus | null;
  shareToken: string | null;
  shareLinkId: string | null;
};

const KIND_FALLBACK: Record<DocKind, string> = {
  shot_list: "Shot list",
  storyboard: "Storyboard",
  moodboard: "Moodboard",
};

// All docs in review for a project, with the counts the Review card shows.
export async function loadDocReviewsForProject(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<DocReviewSummary[]> {
  const { data: rows } = await supabase
    .from("doc_reviews")
    .select("id, target_type, target_id, status, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const reviews = (rows ?? []).filter((r) => isDocKind(r.target_type));
  if (reviews.length === 0) return [];

  const targetIds = reviews.map((r) => r.target_id);
  const boardIds = reviews
    .filter((r) => r.target_type !== "shot_list")
    .map((r) => r.target_id);

  const [
    { data: boards },
    { data: shotBoard },
    { data: comments },
    { data: approvals },
    { data: links },
  ] = await Promise.all([
    boardIds.length
      ? supabase.from("boards").select("id, name").in("id", boardIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase
      .from("shot_boards")
      .select("title")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("review_comments")
      .select("target_id, resolved_at")
      .in("target_id", targetIds),
    supabase
      .from("approvals")
      .select("target_id, status, review_link_id, reviewer_user_id, created_at")
      .in("target_id", targetIds),
    supabase
      .from("review_links")
      .select("id, target_id, token, created_at")
      .in("target_id", targetIds)
      .eq("revoked", false)
      .order("created_at", { ascending: false }),
  ]);

  const boardName = new Map((boards ?? []).map((b) => [b.id, b.name]));
  const shareByTarget = new Map<string, { id: string; token: string }>();
  for (const l of links ?? []) {
    if (l.target_id && !shareByTarget.has(l.target_id))
      shareByTarget.set(l.target_id, { id: l.id, token: l.token });
  }

  return reviews.map((r) => {
    const kind = r.target_type as DocKind;
    const title =
      kind === "shot_list"
        ? shotBoard?.title || "Shot list"
        : boardName.get(r.target_id) || KIND_FALLBACK[kind];

    const myComments = (comments ?? []).filter((c) => c.target_id === r.target_id);
    const myApprovals = (approvals ?? []).filter((a) => a.target_id === r.target_id);
    const client = myApprovals
      .filter((a) => a.review_link_id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    const internal = myApprovals.filter((a) => a.reviewer_user_id);
    const share = shareByTarget.get(r.target_id) ?? null;

    return {
      id: r.id,
      kind,
      targetId: r.target_id,
      title,
      status: r.status,
      commentCount: myComments.length,
      openCount: myComments.filter((c) => !c.resolved_at).length,
      approvedBy: internal.filter((a) => a.status === "approved").length,
      changesBy: internal.filter((a) => a.status === "changes_requested").length,
      clientDecision: (client?.status as ApprovalStatus) ?? null,
      shareToken: share?.token ?? null,
      shareLinkId: share?.id ?? null,
    };
  });
}

export type DocReviewDetail = {
  kind: DocKind;
  docTitle: string;
  surface: DocSurface;
  comments: PortalComment[];
  myDecision: ApprovalStatus | null;
};

// Everything the in-app (internal) review modal needs: the live surface plus the
// shared comment stream (team + client) and the current user's own sign-off.
export async function loadDocReviewDetail(
  supabase: SupabaseClient<Database>,
  kind: DocKind,
  targetId: string,
  userId: string
): Promise<DocReviewDetail | null> {
  const loaded = await loadDocSurface(supabase, kind, targetId);
  if (!loaded) return null;

  const [{ data: commentsRaw }, { data: mine }] = await Promise.all([
    supabase
      .from("review_comments")
      .select(
        "id, body, created_at, author_id, reviewer_name, pin_number, pos_x, pos_y, timecode, resolved_at"
      )
      .eq("target_type", kind)
      .eq("target_id", targetId)
      .order("created_at", { ascending: true }),
    supabase
      .from("approvals")
      .select("status")
      .eq("target_type", kind)
      .eq("target_id", targetId)
      .eq("reviewer_user_id", userId)
      .maybeSingle(),
  ]);

  const comments: PortalComment[] = (commentsRaw ?? []).map((c) => {
    const isClient = Boolean(c.reviewer_name) && !c.author_id;
    return {
      id: c.id,
      version_id: null,
      body: c.body,
      created_at: c.created_at,
      author: isClient ? (c.reviewer_name as string) : "Team",
      isClient,
      pinNumber: c.pin_number ?? null,
      x: c.pos_x ?? null,
      y: c.pos_y ?? null,
      timecode: c.timecode ?? null,
      resolved: Boolean(c.resolved_at),
    };
  });

  return {
    kind,
    docTitle: loaded.docTitle,
    surface: loaded.surface,
    comments,
    myDecision: (mine as { status?: ApprovalStatus } | null)?.status ?? null,
  };
}
