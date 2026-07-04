import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForTokens,
  emailFromIdToken,
  subFromIdToken,
} from "@/lib/google";

// Completes the Google OAuth flow: exchanges the code, then stores the
// connected account + tokens against the signed-in user's studio.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const settings = (q: string) =>
    NextResponse.redirect(new URL(`/settings?${q}`, origin));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("g_oauth_state")?.value;

  if (url.searchParams.get("error")) {
    return settings("error=google_denied");
  }
  if (!code || !state || state !== cookieState) {
    return settings("error=google_state");
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

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, `${origin}/auth/google/callback`);
  } catch {
    return settings("error=google_exchange");
  }

  const email = emailFromIdToken(tokens.id_token);
  if (!email) return settings("error=google_email");
  const googleUserId = subFromIdToken(tokens.id_token);

  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const { error } = await supabase.from("email_accounts").upsert(
    {
      studio_id: membership.studio_id,
      user_id: user.id,
      provider: "google",
      email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry: expiry,
      scope: tokens.scope,
      external_ref: googleUserId ? { user_id: googleUserId } : null,
    },
    { onConflict: "user_id,provider,email" }
  );
  if (error) return settings("error=google_store");

  const response = settings("connected=1");
  response.cookies.delete("g_oauth_state");
  return response;
}
