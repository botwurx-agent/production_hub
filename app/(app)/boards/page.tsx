import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { BoardsWorkspace } from "@/components/boards/boards-workspace";
import { driveConnected } from "@/lib/googledrive";
import type { Board } from "@/lib/database.types";

export default async function BoardsPage() {
  await requireStudioContext();
  const supabase = createClient();

  const [{ data: boards }, { data: projects }, { data: googleAccount }, { data: figmaAccount }] =
    await Promise.all([
      supabase.from("boards").select("*").order("position", { ascending: true }),
      supabase.from("projects").select("id, title").order("created_at", { ascending: false }),
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
      <PageHeader
        title="Boards"
        subtitle="Moodboards and storyboards. Drag, drop, and arrange your visuals."
      />
      <BoardsWorkspace
        initialBoards={(boards ?? []) as Board[]}
        projects={projects ?? []}
        driveConnected={driveConnected(googleAccount?.scope)}
        figmaConnected={Boolean(figmaAccount)}
      />
    </div>
  );
}
