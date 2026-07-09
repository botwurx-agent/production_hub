import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { PipelineWorkspace } from "@/components/production/pipeline-workspace";
import type { AiScript, AiShot, AiPrompt, AiGeneration } from "@/lib/database.types";

export default async function PipelinePage({
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

  const [{ data: script }, { data: shots }] = await Promise.all([
    supabase.from("ai_scripts").select("*").eq("project_id", params.id).maybeSingle(),
    supabase
      .from("ai_shots")
      .select("*")
      .eq("project_id", params.id)
      .order("position", { ascending: true }),
  ]);

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
          script={(script as AiScript | null) ?? null}
          shots={shotList}
          prompts={prompts}
          generations={generations}
        />
      </Card>
    </div>
  );
}
