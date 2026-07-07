import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { BoardsWorkspace } from "@/components/boards/boards-workspace";
import { driveConnected } from "@/lib/googledrive";
import type { Board } from "@/lib/database.types";

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

  const [{ data: boards }, { data: googleAccount }, { data: figmaAccount }] =
    await Promise.all([
      supabase
        .from("boards")
        .select("*")
        .eq("project_id", params.id)
        .eq("kind", "storyboard")
        .order("position", { ascending: true }),
      supabase
        .from("email_accounts")
        .select("scope")
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

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Storyboards"
        hue="indigo"
        subtitle="Sequence frames to plan the edit for this job."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M2 9h20M8 4v5M16 4v5M8 20v-5M16 20v-5" />
          </svg>
        }
      />
      <BoardsWorkspace
        initialBoards={(boards ?? []) as Board[]}
        projects={[]}
        driveConnected={driveConnected(googleAccount?.scope)}
        figmaConnected={Boolean(figmaAccount)}
        scope={{ kind: "storyboard", projectId: project.id }}
        noun="storyboard"
      />
    </div>
  );
}
