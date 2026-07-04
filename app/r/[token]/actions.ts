"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { getValidLink } from "@/lib/review-links";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReviewLink, ApprovalStatus } from "@/lib/database.types";

export type PortalState = { error?: string } | null;

// Confirms a version belongs to the link's asset before any write, so a client
// can only ever act on the asset they were given.
async function versionInLink(
  service: SupabaseClient<Database>,
  link: ReviewLink,
  versionId: string
): Promise<boolean> {
  const { data } = await service
    .from("versions")
    .select("id")
    .eq("id", versionId)
    .eq("asset_id", link.asset_id)
    .maybeSingle();
  return Boolean(data);
}

async function logActivity(
  service: SupabaseClient<Database>,
  link: ReviewLink,
  content: string
) {
  await service.from("activity").insert({
    studio_id: link.studio_id,
    project_id: link.project_id,
    type: "activity",
    content,
  });
}

export async function submitClientComment(
  token: string,
  versionId: string,
  name: string,
  body: string
): Promise<PortalState> {
  if (!serviceConfigured()) return { error: "Review portal is not configured." };
  const reviewer = name.trim();
  const text = body.trim();
  if (!reviewer) return { error: "Add your name first." };
  if (!text) return { error: "Write a comment first." };

  const service = createServiceClient();
  const link = await getValidLink(service, token);
  if (!link) return { error: "This review link is no longer active." };
  if (!(await versionInLink(service, link, versionId)))
    return { error: "That version is not part of this review." };

  const { error } = await service.from("review_comments").insert({
    studio_id: link.studio_id,
    version_id: versionId,
    review_link_id: link.id,
    reviewer_name: reviewer,
    body: text,
  });
  if (error) return { error: error.message };

  await logActivity(service, link, `${reviewer} commented in client review`);
  revalidatePath(`/r/${token}`);
  revalidatePath(`/projects/${link.project_id}`);
  return null;
}

export async function submitClientDecision(
  token: string,
  versionId: string,
  name: string,
  status: Extract<ApprovalStatus, "approved" | "changes_requested">
): Promise<PortalState> {
  if (!serviceConfigured()) return { error: "Review portal is not configured." };
  const reviewer = name.trim();
  if (!reviewer) return { error: "Add your name first." };

  const service = createServiceClient();
  const link = await getValidLink(service, token);
  if (!link) return { error: "This review link is no longer active." };
  if (!(await versionInLink(service, link, versionId)))
    return { error: "That version is not part of this review." };

  // One decision per link per version: update if it exists, else insert.
  const { data: existing } = await service
    .from("approvals")
    .select("id")
    .eq("target_type", "version")
    .eq("target_id", versionId)
    .eq("review_link_id", link.id)
    .maybeSingle();

  if (existing) {
    const { error } = await service
      .from("approvals")
      .update({ status, reviewer_name: reviewer })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await service.from("approvals").insert({
      studio_id: link.studio_id,
      target_type: "version",
      target_id: versionId,
      review_link_id: link.id,
      reviewer_name: reviewer,
      status,
    });
    if (error) return { error: error.message };
  }

  const label =
    status === "approved" ? "approved this asset" : "requested changes";
  await logActivity(service, link, `${reviewer} ${label} in client review`);
  revalidatePath(`/r/${token}`);
  revalidatePath(`/projects/${link.project_id}`);
  return null;
}
