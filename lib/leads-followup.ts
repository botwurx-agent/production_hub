import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage } from "@/lib/database.types";

/**
 * Follow-up flags for the pipeline: active leads that have gone quiet. A lead's
 * last touch is the later of when it was captured and its most recent linked
 * email; once that is older than the threshold it needs a nudge. Won, lost, and
 * converted leads are terminal and never flagged. RLS scopes to the studio.
 */
export const FOLLOWUP_DAYS = 7;
const DAY_MS = 86_400_000;

const ACTIVE_STAGES: LeadStage[] = ["new", "contacted", "qualified", "proposal"];

// Map of leadId -> whole days since last touch, for leads past the threshold.
export const getLeadFollowups = cache(
  async (): Promise<Record<string, number>> => {
    const supabase = createClient();
    const { data: leads } = await supabase
      .from("leads")
      .select("id, created_at, converted_client_id")
      .is("converted_client_id", null)
      .in("stage", ACTIVE_STAGES);
    const rows = leads ?? [];
    if (rows.length === 0) return {};

    const ids = rows.map((l) => l.id);
    const { data: threads } = await supabase
      .from("email_threads")
      .select("lead_id, last_message_at")
      .in("lead_id", ids);

    const lastEmail = new Map<string, number>();
    for (const t of threads ?? []) {
      if (!t.lead_id || !t.last_message_at) continue;
      const ms = Date.parse(t.last_message_at);
      if (ms > (lastEmail.get(t.lead_id) ?? 0)) lastEmail.set(t.lead_id, ms);
    }

    const now = Date.now();
    const out: Record<string, number> = {};
    for (const l of rows) {
      const created = l.created_at ? Date.parse(l.created_at) : 0;
      const lastTouch = Math.max(created, lastEmail.get(l.id) ?? 0);
      const days = Math.floor((now - lastTouch) / DAY_MS);
      if (days >= FOLLOWUP_DAYS) out[l.id] = days;
    }
    return out;
  }
);
