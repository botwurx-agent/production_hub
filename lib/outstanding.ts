import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Outstanding-action flags across the studio: the "needs you" surface that
 * keeps revision requests, pending sign-offs, and un-reviewed assets from
 * getting lost. Computed from the current version of each asset and its
 * internal sign-offs. Each item carries how long it has been waiting, and is
 * marked "stalled" once it crosses the threshold, so the ones going cold rise
 * to the top. RLS scopes everything to the caller's studio.
 */

// Days an item can wait before it counts as stalled (needs a nudge).
export const STALL_DAYS = 4;

const DAY_MS = 86_400_000;

export type OutstandingKind =
  | "changes_requested"
  | "pending_signoff"
  | "awaiting_review";

export type OutstandingItem = {
  projectId: string;
  projectTitle: string;
  assetId: string;
  assetName: string;
  versionNumber: number;
  kind: OutstandingKind;
  days: number; // how long it has been waiting, in whole days
  stalled: boolean; // days >= STALL_DAYS
};

const PRIORITY: Record<OutstandingKind, number> = {
  changes_requested: 0,
  pending_signoff: 1,
  awaiting_review: 2,
};

async function fetchOutstanding(
  projectId?: string
): Promise<OutstandingItem[]> {
  const supabase = createClient();

  let query = supabase
    .from("assets")
    .select(
      "id, name, status, current_version_id, project:projects(id, title), current:versions!assets_current_version_fk(version_number, created_at)"
    )
    .not("current_version_id", "is", null);
  if (projectId) query = query.eq("project_id", projectId);
  const { data: assets } = await query;

  const rows = assets ?? [];
  const versionIds = rows
    .map((a) => a.current_version_id)
    .filter((v): v is string => Boolean(v));
  if (versionIds.length === 0) return [];

  const { data: approvals } = await supabase
    .from("approvals")
    .select("target_id, status, created_at")
    .eq("target_type", "version")
    .in("target_id", versionIds);

  // Latest (most recent) approval timestamp per version per status.
  const byVersion = new Map<string, { status: string; created_at: string }[]>();
  for (const a of approvals ?? []) {
    const list = byVersion.get(a.target_id) ?? [];
    list.push({ status: a.status, created_at: a.created_at });
    byVersion.set(a.target_id, list);
  }

  const now = Date.now();
  const items: OutstandingItem[] = [];

  for (const a of rows) {
    const project = a.project as { id: string; title: string } | null;
    const current = a.current as
      | { version_number: number; created_at: string }
      | null;
    if (!project || !current || !a.current_version_id) continue;
    const approvalsForVersion = byVersion.get(a.current_version_id) ?? [];

    // Pick the outstanding state and the moment it started waiting.
    let kind: OutstandingKind | null = null;
    let since: number | null = null;

    const changes = approvalsForVersion.filter(
      (x) => x.status === "changes_requested"
    );
    const pending = approvalsForVersion.filter((x) => x.status === "pending");

    if (changes.length > 0) {
      kind = "changes_requested";
      since = Math.min(...changes.map((x) => Date.parse(x.created_at)));
    } else if (pending.length > 0) {
      kind = "pending_signoff";
      since = Math.min(...pending.map((x) => Date.parse(x.created_at)));
    } else if (a.status === "in_review" && approvalsForVersion.length === 0) {
      kind = "awaiting_review";
      since = Date.parse(current.created_at);
    }
    if (!kind || since === null || Number.isNaN(since)) continue;

    const days = Math.max(0, Math.floor((now - since) / DAY_MS));
    items.push({
      projectId: project.id,
      projectTitle: project.title,
      assetId: a.id,
      assetName: a.name,
      versionNumber: current.version_number,
      kind,
      days,
      stalled: days >= STALL_DAYS,
    });
  }

  // Stalled first, then by kind priority (revisions > pending > awaiting),
  // then oldest first.
  return items.sort((x, y) => {
    if (x.stalled !== y.stalled) return x.stalled ? -1 : 1;
    if (PRIORITY[x.kind] !== PRIORITY[y.kind])
      return PRIORITY[x.kind] - PRIORITY[y.kind];
    return y.days - x.days;
  });
}

export const getOutstanding = cache((): Promise<OutstandingItem[]> =>
  fetchOutstanding()
);

export const getProjectOutstanding = cache(
  (projectId: string): Promise<OutstandingItem[]> => fetchOutstanding(projectId)
);
