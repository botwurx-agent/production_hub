import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildSlackAuthUrl, slackConfigured } from "@/lib/slack";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  if (!slackConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?error=slack_not_configured", origin)
    );
  }

  const redirectUri = `${origin}/auth/slack/callback`;
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(buildSlackAuthUrl(redirectUri, state));
  response.cookies.set("slack_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
