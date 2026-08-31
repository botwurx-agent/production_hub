import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStudioContext } from "@/lib/studio";
import { getOutstanding } from "@/lib/outstanding";
import { signedLogoUrl } from "@/lib/branding";
import { aiConfigured } from "@/lib/ai";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { Toaster } from "@/components/ui/toast";
import { ConfirmHost } from "@/components/ui/confirm";
import { AiAvailabilityProvider } from "@/components/ai/ai-availability";
import { AgentMount } from "@/components/agent/agent-mount";
import { TourGuide } from "@/components/tour/tour-guide";
import { canUseRunner } from "@/lib/agent/access";
import { createClient } from "@/lib/supabase/server";
import { ProjectNav } from "@/components/projects/project-nav";

/**
 * The project id of a project route, or null.
 *
 * Anchored so it matches the project's OWN pages and its sub-pages, and not
 * /projects itself or anything that merely starts with the word. The id is not
 * trusted: it goes into an RLS-scoped read that returns nothing if it is not a
 * real project this studio can see.
 */
function projectIdFromPath(pathname: string): string | null {
  const m = /^\/projects\/([0-9a-f-]{16,})(?:\/|$)/i.exec(pathname);
  return m ? m[1] : null;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireStudioContext();

  // Project collaborators are scoped to their project(s): keep them inside
  // /projects and out of every studio-wide page. RLS is the real boundary; this
  // is the navigation guard so they never land on an empty studio page.
  const pathname = headers().get("x-pathname") ?? "";
  if (ctx.isCollaborator) {
    // Guard on a known path only (never redirect on a missing header, which
    // would risk a loop); the stripped nav + RLS still contain them regardless.
    if (pathname && !pathname.startsWith("/projects")) redirect("/projects");
  }

  // The project's phase-band nav rides in the TOPBAR on a project route, where
  // it fills space the header was wasting instead of pushing every project page
  // down by its own height. Read here rather than passed up from the page,
  // because the topbar renders above every route: the same reason the invite
  // button reads the URL. This replaces the query the project layout used to
  // make for the same row, so it is not an extra round trip.
  const projectId = projectIdFromPath(pathname);
  const navProject = projectId
    ? (
        await createClient()
          .from("projects")
          .select("id, project_type")
          .eq("id", projectId)
          .maybeSingle()
      ).data
    : null;

  // One seam for "may this studio use Runner", so a paid-tier check lands in
  // exactly one place later. This only decides whether the nav row is shown;
  // the real gate is server-side in the route and in confirmCard.
  const assistant = canUseRunner(ctx);

  const outstanding = await getOutstanding();
  const logoUrl = await signedLogoUrl(ctx.studio.logo_path);

  // A collaborator has no memberships, so their single "studio" entry is
  // synthesised from the project they were invited to; never offer a switcher.
  const studios = ctx.isCollaborator
    ? []
    : ctx.studios.map((s) => ({
        id: s.studio.id,
        name: s.studio.name,
        role: s.role,
      }));

  return (
    <AiAvailabilityProvider enabled={aiConfigured()}>
      <div className="flex min-h-[100dvh] bg-bg">
        <Sidebar
          studioName={ctx.studio.name}
          logoUrl={logoUrl}
          collaborator={ctx.isCollaborator}
          studios={studios}
          activeStudioId={ctx.studio.id}
          assistant={assistant}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            email={ctx.email}
            needsYouCount={outstanding.length}
            collaborator={ctx.isCollaborator}
            studios={studios}
            activeStudioId={ctx.studio.id}
            assistant={assistant}
            studioName={ctx.studio.name}
            logoUrl={logoUrl}
            projectNav={
              navProject ? (
                <ProjectNav
                  bar
                  projectId={navProject.id}
                  projectType={navProject.project_type ?? "general"}
                />
              ) : null
            }
          />
          <main className="flex-1 px-4 py-6 print:p-0 md:px-8 md:py-8">
            {children}
          </main>
        </div>
        {assistant ? <AgentMount /> : null}
        {/* One renderer for every tour, so the replay entry in the user menu
            works from any page. Pages opt into a first-run tour with
            TourTrigger. */}
        <TourGuide />
        <Toaster />
        <ConfirmHost />
      </div>
    </AiAvailabilityProvider>
  );
}
