import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card, EmptyState } from "@/components/ui/card";
import { AssetCard } from "@/components/projects/asset-card";
import { AddAssetButton } from "@/components/projects/add-asset-button";
import { AssetsDropzone } from "@/components/projects/assets-dropzone";
import { DriveImportButton } from "@/components/projects/drive-import-button";
import { FigmaImportButton } from "@/components/projects/figma-import-button";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { driveConnected } from "@/lib/googledrive";
import { loadProjectAssets } from "@/lib/project-data";

export default async function AssetsPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const [{ data: project }, { data: emailAccount }, { data: figmaAccount }] =
    await Promise.all([
      supabase.from("projects").select("id, title").eq("id", params.id).maybeSingle(),
      supabase
        .from("email_accounts")
        .select("id, scope")
        .eq("provider", "google")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("email_accounts")
        .select("id")
        .eq("provider", "figma")
        .limit(1)
        .maybeSingle(),
    ]);
  if (!project) notFound();

  const { assets, reviewLinkByAsset } = await loadProjectAssets(
    supabase,
    project.id
  );

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Assets"
        hue="purple"
        subtitle="The project library: every file, reference, and its version history."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
          </svg>
        }
      />

      <AssetsDropzone projectId={project.id} studioId={ctx.studio.id}>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold">
              {assets.length} {assets.length === 1 ? "deliverable" : "deliverables"}
            </h2>
            <p className="mt-0.5 hidden text-xs text-text-faint sm:block">
              Tip: drag files anywhere here to upload.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {figmaAccount && <FigmaImportButton projectId={project.id} />}
            {driveConnected(emailAccount?.scope) && (
              <DriveImportButton projectId={project.id} />
            )}
            <AddAssetButton projectId={project.id} studioId={ctx.studio.id} />
          </div>
        </div>
        {assets.length === 0 ? (
          <EmptyState
            hue="purple"
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            }
            title="No files yet"
            description="This is the project library: cuts, boards, stills, references, docs. Upload anything the job touches; each file keeps its full version history. Send one to the client from Review."
            action={
              <AddAssetButton projectId={project.id} studioId={ctx.studio.id} />
            }
            steps={[
              {
                title: "Add or import",
                text: "Upload a file, or pull it straight from Drive or Figma.",
              },
              {
                title: "Version as you go",
                text: "Upload a new version any time; the history stays intact.",
              },
              {
                title: "Send for review",
                text: "Share a link so clients can comment and approve.",
              },
            ]}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {assets.map((a) => (
              <AssetCard
                key={a.id}
                asset={a}
                projectId={project.id}
                studioId={ctx.studio.id}
                currentUserId={ctx.userId}
                reviewLink={reviewLinkByAsset.get(a.id) ?? null}
              />
            ))}
          </div>
        )}
      </Card>
      </AssetsDropzone>
    </div>
  );
}
