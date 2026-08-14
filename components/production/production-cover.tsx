import type { ShotBoard } from "@/lib/database.types";

/**
 * The cover a production document opens on.
 *
 * Extracted from the shot list's export because the storyboard export needed
 * the same one, and a second copy would have drifted the moment either changed.
 * A job has ONE set of facts (client, agency, director, DP, job number), so
 * every document that leaves the studio should state them the same way.
 *
 * It reads the project's `shot_boards` row, which is where the operator
 * already fills that block in. That is the point: filling it in once on the
 * shot list is what makes the storyboard export arrive dressed.
 *
 * Dark on purpose, and print-exact, so it survives the trip to PDF rather than
 * arriving as a white rectangle with the ink saved.
 */

const printExact = {
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as React.CSSProperties;

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-text-faint">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-text">
        {value?.trim() ? value : "TBD"}
      </div>
    </div>
  );
}

export function ProductionCover({
  board,
  studioName,
  clientName,
  logoUrl,
  title,
  subtitle,
  overline,
  stamp = "Production · Confidential",
}: {
  /** The project's shot board, which holds the job block. Null is fine. */
  board: ShotBoard | null;
  studioName: string;
  clientName: string;
  logoUrl: string | null;
  title: string;
  subtitle?: string | null;
  /** What this document is: "Shot list", "Storyboard". */
  overline?: string | null;
  stamp?: string;
}) {
  const b = board;
  return (
    <div
      data-theme="dark"
      style={printExact}
      className="rounded-[16px] bg-bg p-8 text-text print:rounded-none"
    >
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {logoUrl && (
            <span
              style={printExact}
              className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={studioName}
                className="h-full w-full object-contain p-1"
              />
            </span>
          )}
          <div className="text-lg font-bold text-text">
            {studioName}
            {b?.agency?.trim() ? (
              <span className="text-text-faint"> × {b.agency}</span>
            ) : null}
          </div>
        </div>
        <span className="rounded-pill border border-border-strong px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-text-faint">
          {stamp}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          {overline && (
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-accent">
              {overline}
            </div>
          )}
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight text-text">
            {title}
          </h1>
          {subtitle?.trim() && (
            <p className="mt-3 max-w-md text-base text-text-muted">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-5 border-t border-border-strong pt-5 md:grid-cols-4">
        <Meta label="Client" value={clientName} />
        <Meta label="Agency" value={b?.agency} />
        <Meta label="Production Co." value={b?.production_co || studioName} />
        <Meta label="Deliverables" value={b?.deliverables} />
        <Meta label="Director" value={b?.director} />
        <Meta label="DP" value={b?.dp} />
        <Meta label="Location" value={b?.location} />
        <Meta label="Job No." value={b?.job_no} />
      </div>

      {(b?.shoot_days?.trim() || b?.rev_date?.trim()) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {b?.shoot_days?.trim() && (
            <span className="rounded-pill border border-border-strong px-3 py-1 text-xs font-bold uppercase tracking-wide text-text-muted">
              {b.shoot_days}
            </span>
          )}
          {b?.rev_date?.trim() && (
            <span className="rounded-pill border border-border-strong px-3 py-1 text-xs font-bold uppercase tracking-wide text-text-muted">
              Rev. {b.rev_date}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
