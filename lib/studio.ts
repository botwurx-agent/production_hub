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

    const { data: memberships } = await supabase
      .from("memberships")
      .select("role, studio:studios(*)")
      .order("created_at", { ascending: true });

    const rows = (memberships ?? []).filter(
      (m): m is { role: MembershipRole; studio: Studio } => Boolean(m.studio)
    );
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
