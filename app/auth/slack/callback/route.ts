import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeSlackCode } from "@/lib/slack";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const settings = (q: string) =>
    NextResponse.redirect(new URL(`/settings?${q}`, origin));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("slack_oauth_state")?.value;

  if (url.searchParams.get("error")) return settings("error=slack_denied");
  if (!code || !state || state !== cookieState) {
    return settings("error=slack_state");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const { data: membership } = await supabase
    .from("memberships")
    .select("studio_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return settings("error=no_studio");

  let conn;
  try {
    conn = await exchangeSlackCode(code, `${origin}/auth/slack/callback`);
  } catch {
    return settings("error=slack_exchange");
  }

  const { error } = await supabase.from("email_accounts").upsert(
    {
      studio_id: membership.studio_id,
      user_id: user.id,
      provider: "slack",
      email: conn.teamName,
      access_token: conn.userToken,
      scope: conn.scope,
      external_ref: { team_id: conn.teamId, slack_user_id: conn.slackUserId },
    },
    { onConflict: "user_id,provider,email" }
  );
  if (error) return settings("error=slack_store");

  const response = settings("connected=slack");
  response.cookies.delete("slack_oauth_state");
  return response;
}
