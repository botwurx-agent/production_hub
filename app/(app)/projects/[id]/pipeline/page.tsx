import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assetStorage } from "@/lib/asset-storage";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { PipelineWorkspace } from "@/components/production/pipeline-workspace";
import { loadProjectAssets } from "@/lib/project-data";
import { loadBatchReviewsForProject } from "@/lib/batch-review";
import type { AiScript, AiShot, AiPrompt, AiGeneration, AiPromptLibraryEntry } from "@/lib/database.types";

// Import/fetch-and-store server actions on this route pull media from external
// links; give them headroom beyond the short default so a slow host doesn't get
// the function killed mid-download.
export const maxDuration = 60;

export default async function PipelinePage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: script }, { data: shots }, { data: lib }] = await Promise.all([
    supabase.from("ai_scripts").select("*").eq("project_id", params.id).maybeSingle(),
    supabase
      .from("ai_shots")
      .select("*")
      .eq("project_id", params.id)
      .order("position", { ascending: true }),
    // Library: studio-wide entries + this project's own, newest first.
    supabase
      .from("ai_prompt_library")
      .select("*")
      .or(`project_id.is.null,project_id.eq.${params.id}`)
      .order("updated_at", { ascending: false }),
  ]);

  const library = (lib ?? []) as AiPromptLibraryEntry[];
  const shotList = (shots ?? []) as AiShot[];
  const shotIds = shotList.map((s) => s.id);

  let prompts: AiPrompt[] = [];
  let generations: AiGeneration[] = [];
  if (shotIds.length) {
    const [{ data: p }, { data: g }] = await Promise.all([
      supabase.from("ai_prompts").select("*").in("shot_id", shotIds),
      supabase
        .from("ai_generations")
        .select("*")
        .in("shot_id", shotIds)
        .order("created_at", { ascending: true }),
    ]);
    prompts = (p ?? []) as AiPrompt[];
    generations = (g ?? []) as AiGeneration[];
  }

  // Which shots are already in the review cycle (so the header can show status).
  let reviewingShotIds: string[] = [];
  if (shotIds.length) {
    const { data: docRev } = await supabase
      .from("doc_reviews")
      .select("target_id")
      .eq("project_id", params.id)
      .eq("target_type", "ai_shot");
    reviewingShotIds = (docRev ?? []).map((r) => r.target_id);
  }

  // The master cut (the assembled deliverable) lives in the Assets -> Versions
  // spine as the project's asset of type 'cut'. Surface it here.
  const { assets: projectAssets, reviewLinkByAsset } = await loadProjectAssets(
    supabase,
    params.id
  );
  const masterCut = projectAssets.find((a) => a.type === "cut") ?? null;
  const masterCutLink = masterCut ? reviewLinkByAsset.get(masterCut.id) ?? null : null;

  // Batch reviews ("send options for a pick"), grouped by shot.
  const batchReviews = await loadBatchReviewsForProject(supabase, params.id);

  // Sign uploaded files (private bucket) for display, keyed by generation id.
  const media: Record<string, string> = {};
  await Promise.all(
    generations
      .filter((g) => g.file_path)
      .map(async (g) => {
        const { data } = await assetStorage()
          .createSignedUrl(g.file_path as string, 60 * 60);
        if (data?.signedUrl) media[g.id] = data.signedUrl;
      }),
  );

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="AI Pipeline"
        hue="purple"
        subtitle="Script to prompt to images to video, with provenance on every generation."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16v16H4z" /><path d="M4 9h16M9 4v16" /><circle cx="14.5" cy="14.5" r="2.5" />
          </svg>
        }
      />
      <Card className="p-5">
        <PipelineWorkspace
          projectId={project.id}
          studioId={ctx.studio.id}
          script={(script as AiScript | null) ?? null}
          shots={shotList}
          prompts={prompts}
          generations={generations}
          media={media}
          library={library}
          masterCut={masterCut}
          masterCutToken={masterCutLink?.token ?? null}
          masterCutLinkId={masterCutLink?.id ?? null}
          batchReviews={batchReviews}
          currentUserId={ctx.userId}
          reviewingShotIds={reviewingShotIds}
        />
      </Card>
    </div>
  );
}
