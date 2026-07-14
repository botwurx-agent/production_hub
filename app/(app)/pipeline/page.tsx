import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { NewDealButton } from "@/components/deals/new-deal-button";
import { DealsView } from "@/components/deals/deals-view";
import { LeadsIcon } from "@/components/app-shell/nav-icons";
import type { DealRow, AccountOption } from "@/components/deals/types";

export default async function PipelinePage() {
  const ctx = await requireStudioContext();
  const supabase = createClient();

  const [{ data: deals }, { data: accounts }] = await Promise.all([
    supabase
      .from("deals")
      .select(
        "id, title, value, stage, expected_close_date, owner_id, account_id, won_project_id, account:clients(name)"
      )
      .order("sort", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const rows: DealRow[] = (deals ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    value: d.value,
    stage: d.stage,
    expected_close_date: d.expected_close_date,
    owner_id: d.owner_id,
    account_id: d.account_id,
    won_project_id: d.won_project_id,
    account_name: (d.account as { name: string } | null)?.name ?? "Unknown",
  }));
  const accountOpts: AccountOption[] = accounts ?? [];

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Every opportunity, from first inquiry to awarded."
        icon={<LeadsIcon className="h-6 w-6" />}
        hue="pink"
        action={<NewDealButton accounts={accountOpts} />}
      />
      {rows.length === 0 ? (
        <EmptyState
          hue="pink"
          icon={<LeadsIcon className="h-7 w-7" />}
          title="No deals yet"
          description="A deal is a potential job on a company. Track it through your stages and win it into a project."
          action={<NewDealButton accounts={accountOpts} />}
          steps={[
            {
              title: "Capture",
              text: "Add a deal, its company, value, and expected close.",
            },
            {
              title: "Advance",
              text: "Move it inbound to qualifying to bidding as it heats up.",
            },
            {
              title: "Win",
              text: "Mark it awarded: the company becomes a client, ready for a project.",
            },
          ]}
        />
      ) : (
        <DealsView deals={rows} currentUserId={ctx.userId} />
      )}
    </div>
  );
}
