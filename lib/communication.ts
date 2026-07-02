import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  getAccessToken,
  countNewIncoming as countNewGmail,
} from "@/lib/gmail";
import { countNewIncoming as countNewSlack } from "@/lib/slack";

// Cap how many conversations we poll per provider so the badge stays cheap.
const MAX_CONVERSATIONS = 60;

// Total incoming messages that arrived after each linked conversation was last
// opened in the Hub (email + Slack), across the caller's studio. RLS scopes the
// reads to the studio; a provider that is disconnected or erroring contributes
// nothing rather than breaking the whole count.
export async function getUnreadTotal(): Promise<number> {
  const supabase = createClient();

  const [
    { data: threads },
    { data: channels },
    { data: googleAccount },
    { data: slackAccount },
  ] = await Promise.all([
    supabase
      .from("email_threads")
      .select("gmail_thread_id, last_read_at")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(MAX_CONVERSATIONS),
    supabase
      .from("slack_channels")
      .select("slack_channel_id, last_read_at")
      .order("created_at", { ascending: false })
      .limit(MAX_CONVERSATIONS),
    supabase
      .from("email_accounts")
      .select("id, access_token, refresh_token, token_expiry")
      .eq("provider", "google")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("email_accounts")
      .select("access_token, external_ref")
      .eq("provider", "slack")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  let total = 0;

  // Email: one lean threads.get per linked thread.
  if (googleAccount?.access_token && (threads?.length ?? 0) > 0) {
    try {
      const token = await getAccessToken(supabase, googleAccount);
      const counts = await Promise.all(
        (threads ?? []).map((t) =>
          countNewGmail(
            token,
            t.gmail_thread_id,
            t.last_read_at ? Date.parse(t.last_read_at) : 0
          ).catch(() => 0)
        )
      );
      total += counts.reduce((a, b) => a + b, 0);
    } catch {
      // Gmail unavailable (token/scope); contribute nothing.
    }
  }

  // Slack: one conversations.history per linked channel, since last read.
  if (slackAccount?.access_token && (channels?.length ?? 0) > 0) {
    const myUserId =
      (slackAccount.external_ref as { slack_user_id?: string } | null)
        ?.slack_user_id ?? "";
    const token = slackAccount.access_token;
    const counts = await Promise.all(
      (channels ?? []).map((c) =>
        countNewSlack(
          token,
          c.slack_channel_id,
          c.last_read_at ? (Date.parse(c.last_read_at) / 1000).toFixed(6) : "",
          myUserId
        ).catch(() => 0)
      )
    );
    total += counts.reduce((a, b) => a + b, 0);
  }

  return total;
}
