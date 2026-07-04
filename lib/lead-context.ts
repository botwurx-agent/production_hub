// Server-only: assemble a compact snapshot of a lead for AI outreach drafting.
// RLS on the passed client scopes reads to the studio.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { LEAD_STAGE } from "@/lib/status";
import { shortDate } from "@/lib/format";

export async function gatherLeadContext(
  supabase: SupabaseClient<Database>,
  leadId: string
): Promise<string | null> {
  const { data: lead } = await supabase
    .from("leads")
    .select("id, company, source, stage, notes")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return null;

  const [{ data: contacts }, { data: threads }, { count: slackCount }, { count: chatCount }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("name, role, email")
        .eq("lead_id", leadId)
        .order("created_at"),
      supabase
        .from("email_threads")
        .select("subject, last_message_at")
        .eq("lead_id", leadId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(8),
      supabase
        .from("slack_channels")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId),
      supabase
        .from("chat_spaces")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId),
    ]);

  const lines: string[] = [];
  lines.push(`Lead: ${lead.company}`);
  lines.push(`Source: ${lead.source || "unknown"}`);
  lines.push(`Pipeline stage: ${LEAD_STAGE[lead.stage].label}`);
  lines.push(`Notes: ${lead.notes?.trim() ? lead.notes.trim() : "(none)"}`);
  lines.push("");

  const contactList = contacts ?? [];
  lines.push(`Contacts (${contactList.length}):`);
  if (contactList.length === 0) lines.push("(no contacts captured)");
  for (const c of contactList) {
    const bits = [c.role, c.email].filter(Boolean).join(", ");
    lines.push(`- ${c.name}${bits ? ` (${bits})` : ""}`);
  }
  lines.push("");

  const threadList = threads ?? [];
  lines.push("Recent email threads (newest first):");
  if (threadList.length === 0) {
    lines.push("(no email yet with this lead)");
  } else {
    for (const t of threadList) {
      const when = t.last_message_at ? shortDate(t.last_message_at) : "";
      lines.push(`- ${t.subject || "(no subject)"}${when ? ` (last ${when})` : ""}`);
    }
  }
  lines.push("");
  lines.push(
    `Other linked conversations: ${slackCount ?? 0} Slack, ${chatCount ?? 0} Google Chat`
  );

  return lines.join("\n");
}
