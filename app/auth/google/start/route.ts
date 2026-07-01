import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl, googleConfigured } from "@/lib/google";

// Kicks off the Google OAuth consent flow for the signed-in user.
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }
  if (!googleConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?error=google_not_configured", origin)
    );
  }

  const redirectUri = `${origin}/auth/google/callback`;
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(buildAuthUrl(redirectUri, state));
  response.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
