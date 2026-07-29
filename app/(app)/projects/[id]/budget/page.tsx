import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudioContext } from "@/lib/studio";
import { Card } from "@/components/ui/card";
import { ProjectSubhead } from "@/components/projects/project-subhead";
import { BudgetTable } from "@/components/production/budget-table";
import type { RosterOption } from "@/components/production/cost-ledger";
import { loadContactRates } from "@/lib/rates";
import { computeTotals, type DocSnapshotLine } from "@/lib/billing-doc";
import type { BudgetLine, CostPayment, ProjectCost } from "@/lib/database.types";

export default async function BudgetPage({
  params,
}: {
  params: { id: string };
}) {
  await requireStudioContext();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const [
    { data: budgetLines },
    { data: costs },
    { data: roster },
    { data: invoices },
    { data: billing },
  ] =
    await Promise.all([
      supabase
        .from("budget_lines")
        .select("*")
        .eq("project_id", params.id)
        .order("position", { ascending: true }),
      supabase
        .from("project_costs")
        .select("*")
        .eq("project_id", params.id)
        .order("invoice_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      // The roster is the vendor picker: a crew invoice almost always comes
      // from someone already on the project.
      supabase
        .from("contacts")
        .select("id, name, company, role")
        .eq("project_id", params.id)
        .order("name", { ascending: true }),
      // The billed side of margin. Only invoices count: an estimate or a
      // proposal is what you hoped to charge, not what you charged.
      supabase
        .from("billing_documents")
        .select("id, discount")
        .eq("project_id", params.id)
        .eq("kind", "invoice"),
      // Fallback when no invoice has been generated in-app yet, mirroring how a
      // budget line falls back to its typed actual.
      supabase
        .from("project_billing")
        .select("amount")
        .eq("project_id", params.id)
        .maybeSingle(),
    ]);

  // Payments hang off the project's costs, so they are fetched by cost id
  // rather than by project.
  const costIds = (costs ?? []).map((c) => c.id);
  const { data: payments } = costIds.length
    ? await supabase
        .from("cost_payments")
        .select("*")
        .in("cost_id", costIds)
    : { data: [] as CostPayment[] };

  // Rates come from their own studio-only table, so a collaborator gets none
  // without any check here (migration 0074).
  const contactRates = await loadContactRates(
    supabase,
    (roster ?? []).map((c) => c.id)
  );
  const rosterWithRates = (roster ?? []).map((c) => ({
    ...c,
    rate: contactRates.get(c.id) ?? null,
  }));

  // Today is resolved on the SERVER and passed down, matching the dashboard
  // calendar, so an overdue payment cannot render differently after hydration.
  const todayIso = new Date().toISOString().slice(0, 10);

  // Totals live on the lines, not the document, so they are summed here the
  // same way the document renderer does it.
  const invoiceIds = (invoices ?? []).map((d) => d.id);
  const { data: invoiceLines } = invoiceIds.length
    ? await supabase
        .from("billing_document_lines")
        .select("document_id, description, rate, qty, tax_rate")
        .in("document_id", invoiceIds)
    : {
        data: [] as {
          document_id: string;
          description: string;
          rate: number;
          qty: number;
          tax_rate: number;
        }[],
      };

  const billedFromInvoices = (invoices ?? []).reduce((sum, doc) => {
    const lines = (invoiceLines ?? []).filter((l) => l.document_id === doc.id);
    return sum + computeTotals(lines as DocSnapshotLine[], Number(doc.discount) || 0).total;
  }, 0);

  const billed =
    invoiceIds.length > 0 ? billedFromInvoices : Number(billing?.amount) || 0;

  return (
    <div>
      <ProjectSubhead
        projectId={project.id}
        projectTitle={project.title}
        section="Budget"
        hue="indigo"
        subtitle="Track the estimate against actual spend, line by line."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
      />
      <Card className="p-5">
        <BudgetTable
          projectId={project.id}
          lines={(budgetLines ?? []) as BudgetLine[]}
          costs={(costs ?? []) as ProjectCost[]}
          roster={rosterWithRates as RosterOption[]}
          billed={billed}
          billedFromInvoices={invoiceIds.length > 0}
          payments={(payments ?? []) as CostPayment[]}
          todayIso={todayIso}
        />
      </Card>
    </div>
  );
}
