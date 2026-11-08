import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildHiggsfieldAuthUrl,
  hfRef,
  higgsfieldEndpoints,
  pkcePair,
  registerHiggsfieldClient,
} from "@/lib/higgsfield-mcp";

const HF_COOKIE = "hf_oauth";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const redirectUri = `${origin}/auth/higgsfield/callback`;
  const ep = await higgsfieldEndpoints();

  // Reuse the client id a previous connection registered for this address,
  // so reconnecting does not register Studio Flows with Higgsfield again.
  const { data: prior } = await supabase
    .from("email_accounts")
    .select("external_ref")
    .eq("provider", "higgsfield")
    .eq("user_id", user.id)
    .limit(5);
  let clientId =
    (prior ?? []).map((r) => hfRef(r.external_ref)).find((r) => r?.redirect_uri === redirectUri && r.issuer === ep.issuer)?.client_id ??
    null;

  try {
    if (!clientId) clientId = await registerHiggsfieldClient(redirectUri, ep);
  } catch {
    return NextResponse.redirect(new URL("/settings?error=higgsfield_register", origin));
  }

  const state = crypto.randomUUID();
  const { verifier, challenge } = await pkcePair();
  const response = NextResponse.redirect(
    buildHiggsfieldAuthUrl({ clientId, redirectUri, state, challenge, ep })
  );
  // The verifier rides in an httpOnly cookie for the ten minutes the sign-in
  // takes. It is useless without the code Higgsfield sends to our callback.
  response.cookies.set(HF_COOKIE, JSON.stringify({ state, verifier, clientId, issuer: ep.issuer }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
