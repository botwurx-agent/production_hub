import Link from "next/link";
import { DealStageMenu } from "@/components/deals/deal-stage-menu";
import { money, shortDate } from "@/lib/format";
import type { DealRow } from "@/components/deals/types";

export function DealList({ deals }: { deals: DealRow[] }) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-text-faint">
            <th className="px-4 py-3">Deal</th>
            <th className="px-4 py-3">Company</th>
            <th className="hidden px-4 py-3 sm:table-cell">Value</th>
            <th className="hidden px-4 py-3 md:table-cell">Close</th>
            <th className="px-4 py-3">Stage</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr
              key={d.id}
              className="border-b border-border last:border-0 transition hover:bg-surface-2/60"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/pipeline/${d.id}`}
                  className="font-semibold text-text hover:text-accent"
                >
                  {d.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/clients/${d.account_id}`}
                  className="text-text-muted hover:text-accent"
                >
                  {d.account_name}
                </Link>
              </td>
              <td className="hidden px-4 py-3 font-semibold text-text sm:table-cell">
                {d.value != null ? money(d.value) : "-"}
              </td>
              <td className="hidden px-4 py-3 text-text-muted md:table-cell">
                {d.expected_close_date ? shortDate(d.expected_close_date) : "-"}
              </td>
              <td className="px-4 py-3">
                <DealStageMenu dealId={d.id} stage={d.stage} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
