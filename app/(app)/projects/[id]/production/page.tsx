import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ProductionTabs } from "@/components/production/production-tabs";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import type {
  CallSheet,
  CallSheetEntry,
  BudgetLine,
  GearItem,
  Deliverable,
  ProjectBilling,
} from "@/lib/database.types";

const PRODUCTION_TABS = ["callsheet", "budget", "gear", "delivery"] as const;
type ProductionTab = (typeof PRODUCTION_TABS)[number];

export default async function ProductionPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const initialTab: ProductionTab = PRODUCTION_TABS.includes(
    searchParams?.tab as ProductionTab
  )
    ? (searchParams?.tab as ProductionTab)
    : "callsheet";

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const [
    { data: callSheet },
    { data: budgetLines },
    { data: gearItems },
    { data: deliverables },
    { data: billing },
  ] = await Promise.all([
      supabase.from("call_sheets").select("*").eq("project_id", params.id).maybeSingle(),
      supabase
        .from("budget_lines")
        .select("*")
        .eq("project_id", params.id)
        .order("position", { ascending: true }),
      supabase
        .from("gear_items")
        .select("*")
        .eq("project_id", params.id)
        .order("position", { ascending: true }),
      supabase
        .from("deliverables")
        .select("*")
        .eq("project_id", params.id)
        .order("position", { ascending: true }),
      supabase.from("project_billing").select("*").eq("project_id", params.id).maybeSingle(),
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
        callSheet={(callSheet as CallSheet | null) ?? null}
        entries={entries}
        budgetLines={(budgetLines ?? []) as BudgetLine[]}
        gearItems={(gearItems ?? []) as GearItem[]}
        deliverables={(deliverables ?? []) as Deliverable[]}
        billing={(billing as ProjectBilling | null) ?? null}
        initialTab={initialTab}
      />
    </div>
  );
}
