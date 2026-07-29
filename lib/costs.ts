/**
 * Cost ledger vocabulary. Lives outside the actions file because a "use server"
 * module can only export async functions, and the budget table needs these
 * client-side.
 */

/**
 * Where a vendor invoice is in its life. Deliberately three states and no
 * approval chain: this answers "what did the job cost and who is owed", it is
 * not production accounting.
 */
export const COST_STATUS = {
  received: { label: "Received", hue: "amber" },
  approved: { label: "Approved", hue: "blue" },
  paid: { label: "Paid", hue: "green" },
} as const;

export type CostStatus = keyof typeof COST_STATUS;

export const COST_STATUS_ORDER: CostStatus[] = ["received", "approved", "paid"];

export function isCostStatus(v: string): v is CostStatus {
  return v in COST_STATUS;
}

export function costStatus(v: string | null | undefined): CostStatus {
  return v && isCostStatus(v) ? v : "received";
}

/**
 * A cost document travels browser -> Server Action -> storage, so its bytes
 * cross the ~4.5MB serverless request body. Over that the request is killed at
 * the platform edge before our code runs, so the click just appears to do
 * nothing. Staying under it lets us fail with a message instead. Matches
 * MAX_UPLOAD_BYTES in lib/attachment-limits.ts, which exists for the same
 * reason on the email path. An invoice PDF or a phone photo is well inside it.
 */
export const MAX_COST_DOC_BYTES = 4_000_000;

/** What we can actually read: a PDF, or a photo of a paper invoice. */
export const COST_DOC_TYPES = ["application/pdf", "image/"] as const;

export function isCostDocType(mime: string): boolean {
  return mime === "application/pdf" || mime.startsWith("image/");
}

/**
 * Structural minimums, so both the budget page (full rows) and the project hub
 * (a two-column select) can share the roll-up without loading columns they do
 * not need.
 */
type CostLike = { budget_line_id: string | null; amount: number | string };
type LineLike = { id: string; actual: number | null };

/**
 * The actual spend for one budget line. Invoices attached to the line win; the
 * typed number is the fallback for a line nobody has logged costs against, so
 * a quick manual estimate still works and no pre-ledger number is stranded.
 */
export function lineActual(line: LineLike, costs: CostLike[]): number {
  const linked = costs.filter((c) => c.budget_line_id === line.id);
  if (linked.length === 0) return line.actual ?? 0;
  return linked.reduce((n, c) => n + (Number(c.amount) || 0), 0);
}

/**
 * Total actual spend across the project. Costs not yet assigned to a line are
 * included: the money left the account whether or not anyone has categorised
 * it, and omitting them would quietly understate every total on the page.
 */
export function rollUpActual(lines: LineLike[], costs: CostLike[]): number {
  const fromLines = lines.reduce((n, l) => n + lineActual(l, costs), 0);
  const unassigned = costs
    .filter((c) => !c.budget_line_id)
    .reduce((n, c) => n + (Number(c.amount) || 0), 0);
  return fromLines + unassigned;
}
