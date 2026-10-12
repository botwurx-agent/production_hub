import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { connectingStudioId } from "@/lib/active-studio";
import {
  exchangeHiggsfieldCode,
  expiryFrom,
  HF_SCOPE,
  idTokenIdentity,
} from "@/lib/higgsfield-mcp";

const HF_COOKIE = "hf_oauth";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const settings = (q: string) => {
    const res = NextResponse.redirect(new URL(`/settings?${q}`, origin));
    res.cookies.delete(HF_COOKIE);
    return res;
  };

  if (url.searchParams.get("error")) return settings("error=higgsfield_denied");

  let saved: { state?: string; verifier?: string; clientId?: string } = {};
  try {
    saved = JSON.parse(request.cookies.get(HF_COOKIE)?.value ?? "{}");
  } catch {
    saved = {};
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== saved.state || !saved.verifier || !saved.clientId) {
    return settings("error=higgsfield_state");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const studioId = await connectingStudioId(supabase, user.id);
  if (!studioId) return settings("error=no_studio");

  const redirectUri = `${origin}/auth/higgsfield/callback`;
  let tokens;
  try {
    tokens = await exchangeHiggsfieldCode({
      clientId: saved.clientId,
      code,
      verifier: saved.verifier,
      redirectUri,
    });
  } catch {
    return settings("error=higgsfield_exchange");
  }

  const who = idTokenIdentity(tokens.id_token);
  const { error } = await supabase.from("email_accounts").upsert(
    {
      studio_id: studioId,
      user_id: user.id,
      provider: "higgsfield",
      email: who.email ?? "Higgsfield account",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry: expiryFrom(tokens),
      scope: tokens.scope ?? HF_SCOPE,
      external_ref: { client_id: saved.clientId, redirect_uri: redirectUri, sub: who.sub },
    },
    { onConflict: "user_id,provider,email" }
  );
  if (error) return settings("error=higgsfield_store");

  return settings("connected=higgsfield");
}
