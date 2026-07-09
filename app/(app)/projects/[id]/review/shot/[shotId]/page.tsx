import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { loadDocReviewDetail } from "@/lib/doc-review-data";
import { ShotReviewView } from "@/components/review/shot-review-view";

// Full-page internal review of a single AI pipeline shot.
export default async function ShotReviewPage({
  params,
}: {
  params: { id: string; shotId: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  // The shot must belong to this project (and, via RLS, this studio).
  const { data: shot } = await supabase
    .from("ai_shots")
    .select("id")
    .eq("id", params.shotId)
    .eq("project_id", params.id)
    .maybeSingle();
  if (!shot) notFound();

  const detail = await loadDocReviewDetail(
    supabase,
    "ai_shot",
    params.shotId,
    ctx.userId
  );
  if (!detail) notFound();

  return (
    <ShotReviewView
      projectId={project.id}
      projectTitle={project.title}
      shotId={params.shotId}
      initialDetail={detail}
    />
  );
}
