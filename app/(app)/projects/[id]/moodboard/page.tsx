import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { BoardsWorkspace } from "@/components/boards/boards-workspace";
import { driveConnected } from "@/lib/googledrive";
import type { Board } from "@/lib/database.types";

export default async function ProjectMoodboardPage({
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
        .eq("kind", "moodboard")
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
        section="Moodboard"
        hue="cyan"
        subtitle="Collect references, styles, and inspiration for this job."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
          </svg>
        }
      />
      <BoardsWorkspace
        initialBoards={(boards ?? []) as Board[]}
        projects={[]}
        driveConnected={driveConnected(googleAccount?.scope)}
        figmaConnected={Boolean(figmaAccount)}
        scope={{ kind: "moodboard", projectId: project.id }}
        noun="moodboard"
        reviewKind="moodboard"
      />
    </div>
  );
}
