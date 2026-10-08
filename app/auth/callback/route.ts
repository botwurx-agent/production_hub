import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

// Exchanges an auth code for a session (PKCE / OAuth / magic-link flows).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // Validated: an unchecked `next` here was an open redirect behind a valid code.
  let fromCookie: string | null = null;
  try {
    const raw = request.cookies.get("sf_next")?.value;
    fromCookie = raw ? decodeURIComponent(raw) : null;
  } catch {
    fromCookie = null;
  }
  const next = safeNext(searchParams.get("next") ?? fromCookie, "/projects");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(new URL(next, request.url));
      res.cookies.delete("sf_next");
      return res;
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_failed", request.url)
  );
}
