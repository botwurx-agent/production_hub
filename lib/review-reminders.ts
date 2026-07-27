import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { sendEmail, emailConfigured } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";

// Daily auto-reminder for overdue client reviews. Finds review links that carry
// a recipient + a passed due date, that the client has not yet responded to
// (no approval via the link), and emails a nudge. Capped and rate-limited per
// link so no one gets spammed. Runs with the service client (RLS bypassed), so
// it only ever reads rows keyed by the link.

const REMINDER_CAP = 3; // stop after this many nudges
const MIN_GAP_MS = 2 * 24 * 60 * 60 * 1000; // at most one nudge every 2 days

const DOC_NOUN: Record<string, string> = {
  shot_list: "shot list",
  storyboard: "storyboard",
  moodboard: "moodboard",
  ai_shot: "shot",
};

// Has the client closed out the round this link is currently pointing at?
// For an asset link that means a decision on the asset's CURRENT version, so a
// new version reopens the round (the client portal scopes its own "you already
// decided" state the same way). Doc links have no versions, so any decision
// through the link ends it.
async function respondedThisRound(
  service: SupabaseClient<Database>,
  link: {
    id: string;
    asset_id: string | null;
    target_type: string | null;
  }
): Promise<boolean> {
  if (!link.target_type && link.asset_id) {
    const { data: asset } = await service
      .from("assets")
      .select("current_version_id")
      .eq("id", link.asset_id)
      .maybeSingle();
    // No version to look at yet: nothing to nudge about.
    if (!asset?.current_version_id) return true;
    const { data } = await service
      .from("approvals")
      .select("id")
      .eq("review_link_id", link.id)
      .eq("target_type", "version")
      .eq("target_id", asset.current_version_id)
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  }

  const { data } = await service
    .from("approvals")
    .select("id")
    .eq("review_link_id", link.id)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function runReviewReminders(
  service: SupabaseClient<Database>
): Promise<{ sent: number; skipped: number }> {
  if (!emailConfigured()) return { sent: 0, skipped: 0 };
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!origin) return { sent: 0, skipped: 0 };

  const todayKey = new Date().toISOString().slice(0, 10);

  const { data: links } = await service
    .from("review_links")
    .select(
      "id, token, recipient, due_date, last_reminded_at, reminder_count, target_type, target_id, asset_id, project_id, studio_id"
    )
    .eq("revoked", false)
    .not("recipient", "is", null)
    .not("due_date", "is", null)
    .lt("due_date", todayKey)
    .lt("reminder_count", REMINDER_CAP);

  if (!links?.length) return { sent: 0, skipped: 0 };

  const now = Date.now();
  let sent = 0;
  let skipped = 0;

  for (const link of links) {
    if (
      link.last_reminded_at &&
      now - Date.parse(link.last_reminded_at) < MIN_GAP_MS
    ) {
      skipped++;
      continue;
    }

    // Client already responded through this link? Then the round is done.
    // An asset link is scoped to the CURRENT version, matching the portal: a
    // decision on v1 must not silence the reminders for v2.
    const responded = await respondedThisRound(service, link);
    if (responded) {
      skipped++;
      continue;
    }

    const [{ data: studio }, { data: project }] = await Promise.all([
      service.from("studios").select("name").eq("id", link.studio_id).maybeSingle(),
      service.from("projects").select("title").eq("id", link.project_id).maybeSingle(),
    ]);
    const studioName = studio?.name ?? "The studio";
    const projectTitle = project?.title ?? "a project";
    const noun = link.target_type ? DOC_NOUN[link.target_type] ?? "review" : "review";
    const url = `${origin}/r/${link.token}`;

    const { html, text } = renderEmail({
      heading: `Reminder: your ${noun} is waiting`,
      lines: [
        `${studioName} is still waiting on your feedback for ${projectTitle}.`,
        "Please open it below to review and approve or request changes.",
      ],
      ctaLabel: `View ${noun}`,
      ctaUrl: url,
    });

    const res = await sendEmail({
      to: link.recipient as string,
      subject: `Reminder: ${studioName} needs your review`,
      html,
      text,
    });

    if (res.ok) {
      await service
        .from("review_links")
        .update({
          last_reminded_at: new Date().toISOString(),
          reminder_count: (link.reminder_count ?? 0) + 1,
        })
        .eq("id", link.id);
      sent++;
    } else {
      skipped++;
    }
  }

  return { sent, skipped };
}
