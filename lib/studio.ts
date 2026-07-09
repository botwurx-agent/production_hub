import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MembershipRole, Studio } from "@/lib/database.types";

export type StudioContext = {
  userId: string;
  email: string | null;
  studio: Studio;
  role: MembershipRole;
  // All studios the user belongs to (for a future studio switcher).
  studios: { studio: Studio; role: MembershipRole }[];
};

/**
 * Resolves the signed-in user and their active studio. For v1 the active
 * studio is the first one the user belongs to; a switcher comes later.
 * Cached per request so multiple server components share one lookup.
 */
export const getStudioContext = cache(
  async (): Promise<StudioContext | null> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const load = async () => {
      const { data } = await supabase
        .from("memberships")
        .select("role, studio:studios(*)")
        .order("created_at", { ascending: true });
      return (data ?? []).filter(
        (m): m is { role: MembershipRole; studio: Studio } => Boolean(m.studio)
      );
    };

    let rows = await load();
    // A freshly-invited user has no studio until they claim their invite. This
    // is the reliable net (covers every auth path, incl. email confirmation):
    // on the first app load with no membership, join any studio that invited
    // this email, then re-read.
    if (rows.length === 0) {
      await supabase.rpc("claim_pending_invites");
      rows = await load();
    }
    if (rows.length === 0) return null;

    return {
      userId: user.id,
      email: user.email ?? null,
      studio: rows[0].studio,
      role: rows[0].role,
      studios: rows.map((r) => ({ studio: r.studio, role: r.role })),
    };
  }
);

/** Same as getStudioContext but redirects to /login when unauthenticated. */
export async function requireStudioContext(): Promise<StudioContext> {
  const ctx = await getStudioContext();
  if (!ctx) redirect("/login");
  return ctx;
}
