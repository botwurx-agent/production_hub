"use server";

import { revalidatePath } from "next/cache";
import { createClient as db } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { DEAL_STAGE_ORDER } from "@/lib/status";
import type { DealStage } from "@/lib/database.types";

export type FormState = { error?: string } | null;

function isStage(v: unknown): v is DealStage {
  return DEAL_STAGE_ORDER.includes(v as DealStage);
}

// Parse a money-ish string ("$85,000", "85000") into a number, or null.
function parseValue(raw: unknown): number | null {
  const s = String(raw ?? "").replace(/[^0-9.]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Side effects of a stage change: awarded closes + activates the account, lost
// closes, moving back to an open stage clears the close. Returns the patch.
function stagePatch(stage: DealStage): {
  stage: DealStage;
  closed_at: string | null;
} {
  const terminal = stage === "awarded" || stage === "lost";
  return { stage, closed_at: terminal ? new Date().toISOString() : null };
}

export async function createDeal(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const ctx = await requireStudioContext();
  const supabase = db();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "A deal title is required." };

  const stageRaw = String(formData.get("stage") ?? "inbound");
  const stage: DealStage = isStage(stageRaw) ? stageRaw : "inbound";

  // Account: an existing one, or a new prospect created inline from a name.
  let accountId = String(formData.get("account_id") ?? "").trim();
  const newAccount = String(formData.get("new_account") ?? "").trim();
  if (!accountId) {
    if (!newAccount) return { error: "Pick a company or add a new one." };
    const { data: account, error } = await supabase
      .from("clients")
      .insert({
        studio_id: ctx.studio.id,
        name: newAccount,
        account_status: "prospect",
        owner_id: ctx.userId,
      })
      .select("id")
      .single();
    if (error || !account) return { error: error?.message ?? "Could not add company." };
    accountId = account.id;
  }

  const { error } = await supabase.from("deals").insert({
    studio_id: ctx.studio.id,
    account_id: accountId,
    title,
    value: parseValue(formData.get("value")),
    expected_close_date:
      String(formData.get("expected_close_date") ?? "").trim() || null,
    source: String(formData.get("source") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    owner_id: ctx.userId,
    ...stagePatch(stage),
  });
  if (error) return { error: error.message };

  revalidatePath("/pipeline");
  return null;
}

export async function updateDealStage(dealId: string, stage: DealStage) {
  await requireStudioContext();
  if (!isStage(stage)) return;
  const supabase = db();

  const patch = stagePatch(stage);
  await supabase.from("deals").update(patch).eq("id", dealId);

  // Winning a deal activates its account (a prospect becomes a client).
  if (stage === "awarded") {
    const { data: deal } = await supabase
      .from("deals")
      .select("account_id")
      .eq("id", dealId)
      .maybeSingle();
    if (deal?.account_id) {
      await supabase
        .from("clients")
        .update({ account_status: "active" })
        .eq("id", deal.account_id)
        .eq("account_status", "prospect");
    }
  }

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${dealId}`);
}

export async function markDealLost(dealId: string, reason: string) {
  await requireStudioContext();
  const supabase = db();
  await supabase
    .from("deals")
    .update({
      ...stagePatch("lost"),
      lost_reason: reason.trim() || null,
    })
    .eq("id", dealId);
  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${dealId}`);
}

// Edit a deal's core fields from the detail page.
export async function updateDeal(
  dealId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireStudioContext();
  const supabase = db();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "A deal title is required." };

  const { error } = await supabase
    .from("deals")
    .update({
      title,
      value: parseValue(formData.get("value")),
      expected_close_date:
        String(formData.get("expected_close_date") ?? "").trim() || null,
      source: String(formData.get("source") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", dealId);
  if (error) return { error: error.message };

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${dealId}`);
  return null;
}

export async function deleteDeal(dealId: string) {
  await requireStudioContext();
  const supabase = db();
  await supabase.from("deals").delete().eq("id", dealId);
  revalidatePath("/pipeline");
}
