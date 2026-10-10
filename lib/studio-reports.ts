/**
 * Studio reports: the numbers the studio already holds, rolled up across jobs.
 *
 * Pure and not `server-only`, so the page, the PDF export and the scratchpad
 * tests all run the same rules. Every figure is DERIVED from rows that exist
 * for other reasons (costs, invoices, approvals, the activity log), never
 * stored, so a report cannot drift away from the pages it summarises.
 *
 * Money uses the budget page's own rules (lineActual / rollUpActual, invoices
 * before the manual billed figure, margin on revenue), so a job reads the same
 * here as on its own budget page.
 */
import { lineActual, marginOf, type Margin } from "@/lib/costs";

export type Period = "year" | "12m" | "all";
export const PERIODS: { key: Period; label: string }[] = [
  { key: "year", label: "This year" },
  { key: "12m", label: "Last 12 months" },
  { key: "all", label: "All time" },
];

export function isPeriod(v: unknown): v is Period {
  return v === "year" || v === "12m" || v === "all";
}

/**
 * The days a period covers, inclusive, as YYYY-MM-DD. Null ends are open:
 * "all time" has neither. "This year" runs to Dec 31, so a job due next month
 * is already this year's work; "last 12 months" stops at today.
 */
export function periodRange(
  period: Period,
  todayIso: string
): { start: string | null; end: string | null } {
  if (period === "all") return { start: null, end: null };
  const y = Number(todayIso.slice(0, 4));
  if (period === "year") return { start: `${y}-01-01`, end: `${y}-12-31` };
  return { start: `${y - 1}${todayIso.slice(4, 10)}`, end: todayIso.slice(0, 10) };
}

export type ReportProject = {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
};

/**
 * A job belongs to the period it LANDS in: its due date, or the day it was
 * started when it has none. A job started in December and due in March is
 * March's work.
 */
export function projectDay(p: Pick<ReportProject, "dueDate" | "createdAt">): string {
  return (p.dueDate ?? p.createdAt).slice(0, 10);
}

export function inPeriod(
  p: Pick<ReportProject, "dueDate" | "createdAt">,
  range: { start: string | null; end: string | null }
): boolean {
  const day = projectDay(p);
  if (range.start && day < range.start) return false;
  if (range.end && day > range.end) return false;
  return true;
}

/* ------------------------------------------------------------- money */

export type LineRow = { id: string; project_id: string; category: string | null; actual: number | null };
export type CostRow = { project_id: string; budget_line_id: string | null; amount: number | string };

