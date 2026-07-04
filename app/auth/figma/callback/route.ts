import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeFigmaCode, getFigmaMe } from "@/lib/figma";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const settings = (q: string) =>
    NextResponse.redirect(new URL(`/settings?${q}`, origin));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("figma_oauth_state")?.value;

  if (url.searchParams.get("error")) return settings("error=figma_denied");
  if (!code || !state || state !== cookieState) {
    return settings("error=figma_state");
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
  let me;
  try {
    tokens = await exchangeFigmaCode(code, `${origin}/auth/figma/callback`);
    me = await getFigmaMe(tokens.access_token);
  } catch {
    return settings("error=figma_exchange");
  }

  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const { error } = await supabase.from("email_accounts").upsert(
    {
      studio_id: membership.studio_id,
      user_id: user.id,
      provider: "figma",
      email: me.email || me.handle,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiry,
      scope: "file_read",
      external_ref: { figma_user_id: me.id },
    },
    { onConflict: "user_id,provider,email" }
  );
  if (error) return settings("error=figma_store");

  const response = settings("connected=figma");
  response.cookies.delete("figma_oauth_state");
  return response;
}
