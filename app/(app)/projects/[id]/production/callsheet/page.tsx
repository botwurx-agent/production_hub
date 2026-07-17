import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PrintButton } from "@/components/production/print-button";
import { AutoPrint } from "@/components/production/auto-print";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { signedLogoUrl } from "@/lib/branding";
import { CallSheetDocument } from "@/components/production/callsheet-document";
import type { CallSheet, CallSheetEntry } from "@/lib/database.types";

export default async function CallSheetPrintPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { cs?: string; auto?: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client:clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  // A specific call sheet (?cs=id), else the project's first by order.
  let query = supabase.from("call_sheets").select("*").eq("project_id", params.id);
  query = searchParams?.cs
    ? query.eq("id", searchParams.cs)
    : query.order("position", { ascending: true });
  const { data: cs } = await query.limit(1).maybeSingle();
  const s = cs as CallSheet | null;

  let entries: CallSheetEntry[] = [];
  if (s) {
    const { data } = await supabase
      .from("call_sheet_entries")
      .select("*")
      .eq("call_sheet_id", s.id)
      .order("position", { ascending: true });
    entries = (data ?? []) as CallSheetEntry[];
  }

  const logoUrl = await signedLogoUrl(ctx.studio.logo_path);
  const clientName = (project.client as { name: string } | null)?.name ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      {searchParams?.auto ? <AutoPrint /> : null}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/projects/${project.id}/callsheet`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
        >
          <ChevronLeftIcon /> Back to call sheet
        </Link>
        <PrintButton />
      </div>

      <CallSheetDocument
        sheet={s}
        entries={entries}
        logoUrl={logoUrl}
        studioName={ctx.studio.name}
        clientName={clientName}
      />
    </div>
  );
}