export type MoneyRow = {
  projectId: string;
  title: string;
  clientName: string | null;
  billed: number;
  billedSource: "invoices" | "manual" | "none";
  margin: Margin;
  /** What the cost is made of, biggest first: the "why this amount". */
  breakdown: { label: string; amount: number }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function projectMoney(
  project: Pick<ReportProject, "id" | "title" | "clientName">,
  lines: LineRow[],
  costs: CostRow[],
  invoiceTotal: number | null,
  manualBilled: number | string | null | undefined
): MoneyRow {
  const byLabel = new Map<string, number>();
  for (const l of lines) {
    const amount = lineActual(
      { id: l.id, actual: l.actual == null ? null : Number(l.actual) || 0 },
      costs
    );
    if (!amount) continue;
    const label = (l.category ?? "").trim() || "Other";
    byLabel.set(label, (byLabel.get(label) ?? 0) + amount);
  }
  const unassigned = costs
    .filter((c) => !c.budget_line_id)
    .reduce((n, c) => n + (Number(c.amount) || 0), 0);
  if (unassigned) byLabel.set("Not on a budget line", (byLabel.get("Not on a budget line") ?? 0) + unassigned);

  const breakdown = [...byLabel.entries()]
    .map(([label, amount]) => ({ label, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);
  const cost = round2(breakdown.reduce((n, b) => n + b.amount, 0));

  const manual = Number(manualBilled);
  const billedSource: MoneyRow["billedSource"] =
    invoiceTotal != null ? "invoices" : Number.isFinite(manual) && manual > 0 ? "manual" : "none";
  const billed = round2(
    billedSource === "invoices" ? invoiceTotal ?? 0 : billedSource === "manual" ? manual : 0
  );

  return {
    projectId: project.id,
    title: project.title,
    clientName: project.clientName,
    billed,
    billedSource,
    margin: marginOf(billed, cost),
    breakdown,
  };
}

export function moneyTotals(rows: MoneyRow[]): Margin {
  const billed = round2(rows.reduce((n, r) => n + r.billed, 0));
  const cost = round2(rows.reduce((n, r) => n + r.margin.cost, 0));
  return marginOf(billed, cost);
}

/* ---------------------------------------------------------- delivery */

export const DELIVERED_NOTE = "Moved to Delivered";

/**
 * When each job was marked delivered, read from the activity log (the stage
 * change writes "Moved to Delivered"). The LATEST such entry wins, since a job
 * moved back and delivered again was delivered the second time.
 */
export function deliveredDates(
  activity: { project_id: string | null; type: string; content: string | null; created_at: string }[]
): Map<string, string> {
  const out = new Map<string, string>();
  for (const a of activity) {
    if (!a.project_id || a.type !== "status_change") continue;
    if ((a.content ?? "").trim() !== DELIVERED_NOTE) continue;
    const day = a.created_at.slice(0, 10);
    const prev = out.get(a.project_id);
    if (!prev || day > prev) out.set(a.project_id, day);
  }
  return out;
}

export type DeliveryState =
  | { kind: "on_time"; daysEarly: number }
  | { kind: "late"; daysLate: number }
  | { kind: "overdue"; daysOver: number }
  | { kind: "open" }
  | { kind: "no_due" }
  | { kind: "unknown" };

function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 0;
}

export function deliveryState(
  p: Pick<ReportProject, "status" | "dueDate">,
  deliveredAt: string | null | undefined,
  todayIso: string
): DeliveryState {
  if (p.status !== "delivered") {
    if (p.dueDate && p.dueDate < todayIso) return { kind: "overdue", daysOver: dayDiff(todayIso, p.dueDate) };
    return { kind: "open" };
  }
  if (!p.dueDate) return { kind: "no_due" };
  // Delivered before this log existed, or moved by hand in the database.
  if (!deliveredAt) return { kind: "unknown" };
  const diff = dayDiff(deliveredAt, p.dueDate);
  return diff <= 0 ? { kind: "on_time", daysEarly: -diff } : { kind: "late", daysLate: diff };
}

export type OnTime = { onTime: number; late: number; overdue: number; unknown: number; rate: number | null };

export function onTimeSummary(states: DeliveryState[]): OnTime {
  const count = (k: DeliveryState["kind"]) => states.filter((s) => s.kind === k).length;
  const onTime = count("on_time");
  const late = count("late");
  return {
    onTime,
    late,
    overdue: count("overdue"),
    unknown: count("unknown"),
    rate: onTime + late > 0 ? Math.round((onTime / (onTime + late)) * 100) : null,
  };
}

/* ------------------------------------------------------ client review */

export type ClientDecision = {
  projectId: string;
  status: string;
  /** When the client first answered through the link. */
  decidedAt: string;
  /** When the work was in front of them: the link, or a later version. */
  sentAt: string;
};

/** Days from sent to decided, never negative, to one decimal. */
export function turnaroundDays(sentAt: string, decidedAt: string): number | null {
  const s = Date.parse(sentAt);
  const d = Date.parse(decidedAt);
  if (!Number.isFinite(s) || !Number.isFinite(d)) return null;
  return Math.round((Math.max(0, d - s) / 86_400_000) * 10) / 10;
}

export function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round(((v[mid - 1] + v[mid]) / 2) * 10) / 10;
}

export type ClientRow = {
  clientId: string | null;
  clientName: string;
  jobs: number;
  decisions: number;
  medianDays: number | null;
  changeRequests: number;
  /** Change requests per job that went to the client at all. */
  roundsPerJob: number | null;
  billed: number;
  profit: number;
};

export function clientRows(
  projects: ReportProject[],
  decisions: ClientDecision[],
  money: MoneyRow[]
): ClientRow[] {
  const byClient = new Map<string, ReportProject[]>();
  for (const p of projects) {
    const key = p.clientId ?? "";
    byClient.set(key, [...(byClient.get(key) ?? []), p]);
  }
  const rows: ClientRow[] = [];
  for (const [key, list] of byClient) {
    const ids = new Set(list.map((p) => p.id));
    const mine = decisions.filter((d) => ids.has(d.projectId));
    const days = mine
      .map((d) => turnaroundDays(d.sentAt, d.decidedAt))
      .filter((n): n is number => n != null);
    const changeRequests = mine.filter((d) => d.status === "changes_requested").length;
    const reviewedJobs = new Set(mine.map((d) => d.projectId)).size;
    const m = money.filter((r) => ids.has(r.projectId));
    rows.push({
      clientId: key || null,
      clientName: list[0].clientName ?? "No client",
      jobs: list.length,
      decisions: mine.length,
      medianDays: median(days),
      changeRequests,
      roundsPerJob: reviewedJobs ? Math.round((changeRequests / reviewedJobs) * 10) / 10 : null,
      billed: round2(m.reduce((n, r) => n + r.billed, 0)),
      profit: round2(m.reduce((n, r) => n + r.margin.profit, 0)),
    });
  }
  // The clients that matter most to the studio first: by what they paid.
  return rows.sort((a, b) => b.billed - a.billed || b.jobs - a.jobs || a.clientName.localeCompare(b.clientName));
}

/** "2.5 days", "under a day", "1 day". */
export function daysLabel(d: number | null): string {
  if (d == null) return "None yet";
  if (d < 1) return "Under a day";
  const n = Math.round(d * 10) / 10;
  return `${n} ${n === 1 ? "day" : "days"}`;
}
