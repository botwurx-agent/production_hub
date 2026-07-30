import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStudioContext } from "@/lib/studio";
import { getOutstanding } from "@/lib/outstanding";
import { signedLogoUrl } from "@/lib/branding";
import { aiConfigured } from "@/lib/ai";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { Toaster } from "@/components/ui/toast";
import { AiAvailabilityProvider } from "@/components/ai/ai-availability";
import { AgentMount } from "@/components/agent/agent-mount";
import { canUseRunner } from "@/lib/agent/access";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireStudioContext();

  // Project collaborators are scoped to their project(s): keep them inside
  // /projects and out of every studio-wide page. RLS is the real boundary; this
  // is the navigation guard so they never land on an empty studio page.
  if (ctx.isCollaborator) {
    const pathname = headers().get("x-pathname") ?? "";
    // Guard on a known path only (never redirect on a missing header, which
    // would risk a loop); the stripped nav + RLS still contain them regardless.
    if (pathname && !pathname.startsWith("/projects")) redirect("/projects");
  }

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
      <div className="flex min-h-screen bg-bg">
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
          />
          <main className="flex-1 px-4 py-6 print:p-0 md:px-8 md:py-8">
            {children}
          </main>
        </div>
        {assistant ? <AgentMount /> : null}
        <Toaster />
      </div>
    </AiAvailabilityProvider>
  );
}
