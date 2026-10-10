import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { signedLogoUrl } from "@/lib/branding";
import { PrintButton } from "@/components/production/print-button";
import { AutoPrint } from "@/components/production/auto-print";
import { ChevronLeftIcon } from "@/components/app-shell/nav-icons";
import { ReportView } from "@/components/reports/report-view";
import { loadStudioReport } from "@/lib/studio-reports-data";
import { PERIODS, isPeriod, periodRange, type Period } from "@/lib/studio-reports";

export const metadata = { title: "Studio report" };

function longDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The report as a document: forced light with print-exact colours like every
 * other export, every job opened, the studio's logo on top. `?auto=1` opens
 * it printing, which is the one-click Download PDF.
 */
export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams?: { period?: string; auto?: string };
}) {
  const ctx = await requireStudioContext();
  if (ctx.isCollaborator) redirect("/projects");
  const period: Period = isPeriod(searchParams?.period) ? searchParams!.period as Period : "year";
  const todayIso = new Date().toISOString().slice(0, 10);
  const [report, logoUrl] = await Promise.all([
    loadStudioReport(createClient(), ctx.studio.id, period, todayIso),
    signedLogoUrl(ctx.studio.logo_path),
  ]);
  const range = periodRange(period, todayIso);
  const label = PERIODS.find((p) => p.key === period)?.label ?? "";
  const span = range.start && range.end ? `${longDay(range.start)} to ${longDay(range.end)}` : "All time";

  return (
    <div className="mx-auto max-w-5xl">
      {searchParams?.auto ? <AutoPrint /> : null}
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/reports?period=${period}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition hover:text-text"
        >
          <ChevronLeftIcon /> Back to reports
        </Link>
        <PrintButton />
      </div>
      <div
        data-theme="light"
        className="rounded-[16px] bg-bg p-8 text-text [print-color-adjust:exact] print:rounded-none print:p-0"
      >
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Studio report</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-text">{ctx.studio.name}</h1>
            <p className="mt-1 text-sm text-text-muted">
              {label}: {span}. Prepared {longDay(todayIso)}.
            </p>
          </div>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-14 w-14 rounded-[12px] object-contain" />
          )}
        </header>
        <ReportView report={report} print />
      </div>
    </div>
  );
}
