import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { NewLeadButton } from "@/components/leads/new-lead-button";
import { LeadsView } from "@/components/leads/leads-view";
import { LeadsIcon } from "@/components/app-shell/nav-icons";
import type { LeadRow } from "@/components/leads/types";

export default async function LeadsPage() {
  await requireStudioContext();
  const supabase = createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, company, source, stage, converted_client_id")
    .order("created_at", { ascending: false });

  const rows = (leads ?? []) as LeadRow[];

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Prospects, from first contact to won."
        action={<NewLeadButton />}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<LeadsIcon className="h-7 w-7" />}
          title="No leads yet"
          description="Capture a prospect, track its stage, and convert it to a client when you win the work."
          action={<NewLeadButton />}
        />
      ) : (
        <LeadsView leads={rows} />
      )}
    </div>
  );
}
