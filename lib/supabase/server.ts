import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { borrowedClient } from "@/lib/supabase/run-as";

/**
 * Server-side Supabase client for Server Components, Route Handlers, and
 * Server Actions. Reads/writes the auth session from Next's cookie store.
 * In pure Server Components the cookie set can throw (read-only), which is
 * safe to ignore because the middleware refreshes the session.
 */
export function createClient() {
  // Inside runAsUser (the AI connector, which has no cookie session), every
  // reader gets that request's own user-scoped client instead, so the same
  // RLS that bounds the app bounds the connector, with no second code path.
  const borrowed = borrowedClient();
  if (borrowed) return borrowed;

  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; the middleware handles refresh.
          }
        },
      },
    }
  );
}
