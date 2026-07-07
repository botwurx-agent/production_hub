import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import {
  StoryboardEditor,
  type StoryboardBoard,
  type FrameView,
} from "@/components/production/storyboard-editor";
import type { PickableAsset } from "@/components/production/shot-board-editor";
import { loadProjectAssets } from "@/lib/project-data";

const SIGNED_TTL = 60 * 60;

export default async function ProjectStoryboardsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: boardRows } = await supabase
    .from("boards")
    .select("id, name")
    .eq("project_id", params.id)
    .eq("kind", "storyboard")
    .order("position", { ascending: true });
  const boards = (boardRows ?? []) as StoryboardBoard[];

  const boardIds = boards.map((b) => b.id);
  let frames: FrameView[] = [];
  if (boardIds.length > 0) {
    const { data: frameRows } = await supabase
      .from("storyboard_frames")
      .select("*")
      .in("board_id", boardIds)
      .order("position", { ascending: true });
    const paths = (frameRows ?? [])
      .map((f) => f.storage_path)
      .filter((p): p is string => Boolean(p));
    const signed = new Map<string, string>();
    if (paths.length > 0) {
      const { data: list } = await supabase.storage
        .from("assets")
        .createSignedUrls(paths, SIGNED_TTL);
      for (const s of list ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
    frames = (frameRows ?? []).map((f) => ({
      id: f.id,
      board_id: f.board_id,
      position: f.position,
      scene: f.scene,
      description: f.description,
      sound: f.sound,
      notes: f.notes,
      signedUrl: f.storage_path ? (signed.get(f.storage_path) ?? null) : null,
      image_name: f.image_name,
    }));
  }

  const { data: docReviews } = await supabase
    .from("doc_reviews")
    .select("target_id")
    .eq("project_id", project.id)
    .eq("target_type", "storyboard");
  const reviewedIds = (docReviews ?? []).map((d) => d.target_id);

  const { assets } = await loadProjectAssets(supabase, project.id);
  const pickable: PickableAsset[] = assets.map((a) => {
    const cur =
      a.versions.find((v) => v.id === a.current_version_id) ?? a.versions[0];
    return { id: a.id, name: a.name, signedUrl: cur?.signedUrl ?? null };
  });

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Storyboards"
        hue="indigo"
        subtitle="Sequence frames to plan the edit, the step before the shot list."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M2 9h20M8 4v5M16 4v5M8 20v-5M16 20v-5" />
          </svg>
        }
      />
      <StoryboardEditor
        projectId={project.id}
        boards={boards}
        frames={frames}
        assets={pickable}
        reviewedIds={reviewedIds}
      />
    </div>
  );
}
