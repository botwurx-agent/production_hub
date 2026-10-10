import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { computeTotals, type DocSnapshotLine } from "@/lib/billing-doc";
import {
  clientRows,
  deliveredDates,
  deliveryState,
  inPeriod,
  median,
  moneyTotals,
  onTimeSummary,
  periodRange,
  projectMoney,
  turnaroundDays,
  type ClientDecision,
  type ClientRow,
  type DeliveryState,
  type MoneyRow,
  type OnTime,
  type Period,
  type ReportProject,
} from "@/lib/studio-reports";
import type { Margin } from "@/lib/costs";

type Db = SupabaseClient<Database>;

export type JobRow = MoneyRow & {
  status: string;
  dueDate: string | null;
  day: string;
  delivery: DeliveryState;
  changeRequests: number;
};

export type StudioReport = {
  period: Period;
  jobs: JobRow[];
  clients: ClientRow[];
  totals: Margin;
  onTime: OnTime;
  medianResponseDays: number | null;
  decisions: number;
};

/** `.in()` travels in the URL, so long id lists go in batches. */
async function inBatches<T>(
  ids: string[],
  run: (batch: string[]) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await run(ids.slice(i, i + 150));
    if (data) out.push(...data);
  }
  return out;
}

/**
 * Everything the reports page shows, read through the caller's RLS client.
 * Every table here is studio-member readable (money is is_studio_member only),
 * which is the right audience: a collaborator never reaches this page.
 */
export async function loadStudioReport(
  supabase: Db,
  studioId: string,
  period: Period,
  todayIso: string
): Promise<StudioReport> {
  const { data: rawProjects } = await supabase
    .from("projects")
    .select("id, title, client_id, status, due_date, created_at, client:clients(name)")
    .eq("studio_id", studioId);

  const range = periodRange(period, todayIso);
  // Archived jobs stay in: finished work is most of what a report is about.
  const projects: ReportProject[] = (rawProjects ?? [])
    .map((p) => ({
      id: p.id,
      title: p.title,
      clientId: p.client_id,
      clientName: (p.client as { name?: string } | null)?.name ?? null,
      status: p.status,
      dueDate: p.due_date,
      createdAt: p.created_at,
    }))
    .filter((p) => inPeriod(p, range));
  const ids = projects.map((p) => p.id);

  const empty: StudioReport = {
    period,
    jobs: [],
    clients: [],
    totals: moneyTotals([]),
    onTime: onTimeSummary([]),
    medianResponseDays: null,
    decisions: 0,
  };
  if (!ids.length) return empty;

  const [lines, costs, invoices, billing, activity, links] = await Promise.all([
    inBatches(ids, (b) =>
      supabase.from("budget_lines").select("id, project_id, category, actual").in("project_id", b)
    ),
    inBatches(ids, (b) =>
      supabase.from("project_costs").select("project_id, budget_line_id, amount").in("project_id", b)
    ),
    inBatches(ids, (b) =>
      supabase
        .from("billing_documents")
        .select("id, project_id, discount")
        .eq("kind", "invoice")
        .in("project_id", b)
    ),
    inBatches(ids, (b) =>
      supabase.from("project_billing").select("project_id, amount").in("project_id", b)
    ),
    inBatches(ids, (b) =>
      supabase
        .from("activity")
        .select("project_id, type, content, created_at")
        .eq("type", "status_change")
        .in("project_id", b)
    ),
    inBatches(ids, (b) =>
      supabase.from("review_links").select("id, project_id, created_at").in("project_id", b)
    ),
  ]);

  const invoiceIds = invoices.map((d) => d.id);
  const [invoiceLines, approvals] = await Promise.all([
    inBatches(invoiceIds, (b) =>
      supabase
        .from("billing_document_lines")
        .select("document_id, rate, qty, tax_rate")
        .in("document_id", b)
    ),
    inBatches(
      links.map((l) => l.id),
      (b) =>
        supabase
          .from("approvals")
          .select("target_type, target_id, status, created_at, review_link_id")
          .in("review_link_id", b)
    ),
  ]);
  const versionIds = approvals.filter((a) => a.target_type === "version").map((a) => a.target_id);
  const versions = await inBatches(versionIds, (b) =>
    supabase.from("versions").select("id, created_at").in("id", b)
  );

  // Billed per project, the budget page's rule: invoices when any exist.
  const invoiceTotal = new Map<string, number>();
  for (const doc of invoices) {
    if (!doc.project_id) continue;
    const docLines = invoiceLines.filter((l) => l.document_id === doc.id);
    const total = computeTotals(docLines.map((l) => ({ ...l, description: "" })) as DocSnapshotLine[], Number(doc.discount) || 0).total;
    invoiceTotal.set(doc.project_id, (invoiceTotal.get(doc.project_id) ?? 0) + total);
  }
  const manualBilled = new Map(billing.map((b) => [b.project_id, b.amount]));

  const money = projects.map((p) =>
    projectMoney(
      p,
      lines.filter((l) => l.project_id === p.id),
      costs.filter((c) => c.project_id === p.id),
      invoiceTotal.has(p.id) ? invoiceTotal.get(p.id)! : null,
      manualBilled.get(p.id)
    )
  );

  // The client's own decisions through their links.
  const linkById = new Map(links.map((l) => [l.id, l]));
  const versionAt = new Map(versions.map((v) => [v.id, v.created_at]));
  const decisions: ClientDecision[] = [];
  for (const a of approvals) {
    const link = a.review_link_id ? linkById.get(a.review_link_id) : null;
    if (!link) continue;
    const vAt = a.target_type === "version" ? versionAt.get(a.target_id) : undefined;
    // A version uploaded after the link was made was in front of them from
    // the upload, not from when the link was first shared.
    const sentAt = vAt && vAt > link.created_at ? vAt : link.created_at;
    decisions.push({ projectId: link.project_id, status: a.status, sentAt, decidedAt: a.created_at });
  }

  const delivered = deliveredDates(activity);
  const jobs: JobRow[] = projects
    .map((p, i) => ({
      ...money[i],
      status: p.status,
      dueDate: p.dueDate,
      day: (p.dueDate ?? p.createdAt).slice(0, 10),
      delivery: deliveryState(p, delivered.get(p.id), todayIso),
      changeRequests: decisions.filter(
        (d) => d.projectId === p.id && d.status === "changes_requested"
      ).length,
    }))
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.title.localeCompare(b.title)));

  const days = decisions
    .map((d) => turnaroundDays(d.sentAt, d.decidedAt))
    .filter((n): n is number => n != null);

  return {
    period,
    jobs,
    clients: clientRows(projects, decisions, money),
    totals: moneyTotals(money),
    onTime: onTimeSummary(jobs.map((j) => j.delivery)),
    medianResponseDays: median(days),
    decisions: decisions.length,
  };
}
