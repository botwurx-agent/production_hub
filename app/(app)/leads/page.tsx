import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { NewLeadButton } from "@/components/leads/new-lead-button";
import { LeadStageMenu } from "@/components/leads/lead-stage-menu";
import { ConvertButton } from "@/components/leads/convert-button";
import { LeadsIcon } from "@/components/app-shell/nav-icons";

export default async function LeadsPage() {
  await requireStudioContext();
  const supabase = createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, company, source, stage, converted_client_id")
    .order("created_at", { ascending: false });

  const rows = leads ?? [];

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
        <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-bold uppercase tracking-wide text-text-faint">
                <th className="px-4 py-3">Company</th>
                <th className="hidden px-4 py-3 sm:table-cell">Source</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-border last:border-0 transition hover:bg-surface-2/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/leads/${l.id}`}
                      className="font-semibold text-text hover:text-accent"
                    >
                      {l.company}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-text-muted sm:table-cell">
                    {l.source ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStageMenu leadId={l.id} stage={l.stage} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {l.converted_client_id ? (
                      <Link
                        href={`/clients/${l.converted_client_id}`}
                        className="text-sm font-semibold text-accent hover:underline"
                      >
                        View client
                      </Link>
                    ) : (
                      <ConvertButton leadId={l.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
