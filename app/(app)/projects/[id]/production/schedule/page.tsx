/**
 * The schedule's print / export view.
 *
 * Same shape as the shot list and storyboard exports: the shared
 * ProductionCover states the job once, then the document itself, forced light
 * with print-exact colours so a producer working in dark mode does not print
 * white type onto white paper. `?auto=1` opens it printing (the one-click PDF
 * button); `?day=<id>` exports a single day, since a unit is usually handed
 * tomorrow rather than the whole week.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { loadSchedule } from "@/lib/schedule-data";
import { PrintButton } from "@/components/production/print-button";
import { AutoPrint } from "@/components/production/auto-print";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { signedLogoUrl } from "@/lib/branding";
import { ProductionCover } from "@/components/production/production-cover";
import { ScheduleDocument } from "@/components/production/schedule-document";
import type { ShotBoard } from "@/lib/database.types";

export default async function SchedulePrintPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { day?: string; auto?: string };
}) {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client:clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  // The job block lives on shot_boards, the same row the shot list and
  // storyboard exports read, so filling it in once dresses every document.
  const [{ data: board }, days] = await Promise.all([
    supabase.from("shot_boards").select("*").eq("project_id", params.id).maybeSingle(),
    loadSchedule(supabase, params.id),
  ]);
  const b = (board ?? null) as ShotBoard | null;

  const selected = searchParams?.day && searchParams.day !== "all" ? searchParams.day : null;
  const visible = selected ? days.filter((d) => d.id === selected) : days;

  const logoUrl = await signedLogoUrl(ctx.studio.logo_path);
  const clientName =
    b?.client?.trim() || (project.client as { name: string } | null)?.name || "";
  const overline = [b?.client?.trim(), b?.agency?.trim()].filter(Boolean).join(" × ");

  return (
    <div className="mx-auto max-w-5xl">
      {searchParams?.auto ? <AutoPrint /> : null}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/projects/${project.id}/schedule`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
        >
          <ChevronLeftIcon /> Back to schedule
        </Link>
        <PrintButton />
      </div>

      {/* Which days to export. A unit is usually handed tomorrow, not the week. */}
      {days.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 print:hidden">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-text-faint">
            Export
          </span>
          <Link
            href={`/projects/${project.id}/production/schedule`}
            className={`rounded-pill px-3 py-1 text-xs font-semibold transition ${
              !selected
                ? "bg-accent-soft text-accent"
                : "border border-border text-text-muted hover:text-text"
            }`}
          >
            Whole schedule
          </Link>
          {days.map((d) => (
            <Link
              key={d.id}
              href={`/projects/${project.id}/production/schedule?day=${d.id}`}
              className={`rounded-pill px-3 py-1 text-xs font-semibold transition ${
                selected === d.id
                  ? "bg-accent-soft text-accent"
                  : "border border-border text-text-muted hover:text-text"
              }`}
            >
              {d.name}
            </Link>
          ))}
        </div>
      )}

      <ProductionCover
        board={b}
        studioName={ctx.studio.name}
        clientName={clientName}
        logoUrl={logoUrl}
        title={b?.title?.trim() || project.title}
        subtitle={b?.subtitle}
        overline={overline || "Shooting schedule"}
      />

      <div data-theme="light" className="mt-6">
        <ScheduleDocument days={visible} />
      </div>
    </div>
  );
}
