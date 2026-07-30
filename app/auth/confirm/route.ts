import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the links Supabase Auth sends: signup confirmation, password
// recovery, and email change. The auth email templates point here with
// token_hash + type (see docs/launch/supabase-auth-emails.md), so the link the
// recipient sees is on our own domain rather than the Supabase project host.

// `next` arrives from the query string, so it is treated as untrusted even
// though we author the templates that set it. Only a same-site path is allowed:
// a protocol-relative "//evil.com" resolves to another origin through the URL
// constructor, which would make this an open redirect the moment a valid token
// were involved.
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/projects";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=confirmation_failed", request.url)
  );
}
