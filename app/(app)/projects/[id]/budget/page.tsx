import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { BudgetTable } from "@/components/production/budget-table";
import type { BudgetLine } from "@/lib/database.types";

export default async function BudgetPage({
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

  const { data: budgetLines } = await supabase
    .from("budget_lines")
    .select("*")
    .eq("project_id", params.id)
    .order("position", { ascending: true });

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Budget"
        hue="indigo"
        subtitle="Track the estimate against actual spend, line by line."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
      />
      <Card className="p-5">
        <BudgetTable projectId={project.id} lines={(budgetLines ?? []) as BudgetLine[]} />
      </Card>
    </div>
  );
}
