import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCode,
  getIdentity,
  FRESHBOOKS_REDIRECT_PATH,
} from "@/lib/freshbooks";

// Completes the FreshBooks OAuth flow: exchanges the code, resolves the
// accounting account id, and stores the studio's connection + tokens.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const settings = (q: string) =>
    NextResponse.redirect(new URL(`/settings?${q}`, origin));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("fb_oauth_state")?.value;

  if (url.searchParams.get("error")) {
    return settings("error=freshbooks_denied");
  }
  if (!code || !state || state !== cookieState) {
    return settings("error=freshbooks_state");
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
    tokens = await exchangeCode(code, `${origin}${FRESHBOOKS_REDIRECT_PATH}`);
  } catch {
    return settings("error=freshbooks_exchange");
  }

  let identity;
  try {
    identity = await getIdentity(tokens.access_token);
  } catch {
    return settings("error=freshbooks_identity");
  }
  if (!identity.accountId) {
    return settings("error=freshbooks_account");
  }

  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const { error } = await supabase.from("billing_accounts").upsert(
    {
      studio_id: membership.studio_id,
      provider: "freshbooks",
      connected_by: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiry,
      fb_account_id: identity.accountId,
      fb_business_id: identity.businessId,
      fb_identity_email: identity.email,
    },
    { onConflict: "studio_id,provider" },
  );
  if (error) return settings("error=freshbooks_store");

  const response = settings("connected=freshbooks");
  response.cookies.delete("fb_oauth_state");
  return response;
}
