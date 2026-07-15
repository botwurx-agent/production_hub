import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assetStorage } from "@/lib/asset-storage";
import { requireStudioContext } from "@/lib/studio";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import {
  ShotBoardEditor,
  type CardView,
  type PickableAsset,
} from "@/components/production/shot-board-editor";
import { loadProjectAssets } from "@/lib/project-data";
import type { ShotBoard, ShotGroup } from "@/lib/database.types";

const SIGNED_TTL = 60 * 60;

export default async function ShotListPage({
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

  const [{ data: board }, { data: groups }, { data: docReview }] =
    await Promise.all([
      supabase.from("shot_boards").select("*").eq("project_id", params.id).maybeSingle(),
      supabase
        .from("shot_groups")
        .select("*")
        .eq("project_id", params.id)
        .order("position", { ascending: true }),
      supabase
        .from("doc_reviews")
        .select("id")
        .eq("target_type", "shot_list")
        .eq("target_id", params.id)
        .maybeSingle(),
    ]);

  // Client comments returned on this shot list (from shared review links).
  const { count: shotCommentCount } = await supabase
    .from("review_comments")
    .select("id", { count: "exact", head: true })
    .eq("target_type", "shot_list")
    .eq("target_id", params.id)
    .is("author_id", null);

  const groupIds = (groups ?? []).map((g) => g.id);
  let cards: CardView[] = [];
  if (groupIds.length > 0) {
    const { data: cardRows } = await supabase
      .from("shot_cards")
      .select("*")
      .in("group_id", groupIds)
      .order("position", { ascending: true });
    const paths = (cardRows ?? [])
      .map((c) => c.storage_path)
      .filter((p): p is string => Boolean(p));
    const signed = new Map<string, string>();
    if (paths.length > 0) {
      const { data: list } = await assetStorage()
        .createSignedUrls(paths, SIGNED_TTL);
      for (const s of list ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    }
    cards = (cardRows ?? []).map((c) => ({
      id: c.id,
      group_id: c.group_id,
      position: c.position,
      code: c.code,
      day: c.day,
      flavor_name: c.flavor_name,
      flavor_hue: c.flavor_hue,
      description: c.description,
      vo: c.vo,
      shot_size: c.shot_size,
      shot_type: c.shot_type,
      movement: c.movement,
      asset_id: c.asset_id,
      tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
      signedUrl: c.storage_path ? (signed.get(c.storage_path) ?? null) : null,
      image_name: c.image_name,
    }));
  }

  // Project assets available to attach to a shot.
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
        section="Shot list"
        hue="purple"
        subtitle="Plan every shot for the shoot."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 3v18" />
          </svg>
        }
      />
      <ShotBoardEditor
        commentCount={shotCommentCount ?? 0}
        inReview={Boolean(docReview)}
        projectId={project.id}
        projectTitle={project.title}
        board={(board as ShotBoard | null) ?? null}
        groups={(groups ?? []) as ShotGroup[]}
        cards={cards}
        assets={pickable}
      />
    </div>
  );
}
