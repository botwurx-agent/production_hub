import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { StudioContext } from "@/lib/studio";

export type SetupStep = {
  id: string;
  title: string;
  text: string;
  href: string;
  cta: string;
  done: boolean;
  hue: string;
};

/**
 * The first-run checklist on the dashboard: the four things a brand new studio
 * has to do before the app is worth anything to them.
 *
 * Every step is derived from real data rather than from a "has seen it" flag,
 * so it stays honest. A step that was completed and then undone (the only
 * project archived, the last teammate removed) correctly comes back, and there
 * is no stored state to drift out of sync with what the studio actually has.
 */
export async function loadSetupSteps(
  supabase: SupabaseClient<Database>,
  ctx: StudioContext
): Promise<SetupStep[]> {
  const count = { count: "exact" as const, head: true };

  const [projects, clients, connections, members, invites] = await Promise.all([
    // Deliberately counts archived projects too: having made one is the thing
    // being taught here, and archiving it later does not un-teach it.
    supabase.from("projects").select("id", count),
    supabase.from("clients").select("id", count),
    supabase
      .from("email_accounts")
      .select("id", count)
      .in("provider", ["google", "slack", "figma"]),
    supabase
      .from("memberships")
      .select("id", count)
      .eq("studio_id", ctx.studio.id),
    supabase
      .from("studio_invites")
      .select("id", count)
      .eq("studio_id", ctx.studio.id)
      .eq("revoked", false),
  ]);

  const has = (r: { count: number | null }) => (r.count ?? 0) > 0;

  return [
    {
      id: "client",
      title: "Add your first client",
      text: "The brand or agency you are working for. Projects hang off a client.",
      href: "/clients",
      cta: "Add a client",
      done: has(clients),
      hue: "cyan",
    },
    {
      id: "project",
      title: "Start a project",
      text: "A single job: the brief, the assets, the review round, the shoot.",
      href: "/projects",
      cta: "New project",
      done: has(projects),
      hue: "indigo",
    },
    {
      id: "logo",
      title: "Add your studio logo",
      text: "It appears on call sheets, documents, and anything a client sees.",
      href: "/settings",
      cta: "Upload a logo",
      done: Boolean(ctx.studio.logo_path),
      hue: "purple",
    },
    {
      id: "connect",
      title: "Connect a tool",
      text: "Pull Gmail, Drive, Slack, or Figma into the project instead of switching apps.",
      href: "/settings",
      cta: "Open connections",
      done: has(connections),
      hue: "green",
    },
    {
      id: "team",
      title: "Invite your team",
      text: "Anyone in the studio. Crew on a single job get a project invite instead.",
      href: "/settings",
      cta: "Invite someone",
      // More than the founding membership, or an invite already out the door.
      done: (members.count ?? 0) > 1 || has(invites),
      hue: "orange",
    },
  ];
}
