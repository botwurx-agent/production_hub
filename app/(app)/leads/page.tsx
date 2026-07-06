import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { NewLeadButton } from "@/components/leads/new-lead-button";
import { LeadsView } from "@/components/leads/leads-view";
import { getLeadFollowups } from "@/lib/leads-followup";
import { LeadsIcon } from "@/components/app-shell/nav-icons";
import type { LeadRow } from "@/components/leads/types";

export default async function LeadsPage() {
  await requireStudioContext();
  const supabase = createClient();

  const [{ data: leads }, followUps] = await Promise.all([
    supabase
      .from("leads")
      .select("id, company, source, stage, converted_client_id")
      .order("created_at", { ascending: false }),
    getLeadFollowups(),
  ]);

  const rows = (leads ?? []) as LeadRow[];

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Prospects, from first contact to won."
        icon={<LeadsIcon className="h-6 w-6" />}
        hue="pink"
        action={<NewLeadButton />}
      />
      {rows.length === 0 ? (
        <EmptyState
          hue="pink"
          icon={<LeadsIcon className="h-7 w-7" />}
          title="No leads yet"
          description="Leads are prospects at the front of the pipeline. Track them through your stages and convert the ones you win into clients."
          action={<NewLeadButton />}
          steps={[
            {
              title: "Capture",
              text: "Add a prospect with its source and a note.",
            },
            {
              title: "Qualify",
              text: "Move it along the pipeline as it heats up.",
            },
            {
              title: "Convert",
              text: "Turn a won lead into a client and start a project.",
            },
          ]}
        />
      ) : (
        <LeadsView leads={rows} followUps={followUps} />
      )}
    </div>
  );
}
