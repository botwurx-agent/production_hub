import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Outstanding-action flags across the studio: the "needs you" surface that
 * keeps revision requests and pending sign-offs from getting lost. Computed
 * from the current version of each asset and its internal sign-offs. RLS
 * scopes everything to the caller's studio.
 */
export type OutstandingKind = "changes_requested" | "awaiting_review";

export type OutstandingItem = {
  projectId: string;
  projectTitle: string;
  assetId: string;
  assetName: string;
  versionNumber: number;
  kind: OutstandingKind;
};

export const getOutstanding = cache(async (): Promise<OutstandingItem[]> => {
  const supabase = createClient();

  const { data: assets } = await supabase
    .from("assets")
    .select(
      "id, name, status, current_version_id, project:projects(id, title), current:versions!assets_current_version_fk(version_number)"
    )
    .not("current_version_id", "is", null);

  const rows = assets ?? [];
  const versionIds = rows
    .map((a) => a.current_version_id)
    .filter((v): v is string => Boolean(v));
  if (versionIds.length === 0) return [];

  const { data: approvals } = await supabase
    .from("approvals")
    .select("target_id, status")
    .eq("target_type", "version")
    .in("target_id", versionIds);

  const byVersion = new Map<string, string[]>();
  for (const a of approvals ?? []) {
    const list = byVersion.get(a.target_id) ?? [];
    list.push(a.status);
    byVersion.set(a.target_id, list);
  }

  const items: OutstandingItem[] = [];
  for (const a of rows) {
    const project = a.project as { id: string; title: string } | null;
    const current = a.current as { version_number: number } | null;
    if (!project || !current || !a.current_version_id) continue;
    const statuses = byVersion.get(a.current_version_id) ?? [];

    let kind: OutstandingKind | null = null;
    if (statuses.includes("changes_requested")) {
      kind = "changes_requested";
    } else if (a.status === "in_review" && statuses.length === 0) {
      kind = "awaiting_review";
    }
    if (!kind) continue;

    items.push({
      projectId: project.id,
      projectTitle: project.title,
      assetId: a.id,
      assetName: a.name,
      versionNumber: current.version_number,
      kind,
    });
  }

  // Revision requests first (most actionable), then awaiting sign-off.
  return items.sort((x, y) =>
    x.kind === y.kind ? 0 : x.kind === "changes_requested" ? -1 : 1
  );
});
