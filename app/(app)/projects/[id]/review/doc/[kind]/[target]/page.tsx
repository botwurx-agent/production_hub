import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { loadDocReviewDetail } from "@/lib/doc-review-data";
import { DocReviewView } from "@/components/review/doc-review-view";

type DocKind = "shot_list" | "storyboard" | "moodboard";
const KINDS: DocKind[] = ["shot_list", "storyboard", "moodboard"];
const BACK: Record<DocKind, { path: string; label: string }> = {
  shot_list: { path: "shot-list", label: "shot list" },
  storyboard: { path: "storyboards", label: "storyboards" },
  moodboard: { path: "moodboard", label: "moodboard" },
};

// Full-page internal review (comments) of a doc: storyboard / shot list / moodboard.
export default async function DocReviewPage({
  params,
}: {
  params: { id: string; kind: string; target: string };
}) {
  const ctx = await requireStudioContext();
  const kind = params.kind as DocKind;
  if (!KINDS.includes(kind)) notFound();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  // The target must belong to this project.
  if (kind === "shot_list") {
    if (params.target !== project.id) notFound();
  } else {
    const { data: board } = await supabase
      .from("boards")
      .select("id")
      .eq("id", params.target)
      .eq("project_id", project.id)
      .eq("kind", kind)
      .maybeSingle();
    if (!board) notFound();
  }

  const detail = await loadDocReviewDetail(supabase, kind, params.target, ctx.userId);
  if (!detail) notFound();

  const back = BACK[kind];
  return (
    <DocReviewView
      projectId={project.id}
      projectTitle={project.title}
      kind={kind}
      targetId={params.target}
      backHref={`/projects/${project.id}/${back.path}`}
      backLabel={back.label}
      initialDetail={detail}
    />
  );
}
