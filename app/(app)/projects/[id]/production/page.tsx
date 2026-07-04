import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ProductionTabs } from "@/components/production/production-tabs";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import type { Shot, CallSheet, CallSheetEntry } from "@/lib/database.types";

export default async function ProductionPage({
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

  const [{ data: shots }, { data: callSheet }] = await Promise.all([
    supabase
      .from("shots")
      .select("*")
      .eq("project_id", params.id)
      .order("position", { ascending: true }),
    supabase
      .from("call_sheets")
      .select("*")
      .eq("project_id", params.id)
      .maybeSingle(),
  ]);

  let entries: CallSheetEntry[] = [];
  if (callSheet) {
    const { data } = await supabase
      .from("call_sheet_entries")
      .select("*")
      .eq("call_sheet_id", callSheet.id)
      .order("position", { ascending: true });
    entries = (data ?? []) as CallSheetEntry[];
  }

  return (
    <div>
      <Link
        href={`/projects/${project.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
      >
        <ChevronLeftIcon /> {project.title}
      </Link>

      <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight text-text">
        Production
      </h1>

      <ProductionTabs
        projectId={project.id}
        projectTitle={project.title}
        shots={(shots ?? []) as Shot[]}
        callSheet={(callSheet as CallSheet | null) ?? null}
        entries={entries}
      />
    </div>
  );
}
