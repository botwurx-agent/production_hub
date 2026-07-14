import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AssetStatus } from "@/lib/database.types";

// Statuses that mean "in the review cycle" (shown on the Review page).
const CYCLE: AssetStatus[] = ["in_review", "needs_changes", "approved"];

// Keep an asset's status in sync with the sign-off decisions on its CURRENT
// version, so the status-filtered Review page always reflects the approval
// rows the hub reads. Any changes-requested decision -> needs_changes; else any
// approval -> approved; else in_review (but a never-reviewed draft with no
// decisions is left alone). No-op when the version is not the asset's current.
// Works with either the RLS client or the service client (same query API).
export async function syncAssetStatusFromApprovals(
  client: SupabaseClient<Database>,
  versionId: string
): Promise<void> {
  const { data: version } = await client
    .from("versions")
    .select("asset_id")
    .eq("id", versionId)
    .maybeSingle();
  if (!version?.asset_id) return;

  const { data: asset } = await client
    .from("assets")
    .select("id, status, current_version_id")
    .eq("id", version.asset_id)
    .maybeSingle();
  if (!asset || asset.current_version_id !== versionId) return;

  const { data: approvals } = await client
    .from("approvals")
    .select("status")
    .eq("target_type", "version")
    .eq("target_id", versionId);
  const list = approvals ?? [];
  const hasChanges = list.some((a) => a.status === "changes_requested");
  const hasApproved = list.some((a) => a.status === "approved");

  let next: AssetStatus;
  if (hasChanges) next = "needs_changes";
  else if (hasApproved) next = "approved";
  else if (CYCLE.includes(asset.status)) next = "in_review";
  else next = asset.status; // no decisions left: leave a draft as a draft

  if (next !== asset.status) {
    await client.from("assets").update({ status: next }).eq("id", asset.id);
  }
}
