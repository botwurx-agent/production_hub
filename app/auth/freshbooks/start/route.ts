import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authorizeUrl,
  freshbooksConfigured,
  FRESHBOOKS_REDIRECT_PATH,
} from "@/lib/freshbooks";

// Kicks off the FreshBooks OAuth consent flow for the signed-in user.
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }
  if (!freshbooksConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?error=freshbooks_not_configured", origin),
    );
  }

  const redirectUri = `${origin}${FRESHBOOKS_REDIRECT_PATH}`;
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(authorizeUrl(redirectUri, state));
  response.cookies.set("fb_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
