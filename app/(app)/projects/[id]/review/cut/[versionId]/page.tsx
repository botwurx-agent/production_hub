import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { loadProjectAssets } from "@/lib/project-data";
import { CutReviewView } from "@/components/review/cut-review-view";

// Full-page internal review of a single master-cut version.
export default async function CutReviewPage({
  params,
}: {
  params: { id: string; versionId: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const { assets, reviewLinkByAsset } = await loadProjectAssets(supabase, params.id);
  const cut = assets.find((a) => a.type === "cut");
  if (!cut) notFound();
  const version = cut.versions.find((v) => v.id === params.versionId);
  if (!version) notFound();

  const link = reviewLinkByAsset.get(cut.id) ?? null;

  return (
    <CutReviewView
      projectId={project.id}
      projectTitle={project.title}
      cut={cut}
      activeVersionId={version.id}
      reviewToken={link?.token ?? null}
      reviewLinkId={link?.id ?? null}
      currentUserId={ctx.userId}
    />
  );
}
