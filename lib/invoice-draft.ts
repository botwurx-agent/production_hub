/**
 * The trust boundary between a model reading a vendor's bill and the money
 * fields of a cost record.
 *
 * Deliberately NOT "server-only" (same call as lib/shot-doc.ts and
 * lib/billing-import.ts): the parsing is pure, it is where the sharp edges
 * live, and it has to be unit-testable outside Next.
 */

/** Shared with the invoice parser: a money value that cannot be trusted raw. */
export function money(v: unknown): number | null {
  let n: number | null = null;
  if (typeof v === "number") {
    n = v;
  } else if (typeof v === "string") {
    const digits = v.replace(/[^0-9.\-]/g, "");
    // Number("") is 0, so a string with no digits would otherwise land as a
    // real zero fee rather than as nothing extracted.
    n = digits === "" ? NaN : Number(digits);
  }
  if (n === null || !Number.isFinite(n) || n < 0 || n > 1e9) return null;
  return Math.round(n * 100) / 100;
}

export type InvoiceDraft = {
  /** What the document calls itself, so the UI can say which it read. */
  documentKind: "invoice" | "estimate" | null;
  vendor: string | null;
  /**
   * The other name the cost could be filed under, when a bill arrives through
   * a rep or a loan-out company on behalf of a named artist. Both are tried
   * against the project roster, since either may be the name the studio knows.
   */
  vendorAlt: string | null;
  description: string | null;
  amount: number | null;
  days: number | null;
  currency: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  budgetLineId: string | null;
  notes: string | null;
  unreadable: boolean;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export function day(v: unknown): string | null {
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
 * The model's JSON is untrusted input: it can be malformed, wrapped in a code
 * fence, or carry a hallucinated budget line id. Everything is validated here,
 * and anything that fails becomes null rather than reaching a money field.
 */
export function parseInvoiceDraft(raw: string, validLineIds: string[]): InvoiceDraft {
  const empty: InvoiceDraft = {
    documentKind: null,
    vendor: null,
    vendorAlt: null,
    description: null,
    amount: null,
    days: null,
    currency: null,
    invoiceNumber: null,
    invoiceDate: null,
    dueDate: null,
    budgetLineId: null,
    notes: null,
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

  // Accept a number, or a string the model formatted anyway ("1,250.00", "$900").
  let amount: number | null = null;
  const rawAmount = obj.amount;
  if (typeof rawAmount === "number") {
    amount = rawAmount;
  } else if (typeof rawAmount === "string") {
    const digits = rawAmount.replace(/[^0-9.\-]/g, "");
    // Number("") is 0, so a string with no digits at all ("n/a", "see below")
    // would otherwise land in a money field as $0.00 and read as a real zero
    // cost rather than as nothing extracted.
    const n = digits === "" ? NaN : Number(digits);
    amount = Number.isFinite(n) ? n : null;
  }
  // A negative or absurd total is a misread, not a cost.
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1e9)) {
    amount = null;
  }
  if (amount !== null) amount = Math.round(amount * 100) / 100;

  // A day count is only useful when it is a plausible number of days; anything
  // else means the model inferred rather than read it.
  const rawDays = typeof obj.days === "number" ? obj.days : Number(obj.days);
  const days =
    Number.isFinite(rawDays) && rawDays > 0 && rawDays <= 500
      ? Math.round(rawDays * 100) / 100
      : null;

  const lineId = str(obj.budgetLineId, 64);

  const kindRaw = str(obj.documentKind, 20)?.toLowerCase() ?? null;
  const documentKind =
    kindRaw === "invoice"
      ? "invoice"
      : kindRaw === "estimate" || kindRaw === "quote" || kindRaw === "bid"
        ? "estimate"
        : null;

  const vendor = str(obj.vendor, 200);
  const vendorAltRaw = str(obj.vendorAlt, 200);

  return {
    documentKind,
    vendor,
    // A repeat of the same name carries nothing, and would make the vendor
    // fallback below try the string that already failed.
    vendorAlt:
      vendorAltRaw && vendorAltRaw.toLowerCase() !== (vendor ?? "").toLowerCase()
        ? vendorAltRaw
        : null,
    description: str(obj.description, 200),
    amount,
    days,
    currency: str(obj.currency, 8),
    invoiceNumber: str(obj.invoiceNumber, 100),
    invoiceDate: day(obj.invoiceDate),
    dueDate: day(obj.dueDate),
    // A hallucinated id would silently file the cost against the wrong line.
    budgetLineId: lineId && validLineIds.includes(lineId) ? lineId : null,
    notes: str(obj.notes, 500),
    unreadable: obj.unreadable === true,
  };
}
