import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Service-role Supabase client: bypasses RLS. Use ONLY in trusted server code
// that has already authorized the caller some other way. In this app that means
// the public client-review portal, where access is gated by a valid review-link
// token and every query is scoped to that link's asset/project/studio.
//
// Never import this into anything reachable by the authenticated app UI, and
// never expose the key to the browser (no NEXT_PUBLIC prefix).
export function serviceConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Service role client is not configured.");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
