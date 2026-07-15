import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStudioContext } from "@/lib/studio";
import { getOutstanding } from "@/lib/outstanding";
import { signedLogoUrl } from "@/lib/branding";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { Toaster } from "@/components/ui/toast";

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

  const outstanding = await getOutstanding();
  const logoUrl = await signedLogoUrl(ctx.studio.logo_path);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        studioName={ctx.studio.name}
        logoUrl={logoUrl}
        collaborator={ctx.isCollaborator}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          email={ctx.email}
          needsYouCount={outstanding.length}
          collaborator={ctx.isCollaborator}
        />
        <main className="flex-1 px-4 py-6 print:p-0 md:px-8 md:py-8">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
