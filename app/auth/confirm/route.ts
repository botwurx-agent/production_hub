import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/log";

// Handles the links Supabase Auth sends: signup confirmation, password
// recovery, and email change. Two link shapes arrive here, and both have to
// work.
//
// 1. token_hash + type. Our own templates (docs/launch/supabase-auth-emails.md)
//    link straight here, so the recipient sees our domain rather than the
//    Supabase project host, and the token is spent by verifyOtp below.
//
// 2. code. Supabase's DEFAULT templates use {{ .ConfirmationURL }}, which
//    points at the project's /auth/v1/verify endpoint. That consumes the
//    one-time token itself, creates the session, and only then redirects here
//    with a PKCE code to exchange. Handling this is not optional politeness:
//    the default template is what a fresh Supabase project ships with, and
//    without this branch every recovery link dies on arrival. Worse, it dies
//    AFTER the token is spent, so the retry that follows fails for real and the
//    user is told the link expired when it never did.

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
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    reportError("authConfirm.verifyOtp", error);
  } else if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    reportError("authConfirm.exchangeCodeForSession", error);
  } else {
    // Neither shape present: the link was truncated, hand-edited, or Supabase
    // is configured for the implicit flow, whose tokens live in the URL
    // fragment and never reach the server.
    reportError(
      "authConfirm",
      new Error("Confirmation link carried neither token_hash nor code")
    );
  }

  return NextResponse.redirect(
    new URL("/login?error=confirmation_failed", request.url)
  );
}
