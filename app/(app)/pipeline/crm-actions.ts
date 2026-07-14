"use server";

import { revalidatePath } from "next/cache";
import { createClient as db } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { CRM_MANUAL_ACTIVITY } from "@/lib/status";
import type { CrmActivityKind } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// An activity/task always carries account_id so an account rolls up its deals'
// entries. When logged on a deal, derive the account from the deal.
async function resolveAccount(
  supabase: SupabaseClient<Database>,
  dealId: string | null,
  accountId: string | null
): Promise<string | null> {
  if (accountId) return accountId;
  if (!dealId) return null;
  const { data } = await supabase
    .from("deals")
    .select("account_id")
    .eq("id", dealId)
    .maybeSingle();
  return data?.account_id ?? null;
}

function refresh(dealId: string | null, accountId: string | null) {
  if (dealId) revalidatePath(`/pipeline/${dealId}`);
  if (accountId) revalidatePath(`/clients/${accountId}`);
  revalidatePath("/dashboard");
}

// --- Activity timeline -------------------------------------------------------

export async function logActivity(input: {
  dealId?: string | null;
  accountId?: string | null;
  kind: CrmActivityKind;
  body: string;
}) {
  const ctx = await requireStudioContext();
  const supabase = db();
  const kind = CRM_MANUAL_ACTIVITY.includes(input.kind) ? input.kind : "note";
  const body = input.body.trim();
  if (!body) return;

  const accountId = await resolveAccount(
    supabase,
    input.dealId ?? null,
    input.accountId ?? null
  );

  await supabase.from("crm_activities").insert({
    studio_id: ctx.studio.id,
    account_id: accountId,
    deal_id: input.dealId ?? null,
    kind,
    body,
    author_id: ctx.userId,
  });
  refresh(input.dealId ?? null, accountId);
}

export async function deleteActivity(
  id: string,
  dealId: string | null,
  accountId: string | null
) {
  await requireStudioContext();
  const supabase = db();
  await supabase.from("crm_activities").delete().eq("id", id);
  refresh(dealId, accountId);
}

// Emitted by pipeline actions for system events (stage changes, won, lost).
// Server-internal (no auth check of its own; callers are already gated).
export async function recordDealEvent(
  supabase: SupabaseClient<Database>,
  studioId: string,
  userId: string,
  dealId: string,
  accountId: string | null,
  kind: CrmActivityKind,
  body: string
) {
  await supabase.from("crm_activities").insert({
    studio_id: studioId,
    account_id: accountId,
    deal_id: dealId,
    kind,
    body,
    author_id: userId,
  });
}

// --- Tasks / reminders -------------------------------------------------------

export async function addTask(input: {
  dealId?: string | null;
  accountId?: string | null;
  title: string;
  dueDate?: string | null;
}) {
  const ctx = await requireStudioContext();
  const supabase = db();
  const title = input.title.trim();
  if (!title) return;

  const accountId = await resolveAccount(
    supabase,
    input.dealId ?? null,
    input.accountId ?? null
  );

  await supabase.from("crm_tasks").insert({
    studio_id: ctx.studio.id,
    account_id: accountId,
    deal_id: input.dealId ?? null,
    title,
    due_date: input.dueDate?.trim() || null,
    assignee_id: ctx.userId,
    created_by: ctx.userId,
  });
  refresh(input.dealId ?? null, accountId);
}

export async function toggleTask(
  id: string,
  done: boolean,
  dealId: string | null,
  accountId: string | null
) {
  await requireStudioContext();
  const supabase = db();
  await supabase
    .from("crm_tasks")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  refresh(dealId, accountId);
}

export async function deleteTask(
  id: string,
  dealId: string | null,
  accountId: string | null
) {
  await requireStudioContext();
  const supabase = db();
  await supabase.from("crm_tasks").delete().eq("id", id);
  refresh(dealId, accountId);
}
