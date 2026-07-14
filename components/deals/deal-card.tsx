import Link from "next/link";
import { DealStageMenu } from "@/components/deals/deal-stage-menu";
import { money, shortDate } from "@/lib/format";
import type { DealRow } from "@/components/deals/types";

// A deal on the pipeline board. Title is the hero; account, value and close
// date sit quieter beneath. The stage menu moves it across the pipeline.
export function DealCard({ deal }: { deal: DealRow }) {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-3 shadow-sm transition hover:-translate-y-px hover:shadow-md">
      <Link
        href={`/pipeline/${deal.id}`}
        className="block truncate font-display text-sm font-bold text-text hover:text-accent"
      >
        {deal.title}
      </Link>
      <Link
        href={`/clients/${deal.account_id}`}
        className="mt-0.5 block truncate text-xs text-text-muted hover:text-accent"
      >
        {deal.account_name}
      </Link>
      {(deal.value != null || deal.expected_close_date) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {deal.value != null && (
            <span className="font-bold text-text">{money(deal.value)}</span>
          )}
          {deal.expected_close_date && (
            <span className="text-text-faint">
              {money(deal.value) && deal.expected_close_date ? "· " : ""}
              {shortDate(deal.expected_close_date)}
            </span>
          )}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <DealStageMenu dealId={deal.id} stage={deal.stage} />
        {deal.won_project_id && (
          <Link
            href={`/projects/${deal.won_project_id}`}
            className="shrink-0 text-xs font-semibold text-accent hover:underline"
          >
            Project &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
