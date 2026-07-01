import { requireStudioContext } from "@/lib/studio";
import { getOutstanding } from "@/lib/outstanding";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireStudioContext();
  const outstanding = await getOutstanding();

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar studioName={ctx.studio.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar email={ctx.email} needsYouCount={outstanding.length} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
