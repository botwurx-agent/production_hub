import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { ReportsIcon } from "@/components/app-shell/nav-icons";
import { ReportView } from "@/components/reports/report-view";
import { loadStudioReport } from "@/lib/studio-reports-data";
import { PERIODS, isPeriod, type Period } from "@/lib/studio-reports";

export const metadata = { title: "Reports" };

/**
 * Studio reports: what the jobs made, whether they went out on time, and how
 * each client reviews. Everything is read from rows that exist for other
 * reasons, so there is nothing here to keep up to date.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) redirect("/projects");
  const period: Period = isPeriod(searchParams?.period) ? searchParams!.period as Period : "year";
  // Resolved on the server so "overdue" cannot differ after hydration.
  const todayIso = new Date().toISOString().slice(0, 10);
  const report = await loadStudioReport(createClient(), ctx.studio.id, period, todayIso);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reports"
        subtitle="What your jobs made, whether they went out on time, and how each client reviews."
        icon={<ReportsIcon />}
        hue="cyan"
        action={
          <a
            href={`/reports/print?period=${period}&auto=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text transition hover:border-border-strong"
          >
            Download PDF
          </a>
        }
      />
      <div className="mb-6 flex flex-wrap gap-1.5" role="tablist" aria-label="Period">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/reports?period=${p.key}`}
            role="tab"
            aria-selected={p.key === period}
            className={`rounded-pill px-3.5 py-1.5 text-sm font-semibold transition ${
              p.key === period
                ? "bg-accent-soft text-accent"
                : "border border-border bg-surface text-text-muted hover:text-text"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <ReportView report={report} />
    </div>
  );
}
