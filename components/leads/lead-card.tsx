import Link from "next/link";
import { LeadStageMenu } from "@/components/leads/lead-stage-menu";
import { ConvertButton } from "@/components/leads/convert-button";
import { FollowUpTag } from "@/components/leads/follow-up-tag";
import type { LeadRow } from "@/components/leads/types";

// A lead on the pipeline board. Company is the hero; the stage menu moves it
// across the pipeline. Convert appears once it is won (and not yet converted).
export function LeadCard({
  lead,
  followUpDays,
}: {
  lead: LeadRow;
  followUpDays?: number;
}) {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-3 shadow-sm transition hover:-translate-y-px hover:shadow-md">
      <Link
        href={`/leads/${lead.id}`}
        className="block truncate font-display text-sm font-bold text-text hover:text-accent"
      >
        {lead.company}
      </Link>
      {lead.source && (
        <div className="mt-0.5 truncate text-xs text-text-faint">
          {lead.source}
        </div>
      )}
      {followUpDays != null && (
        <div className="mt-2">
          <FollowUpTag days={followUpDays} />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <LeadStageMenu leadId={lead.id} stage={lead.stage} />
        {lead.converted_client_id ? (
          <Link
            href={`/clients/${lead.converted_client_id}`}
            className="shrink-0 text-xs font-semibold text-accent hover:underline"
          >
            Client &rarr;
          </Link>
        ) : lead.stage === "won" ? (
          <ConvertButton leadId={lead.id} />
        ) : null}
      </div>
    </div>
  );
}
