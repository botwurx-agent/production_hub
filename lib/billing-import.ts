// Reading an exported billing document (a FreshBooks estimate or invoice PDF)
// back into the app's own document model, so the operator never retypes a
// document that already exists somewhere else.
//
// This module is the TRUST BOUNDARY between model output and a document that
// carries money figures, the same job parseInvoiceDraft does for costs and
// parseSowDraft does for agreements. It is deliberately NOT "server-only"
// (same call as lib/shot-doc.ts and lib/agent/messages.ts): the parser is pure
// and unit-tested in the scratchpad, and lib/ai.ts imports it for the live
// extraction path.

export type BillingDocLineDraft = {
  description: string;
  qty: number;
  rate: number;
  taxRate: number;
};

export type BillingDocDraft = {
  /** What the document calls itself. null when the title is unreadable. */
  kind: "estimate" | "invoice" | "proposal" | null;
  /** The document's own printed number, kept verbatim (our series is not used). */
  number: string | null;
  issueDate: string | null;
  dueDate: string | null;
  billToName: string | null;
  billToCompany: string | null;
  billToEmail: string | null;
  reference: string | null;
  currency: string | null;
  lines: BillingDocLineDraft[];
  discount: number;
  notes: string | null;
  terms: string | null;
  /** The grand total the document itself prints, for cross-checking the lines. */
  statedTotal: number | null;
  unreadable: boolean;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function day(v: unknown): string | null {
  const s = str(v, 10);
  if (!s || !ISO_DAY.test(s)) return null;
  // A syntactically valid string can still be an impossible date (2026-02-31),
  // and Date would silently roll it forward into March.
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const ok =
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  return ok ? s : null;
}

/**
 * A money value that cannot be trusted raw. Number("") is 0, so a string with
 * no digits at all ("n/a") would otherwise land in a money field as $0.00 and
 * read as a real zero rather than as nothing extracted.
 */
function money(v: unknown, allowNegative = false): number | null {
  let n: number | null = null;
  if (typeof v === "number") {
    n = v;
  } else if (typeof v === "string") {
    const digits = v.replace(/[^0-9.\-]/g, "");
    n = digits === "" || digits === "-" ? NaN : Number(digits);
  }
  if (n === null || !Number.isFinite(n)) return null;
  if (!allowNegative && n < 0) return null;
  if (Math.abs(n) > 1e9) return null;
  return Math.round(n * 100) / 100;
}

const KINDS = ["estimate", "invoice", "proposal"] as const;

/**
 * Parse the model's JSON into a draft. Everything is validated; anything that
 * fails becomes null (or is dropped) rather than reaching a money field.
 */
export function parseBillingDocDraft(raw: string): BillingDocDraft {
  const empty: BillingDocDraft = {
    kind: null,
    number: null,
    issueDate: null,
    dueDate: null,
    billToName: null,
    billToCompany: null,
    billToEmail: null,
    reference: null,
    currency: null,
    lines: [],
    discount: 0,
    notes: null,
    terms: null,
    statedTotal: null,
    unreadable: true,
  };

  // Models sometimes wrap JSON in a fence despite being told not to.
  const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return empty;

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return empty;
  }

  const rawKind = str(obj.kind, 20)?.toLowerCase() ?? null;
  // A "quote" is an estimate by another name; anything else unrecognized is null.
  const kind = (KINDS as readonly string[]).includes(rawKind ?? "")
    ? (rawKind as BillingDocDraft["kind"])
    : rawKind === "quote"
      ? "estimate"
      : null;

  const rawLines = Array.isArray(obj.lines) ? obj.lines : [];
  const lines: BillingDocLineDraft[] = [];
  // Capped: a runaway list is a misread, and each entry becomes a document row.
  for (const item of rawLines.slice(0, 60)) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    const description = str(row.description, 500);
    // A line with no description cannot be checked against the document.
    if (!description) continue;

    const qtyRaw = money(row.qty);
    const qty = qtyRaw !== null && qtyRaw > 0 && qtyRaw <= 100000 ? qtyRaw : 1;

    // Negative rates are allowed: a credit line on a real invoice is printed as
    // one, and refusing it would make the totals cross-check fail instead.
    const rate = money(row.rate, true) ?? 0;

    const taxRaw = money(row.taxRate);
    const taxRate = taxRaw !== null && taxRaw >= 0 && taxRaw <= 100 ? taxRaw : 0;

    lines.push({ description, qty, rate, taxRate });
  }

  const currencyRaw = str(obj.currency, 8)?.toUpperCase() ?? null;
  const currency = currencyRaw && /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : null;

  return {
    kind,
    number: str(obj.number, 100),
    issueDate: day(obj.issueDate),
    dueDate: day(obj.dueDate),
    billToName: str(obj.billToName, 200),
    billToCompany: str(obj.billToCompany, 200),
    billToEmail: str(obj.billToEmail, 200),
    reference: str(obj.reference, 200),
    currency,
    lines,
    discount: money(obj.discount) ?? 0,
    notes: str(obj.notes, 2000),
    terms: str(obj.terms, 2000),
    statedTotal: money(obj.statedTotal),
    unreadable: obj.unreadable === true,
  };
}

/**
 * Cross-check the parsed lines against the total the document itself prints.
 * Returns a human-readable discrepancy line, or null when they agree (within a
 * dollar, so ordinary rounding is not a discrepancy) or when there is nothing
 * to check against.
 */
export function totalsMismatch(draft: BillingDocDraft): string | null {
  if (draft.statedTotal === null || draft.lines.length === 0) return null;
  const subtotal = draft.lines.reduce((s, l) => s + l.rate * l.qty, 0);
  const tax = draft.lines.reduce(
    (s, l) => s + l.rate * l.qty * (l.taxRate / 100),
    0
  );
  const computed = subtotal + tax - draft.discount;
  if (Math.abs(computed - draft.statedTotal) <= 1) return null;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `The imported lines add up to ${fmt(computed)} but the PDF states ${fmt(
    draft.statedTotal
  )}. Check the lines against the document.`;
}
