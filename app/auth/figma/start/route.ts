import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildFigmaAuthUrl, figmaConfigured } from "@/lib/figma";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  if (!figmaConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?error=figma_not_configured", origin)
    );
  }

  const redirectUri = `${origin}/auth/figma/callback`;
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(buildFigmaAuthUrl(redirectUri, state));
  response.cookies.set("figma_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
