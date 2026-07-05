import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { ProductionTabs } from "@/components/production/production-tabs";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import type { CardView } from "@/components/production/shot-board-editor";
import type {
  CallSheet,
  CallSheetEntry,
  ShotBoard,
  ShotBoardFlavor,
  ShotGroup,
  BudgetLine,
} from "@/lib/database.types";

const SIGNED_TTL = 60 * 60;

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

  const [{ data: board }, { data: groups }, { data: callSheet }, { data: budgetLines }] =
    await Promise.all([
      supabase.from("shot_boards").select("*").eq("project_id", params.id).maybeSingle(),
      supabase
        .from("shot_groups")
        .select("*")
        .eq("project_id", params.id)
        .order("position", { ascending: true }),
      supabase.from("call_sheets").select("*").eq("project_id", params.id).maybeSingle(),
      supabase
        .from("budget_lines")
        .select("*")
        .eq("project_id", params.id)
        .order("position", { ascending: true }),
    ]);

  // Flavors + cards + call sheet entries (depend on the above ids).
  let flavors: ShotBoardFlavor[] = [];
  if (board) {
    const { data } = await supabase
      .from("shot_board_flavors")
      .select("*")
      .eq("board_id", (board as ShotBoard).id)
      .order("position", { ascending: true });
    flavors = (data ?? []) as ShotBoardFlavor[];
  }

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
      const { data: list } = await supabase.storage
        .from("assets")
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
      tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
      signedUrl: c.storage_path ? (signed.get(c.storage_path) ?? null) : null,
      image_name: c.image_name,
    }));
  }

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
        board={(board as ShotBoard | null) ?? null}
        flavors={flavors}
        groups={(groups ?? []) as ShotGroup[]}
        cards={cards}
        callSheet={(callSheet as CallSheet | null) ?? null}
        entries={entries}
        budgetLines={(budgetLines ?? []) as BudgetLine[]}
      />
    </div>
  );
}
