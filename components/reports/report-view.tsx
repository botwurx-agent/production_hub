import Link from "next/link";
import { money } from "@/lib/format";
import { daysLabel, type DeliveryState } from "@/lib/studio-reports";
import type { JobRow, StudioReport } from "@/lib/studio-reports-data";

/**
 * The studio report, presentational and hook-free so the page, the PDF export
 * and a fixture all mount the same thing. Words stay in the text colour and a
 * state's hue rides on a dot, the contrast lesson from the read banner.
 *
 * Each job opens with a native <details> (no script), and in the PDF every one
 * is printed open, since a printed page cannot be clicked.
 */
export function ReportView({
  report,
  print = false,
}: {
  report: StudioReport;
  print?: boolean;
}) {
  const { totals, onTime } = report;
  const delivered = onTime.onTime + onTime.late;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Tile label="Billed" value={money(totals.billed) || "$0"} note={`${report.jobs.length} ${report.jobs.length === 1 ? "job" : "jobs"}`} />
        <Tile label="Job cost" value={money(totals.cost) || "$0"} note="Costs logged against them" />
        <Tile
          label="Margin"
          value={money(totals.profit) || "$0"}
          note={totals.pct == null ? "Nothing billed yet" : `${totals.pct}% of billed`}
          dot={totals.profit < 0 ? "var(--h-red)" : undefined}
        />
        <Tile
          label="Delivered on time"
          value={onTime.rate == null ? "None yet" : `${onTime.rate}%`}
          note={delivered ? `${onTime.onTime} of ${delivered} delivered jobs` : "No dated deliveries yet"}
          dot={onTime.rate != null && onTime.rate < 75 ? "var(--h-amber)" : undefined}
        />
        <Tile
          label="Client response"
          value={daysLabel(report.medianResponseDays)}
          note={report.decisions ? `Median of ${report.decisions} decisions` : "No client decisions yet"}
        />
      </div>

      <section>
        <SectionTitle title="Jobs" hint={`What each job billed, what it cost, and whether it went out on time.${print ? "" : " Open a job to see where the cost went."}`} />
        {report.jobs.length === 0 ? (
          <Empty>No jobs land in this period.</Empty>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
            <div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_130px_170px] gap-3 border-b border-border px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-text-faint md:grid">
              <span>Job</span>
              <span className="text-right">Billed</span>
              <span className="text-right">Cost</span>
              <span className="text-right">Margin</span>
              <span>Delivery</span>
            </div>
            {report.jobs.map((j) => (
              <JobRowView key={j.projectId} job={j} print={print} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          title="Clients"
          hint="Who brings the work, how fast they answer a review link, and how often they send it back."
        />
        {report.clients.length === 0 ? (
          <Empty>No clients in this period.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-[14px] border border-border bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-text-faint">
                  <th className="px-4 py-2 font-bold">Client</th>
                  <th className="px-3 py-2 text-right font-bold">Jobs</th>
                  <th className="px-3 py-2 text-right font-bold">Billed</th>
                  <th className="px-3 py-2 text-right font-bold">Margin</th>
                  <th className="px-3 py-2 text-right font-bold">Answers in</th>
                  <th className="px-4 py-2 text-right font-bold">Change requests per job</th>
                </tr>
              </thead>
              <tbody>
                {report.clients.map((c) => (
                  <tr key={c.clientId ?? "none"} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-semibold text-text">
                      {c.clientId && !print ? (
                        <Link href={`/clients/${c.clientId}`} className="hover:underline">
                          {c.clientName}
                        </Link>
                      ) : (
                        c.clientName
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-text">{c.jobs}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-text">{money(c.billed) || "$0"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-text">
                      {c.profit < 0 && <Dot color="var(--h-red)" />}
                      {money(c.profit) || "$0"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-text">
                      {c.decisions ? daysLabel(c.medianDays) : <span className="text-text-faint">No reviews</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text">
                      {c.roundsPerJob == null ? (
                        <span className="text-text-faint">No reviews</span>
                      ) : (
                        <>
                          {c.roundsPerJob >= 2 && <Dot color="var(--h-amber)" />}
                          {c.roundsPerJob}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-1.5 text-[13px] leading-relaxed text-text-muted">
        <p>
          A job belongs to the period of its due date, or the day it was started
          if it has none. Billed is the job&apos;s invoices made here, or the
          billed figure on its delivery page when there are none. Cost is the
          same figure the job&apos;s budget page shows.
        </p>
        <p>
          On time compares the day a job was moved to Delivered with its due
          date. Client response runs from when the work reached the client (the
          review link, or a later version) to their first approve or change
          request on it.
          {onTime.unknown > 0 &&
            ` ${onTime.unknown} delivered ${onTime.unknown === 1 ? "job has" : "jobs have"} no recorded delivery date, so ${onTime.unknown === 1 ? "it is" : "they are"} left out of the on-time rate.`}
        </p>
      </section>
    </div>
  );
}

function JobRowView({ job, print }: { job: JobRow; print: boolean }) {
  const pct = job.margin.pct;
  return (
    <details open={print} className="group border-b border-border last:border-0 print:break-inside-avoid">
      <summary className="grid cursor-pointer list-none grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 transition hover:bg-surface-2 md:grid-cols-[minmax(0,1fr)_110px_110px_130px_170px] [&::-webkit-details-marker]:hidden">
        <span className="col-span-2 min-w-0 md:col-span-1">
          <span className="flex items-center gap-1.5">
            {!print && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="shrink-0 text-text-faint transition group-open:rotate-90">
                <path d="m9 6 6 6-6 6" />
              </svg>
            )}
            <span className="truncate font-semibold text-text">{job.title}</span>
          </span>
          <span className={`block truncate text-[13px] text-text-muted ${print ? "" : "pl-[17px]"}`}>
            {job.clientName ?? "No client"}
          </span>
        </span>
        <Cell label="Billed">{job.billedSource === "none" ? <span className="text-text-faint">Not billed</span> : money(job.billed)}</Cell>
        <Cell label="Cost">{money(job.margin.cost) || "$0"}</Cell>
        <Cell label="Margin">
          {job.margin.profit < 0 && <Dot color="var(--h-red)" />}
          {money(job.margin.profit) || "$0"}
          {pct != null && <span className="ml-1 text-text-faint">{pct}%</span>}
        </Cell>
        <span className="col-span-2 md:col-span-1">
          <DeliveryLabel state={job.delivery} />
        </span>
      </summary>
      <div className={`grid gap-5 bg-surface-2 px-4 py-4 md:grid-cols-2 ${print ? "" : "md:pl-[33px]"}`}>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">Where the cost went</p>
          {job.breakdown.length === 0 ? (
            <p className="text-sm text-text-muted">No costs logged on this job.</p>
          ) : (
            <ul className="space-y-1.5">
              {job.breakdown.map((b) => (
                <li key={b.label} className="text-sm">
                  <span className="flex justify-between gap-3">
                    <span className="truncate text-text">{b.label}</span>
                    <span className="shrink-0 tabular-nums text-text">{money(b.amount)}</span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-border">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(2, Math.round((b.amount / (job.margin.cost || 1)) * 100))}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-1.5 text-sm text-text">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">How it was worked out</p>
          <p>
            Billed{" "}
            {job.billedSource === "invoices"
              ? "from the invoices made for this job."
              : job.billedSource === "manual"
                ? "from the figure on the job's delivery page (no invoice made here)."
                : "nothing yet."}
          </p>
          <p>{job.changeRequests === 0 ? "The client has not sent anything back." : `The client sent work back ${job.changeRequests} ${job.changeRequests === 1 ? "time" : "times"}.`}</p>
          {!print && (
            <p className="pt-1">
              <Link href={`/projects/${job.projectId}/budget`} className="font-semibold text-accent hover:underline">
                Open the budget
              </Link>
            </p>
          )}
        </div>
      </div>
    </details>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap text-sm tabular-nums text-text md:text-right">
      <span className="mr-1.5 text-[11px] font-bold uppercase tracking-wide text-text-faint md:hidden">{label}</span>
      {children}
    </span>
  );
}

function shortDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function DeliveryLabel({ state }: { state: DeliveryState }) {
  const [color, text] =
    state.kind === "on_time"
      ? ["var(--h-green)", state.daysEarly ? `On time, ${plural(state.daysEarly, "day")} early` : "On time"]
      : state.kind === "late"
        ? ["var(--h-red)", `${plural(state.daysLate, "day")} late`]
        : state.kind === "overdue"
          ? ["var(--h-amber)", `Overdue by ${plural(state.daysOver, "day")}`]
          : state.kind === "open"
            ? ["var(--h-blue)", "In progress"]
            : state.kind === "no_due"
              ? ["var(--border-strong)", "Delivered, no due date"]
              : ["var(--border-strong)", "Delivered, date not recorded"];
  return (
    <span className="inline-flex items-center text-[13px] font-medium text-text">
      <Dot color={color} />
      {text}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full align-middle" style={{ background: color }} />;
}

function Tile({ label, value, note, dot }: { label: string; value: string; note: string; dot?: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-text-faint">{label}</p>
      <p className="mt-1 flex items-center font-display text-2xl font-extrabold tracking-tight text-text">
        {dot && <Dot color={dot} />}
        {value}
      </p>
      <p className="mt-0.5 text-[13px] text-text-muted">{note}</p>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-lg font-bold text-text">{title}</h2>
      <p className="text-sm text-text-muted">{hint}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-border-strong bg-surface px-6 py-10 text-center text-sm text-text-muted">
      {children}
    </div>
  );
}
