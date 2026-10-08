import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditProject, requireStudioContext } from "@/lib/studio";
import { asSetup } from "@/components/previz/setup";
import { SceneBuilderWorkspace } from "@/components/previz/scene-builder-workspace";

export const dynamic = "force-dynamic";

export const metadata = { title: "Scene builder" };

export default async function SceneBuilderPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { setup?: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  // The list carries names only; the scene itself (which can run to a few
  // hundred kilobytes) is read for the open setup alone.
  const { data: rows } = await supabase
    .from("scene_setups")
    .select("id, name")
    .eq("project_id", project.id)
    .order("position", { ascending: true });
  const setups = rows ?? [];
  const activeId = setups.find((s) => s.id === searchParams.setup)?.id ?? setups[0]?.id ?? null;

  let active: { id: string; data: ReturnType<typeof asSetup> } | null = null;
  if (activeId) {
    const { data: row } = await supabase.from("scene_setups").select("id, data").eq("id", activeId).maybeSingle();
    if (row) active = { id: row.id, data: asSetup(row.data) };
  }

  return (
    <SceneBuilderWorkspace
      projectId={project.id}
      projectTitle={project.title}
      setups={setups}
      active={active && active.data ? { id: active.id, data: active.data } : null}
      unreadable={Boolean(active && !active.data)}
      canEdit={canEditProject(ctx, project.id)}
    />
  );
}
