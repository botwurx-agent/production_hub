// Server-only: assemble a compact, factual snapshot of a project's state for
// the AI layer. RLS on the passed client scopes every read to the studio.
// This is the shared "gather project context" step the AI features build on.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  PROJECT_STATUS,
  ASSET_STATUS,
  ASSET_TYPE_LABEL,
  APPROVAL_STATUS,
} from "@/lib/status";
import { shortDate } from "@/lib/format";

export async function gatherProjectContext(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<string | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, status, due_date, shoot_date, client:clients(name)")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const [
    { data: brief },
    { data: assets },
    { data: activity },
    { count: emailCount },
    { count: slackCount },
    { count: chatCount },
  ] = await Promise.all([
    supabase
      .from("briefs")
      .select("content")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("assets")
      .select(
        "id, name, type, status, current_version_id, versions:versions!versions_asset_id_fkey(id, version_number, notes, created_at)"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .order("version_number", { referencedTable: "versions", ascending: false }),
    supabase
      .from("activity")
      .select("content, type, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("email_threads")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("slack_channels")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("chat_spaces")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  // Review state on the current version of each asset.
  const currentVersionIds = (assets ?? [])
    .map((a) => a.current_version_id)
    .filter((id): id is string => Boolean(id));
  const approvalsByVersion = new Map<string, string[]>();
  const commentsByVersion = new Map<string, number>();
  if (currentVersionIds.length > 0) {
    const [{ data: approvals }, { data: comments }] = await Promise.all([
      supabase
        .from("approvals")
        .select("status, target_id")
        .eq("target_type", "version")
        .in("target_id", currentVersionIds),
      supabase
        .from("review_comments")
        .select("version_id")
        .in("version_id", currentVersionIds),
    ]);
    for (const a of approvals ?? []) {
      const list = approvalsByVersion.get(a.target_id) ?? [];
      list.push(a.status);
      approvalsByVersion.set(a.target_id, list);
    }
    for (const c of comments ?? []) {
      commentsByVersion.set(
        c.version_id,
        (commentsByVersion.get(c.version_id) ?? 0) + 1
      );
    }
  }

  const lines: string[] = [];
  const clientName =
    (project.client as { name: string } | null)?.name ?? "No client set";
  lines.push(`Project: ${project.title}`);
  lines.push(`Client: ${clientName}`);
  lines.push(`Stage: ${PROJECT_STATUS[project.status].label}`);
  lines.push(
    `Shoot date: ${project.shoot_date ? shortDate(project.shoot_date) : "not set"}`
  );
  lines.push(
    `Due date: ${project.due_date ? shortDate(project.due_date) : "not set"}`
  );
  lines.push(
    `Linked conversations: ${emailCount ?? 0} email, ${slackCount ?? 0} Slack, ${chatCount ?? 0} Google Chat`
  );
  lines.push("");

  lines.push("Brief:");
  lines.push(brief?.content?.trim() ? brief.content.trim() : "(no brief written yet)");
  lines.push("");

  const assetList = assets ?? [];
  lines.push(`Assets (${assetList.length}):`);
  if (assetList.length === 0) lines.push("(no assets uploaded yet)");
  for (const a of assetList) {
    const versions = a.versions ?? [];
    const typeLabel = ASSET_TYPE_LABEL[a.type] ?? a.type;
    const statusLabel = ASSET_STATUS[a.status]?.label ?? a.status;
    let line = `- ${a.name} (${typeLabel}), status: ${statusLabel}, ${versions.length} version${versions.length === 1 ? "" : "s"}`;
    const latest = versions[0];
    if (latest?.created_at) {
      line += `, latest v${latest.version_number} on ${shortDate(latest.created_at)}`;
    }
    if (latest?.notes?.trim()) line += `, note: "${latest.notes.trim()}"`;
    const cv = a.current_version_id;
    if (cv) {
      const appr = approvalsByVersion.get(cv) ?? [];
      if (appr.length > 0) {
        const counts: Record<string, number> = {};
        for (const s of appr) counts[s] = (counts[s] ?? 0) + 1;
        const parts = Object.entries(counts).map(
          ([s, n]) =>
            `${n} ${APPROVAL_STATUS[s as keyof typeof APPROVAL_STATUS]?.label ?? s}`
        );
        line += `, internal review: ${parts.join(", ")}`;
      }
      const cc = commentsByVersion.get(cv) ?? 0;
      if (cc > 0) line += `, ${cc} comment${cc === 1 ? "" : "s"}`;
    }
    lines.push(line);
  }
  lines.push("");

  const activityList = activity ?? [];
  lines.push("Recent activity (newest first):");
  if (activityList.length === 0) lines.push("(no activity logged yet)");
  for (const ev of activityList) {
    lines.push(
      `- [${ev.created_at ? shortDate(ev.created_at) : ""}] ${ev.content}`
    );
  }

  return lines.join("\n");
}
