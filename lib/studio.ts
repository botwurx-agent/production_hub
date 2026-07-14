import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MembershipRole, Studio } from "@/lib/database.types";

export type StudioContext = {
  userId: string;
  email: string | null;
  studio: Studio;
  role: MembershipRole;
  // True when access is project-scoped (a collaborator, not a studio member).
  isCollaborator: boolean;
  // Projects a collaborator may access; null for full studio members (all).
  projectIds: string[] | null;
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
    // on the first app load with no membership, join any studio (or project)
    // that invited this email, then re-read.
    if (rows.length === 0) {
      await supabase.rpc("claim_pending_invites");
      await supabase.rpc("claim_pending_project_invites");
      rows = await load();
    }

    // Full studio member: access to everything in the studio.
    if (rows.length > 0) {
      return {
        userId: user.id,
        email: user.email ?? null,
        studio: rows[0].studio,
        role: rows[0].role,
        isCollaborator: false,
        projectIds: null,
        studios: rows.map((r) => ({ studio: r.studio, role: r.role })),
      };
    }

    // Project collaborator: no membership, but granted specific project(s).
    // Resolve the studio from those projects (v1 assumes a single studio).
    const { data: pmRows } = await supabase
      .from("project_members")
      .select("project_id, projects(studio_id)")
      .order("created_at", { ascending: true });
    const members = (pmRows ?? []) as {
      project_id: string;
      projects: { studio_id: string } | null;
    }[];
    const studioId = members.find((m) => m.projects)?.projects?.studio_id;
    if (!studioId) return null;

    const { data: studio } = await supabase
      .from("studios")
      .select("*")
      .eq("id", studioId)
      .maybeSingle();
    if (!studio) return null;

    const projectIds = members
      .filter((m) => m.projects?.studio_id === studioId)
      .map((m) => m.project_id);

    return {
      userId: user.id,
      email: user.email ?? null,
      studio,
      role: "member",
      isCollaborator: true,
      projectIds,
      studios: [{ studio, role: "member" }],
    };
  }
);

/** Same as getStudioContext but redirects to /login when unauthenticated. */
export async function requireStudioContext(): Promise<StudioContext> {
  const ctx = await getStudioContext();
  if (!ctx) redirect("/login");
  return ctx;
}
