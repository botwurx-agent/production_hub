"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// "Continue with Google" social login. Hidden until NEXT_PUBLIC_GOOGLE_AUTH is
// enabled, so the button never appears before the Google provider is turned on
// in Supabase Auth. Sign-in and sign-up are the same flow: Supabase creates the
// user on first login, and the studio-bootstrap trigger gives new users a
// default "My Studio".
export function GoogleAuthButton({
  label = "Continue with Google",
}: {
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH !== "true") return null;

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // window.location.origin keeps this correct on localhost, the vercel.app
        // domain, and app.studio-flows.com without hardcoding any of them.
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      // On success the browser is already redirecting to Google; only failures
      // reach here.
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-[11px] border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-text transition hover:border-accent hover:bg-surface-2 disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" />
        </svg>
        {loading ? "Redirecting..." : label}
      </button>
      {error && (
        <p className="mt-3 rounded-[10px] bg-red-bg px-3 py-2 text-sm font-medium text-red">
          {error}
        </p>
      )}
      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-text-faint">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
