import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditProject, requireStudioContext } from "@/lib/studio";
import { asBlockScene } from "@/lib/blocking/scene";
import { BlockingWorkspace } from "@/components/blocking/blocking-workspace";
import { aiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shot blocking" };

export default async function BlockingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { scene?: string; shot?: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();
  const { data: project } = await supabase.from("projects").select("id, title").eq("id", params.id).maybeSingle();
  if (!project) notFound();

  // Names only for the tabs; the scene itself is read for the open one alone.
  const { data: rows } = await supabase
    .from("blocking_scenes")
    .select("id, name, shot_id")
    .eq("project_id", project.id)
    .order("position", { ascending: true });
  const scenes = rows ?? [];
  // Opened from a pipeline shot: that shot's scene, if it has one.
  const byShot = searchParams.shot ? scenes.find((s) => s.shot_id === searchParams.shot) : undefined;
  const activeId = scenes.find((s) => s.id === searchParams.scene)?.id ?? byShot?.id ?? (searchParams.shot ? null : scenes[0]?.id ?? null);

  // The project's generated shots, for Send to pipeline.
  const { data: shotRows } = await supabase
    .from("ai_shots").select("id, title, method").eq("project_id", project.id).order("position", { ascending: true });
  const shots = (shotRows ?? [])
    .map((s, i) => ({ id: s.id, label: `Shot ${i + 1}${s.title?.trim() ? `, ${s.title.trim()}` : ""}`, method: s.method }))
    .filter((s) => s.method !== "live")
    .map(({ id, label }) => ({ id, label }));

  let active: { id: string; data: NonNullable<ReturnType<typeof asBlockScene>> } | null = null;
  if (activeId) {
    const { data: row } = await supabase.from("blocking_scenes").select("id, data").eq("id", activeId).maybeSingle();
    const data = row ? asBlockScene(row.data) : null;
    if (row && data) active = { id: row.id, data };
  }

  return (
    <BlockingWorkspace
      projectId={project.id}
      projectTitle={project.title}
      scenes={scenes.map((s) => ({ id: s.id, name: s.name }))}
      active={active}
      studioId={ctx.studio.id}
      shots={shots}
      linkedShotId={scenes.find((x) => x.id === active?.id)?.shot_id ?? null}
      canEdit={canEditProject(ctx, project.id)}
      shotId={searchParams.shot ?? null}
      aiEnabled={aiConfigured() && !ctx.isCollaborator}
    />
  );
}
